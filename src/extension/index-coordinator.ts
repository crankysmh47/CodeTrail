import type { WorkspaceIndex } from '../core/contracts.js';
import {
  workerResponseSchema,
  type IndexRequest,
  type WorkerRequest,
  type WorkerResponse,
} from '../worker/protocol.js';

export type WorkerLike = {
  postMessage(value: WorkerRequest): void;
  on(event: 'message', listener: (value: unknown) => void): WorkerLike;
  on(event: 'error', listener: (error: Error) => void): WorkerLike;
  terminate(): Promise<number>;
};

export type StartIndexInput = Omit<IndexRequest, 'kind' | 'requestId' | 'generation'>;

type PendingIndex = Readonly<{
  generation: number;
  resolve: (index: WorkspaceIndex) => void;
  reject: (error: Error) => void;
}>;

export class IndexCoordinator {
  private readonly pending = new Map<string, PendingIndex>();
  private generation = 0;
  private requestSequence = 0;
  private currentIndex: WorkspaceIndex | undefined;

  constructor(private readonly worker: WorkerLike) {
    worker.on('message', (value) => this.handleMessage(value));
    worker.on('error', (error) => this.failAll(error));
  }

  startIndex(input: StartIndexInput): Promise<WorkspaceIndex> {
    this.generation += 1;
    this.requestSequence += 1;
    const requestId = `index-${this.requestSequence}`;
    const request: IndexRequest = { kind: 'index', requestId, generation: this.generation, ...input };
    const promise = new Promise<WorkspaceIndex>((resolvePromise, rejectPromise) => {
      this.pending.set(requestId, {
        generation: this.generation,
        resolve: resolvePromise,
        reject: rejectPromise,
      });
    });
    this.worker.postMessage(request);
    return promise;
  }

  getCurrentIndex(): WorkspaceIndex {
    if (!this.currentIndex) {
      throw new Error('CodeTrail has no completed workspace index.');
    }
    return this.currentIndex;
  }

  async dispose(): Promise<void> {
    this.failAll(new Error('CodeTrail analysis worker was disposed.'));
    await this.worker.terminate();
  }

  private handleMessage(value: unknown): void {
    const parsed = workerResponseSchema.safeParse(value);
    if (!parsed.success) {
      this.failAll(new Error('CodeTrail analysis worker returned an invalid response.'));
      return;
    }
    this.handleResponse(parsed.data);
  }

  private handleResponse(response: WorkerResponse): void {
    if (response.kind !== 'indexed') {
      return;
    }
    const pending = this.pending.get(response.requestId);
    if (!pending) {
      return;
    }
    this.pending.delete(response.requestId);
    if (response.generation === this.generation && pending.generation === this.generation) {
      this.currentIndex = response.index;
    }
    pending.resolve(response.index);
  }

  private failAll(error: Error): void {
    for (const pending of this.pending.values()) {
      pending.reject(error);
    }
    this.pending.clear();
  }
}
