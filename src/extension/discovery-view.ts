import type { CodeDiscovery, CodeEdge, CodeNode, Trail, WorkspaceIndex } from '../core/contracts.js';
import type { FileLinkView, FileSectionView, TrailStepView, TrailView } from '../shared/messages.js';

function toStepView(
  step: Trail['steps'][number],
  nodesById: ReadonlyMap<string, CodeNode>,
  edgesById: ReadonlyMap<string, CodeEdge>,
): TrailStepView | undefined {
  const node = nodesById.get(step.nodeId);
  if (!node) {
    return undefined;
  }
  const edge = edgesById.get(step.incomingEdgeId);
  return {
    order: step.order,
    nodeId: node.id,
    name: node.name,
    nodeKind: node.kind,
    path: node.path,
    lineStart: node.range.lineStart,
    lineEnd: node.range.lineEnd,
    confidence: edge?.confidence ?? 'confirmed',
    edgeKind: edge?.kind ?? 'entry-point',
    reason: step.reason,
    signature: node.signature,
  };
}

export function toTrailView(discovery: CodeDiscovery, index: WorkspaceIndex): TrailView {
  const nodesById = new Map(index.nodes.map((node) => [node.id, node]));
  const edgesById = new Map(index.edges.map((edge) => [edge.id, edge]));
  const stepView = (step: Trail['steps'][number]): TrailStepView | undefined =>
    toStepView(step, nodesById, edgesById);
  const steps = discovery.trail.steps
    .map(stepView)
    .filter((step): step is TrailStepView => step !== undefined);
  const fileLinks: FileLinkView[] = discovery.fileLinks.map((link) => {
    const evidenceEdge = index.edges.find(
      (edge) =>
        nodesById.get(edge.sourceId)?.path === link.sourcePath &&
        nodesById.get(edge.targetId)?.path === link.targetPath &&
        link.kinds.includes(edge.kind)
    );
    return {
      sourcePath: link.sourcePath,
      targetPath: link.targetPath,
      relationship: link.kinds.join(' + '),
      confidence: link.confidence,
      reason: link.reason,
      evidenceCount: link.evidenceCount,
      lineStart: evidenceEdge?.range.lineStart ?? 1,
      lineEnd: evidenceEdge?.range.lineEnd ?? 1,
    };
  });
  const fileSections: FileSectionView[] = discovery.fileSections.map((section) => ({
    path: section.path,
    steps: section.steps.map(stepView).filter((step): step is TrailStepView => step !== undefined),
  }));
  return {
    title: discovery.trail.title,
    steps,
    fileLinks,
    fileSections,
    warnings: discovery.trail.warnings,
    disclaimer: discovery.trail.disclaimer,
  };
}
