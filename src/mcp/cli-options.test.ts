import { describe, expect, it } from 'vitest';
import { parseCliOptions } from './cli-options.js';

describe('MCP CLI options', () => {
  it.each([
    [['--workspace', 'C:\\source tree'], { mode: 'serve', workspacePath: 'C:\\source tree', kernelEnrichment: false }],
    [['--workspace', '/linux', '--kernel-enrichment'], { mode: 'serve', workspacePath: '/linux', kernelEnrichment: true }],
    [['--help'], { mode: 'help' }],
    [['--version'], { mode: 'version' }],
  ] as const)('should parse the supported invocation %#', (args, expected) => {
    expect(parseCliOptions(args)).toStrictEqual(expected);
  });

  const invalidArgumentSets: readonly (readonly string[])[] = [
    [],
    ['--workspace'],
    ['--workspace', 'one', '--workspace', 'two'],
    ['--workspace', 'one', '--unknown'],
    ['--workspace', 'bad\0path'],
    ['--help', '--version'],
  ];

  it.each(invalidArgumentSets.map((args) => [args] as const))('should reject unsupported or unsafe arguments %#', (args) => {
    expect(() => parseCliOptions(args)).toThrow(/Usage: codetrail-mcp/);
  });
});
