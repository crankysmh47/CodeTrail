import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import process from 'node:process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { parseEvaluationCliOptions } from './evaluation-cli-options.js';
import { evaluateMcpContext } from './mcp-context-evaluation.js';

function confinedOutputPath(outputPath: string): string {
  const workingDirectoryPath = resolve(process.cwd());
  const absoluteOutputPath = resolve(workingDirectoryPath, outputPath);
  const relativeOutputPath = relative(workingDirectoryPath, absoluteOutputPath);
  if (relativeOutputPath === '..' || relativeOutputPath.startsWith(`..${sep}`)) {
    throw new Error('Evaluation output must stay inside the current working directory.');
  }
  return absoluteOutputPath;
}

async function main(): Promise<void> {
  const options = parseEvaluationCliOptions(process.argv.slice(2));
  const outputPath = confinedOutputPath(options.outputPath);
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [resolve(__dirname, 'mcp-server.cjs'), '--workspace', options.workspacePath],
    stderr: 'inherit',
  });
  const client = new Client({ name: 'codetrail-context-evaluation', version: '1.0.0' });
  try {
    await client.connect(transport, { timeout: 60_000 });
    const result = await evaluateMcpContext(client, options.workspacePath, options.profile);
    if (result.tasks.some((task) => !task.expectedAnswerPresent || !task.expectedEvidencePresent)) {
      throw new Error('The MCP evaluation did not satisfy its expected answer and evidence rubric.');
    }
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
    process.stdout.write(`CodeTrail MCP retrieval-context result written to ${outputPath}\n`);
  } finally {
    await client.close();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'CodeTrail MCP evaluation failed.';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
