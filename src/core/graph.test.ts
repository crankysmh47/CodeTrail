import { describe, expect, it } from 'vitest';
import {
  createEdgeId,
  createNodeId,
  createRange,
  type CodeEdge,
  type CodeNode,
  type WorkspaceIndex,
} from './contracts.js';
import { buildBoundedSubgraph } from './graph.js';

function node(name: string, line: number): CodeNode {
  const range = createRange(line, 1, line, 5);
  return {
    id: createNodeId('c', 'cycle.c', 'function', name),
    language: 'c',
    kind: 'function',
    name,
    qualifiedName: name,
    path: 'cycle.c',
    range,
    signature: `void ${name}(void)`,
    summary: '',
    tokens: [name],
  };
}

function edge(source: CodeNode, target: CodeNode, line: number): CodeEdge {
  const range = createRange(line, 1, line, 5);
  return {
    id: createEdgeId(source.id, 'calls', target.id, range),
    sourceId: source.id,
    targetId: target.id,
    kind: 'calls',
    confidence: 'confirmed',
    reason: `${source.name} calls ${target.name}`,
    path: 'cycle.c',
    range,
  };
}

const nodes = ['a', 'b', 'c', 'd', 'e', 'f'].map((name, index) => node(name, index + 1));
const edges = nodes.map((source, index) => edge(source, nodes[(index + 1) % nodes.length]!, index + 1));
const cyclicIndex: WorkspaceIndex = {
  version: 1,
  rootPath: '/fixture',
  createdAtIso: '2026-07-14T00:00:00.000Z',
  nodes,
  edges,
  warnings: [],
  filesIndexed: 1,
  isPartial: false,
};

describe('bounded graph traversal', () => {
  it('should stop cyclic traversal at configured budgets and report truncation', () => {
    const result = buildBoundedSubgraph(cyclicIndex, [nodes[0]!.id], {
      nodesMax: 4,
      edgesMax: 5,
      depthMax: 5,
      timeMsMax: 100,
    });

    expect(result.nodes).toHaveLength(4);
    expect(result.edges.length).toBeLessThanOrEqual(5);
    expect(result.isTruncated).toBe(true);
  });

  it('should reject budgets above hard safety maxima', () => {
    expect(() =>
      buildBoundedSubgraph(cyclicIndex, [nodes[0]!.id], {
        nodesMax: 600,
        edgesMax: 1000,
        depthMax: 8,
        timeMsMax: 100,
      }),
    ).toThrowError('nodesMax must be between 1 and 500');
  });
});
