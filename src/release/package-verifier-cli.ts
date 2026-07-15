import { execFile } from 'node:child_process';
import { readFile, realpath, stat } from 'node:fs/promises';
import { extname } from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';
import { validatePackageContents } from './package-content.js';

const execFileAsync = promisify(execFile);
const commandOutputBytesMax = 2 * 1024 * 1024;

type PackageManifest = Readonly<{ name?: unknown; publisher?: unknown; version?: unknown }>;

function manifestIdentity(manifest: PackageManifest, label: string) {
  if (
    typeof manifest.name !== 'string' ||
    typeof manifest.publisher !== 'string' ||
    typeof manifest.version !== 'string'
  ) {
    throw new Error(`${label} does not contain a valid extension identity.`);
  }
  return { name: manifest.name, publisher: manifest.publisher, version: manifest.version };
}

async function main(): Promise<void> {
  const [archiveArgument] = process.argv.slice(2);
  if (!archiveArgument || process.argv.length !== 3 || extname(archiveArgument).toLowerCase() !== '.vsix') {
    throw new Error('Usage: codetrail-package-verifier <extension.vsix>');
  }
  const archivePath = await realpath(archiveArgument);
  const archiveMetadata = await stat(archivePath);
  if (!archiveMetadata.isFile()) {
    throw new Error('VSIX path must be a file.');
  }
  const [{ stdout: tableOfContents }, { stdout: packagedManifestText }, rootManifestText] = await Promise.all([
    execFileAsync('tar', ['-tf', archivePath], { encoding: 'utf8', maxBuffer: commandOutputBytesMax, windowsHide: true }),
    execFileAsync('tar', ['-xOf', archivePath, 'extension/package.json'], {
      encoding: 'utf8',
      maxBuffer: commandOutputBytesMax,
      windowsHide: true,
    }),
    readFile('package.json', 'utf8'),
  ]);
  const report = validatePackageContents({
    entryPaths: tableOfContents.split(/\r?\n/),
    manifest: manifestIdentity(JSON.parse(packagedManifestText) as PackageManifest, 'Packaged manifest'),
    expectedManifest: manifestIdentity(JSON.parse(rootManifestText) as PackageManifest, 'Root package.json'),
    archiveBytes: archiveMetadata.size,
  });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'CodeTrail package verification failed.';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
