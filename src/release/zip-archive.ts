import type { Readable } from 'node:stream';
import { openPromise, type Entry } from 'yauzl';

const manifestPath = 'extension/package.json';
const manifestBytesMax = 64 * 1024;
const entryCountMax = 1_024;

export type InspectedVsixArchive = Readonly<{
  entryPaths: readonly string[];
  packagedManifestText: string;
}>;

async function readBoundedUtf8(stream: Readable, bytesMax: number): Promise<string> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of stream) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
    bytes += buffer.byteLength;
    if (bytes > bytesMax) {
      stream.destroy();
      throw new Error(`Packaged manifest exceeded the ${bytesMax}-byte extraction limit.`);
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks, bytes).toString('utf8');
}

export async function inspectVsixArchive(archivePath: string): Promise<InspectedVsixArchive> {
  const archive = await openPromise(archivePath, {
    autoClose: false,
    lazyEntries: true,
    strictFileNames: true,
    validateEntrySizes: true,
  });
  try {
    if (archive.entryCount > entryCountMax) {
      throw new Error(`VSIX exceeded the ${entryCountMax}-entry inspection limit.`);
    }
    const entryPaths: string[] = [];
    let packagedManifest: Entry | undefined;
    for await (const entry of archive.eachEntry()) {
      entryPaths.push(entry.fileName);
      if (entry.fileName.toLowerCase() !== manifestPath) {
        continue;
      }
      if (packagedManifest) {
        throw new Error('VSIX contains more than one packaged manifest.');
      }
      packagedManifest = entry;
    }
    if (!packagedManifest) {
      throw new Error('VSIX is missing extension/package.json.');
    }
    if (packagedManifest.uncompressedSize > manifestBytesMax) {
      throw new Error(`Packaged manifest exceeded the ${manifestBytesMax}-byte extraction limit.`);
    }
    const manifestStream = await archive.openReadStreamPromise(packagedManifest);
    return {
      entryPaths,
      packagedManifestText: await readBoundedUtf8(manifestStream, manifestBytesMax),
    };
  } finally {
    archive.close();
  }
}
