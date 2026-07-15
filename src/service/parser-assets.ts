import { fileURLToPath } from 'node:url';
import type { CParserPaths } from '../analysis/parser-runtime.js';

export function resolveDependencyParserAssets(): CParserPaths {
  return {
    parserWasmPath: fileURLToPath(import.meta.resolve('web-tree-sitter/tree-sitter.wasm')),
    languageWasmPath: fileURLToPath(import.meta.resolve('tree-sitter-wasms/out/tree-sitter-c.wasm')),
  };
}
