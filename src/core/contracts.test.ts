import { describe, expect, it } from 'vitest';
import { createNodeId, createRange } from './contracts.js';

describe('core contracts', () => {
  it('should create stable node ids from language, path, kind, and name', () => {
    expect(createNodeId('c', 'kernel/sched/fair.c', 'function', 'pick_next_task_fair')).toBe(
      'c:kernel/sched/fair.c:function:pick_next_task_fair',
    );
  });

  it('should normalize Windows separators in node ids', () => {
    expect(createNodeId('c', 'kernel\\sched\\fair.c', 'function', 'pick_next_task_fair')).toBe(
      'c:kernel/sched/fair.c:function:pick_next_task_fair',
    );
  });

  it('should reject a source range whose end precedes its start', () => {
    expect(() => createRange(9, 4, 8, 1)).toThrowError('Source range end must not precede start');
  });
});
