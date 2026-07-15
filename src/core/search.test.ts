import { describe, expect, it } from 'vitest';
import {
  createEdgeId,
  createNodeId,
  createRange,
  type CodeEdge,
  type CodeNode,
  type WorkspaceIndex,
} from './contracts.js';
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

  it('should return each stable node ID once before applying the limit', () => {
    const duplicateIndex = { ...index, nodes: [pickNextTaskFair, pickNextTaskFair, pickEevdf] };

    const result = searchIndex(duplicateIndex, 'pick next task', 10);

    expect(result.candidates.map((candidate) => candidate.nodeId)).toStrictEqual([
      pickNextTaskFair.id,
      pickEevdf.id,
    ]);
  });

  it('should recover a one-edit typo within an otherwise specific identifier query', () => {
    const result = searchIndex(index, 'taks fair', 5);

    expect(result.candidates[0]?.nodeId).toBe(pickNextTaskFair.id);
    expect(result.candidates[0]?.reasons).toContain('identifier typo: taks → task');
  });

  it('should return direct scheduler keyword matches before typed adjacent symbols', () => {
    const schedulerField = node('pick_task', 'kernel/sched/sched.h', 70);
    const registeredImplementation = node('pick_next_task_fair', 'kernel/fair.c', 90);
    const unrelated = node('device_probe', 'drivers/device.c', 10);
    const range = createRange(72, 5, 72, 38);
    const registration: CodeEdge = {
      id: createEdgeId(schedulerField.id, 'registers', registeredImplementation.id, range),
      sourceId: schedulerField.id,
      targetId: registeredImplementation.id,
      kind: 'registers',
      confidence: 'inferred',
      reason: 'pick_task registers pick_next_task_fair',
      path: schedulerField.path,
      range,
    };
    const schedulerIndex: WorkspaceIndex = {
      ...index,
      nodes: [unrelated, registeredImplementation, schedulerField],
      edges: [registration],
      filesIndexed: 3,
    };

    const result = searchIndex(schedulerIndex, 'schedule', 20);

    expect(result.normalizedQuery).toBe('sched');
    expect(result.candidates.map((candidate) => candidate.nodeId)).toStrictEqual([
      schedulerField.id,
      registeredImplementation.id,
    ]);
    expect(result.candidates[1]?.reasons).toStrictEqual([
      'related via registers: pick_task → pick_next_task_fair',
    ]);
  });

  it('should reserve broad-query results for high-value structural neighbors', () => {
    const schedulerField = node('pick_task', 'kernel/sched/sched.h', 70);
    const registeredImplementation = node('pick_next_task_fair', 'fair.c', 90);
    const noisyDirectMatches = Array.from({ length: 30 }, (_, indexValue) =>
      node(`sched_noise_${indexValue}`, 'kernel/sched/core_sched.c', indexValue + 1),
    );
    const noisyRegistrationSources = Array.from({ length: 10 }, (_, indexValue) =>
      node(`sched_hook_${indexValue}`, 'hooks.h', indexValue + 1),
    );
    const noisyRegistrationTargets = Array.from({ length: 10 }, (_, indexValue) =>
      node(`extension_${indexValue}`, 'ext/internal.h', indexValue + 1),
    );
    const range = createRange(72, 5, 72, 38);
    const registration: CodeEdge = {
      id: createEdgeId(schedulerField.id, 'registers', registeredImplementation.id, range),
      sourceId: schedulerField.id,
      targetId: registeredImplementation.id,
      kind: 'registers',
      confidence: 'inferred',
      reason: 'pick_task registers pick_next_task_fair',
      path: schedulerField.path,
      range,
    };
    const noisyRegistrations: CodeEdge[] = noisyRegistrationSources.map((source, indexValue) => {
      const target = noisyRegistrationTargets[indexValue]!;
      return {
        id: createEdgeId(source.id, 'registers', target.id, range),
        sourceId: source.id,
        targetId: target.id,
        kind: 'registers',
        confidence: 'inferred',
        reason: `${source.name} registers ${target.name}`,
        path: source.path,
        range,
      };
    });
    const noisyIndex: WorkspaceIndex = {
      ...index,
      nodes: [
        ...noisyDirectMatches,
        ...noisyRegistrationSources,
        ...noisyRegistrationTargets,
        schedulerField,
        registeredImplementation,
      ],
      edges: [registration, ...noisyRegistrations],
      filesIndexed: 3,
    };

    const result = searchIndex(noisyIndex, 'schedule', 20);

    expect(result.candidates).toHaveLength(20);
    expect(result.candidates.map((candidate) => candidate.nodeId)).toContain(registeredImplementation.id);
    expect(result.candidates.find((candidate) => candidate.nodeId === registeredImplementation.id)?.reasons).toEqual(
      expect.arrayContaining([expect.stringContaining('related via registers: pick_task')]),
    );
  });
});
