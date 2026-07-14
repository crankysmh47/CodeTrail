import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Parser from 'web-tree-sitter';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { indexWorkspace } from './indexer.js';
import { createCParser } from './parser-runtime.js';

const roots: string[] = [];
let parser: Parser;

beforeAll(async () => {
  parser = await createCParser({
    parserWasmPath: fileURLToPath(import.meta.resolve('web-tree-sitter/tree-sitter.wasm')),
    languageWasmPath: fileURLToPath(import.meta.resolve('tree-sitter-wasms/out/tree-sitter-c.wasm')),
  });
});

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function fixtureRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'codetrail-index-'));
  roots.push(root);
  await mkdir(join(root, 'node_modules'), { recursive: true });
  await Promise.all([
    writeFile(join(root, 'a.c'), 'int alpha(void) { return beta(); }'),
    writeFile(join(root, 'b.h'), 'struct beta_state { int value; }; int beta(void);'),
    writeFile(join(root, 'notes.txt'), 'not C'),
    writeFile(join(root, 'node_modules', 'ignored.c'), 'int ignored(void);'),
  ]);
  return root;
}

describe('workspace indexer', () => {
  it('should index only C files in stable order and skip excluded directories', async () => {
    const rootPath = await fixtureRoot();

    const index = await indexWorkspace({
      rootPath,
      parser,
      limits: { filesMax: 20, fileBytesMax: 10_000, totalBytesMax: 20_000 },
      signal: new AbortController().signal,
    });

    expect(index.filesIndexed).toBe(2);
    expect(index.nodes.some((node) => node.name === 'ignored')).toBe(false);
    expect([...new Set(index.nodes.map((node) => node.path))]).toStrictEqual(['a.c', 'b.h']);
  });

  it('should report oversized files instead of reading them', async () => {
    const rootPath = await fixtureRoot();
    await writeFile(join(rootPath, 'large.c'), 'x'.repeat(101));

    const index = await indexWorkspace({
      rootPath,
      parser,
      limits: { filesMax: 20, fileBytesMax: 100, totalBytesMax: 20_000 },
      signal: new AbortController().signal,
    });

    expect(index.warnings).toContainEqual(expect.objectContaining({ code: 'FILE_TOO_LARGE', path: 'large.c' }));
  });

  it('should return an explicit partial index when cancelled', async () => {
    const rootPath = await fixtureRoot();
    const controller = new AbortController();
    controller.abort();

    const index = await indexWorkspace({
      rootPath,
      parser,
      limits: { filesMax: 20, fileBytesMax: 10_000, totalBytesMax: 20_000 },
      signal: controller.signal,
    });

    expect(index.isPartial).toBe(true);
    expect(index.warnings).toContainEqual(expect.objectContaining({ code: 'INDEX_CANCELLED' }));
  });
});
