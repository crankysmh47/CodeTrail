import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveWorkspaceSource } from './source-navigation.js';

describe('source navigation boundary', () => {
  it('should resolve a workspace-relative source path', () => {
    expect(resolveWorkspaceSource('C:\\linux', 'kernel/sched/fair.c')).toBe(
      resolve('C:\\linux', 'kernel/sched/fair.c'),
    );
  });

  it('should reject a source path that escapes the workspace', () => {
    expect(() => resolveWorkspaceSource('C:\\linux', '../secret.c')).toThrowError(
      'Source path escapes the indexed workspace.',
    );
  });
});
