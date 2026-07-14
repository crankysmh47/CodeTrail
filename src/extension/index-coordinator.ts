import type { SearchResult, Trail, WorkspaceIndex } from '../core/contracts.js';
import type { GraphBudget } from '../core/graph.js';
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

type PendingSearch = Readonly<{ resolve: (result: SearchResult) => void; reject: (error: Error) => void }>;
type PendingTrail = Readonly<{ resolve: (trail: Trail) => void; reject: (error: Error) => void }>;

export class IndexCoordinator {
  private readonly pending = new Map<string, PendingIndex>();
  private readonly pendingSearch = new Map<string, PendingSearch>();
  private readonly pendingTrail = new Map<string, PendingTrail>();
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

  restoreIndex(index: WorkspaceIndex): void {
    this.currentIndex = index;
  }

  search(query: string, limit: number): Promise<SearchResult> {
    this.assertInteractiveCapacity();
    const requestId = this.nextRequestId('search');
    const promise = new Promise<SearchResult>((resolvePromise, rejectPromise) => {
      this.pendingSearch.set(requestId, { resolve: resolvePromise, reject: rejectPromise });
    });
    this.worker.postMessage({ kind: 'search', requestId, query, limit });
    return promise;
  }

  buildTrail(seedId: string, budget: GraphBudget): Promise<Trail> {
    this.assertInteractiveCapacity();
    const requestId = this.nextRequestId('trail');
    const promise = new Promise<Trail>((resolvePromise, rejectPromise) => {
      this.pendingTrail.set(requestId, { resolve: resolvePromise, reject: rejectPromise });
    });
    this.worker.postMessage({ kind: 'trail', requestId, seedId, budget });
    return promise;
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
    if (response.kind === 'search-result') {
      const pending = this.pendingSearch.get(response.requestId);
      if (pending) {
        this.pendingSearch.delete(response.requestId);
        pending.resolve(response.result);
      }
      return;
    }
    if (response.kind === 'trail-result') {
      const pending = this.pendingTrail.get(response.requestId);
      if (pending) {
        this.pendingTrail.delete(response.requestId);
        pending.resolve(response.trail);
      }
      return;
    }
    if (response.kind === 'error') {
      const error = new Error(response.message);
      const indexPending = this.pending.get(response.requestId);
      const searchPending = this.pendingSearch.get(response.requestId);
      const trailPending = this.pendingTrail.get(response.requestId);
      indexPending?.reject(error);
      searchPending?.reject(error);
      trailPending?.reject(error);
      this.pending.delete(response.requestId);
      this.pendingSearch.delete(response.requestId);
      this.pendingTrail.delete(response.requestId);
      return;
    }
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
    for (const pending of this.pendingSearch.values()) {
      pending.reject(error);
    }
    for (const pending of this.pendingTrail.values()) {
      pending.reject(error);
    }
    this.pendingSearch.clear();
    this.pendingTrail.clear();
  }

  private nextRequestId(kind: 'search' | 'trail'): string {
    this.requestSequence += 1;
    return `${kind}-${this.requestSequence}`;
  }

  private assertInteractiveCapacity(): void {
    if (this.pendingSearch.size + this.pendingTrail.size >= 5) {
      throw new Error('CodeTrail already has five pending interactive requests.');
    }
  }
}
