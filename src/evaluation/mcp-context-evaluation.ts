import { readdir, realpath, stat } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js';
import type { CodeEdgeKind } from '../core/contracts.js';
import {
  getReadingPathOutputSchema,
  getSymbolOutputSchema,
  searchCodeOutputSchema,
} from '../mcp/contracts.js';
import { serviceIndexLimits } from '../service/codetrail-service.js';
import type { EvaluationProfile } from './evaluation-cli-options.js';

const directoryCountMax = 20_000;
const sourceExtensions = new Set(['.c', '.h']);
const excludedDirectories = new Set(['.git', '.worktrees', 'build', 'dist', 'node_modules', 'out']);

type EvaluationClient = Pick<Client, 'callTool'>;

type EvaluationTask = Readonly<{
  id: string;
  query: string;
  expectedSymbolName: string;
  followUpTool: 'get_symbol' | 'get_reading_path';
  expectedRelationshipKinds: readonly CodeEdgeKind[];
}>;

const evaluationTasksByProfile: Readonly<Record<EvaluationProfile, readonly EvaluationTask[]>> = {
  fixture: [
    {
      id: 'fair-selection-entry',
      query: 'schedule',
      expectedSymbolName: 'pick_next_task_fair',
      followUpTool: 'get_reading_path',
      expectedRelationshipKinds: ['registers', 'calls'],
    },
    {
      id: 'eevdf-eligibility',
      query: 'eevdf eligible',
      expectedSymbolName: 'entity_eligible',
      followUpTool: 'get_symbol',
      expectedRelationshipKinds: ['calls'],
    },
    {
      id: 'registration-dispatch',
      query: 'register dispatch',
      expectedSymbolName: 'pick_task',
      followUpTool: 'get_reading_path',
      expectedRelationshipKinds: ['registers', 'dispatches-to'],
    },
  ],
  'linux-7059': [
    {
      id: 'scheduler-entry',
      query: 'schedule',
      expectedSymbolName: '__schedule',
      followUpTool: 'get_reading_path',
      expectedRelationshipKinds: ['calls'],
    },
    {
      id: 'eevdf-eligibility',
      query: 'eevdf eligible',
      expectedSymbolName: 'entity_eligible',
      followUpTool: 'get_symbol',
      expectedRelationshipKinds: ['calls'],
    },
    {
      id: 'registration-dispatch',
      query: 'register dispatch',
      expectedSymbolName: 'pick_task_fair',
      followUpTool: 'get_symbol',
      expectedRelationshipKinds: ['registers', 'dispatches-to'],
    },
  ],
};

export type ContextEvaluationTaskResult = Readonly<{
  id: string;
  query: string;
  expectedSymbolName: string;
  expectedSymbolRank: number;
  expectedRelationshipKinds: readonly CodeEdgeKind[];
  observedRelationshipKinds: readonly CodeEdgeKind[];
  expectedAnswerPresent: boolean;
  expectedEvidencePresent: boolean;
  protocolCalls: 2;
  structuredResponseBytes: number;
  contextReductionPercent: number;
  sourceFilesReturned: readonly string[];
  symbolsReturned: number;
  durationMs: number;
}>;

export type ContextEvaluationResult = Readonly<{
  benchmarkKind: 'retrieval-context';
  claimBoundary: 'Measures retrieved context and evidence presence; does not measure model intelligence.';
  profile: EvaluationProfile;
  workspace: Readonly<{ files: number; bytes: number }>;
  tasks: readonly ContextEvaluationTaskResult[];
}>;

async function measureWorkspace(rootPath: string): Promise<Readonly<{ files: number; bytes: number }>> {
  const canonicalRootPath = await realpath(rootPath);
  const pending = [canonicalRootPath];
  let directoryCount = 0;
  let files = 0;
  let bytes = 0;

  while (pending.length > 0 && directoryCount < directoryCountMax && files < serviceIndexLimits.filesMax) {
    const directoryPath = pending.pop();
    if (!directoryPath) {
      break;
    }
    directoryCount += 1;
    const entries = (await readdir(directoryPath, { withFileTypes: true })).sort((left, right) =>
      left.name.localeCompare(right.name),
    );
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const entry = entries[index];
      if (!entry || entry.isSymbolicLink()) {
        continue;
      }
      const entryPath = resolve(directoryPath, entry.name);
      if (entry.isDirectory() && !excludedDirectories.has(entry.name)) {
        pending.push(entryPath);
        continue;
      }
      if (!entry.isFile() || !sourceExtensions.has(extname(entry.name).toLowerCase())) {
        continue;
      }
      const metadata = await stat(entryPath);
      if (metadata.size > serviceIndexLimits.fileBytesMax || bytes + metadata.size > serviceIndexLimits.totalBytesMax) {
        continue;
      }
      files += 1;
      bytes += metadata.size;
      if (files >= serviceIndexLimits.filesMax) {
        break;
      }
    }
  }
  return { files, bytes };
}

function addSearchContext(
  sourcePaths: Set<string>,
  symbolNames: Set<string>,
  output: ReturnType<typeof searchCodeOutputSchema.parse>,
): void {
  for (const candidate of output.candidates) {
    sourcePaths.add(candidate.source.path);
    symbolNames.add(candidate.name);
  }
}

