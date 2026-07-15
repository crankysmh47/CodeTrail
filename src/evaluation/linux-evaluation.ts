import { readFile, stat } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import type { CodeDiscovery, CodeNode, SearchResult, WorkspaceIndex } from '../core/contracts.js';
import { projectReadingPath, projectSearchCode } from '../mcp/contracts.js';
import { serviceGraphBudget, serviceIndexLimits } from '../service/codetrail-service.js';

export const pinnedLinuxRevision = '7059bdf4f04a3e14f4fafb3ac35fdca913e3e21a' as const;
export const pinnedLinuxRepository = 'https://github.com/torvalds/linux.git' as const;

const textFileBytesMax = 1024 * 1024;
const searchResultLimit = 20;
const allowedScopes = new Set(['kernel/sched', 'Documentation/scheduler']);

type EvaluationService = Readonly<{
  getIndex(): WorkspaceIndex;
  getSymbol(symbolId: string): CodeNode | undefined;
  search(query: string, limit: number): SearchResult;
  discover(symbolId: string): CodeDiscovery;
}>;

export type SourceEvaluationDefinition = Readonly<{
  searches: readonly Readonly<{ query: string; expectedSymbolName: string }>[];
  readingPathSeedName: string;
}>;

export type SourceEvaluationOptions = Readonly<{
  revision: string;
  scope: string;
  sourceBytes: number;
  indexDurationMs: number;
}>;

export const linuxSchedulerEvaluationDefinition: SourceEvaluationDefinition = {
  searches: [
    { query: 'schedule', expectedSymbolName: '__schedule' },
    { query: 'eevdf eligible', expectedSymbolName: 'entity_eligible' },
    { query: 'register dispatch', expectedSymbolName: 'pick_task_fair' },
  ],
  readingPathSeedName: '__schedule',
};

function isGitRevision(value: string): boolean {
  return /^[0-9a-f]{40}$/i.test(value);
}

async function readBoundedText(path: string): Promise<string> {
  const metadata = await stat(path);
  if (!metadata.isFile() || metadata.size > textFileBytesMax) {
    throw new Error(`Git metadata file is missing or exceeds ${textFileBytesMax} bytes.`);
  }
  return readFile(path, 'utf8');
}

async function resolveGitDirectory(repositoryRootPath: string): Promise<string> {
  const dotGitPath = join(repositoryRootPath, '.git');
  const metadata = await stat(dotGitPath);
  if (metadata.isDirectory()) {
    return dotGitPath;
  }
  if (!metadata.isFile()) {
    throw new Error('The supplied Linux workspace does not contain readable Git metadata.');
  }
  const match = /^gitdir:\s*(.+)$/im.exec(await readBoundedText(dotGitPath));
  const gitDirectory = match?.[1]?.trim();
  if (!gitDirectory || gitDirectory.includes('\0')) {
    throw new Error('The supplied Linux workspace has invalid Git metadata.');
  }
  return isAbsolute(gitDirectory) ? resolve(gitDirectory) : resolve(dirname(dotGitPath), gitDirectory);
}

async function readPackedReference(gitDirectoryPath: string, reference: string): Promise<string | undefined> {
  let packedReferences: string;
  try {
    packedReferences = await readBoundedText(join(gitDirectoryPath, 'packed-refs'));
  } catch {
    return undefined;
  }
  for (const line of packedReferences.split(/\r?\n/)) {
    if (line.startsWith('#') || line.startsWith('^') || line.trim().length === 0) {
      continue;
    }
    const separatorIndex = line.indexOf(' ');
    if (separatorIndex < 1 || line.slice(separatorIndex + 1).trim() !== reference) {
      continue;
    }
    const revision = line.slice(0, separatorIndex).trim().toLowerCase();
    return isGitRevision(revision) ? revision : undefined;
  }
  return undefined;
}

export async function readGitRevision(repositoryRootPath: string): Promise<string> {
  const gitDirectoryPath = await resolveGitDirectory(repositoryRootPath);
  const head = (await readBoundedText(join(gitDirectoryPath, 'HEAD'))).trim();
  if (isGitRevision(head)) {
    return head.toLowerCase();
  }
  const reference = /^ref:\s*(refs\/[A-Za-z0-9._\/-]+)$/.exec(head)?.[1];
  if (!reference || reference.includes('..')) {
    throw new Error('The supplied Linux workspace has an unsupported Git HEAD value.');
  }
  let revision: string | undefined;
  try {
    const looseReference = (await readBoundedText(join(gitDirectoryPath, ...reference.split('/')))).trim();
    revision = isGitRevision(looseReference) ? looseReference.toLowerCase() : undefined;
  } catch {
    revision = await readPackedReference(gitDirectoryPath, reference);
  }
  if (!revision) {
    throw new Error(`Could not resolve Git reference ${reference}.`);
  }
  return revision;
}

