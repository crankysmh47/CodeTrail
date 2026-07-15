import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CodeTrailService } from '../service/codetrail-service.js';
import { resolveDependencyParserAssets } from '../service/parser-assets.js';
import { getReadingPathOutputSchema, searchCodeOutputSchema, workspaceStatusOutputSchema } from './contracts.js';
import { createCodeTrailMcpServer } from './server.js';

const fixtureRootPath = fileURLToPath(new URL('../../test-fixtures/kernel-mini', import.meta.url));
let service: CodeTrailService;

type ConnectedPair = Readonly<{
  client: Client;
  server: McpServer;
}>;

beforeAll(async () => {
  service = await CodeTrailService.create({
    rootPath: fixtureRootPath,
    ...resolveDependencyParserAssets(),
  });
});

afterAll(() => {
  service.dispose();
});

async function connectPair(): Promise<ConnectedPair> {
  const server = createCodeTrailMcpServer(service, '0.1.0');
  const client = new Client({ name: 'codetrail-test-client', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return { client, server };
}

async function closePair(pair: ConnectedPair): Promise<void> {
  await pair.client.close();
  await pair.server.close();
}

describe('CodeTrail MCP server', () => {
  it('should advertise a deliberately narrow read-only surface', async () => {
    const pair = await connectPair();

    const tools = await pair.client.listTools();
    const resources = await pair.client.listResources();

    expect(pair.client.getServerVersion()).toStrictEqual({ name: 'codetrail', version: '0.1.0' });
    expect(pair.client.getInstructions()).toContain('Use search_code first');
    expect(tools.tools.map((tool) => tool.name)).toStrictEqual(['search_code', 'get_symbol', 'get_reading_path']);
    for (const tool of tools.tools) {
      expect(tool.annotations).toStrictEqual(
        expect.objectContaining({
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        }),
      );
    }
    expect(resources.resources.map((resource) => resource.uri)).toStrictEqual(['codetrail://workspace/status']);

    await closePair(pair);
  });

  it('should expose bounded workspace status as a resource', async () => {
    const pair = await connectPair();

    const result = await pair.client.readResource({ uri: 'codetrail://workspace/status' });
    const content = result.contents[0];
    if (!content || !('text' in content)) {
      throw new Error('Expected a text workspace status resource.');
    }
    const status = workspaceStatusOutputSchema.parse(JSON.parse(content.text));

    expect(status.filesIndexed).toBe(2);
    expect(status.tools).toStrictEqual(['search_code', 'get_symbol', 'get_reading_path']);

    await closePair(pair);
  });

  it('should return matching text and structured search output', async () => {
    const pair = await connectPair();

    const result = CallToolResultSchema.parse(
      await pair.client.callTool({ name: 'search_code', arguments: { query: 'schedule', limit: 20 } }),
    );
    const output = searchCodeOutputSchema.parse(result.structuredContent);
    const text = result.content[0];
    if (!text || text.type !== 'text') {
      throw new Error('Expected a text search result.');
    }

    expect(result.isError).not.toBe(true);
    expect(JSON.parse(text.text)).toStrictEqual(output);
    expect(output.candidates.map((candidate) => candidate.name)).toContain('pick_next_task_fair');

    await closePair(pair);
  });

  it('should return a structured reading path with static-analysis evidence', async () => {
    const pair = await connectPair();
    const search = CallToolResultSchema.parse(
      await pair.client.callTool({ name: 'search_code', arguments: { query: 'pick next task fair' } }),
    );
    const searchOutput = searchCodeOutputSchema.parse(search.structuredContent);
    const symbolId = searchOutput.candidates[0]?.symbolId ?? '';

    const result = CallToolResultSchema.parse(
      await pair.client.callTool({ name: 'get_reading_path', arguments: { symbolId } }),
    );
    const output = getReadingPathOutputSchema.parse(result.structuredContent);

    expect(output.trail.map((step) => step.symbol.name).slice(0, 3)).toStrictEqual([
      'pick_next_task_fair',
      'pick_eevdf',
      'entity_eligible',
    ]);
    expect(output.fileRoute[0]).toStrictEqual(
      expect.objectContaining({ sourcePath: 'sched.h', targetPath: 'fair.c', confidence: 'inferred' }),
    );
    expect(output.disclaimer).toBe('Static reading order; not a runtime trace.');

    await closePair(pair);
  });

  it('should return an actionable tool error for an unknown symbol', async () => {
    const pair = await connectPair();

    const result = CallToolResultSchema.parse(
      await pair.client.callTool({
        name: 'get_symbol',
        arguments: { symbolId: 'c:missing.c:function:missing' },
      }),
    );
    const content = result.content[0];

    expect(result.isError).toBe(true);
    expect(content).toStrictEqual(
      expect.objectContaining({ type: 'text', text: expect.stringContaining('Call search_code first') }),
    );

    await closePair(pair);
  });

  it('should reject malformed arguments at the protocol boundary', async () => {
    const pair = await connectPair();

    const result = CallToolResultSchema.parse(
      await pair.client.callTool({
        name: 'search_code',
        arguments: { query: 'x'.repeat(201), limit: 99 },
      }),
    );

    expect(result.isError).toBe(true);
    expect(result.content[0]).toStrictEqual(
      expect.objectContaining({ type: 'text', text: expect.stringMatching(/validation|invalid/i) }),
    );

    await closePair(pair);
  });
});