function addSymbolContext(
  sourcePaths: Set<string>,
  symbolNames: Set<string>,
  relationshipKinds: Set<CodeEdgeKind>,
  output: ReturnType<typeof getSymbolOutputSchema.parse>,
): void {
  sourcePaths.add(output.symbol.source.path);
  symbolNames.add(output.symbol.name);
  for (const relationship of output.relationships) {
    sourcePaths.add(relationship.evidence.path);
    sourcePaths.add(relationship.counterpart.source.path);
    symbolNames.add(relationship.counterpart.name);
    relationshipKinds.add(relationship.kind);
  }
}

function addReadingPathContext(
  sourcePaths: Set<string>,
  symbolNames: Set<string>,
  relationshipKinds: Set<CodeEdgeKind>,
  output: ReturnType<typeof getReadingPathOutputSchema.parse>,
): void {
  sourcePaths.add(output.seed.source.path);
  symbolNames.add(output.seed.name);
  for (const step of output.trail) {
    sourcePaths.add(step.symbol.source.path);
    symbolNames.add(step.symbol.name);
    if (step.incomingRelationship) {
      relationshipKinds.add(step.incomingRelationship.kind);
      sourcePaths.add(step.incomingRelationship.evidence.path);
    }
  }
  for (const link of output.fileRoute) {
    sourcePaths.add(link.sourcePath);
    sourcePaths.add(link.targetPath);
    for (const kind of link.kinds) {
      relationshipKinds.add(kind);
    }
    for (const evidence of link.evidence) {
      sourcePaths.add(evidence.path);
    }
  }
  for (const section of output.withinFiles) {
    sourcePaths.add(section.path);
    for (const relationship of section.relationships) {
      relationshipKinds.add(relationship.kind);
      sourcePaths.add(relationship.evidence.path);
      symbolNames.add(relationship.counterpart.name);
    }
  }
}

async function evaluateTask(
  client: EvaluationClient,
  task: EvaluationTask,
  workspaceBytes: number,
): Promise<ContextEvaluationTaskResult> {
  const startedAt = performance.now();
  const searchResult = CallToolResultSchema.parse(
    await client.callTool({ name: 'search_code', arguments: { query: task.query, limit: 20 } }),
  );
  const searchOutput = searchCodeOutputSchema.parse(searchResult.structuredContent);
  const expectedSymbolIndex = searchOutput.candidates.findIndex(
    (candidate) => candidate.name === task.expectedSymbolName,
  );
  const expectedSymbol = searchOutput.candidates[expectedSymbolIndex];
  if (!expectedSymbol) {
    throw new Error(`Evaluation task ${task.id} did not return ${task.expectedSymbolName}.`);
  }
  const followUpResult = CallToolResultSchema.parse(
    await client.callTool({ name: task.followUpTool, arguments: { symbolId: expectedSymbol.symbolId } }),
  );
  if (followUpResult.isError === true) {
    throw new Error(`Evaluation task ${task.id} could not inspect ${task.expectedSymbolName}.`);
  }

  const sourcePaths = new Set<string>();
  const symbolNames = new Set<string>();
  const relationshipKinds = new Set<CodeEdgeKind>();
  addSearchContext(sourcePaths, symbolNames, searchOutput);
  if (task.followUpTool === 'get_symbol') {
    addSymbolContext(sourcePaths, symbolNames, relationshipKinds, getSymbolOutputSchema.parse(followUpResult.structuredContent));
  } else {
    addReadingPathContext(
      sourcePaths,
      symbolNames,
      relationshipKinds,
      getReadingPathOutputSchema.parse(followUpResult.structuredContent),
    );
  }
  const structuredResponseBytes = Buffer.byteLength(
    JSON.stringify(searchResult.structuredContent) + JSON.stringify(followUpResult.structuredContent),
    'utf8',
  );
  return {
    id: task.id,
    query: task.query,
    expectedSymbolName: task.expectedSymbolName,
    expectedSymbolRank: expectedSymbolIndex + 1,
    expectedRelationshipKinds: task.expectedRelationshipKinds,
    observedRelationshipKinds: [...relationshipKinds].sort((left, right) => left.localeCompare(right)),
    expectedAnswerPresent: true,
    expectedEvidencePresent: task.expectedRelationshipKinds.every((kind) => relationshipKinds.has(kind)),
    protocolCalls: 2,
    structuredResponseBytes,
    contextReductionPercent: Math.round((1 - structuredResponseBytes / workspaceBytes) * 10_000) / 100,
    sourceFilesReturned: [...sourcePaths].sort((left, right) => left.localeCompare(right)),
    symbolsReturned: symbolNames.size,
    durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
  };
}

export async function evaluateMcpContext(
  client: EvaluationClient,
  rootPath: string,
  profile: EvaluationProfile,
): Promise<ContextEvaluationResult> {
  const workspace = await measureWorkspace(rootPath);
  if (workspace.bytes < 1) {
    throw new Error('The evaluation workspace contains no bounded C or header source bytes.');
  }
  const tasks: ContextEvaluationTaskResult[] = [];
  for (const task of evaluationTasksByProfile[profile]) {
    tasks.push(await evaluateTask(client, task, workspace.bytes));
  }
  return {
    benchmarkKind: 'retrieval-context',
    claimBoundary: 'Measures retrieved context and evidence presence; does not measure model intelligence.',
    profile,
    workspace,
    tasks,
  };
}
