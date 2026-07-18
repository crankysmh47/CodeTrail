import { describe, expect, it } from 'vitest';
import { validatePackageContents } from './package-content.js';

const requiredPaths = [
  'extension/package.json',
  'extension/readme.md',
  'extension/changelog.md',
  'extension/LICENSE.txt',
  'extension/SUPPORT.md',
  'extension/PRIVACY.md',
  'extension/SECURITY.md',
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

const expectedManifest = {
  name: 'codetrail-c-evidence-paths',
  publisher: 'crankysmh47',
  version: '0.1.0',
};

describe('VSIX package contents', () => {
  it('should accept the minimal runnable and trustworthy package', () => {
    expect(
      validatePackageContents({
        entryPaths: ['[Content_Types].xml', 'extension.vsixmanifest', ...requiredPaths],
        manifest: expectedManifest,
        expectedManifest,
        archiveBytes: 700_000,
      }),
    ).toStrictEqual({
      files: requiredPaths.length + 2,
      archiveBytes: 700_000,
      archiveBytesMax: 5 * 1024 * 1024,
      identity: 'crankysmh47.codetrail-c-evidence-paths@0.1.0',
    });
  });

  it.each([
    [['extension/package.json'], expectedManifest, 700_000, /missing required/i],
    [[...requiredPaths, 'extension/src/secret.ts'], expectedManifest, 700_000, /forbidden/i],
    [[...requiredPaths, 'extension/test/core.c'], expectedManifest, 700_000, /forbidden/i],
    [[...requiredPaths, 'extension/dist/extension.cjs.map'], expectedManifest, 700_000, /forbidden/i],
    [requiredPaths, { ...expectedManifest, publisher: 'wrong' }, 700_000, /manifest identity/i],
    [requiredPaths, expectedManifest, 6 * 1024 * 1024, /size ceiling/i],
  ] as const)('should reject incomplete, leaky, mismatched, or oversized packages %#', (entryPaths, manifest, bytes, error) => {
    expect(() =>
      validatePackageContents({
        entryPaths,
        manifest,
        expectedManifest,
        archiveBytes: bytes,
      }),
    ).toThrow(error);
  });
});
