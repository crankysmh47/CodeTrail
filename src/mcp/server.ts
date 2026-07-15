import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CodeTrailService } from '../service/codetrail-service.js';
import {
  getReadingPathOutputSchema,
  getSymbolOutputSchema,
  projectReadingPath,
  projectSearchCode,
  projectSymbol,
  projectWorkspaceStatus,
  searchCodeInputSchema,
  searchCodeOutputSchema,
  symbolInputSchema,
} from './contracts.js';

const responseBytesMax = 256 * 1024;
const workspaceStatusUri = 'codetrail://workspace/status';

const readOnlyAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

type StructuredOutput = Readonly<Record<string, unknown>>;

function successfulToolResult(output: StructuredOutput): CallToolResult {
  const text = JSON.stringify(output);
  if (Buffer.byteLength(text, 'utf8') > responseBytesMax) {
    return toolError('CodeTrail stopped because the structured response exceeded its 256 KiB safety limit.');
  }
  return {
    content: [{ type: 'text', text }],
    structuredContent: { ...output },
  };
}

function toolError(message: string): CallToolResult {
  return {
    content: [{ type: 'text', text: message }],
    isError: true,
  };
}

function unknownSymbolError(): CallToolResult {
  return toolError('CodeTrail could not find that symbol in the current index. Call search_code first and use its symbolId.');
}

export function createCodeTrailMcpServer(service: CodeTrailService, version: string): McpServer {
  const server = new McpServer(
    { name: 'codetrail', version },
    {
      instructions:
        'Use search_code first when you do not already have an exact symbolId. Use get_symbol for direct evidence and get_reading_path for the bounded file-first hierarchy. All results are static reading guidance, not runtime traces.',
    },
  );

  server.registerTool(
    'search_code',
    {
      title: 'Search indexed C code',
      description:
        'Find deterministic, ranked C symbols for a keyword or identifier query. Call this first when you do not have an exact CodeTrail symbolId.',
      inputSchema: searchCodeInputSchema,
      outputSchema: searchCodeOutputSchema,
      annotations: readOnlyAnnotations,
    },
    ({ query, limit }) => {
      const fullResult = service.search(query, 20);
      return successfulToolResult({ ...projectSearchCode(service.getIndex(), query, fullResult, limit) });
    },
  );

  server.registerTool(
    'get_symbol',
    {
      title: 'Inspect symbol evidence',
      description:
        'Inspect one exact CodeTrail symbol and at most 40 direct, source-backed relationships with direction and confidence.',
      inputSchema: symbolInputSchema,
      outputSchema: getSymbolOutputSchema,
      annotations: readOnlyAnnotations,
    },
    ({ symbolId }) => {
      if (!service.getSymbol(symbolId)) {
        return unknownSymbolError();
      }
      return successfulToolResult({ ...projectSymbol(service.getIndex(), symbolId) });
    },
  );

  server.registerTool(
    'get_reading_path',
    {
      title: 'Get a bounded static reading path',
      description:
        'Return CodeTrail’s file route and ordered within-file symbol path for one exact symbolId, including confidence, evidence, limits, and warnings.',
      inputSchema: symbolInputSchema,
      outputSchema: getReadingPathOutputSchema,
      annotations: readOnlyAnnotations,
    },
    ({ symbolId }) => {
      if (!service.getSymbol(symbolId)) {
        return unknownSymbolError();
      }
      const discovery = service.discover(symbolId);
      return successfulToolResult({ ...projectReadingPath(service.getIndex(), discovery) });
    },
  );

  server.registerResource(
    'workspace-status',
    workspaceStatusUri,
    {
      title: 'CodeTrail workspace status',
      description: 'Read-only index readiness, scope, warnings, and fixed analysis limits.',
      mimeType: 'application/json',
    },
    (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(projectWorkspaceStatus(service.getIndex())),
        },
      ],
    }),
  );

  return server;
}