export function evaluatePinnedSource(
  service: EvaluationService,
  options: SourceEvaluationOptions,
  definition: SourceEvaluationDefinition = linuxSchedulerEvaluationDefinition,
) {
  if (options.revision.toLowerCase() !== pinnedLinuxRevision) {
    throw new Error(`Expected pinned Linux revision ${pinnedLinuxRevision}; received ${options.revision}.`);
  }
  if (!allowedScopes.has(options.scope)) {
    throw new Error('Linux evaluation scope must stay under kernel/sched or Documentation/scheduler.');
  }
  if (!Number.isFinite(options.sourceBytes) || options.sourceBytes < 1) {
    throw new Error('Linux evaluation source bytes must be a positive finite number.');
  }
  if (!Number.isFinite(options.indexDurationMs) || options.indexDurationMs < 0) {
    throw new Error('Linux evaluation index duration must be a non-negative finite number.');
  }

  const index = service.getIndex();
  const searches = definition.searches.map((task) => {
    const output = projectSearchCode(index, task.query, service.search(task.query, searchResultLimit), searchResultLimit);
    const expectedSymbolIndex = output.candidates.findIndex((candidate) => candidate.name === task.expectedSymbolName);
    if (expectedSymbolIndex < 0) {
      throw new Error(`Pinned source search "${task.query}" did not return ${task.expectedSymbolName}.`);
    }
    return {
      query: task.query,
      normalizedQuery: output.normalizedQuery,
      expectedSymbolName: task.expectedSymbolName,
      expectedSymbolRank: expectedSymbolIndex + 1,
      candidates: output.candidates,
    };
  });
  const readingPathSeed = [...index.nodes]
    .filter((node) => node.name === definition.readingPathSeedName)
    .sort(
      (left, right) =>
        left.path.localeCompare(right.path) || left.range.lineStart - right.range.lineStart || left.id.localeCompare(right.id),
    )[0];
  if (!readingPathSeed) {
    throw new Error(`Pinned source index did not contain ${definition.readingPathSeedName}.`);
  }
  const projectedReadingPath = projectReadingPath(index, service.discover(readingPathSeed.id));
  if (
    projectedReadingPath.trail.length < 2 ||
    !projectedReadingPath.trail.some((step) => step.incomingRelationship)
  ) {
    throw new Error(`Pinned source path for ${definition.readingPathSeedName} did not contain bounded source evidence.`);
  }
  const readingPath = {
    analysisKind: projectedReadingPath.analysisKind,
    disclaimer: projectedReadingPath.disclaimer,
    seed: projectedReadingPath.seed,
    title: projectedReadingPath.title,
    trail: projectedReadingPath.trail,
    fileRoute: projectedReadingPath.fileRoute.map((link) => ({
      ...link,
      evidenceReturned: Math.min(link.evidence.length, 2),
      evidence: link.evidence.slice(0, 2),
    })),
    withinFiles: projectedReadingPath.withinFiles.map((section) => ({
      path: section.path,
      stepSymbols: section.steps.map((step) => step.symbol.name),
      relationshipCount: section.relationships.length,
    })),
    warnings: projectedReadingPath.warnings,
    truncated: projectedReadingPath.truncated,
  };

  return {
    benchmarkKind: 'pinned-source-validation' as const,
    claimBoundary: 'Static structural evidence only; this report does not measure runtime behavior.' as const,
    source: {
      repository: pinnedLinuxRepository,
      revision: pinnedLinuxRevision,
      scope: options.scope,
      files: index.filesIndexed,
      bytes: options.sourceBytes,
    },
    index: {
      files: index.filesIndexed,
      nodes: index.nodes.length,
      edges: index.edges.length,
      warnings: index.warnings,
      isPartial: index.isPartial,
      durationMs: options.indexDurationMs,
    },
    bounds: {
      searchResultsMax: searchResultLimit,
      graph: serviceGraphBudget,
      index: serviceIndexLimits,
      fileRouteEvidencePerLinkMax: 2,
    },
    searches,
    readingPath,
    limitations: [
      'The analyzer reads source structure without preprocessing every kernel configuration.',
      'Inferred function-pointer relationships are evidence-backed possibilities, not runtime traces.',
      'The benchmark indexes the scheduler subsystem, not the whole Linux repository.',
    ],
  };
}
