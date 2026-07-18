# CodeTrail v0.1.2 Selective Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a green, minimal `v0.1.2` branch that keeps the useful UX and resilience work without weakening CodeTrail's evidence paths or core boundaries.

**Architecture:** Preserve the original immutable `WorkspaceIndex` and explicit manual indexing flow. Progress and recovery stay at the analysis-worker/coordinator boundary, while relationship construction remains enabled for every C index. The webview keeps a stable search shell and renders the file-first evidence hierarchy.

**Tech Stack:** TypeScript 7, Node.js 24, VS Code Extension API 1.107, Vitest 4, Zod 4, Tree-sitter C, esbuild, `@vscode/vsce`.

## Global Constraints

- CodeTrail is language-extensible and C-first; do not claim general multi-language support.
- Runtime behavior remains local and deterministic with no OpenAI, Codex, hosted inference, telemetry, or network calls.
- Write and observe a failing behavioral test before changing production behavior.
- Preserve provenance, confidence, evidence reasons, bounded operations, visible partial warnings, and the static-trail disclaimer.
- Preserve language-neutral contracts in `src/core`; keep scheduler recovery in `src/analysis/kernel-enricher.ts`.
- Render source-derived text with DOM `textContent` and validate worker/webview/snapshot/configuration boundaries.

---

### Task 1: Restore relationship evidence and compact graph bounds

**Files:**
- Modify: `src/analysis/indexer.test.ts`
- Modify: `src/analysis/indexer.ts`
- Modify: `src/core/contracts.ts`
- Modify: `src/core/graph.test.ts`
- Modify: `src/core/graph.ts`
- Modify: `src/core/search.test.ts`
- Modify: `src/core/search.ts`
- Modify: `src/shared/schemas.ts`
- Modify: `src/worker/protocol.test.ts`
- Modify: `src/worker/protocol.ts`
- Modify: `src/worker/analysis-worker.ts`

**Interfaces:**
- Consumes: `indexWorkspace(IndexWorkspaceInput): Promise<WorkspaceIndex>` and `workerRequestSchema`.
- Produces: an unchanged language-neutral `WorkspaceIndex`, default relationship edges, progress callbacks, and compact graph limits shared by core and protocol.

- [ ] **Step 1: Write failing default-edge and hard-bound tests**

Add this assertion to the normal indexer behavior:

```ts
it('should build source-backed C relationships by default', async () => {
  const rootPath = await fixtureRoot();
  await writeFile(join(rootPath, 'beta.c'), 'int beta(void) { return 1; }');

  const index = await indexWorkspace({
    rootPath,
    parser,
    limits: { filesMax: 20, fileBytesMax: 10_000, totalBytesMax: 20_000 },
    signal: new AbortController().signal,
  });

  expect(index.edges).toContainEqual(expect.objectContaining({ kind: 'calls', confidence: 'confirmed' }));
});
```

Restore the graph rejection expectation to `nodesMax: 101`, and add a protocol assertion that a discovery request with `nodesMax: 101` is rejected.

- [ ] **Step 2: Run narrow tests and verify RED**

Run:

```powershell
npx vitest run src/analysis/indexer.test.ts src/core/graph.test.ts src/worker/protocol.test.ts
```

Expected: the default-edge assertion fails because the index contains zero edges, and the restored 100-node bound assertions fail because the branch currently permits larger budgets.

- [ ] **Step 3: Remove cache/toggle state and restore bounded defaults**

Make `IndexWorkspaceInput` contain only the original inputs plus progress:

```ts
export type IndexWorkspaceInput = Readonly<{
  rootPath: string;
  parser: Parser;
  limits: IndexLimits;
  signal: AbortSignal;
  onProgress?: (progress: { percent: number; message: string }) => void;
}>;
```

Always construct edges:

```ts
const edges = enrichKernelRelationships(analyses);
```

Remove `FileCacheEntry`, `fileCache`, and `kernelEnrichment` from core contracts and schemas. Restore hard maxima to 100 nodes, 200 edges, depth 8, and 1,000 ms in both `graph.ts` and `protocol.ts`. Keep the self-edge adjacency correction and per-file progress callback.

- [ ] **Step 4: Run narrow tests and verify GREEN**

Run the same Vitest command. Expected: all selected files pass.

- [ ] **Step 5: Commit**

```powershell
git add src/analysis/indexer.test.ts src/analysis/indexer.ts src/core/contracts.ts src/core/graph.test.ts src/core/graph.ts src/core/search.test.ts src/core/search.ts src/shared/schemas.ts src/worker/protocol.test.ts src/worker/protocol.ts src/worker/analysis-worker.ts
git commit -m "fix: restore bounded relationship indexing"
```

