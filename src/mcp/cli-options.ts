export type CliOptions =
  | Readonly<{ mode: 'serve'; workspacePath: string; kernelEnrichment: boolean }>
  | Readonly<{ mode: 'help' }>
  | Readonly<{ mode: 'version' }>;

export const cliUsage = 'Usage: codetrail-mcp --workspace <directory> [--kernel-enrichment] | --help | --version';

function invalidArguments(): never {
  throw new Error(cliUsage);
}

export function parseCliOptions(args: readonly string[]): CliOptions {
  if (args.length === 1 && args[0] === '--help') {
    return { mode: 'help' };
  }
  if (args.length === 1 && args[0] === '--version') {
    return { mode: 'version' };
  }
  const kernelEnrichment = args.includes('--kernel-enrichment');
  const filteredArgs = args.filter((a) => a !== '--kernel-enrichment');

  if (filteredArgs.length !== 2 || filteredArgs[0] !== '--workspace') {
    return invalidArguments();
  }
  const workspacePath = filteredArgs[1];
  if (!workspacePath || workspacePath.includes('\0') || workspacePath.startsWith('--')) {
    return invalidArguments();
  }
  return { mode: 'serve', workspacePath, kernelEnrichment };
}
