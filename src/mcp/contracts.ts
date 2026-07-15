import { z } from 'zod';
import type {
  CodeDiscovery,
  CodeEdge,
  CodeNode,
  SearchResult,
  SourceRange,
  WorkspaceIndex,
} from '../core/contracts.js';
import { serviceGraphBudget, serviceIndexLimits } from '../service/codetrail-service.js';

const symbolIdLengthMax = 500;
const nameLengthMax = 200;
const pathLengthMax = 500;
const signatureLengthMax = 1_000;
const summaryLengthMax = 1_000;
const reasonLengthMax = 1_000;
const relationshipCountMax = 40;
const warningCountMax = 50;

const analysisKind = 'static-reading-path' as const;
const disclaimer = 'Static reading order; not a runtime trace.' as const;

export const searchCodeInputSchema = z.object({
  query: z.string().trim().min(1).max(200),
  limit: z.number().int().min(1).max(20).default(10),
});

export const symbolInputSchema = z.object({
  symbolId: z.string().trim().min(1).max(symbolIdLengthMax),
});

const sourceRangeSchema = z.object({
  lineStart: z.number().int().positive(),
  columnStart: z.number().int().positive(),
  lineEnd: z.number().int().positive(),
  columnEnd: z.number().int().positive(),
});

const sourceLocationSchema = z.object({
  path: z.string(),
  range: sourceRangeSchema,
});

const symbolSummarySchema = z.object({
  symbolId: z.string(),
  language: z.literal('c'),
  kind: z.enum(['file', 'function', 'struct', 'field', 'macro', 'variable', 'documentation']),
  name: z.string(),
  qualifiedName: z.string(),
  signature: z.string(),
  summary: z.string(),
  source: sourceLocationSchema,
});

const relationshipSchema = z.object({
  relationshipId: z.string(),
  direction: z.enum(['incoming', 'outgoing']),
  kind: z.enum(['calls', 'dispatches-to', 'registers', 'reads', 'writes', 'contains', 'documents', 'guarded-by']),
  confidence: z.enum(['confirmed', 'inferred', 'possible']),
  reason: z.string(),
  counterpart: symbolSummarySchema,
  evidence: sourceLocationSchema,
});

export const searchCodeOutputSchema = z.object({
  query: z.string(),
  normalizedQuery: z.string(),
  returned: z.number().int().nonnegative(),
  available: z.number().int().nonnegative(),
  truncated: z.boolean(),
  candidates: z.array(
    symbolSummarySchema.extend({
      score: z.number(),
      reasons: z.array(z.string()),
    }),
  ),
});

export const getSymbolOutputSchema = z.object({
  analysisKind: z.literal(analysisKind),
  disclaimer: z.literal(disclaimer),
  symbol: symbolSummarySchema,
  relationships: z.array(relationshipSchema),
  relationshipCount: z.number().int().nonnegative(),
  truncated: z.boolean(),
});

const trailStepSchema = z.object({
  order: z.number().int().positive(),
  symbol: symbolSummarySchema,
  reason: z.string(),
  incomingRelationship: relationshipSchema.optional(),
});

export const getReadingPathOutputSchema = z.object({
  analysisKind: z.literal(analysisKind),
  disclaimer: z.literal(disclaimer),
  seed: symbolSummarySchema,
  title: z.string(),
  trail: z.array(trailStepSchema),
  fileRoute: z.array(
    z.object({
      sourcePath: z.string(),
      targetPath: z.string(),
      kinds: z.array(relationshipSchema.shape.kind),
      confidence: relationshipSchema.shape.confidence,
      reason: z.string(),
      evidenceCount: z.number().int().nonnegative(),
      evidence: z.array(sourceLocationSchema),
    }),
  ),
  withinFiles: z.array(
    z.object({
      path: z.string(),
      steps: z.array(trailStepSchema),
      relationships: z.array(relationshipSchema),
    }),
  ),
  warnings: z.array(z.string()),
  truncated: z.boolean(),
});

export const workspaceStatusOutputSchema = z.object({
  workspaceRoot: z.string(),
  createdAtIso: z.string(),
  language: z.literal('c'),
  analysisMode: z.literal('structural'),
  filesIndexed: z.number().int().nonnegative(),
  nodesIndexed: z.number().int().nonnegative(),
  relationshipsIndexed: z.number().int().nonnegative(),
  warningCount: z.number().int().nonnegative(),
  warnings: z.array(z.object({ code: z.string(), message: z.string(), path: z.string() })),
  isPartial: z.boolean(),
  limits: z.object({
    filesMax: z.number().int().positive(),
    fileBytesMax: z.number().int().positive(),
    totalBytesMax: z.number().int().positive(),
    nodesMax: z.number().int().positive(),
    edgesMax: z.number().int().positive(),
    depthMax: z.number().int().positive(),
    timeMsMax: z.number().int().positive(),
  }),
  tools: z.tuple([z.literal('search_code'), z.literal('get_symbol'), z.literal('get_reading_path')]),
  disclaimer: z.literal(disclaimer),
});

