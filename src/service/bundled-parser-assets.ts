import { resolve } from 'node:path';
import type { CParserPaths } from '../analysis/parser-runtime.js';

export function resolveBundledParserAssets(bundleDirectoryPath: string): CParserPaths {
  return {
    parserWasmPath: resolve(bundleDirectoryPath, 'tree-sitter.wasm'),
    languageWasmPath: resolve(bundleDirectoryPath, 'tree-sitter-c.wasm'),
  };
}
