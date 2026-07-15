import { realpath, stat } from 'node:fs/promises';
import type Parser from 'web-tree-sitter';
import { indexWorkspace, type IndexLimits } from '../analysis/indexer.js';
import { createCParser, type CParserPaths } from '../analysis/parser-runtime.js';
import type { CodeDiscovery, CodeNode, SearchResult, WorkspaceIndex } from '../core/contracts.js';
import { buildDiscovery } from '../core/discovery.js';
import { buildBoundedSubgraph, type GraphBudget } from '../core/graph.js';
import { searchIndex } from '../core/search.js';

export type CodeTrailServiceOptions = Readonly<{
  rootPath: string;
  parserWasmPath: string;
  languageWasmPath: string;
  limits?: Readonly<Partial<IndexLimits>>;
  signal?: AbortSignal;
}>;

export const serviceIndexLimits: IndexLimits = {
  filesMax: 2_000,
  fileBytesMax: 2 * 1024 * 1024,
  totalBytesMax: 250 * 1024 * 1024,
};

export const serviceGraphBudget: GraphBudget = {
  nodesMax: 40,
  edgesMax: 120,
  depthMax: 4,
  timeMsMax: 1_000,
};

async function canonicalWorkspacePath(rootPath: string): Promise<string> {
  let canonicalPath: string;
  try {
    canonicalPath = await realpath(rootPath);
  } catch {
    throw new Error('CodeTrail workspace must be an existing directory.');
  }
  const metadata = await stat(canonicalPath);
  if (!metadata.isDirectory()) {
    throw new Error('CodeTrail workspace must be a directory.');
  }
  return canonicalPath;
}

function completeIndexLimits(overrides: Readonly<Partial<IndexLimits>>): IndexLimits {
  return {
    filesMax: overrides.filesMax ?? serviceIndexLimits.filesMax,
    fileBytesMax: overrides.fileBytesMax ?? serviceIndexLimits.fileBytesMax,
    totalBytesMax: overrides.totalBytesMax ?? serviceIndexLimits.totalBytesMax,
  };
}

export class CodeTrailService {
  private readonly nodesById: ReadonlyMap<string, CodeNode>;
  private isDisposed = false;

  private constructor(
    private readonly parser: Parser,
    private readonly index: WorkspaceIndex,
  ) {
    this.nodesById = new Map(index.nodes.map((node) => [node.id, node]));
  }

  static async create(options: CodeTrailServiceOptions): Promise<CodeTrailService> {
    const rootPath = await canonicalWorkspacePath(options.rootPath);
    const parserPaths: CParserPaths = {
      parserWasmPath: options.parserWasmPath,
      languageWasmPath: options.languageWasmPath,
    };
    const parser = await createCParser(parserPaths);
    try {
      const index = await indexWorkspace({
        rootPath,
        parser,
        limits: completeIndexLimits(options.limits ?? {}),
        signal: options.signal ?? new AbortController().signal,
      });
      return new CodeTrailService(parser, index);
    } catch (error) {
      parser.delete();
      throw error;
    }
  }

  getIndex(): WorkspaceIndex {
    this.assertActive();
    return this.index;
  }

  search(query: string, limit: number): SearchResult {
    this.assertActive();
    return searchIndex(this.index, query, limit);
  }

  getSymbol(symbolId: string): CodeNode | undefined {
    this.assertActive();
    return this.nodesById.get(symbolId);
  }

  discover(symbolId: string): CodeDiscovery {
    this.assertActive();
    if (!this.nodesById.has(symbolId)) {
      throw new Error('CodeTrail symbol was not found. Search the current index before requesting a reading path.');
    }
    const subgraph = buildBoundedSubgraph(this.index, [symbolId], serviceGraphBudget);
    return buildDiscovery(this.index, subgraph, symbolId);
  }

  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this.isDisposed = true;
    this.parser.delete();
  }

  private assertActive(): void {
    if (this.isDisposed) {
      throw new Error('CodeTrail service has been disposed.');
    }
  }
}
