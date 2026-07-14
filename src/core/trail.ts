import type { CodeEdge, Trail, TrailStep, WorkspaceIndex } from './contracts.js';
import type { SubgraphResult } from './graph.js';

const stepMax = 12;
const edgePriority: Readonly<Record<CodeEdge['kind'], number>> = {
  calls: 0,
  'dispatches-to': 1,
  registers: 2,
  writes: 3,
  reads: 4,
  documents: 5,
  'guarded-by': 6,
  contains: 7,
};

export function buildTrail(index: WorkspaceIndex, subgraph: SubgraphResult, seedId: string): Trail {
  const nodesById = new Map(index.nodes.map((node) => [node.id, node]));
  const seed = nodesById.get(seedId);
  if (!seed) {
    return {
      seedId,
      title: 'Trail unavailable',
      steps: [],
      warnings: ['The selected seed is no longer present in the current index.'],
      disclaimer: 'Static reading order; not a runtime trace.',
    };
  }

  const subgraphNodeIds = new Set(subgraph.nodes.map((node) => node.id));
  const selected = new Set<string>([seed.id]);
  const steps: TrailStep[] = [{ order: 1, nodeId: seed.id, incomingEdgeId: '', reason: 'Selected entry point.' }];

  while (steps.length < stepMax && selected.size < subgraphNodeIds.size) {
    const sourceOrder = new Map(steps.map((step, indexValue) => [step.nodeId, indexValue]));
    const candidates = subgraph.edges
      .filter((edge) => selected.has(edge.sourceId) && !selected.has(edge.targetId))
      .sort((left, right) => {
        const leftOrder = sourceOrder.get(left.sourceId) ?? stepMax;
        const rightOrder = sourceOrder.get(right.sourceId) ?? stepMax;
        return (
          rightOrder - leftOrder ||
          edgePriority[left.kind] - edgePriority[right.kind] ||
          left.id.localeCompare(right.id)
        );
      });
    const next = candidates[0];
    if (!next) {
      break;
    }
    selected.add(next.targetId);
    steps.push({
      order: steps.length + 1,
      nodeId: next.targetId,
      incomingEdgeId: next.id,
      reason: next.reason,
    });
  }

  const warnings: string[] = [];
  if (subgraph.isTruncated) {
    warnings.push(subgraph.reason);
  }
  if (selected.size < subgraphNodeIds.size && steps.length >= stepMax) {
    warnings.push(`Trail stopped at the ${stepMax}-step readability limit.`);
  }
  return {
    seedId: seed.id,
    title: `Trail from ${seed.name}`,
    steps,
    warnings,
    disclaimer: 'Static reading order; not a runtime trace.',
  };
}
