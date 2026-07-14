import {
  createEdgeId,
  type CodeEdge,
  type CodeEdgeKind,
  type CodeNode,
  type Confidence,
  type FileAnalysis,
  type SourceRange,
  type UnresolvedReference,
} from '../core/contracts.js';

type EdgeInput = Readonly<{
  source: CodeNode;
  target: CodeNode;
  kind: CodeEdgeKind;
  confidence: Confidence;
  reason: string;
  path: string;
  range: SourceRange;
}>;

function createEdge(input: EdgeInput): CodeEdge {
  return {
    id: createEdgeId(input.source.id, input.kind, input.target.id, input.range),
    sourceId: input.source.id,
    targetId: input.target.id,
    kind: input.kind,
    confidence: input.confidence,
    reason: input.reason,
    path: input.path,
    range: input.range,
  };
}

function nodesNamed(nodes: readonly CodeNode[], kind: CodeNode['kind'], name: string): readonly CodeNode[] {
  return nodes.filter((node) => node.kind === kind && node.name === name);
}

function registrationEdges(
  nodes: readonly CodeNode[],
  references: readonly UnresolvedReference[],
): readonly CodeEdge[] {
  const edges: CodeEdge[] = [];
  for (const reference of references) {
    if (reference.kind !== 'registers') {
      continue;
    }
    const fields = nodesNamed(nodes, 'field', reference.sourceName);
    const targets = nodesNamed(nodes, 'function', reference.targetName);
    for (const field of fields) {
      for (const target of targets) {
        edges.push(
          createEdge({
            source: field,
            target,
            kind: 'registers',
            confidence: 'inferred',
            reason: `Designated initializer .${reference.sourceName} registers ${reference.targetName}.`,
            path: reference.path,
            range: reference.range,
          }),
        );
      }
    }
  }
  return edges;
}

function callAndDispatchEdges(
  nodes: readonly CodeNode[],
  references: readonly UnresolvedReference[],
): readonly CodeEdge[] {
  const edges: CodeEdge[] = [];
  const registrations = references.filter((reference) => reference.kind === 'registers');

  for (const reference of references) {
    if (reference.kind !== 'calls') {
      continue;
    }
    const sources = nodesNamed(nodes, 'function', reference.sourceName);
    const directTargets = nodesNamed(nodes, 'function', reference.targetName);
    for (const source of sources) {
      for (const target of directTargets) {
        edges.push(
          createEdge({
            source,
            target,
            kind: 'calls',
            confidence: 'confirmed',
            reason: `${reference.sourceName} directly calls ${reference.targetName}.`,
            path: reference.path,
            range: reference.range,
          }),
        );
      }

      const field = nodesNamed(nodes, 'field', reference.targetName)[0];
      if (!field) {
        continue;
      }
      const matchingRegistrations = registrations.filter(
        (registration) => registration.sourceName === reference.targetName,
      );
      for (const registration of matchingRegistrations) {
        for (const target of nodesNamed(nodes, 'function', registration.targetName)) {
          edges.push(
            createEdge({
              source,
              target,
              kind: 'dispatches-to',
              confidence: 'inferred',
              reason: `sched_class field .${field.name} dispatch may select ${target.name}.`,
              path: reference.path,
              range: reference.range,
            }),
          );
        }
      }
    }
  }
  return edges;
}

function guardEdges(
  nodes: readonly CodeNode[],
  references: readonly UnresolvedReference[],
): readonly CodeEdge[] {
  const edges: CodeEdge[] = [];
  for (const reference of references) {
    if (reference.guard.length === 0) {
      continue;
    }
    const sources = nodesNamed(nodes, 'function', reference.sourceName);
    const guards = nodesNamed(nodes, 'macro', reference.guard);
    for (const source of sources) {
      for (const guard of guards) {
        edges.push(
          createEdge({
            source,
            target: guard,
            kind: 'guarded-by',
            confidence: 'confirmed',
            reason: `${source.name} is inside the ${reference.guard} preprocessor guard.`,
            path: reference.path,
            range: reference.range,
          }),
        );
      }
    }
  }
  return edges;
}

export function enrichKernelRelationships(analyses: readonly FileAnalysis[]): readonly CodeEdge[] {
  const nodes = analyses.flatMap((analysis) => analysis.nodes);
  const references = analyses.flatMap((analysis) => analysis.unresolvedReferences);
  const candidates = [
    ...registrationEdges(nodes, references),
    ...callAndDispatchEdges(nodes, references),
    ...guardEdges(nodes, references),
  ];
  const unique = new Map<string, CodeEdge>();
  for (const edge of candidates) {
    unique.set(edge.id, edge);
  }
  return [...unique.values()].sort((left, right) => left.id.localeCompare(right.id));
}
