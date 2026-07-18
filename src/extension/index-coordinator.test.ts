import { describe, expect, it, vi } from 'vitest';
import type { CodeDiscovery, WorkspaceIndex } from '../core/contracts.js';
import { IndexCoordinator, type WorkerLike } from './index-coordinator.js';
import type { WorkerRequest, WorkerResponse } from '../worker/protocol.js';

class FakeWorker implements WorkerLike {
  readonly sent: WorkerRequest[] = [];
  terminationCount = 0;
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
    this.terminationCount += 1;
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
const discovery: CodeDiscovery = {
  trail: {
    seedId: 'node-1',
    title: 'Trail from node-1',
    steps: [{ order: 1, nodeId: 'node-1', incomingEdgeId: '', reason: 'Selected entry point.' }],
    warnings: [],
    disclaimer: 'Static reading order; not a runtime trace.',
  },
  fileLinks: [],
  fileSections: [{ path: 'fair.c', steps: [], relatedEdgeIds: [] }],
};

describe('index coordinator', () => {
  it('should restore a validated cached index without starting a worker request', () => {
    const worker = new FakeWorker();
    const coordinator = new IndexCoordinator(() => worker);

    coordinator.restoreIndex(index('/cached'));

    expect(coordinator.getCurrentIndex().rootPath).toBe('/cached');
    expect(worker.sent).toStrictEqual([]);
  });

  it('should prevent an older generation from replacing the latest index', async () => {
    const worker = new FakeWorker();
    const coordinator = new IndexCoordinator(() => worker);
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

  it('should forward indexing progress to the active request', async () => {
    const worker = new FakeWorker();
    const coordinator = new IndexCoordinator(() => worker);
    const progress: Array<{ percent: number; message: string }> = [];
    const indexing = coordinator.startIndex(input, (value) => progress.push(value));
    const request = worker.sent[0]!;

    worker.emit({
      kind: 'progress',
      requestId: request.requestId,
      percent: 50,
      message: 'Indexing fair.c...',
    });
    worker.emit({ kind: 'indexed', requestId: request.requestId, generation: 1, index: index('/workspace') });
    await indexing;

    expect(progress).toStrictEqual([{ percent: 50, message: 'Indexing fair.c...' }]);
  });

  it('should replace a timed-out worker so later requests can succeed', async () => {
    vi.useFakeTimers();
    try {
      const firstWorker = new FakeWorker();
      const replacementWorker = new FakeWorker();
      const workers = [firstWorker, replacementWorker];
      let workerIndex = 0;
      const coordinator = new IndexCoordinator(() => workers[workerIndex++]!);
      const searching = coordinator.search('schedule', 5);
      const request = firstWorker.sent[0]!;

      const rejection = expect(searching).rejects.toThrow(`Worker request ${request.requestId} timed out.`);
      await vi.advanceTimersByTimeAsync(10_000);
      await rejection;

      expect(firstWorker.terminationCount).toBe(1);
      const indexing = coordinator.startIndex(input);
      const indexRequest = replacementWorker.sent[0]!;
      expect(indexRequest.kind).toBe('index');
      replacementWorker.emit({
        kind: 'indexed',
        requestId: indexRequest.requestId,
        generation: 1,
        index: index('/replacement'),
      });

      await expect(indexing).resolves.toEqual(expect.objectContaining({ rootPath: '/replacement' }));
      await coordinator.dispose();
    } finally {
      vi.useRealTimers();
    }
  });

  it('should correlate search and discovery responses to their requests', async () => {
    const worker = new FakeWorker();
    const coordinator = new IndexCoordinator(() => worker);
    const indexing = coordinator.startIndex(input);
    const indexRequest = worker.sent[0]!;
    worker.emit({ kind: 'indexed', requestId: indexRequest.requestId, generation: 1, index: index('/workspace') });
    await indexing;

    const searching = coordinator.search('fair scheduler', 5);
    const searchRequest = worker.sent[1]!;
    worker.emit({
      kind: 'search-result',
      requestId: searchRequest.requestId,
      result: { normalizedQuery: 'fair scheduler', candidates: [{ nodeId: 'node-1', score: 42, reasons: ['symbol'] }] },
    });
    const discovering = coordinator.discover('node-1', { nodesMax: 40, edgesMax: 80, depthMax: 4, timeMsMax: 100 });
    const discoveryRequest = worker.sent[2]!;
    worker.emit({
      kind: 'discovery-result',
      requestId: discoveryRequest.requestId,
      discovery,
    });

    await expect(searching).resolves.toEqual(expect.objectContaining({ normalizedQuery: 'fair scheduler' }));
    await expect(discovering).resolves.toStrictEqual(discovery);
  });
});
