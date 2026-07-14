import { describe, expect, it } from 'vitest';
import {
  createEdgeId,
  createNodeId,
  createRange,
  type CodeEdge,
  type CodeEdgeKind,
  type CodeNode,
  type WorkspaceIndex,
} from './contracts.js';
import type { SubgraphResult } from './graph.js';
import { buildTrail } from './trail.js';

function node(name: string, kind: CodeNode['kind'], line: number): CodeNode {
  return {
    id: createNodeId('c', 'kernel/sched/fair.c', kind, name),
    language: 'c',
    kind,
    name,
    qualifiedName: name,
    path: 'kernel/sched/fair.c',
    range: createRange(line, 1, line, 20),
    signature: name,
    summary: '',
    tokens: name.split('_'),
  };
}

function edge(source: CodeNode, target: CodeNode, kind: CodeEdgeKind, line: number): CodeEdge {
  const range = createRange(line, 1, line, 20);
  return {
    id: createEdgeId(source.id, kind, target.id, range),
    sourceId: source.id,
    targetId: target.id,
    kind,
    confidence: 'confirmed',
    reason: `${source.name} ${kind} ${target.name}`,
    path: source.path,
    range,
  };
}

const pickNext = node('pick_next_task_fair', 'function', 10);
const pickEevdf = node('pick_eevdf', 'function', 20);
const eligible = node('entity_eligible', 'function', 30);
const vruntime = node('vruntime', 'field', 40);
const nodes = [pickNext, pickEevdf, eligible, vruntime];
const edges = [
  edge(pickNext, pickEevdf, 'calls', 11),
  edge(pickEevdf, eligible, 'calls', 21),
  edge(eligible, vruntime, 'reads', 31),
];
const index: WorkspaceIndex = {
  version: 1,
  rootPath: '/linux',
  createdAtIso: '2026-07-14T00:00:00.000Z',
  nodes,
  edges,
  warnings: [],
  filesIndexed: 1,
  isPartial: false,
};
const subgraph: SubgraphResult = { nodes, edges, isTruncated: false, reason: '' };

describe('trail builder', () => {
  it('should order entry, implementation, eligibility, and state evidence', () => {
    const trail = buildTrail(index, subgraph, pickNext.id);

    expect(trail.steps.map((step) => step.nodeId)).toStrictEqual([
      pickNext.id,
      pickEevdf.id,
      eligible.id,
      vruntime.id,
    ]);
    expect(trail.disclaimer).toBe('Static reading order; not a runtime trace.');
  });
});
