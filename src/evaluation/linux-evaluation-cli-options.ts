import { extname } from 'node:path';

export type LinuxEvaluationCliOptions = Readonly<{
  workspacePath: string;
  outputPath: string;
}>;

const defaultOutputPath = 'demo/linux-scheduler-evaluation.json';
export const linuxEvaluationCliUsage =
  'Usage: codetrail-linux-evaluation --workspace <linux-checkout> [--output <result.json>]';

function invalidArguments(): never {
  throw new Error(linuxEvaluationCliUsage);
}

export function parseLinuxEvaluationCliOptions(args: readonly string[]): LinuxEvaluationCliOptions {
  if (args.length !== 2 && args.length !== 4) {
    return invalidArguments();
  }
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (
      (flag !== '--workspace' && flag !== '--output') ||
      !value ||
      value.startsWith('--') ||
      value.includes('\0') ||
      values.has(flag)
    ) {
      return invalidArguments();
    }
    values.set(flag, value);
  }
  const workspacePath = values.get('--workspace');
  const outputPath = values.get('--output') ?? defaultOutputPath;
  if (!workspacePath || extname(outputPath).toLowerCase() !== '.json') {
    return invalidArguments();
  }
  return { workspacePath, outputPath };
}
