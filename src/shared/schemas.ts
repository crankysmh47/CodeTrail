import { z } from 'zod';

export const sourceRangeSchema = z.object({
  lineStart: z.number().int().positive(),
  columnStart: z.number().int().positive(),
  lineEnd: z.number().int().positive(),
  columnEnd: z.number().int().positive(),
});

export const codeNodeSchema = z.object({
  id: z.string(),
  language: z.literal('c'),
  kind: z.enum(['file', 'function', 'struct', 'field', 'macro', 'variable', 'documentation']),
  name: z.string(),
  qualifiedName: z.string(),
  path: z.string(),
  range: sourceRangeSchema,
  signature: z.string(),
  summary: z.string(),
  tokens: z.array(z.string()),
});

export const codeEdgeKindSchema = z.enum(['calls', 'dispatches-to', 'registers', 'reads', 'writes', 'contains', 'documents', 'guarded-by']);
export const confidenceSchema = z.enum(['confirmed', 'inferred', 'possible']);

export const codeEdgeSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  targetId: z.string(),
  kind: codeEdgeKindSchema,
  confidence: confidenceSchema,
  reason: z.string(),
  path: z.string(),
  range: sourceRangeSchema,
});

export const warningSchema = z.object({ code: z.string(), message: z.string(), path: z.string() });

export const unresolvedReferenceSchema = z.object({
  sourceName: z.string(),
  targetName: z.string(),
  kind: codeEdgeKindSchema,
  path: z.string(),
  range: sourceRangeSchema,
  guard: z.string(),
  evidence: z.string(),
});

export const fileCacheEntrySchema = z.object({
  path: z.string(),
  size: z.number().int().nonnegative(),
  mtimeMs: z.number(),
  nodes: z.array(codeNodeSchema),
  unresolvedReferences: z.array(unresolvedReferenceSchema),
  warnings: z.array(warningSchema),
});

export const workspaceIndexSchema = z.object({
  version: z.literal(1),
  rootPath: z.string(),
  createdAtIso: z.string(),
  nodes: z.array(codeNodeSchema),
  edges: z.array(codeEdgeSchema),
  warnings: z.array(warningSchema),
  filesIndexed: z.number().int().nonnegative(),
  isPartial: z.boolean(),
  kernelEnrichment: z.boolean().optional(),
  fileCache: z.array(fileCacheEntrySchema).optional(),
});

export const searchResultSchema = z.object({
  normalizedQuery: z.string(),
  candidates: z.array(
    z.object({ nodeId: z.string(), score: z.number(), reasons: z.array(z.string()) }),
  ),
});

export const trailSchema = z.object({
  seedId: z.string(),
  title: z.string(),
  steps: z.array(
    z.object({ order: z.number().int().positive(), nodeId: z.string(), incomingEdgeId: z.string(), reason: z.string() }),
  ),
  warnings: z.array(z.string()),
  disclaimer: z.literal('Static reading order; not a runtime trace.'),
});

export const codeDiscoverySchema = z.object({
  trail: trailSchema,
  fileLinks: z.array(
    z.object({
      sourcePath: z.string(),
      targetPath: z.string(),
      kinds: z.array(codeEdgeKindSchema),
      confidence: confidenceSchema,
      reason: z.string(),
      evidenceCount: z.number().int().positive(),
    }),
  ),
  fileSections: z.array(
    z.object({
      path: z.string(),
      steps: trailSchema.shape.steps,
      relatedEdgeIds: z.array(z.string()),
    }),
  ),
});
