import { extname } from 'node:path';

export type EvaluationProfile = 'fixture' | 'linux-7059';

export type EvaluationCliOptions = Readonly<{
  workspacePath: string;
  outputPath: string;
  profile: EvaluationProfile;
}>;

export const evaluationCliUsage =
  'Usage: codetrail-mcp-evaluation --workspace <directory> --output <result.json> --profile <fixture|linux-7059>';

function invalidArguments(): never {
  throw new Error(evaluationCliUsage);
}

export function parseEvaluationCliOptions(args: readonly string[]): EvaluationCliOptions {
  if (args.length !== 6) {
    return invalidArguments();
  }
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (
      (flag !== '--workspace' && flag !== '--output' && flag !== '--profile') ||
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
  const outputPath = values.get('--output');
  const profile = values.get('--profile');
  if (
    !workspacePath ||
    !outputPath ||
    extname(outputPath).toLowerCase() !== '.json' ||
    (profile !== 'fixture' && profile !== 'linux-7059')
  ) {
    return invalidArguments();
  }
  return { workspacePath, outputPath, profile };
}
