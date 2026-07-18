import type { CodeDiscovery, SearchResult, WorkspaceIndex } from '../core/contracts.js';
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
  onProgress?: (progress: { percent: number; message: string }) => void;
}>;

type PendingSearch = Readonly<{ resolve: (result: SearchResult) => void; reject: (error: Error) => void }>;
type PendingDiscovery = Readonly<{ resolve: (discovery: CodeDiscovery) => void; reject: (error: Error) => void }>;

export class IndexCoordinator {
  private readonly pending = new Map<string, PendingIndex>();
  private readonly pendingSearch = new Map<string, PendingSearch>();
  private readonly pendingDiscovery = new Map<string, PendingDiscovery>();
  private readonly timers = new Map<string, NodeJS.Timeout>();
  private generation = 0;
  private requestSequence = 0;
  private currentIndex: WorkspaceIndex | undefined;
  private worker!: WorkerLike;

  constructor(private readonly workerFactory: () => WorkerLike) {
    this.spawnWorker();
  }

  private spawnWorker(): void {
    this.worker = this.workerFactory();
    this.worker.on('message', (value) => this.handleMessage(value));
    this.worker.on('error', (error) => this.failAll(error));
  }

  startIndex(
    input: StartIndexInput,
    onProgress?: (progress: { percent: number; message: string }) => void
  ): Promise<WorkspaceIndex> {
    this.generation += 1;
    this.requestSequence += 1;
    const requestId = `index-${this.requestSequence}`;
    const request: IndexRequest = { kind: 'index', requestId, generation: this.generation, ...input };
    const promise = new Promise<WorkspaceIndex>((resolvePromise, rejectPromise) => {
      this.pending.set(requestId, {
        generation: this.generation,
        resolve: resolvePromise,
        reject: rejectPromise,
        ...(onProgress !== undefined ? { onProgress } : {}),
      });
    });
    this.startTimer(requestId, 120_000);
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
    this.startTimer(requestId, 10_000);
    this.worker.postMessage({ kind: 'search', requestId, query, limit });
    return promise;
  }

  discover(seedId: string, budget: GraphBudget): Promise<CodeDiscovery> {
    this.assertInteractiveCapacity();
    const requestId = this.nextRequestId('discover');
    const promise = new Promise<CodeDiscovery>((resolvePromise, rejectPromise) => {
      this.pendingDiscovery.set(requestId, { resolve: resolvePromise, reject: rejectPromise });
    });
    this.startTimer(requestId, 10_000);
    this.worker.postMessage({ kind: 'discover', requestId, seedId, budget });
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
    this.handleResponse(parsed.data as unknown as WorkerResponse);
  }

  private handleResponse(response: WorkerResponse): void {
    if (response.kind === 'progress') {
      const pending = this.pending.get(response.requestId);
      if (pending?.onProgress) {
        pending.onProgress({ percent: response.percent, message: response.message });
      }
      return;
    }
    if (response.kind === 'search-result') {
      this.clearTimer(response.requestId);
      const pending = this.pendingSearch.get(response.requestId);
      if (pending) {
        this.pendingSearch.delete(response.requestId);
        pending.resolve(response.result);
      }
      return;
    }
    if (response.kind === 'discovery-result') {
      this.clearTimer(response.requestId);
      const pending = this.pendingDiscovery.get(response.requestId);
      if (pending) {
        this.pendingDiscovery.delete(response.requestId);
        pending.resolve(response.discovery);
      }
      return;
    }
    if (response.kind === 'error') {
      this.clearTimer(response.requestId);
      const error = new Error(response.message);
      const indexPending = this.pending.get(response.requestId);
      const searchPending = this.pendingSearch.get(response.requestId);
      const discoveryPending = this.pendingDiscovery.get(response.requestId);
      indexPending?.reject(error);
      searchPending?.reject(error);
      discoveryPending?.reject(error);
      this.pending.delete(response.requestId);
      this.pendingSearch.delete(response.requestId);
      this.pendingDiscovery.delete(response.requestId);
      return;
    }
    if (response.kind !== 'indexed') {
      return;
    }
    this.clearTimer(response.requestId);
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

  private clearTimer(requestId: string): void {
    const timer = this.timers.get(requestId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(requestId);
    }
  }

  private startTimer(requestId: string, timeoutMs: number): void {
    this.clearTimer(requestId);
    const timer = setTimeout(() => {
      this.handleTimeout(requestId).catch(console.error);
    }, timeoutMs);
    this.timers.set(requestId, timer);
  }

  private async handleTimeout(requestId: string): Promise<void> {
    this.timers.delete(requestId);
    const error = new Error(`Worker request ${requestId} timed out.`);
    console.warn(`[CodeTrail] ${error.message} Respawning worker...`);
    this.failAll(error);
    await this.worker.terminate();
    this.spawnWorker();
  }

  private failAll(error: Error): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    for (const pending of this.pending.values()) {
      pending.reject(error);
    }
    this.pending.clear();
    for (const pending of this.pendingSearch.values()) {
      pending.reject(error);
    }
    for (const pending of this.pendingDiscovery.values()) {
      pending.reject(error);
    }
    this.pendingSearch.clear();
    this.pendingDiscovery.clear();
  }

  private nextRequestId(kind: 'search' | 'discover'): string {
    this.requestSequence += 1;
    return `${kind}-${this.requestSequence}`;
  }

  private assertInteractiveCapacity(): void {
    if (this.pendingSearch.size + this.pendingDiscovery.size >= 5) {
      throw new Error('CodeTrail already has five pending interactive requests.');
    }
  }
}
