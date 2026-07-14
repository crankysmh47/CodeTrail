import { performance } from 'node:perf_hooks';
import { describe, expect, it } from 'vitest';
import {
  createEdgeId,
  createNodeId,
  createRange,
  type CodeEdge,
  type CodeNode,
  type WorkspaceIndex,
} from './core/contracts.js';
import { buildBoundedSubgraph } from './core/graph.js';
import { searchIndex } from './core/search.js';
import { buildTrail } from './core/trail.js';

function generatedIndex(size: number): WorkspaceIndex {
  const nodes: CodeNode[] = Array.from({ length: size }, (_, indexValue) => {
    const name = `target_${indexValue}`;
    return {
      id: createNodeId('c', `generated/file-${indexValue}.c`, 'function', name),
      language: 'c',
      kind: 'function',
      name,
      qualifiedName: name,
      path: `generated/file-${indexValue}.c`,
      range: createRange(1, 1, 1, 10),
      signature: `void ${name}(void)`,
      summary: '',
      tokens: ['target', String(indexValue)],
    };
  });
  const edges: CodeEdge[] = nodes.slice(0, -1).map((source, indexValue) => {
    const target = nodes[indexValue + 1]!;
    const range = createRange(1, 1, 1, 10);
    return {
      id: createEdgeId(source.id, 'calls', target.id, range),
      sourceId: source.id,
      targetId: target.id,
      kind: 'calls',
      confidence: 'confirmed',
      reason: `${source.name} calls ${target.name}`,
      path: source.path,
      range,
    };
  });
  return {
    version: 1,
    rootPath: '/generated',
    createdAtIso: '2026-07-14T00:00:00.000Z',
    nodes,
    edges,
    warnings: [],
    filesIndexed: size,
    isPartial: false,
  };
}

describe('interactive performance budgets', () => {
  it('should search and build a bounded trail under 200 ms on a 2000-node index', () => {
    const index = generatedIndex(2_000);
    const startedAt = performance.now();
    const result = searchIndex(index, 'target 1000', 5);
    const seedId = result.candidates[0]!.nodeId;
    const subgraph = buildBoundedSubgraph(index, [seedId], {
      nodesMax: 40,
      edgesMax: 80,
      depthMax: 4,
      timeMsMax: 100,
    });
    const trail = buildTrail(index, subgraph, seedId);
    const elapsedMs = performance.now() - startedAt;

    expect(elapsedMs).toBeLessThan(200);
    expect(subgraph.nodes.length).toBeLessThanOrEqual(40);
    expect(subgraph.edges.length).toBeLessThanOrEqual(80);
    expect(trail.steps.length).toBeLessThanOrEqual(12);
  });
});
