import { describe, expect, it } from 'vitest';
import { workerRequestSchema, workerResponseSchema } from './protocol.js';

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
    const parsed = workerRequestSchema.safeParse({ kind: 'discover', requestId: 'r', seedId: 'x', budget: {} });

    expect(parsed.success).toBe(false);
  });

  it('should reject discovery requests above the compact graph bounds', () => {
    const parsed = workerRequestSchema.safeParse({
      kind: 'discover',
      requestId: 'discover-large',
      seedId: 'node-1',
      budget: { nodesMax: 101, edgesMax: 80, depthMax: 4, timeMsMax: 100 },
    });

    expect(parsed.success).toBe(false);
  });

  it('should validate a structured discovery response', () => {
    const parsed = workerResponseSchema.parse({
      kind: 'discovery-result',
      requestId: 'discover-1',
      discovery: {
        trail: {
          seedId: 'node-1',
          title: 'Trail from node-1',
          steps: [{ order: 1, nodeId: 'node-1', incomingEdgeId: '', reason: 'Selected entry point.' }],
          warnings: [],
          disclaimer: 'Static reading order; not a runtime trace.',
        },
        fileLinks: [
          {
            sourcePath: 'sched.h',
            targetPath: 'fair.c',
            kinds: ['registers'],
            confidence: 'inferred',
            reason: 'registration evidence',
            evidenceCount: 1,
          },
        ],
        fileSections: [{ path: 'fair.c', steps: [], relatedEdgeIds: [] }],
      },
    });

    expect(parsed.kind).toBe('discovery-result');
  });
});
