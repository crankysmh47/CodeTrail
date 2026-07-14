import { describe, expect, it } from 'vitest';
import {
  createEdgeId,
  createNodeId,
  createRange,
  type CodeEdge,
  type CodeEdgeKind,
  type CodeNode,
  type Confidence,
  type WorkspaceIndex,
} from './contracts.js';
import { buildDiscovery } from './discovery.js';
import type { SubgraphResult } from './graph.js';

function node(path: string, name: string, kind: CodeNode['kind'], line: number): CodeNode {
  return {
    id: createNodeId('c', path, kind, name),
    language: 'c',
    kind,
    name,
    qualifiedName: name,
    path,
    range: createRange(line, 1, line, 20),
    signature: name,
    summary: `${kind} ${name}`,
    tokens: name.split('_'),
  };
}

function edge(
  source: CodeNode,
  target: CodeNode,
  kind: CodeEdgeKind,
  confidence: Confidence,
  line: number,
): CodeEdge {
  const range = createRange(line, 1, line, 20);
  return {
    id: createEdgeId(source.id, kind, target.id, range),
    sourceId: source.id,
    targetId: target.id,
    kind,
    confidence,
    reason: `${source.name} ${kind} ${target.name}`,
    path: source.path,
    range,
  };
}

const field = node('kernel/sched/sched.h', 'pick_task', 'field', 18);
const pickNext = node('kernel/sched/fair.c', 'pick_next_task_fair', 'function', 15);
const pickEevdf = node('kernel/sched/fair.c', 'pick_eevdf', 'function', 8);
const eligible = node('kernel/sched/fair.c', 'entity_eligible', 'function', 3);
const registration = edge(field, pickNext, 'registers', 'inferred', 20);
const possibleRegistration = edge(field, pickNext, 'dispatches-to', 'possible', 21);
const callsEevdf = edge(pickNext, pickEevdf, 'calls', 'confirmed', 17);
const callsEligible = edge(pickEevdf, eligible, 'calls', 'confirmed', 10);
const nodes = [field, pickNext, pickEevdf, eligible];
const edges = [registration, possibleRegistration, callsEevdf, callsEligible];
const index: WorkspaceIndex = {
  version: 1,
  rootPath: '/linux',
  createdAtIso: '2026-07-15T00:00:00.000Z',
  nodes,
  edges,
  warnings: [],
  filesIndexed: 2,
  isPartial: false,
};
const subgraph: SubgraphResult = { nodes, edges, isTruncated: false, reason: '' };

describe('code relationship discovery', () => {
  it('should project cross-file links before grouping the within-file trail', () => {
    const discovery = buildDiscovery(index, subgraph, pickNext.id);

    expect(discovery.fileLinks).toStrictEqual([
      {
        sourcePath: 'kernel/sched/sched.h',
        targetPath: 'kernel/sched/fair.c',
        kinds: ['dispatches-to', 'registers'],
        confidence: 'possible',
        reason: 'pick_task dispatches-to pick_next_task_fair',
        evidenceCount: 2,
      },
    ]);
    expect(discovery.fileSections.map((section) => section.path)).toStrictEqual([
      'kernel/sched/sched.h',
      'kernel/sched/fair.c',
    ]);
    expect(discovery.fileSections[0]?.steps).toStrictEqual([]);
    expect(discovery.fileSections[0]?.relatedEdgeIds).toStrictEqual([
      possibleRegistration.id,
      registration.id,
    ]);
    expect(discovery.fileSections[1]?.steps.map((step) => step.nodeId)).toStrictEqual([
      pickNext.id,
      pickEevdf.id,
      eligible.id,
    ]);
  });

  it('should report a local-only discovery without fabricating file links', () => {
    const localNodes = [pickNext, pickEevdf, eligible];
    const localEdges = [callsEevdf, callsEligible];

    const discovery = buildDiscovery(
      { ...index, nodes: localNodes, edges: localEdges, filesIndexed: 1 },
      { nodes: localNodes, edges: localEdges, isTruncated: false, reason: '' },
      pickNext.id,
    );

    expect(discovery.fileLinks).toStrictEqual([]);
    expect(discovery.fileSections.map((section) => section.path)).toStrictEqual(['kernel/sched/fair.c']);
  });

  it('should return no unrelated file hierarchy for a missing seed', () => {
    const discovery = buildDiscovery(index, subgraph, 'missing');

    expect(discovery.fileLinks).toStrictEqual([]);
    expect(discovery.fileSections).toStrictEqual([]);
    expect(discovery.trail.title).toBe('Trail unavailable');
  });
});
