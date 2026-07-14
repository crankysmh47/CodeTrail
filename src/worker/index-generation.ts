export type IndexOperation = Readonly<{
  generation: number;
  controller: AbortController;
  signal: AbortSignal;
}>;

export class IndexGenerationGuard {
  private current: IndexOperation | undefined;

  begin(generation: number): IndexOperation {
    this.current?.controller.abort();
    const controller = new AbortController();
    const operation = { generation, controller, signal: controller.signal };
    this.current = operation;
    return operation;
  }

  cancel(): void {
    this.current?.controller.abort();
  }

  canPublish(operation: IndexOperation): boolean {
    return this.current === operation && !operation.signal.aborted;
  }
}
