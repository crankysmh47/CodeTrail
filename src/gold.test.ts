import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { indexWorkspace } from './analysis/indexer.js';
import { createCParser } from './analysis/parser-runtime.js';
import { buildBoundedSubgraph } from './core/graph.js';
import { searchIndex } from './core/search.js';
import { buildTrail } from './core/trail.js';

describe('Linux scheduler gold path', () => {
  it('should turn the primary question into an evidence-backed fair scheduler trail', async () => {
    const parser = await createCParser({
      parserWasmPath: fileURLToPath(import.meta.resolve('web-tree-sitter/tree-sitter.wasm')),
      languageWasmPath: fileURLToPath(import.meta.resolve('tree-sitter-wasms/out/tree-sitter-c.wasm')),
    });
    const index = await indexWorkspace({
      rootPath: fileURLToPath(new URL('../test-fixtures/kernel-mini', import.meta.url)),
      parser,
      limits: { filesMax: 20, fileBytesMax: 2_097_152, totalBytesMax: 10_485_760 },
      signal: new AbortController().signal,
    });

    const result = searchIndex(index, 'How does the Linux fair scheduler choose the next task?', 5);
    const seed = index.nodes.find((node) => node.id === result.candidates[0]?.nodeId);
    expect(seed?.name).toBe('pick_next_task_fair');
    const subgraph = buildBoundedSubgraph(index, [seed!.id], {
      nodesMax: 40,
      edgesMax: 80,
      depthMax: 4,
      timeMsMax: 100,
    });
    const trail = buildTrail(index, subgraph, seed!.id);
    const trailNames = trail.steps.map((step) => index.nodes.find((node) => node.id === step.nodeId)?.name);

    expect(trailNames).toEqual(expect.arrayContaining(['pick_eevdf', 'entity_eligible']));
    expect(index.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'registers', confidence: 'inferred' }),
        expect.objectContaining({ kind: 'dispatches-to', confidence: 'inferred' }),
      ]),
    );
    expect(trail.disclaimer).toBe('Static reading order; not a runtime trace.');
  });

  it.each([
    ['How does the Linux fair scheduler choose the next task?', 'pick_next_task_fair'],
    ['How does EEVDF decide whether an entity is eligible?', 'entity_eligible'],
    ['How is the fair scheduler registered for dispatch?', 'pick_task'],
  ])('should rank the expected seed for %s', async (query, expectedName) => {
    const parser = await createCParser({
      parserWasmPath: fileURLToPath(import.meta.resolve('web-tree-sitter/tree-sitter.wasm')),
      languageWasmPath: fileURLToPath(import.meta.resolve('tree-sitter-wasms/out/tree-sitter-c.wasm')),
    });
    const index = await indexWorkspace({
      rootPath: fileURLToPath(new URL('../test-fixtures/kernel-mini', import.meta.url)),
      parser,
      limits: { filesMax: 20, fileBytesMax: 2_097_152, totalBytesMax: 10_485_760 },
      signal: new AbortController().signal,
    });

    const result = searchIndex(index, query, 8);
    const seed = index.nodes.find((node) => node.id === result.candidates[0]?.nodeId);

    expect(seed?.name).toBe(expectedName);
  });
});
