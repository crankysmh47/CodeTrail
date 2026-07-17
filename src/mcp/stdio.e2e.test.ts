import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js';
import { afterEach, describe, expect, it } from 'vitest';
import { getReadingPathOutputSchema, searchCodeOutputSchema, workspaceStatusOutputSchema } from './contracts.js';

const fixtureRootPath = fileURLToPath(new URL('../../test-fixtures/kernel-mini', import.meta.url));
const bundlePath = fileURLToPath(new URL('../../dist/mcp-server.cjs', import.meta.url));
const temporaryRoots: string[] = [];

type ProcessResult = Readonly<{ exitCode: number | null; stdout: string; stderr: string }>;

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((rootPath) => rm(rootPath, { recursive: true, force: true })));
});

async function fixtureWithSpaces(): Promise<string> {
  const parentPath = await mkdtemp(join(tmpdir(), 'codetrail mcp '));
  temporaryRoots.push(parentPath);
  const workspacePath = join(parentPath, 'kernel source');
  await cp(fixtureRootPath, workspacePath, { recursive: true });
  return workspacePath;
}

async function connectSpawnedServer(workspacePath: string): Promise<Readonly<{
  client: Client;
  transport: StdioClientTransport;
  clientErrors: Error[];
  stderr: string[];
}>> {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [bundlePath, '--workspace', workspacePath, '--kernel-enrichment'],
    stderr: 'pipe',
  });
  const stderr: string[] = [];
  transport.stderr?.on('data', (chunk: Buffer) => stderr.push(chunk.toString('utf8')));
  const clientErrors: Error[] = [];
  const client = new Client({ name: 'codetrail-stdio-test', version: '1.0.0' });
  client.onerror = (error) => clientErrors.push(error);
  await client.connect(transport, { timeout: 10_000 });
  return { client, transport, clientErrors, stderr };
}

function runProcess(args: readonly string[]): Promise<ProcessResult> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, [bundlePath, ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      shell: false,
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    const timeout = setTimeout(() => {
      child.kill();
      rejectPromise(new Error('CodeTrail MCP child process exceeded the 10 second test limit.'));
    }, 10_000);
    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
    child.once('error', (error) => {
      clearTimeout(timeout);
      rejectPromise(error);
    });
    child.once('close', (exitCode) => {
      clearTimeout(timeout);
      resolvePromise({
        exitCode,
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
      });
    });
  });
}

describe('CodeTrail MCP stdio bundle', () => {
  it('should complete the judge-facing protocol flow from a path with spaces', async () => {
    const workspacePath = await fixtureWithSpaces();
    const connection = await connectSpawnedServer(workspacePath);

    const tools = await connection.client.listTools();
    const statusResource = await connection.client.readResource({ uri: 'codetrail://workspace/status' });
    const statusContent = statusResource.contents[0];
    if (!statusContent || !('text' in statusContent)) {
      throw new Error('Expected the status resource to contain JSON text.');
    }
    const status = workspaceStatusOutputSchema.parse(JSON.parse(statusContent.text));
    const firstSearch = CallToolResultSchema.parse(
      await connection.client.callTool({ name: 'search_code', arguments: { query: 'schedule', limit: 20 } }),
    );
    const secondSearch = CallToolResultSchema.parse(
      await connection.client.callTool({ name: 'search_code', arguments: { query: 'schedule', limit: 20 } }),
    );
    const search = searchCodeOutputSchema.parse(firstSearch.structuredContent);
    const seed = search.candidates.find((candidate) => candidate.name === 'pick_next_task_fair');
    const readingPathResult = CallToolResultSchema.parse(
      await connection.client.callTool({ name: 'get_reading_path', arguments: { symbolId: seed?.symbolId ?? '' } }),
    );
    const readingPath = getReadingPathOutputSchema.parse(readingPathResult.structuredContent);

    expect(tools.tools.map((tool) => tool.name)).toStrictEqual(['search_code', 'get_symbol', 'get_reading_path']);
    expect(status.filesIndexed).toBe(2);
    expect(secondSearch.structuredContent).toStrictEqual(firstSearch.structuredContent);
    expect(seed?.name).toBe('pick_next_task_fair');
    expect(readingPath.disclaimer).toBe('Static reading order; not a runtime trace.');
    expect(connection.clientErrors).toStrictEqual([]);

    const startedAt = performance.now();
    await connection.client.close();
    expect(performance.now() - startedAt).toBeLessThan(6_000);
    expect(connection.transport.pid).toBe(null);
  }, 20_000);

  it('should fail before protocol startup for an invalid workspace', async () => {
    const missingPath = join(tmpdir(), `codetrail-missing-${process.pid}`);

    const result = await runProcess(['--workspace', missingPath]);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('CodeTrail workspace must be an existing directory.');
    expect(result.stderr).not.toContain('\n    at ');
  });
});
