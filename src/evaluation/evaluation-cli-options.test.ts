import { describe, expect, it } from 'vitest';
import { parseEvaluationCliOptions } from './evaluation-cli-options.js';

describe('MCP evaluation CLI options', () => {
  it('should parse one workspace and one JSON output path', () => {
    expect(
      parseEvaluationCliOptions([
        '--workspace',
        'C:\\linux tree',
        '--output',
        'demo/result.json',
        '--profile',
        'linux-7059',
      ]),
    ).toStrictEqual({ workspacePath: 'C:\\linux tree', outputPath: 'demo/result.json', profile: 'linux-7059' });
  });

  it.each([
    [[]],
    [['--workspace', 'one', '--output', 'result.json']],
    [['--workspace', 'one', '--workspace', 'two', '--output', 'result.json']],
    [['--workspace', 'one', '--output', 'result.txt', '--profile', 'fixture']],
    [['--workspace', 'bad\0path', '--output', 'result.json', '--profile', 'fixture']],
    [['--workspace', 'one', '--output', 'result.json', '--profile', 'unknown']],
  ] as const)('should reject unsafe or incomplete arguments %#', (args) => {
    expect(() => parseEvaluationCliOptions(args)).toThrow(/Usage: codetrail-mcp-evaluation/);
  });
});