### Task 2: Keep manual progress and worker recovery only

**Files:**
- Modify: `src/extension/commands.ts`
- Modify: `src/extension/index-coordinator.test.ts`
- Modify: `src/extension/index-coordinator.ts`
- Modify: `src/extension/extension.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `IndexCoordinator.startIndex(input, onProgress?)` and `WorkerLike` factory.
- Produces: explicit manual indexing with progress, compact discovery requests, cleanup-safe disposal, and worker replacement after timeout.

- [ ] **Step 1: Add coordinator progress and recovery coverage**

Add a progress assertion using `FakeWorker.emit`:

```ts
const progress: Array<{ percent: number; message: string }> = [];
const indexing = coordinator.startIndex(input, (value) => progress.push(value));
worker.emit({ kind: 'progress', requestId: worker.sent[0]!.requestId, percent: 50, message: 'Indexing fair.c...' });
expect(progress).toStrictEqual([{ percent: 50, message: 'Indexing fair.c...' }]);
```

Add a fake-timer test whose worker factory returns a replacement after a 10-second search timeout. Assert the pending search rejects with its request ID and the replacement worker accepts a later indexing request.

- [ ] **Step 2: Run the coordinator test**

Run:

```powershell
npx vitest run src/extension/index-coordinator.test.ts
```

Expected: progress coverage passes as characterization of retained behavior; recovery coverage exposes any cleanup or replacement defect before production edits.

- [ ] **Step 3: Remove automatic and incomplete behavior**

Restore the compact command budget:

```ts
const graphBudget = { nodesMax: 40, edgesMax: 80, depthMax: 4, timeMsMax: 100 } as const;
```

Remove open/save listeners, debounce state, background indexing, untyped `currentIndex`, cache propagation, and the `codetrail.kernelEnrichment` setting. Manual `indexWorkspace()` continues to pass its progress callback. Clear coordinator timers and reject pending operations during disposal.

- [ ] **Step 4: Run the coordinator and protocol tests**

Run:

```powershell
npx vitest run src/extension/index-coordinator.test.ts src/worker/protocol.test.ts
```

Expected: all tests pass and the compact command budget is schema-valid.

- [ ] **Step 5: Commit**

```powershell
git add package.json src/extension/commands.ts src/extension/index-coordinator.test.ts src/extension/index-coordinator.ts src/extension/extension.ts
git commit -m "fix: keep indexing explicit and recoverable"
```

### Task 3: Restore the file-first persistent discovery experience

**Files:**
- Modify: `src/extension/discovery-view.test.ts`
- Modify: `src/extension/discovery-view.ts`
- Modify: `src/shared/messages.ts`
- Modify: `src/webview/main.test.ts`
- Modify: `src/webview/main.ts`

**Interfaces:**
- Consumes: `TrailView.fileLinks` with a source-backed range and `renderApp(root, state, post)`.
- Produces: a stable search input, file route before within-file steps, and exact evidence-source navigation.

- [ ] **Step 1: Change the hierarchy expectation and strengthen evidence navigation**

Update the discovery expectation to:

```ts
expect(sectionTitles).toStrictEqual(['File route', 'Within files']);
```

Select the file-link button specifically and assert:

```ts
expect(messages).toContainEqual({
  kind: 'open-source',
  path: 'kernel/sched/sched.h',
  lineStart: 10,
  lineEnd: 12,
});
```

Add a persistent-shell assertion that saves the input element, renders another state into the same root, and checks `root.querySelector('[name="search"]')` is the same object with the same value.

- [ ] **Step 2: Run the webview tests and verify RED**

Run:

```powershell
npx vitest run src/webview/main.test.ts src/extension/discovery-view.test.ts
```

Expected: the hierarchy test fails because the branch currently renders within-file sections first. Persistent shell and evidence-range characterization assertions pass.

- [ ] **Step 3: Render file route first without rebuilding the shell**

Move the existing file-route section ahead of the within-files section. Keep `initShell`, `content.replaceChildren()`, DOM `textContent`, and file-link `Open` behavior unchanged. Remove trailing whitespace while touching the file.

- [ ] **Step 4: Run the webview tests and verify GREEN**

Run the same Vitest command. Expected: all selected tests pass.

- [ ] **Step 5: Commit**

```powershell
git add src/extension/discovery-view.test.ts src/extension/discovery-view.ts src/shared/messages.ts src/webview/main.test.ts src/webview/main.ts
git commit -m "fix: restore file-first evidence navigation"
```

### Task 4: Synchronize compatibility and remove the broken enrichment flag

**Files:**
- Modify: `package-lock.json`
- Modify: `README.md`
- Modify: `src/evaluation/linux-evaluation.test.ts`
- Modify: `src/evaluation/mcp-context-evaluation.test.ts`
- Modify: `src/gold.test.ts`
- Modify: `src/mcp/cli-options.test.ts`
- Modify: `src/mcp/cli-options.ts`
- Modify: `src/mcp/contracts.test.ts`
- Modify: `src/mcp/server.test.ts`
- Modify: `src/mcp/stdio.e2e.test.ts`
- Modify: `src/mcp/stdio.ts`
- Modify: `src/service/codetrail-service.test.ts`
- Modify: `src/service/codetrail-service.ts`

**Interfaces:**
- Consumes: `codetrail-mcp --workspace <directory>` and `CodeTrailService.create(options)`.
- Produces: the original MCP CLI and service behavior, with package metadata consistently targeting VS Code 1.107.

- [ ] **Step 1: Restore the CLI contract test**

Change the expected serve options to:

```ts
{ mode: 'serve', workspacePath: '/linux' }
```

Add an assertion that `--kernel-enrichment` throws the documented usage error.

- [ ] **Step 2: Run the CLI test and verify RED**

Run:

```powershell
npx vitest run src/mcp/cli-options.test.ts
```

Expected: the restored contract fails because the branch currently accepts and returns `kernelEnrichment`.

- [ ] **Step 3: Remove the flag and synchronize dependencies/docs**

Restore the serve type and usage:

```ts
export type CliOptions =
  | Readonly<{ mode: 'serve'; workspacePath: string }>
  | Readonly<{ mode: 'help' }>
  | Readonly<{ mode: 'version' }>;