export type SearchCodeInput = z.infer<typeof searchCodeInputSchema>;
export type SymbolInput = z.infer<typeof symbolInputSchema>;
export type SearchCodeOutput = z.infer<typeof searchCodeOutputSchema>;
export type GetSymbolOutput = z.infer<typeof getSymbolOutputSchema>;
export type GetReadingPathOutput = z.infer<typeof getReadingPathOutputSchema>;
export type WorkspaceStatusOutput = z.infer<typeof workspaceStatusOutputSchema>;

function boundedText(value: string, lengthMax: number): string {
  if (value.length <= lengthMax) {
    return value;
  }
  return `${value.slice(0, lengthMax - 1)}…`;
}

function projectSource(path: string, range: SourceRange): z.infer<typeof sourceLocationSchema> {
  return { path: boundedText(path, pathLengthMax), range };
}

function projectNode(node: CodeNode): z.infer<typeof symbolSummarySchema> {
  return {
    symbolId: boundedText(node.id, symbolIdLengthMax),
    language: node.language,
    kind: node.kind,
    name: boundedText(node.name, nameLengthMax),
    qualifiedName: boundedText(node.qualifiedName, nameLengthMax),
    signature: boundedText(node.signature, signatureLengthMax),
    summary: boundedText(node.summary, summaryLengthMax),
    source: projectSource(node.path, node.range),
  };
}

function sortedIncidentEdges(index: WorkspaceIndex, symbolId: string): readonly CodeEdge[] {
  return index.edges
    .filter((edge) => edge.sourceId === symbolId || edge.targetId === symbolId)
    .sort(
      (left, right) =>
        left.path.localeCompare(right.path) ||
        left.range.lineStart - right.range.lineStart ||
        left.range.columnStart - right.range.columnStart ||
        left.id.localeCompare(right.id),
    );
}

function projectRelationship(
  edge: CodeEdge,
  focusId: string,
  nodesById: ReadonlyMap<string, CodeNode>,
): z.infer<typeof relationshipSchema> | undefined {
  const counterpartId = edge.sourceId === focusId ? edge.targetId : edge.sourceId;
  const counterpart = nodesById.get(counterpartId);
  if (!counterpart) {
    return undefined;
  }
  return {
    relationshipId: boundedText(edge.id, symbolIdLengthMax),
    direction: edge.sourceId === focusId ? 'outgoing' : 'incoming',
    kind: edge.kind,
    confidence: edge.confidence,
    reason: boundedText(edge.reason, reasonLengthMax),
    counterpart: projectNode(counterpart),
    evidence: projectSource(edge.path, edge.range),
  };
}

function nodesById(index: WorkspaceIndex): ReadonlyMap<string, CodeNode> {
  return new Map(index.nodes.map((node) => [node.id, node]));
}

export function projectSearchCode(
  index: WorkspaceIndex,
  query: string,
  result: SearchResult,
  limit: number,
): SearchCodeOutput {
  const lookup = nodesById(index);
  const candidates = result.candidates.slice(0, limit).flatMap((candidate) => {
    const node = lookup.get(candidate.nodeId);
    if (!node) {
      return [];
    }
    return [
      {
        ...projectNode(node),
        score: candidate.score,
        reasons: candidate.reasons.map((reason) => boundedText(reason, reasonLengthMax)),
      },
    ];
  });
  return {
    query: boundedText(query, 200),
    normalizedQuery: boundedText(result.normalizedQuery, 200),
    returned: candidates.length,
    available: result.candidates.length,
    truncated: result.candidates.length > candidates.length,
    candidates,
  };
}

export function projectSymbol(index: WorkspaceIndex, symbolId: string): GetSymbolOutput {
  const lookup = nodesById(index);
  const symbol = lookup.get(symbolId);
  if (!symbol) {
    throw new Error('CodeTrail symbol was not found. Search the current index before requesting symbol evidence.');
  }
  const incidentEdges = sortedIncidentEdges(index, symbolId);
  const relationships = incidentEdges
    .slice(0, relationshipCountMax)
    .flatMap((edge) => {
      const relationship = projectRelationship(edge, symbolId, lookup);
      return relationship ? [relationship] : [];
    });
  return {
    analysisKind,
    disclaimer,
    symbol: projectNode(symbol),
    relationships,
    relationshipCount: incidentEdges.length,
    truncated: incidentEdges.length > relationships.length,
  };
}

