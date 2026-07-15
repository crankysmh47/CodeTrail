import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { indexWorkspace } from './analysis/indexer.js';
import { createCParser } from './analysis/parser-runtime.js';
import { buildDiscovery } from './core/discovery.js';
import { buildBoundedSubgraph } from './core/graph.js';
import { searchIndex } from './core/search.js';

describe('Linux scheduler gold path', () => {
  it('should turn a broad scheduler search into an evidence-backed selected trail', async () => {
    const parser = await createCParser({
      parserWasmPath: fileURLToPath(import.meta.resolve('web-tree-sitter/tree-sitter.wasm')),
      languageWasmPath: fileURLToPath(import.meta.resolve('tree-sitter-wasms/out/tree-sitter-c.wasm')),
    });
    const index = await indexWorkspace({
      rootPath: fileURLToPath(new URL('../test-fixtures/kernel-mini', import.meta.url)),
      parser,
      limits: { filesMax: 20, fileBytesMax: 2_097_152, totalBytesMax: 10_485_760 },
      signal: new AbortController().signal,
    });

    const result = searchIndex(index, 'schedule', 20);
    const resultNames = result.candidates.map(
      (candidate) => index.nodes.find((node) => node.id === candidate.nodeId)?.name,
    );
    expect(resultNames).toEqual(expect.arrayContaining(['pick_task', 'pick_next_task_fair']));
    const seedCandidate = result.candidates.find(
      (candidate) => index.nodes.find((node) => node.id === candidate.nodeId)?.name === 'pick_next_task_fair',
    );
    const seed = index.nodes.find((node) => node.id === seedCandidate?.nodeId);
    expect(seed?.name).toBe('pick_next_task_fair');
    const subgraph = buildBoundedSubgraph(index, [seed!.id], {
      nodesMax: 40,
      edgesMax: 80,
      depthMax: 4,
      timeMsMax: 100,
    });
    const discovery = buildDiscovery(index, subgraph, seed!.id);
    const trailNames = discovery.trail.steps.map(
      (step) => index.nodes.find((node) => node.id === step.nodeId)?.name,
    );

    expect(trailNames.slice(0, 3)).toStrictEqual([
      'pick_next_task_fair',
      'pick_eevdf',
      'entity_eligible',
    ]);
    expect(discovery.fileLinks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourcePath: 'sched.h',
          targetPath: 'fair.c',
          kinds: expect.arrayContaining(['registers']),
          confidence: 'inferred',
        }),
      ]),
    );
    expect(discovery.fileSections.map((section) => section.path)).toStrictEqual(['sched.h', 'fair.c']);
    expect(index.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'registers', confidence: 'inferred' }),
        expect.objectContaining({ kind: 'dispatches-to', confidence: 'inferred' }),
      ]),
    );
    expect(discovery.trail.disclaimer).toBe('Static reading order; not a runtime trace.');
  });

  it.each([
    ['pick next task fair', 'pick_next_task_fair'],
    ['eevdf eligible', 'entity_eligible'],
    ['register dispatch', 'pick_task'],
  ])('should rank the expected seed for %s', async (query, expectedName) => {
    const parser = await createCParser({
      parserWasmPath: fileURLToPath(import.meta.resolve('web-tree-sitter/tree-sitter.wasm')),
      languageWasmPath: fileURLToPath(import.meta.resolve('tree-sitter-wasms/out/tree-sitter-c.wasm')),
    });
    const index = await indexWorkspace({
      rootPath: fileURLToPath(new URL('../test-fixtures/kernel-mini', import.meta.url)),
      parser,
      limits: { filesMax: 20, fileBytesMax: 2_097_152, totalBytesMax: 10_485_760 },
      signal: new AbortController().signal,
    });

    const result = searchIndex(index, query, 8);
    const seed = index.nodes.find((node) => node.id === result.candidates[0]?.nodeId);

    expect(seed?.name).toBe(expectedName);
  });
});
