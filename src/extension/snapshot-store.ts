import { constants } from 'node:fs';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { promisify } from 'node:util';
import { gunzip, gzip } from 'node:zlib';
import type { WorkspaceIndex } from '../core/contracts.js';
import { workspaceIndexSchema } from '../shared/schemas.js';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);
const compressedBytesMax = 50 * 1024 * 1024;
const decompressedBytesMax = 250 * 1024 * 1024;

export type SnapshotLoadResult =
  | Readonly<{ status: 'ready'; index: WorkspaceIndex }>
  | Readonly<{ status: 'missing' | 'stale'; reason: string }>;

async function exists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function saveSnapshot(path: string, index: WorkspaceIndex): Promise<void> {
  const validated = workspaceIndexSchema.parse(index);
  const compressed = await gzipAsync(Buffer.from(JSON.stringify(validated), 'utf8'));
  if (compressed.byteLength > compressedBytesMax) {
    throw new Error(`Snapshot exceeds the ${compressedBytesMax}-byte compressed limit.`);
  }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, compressed);
}

export async function loadSnapshot(path: string): Promise<SnapshotLoadResult> {
  if (!(await exists(path))) {
    return { status: 'missing', reason: 'No saved index exists.' };
  }
  try {
    const compressed = await readFile(path);
    if (compressed.byteLength > compressedBytesMax) {
      return { status: 'stale', reason: 'Saved index exceeds the compressed safety limit.' };
    }
    const decompressed = await gunzipAsync(compressed, { maxOutputLength: decompressedBytesMax });
    const unknownValue: unknown = JSON.parse(decompressed.toString('utf8'));
    const parsed = workspaceIndexSchema.safeParse(unknownValue);
    if (!parsed.success) {
      return { status: 'stale', reason: 'Saved index has an incompatible schema.' };
    }
    return { status: 'ready', index: parsed.data as unknown as WorkspaceIndex };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: 'stale', reason: `Saved index could not be loaded: ${message}` };
  }
}
