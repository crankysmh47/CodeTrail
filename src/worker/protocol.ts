import { z } from 'zod';
import type { SearchResult, Trail, WorkspaceIndex } from '../core/contracts.js';
import { searchResultSchema, trailSchema, workspaceIndexSchema } from '../shared/schemas.js';

const requestIdSchema = z.string().min(1).max(128);
const graphBudgetSchema = z.object({
  nodesMax: z.number().int().min(1).max(100),
  edgesMax: z.number().int().min(1).max(200),
  depthMax: z.number().int().min(1).max(8),
  timeMsMax: z.number().int().min(1).max(1_000),
});

export const workerRequestSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('index'),
    requestId: requestIdSchema,
    generation: z.number().int().positive(),
    rootPath: z.string().min(1),
    parserWasmPath: z.string().min(1),
    languageWasmPath: z.string().min(1),
    limits: z.object({
      filesMax: z.number().int().min(1).max(10_000),
      fileBytesMax: z.number().int().min(1).max(100 * 1024 * 1024),
      totalBytesMax: z.number().int().min(1).max(2_000_000_000),
    }),
  }),
  z.object({ kind: z.literal('search'), requestId: requestIdSchema, query: z.string().min(1).max(500), limit: z.number().int().min(1).max(20) }),
  z.object({ kind: z.literal('trail'), requestId: requestIdSchema, seedId: z.string().min(1), budget: graphBudgetSchema }),
  z.object({ kind: z.literal('cancel'), requestId: requestIdSchema, targetRequestId: requestIdSchema }),
]);

export const workerResponseSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('indexed'), requestId: requestIdSchema, generation: z.number().int().positive(), index: workspaceIndexSchema }),
  z.object({ kind: z.literal('search-result'), requestId: requestIdSchema, result: searchResultSchema }),
  z.object({ kind: z.literal('trail-result'), requestId: requestIdSchema, trail: trailSchema }),
  z.object({ kind: z.literal('progress'), requestId: requestIdSchema, message: z.string(), percent: z.number().min(0).max(100) }),
  z.object({ kind: z.literal('error'), requestId: requestIdSchema, message: z.string() }),
]);

export type WorkerRequest = z.infer<typeof workerRequestSchema>;
export type WorkerResponse =
  | Readonly<{ kind: 'indexed'; requestId: string; generation: number; index: WorkspaceIndex }>
  | Readonly<{ kind: 'search-result'; requestId: string; result: SearchResult }>
  | Readonly<{ kind: 'trail-result'; requestId: string; trail: Trail }>
  | Readonly<{ kind: 'progress'; requestId: string; message: string; percent: number }>
  | Readonly<{ kind: 'error'; requestId: string; message: string }>;
export type IndexRequest = Extract<WorkerRequest, { kind: 'index' }>;
