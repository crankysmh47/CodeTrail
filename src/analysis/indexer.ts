import { readdir, readFile, realpath, stat } from 'node:fs/promises';
import { extname, relative, resolve } from 'node:path';
import type Parser from 'web-tree-sitter';
import { normalizeWorkspacePath, type AnalysisWarning, type WorkspaceIndex } from '../core/contracts.js';
import { analyzeCFile } from './c-adapter.js';
import { enrichKernelRelationships } from './kernel-enricher.js';

export type IndexLimits = Readonly<{
  filesMax: number;
  fileBytesMax: number;
  totalBytesMax: number;
}>;

export type IndexWorkspaceInput = Readonly<{
  rootPath: string;
  parser: Parser;
  limits: IndexLimits;
  signal: AbortSignal;
}>;

const excludedDirectories = new Set(['.git', '.worktrees', 'build', 'dist', 'node_modules', 'out']);
const extensions = new Set(['.c', '.h']);
const directoryCountMax = 20_000;

function validateLimits(limits: IndexLimits): void {
  for (const [name, value] of Object.entries(limits)) {
    if (!Number.isSafeInteger(value) || value < 1) {
      throw new Error(`${name} must be a positive safe integer; received ${value}`);
    }
  }
}

async function collectSourceFiles(rootPath: string): Promise<readonly string[]> {
  const pending = [rootPath];
  const files: string[] = [];
  let directoryCount = 0;

  while (pending.length > 0 && directoryCount < directoryCountMax) {
    const directory = pending.pop();
    if (!directory) {
      break;
    }
    directoryCount += 1;
    const entries = (await readdir(directory, { withFileTypes: true })).sort((left, right) =>
      left.name.localeCompare(right.name),
    );
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const entry = entries[index];
      if (!entry || entry.isSymbolicLink()) {
        continue;
      }
      const path = resolve(directory, entry.name);
      if (entry.isDirectory() && !excludedDirectories.has(entry.name)) {
        pending.push(path);
      } else if (entry.isFile() && extensions.has(extname(entry.name).toLowerCase())) {
        files.push(path);
      }
    }
  }
  return files.sort((left, right) => left.localeCompare(right));
}

function workspaceRelativePath(rootPath: string, absolutePath: string): string {
  const path = normalizeWorkspacePath(relative(rootPath, absolutePath));
  if (path.startsWith('../') || path === '..') {
    throw new Error(`Refusing to index a path outside the workspace: ${absolutePath}`);
  }
  return path;
}

export async function indexWorkspace(input: IndexWorkspaceInput): Promise<WorkspaceIndex> {
  validateLimits(input.limits);
  const rootPath = await realpath(input.rootPath);
  const discovered = await collectSourceFiles(rootPath);
  const selected = discovered.slice(0, input.limits.filesMax);
  const analyses = [];
  const warnings: AnalysisWarning[] = [];
  let totalBytes = 0;
  let isPartial = discovered.length > selected.length;

  if (isPartial) {
    warnings.push({
      code: 'FILE_LIMIT',
      message: `Indexing stopped at the ${input.limits.filesMax}-file limit.`,
      path: '',
    });
  }

  for (const absolutePath of selected) {
    const path = workspaceRelativePath(rootPath, absolutePath);
    if (input.signal.aborted) {
      isPartial = true;
      warnings.push({ code: 'INDEX_CANCELLED', message: 'Indexing was cancelled; partial results were kept.', path });
      break;
    }
    const metadata = await stat(absolutePath);
    if (metadata.size > input.limits.fileBytesMax) {
      warnings.push({
        code: 'FILE_TOO_LARGE',
        message: `Skipped ${path} because it exceeds ${input.limits.fileBytesMax} bytes.`,
        path,
      });
      continue;
    }
    if (totalBytes + metadata.size > input.limits.totalBytesMax) {
      isPartial = true;
      warnings.push({
        code: 'TOTAL_BYTES_LIMIT',
        message: `Indexing stopped at the ${input.limits.totalBytesMax}-byte workspace limit.`,
        path,
      });
      break;
    }
    const source = await readFile(absolutePath, 'utf8');
    totalBytes += metadata.size;
    analyses.push(await analyzeCFile({ parser: input.parser, path, source, nodeCountMax: 100_000 }));
  }

  const nodesById = new Map<string, WorkspaceIndex['nodes'][number]>();
  for (const analysis of analyses) {
    for (const node of analysis.nodes) {
      if (!nodesById.has(node.id)) {
        nodesById.set(node.id, node);
      }
    }
  }
  const nodes = [...nodesById.values()];
  const edges = enrichKernelRelationships(analyses);
  return {
    version: 1,
    rootPath,
    createdAtIso: new Date().toISOString(),
    nodes,
    edges,
    warnings: [...warnings, ...analyses.flatMap((analysis) => analysis.warnings)],
    filesIndexed: analyses.length,
    isPartial,
  };
}
