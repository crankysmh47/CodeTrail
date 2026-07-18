import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { CodeTrailService } from './codetrail-service.js';

const temporaryRoots: string[] = [];
const fixtureRootPath = fileURLToPath(new URL('../../test-fixtures/kernel-mini', import.meta.url));
const parserWasmPath = fileURLToPath(import.meta.resolve('web-tree-sitter/tree-sitter.wasm'));
const languageWasmPath = fileURLToPath(import.meta.resolve('tree-sitter-wasms/out/tree-sitter-c.wasm'));

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((rootPath) => rm(rootPath, { recursive: true, force: true })));
});

async function createService(rootPath = fixtureRootPath): Promise<CodeTrailService> {
  return CodeTrailService.create({ rootPath, parserWasmPath, languageWasmPath });
}

describe('CodeTrailService', () => {
  it('should expose one immutable index for search, lookup, and discovery', async () => {
    const service = await createService();

    const search = service.search('schedule', 20);
    const seed = search.candidates
      .map((candidate) => service.getSymbol(candidate.nodeId))
      .find((candidate) => candidate?.name === 'pick_next_task_fair');
    const discovery = service.discover(seed?.id ?? '');

    expect(service.getIndex().filesIndexed).toBe(2);
    expect(seed?.name).toBe('pick_next_task_fair');
    expect(discovery.trail.steps.map((step) => service.getSymbol(step.nodeId)?.name).slice(0, 3)).toStrictEqual([
      'pick_next_task_fair',
      'pick_eevdf',
      'entity_eligible',
    ]);
    expect(discovery.trail.disclaimer).toBe('Static reading order; not a runtime trace.');

    service.dispose();
  });

  it('should return deterministic results from the completed index', async () => {
    const service = await createService();

    const first = service.search('eevdf eligible', 8);
    const second = service.search('eevdf eligible', 8);
    const firstDiscovery = service.discover(first.candidates[0]?.nodeId ?? '');
    const secondDiscovery = service.discover(first.candidates[0]?.nodeId ?? '');

    expect(second).toStrictEqual(first);
    expect(secondDiscovery).toStrictEqual(firstDiscovery);

    service.dispose();
  });

  it('should reject an unknown discovery seed with an actionable error', async () => {
    const service = await createService();

    expect(() => service.discover('c:missing.c:function:missing')).toThrow(
      'CodeTrail symbol was not found. Search the current index before requesting a reading path.',
    );

    service.dispose();
  });

  it('should reject a file path because a workspace must be a directory', async () => {
    const rootPath = await mkdtemp(join(tmpdir(), 'codetrail-service-'));
    temporaryRoots.push(rootPath);
    const filePath = join(rootPath, 'not-a-workspace.c');
    await writeFile(filePath, 'int main(void) { return 0; }');

    await expect(createService(filePath)).rejects.toThrow('CodeTrail workspace must be a directory.');
  });

  it('should reject operations after disposal', async () => {
    const service = await createService();
    service.dispose();

    expect(() => service.getIndex()).toThrow('CodeTrail service has been disposed.');
    expect(() => service.search('schedule', 5)).toThrow('CodeTrail service has been disposed.');
  });
});
