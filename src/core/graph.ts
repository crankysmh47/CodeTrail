import { performance } from 'node:perf_hooks';
import type { CodeEdge, CodeNode, WorkspaceIndex } from './contracts.js';

export type GraphBudget = Readonly<{
  nodesMax: number;
  edgesMax: number;
  depthMax: number;
  timeMsMax: number;
}>;

export type SubgraphResult = Readonly<{
  nodes: readonly CodeNode[];
  edges: readonly CodeEdge[];
  isTruncated: boolean;
  reason: string;
}>;

const hardMaxima: GraphBudget = {
  nodesMax: 100,
  edgesMax: 200,
  depthMax: 8,
  timeMsMax: 1_000,
};

const edgePriority: Readonly<Record<CodeEdge['kind'], number>> = {
  calls: 0,
  'dispatches-to': 1,
  registers: 2,
  writes: 3,
  reads: 4,
  contains: 5,
  documents: 6,
  'guarded-by': 7,
};

function validateBudget(name: keyof GraphBudget, value: number): void {
  const maximum = hardMaxima[name];
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 1 || value > maximum) {
    throw new Error(`${name} must be between 1 and ${maximum}`);
  }
}

export function buildBoundedSubgraph(
  index: WorkspaceIndex,
  seedIds: readonly string[],
  budget: GraphBudget,
): SubgraphResult {
  validateBudget('nodesMax', budget.nodesMax);
  validateBudget('edgesMax', budget.edgesMax);
  validateBudget('depthMax', budget.depthMax);
  validateBudget('timeMsMax', budget.timeMsMax);

  const nodesById = new Map(index.nodes.map((node) => [node.id, node]));
  const adjacency = new Map<string, CodeEdge[]>();
  for (const edge of index.edges) {
    const adjacentSrc = adjacency.get(edge.sourceId) ?? [];
    adjacentSrc.push(edge);
    adjacency.set(edge.sourceId, adjacentSrc);
    if (edge.sourceId !== edge.targetId) {
      const adjacentTgt = adjacency.get(edge.targetId) ?? [];
      adjacentTgt.push(edge);
      adjacency.set(edge.targetId, adjacentTgt);
    }
  }
  for (const adjacent of adjacency.values()) {
    adjacent.sort(
      (left, right) => edgePriority[left.kind] - edgePriority[right.kind] || left.id.localeCompare(right.id),
    );
  }

  const selectedNodes = new Map<string, CodeNode>();
  const selectedEdges = new Map<string, CodeEdge>();
  const queue: Array<Readonly<{ nodeId: string; depth: number }>> = [];
  for (const seedId of [...new Set(seedIds)].slice(0, budget.nodesMax)) {
    const seed = nodesById.get(seedId);
    if (seed) {
      selectedNodes.set(seed.id, seed);
      queue.push({ nodeId: seed.id, depth: 0 });
    }
  }

  let cursor = 0;
  let isTruncated = seedIds.length > selectedNodes.size;
  let reason = isTruncated ? 'One or more seeds were unavailable or exceeded the node budget.' : '';
  const startedAt = performance.now();

  while (cursor < queue.length && cursor < hardMaxima.nodesMax) {
    if (performance.now() - startedAt >= budget.timeMsMax) {
      isTruncated = true;
      reason = `Traversal reached the ${budget.timeMsMax} ms time budget.`;
      break;
    }
    const current = queue[cursor];
    cursor += 1;
    if (!current) {
      break;
    }
    for (const edge of adjacency.get(current.nodeId) ?? []) {
      if (selectedEdges.size >= budget.edgesMax) {
        isTruncated = true;
        reason = `Traversal reached the ${budget.edgesMax}-edge budget.`;
        break;
      }
      const neighborId = edge.sourceId === current.nodeId ? edge.targetId : edge.sourceId;
      const neighbor = nodesById.get(neighborId);
      if (!neighbor) {
        continue;
      }
      if (!selectedNodes.has(neighborId)) {
        if (current.depth >= budget.depthMax) {
          isTruncated = true;
          reason = `Traversal reached depth ${budget.depthMax}.`;
          continue;
        }
        if (selectedNodes.size >= budget.nodesMax) {
          isTruncated = true;
          reason = `Traversal reached the ${budget.nodesMax}-node budget.`;
          continue;
        }
        selectedNodes.set(neighborId, neighbor);
        queue.push({ nodeId: neighborId, depth: current.depth + 1 });
      }
      selectedEdges.set(edge.id, edge);
    }
  }

  return {
    nodes: [...selectedNodes.values()],
    edges: [...selectedEdges.values()],
    isTruncated,
    reason,
  };
}
