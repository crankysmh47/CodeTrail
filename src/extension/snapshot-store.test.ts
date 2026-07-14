import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createNodeId, createRange, type WorkspaceIndex } from '../core/contracts.js';
import { loadSnapshot, saveSnapshot } from './snapshot-store.js';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function snapshotPath(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'codetrail-snapshot-'));
  roots.push(root);
  return join(root, 'index.json.gz');
}

const range = createRange(1, 1, 1, 10);
const index: WorkspaceIndex = {
  version: 1,
  rootPath: '/workspace',
  createdAtIso: '2026-07-14T00:00:00.000Z',
  nodes: [
    {
      id: createNodeId('c', 'a.c', 'function', 'alpha'),
      language: 'c',
      kind: 'function',
      name: 'alpha',
      qualifiedName: 'alpha',
      path: 'a.c',
      range,
      signature: 'int alpha(void)',
      summary: 'function alpha',
      tokens: ['alpha'],
    },
  ],
  edges: [],
  warnings: [],
  filesIndexed: 1,
  isPartial: false,
};

describe('gzip snapshot store', () => {
  it('should roundtrip a validated workspace index', async () => {
    const path = await snapshotPath();

    await saveSnapshot(path, index);
    const loaded = await loadSnapshot(path);

    expect(loaded).toStrictEqual({ status: 'ready', index });
  });

  it('should report a missing snapshot without throwing', async () => {
    const path = await snapshotPath();

    await expect(loadSnapshot(path)).resolves.toStrictEqual({ status: 'missing', reason: 'No saved index exists.' });
  });
});
