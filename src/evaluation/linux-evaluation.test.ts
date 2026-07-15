import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { CodeTrailService } from '../service/codetrail-service.js';
import { resolveDependencyParserAssets } from '../service/parser-assets.js';
import {
  evaluatePinnedSource,
  pinnedLinuxRevision,
  readGitRevision,
  type SourceEvaluationDefinition,
} from './linux-evaluation.js';

const fixtureRootPath = fileURLToPath(new URL('../../test-fixtures/kernel-mini', import.meta.url));
const temporaryRoots: string[] = [];
let service: CodeTrailService;

const fixtureDefinition: SourceEvaluationDefinition = {
  searches: [
    { query: 'schedule', expectedSymbolName: 'pick_next_task_fair' },
    { query: 'eevdf eligible', expectedSymbolName: 'entity_eligible' },
    { query: 'register dispatch', expectedSymbolName: 'pick_task' },
  ],
  readingPathSeedName: 'pick_next_task_fair',
};

beforeAll(async () => {
  service = await CodeTrailService.create({ rootPath: fixtureRootPath, ...resolveDependencyParserAssets() });
});

afterAll(() => {
  service.dispose();
});

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((rootPath) => rm(rootPath, { recursive: true, force: true })));
});

describe('pinned Linux source evaluation', () => {
  it('should build a bounded evidence report with three expected search results', () => {
    const report = evaluatePinnedSource(
      service,
      {
        revision: pinnedLinuxRevision,
        scope: 'kernel/sched',
        sourceBytes: 1_182,
        indexDurationMs: 12.5,
      },
      fixtureDefinition,
    );

    expect(report.source).toStrictEqual(
      expect.objectContaining({ revision: pinnedLinuxRevision, scope: 'kernel/sched', bytes: 1_182 }),
    );
    expect(report.index).toStrictEqual(
      expect.objectContaining({ files: 2, nodes: expect.any(Number), edges: expect.any(Number), durationMs: 12.5 }),
    );
    expect(report.searches).toHaveLength(3);
    for (const search of report.searches) {
      expect(search.expectedSymbolRank).toBeGreaterThan(0);
      expect(search.candidates[0]).toStrictEqual(
        expect.objectContaining({ score: expect.any(Number), reasons: expect.arrayContaining([expect.any(String)]) }),
      );
    }
    expect(report.readingPath).toStrictEqual(
      expect.objectContaining({
        disclaimer: 'Static reading order; not a runtime trace.',
        trail: expect.arrayContaining([
          expect.objectContaining({
            incomingRelationship: expect.objectContaining({
              confidence: expect.stringMatching(/^(confirmed|inferred|possible)$/),
              evidence: expect.objectContaining({ path: expect.any(String), range: expect.any(Object) }),
            }),
          }),
        ]),
      }),
    );
  });

  it('should reject a revision mismatch and missing expected answer', () => {
    const options = {
      revision: '0000000000000000000000000000000000000000',
      scope: 'kernel/sched' as const,
      sourceBytes: 1_182,
      indexDurationMs: 1,
    };
    expect(() => evaluatePinnedSource(service, options, fixtureDefinition)).toThrow(/pinned Linux revision/i);
    expect(() =>
      evaluatePinnedSource(
        service,
        { ...options, revision: pinnedLinuxRevision },
        { ...fixtureDefinition, searches: [{ query: 'schedule', expectedSymbolName: 'missing_symbol' }] },
      ),
    ).toThrow(/missing_symbol/);
  });

  it('should read detached and loose-ref Git revisions without invoking Git', async () => {
    const detachedRoot = await mkdtemp(join(tmpdir(), 'codetrail-linux-detached-'));
    const branchRoot = await mkdtemp(join(tmpdir(), 'codetrail-linux-branch-'));
    temporaryRoots.push(detachedRoot, branchRoot);
    await mkdir(join(detachedRoot, '.git'));
    await writeFile(join(detachedRoot, '.git', 'HEAD'), `${pinnedLinuxRevision}\n`, 'utf8');
    await mkdir(join(branchRoot, '.git', 'refs', 'heads'), { recursive: true });
    await writeFile(join(branchRoot, '.git', 'HEAD'), 'ref: refs/heads/evidence\n', 'utf8');
    await writeFile(join(branchRoot, '.git', 'refs', 'heads', 'evidence'), `${pinnedLinuxRevision}\n`, 'utf8');

    await expect(readGitRevision(detachedRoot)).resolves.toBe(pinnedLinuxRevision);
    await expect(readGitRevision(branchRoot)).resolves.toBe(pinnedLinuxRevision);
  });
});
