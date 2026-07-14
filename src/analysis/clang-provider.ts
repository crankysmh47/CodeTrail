import { execFile } from 'node:child_process';

export type ProcessResult = Readonly<{
  exitCode: number;
  stdout: string;
  stderr: string;
  isTimedOut: boolean;
}>;

export type ProcessRunner = (
  executable: string,
  argumentsValue: readonly string[],
  timeoutMs: number,
) => Promise<ProcessResult>;

export type ClangCapability = Readonly<{
  status: 'available' | 'unavailable';
  version: string;
  reason: string;
}>;

const timeoutMs = 3_000;

const runProcess: ProcessRunner = async (executable, argumentsValue, timeoutMsValue) =>
  new Promise((resolvePromise, rejectPromise) => {
    execFile(
      executable,
      [...argumentsValue],
      { timeout: timeoutMsValue, windowsHide: true },
      (error, stdout, stderr) => {
        if (error && 'killed' in error && error.killed) {
          resolvePromise({
            exitCode: typeof error.code === 'number' ? error.code : 1,
            stdout,
            stderr,
            isTimedOut: true,
          });
          return;
        }
        if (error && error.code === 'ENOENT') {
          rejectPromise(error);
          return;
        }
        resolvePromise({
          exitCode: typeof error?.code === 'number' ? error.code : error ? 1 : 0,
          stdout,
          stderr,
          isTimedOut: false,
        });
      },
    );
  });

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function probeClang(
  executable: string,
  runner: ProcessRunner = runProcess,
): Promise<ClangCapability> {
  try {
    const result = await runner(executable, ['--version'], timeoutMs);
    if (result.isTimedOut) {
      return { status: 'unavailable', version: '', reason: `Clang probe exceeded ${timeoutMs} ms.` };
    }
    if (result.exitCode !== 0) {
      const detail = result.stderr.trim() || `exit code ${result.exitCode}`;
      return { status: 'unavailable', version: '', reason: `Clang probe failed: ${detail}` };
    }
    const firstLine = result.stdout.split(/\r?\n/, 1)[0]?.trim() ?? '';
    const match = /clang version\s+([^\s]+)/i.exec(firstLine);
    if (!match?.[1]) {
      return { status: 'unavailable', version: '', reason: 'Clang probe returned an unrecognized version.' };
    }
    return { status: 'available', version: match[1], reason: `clang version ${match[1]}` };
  } catch (error) {
    return { status: 'unavailable', version: '', reason: `Clang is unavailable: ${errorMessage(error)}` };
  }
}
