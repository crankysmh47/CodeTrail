import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { analyzeCFile } from './c-adapter.js';
import { createCParser } from './parser-runtime.js';

const parserWasmPath = fileURLToPath(import.meta.resolve('web-tree-sitter/tree-sitter.wasm'));
const languageWasmPath = fileURLToPath(import.meta.resolve('tree-sitter-wasms/out/tree-sitter-c.wasm'));

async function analyzeFixture(relativePath: string) {
  const source = await readFile(new URL(`../../test-fixtures/${relativePath}`, import.meta.url), 'utf8');
  const parser = await createCParser({ parserWasmPath, languageWasmPath });
  return analyzeCFile({ parser, path: relativePath, source, nodeCountMax: 100_000 });
}

describe('C structural adapter', () => {
  it('should extract functions, macros, fields, and calls with provenance', async () => {
    const result = await analyzeFixture('kernel-mini/fair.c');

    expect(result.nodes.map((node) => [node.kind, node.name])).toEqual(
      expect.arrayContaining([
        ['function', 'pick_next_task_fair'],
        ['function', 'pick_eevdf'],
      ]),
    );
    expect(result.unresolvedReferences).toContainEqual(
      expect.objectContaining({
        sourceName: 'pick_next_task_fair',
        targetName: 'pick_eevdf',
        kind: 'calls',
        path: 'kernel-mini/fair.c',
        range: expect.objectContaining({ lineStart: 17 }),
      }),
    );

    const header = await analyzeFixture('kernel-mini/sched.h');
    expect(header.nodes.map((node) => [node.kind, node.name])).toEqual(
      expect.arrayContaining([
        ['macro', 'DEFINE_SCHED_CLASS'],
        ['struct', 'sched_class'],
        ['field', 'pick_task'],
      ]),
    );
  });

  it('should return partial structure and a warning for malformed C', async () => {
    const parser = await createCParser({ parserWasmPath, languageWasmPath });
    const result = await analyzeCFile({
      parser,
      path: 'broken.c',
      source: 'static int useful(void) { return 1; }\nstatic int broken( {',
      nodeCountMax: 100,
    });

    expect(result.nodes).toContainEqual(expect.objectContaining({ kind: 'function', name: 'useful' }));
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ code: 'C_PARSE_PARTIAL', path: 'broken.c' }),
    );
  });

  it('should not treat struct references as declarations', async () => {
    const parser = await createCParser({ parserWasmPath, languageWasmPath });
    const result = await analyzeCFile({
      parser,
      path: 'references.c',
      source: [
        'static struct task_struct *first(struct task_struct *task);',
        'static struct task_struct *second(struct task_struct *task);',
      ].join('\n'),
      nodeCountMax: 100,
    });

    expect(result.nodes.filter((node) => node.kind === 'struct' && node.name === 'task_struct')).toStrictEqual([]);
  });
});
