import { z } from 'zod';

export type TrailStepView = Readonly<{
  order: number;
  nodeId: string;
  name: string;
  nodeKind: string;
  path: string;
  lineStart: number;
  lineEnd: number;
  confidence: 'confirmed' | 'inferred' | 'possible';
  edgeKind: string;
  reason: string;
  signature: string;
}>;

export type TrailView = Readonly<{
  title: string;
  steps: readonly TrailStepView[];
  fileLinks: readonly FileLinkView[];
  fileSections: readonly FileSectionView[];
  warnings: readonly string[];
  disclaimer: 'Static reading order; not a runtime trace.';
}>;

export type FileLinkView = Readonly<{
  sourcePath: string;
  targetPath: string;
  relationship: string;
  confidence: 'confirmed' | 'inferred' | 'possible';
  reason: string;
  evidenceCount: number;
}>;

export type FileSectionView = Readonly<{
  path: string;
  steps: readonly TrailStepView[];
}>;

export type CandidateView = Readonly<{
  nodeId: string;
  name: string;
  kind: string;
  path: string;
  lineStart: number;
  score: number;
  reasons: readonly string[];
}>;

export type WebviewState =
  | Readonly<{ kind: 'welcome' }>
  | Readonly<{ kind: 'indexing'; message: string; percent: number }>
  | Readonly<{ kind: 'ready'; filesIndexed: number; warningCount: number; clangStatus: 'available' | 'unavailable' }>
  | Readonly<{ kind: 'candidates'; query: string; candidates: readonly CandidateView[] }>
  | Readonly<{ kind: 'trail'; trail: TrailView }>
  | Readonly<{ kind: 'partial'; message: string; filesIndexed: number }>
  | Readonly<{ kind: 'error'; message: string }>;

export const hostMessageSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('ask'), query: z.string().trim().min(1).max(500) }),
  z.object({ kind: z.literal('select-candidate'), nodeId: z.string().min(1) }),
  z.object({
    kind: z.literal('open-source'),
    path: z.string().min(1),
    lineStart: z.number().int().positive(),
    lineEnd: z.number().int().positive(),
  }),
  z.object({ kind: z.literal('reindex') }),
]);

export type HostMessage = z.infer<typeof hostMessageSchema>;

export type ExtensionMessage = Readonly<{ kind: 'state'; state: WebviewState }>;
