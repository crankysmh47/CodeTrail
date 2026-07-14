import { parentPort } from 'node:worker_threads';
import type { WorkspaceIndex } from '../core/contracts.js';
import { buildBoundedSubgraph } from '../core/graph.js';
import { searchIndex } from '../core/search.js';
import { buildTrail } from '../core/trail.js';
import { indexWorkspace } from '../analysis/indexer.js';
import { createCParser } from '../analysis/parser-runtime.js';
import { IndexGenerationGuard } from './index-generation.js';
import { workerRequestSchema, type WorkerResponse } from './protocol.js';

let currentIndex: WorkspaceIndex | undefined;
const generationGuard = new IndexGenerationGuard();

function post(response: WorkerResponse): void {
  parentPort?.postMessage(response);
}

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function handle(value: unknown): Promise<void> {
  const parsed = workerRequestSchema.safeParse(value);
  if (!parsed.success) {
    post({ kind: 'error', requestId: 'invalid-request', message: 'Analysis request failed schema validation.' });
    return;
  }
  const request = parsed.data;
  try {
    if (request.kind === 'cancel') {
      generationGuard.cancel();
      return;
    }
    if (request.kind === 'index') {
      const operation = generationGuard.begin(request.generation);
      post({ kind: 'progress', requestId: request.requestId, message: 'Indexing C sources', percent: 10 });
      const parser = await createCParser({
        parserWasmPath: request.parserWasmPath,
        languageWasmPath: request.languageWasmPath,
      });
      const index = await indexWorkspace({
        rootPath: request.rootPath,
        parser,
        limits: request.limits,
        signal: operation.signal,
      });
      if (generationGuard.canPublish(operation)) {
        currentIndex = index;
      }
      post({ kind: 'indexed', requestId: request.requestId, generation: request.generation, index });
      return;
    }
    if (!currentIndex) {
      post({ kind: 'error', requestId: request.requestId, message: 'Index the workspace before searching.' });
      return;
    }
    if (request.kind === 'search') {
      post({ kind: 'search-result', requestId: request.requestId, result: searchIndex(currentIndex, request.query, request.limit) });
      return;
    }
    const subgraph = buildBoundedSubgraph(currentIndex, [request.seedId], request.budget);
    post({ kind: 'trail-result', requestId: request.requestId, trail: buildTrail(currentIndex, subgraph, request.seedId) });
  } catch (error) {
    post({ kind: 'error', requestId: request.requestId, message: messageFrom(error) });
  }
}

parentPort?.on('message', (value: unknown) => {
  void handle(value);
});
