import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import type { FileAnalysis } from '../core/contracts.js';
import { analyzeCFile } from './c-adapter.js';
import { enrichKernelRelationships } from './kernel-enricher.js';
import { createCParser } from './parser-runtime.js';

const parserWasmPath = fileURLToPath(import.meta.resolve('web-tree-sitter/tree-sitter.wasm'));
const languageWasmPath = fileURLToPath(import.meta.resolve('tree-sitter-wasms/out/tree-sitter-c.wasm'));
let fixtureAnalyses: readonly FileAnalysis[] = [];

beforeAll(async () => {
  const parser = await createCParser({ parserWasmPath, languageWasmPath });
  fixtureAnalyses = await Promise.all(
    ['kernel-mini/sched.h', 'kernel-mini/fair.c'].map(async (path) => {
      const source = await readFile(new URL(`../../test-fixtures/${path}`, import.meta.url), 'utf8');
      return analyzeCFile({ parser, path, source, nodeCountMax: 100_000 });
    }),
  );
});

describe('kernel relationship enricher', () => {
  it('should recover scheduler registration and function-pointer dispatch', () => {
    const edges = enrichKernelRelationships(fixtureAnalyses);

    expect(edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'registers',
          confidence: 'inferred',
          reason: expect.stringContaining('.pick_task'),
        }),
        expect.objectContaining({
          kind: 'dispatches-to',
          confidence: 'inferred',
          reason: expect.stringContaining('sched_class'),
        }),
      ]),
    );
  });

  it('should resolve direct calls as confirmed edges', () => {
    const edges = enrichKernelRelationships(fixtureAnalyses);
    const call = edges.find(
      (edge) => edge.kind === 'calls' && edge.reason.includes('pick_next_task_fair') && edge.reason.includes('pick_eevdf'),
    );

    expect(call).toEqual(expect.objectContaining({ confidence: 'confirmed' }));
  });

  it('should preserve configuration guards on inferred edges', () => {
    const edge = enrichKernelRelationships(fixtureAnalyses).find(
      (candidate) => candidate.kind === 'guarded-by' && candidate.reason.includes('CONFIG_SMP'),
    );

    expect(edge).toEqual(expect.objectContaining({ confidence: 'confirmed' }));
  });
});
