import { describe, expect, it } from 'vitest';
import {
  createEdgeId,
  createNodeId,
  createRange,
  type CodeDiscovery,
  type CodeEdge,
  type CodeNode,
  type WorkspaceIndex,
} from '../core/contracts.js';
import { toTrailView } from './discovery-view.js';

const field: CodeNode = {
  id: createNodeId('c', 'sched.h', 'field', 'pick_task'),
  language: 'c',
  kind: 'field',
  name: 'pick_task',
  qualifiedName: 'pick_task',
  path: 'sched.h',
  range: createRange(4, 1, 4, 10),
  signature: 'pick_task',
  summary: 'field pick_task',
  tokens: ['pick', 'task'],
};
const pickNext: CodeNode = {
  ...field,
  id: createNodeId('c', 'fair.c', 'function', 'pick_next_task_fair'),
  kind: 'function',
  name: 'pick_next_task_fair',
  qualifiedName: 'pick_next_task_fair',
  path: 'fair.c',
  range: createRange(15, 1, 18, 2),
  signature: 'pick_next_task_fair(struct rq *rq)',
  summary: 'function pick_next_task_fair',
  tokens: ['pick', 'next', 'task', 'fair'],
};
const registrationRange = createRange(20, 1, 20, 20);
const registration: CodeEdge = {
  id: createEdgeId(field.id, 'registers', pickNext.id, registrationRange),
  sourceId: field.id,
  targetId: pickNext.id,
  kind: 'registers',
  confidence: 'inferred',
  reason: 'pick_task registers pick_next_task_fair',
  path: 'fair.c',
  range: registrationRange,
};
const index: WorkspaceIndex = {
  version: 1,
  rootPath: '/workspace',
  createdAtIso: '2026-07-15T00:00:00.000Z',
  nodes: [field, pickNext],
  edges: [registration],
  warnings: [],
  filesIndexed: 2,
  isPartial: false,
};
const discovery: CodeDiscovery = {
  trail: {
    seedId: pickNext.id,
    title: 'Trail from pick_next_task_fair',
    steps: [{ order: 1, nodeId: pickNext.id, incomingEdgeId: '', reason: 'Selected entry point.' }],
    warnings: [],
    disclaimer: 'Static reading order; not a runtime trace.',
  },
  fileLinks: [
    {
      sourcePath: 'sched.h',
      targetPath: 'fair.c',
      kinds: ['registers'],
      confidence: 'inferred',
      reason: registration.reason,
      evidenceCount: 1,
    },
  ],
  fileSections: [
    { path: 'sched.h', steps: [], relatedEdgeIds: [registration.id] },
    { path: 'fair.c', steps: discoveryStep(), relatedEdgeIds: [registration.id] },
  ],
};

function discoveryStep(): CodeDiscovery['trail']['steps'] {
  return [{ order: 1, nodeId: pickNext.id, incomingEdgeId: '', reason: 'Selected entry point.' }];
}

describe('discovery view mapping', () => {
  it('should preserve file links and hydrate grouped symbol steps', () => {
    const view = toTrailView(discovery, index);

    expect(view.fileLinks).toStrictEqual([
      {
        sourcePath: 'sched.h',
        targetPath: 'fair.c',
        relationship: 'registers',
        confidence: 'inferred',
        reason: 'pick_task registers pick_next_task_fair',
        evidenceCount: 1,
        lineStart: 20,
        lineEnd: 20,
      },
    ]);
    expect(view.fileSections.map((section) => [section.path, section.steps.map((step) => step.name)])).toStrictEqual([
      ['sched.h', []],
      ['fair.c', ['pick_next_task_fair']],
    ]);
  });
});
