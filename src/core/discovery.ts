import type {
  CodeDiscovery,
  CodeEdge,
  CodeEdgeKind,
  Confidence,
  FileLink,
  FileSection,
  Trail,
  WorkspaceIndex,
} from './contracts.js';
import type { SubgraphResult } from './graph.js';
import { buildTrail } from './trail.js';

const edgePriority: Readonly<Record<CodeEdgeKind, number>> = {
  calls: 0,
  'dispatches-to': 1,
  registers: 2,
  writes: 3,
  reads: 4,
  contains: 5,
  documents: 6,
  'guarded-by': 7,
};
const confidencePriority: Readonly<Record<Confidence, number>> = {
  confirmed: 0,
  inferred: 1,
  possible: 2,
};

function sortedEdges(edges: readonly CodeEdge[]): readonly CodeEdge[] {
  return [...edges].sort(
    (left, right) => edgePriority[left.kind] - edgePriority[right.kind] || left.id.localeCompare(right.id),
  );
}

function projectFileLinks(index: WorkspaceIndex, edges: readonly CodeEdge[]): readonly FileLink[] {
  const nodesById = new Map(index.nodes.map((node) => [node.id, node]));
  const grouped = new Map<string, CodeEdge[]>();
  for (const edge of edges) {
    const source = nodesById.get(edge.sourceId);
    const target = nodesById.get(edge.targetId);
    if (!source || !target || source.path === target.path) {
      continue;
    }
    const key = `${source.path}\u0000${target.path}`;
    const group = grouped.get(key) ?? [];
    group.push(edge);
    grouped.set(key, group);
  }
  return [...grouped.entries()]
    .map(([key, group]): FileLink => {
      const [sourcePath = '', targetPath = ''] = key.split('\u0000');
      const ordered = sortedEdges(group);
      const confidence = ordered.reduce<Confidence>(
        (leastCertain, edge) =>
          confidencePriority[edge.confidence] > confidencePriority[leastCertain] ? edge.confidence : leastCertain,
        'confirmed',
      );
      return {
        sourcePath,
        targetPath,
        kinds: [...new Set(ordered.map((edge) => edge.kind))],
        confidence,
        reason: ordered[0]?.reason ?? '',
        evidenceCount: ordered.length,
      };
    })
    .sort(
      (left, right) =>
        left.sourcePath.localeCompare(right.sourcePath) || left.targetPath.localeCompare(right.targetPath),
    );
}

function groupFileSections(
  index: WorkspaceIndex,
  trail: Trail,
  edges: readonly CodeEdge[],
  fileLinks: readonly FileLink[],
): readonly FileSection[] {
  const nodesById = new Map(index.nodes.map((node) => [node.id, node]));
  const pathOrder: string[] = [];
  for (const link of fileLinks) {
    for (const path of [link.sourcePath, link.targetPath]) {
      if (!pathOrder.includes(path)) {
        pathOrder.push(path);
      }
    }
  }
  for (const step of trail.steps) {
    const path = nodesById.get(step.nodeId)?.path;
    if (path && !pathOrder.includes(path)) {
      pathOrder.push(path);
    }
  }
  return pathOrder.map((path) => ({
    path,
    steps: trail.steps.filter((step) => nodesById.get(step.nodeId)?.path === path),
    relatedEdgeIds: sortedEdges(
      edges.filter((edge) => nodesById.get(edge.sourceId)?.path === path || nodesById.get(edge.targetId)?.path === path),
    ).map((edge) => edge.id),
  }));
}

export function buildDiscovery(
  index: WorkspaceIndex,
  subgraph: SubgraphResult,
  seedId: string,
): CodeDiscovery {
  const trail = buildTrail(index, subgraph, seedId);
  if (trail.steps.length === 0) {
    return { trail, fileLinks: [], fileSections: [] };
  }
  const fileLinks = projectFileLinks(index, subgraph.edges);
  return {
    trail,
    fileLinks,
    fileSections: groupFileSections(index, trail, subgraph.edges, fileLinks),
  };
}
