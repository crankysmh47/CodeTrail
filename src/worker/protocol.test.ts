import { describe, expect, it } from 'vitest';
import { workerRequestSchema } from './protocol.js';

describe('analysis worker protocol', () => {
  it('should accept a bounded index request', () => {
    const parsed = workerRequestSchema.parse({
      kind: 'index',
      requestId: 'request-1',
      generation: 1,
      rootPath: '/workspace',
      parserWasmPath: '/assets/tree-sitter.wasm',
      languageWasmPath: '/assets/tree-sitter-c.wasm',
      limits: { filesMax: 2000, fileBytesMax: 2_097_152, totalBytesMax: 262_144_000 },
    });

    expect(parsed).toEqual(expect.objectContaining({ kind: 'index', generation: 1 }));
  });

  it('should reject malformed and unbounded requests', () => {
    const parsed = workerRequestSchema.safeParse({ kind: 'trail', requestId: 'r', seedId: 'x', budget: {} });

    expect(parsed.success).toBe(false);
  });
});
