export type SourceRange = Readonly<{
  lineStart: number;
  columnStart: number;
  lineEnd: number;
  columnEnd: number;
}>;

export type CodeNodeKind =
  | 'file'
  | 'function'
  | 'struct'
  | 'field'
  | 'macro'
  | 'variable'
  | 'documentation';

export type CodeEdgeKind =
  | 'calls'
  | 'dispatches-to'
  | 'registers'
  | 'reads'
  | 'writes'
  | 'contains'
  | 'documents'
  | 'guarded-by';

export type Confidence = 'confirmed' | 'inferred' | 'possible';

export type CodeNode = Readonly<{
  id: string;
  language: 'c';
  kind: CodeNodeKind;
  name: string;
  qualifiedName: string;
  path: string;
  range: SourceRange;
  signature: string;
  summary: string;
  tokens: readonly string[];
}>;

export type CodeEdge = Readonly<{
  id: string;
  sourceId: string;
  targetId: string;
  kind: CodeEdgeKind;
  confidence: Confidence;
  reason: string;
  path: string;
  range: SourceRange;
}>;

export type AnalysisWarning = Readonly<{
  code: string;
  message: string;
  path: string;
}>;

export type UnresolvedReference = Readonly<{
  sourceName: string;
  targetName: string;
  kind: CodeEdgeKind;
  path: string;
  range: SourceRange;
  guard: string;
  evidence: string;
}>;

export type FileAnalysis = Readonly<{
  path: string;
  nodes: readonly CodeNode[];
  unresolvedReferences: readonly UnresolvedReference[];
  warnings: readonly AnalysisWarning[];
}>;

export type FileCacheEntry = Readonly<{
  path: string;
  size: number;
  mtimeMs: number;
  nodes: readonly CodeNode[];
  unresolvedReferences: readonly UnresolvedReference[];
  warnings: readonly AnalysisWarning[];
}>;

export type WorkspaceIndex = Readonly<{
  version: 1;
  rootPath: string;
  createdAtIso: string;
  nodes: readonly CodeNode[];
  edges: readonly CodeEdge[];
  warnings: readonly AnalysisWarning[];
  filesIndexed: number;
  isPartial: boolean;
  kernelEnrichment?: boolean;
  fileCache?: readonly FileCacheEntry[];
}>;

export type SearchCandidate = Readonly<{
  nodeId: string;
  score: number;
  reasons: readonly string[];
}>;

export type SearchResult = Readonly<{
  normalizedQuery: string;
  candidates: readonly SearchCandidate[];
}>;

export type TrailStep = Readonly<{
  order: number;
  nodeId: string;
  incomingEdgeId: string;
  reason: string;
}>;

export type Trail = Readonly<{
  seedId: string;
  title: string;
  steps: readonly TrailStep[];
  warnings: readonly string[];
  disclaimer: 'Static reading order; not a runtime trace.';
}>;

export type FileLink = Readonly<{
  sourcePath: string;
  targetPath: string;
  kinds: readonly CodeEdgeKind[];
  confidence: Confidence;
  reason: string;
  evidenceCount: number;
}>;

export type FileSection = Readonly<{
  path: string;
  steps: readonly TrailStep[];
  relatedEdgeIds: readonly string[];
}>;

export type CodeDiscovery = Readonly<{
  trail: Trail;
  fileLinks: readonly FileLink[];
  fileSections: readonly FileSection[];
}>;

export function normalizeWorkspacePath(path: string): string {
  return path.replaceAll('\\', '/');
}

export function createNodeId(
  language: 'c',
  path: string,
  kind: CodeNodeKind,
  name: string,
): string {
  return `${language}:${normalizeWorkspacePath(path)}:${kind}:${name}`;
}

export function createEdgeId(
  sourceId: string,
  kind: CodeEdgeKind,
  targetId: string,
  range: SourceRange,
): string {
  return `${sourceId}:${kind}:${targetId}:${range.lineStart}:${range.columnStart}`;
}

export function createRange(
  lineStart: number,
  columnStart: number,
  lineEnd: number,
  columnEnd: number,
): SourceRange {
  if (lineStart < 1 || columnStart < 1 || lineEnd < 1 || columnEnd < 1) {
    throw new Error('Source range positions must be one-based positive integers');
  }

  if (lineEnd < lineStart || (lineEnd === lineStart && columnEnd < columnStart)) {
    throw new Error('Source range end must not precede start');
  }

  return { lineStart, columnStart, lineEnd, columnEnd };
}
