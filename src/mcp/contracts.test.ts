import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CodeTrailService } from '../service/codetrail-service.js';
import { resolveDependencyParserAssets } from '../service/parser-assets.js';
import {
  projectReadingPath,
  projectSearchCode,
  projectSymbol,
  projectWorkspaceStatus,
  searchCodeInputSchema,
  symbolInputSchema,
} from './contracts.js';

const fixtureRootPath = fileURLToPath(new URL('../../test-fixtures/kernel-mini', import.meta.url));
let service: CodeTrailService;

beforeAll(async () => {
  service = await CodeTrailService.create({
    rootPath: fixtureRootPath,
    ...resolveDependencyParserAssets(),
  });
});

afterAll(() => {
  service.dispose();
});

describe('MCP input contracts', () => {
  it.each([
    [{ query: ' schedule ', limit: 20 }, { query: 'schedule', limit: 20 }],
    [{ query: 'schedule' }, { query: 'schedule', limit: 10 }],
  ])('should normalize valid search input %#', (input, expected) => {
    expect(searchCodeInputSchema.parse(input)).toStrictEqual(expected);
  });

  it.each([
    { query: '' },
    { query: 'x'.repeat(201) },
    { query: 'schedule', limit: 0 },
    { query: 'schedule', limit: 21 },
    { query: 'schedule', limit: 1.5 },
  ])('should reject unsafe search input %#', (input) => {
    expect(searchCodeInputSchema.safeParse(input).success).toBe(false);
  });

  it('should normalize a bounded symbol identifier', () => {
    expect(symbolInputSchema.parse({ symbolId: ' c:fair.c:function:pick_eevdf ' })).toStrictEqual({
      symbolId: 'c:fair.c:function:pick_eevdf',
    });
    expect(symbolInputSchema.safeParse({ symbolId: 'x'.repeat(501) }).success).toBe(false);
  });
});

