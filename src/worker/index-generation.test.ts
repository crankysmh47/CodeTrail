import { describe, expect, it } from 'vitest';
import { IndexGenerationGuard } from './index-generation.js';

describe('IndexGenerationGuard', () => {
  it('aborts the previous index and only publishes the newest generation', () => {
    const guard = new IndexGenerationGuard();

    const first = guard.begin(1);
    const second = guard.begin(2);

    expect(first.signal.aborted).toBe(true);
    expect(second.signal.aborted).toBe(false);
    expect(guard.canPublish(first)).toBe(false);
    expect(guard.canPublish(second)).toBe(true);
  });
});
