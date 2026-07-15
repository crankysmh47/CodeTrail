import { describe, expect, it } from 'vitest';
import { parseLinuxEvaluationCliOptions } from './linux-evaluation-cli-options.js';

describe('Linux evaluation CLI options', () => {
  it('should parse a workspace with the default report path', () => {
    expect(parseLinuxEvaluationCliOptions(['--workspace', 'C:\\linux tree'])).toStrictEqual({
      workspacePath: 'C:\\linux tree',
      outputPath: 'demo/linux-scheduler-evaluation.json',
    });
  });

  it('should parse an explicit JSON report path', () => {
    expect(
      parseLinuxEvaluationCliOptions(['--output', 'coverage/linux.json', '--workspace', 'C:\\linux tree']),
    ).toStrictEqual({ workspacePath: 'C:\\linux tree', outputPath: 'coverage/linux.json' });
  });

  it.each([
    [[]],
    [['--workspace']],
    [['--workspace', 'one', '--workspace', 'two']],
    [['--workspace', 'one', '--output', 'report.txt']],
    [['--workspace', 'bad\0path']],
    [['--unknown', 'one']],
  ] as const)('should reject incomplete or unsafe arguments %#', (args) => {
    expect(() => parseLinuxEvaluationCliOptions(args)).toThrow(/Usage: codetrail-linux-evaluation/);
  });
});
