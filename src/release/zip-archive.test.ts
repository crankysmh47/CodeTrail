import { createWriteStream } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ZipFile } from 'yazl';
import { inspectVsixArchive } from './zip-archive.js';

const temporaryDirectories: string[] = [];

async function writeZip(entries: Readonly<Record<string, string>>): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'codetrail-vsix-'));
  temporaryDirectories.push(directory);
  const archivePath = join(directory, 'fixture.vsix');
  const zip = new ZipFile();
  for (const [path, contents] of Object.entries(entries)) {
    zip.addBuffer(Buffer.from(contents), path);
  }
  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(archivePath);
    output.once('close', resolve);
    output.once('error', reject);
    zip.outputStream.once('error', reject);
    zip.outputStream.pipe(output);
    zip.end();
  });
  return archivePath;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('VSIX ZIP inspection', () => {
  it('reads the manifest and archive entries without a platform archive command', async () => {
    const manifest = JSON.stringify({ name: 'codetrail', publisher: 'example', version: '0.1.0' });
    const archivePath = await writeZip({
      'extension/package.json': manifest,
      'extension/dist/extension.cjs': 'module.exports = {};',
    });

    await expect(inspectVsixArchive(archivePath)).resolves.toStrictEqual({
      entryPaths: ['extension/package.json', 'extension/dist/extension.cjs'],
      packagedManifestText: manifest,
    });
  });

  it('rejects a manifest that exceeds the bounded extraction limit', async () => {
    const archivePath = await writeZip({ 'extension/package.json': 'x'.repeat(65 * 1024) });

    await expect(inspectVsixArchive(archivePath)).rejects.toThrow(/manifest.*limit/i);
  });
});
