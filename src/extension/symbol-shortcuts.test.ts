import { describe, expect, it } from 'vitest';
import { createNodeId, createRange, type CodeNode, type WorkspaceIndex } from '../core/contracts.js';
import { indexedFunctionsForDocument, resolveIndexedSymbol } from './symbol-shortcuts.js';

function node(path: string, name: string, kind: CodeNode['kind'], lineStart: number): CodeNode {
  return {
    id: createNodeId('c', path, kind, name),
    language: 'c',
    kind,
    name,
    qualifiedName: name,
    path,
    range: createRange(lineStart, 1, lineStart + 2, 2),
    signature: name,
    summary: `${kind} ${name}`,
    tokens: name.split('_'),
  };
}

const pickNext = node('kernel/sched/fair.c', 'pick_next_task_fair', 'function', 15);
const pickEevdf = node('kernel/sched/fair.c', 'pick_eevdf', 'function', 8);
const pickField = node('kernel/sched/sched.h', 'pick_task', 'field', 18);
const otherPickNext = node('drivers/demo.c', 'pick_next_task_fair', 'function', 4);
const index: WorkspaceIndex = {
  version: 1,
  rootPath: 'C:\\linux',
  createdAtIso: '2026-07-15T00:00:00.000Z',
  nodes: [pickNext, pickField, otherPickNext, pickEevdf],
  edges: [],
  warnings: [],
  filesIndexed: 3,
  isPartial: false,
};

describe('editor symbol shortcuts', () => {
  it('should list indexed function definitions for a Windows document in source order', () => {
    const entries = indexedFunctionsForDocument(index, 'C:\\linux\\kernel\\sched\\fair.c');

    expect(entries).toStrictEqual([
      { nodeId: pickEevdf.id, name: 'pick_eevdf', lineStart: 8, lineEnd: 10 },
      { nodeId: pickNext.id, name: 'pick_next_task_fair', lineStart: 15, lineEnd: 17 },
    ]);
  });

  it('should return no CodeLens entries outside the indexed workspace', () => {
    expect(indexedFunctionsForDocument(index, 'C:\\other\\fair.c')).toStrictEqual([]);
  });

  it('should reject a document path that uses a different platform style than the index', () => {
    expect(indexedFunctionsForDocument(index, '/linux/kernel/sched/fair.c')).toStrictEqual([]);
  });

  it('should resolve an exact symbol in the active document before another file', () => {
    const result = resolveIndexedSymbol(index, 'pick_next_task_fair', 'C:\\linux\\kernel\\sched\\fair.c');

    expect(result).toStrictEqual({ status: 'found', node: pickNext });
  });

  it('should return an explicit missing result for an unknown symbol', () => {
    expect(resolveIndexedSymbol(index, 'missing', 'C:\\linux\\kernel\\sched\\fair.c')).toStrictEqual({
      status: 'missing',
    });
  });
});
