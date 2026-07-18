export const archiveBytesMax = 5 * 1024 * 1024;

const requiredEntryPaths = [
  'extension/package.json',
  'extension/readme.md',
  'extension/changelog.md',
  'extension/license.txt',
  'extension/support.md',
  'extension/privacy.md',
  'extension/security.md',
  'extension/media/icon.png',
  'extension/media/hero.png',
  'extension/dist/extension.cjs',
  'extension/dist/analysis-worker.cjs',
  'extension/dist/webview.js',
  'extension/dist/styles.css',
  'extension/dist/mcp-server.cjs',
  'extension/dist/tree-sitter.wasm',
  'extension/dist/tree-sitter-c.wasm',
] as const;

const forbiddenEntryPatterns: readonly RegExp[] = [
  /\/(?:src|test|test-fixtures|scripts|coverage|demo|\.cache|\.worktrees)\//,
  /\/docs\/superpowers\//,
  /(?:^|\/)package-lock\.json$/,
  /(?:^|\/)(?:tsconfig|vitest\.config|esbuild)\.(?:json|ts|mjs)$/,
  /\.(?:test|spec)\.[cm]?[jt]sx?$/,
  /\.(?:map|docx|svg)$/,
  /\/dist\/(?:mcp-evaluation|linux-evaluation|package-verifier)\.cjs$/,
];

type ManifestIdentity = Readonly<{
  name: string;
  publisher: string;
  version: string;
}>;

export type PackageValidationInput = Readonly<{
  entryPaths: readonly string[];
  manifest: ManifestIdentity;
  expectedManifest: ManifestIdentity;
  archiveBytes: number;
}>;

function normalizedEntryPath(path: string): string {
  return path.replaceAll('\\', '/').toLowerCase();
}

export function validatePackageContents(input: PackageValidationInput) {
  if (!Number.isInteger(input.archiveBytes) || input.archiveBytes < 1 || input.archiveBytes > archiveBytesMax) {
    throw new Error(`VSIX exceeded the ${archiveBytesMax}-byte release size ceiling.`);
  }
  const normalizedPaths = input.entryPaths
    .filter((path) => path.length > 0 && !path.endsWith('/') && !path.endsWith('\\'))
    .map(normalizedEntryPath);
  const pathSet = new Set(normalizedPaths);
  const missingPaths = requiredEntryPaths.filter((path) => !pathSet.has(path));
  if (missingPaths.length > 0) {
    throw new Error(`VSIX is missing required release files: ${missingPaths.join(', ')}.`);
  }
  const forbiddenPath = normalizedPaths.find((path) => forbiddenEntryPatterns.some((pattern) => pattern.test(path)));
  if (forbiddenPath) {
    throw new Error(`VSIX contains forbidden release content: ${forbiddenPath}.`);
  }
  const { name, publisher, version } = input.manifest;
  if (
    name !== input.expectedManifest.name ||
    publisher !== input.expectedManifest.publisher ||
    version !== input.expectedManifest.version
  ) {
    throw new Error('VSIX manifest identity does not match the verified package.json identity.');
  }
  return {
    files: normalizedPaths.length,
    archiveBytes: input.archiveBytes,
    archiveBytesMax,
    identity: `${publisher}.${name}@${version}`,
  };
}
