import { describe, expect, it } from 'vitest';
import { createNodeId, createRange, type CodeNode, type WorkspaceIndex } from './contracts.js';
import { searchIndex } from './search.js';

function node(name: string, path: string, lineStart: number, summary = ''): CodeNode {
  const tokens = name.split('_');
  return {
    id: createNodeId('c', path, 'function', name),
    language: 'c',
    kind: 'function',
    name,
    qualifiedName: name,
    path,
    range: createRange(lineStart, 1, lineStart, 20),
    signature: `static void ${name}(void)`,
    summary,
    tokens,
  };
}

const pickNextTaskFair = node('pick_next_task_fair', 'kernel/sched/fair.c', 10, 'fair scheduler selection');
const incidental = node('print_task_note', 'kernel/debug.c', 50, 'comment about choosing the next fair task');
const pickEevdf = node('pick_eevdf', 'kernel/sched/fair.c', 30, 'earliest eligible virtual deadline');
const index: WorkspaceIndex = {
  version: 1,
  rootPath: '/linux',
  createdAtIso: '2026-07-14T00:00:00.000Z',
  nodes: [incidental, pickEevdf, pickNextTaskFair],
  edges: [],
  warnings: [],
  filesIndexed: 2,
  isPartial: false,
};

describe('deterministic search', () => {
  it('should rank exact symbol and scheduler vocabulary above incidental summaries', () => {
    const result = searchIndex(index, 'How does the fair scheduler choose the next task?', 5);

    expect(result.candidates[0]).toMatchObject({
      nodeId: pickNextTaskFair.id,
      reasons: expect.arrayContaining(['symbol tokens: pick, next, task, fair']),
    });
  });

  it('should return an explicit empty result for punctuation-only queries', () => {
    expect(searchIndex(index, '... ???', 5)).toStrictEqual({ normalizedQuery: '', candidates: [] });
  });

  it('should keep stable source order for tied candidates and honor the result limit', () => {
    const tiedIndex = { ...index, nodes: [node('alpha', 'z.c', 2), node('alpha', 'a.c', 9)] };

    const result = searchIndex(tiedIndex, 'alpha', 1);

    expect(result.candidates).toStrictEqual([
      expect.objectContaining({ nodeId: createNodeId('c', 'a.c', 'function', 'alpha') }),
    ]);
  });
});
