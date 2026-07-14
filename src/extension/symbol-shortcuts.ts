import { relative, resolve } from 'node:path';
import { normalizeWorkspacePath, type CodeNode, type WorkspaceIndex } from '../core/contracts.js';

export type IndexedFunctionEntry = Readonly<{
  nodeId: string;
  name: string;
  lineStart: number;
  lineEnd: number;
}>;

export type SymbolResolution =
  | Readonly<{ status: 'found'; node: CodeNode }>
  | Readonly<{ status: 'missing' }>;

function documentWorkspacePath(index: WorkspaceIndex, documentPath: string): string {
  const path = normalizeWorkspacePath(relative(resolve(index.rootPath), resolve(documentPath)));
  return path === '..' || path.startsWith('../') ? '' : path;
}

export function indexedFunctionsForDocument(
  index: WorkspaceIndex,
  documentPath: string,
): readonly IndexedFunctionEntry[] {
  const path = documentWorkspacePath(index, documentPath);
  if (path.length === 0) {
    return [];
  }
  return index.nodes
    .filter((node) => node.kind === 'function' && node.path === path)
    .sort((left, right) => left.range.lineStart - right.range.lineStart || left.id.localeCompare(right.id))
    .map((node) => ({
      nodeId: node.id,
      name: node.name,
      lineStart: node.range.lineStart,
      lineEnd: node.range.lineEnd,
    }));
}

export function resolveIndexedSymbol(
  index: WorkspaceIndex,
  symbolName: string,
  documentPath: string,
): SymbolResolution {
  const path = documentWorkspacePath(index, documentPath);
  const candidates = index.nodes
    .filter((node) => node.name === symbolName)
    .sort((left, right) => {
      const leftLocal = left.path === path ? 0 : 1;
      const rightLocal = right.path === path ? 0 : 1;
      const leftFunction = left.kind === 'function' ? 0 : 1;
      const rightFunction = right.kind === 'function' ? 0 : 1;
      return leftLocal - rightLocal || leftFunction - rightFunction || left.path.localeCompare(right.path) || left.id.localeCompare(right.id);
    });
  const node = candidates[0];
  return node ? { status: 'found', node } : { status: 'missing' };
}