describe('MCP output projections', () => {
  it('should project deterministic search candidates with ranking evidence', () => {
    const search = service.search('schedule', 20);

    const first = projectSearchCode(service.getIndex(), 'schedule', search, 5);
    const second = projectSearchCode(service.getIndex(), 'schedule', search, 5);

    expect(second).toStrictEqual(first);
    expect(first.query).toBe('schedule');
    expect(first.normalizedQuery).toBe('sched');
    expect(first.returned).toBe(5);
    expect(first.truncated).toBe(true);
    expect(first.candidates[0]).toStrictEqual(
      expect.objectContaining({
        symbolId: expect.stringMatching(/^c:/),
        language: 'c',
        score: expect.any(Number),
        reasons: expect.arrayContaining([expect.any(String)]),
        source: expect.objectContaining({ path: expect.stringMatching(/\.(c|h)$/) }),
      }),
    );
  });

  it('should project direct relationships with confidence and source evidence', () => {
    const seed = service
      .getIndex()
      .nodes.find((node) => node.kind === 'function' && node.name === 'pick_next_task_fair');

    const output = projectSymbol(service.getIndex(), seed?.id ?? '');

    expect(output.symbol.name).toBe('pick_next_task_fair');
    expect(output.analysisKind).toBe('static-reading-path');
    expect(output.disclaimer).toBe('Static reading order; not a runtime trace.');
    expect(output.relationships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          direction: expect.stringMatching(/^(incoming|outgoing)$/),
          kind: expect.any(String),
          confidence: expect.stringMatching(/^(confirmed|inferred|possible)$/),
          reason: expect.any(String),
          evidence: expect.objectContaining({
            path: expect.stringMatching(/\.(c|h)$/),
            range: expect.objectContaining({ lineStart: expect.any(Number) }),
          }),
        }),
      ]),
    );
  });

  it('should project the same file-first reading path used by VS Code', () => {
    const seed = service
      .getIndex()
      .nodes.find((node) => node.kind === 'function' && node.name === 'pick_next_task_fair');
    const discovery = service.discover(seed?.id ?? '');

    const output = projectReadingPath(service.getIndex(), discovery);

    expect(output.seed.symbolId).toBe(seed?.id);
    expect(output.fileRoute).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourcePath: 'sched.h',
          targetPath: 'fair.c',
          confidence: 'inferred',
          evidence: expect.arrayContaining([
            expect.objectContaining({ path: 'fair.c', range: expect.objectContaining({ lineStart: expect.any(Number) }) }),
          ]),
        }),
      ]),
    );
    expect(output.withinFiles.map((section) => section.path)).toStrictEqual(['sched.h', 'fair.c']);
    expect(output.trail.map((step) => step.symbol.name).slice(0, 3)).toStrictEqual([
      'pick_next_task_fair',
      'pick_eevdf',
      'entity_eligible',
    ]);
    expect(output.disclaimer).toBe('Static reading order; not a runtime trace.');
  });

  it('should keep file-route evidence inside the bounded discovery subgraph', () => {
    const index = service.getIndex();
    const seed = index.nodes.find((node) => node.kind === 'function' && node.name === 'pick_next_task_fair');
    const discovery = service.discover(seed?.id ?? '');
    const discoveredEdgeIds = new Set(discovery.fileSections.flatMap((section) => section.relatedEdgeIds));
    const route = discovery.fileLinks[0];
    if (!route) {
      throw new Error('Fixture discovery did not produce a cross-file route.');
    }
    const routeEdge = index.edges.find((edge) => {
      const source = index.nodes.find((node) => node.id === edge.sourceId);
      const target = index.nodes.find((node) => node.id === edge.targetId);
      return (
        discoveredEdgeIds.has(edge.id) &&
        source?.path === route?.sourcePath &&
        target?.path === route.targetPath &&
        route.kinds.includes(edge.kind)
      );
    });
    expect(routeEdge).toBeDefined();
    const unrelatedEdge = {
      ...routeEdge!,
      id: `${routeEdge?.id}:outside-discovery`,
      range: { lineStart: 999, columnStart: 1, lineEnd: 999, columnEnd: 2 },
    };

    const output = projectReadingPath({ ...index, edges: [...index.edges, unrelatedEdge] }, discovery);
    const projectedRoute = output.fileRoute.find(
      (link) => link.sourcePath === route.sourcePath && link.targetPath === route.targetPath,
    );

    expect(projectedRoute?.evidence).toHaveLength(route.evidenceCount);
    expect(projectedRoute?.evidence).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ range: expect.objectContaining({ lineStart: 999 }) })]),
    );
  });

  it('should keep reading-path relationships on the selected trail without weakening direct symbol inspection', () => {
    const index = service.getIndex();
    const seed = index.nodes.find((node) => node.kind === 'function' && node.name === 'pick_next_task_fair');
    const discovery = service.discover(seed?.id ?? '');
    const route = discovery.fileLinks[0];
    const routeEdge = index.edges.find((edge) => {
      const source = index.nodes.find((node) => node.id === edge.sourceId);
      const target = index.nodes.find((node) => node.id === edge.targetId);
      return source?.path === route?.sourcePath && target?.path === route?.targetPath;
    });
    if (!route || !routeEdge) {
      throw new Error('Fixture discovery did not produce a route edge.');
    }
    const extraEdges = Array.from({ length: 12 }, (_, indexValue) => ({
      ...routeEdge,
      id: `${routeEdge.id}:bounded-${indexValue}`,
      range: {
        lineStart: 800 + indexValue,
        columnStart: 1,
        lineEnd: 800 + indexValue,
        columnEnd: 2,
      },
    }));
    const extraEdgeIds = extraEdges.map((edge) => edge.id);
    const expandedDiscovery = {
      ...discovery,
      fileLinks: discovery.fileLinks.map((link) =>
        link === route ? { ...link, evidenceCount: link.evidenceCount + extraEdges.length } : link,
      ),
      fileSections: discovery.fileSections.map((section) =>
        section.path === route.sourcePath || section.path === route.targetPath
          ? { ...section, relatedEdgeIds: [...section.relatedEdgeIds, ...extraEdgeIds] }
          : section,
      ),
    };

    const output = projectReadingPath({ ...index, edges: [...index.edges, ...extraEdges] }, expandedDiscovery);

    expect(output.fileRoute.find((link) => link.sourcePath === route.sourcePath)?.evidence).toHaveLength(8);
    expect(output.withinFiles.every((section) => section.relationships.length <= 8)).toBe(true);
    expect(output.withinFiles.flatMap((section) => section.relationships).map((relationship) => relationship.relationshipId)).not.toEqual(
      expect.arrayContaining(extraEdgeIds),
    );
    expect(projectSymbol({ ...index, edges: [...index.edges, ...extraEdges] }, routeEdge.sourceId).relationships.length).toBe(
      13,
    );
  });

  it('should expose bounded workspace status without host or repository secrets', () => {
    const output = projectWorkspaceStatus(service.getIndex());
    const serialized = JSON.stringify(output);

    expect(output).toStrictEqual(
      expect.objectContaining({
        language: 'c',
        analysisMode: 'structural',
        filesIndexed: 2,
        isPartial: false,
        tools: ['search_code', 'get_symbol', 'get_reading_path'],
      }),
    );
    expect(serialized).not.toMatch(/process\.env|credential|token|remoteUrl|sourceText/i);
    expect(serialized.length).toBeLessThan(32_000);
  });
});
