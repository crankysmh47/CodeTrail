import process from 'node:process';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CodeTrailService } from '../service/codetrail-service.js';
import { resolveBundledParserAssets } from '../service/bundled-parser-assets.js';
import { cliUsage, parseCliOptions } from './cli-options.js';
import { createCodeTrailMcpServer } from './server.js';

declare const __CODETRAIL_VERSION__: string;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'CodeTrail MCP could not start.';
}

async function serve(workspacePath: string, kernelEnrichment?: boolean): Promise<void> {
  const controller = new AbortController();
  const service = await CodeTrailService.create({
    rootPath: workspacePath,
    ...resolveBundledParserAssets(__dirname),
    signal: controller.signal,
    ...(kernelEnrichment !== undefined && { kernelEnrichment }),
  });
  const server = createCodeTrailMcpServer(service, __CODETRAIL_VERSION__);
  let isClosing = false;
  const close = async (): Promise<void> => {
    if (isClosing) {
      return;
    }
    isClosing = true;
    controller.abort();
    await server.close();
    service.dispose();
  };
  process.once('SIGINT', () => void close());
  process.once('SIGTERM', () => void close());
  server.server.onclose = () => service.dispose();

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `CodeTrail MCP ready: ${service.getIndex().filesIndexed} C files indexed. Static reading paths only; not runtime traces.`,
  );
}

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  if (options.mode === 'help') {
    process.stdout.write(`${cliUsage}\n`);
    return;
  }
  if (options.mode === 'version') {
    process.stdout.write(`${__CODETRAIL_VERSION__}\n`);
    return;
  }
  await serve(options.workspacePath, options.kernelEnrichment);
}

void main().catch((error: unknown) => {
  process.stderr.write(`CodeTrail MCP failed: ${errorMessage(error)}\n`);
  process.exitCode = 1;
});
