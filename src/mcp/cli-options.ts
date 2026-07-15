export type CliOptions =
  | Readonly<{ mode: 'serve'; workspacePath: string }>
  | Readonly<{ mode: 'help' }>
  | Readonly<{ mode: 'version' }>;

export const cliUsage = 'Usage: codetrail-mcp --workspace <directory> | --help | --version';

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
  if (args.length !== 2 || args[0] !== '--workspace') {
    return invalidArguments();
  }
  const workspacePath = args[1];
  if (!workspacePath || workspacePath.includes('\0') || workspacePath.startsWith('--')) {
    return invalidArguments();
  }
  return { mode: 'serve', workspacePath };
}