export const cliUsage = 'Usage: codetrail-mcp --workspace <directory> | --help | --version';
```

Remove `kernelEnrichment` from MCP stdio, service options, and tests. Change README installation compatibility to `VS Code 1.107 or newer`. Run `npm install --package-lock-only` so `package-lock.json` resolves `@types/vscode@1.107.0`.

- [ ] **Step 4: Verify clean installation and focused tests**

Run:

```powershell
npm ci
npx vitest run src/mcp/cli-options.test.ts src/mcp/stdio.e2e.test.ts src/service/codetrail-service.test.ts src/gold.test.ts
```

Expected: dependency installation succeeds and all selected tests pass.

- [ ] **Step 5: Commit**

```powershell
git add README.md package-lock.json src/evaluation src/gold.test.ts src/mcp src/service
git commit -m "fix: synchronize v0.1.2 compatibility"
```

### Task 5: Run the release gate and publish the branch for review

**Files:**
- Verify: all tracked files
- Generated and ignored: `dist/`, `coverage/`, `codetrail.vsix`

**Interfaces:**
- Consumes: repository scripts and GitHub Actions.
- Produces: a clean branch, verified VSIX, pushed commits, and a pull request from `v0.1.2` to `main`.

- [ ] **Step 1: Run the AGENTS.md pre-commit gate**

```powershell
npm run check
npm test
npm run build
```

Expected: exit code 0 and all Vitest tests pass.

- [ ] **Step 2: Run the packaging gate**

```powershell
npm audit --omit=dev --audit-level=high
npm run test:coverage
npm run package
npm run verify:package
npm run test:mcp:e2e
```

Expected: zero production vulnerabilities, coverage succeeds, the VSIX verifies, and MCP E2E passes.

- [ ] **Step 3: Inspect repository scope**

```powershell
git status -sb
git diff main...HEAD --stat
git diff --check
```

Expected: only intended commits differ from `main` and the worktree is clean.

- [ ] **Step 4: Push and open the pull request**

```powershell
git push -u origin v0.1.2
gh pr create --draft --base main --head v0.1.2 --title "Stabilize CodeTrail v0.1.2" --body-file .codetrail-v012-pr-body.md
```

Create `.codetrail-v012-pr-body.md` immediately before the command using `apply_patch`, with retained value, removed incomplete features, test evidence, and the CI root cause fixed by the lockfile update. Delete the temporary file with `apply_patch` immediately after PR creation.

- [ ] **Step 5: Wait for CI and verify both platforms**

Use `gh pr checks <number> --watch` and inspect any failure logs. Expected: Windows and Ubuntu verification jobs complete successfully.
