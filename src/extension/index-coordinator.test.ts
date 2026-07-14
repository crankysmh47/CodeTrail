import { describe, expect, it } from 'vitest';
import type { WorkspaceIndex } from '../core/contracts.js';
import { IndexCoordinator, type WorkerLike } from './index-coordinator.js';
import type { WorkerRequest, WorkerResponse } from '../worker/protocol.js';

class FakeWorker implements WorkerLike {
  readonly sent: WorkerRequest[] = [];
  private messageListener: (value: unknown) => void = () => {};
  private errorListener: (error: Error) => void = () => {};

  postMessage(value: WorkerRequest): void {
    this.sent.push(value);
  }

  on(event: 'message' | 'error', listener: ((value: unknown) => void) | ((error: Error) => void)): this {
    if (event === 'message') {
      this.messageListener = listener as (value: unknown) => void;
    } else {
      this.errorListener = listener as (error: Error) => void;
    }
    return this;
  }

  async terminate(): Promise<number> {
    return 0;
  }

  emit(response: WorkerResponse): void {
    this.messageListener(response);
  }

  emitError(error: Error): void {
    this.errorListener(error);
  }
}

function index(rootPath: string): WorkspaceIndex {
  return {
    version: 1,
    rootPath,
    createdAtIso: '2026-07-14T00:00:00.000Z',
    nodes: [],
    edges: [],
    warnings: [],
    filesIndexed: 0,
    isPartial: false,
  };
}

const input = {
  rootPath: '/workspace',
  parserWasmPath: '/tree-sitter.wasm',
  languageWasmPath: '/tree-sitter-c.wasm',
  limits: { filesMax: 2000, fileBytesMax: 2_097_152, totalBytesMax: 262_144_000 },
};

describe('index coordinator', () => {
  it('should prevent an older generation from replacing the latest index', async () => {
    const worker = new FakeWorker();
    const coordinator = new IndexCoordinator(worker);
    const first = coordinator.startIndex({ ...input, rootPath: '/first' });
    const second = coordinator.startIndex({ ...input, rootPath: '/second' });
    const firstRequest = worker.sent[0]!;
    const secondRequest = worker.sent[1]!;

    worker.emit({
      kind: 'indexed',
      requestId: secondRequest.requestId,
      generation: 2,
      index: index('/second'),
    });
    worker.emit({
      kind: 'indexed',
      requestId: firstRequest.requestId,
      generation: 1,
      index: index('/first'),
    });
    await Promise.all([first, second]);

    expect(coordinator.getCurrentIndex().rootPath).toBe('/second');
  });
});
