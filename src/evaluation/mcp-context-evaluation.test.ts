import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createCodeTrailMcpServer } from '../mcp/server.js';
import { CodeTrailService } from '../service/codetrail-service.js';
import { resolveDependencyParserAssets } from '../service/parser-assets.js';
import { evaluateMcpContext } from './mcp-context-evaluation.js';

const fixtureRootPath = fileURLToPath(new URL('../../test-fixtures/kernel-mini', import.meta.url));
let client: Client;
let server: McpServer;
let service: CodeTrailService;

beforeAll(async () => {
  service = await CodeTrailService.create({ rootPath: fixtureRootPath, ...resolveDependencyParserAssets(), kernelEnrichment: true });
  server = createCodeTrailMcpServer(service, '0.1.0');
  client = new Client({ name: 'codetrail-evaluation-test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
});

afterAll(async () => {
  await client.close();
  await server.close();
  service.dispose();
});

function withoutTiming<T extends { tasks: readonly { durationMs: number }[] }>(result: T): unknown {
  return {
    ...result,
    tasks: result.tasks.map(({ durationMs: _durationMs, ...task }) => task),
  };
}

describe('MCP retrieval-context evaluation', () => {
  it('should prove the expected scheduler answers and evidence through real protocol calls', async () => {
    const first = await evaluateMcpContext(client, fixtureRootPath, 'fixture');
    const second = await evaluateMcpContext(client, fixtureRootPath, 'fixture');

    expect(withoutTiming(second)).toStrictEqual(withoutTiming(first));
    expect(first.benchmarkKind).toBe('retrieval-context');
    expect(first.profile).toBe('fixture');
    expect(first.claimBoundary).toBe(
      'Measures retrieved context and evidence presence; does not measure model intelligence.',
    );
    expect(first.workspace.files).toBe(2);
    expect(first.workspace.bytes).toBeGreaterThan(0);
    expect(first.tasks).toHaveLength(3);
    for (const task of first.tasks) {
      expect(task.protocolCalls).toBe(2);
      expect(task.expectedAnswerPresent).toBe(true);
      expect(task.expectedEvidencePresent, `${task.id}: ${task.observedRelationshipKinds.join(', ')}`).toBe(true);
      expect(task.structuredResponseBytes).toBeGreaterThan(0);
      expect(task.sourceFilesReturned.length).toBeGreaterThan(0);
      expect(task.contextReductionPercent).toBe(
        Math.round((1 - task.structuredResponseBytes / first.workspace.bytes) * 10_000) / 100,
      );
    }
    expect(first.tasks.map((task) => task.expectedSymbolName)).toStrictEqual([
      'pick_next_task_fair',
      'entity_eligible',
      'pick_task',
    ]);
  });
});
