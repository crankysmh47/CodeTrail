import { mkdir, realpath, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { performance } from 'node:perf_hooks';
import process from 'node:process';
import { CodeTrailService } from '../service/codetrail-service.js';
import { resolveBundledParserAssets } from '../service/bundled-parser-assets.js';
import { parseLinuxEvaluationCliOptions } from './linux-evaluation-cli-options.js';
import { evaluatePinnedSource, readGitRevision } from './linux-evaluation.js';

function confinedOutputPath(outputPath: string): string {
  const workingDirectoryPath = resolve(process.cwd());
  const absoluteOutputPath = resolve(workingDirectoryPath, outputPath);
  const relativeOutputPath = relative(workingDirectoryPath, absoluteOutputPath);
  if (relativeOutputPath === '..' || relativeOutputPath.startsWith(`..${sep}`)) {
    throw new Error('Evaluation output must stay inside the current working directory.');
  }
  return absoluteOutputPath;
}

async function canonicalDirectory(path: string, label: string): Promise<string> {
  const canonicalPath = await realpath(path);
  const metadata = await stat(canonicalPath);
  if (!metadata.isDirectory()) {
    throw new Error(`${label} must be a directory.`);
  }
  return canonicalPath;
}

async function measureIndexedBytes(service: CodeTrailService, schedulerRootPath: string): Promise<number> {
  const relativePaths = new Set(
    service
      .getIndex()
      .nodes.map((node) => node.path)
      .filter((path) => extname(path).toLowerCase() === '.c' || extname(path).toLowerCase() === '.h'),
  );
  let bytes = 0;
  for (const relativePath of [...relativePaths].sort((left, right) => left.localeCompare(right))) {
    const sourcePath = resolve(schedulerRootPath, relativePath);
    const confinedPath = relative(schedulerRootPath, sourcePath);
    if (confinedPath === '..' || confinedPath.startsWith(`..${sep}`)) {
      throw new Error('Indexed source path escaped the pinned scheduler scope.');
    }
    bytes += (await stat(sourcePath)).size;
  }
  return bytes;
}

async function main(): Promise<void> {
  const options = parseLinuxEvaluationCliOptions(process.argv.slice(2));
  const outputPath = confinedOutputPath(options.outputPath);
  const repositoryRootPath = await canonicalDirectory(options.workspacePath, 'Linux workspace');
  const revision = await readGitRevision(repositoryRootPath);
  const schedulerRootPath = await canonicalDirectory(join(repositoryRootPath, 'kernel', 'sched'), 'Linux scheduler scope');
  const startedAt = performance.now();
  const service = await CodeTrailService.create({
    rootPath: schedulerRootPath,
    ...resolveBundledParserAssets(__dirname),
  });
  const indexDurationMs = Math.round((performance.now() - startedAt) * 100) / 100;
  try {
    const sourceBytes = await measureIndexedBytes(service, schedulerRootPath);
    const report = evaluatePinnedSource(service, {
      revision,
      scope: 'kernel/sched',
      sourceBytes,
      indexDurationMs,
    });
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    process.stdout.write(`CodeTrail Linux scheduler evidence written to ${outputPath}\n`);
  } finally {
    service.dispose();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'CodeTrail Linux evaluation failed.';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