function projectTrailStep(
  index: WorkspaceIndex,
  step: CodeDiscovery['trail']['steps'][number],
  lookup: ReadonlyMap<string, CodeNode>,
): z.infer<typeof trailStepSchema> | undefined {
  const symbol = lookup.get(step.nodeId);
  if (!symbol) {
    return undefined;
  }
  const edge = index.edges.find((candidate) => candidate.id === step.incomingEdgeId);
  const incomingRelationship = edge ? projectRelationship(edge, step.nodeId, lookup) : undefined;
  return {
    order: step.order,
    symbol: projectNode(symbol),
    reason: boundedText(step.reason, reasonLengthMax),
    ...(incomingRelationship ? { incomingRelationship } : {}),
  };
}

export function projectReadingPath(index: WorkspaceIndex, discovery: CodeDiscovery): GetReadingPathOutput {
  const lookup = nodesById(index);
  const seed = lookup.get(discovery.trail.seedId);
  if (!seed) {
    throw new Error('CodeTrail symbol was not found. Search the current index before requesting a reading path.');
  }
  const projectedSteps = discovery.trail.steps.flatMap((step) => {
    const projected = projectTrailStep(index, step, lookup);
    return projected ? [projected] : [];
  });
  const projectedByNodeId = new Map(projectedSteps.map((step) => [step.symbol.symbolId, step]));
  const fileRoute = discovery.fileLinks.map((link) => {
    const matchingEdges = index.edges.filter((edge) => {
      const source = lookup.get(edge.sourceId);
      const target = lookup.get(edge.targetId);
      return source?.path === link.sourcePath && target?.path === link.targetPath && link.kinds.includes(edge.kind);
    });
    return {
      sourcePath: boundedText(link.sourcePath, pathLengthMax),
      targetPath: boundedText(link.targetPath, pathLengthMax),
      kinds: [...link.kinds],
      confidence: link.confidence,
      reason: boundedText(link.reason, reasonLengthMax),
      evidenceCount: link.evidenceCount,
      evidence: matchingEdges.slice(0, relationshipCountMax).map((edge) => projectSource(edge.path, edge.range)),
    };
  });
  const withinFiles = discovery.fileSections.map((section) => ({
    path: boundedText(section.path, pathLengthMax),
    steps: section.steps.flatMap((step) => {
      const projected = projectedByNodeId.get(boundedText(step.nodeId, symbolIdLengthMax));
      return projected ? [projected] : [];
    }),
    relationships: section.relatedEdgeIds.slice(0, relationshipCountMax).flatMap((edgeId) => {
      const edge = index.edges.find((candidate) => candidate.id === edgeId);
      if (!edge) {
        return [];
      }
      const focusId = section.steps[0]?.nodeId ?? edge.sourceId;
      const relationship = projectRelationship(edge, focusId, lookup);
      return relationship ? [relationship] : [];
    }),
  }));
  return {
    analysisKind,
    disclaimer,
    seed: projectNode(seed),
    title: boundedText(discovery.trail.title, nameLengthMax),
    trail: projectedSteps,
    fileRoute,
    withinFiles,
    warnings: discovery.trail.warnings.map((warning) => boundedText(warning, reasonLengthMax)),
    truncated: discovery.trail.warnings.length > 0,
  };
}

export function projectWorkspaceStatus(index: WorkspaceIndex): WorkspaceStatusOutput {
  return {
    workspaceRoot: boundedText(index.rootPath, pathLengthMax),
    createdAtIso: index.createdAtIso,
    language: 'c',
    analysisMode: 'structural',
    filesIndexed: index.filesIndexed,
    nodesIndexed: index.nodes.length,
    relationshipsIndexed: index.edges.length,
    warningCount: index.warnings.length,
    warnings: index.warnings.slice(0, warningCountMax).map((warning) => ({
      code: boundedText(warning.code, nameLengthMax),
      message: boundedText(warning.message, reasonLengthMax),
      path: boundedText(warning.path, pathLengthMax),
    })),
    isPartial: index.isPartial,
    limits: { ...serviceIndexLimits, ...serviceGraphBudget },
    tools: ['search_code', 'get_symbol', 'get_reading_path'],
    disclaimer,
  };
}
