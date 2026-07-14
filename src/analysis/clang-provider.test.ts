import { describe, expect, it } from 'vitest';
import { probeClang, type ProcessRunner } from './clang-provider.js';

describe('Clang capability probe', () => {
  it('should report a valid Clang version as available', async () => {
    const runner: ProcessRunner = async () => ({
      exitCode: 0,
      stdout: 'clang version 21.1.0\nTarget: x86_64',
      stderr: '',
      isTimedOut: false,
    });

    await expect(probeClang('clang', runner)).resolves.toStrictEqual({
      status: 'available',
      version: '21.1.0',
      reason: 'clang version 21.1.0',
    });
  });

  it('should make a missing compiler non-fatal', async () => {
    const runner: ProcessRunner = async () => {
      throw new Error('spawn clang ENOENT');
    };

    await expect(probeClang('clang', runner)).resolves.toStrictEqual({
      status: 'unavailable',
      version: '',
      reason: 'Clang is unavailable: spawn clang ENOENT',
    });
  });

  it('should report timeout without throwing', async () => {
    const runner: ProcessRunner = async () => ({ exitCode: 1, stdout: '', stderr: '', isTimedOut: true });

    await expect(probeClang('clang', runner)).resolves.toStrictEqual({
      status: 'unavailable',
      version: '',
      reason: 'Clang probe exceeded 3000 ms.',
    });
  });
});
