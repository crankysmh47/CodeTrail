# CodeTrail Build Week MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a runnable VS Code extension that indexes a bounded GNU C workspace, turns a developer question into a deterministic evidence-backed code trail, and proves the experience on Linux scheduler constructs.

**Architecture:** A Node worker hosts a language-neutral analysis pipeline. A Tree-sitter C adapter produces structural nodes and edges; a kernel-aware enricher recognizes macro registrations, designated initializers, function-pointer dispatch, state relationships, documentation, and configuration guards. Deterministic search, bounded graph traversal, and trail selection feed a minimal vanilla TypeScript webview with source navigation and visible uncertainty.

**Tech Stack:** Node.js 24, TypeScript 7, VS Code Extension API 1.125+, esbuild, Vitest 4, web-tree-sitter 0.26, tree-sitter-wasms 0.1, Zod, gzip JSON snapshots, GitHub Actions.

## Global Constraints

- Runtime must not call Codex, OpenAI, a hosted service, or any network endpoint.
- Build Week positioning is exactly: language-extensible, C-first.
- GNU C structural mode is mandatory; Clang semantics are additive and may be unavailable.
- Linux scheduler is the defining demonstration, not a permanent product boundary.
- Every graph traversal is bounded by explicit node, edge, depth, and time budgets.
- Every visible relationship includes source provenance, confidence, and an explanation.
- Static trails must never be labeled as runtime traces.
- The UI is a vertical trail and evidence panel, not a decorative full graph.
- No new feature starts on Day 7; incomplete features are cut or hidden.
- Production behavior is developed test-first and verified before each commit.
- The testing strategy covers unit, analyzer fixture, gold-path integration, budget, latency, packaging, and manual extension checks.

---

## File Map

```text
.
├── .github/workflows/ci.yml                 # repeatable Windows/Linux verification
├── .vscodeignore                            # extension package exclusions
├── AGENTS.md                                # Codex working agreement
├── CHANGELOG.md                             # Build Week release notes
├── LICENSE                                  # project license
├── README.md                                # installation, demo, limitations
├── demo/
│   ├── kernel-commit.txt                    # immutable upstream demo revision
│   ├── questions.json                      # gold questions and expected symbols
│   └── runbook.md                           # three-minute judge demo
├── docs/
│   ├── architecture.md                     # system and data-flow explanation
│   ├── build-with-codex.md                  # truthful development evidence
│   └── decisions/                           # concise architectural records
├── esbuild.mjs                              # extension and webview bundles
├── package.json                             # extension manifest and scripts
├── src/
│   ├── analysis/
│   │   ├── c-adapter.ts                     # Tree-sitter C structural extraction
│   │   ├── clang-provider.ts                # optional compiler capability probe
│   │   ├── indexer.ts                       # bounded multi-file orchestration
│   │   ├── kernel-enricher.ts               # Linux scheduler relationship recovery
│   │   └── parser-runtime.ts                # WASM parser initialization
│   ├── core/
│   │   ├── contracts.ts                     # language-neutral domain types
│   │   ├── graph.ts                         # graph construction and budgets
│   │   ├── search.ts                        # candidate retrieval and ranking
│   │   └── trail.ts                         # deterministic reading-order selection
│   ├── extension/
│   │   ├── commands.ts                      # index, ask, open-source commands
│   │   ├── extension.ts                     # activate/deactivate entry point
│   │   ├── index-coordinator.ts             # worker and snapshot lifecycle
│   │   ├── snapshot-store.ts                # validated gzip persistence
│   │   └── trail-panel.ts                   # webview host and message validation
│   ├── shared/messages.ts                   # extension/webview protocol schemas
│   ├── webview/
│   │   ├── main.ts                          # render and interaction logic
│   │   └── styles.css                       # compact accessible presentation
│   └── worker/
│       ├── analysis-worker.ts               # worker thread request handler
│       └── protocol.ts                      # worker request/response schemas
├── test-fixtures/
│   └── kernel-mini/                         # synthetic GPL-compatible scheduler fixture
├── tsconfig.json                            # strict production/test type checking
└── vitest.config.ts                         # deterministic unit/integration tests
```

## Task 1: Reproducible Extension Foundation

**Files:**
- Create: `package.json`, `package-lock.json`, `tsconfig.json`, `vitest.config.ts`, `esbuild.mjs`, `.gitignore`, `.vscodeignore`
- Create: `src/core/contracts.ts`, `src/core/contracts.test.ts`

**Interfaces:**
- Produces: `CodeNode`, `CodeEdge`, `SourceRange`, `WorkspaceIndex`, `Trail`, `TrailStep`, and `AnalysisWarning`.
- Produces: scripts `build`, `check`, `test`, `test:coverage`, `package`.

- [ ] **Step 1: Write the domain contract test**

```ts
import { describe, expect, it } from 'vitest';
import { createNodeId, createRange } from './contracts.js';

describe('core contracts', () => {
  it('should create stable node ids from language, path, kind, and name', () => {
    expect(createNodeId('c', 'kernel/sched/fair.c', 'function', 'pick_next_task_fair'))
      .toBe('c:kernel/sched/fair.c:function:pick_next_task_fair');
  });

  it('should reject a source range whose end precedes its start', () => {
    expect(() => createRange(9, 4, 8, 1)).toThrowError('Source range end must not precede start');
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test -- src/core/contracts.test.ts`

Expected: FAIL because `contracts.ts` does not exist.

- [ ] **Step 3: Implement strict language-neutral contracts**

```ts
export type SourceRange = Readonly<{
  lineStart: number;
  columnStart: number;
  lineEnd: number;
  columnEnd: number;
}>;

export type CodeNodeKind = 'file' | 'function' | 'struct' | 'field' | 'macro' | 'variable' | 'documentation';
export type CodeEdgeKind = 'calls' | 'dispatches-to' | 'registers' | 'reads' | 'writes' | 'contains' | 'documents' | 'guarded-by';
export type Confidence = 'confirmed' | 'inferred' | 'possible';

export type CodeNode = Readonly<{
  id: string;
  language: 'c';
  kind: CodeNodeKind;
  name: string;
  qualifiedName: string;
  path: string;
  range: SourceRange;
  signature: string;
  summary: string;
  tokens: readonly string[];
}>;

export type CodeEdge = Readonly<{
  id: string;
  sourceId: string;
  targetId: string;
  kind: CodeEdgeKind;
  confidence: Confidence;
  reason: string;
  path: string;
  range: SourceRange;
}>;

export function createNodeId(language: 'c', path: string, kind: CodeNodeKind, name: string): string {
  return `${language}:${path.replaceAll('\\\\', '/')}:${kind}:${name}`;
}

export function createRange(lineStart: number, columnStart: number, lineEnd: number, columnEnd: number): SourceRange {
  if (lineEnd < lineStart || (lineEnd === lineStart && columnEnd < columnStart)) {
    throw new Error('Source range end must not precede start');
  }
  return { lineStart, columnStart, lineEnd, columnEnd };
}
```

- [ ] **Step 4: Configure strict builds and tests**

Use ESM, `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`, mock cleanup in Vitest, and esbuild outputs `dist/extension.js`, `dist/analysis-worker.js`, and `dist/webview.js`. Copy `tree-sitter.wasm`, `tree-sitter-c.wasm`, and `styles.css` into `dist/` during build.

- [ ] **Step 5: Verify GREEN and baseline build**

Run: `npm run check && npm test && npm run build`

Expected: all commands exit 0 and `dist/` contains the three JavaScript bundles plus two WASM files and CSS.

- [ ] **Step 6: Commit**

```powershell
git add package.json package-lock.json tsconfig.json vitest.config.ts esbuild.mjs .gitignore .vscodeignore src/core
git commit -m "build: scaffold CodeTrail extension"
```

## Task 2: Tree-sitter C Structural Adapter

**Files:**
- Create: `src/analysis/parser-runtime.ts`, `src/analysis/c-adapter.ts`
- Create: `src/analysis/c-adapter.test.ts`
- Create: `test-fixtures/kernel-mini/fair.c`, `test-fixtures/kernel-mini/sched.h`

**Interfaces:**
- Produces: `createCParser(wasmDirectory: string): Promise<Parser>`.
- Produces: `analyzeCFile(input: AnalyzeCFileInput): Promise<FileAnalysis>`.
- `FileAnalysis` contains immutable `nodes`, `unresolvedReferences`, and `warnings` arrays.

- [ ] **Step 1: Write a failing extraction test**

```ts
it('should extract functions, structs, fields, macros, and calls with provenance', async () => {
  const result = await analyzeFixture('kernel-mini/fair.c');
  expect(result.nodes.map((node) => [node.kind, node.name])).toEqual(expect.arrayContaining([
    ['function', 'pick_next_task_fair'],
    ['function', 'pick_eevdf'],
    ['macro', 'DEFINE_SCHED_CLASS'],
  ]));
  expect(result.unresolvedReferences).toContainEqual(expect.objectContaining({
    sourceName: 'pick_next_task_fair',
    targetName: 'pick_eevdf',
    kind: 'calls',
  }));
});
```

- [ ] **Step 2: Verify RED**

Run: `npm test -- src/analysis/c-adapter.test.ts`

Expected: FAIL because the C adapter is missing.

- [ ] **Step 3: Implement parser initialization and structural extraction**

Initialize `web-tree-sitter` once, load the C grammar from the built asset directory, parse UTF-8 text, and walk only named nodes. Extract function definitions, declarations, struct specifiers, field declarations, preprocessor definitions, comments, call expressions, identifiers used in assignments, and `#if`/`#ifdef` guards. Enforce `nodeCountMax: 100_000` and return an `AnalysisWarning` when truncated.

- [ ] **Step 4: Verify GREEN and malformed-file behavior**

Add a test proving a file with a syntax error still returns partial nodes plus a parse warning. Run: `npm run check && npm test -- src/analysis/c-adapter.test.ts`.

Expected: type check exits 0; both extraction and partial-result tests pass.

- [ ] **Step 5: Commit**

```powershell
git add src/analysis test-fixtures/kernel-mini
git commit -m "feat: extract GNU C structure with Tree-sitter"
```

## Task 3: Kernel-Aware Enrichment

**Files:**
- Create: `src/analysis/kernel-enricher.ts`, `src/analysis/kernel-enricher.test.ts`
- Modify: `test-fixtures/kernel-mini/fair.c`, `test-fixtures/kernel-mini/sched.h`

**Interfaces:**
- Produces: `enrichKernelRelationships(analysis: readonly FileAnalysis[]): readonly CodeEdge[]`.
- Consumes: structural nodes and unresolved references from Task 2.

- [ ] **Step 1: Write failing kernel relationship tests**

```ts
it('should recover scheduler registration and function-pointer dispatch', () => {
  const edges = enrichKernelRelationships(fixtureAnalyses);
  expect(edges).toEqual(expect.arrayContaining([
    expect.objectContaining({ kind: 'registers', confidence: 'inferred', reason: expect.stringContaining('.pick_task') }),
    expect.objectContaining({ kind: 'dispatches-to', confidence: 'inferred', reason: expect.stringContaining('sched_class') }),
  ]));
});

it('should preserve configuration guards on inferred edges', () => {
  const edge = enrichKernelRelationships(fixtureAnalyses).find((candidate) => candidate.kind === 'guarded-by');
  expect(edge?.reason).toContain('CONFIG_SMP');
});
```

- [ ] **Step 2: Verify RED**

Run: `npm test -- src/analysis/kernel-enricher.test.ts`

Expected: FAIL because the enricher is missing.

- [ ] **Step 3: Implement the smallest truthful enrichers**

Recognize designated initializer entries such as `.pick_task = pick_task_fair`, scheduler-class definition macros, field access through `sched_class`, and active preprocessor guard ancestry. Produce only evidence-backed edges; unresolved targets remain warnings. Never assign `confirmed` to macro-expanded or pointer-dispatch relationships without compiler evidence.

- [ ] **Step 4: Verify GREEN**

Run: `npm run check && npm test -- src/analysis/kernel-enricher.test.ts`

Expected: all kernel enrichment tests pass with exact confidence and reason strings.

- [ ] **Step 5: Commit**

```powershell
git add src/analysis/kernel-enricher* test-fixtures/kernel-mini
git commit -m "feat: recover Linux scheduler relationships"
```

## Task 4: Deterministic Search and Candidate Reasons

**Files:**
- Create: `src/core/search.ts`, `src/core/search.test.ts`

**Interfaces:**
- Produces: `searchIndex(index: WorkspaceIndex, query: string, limit: number): SearchResult`.
- `SearchResult` includes ordered candidates, component scores, and plain-language match reasons.

- [ ] **Step 1: Write ranking tests**

```ts
it('should rank exact symbol and scheduler vocabulary above incidental comments', () => {
  const result = searchIndex(index, 'How does the fair scheduler choose the next task?', 5);
  expect(result.candidates[0]).toMatchObject({
    nodeId: nodeIds.pickNextTaskFair,
    reasons: expect.arrayContaining(['symbol tokens: pick, next, task, fair']),
  });
});

it('should return an explicit empty result for punctuation-only queries', () => {
  expect(searchIndex(index, '... ???', 5)).toStrictEqual({ normalizedQuery: '', candidates: [] });
});
```

- [ ] **Step 2: Verify RED**

Run: `npm test -- src/core/search.test.ts`

Expected: FAIL because search is missing.

- [ ] **Step 3: Implement transparent lexical ranking**

Normalize camelCase, snake_case, punctuation, and common scheduler synonyms. Score exact symbol phrases, token overlap, signature overlap, path terms, summaries, and adjacent node names. Use stable tie-breaking by normalized path, source line, and node id. Cap candidates at 20.

- [ ] **Step 4: Verify GREEN**

Run: `npm run check && npm test -- src/core/search.test.ts`

Expected: ranking, empty-query, stable-order, and candidate-limit tests pass.

- [ ] **Step 5: Commit**

```powershell
git add src/core/search*
git commit -m "feat: add explainable deterministic search"
```

## Task 5: Bounded Graph and Trail Builder

**Files:**
- Create: `src/core/graph.ts`, `src/core/graph.test.ts`, `src/core/trail.ts`, `src/core/trail.test.ts`

**Interfaces:**
- Produces: `buildBoundedSubgraph(index, seedIds, budget): SubgraphResult`.
- Produces: `buildTrail(index, subgraph, seedId): Trail`.
- Budget defaults: 40 nodes, 80 edges, depth 4, 100 ms; hard maxima: 100 nodes, 200 edges, depth 8, 1,000 ms.

- [ ] **Step 1: Write graph budget tests**

```ts
it('should stop traversal at every configured budget and report truncation', () => {
  const result = buildBoundedSubgraph(cyclicIndex, ['seed'], { nodesMax: 4, edgesMax: 5, depthMax: 2, timeMsMax: 100 });
  expect(result.nodes).toHaveLength(4);
  expect(result.edges.length).toBeLessThanOrEqual(5);
  expect(result.isTruncated).toBe(true);
});
```

- [ ] **Step 2: Verify graph RED, implement bounded breadth-first traversal, then verify GREEN**

Run RED: `npm test -- src/core/graph.test.ts`.

Implementation must use a visited set, bounded queue, edge-kind diversity quotas, deterministic edge order, monotonic elapsed-time checks, and partial results instead of an exception when a user budget is reached.

Run GREEN: `npm test -- src/core/graph.test.ts`.

- [ ] **Step 3: Write trail ordering tests**

```ts
it('should order the trail from entry point through dispatch, implementation, and state', () => {
  const trail = buildTrail(index, schedulerSubgraph, nodeIds.pickNextTaskFair);
  expect(trail.steps.map((step) => step.nodeId)).toStrictEqual([
    nodeIds.pickNextTaskFair,
    nodeIds.pickEevdf,
    nodeIds.eligible,
    nodeIds.vruntime,
  ]);
  expect(trail.disclaimer).toBe('Static reading order; not a runtime trace.');
});
```

- [ ] **Step 4: Verify trail RED, implement, and verify GREEN**

Prioritize seed, direct calls, dispatch targets, registration, state writes/reads, and documentation. De-duplicate nodes, keep one strongest evidence edge between consecutive steps, and cap the default trail at 12 steps.

Run: `npm run check && npm test -- src/core/graph.test.ts src/core/trail.test.ts`.

- [ ] **Step 5: Commit**

```powershell
git add src/core/graph* src/core/trail*
git commit -m "feat: build bounded evidence trails"
```

## Task 6: Workspace Indexing, Optional Clang Probe, and Snapshots

**Files:**
- Create: `src/analysis/indexer.ts`, `src/analysis/indexer.test.ts`, `src/analysis/clang-provider.ts`, `src/analysis/clang-provider.test.ts`
- Create: `src/extension/snapshot-store.ts`, `src/extension/snapshot-store.test.ts`

**Interfaces:**
- Produces: `indexWorkspace(input: IndexWorkspaceInput): Promise<WorkspaceIndex>` with cancellation and progress.
- Produces: `probeClang(executable: string): Promise<ClangCapability>`.
- Produces: `saveSnapshot(path, index)` and `loadSnapshot(path): Promise<SnapshotLoadResult>`.

- [ ] **Step 1: Write failing index boundary tests**

Prove that only `.c` and `.h` files are read, excluded directories are skipped, symlinks are not followed, files over 2 MiB produce warnings, cancellation returns a partial index, and file order is stable.

- [ ] **Step 2: Verify RED and implement the bounded indexer**

Run: `npm test -- src/analysis/indexer.test.ts`.

Use explicit defaults: 2,000 files, 2 MiB per file, 250 MiB total input, and exclusions for `.git`, `.worktrees`, `node_modules`, `dist`, `build`, and `out`. Resolve paths inside the workspace root before reading.

- [ ] **Step 3: Test and implement the Clang capability probe**

Test missing executable, timeout, non-zero exit, and a valid `clang --version` response with a fake process runner. The public result is `{ status: 'available' | 'unavailable'; version: string; reason: string }`; unavailability is never fatal.

- [ ] **Step 4: Test and implement validated gzip snapshots**

Write a snapshot, load it, verify equality, then corrupt its schema version and verify a typed `stale` result. Validate decompressed JSON with Zod before constructing maps. Set compressed and decompressed byte limits.

- [ ] **Step 5: Verify GREEN and commit**

Run: `npm run check && npm test -- src/analysis/indexer.test.ts src/analysis/clang-provider.test.ts src/extension/snapshot-store.test.ts`.

```powershell
git add src/analysis/indexer* src/analysis/clang-provider* src/extension/snapshot-store*
git commit -m "feat: index bounded workspaces and persist snapshots"
```

## Task 7: Worker Protocol and Index Coordinator

**Files:**
- Create: `src/worker/protocol.ts`, `src/worker/analysis-worker.ts`, `src/worker/analysis-worker.test.ts`
- Create: `src/extension/index-coordinator.ts`, `src/extension/index-coordinator.test.ts`

**Interfaces:**
- Worker requests: `index`, `search`, `trail`, `cancel` with unique request ids.
- Worker responses: `progress`, `result`, `error` validated at both boundaries.
- Produces: `IndexCoordinator.startIndex`, `search`, `buildTrail`, `cancel`, `dispose`.

- [ ] **Step 1: Write failing protocol and stale-result tests**

Prove malformed messages are rejected, cancellation is correlated by request id, and an older indexing result cannot replace a newer workspace generation.

- [ ] **Step 2: Verify RED and implement the worker boundary**

Run: `npm test -- src/worker/analysis-worker.test.ts src/extension/index-coordinator.test.ts`.

Use Zod discriminated unions, a maximum of one active index operation, five pending interactive requests, and actionable error messages without file contents.

- [ ] **Step 3: Verify GREEN and commit**

Run: `npm run check && npm test -- src/worker/analysis-worker.test.ts src/extension/index-coordinator.test.ts`.

```powershell
git add src/worker src/extension/index-coordinator*
git commit -m "feat: isolate analysis in a worker thread"
```

## Task 8: VS Code Commands and Complete Webview Experience

**Files:**
- Create: `src/shared/messages.ts`
- Create: `src/extension/commands.ts`, `src/extension/extension.ts`, `src/extension/trail-panel.ts`
- Create: `src/webview/main.ts`, `src/webview/styles.css`
- Create: `src/extension/trail-panel.test.ts`, `src/webview/main.test.ts`
- Modify: `package.json`

**Interfaces:**
- Commands: `codetrail.indexWorkspace`, `codetrail.askQuestion`, `codetrail.explainSymbol`, `codetrail.openSource`.
- View states: `welcome`, `indexing`, `ready`, `candidates`, `trail`, `partial`, `error`.
- Messages are schema-validated and carry no executable HTML.

- [ ] **Step 1: Write failing rendered-state tests**

Test semantic headings, question input, index status, candidate confirmation, numbered trail cards, confidence labels, evidence reasons, source buttons, partial-result warning, keyboard focus, and the static-trail disclaimer.

- [ ] **Step 2: Verify RED and implement the vanilla webview**

Run: `npm test -- src/webview/main.test.ts src/extension/trail-panel.test.ts`.

Build DOM nodes with `textContent`; never interpolate source-derived content into `innerHTML`. Use VS Code theme variables, a single accent color, visible focus styles, reduced-motion support, and responsive widths from 320 px upward.

- [ ] **Step 3: Implement commands and source navigation**

Register all disposables in `context.subscriptions`. Convert one-based source ranges to VS Code zero-based positions, reject paths outside workspace folders, reveal the range, and preserve the current trail when source navigation occurs.

- [ ] **Step 4: Verify GREEN and bundle**

Run: `npm run check && npm test -- src/webview/main.test.ts src/extension/trail-panel.test.ts && npm run build`.

Expected: tests pass and all extension contributions in `package.json` resolve to bundled assets.

- [ ] **Step 5: Commit**

```powershell
git add package.json src/shared src/extension src/webview
git commit -m "feat: deliver the CodeTrail VS Code experience"
```

## Task 9: Linux Scheduler Gold Validation and Performance

**Files:**
- Create: `demo/kernel-commit.txt`, `demo/questions.json`
- Create: `src/gold.test.ts`, `src/performance.test.ts`
- Modify: `test-fixtures/kernel-mini/*`

**Interfaces:**
- Gold question: `How does the Linux fair scheduler choose the next task?`
- Expected trail concepts: fair-class selection, EEVDF picker, eligibility/deadline comparison, scheduler registration/dispatch, and relevant state.

- [ ] **Step 1: Pin the upstream Linux revision**

Run: `git ls-remote https://github.com/torvalds/linux.git refs/heads/master` and write the exact 40-character commit to `demo/kernel-commit.txt`.

- [ ] **Step 2: Write failing gold tests**

Index the synthetic scheduler fixture and prove the primary query ranks `pick_next_task_fair` first, returns a trail containing `pick_eevdf`, includes at least one inferred dispatch/registration edge, and shows the static-trail disclaimer.

- [ ] **Step 3: Verify RED, close analyzer gaps, and verify GREEN**

Run: `npm test -- src/gold.test.ts` before and after the narrow analyzer changes. Do not loosen expected symbols or confidence levels to make the test pass.

- [ ] **Step 4: Add budget and latency tests**

Generate 2,000 small C files in memory, assert graph limits are never exceeded, and assert the interactive search plus trail path completes under 200 ms after indexing on the development machine. Record the machine and Node version in test output.

- [ ] **Step 5: Verify and commit**

Run: `npm run check && npm test -- src/gold.test.ts src/performance.test.ts`.

```powershell
git add demo src/gold.test.ts src/performance.test.ts test-fixtures/kernel-mini
git commit -m "test: validate the Linux scheduler gold trail"
```

## Task 10: Trust, Documentation, CI, and Package

**Files:**
- Create: `AGENTS.md`, `README.md`, `CHANGELOG.md`, `LICENSE`
- Create: `docs/architecture.md`, `docs/build-with-codex.md`, `docs/decisions/0001-c-first-hybrid-analysis.md`, `docs/decisions/0002-static-trail-trust-boundary.md`
- Create: `demo/runbook.md`, `.github/workflows/ci.yml`
- Modify: `.vscodeignore`, `package.json`

**Interfaces:**
- Produces a `.vsix` installable with `code --install-extension`.
- Documents exact limitations, data handling, demo setup, test evidence, and Codex development boundaries.

- [ ] **Step 1: Write truthful product documentation**

README must include the one-sentence promise, 60-second setup, four-command workflow, architecture summary, privacy statement, supported/unsupported matrix, Linux demo steps, troubleshooting, and explicit statements that CodeTrail is static analysis and does not call AI at runtime.

- [ ] **Step 2: Record architecture and Codex evidence**

Document why Tree-sitter WASM is the baseline, why Clang is optional, why kernel enrichers remain adapter-specific, how confidence is assigned, which tests Codex created, which decisions were human-approved, and every known shortcoming from the product spec.

- [ ] **Step 3: Add repeatable CI**

CI runs on Windows and Ubuntu with Node 24: `npm ci`, `npm run check`, `npm test -- --coverage`, `npm run build`, and `npm run package`. Upload the `.vsix` as an artifact only after all commands pass.

- [ ] **Step 4: Verify package contents and install**

Run:

```powershell
npm ci
npm run check
npm test -- --coverage
npm run build
npm run package
npx @vscode/vsce ls --tree
code --install-extension (Get-ChildItem *.vsix | Select-Object -First 1).FullName --force
```

Expected: all commands exit 0; package contains bundles, WASM grammars, CSS, README, changelog, and license; it excludes source maps, tests, fixtures, docs planning files, and the original `.docx`.

- [ ] **Step 5: Run the judge journey manually**

Open `test-fixtures/kernel-mini`, run `CodeTrail: Index Workspace`, ask the gold question, confirm the top candidate, open two trail sources, inspect evidence and uncertainty, reload VS Code, and verify the snapshot restores ready state without reindexing.

- [ ] **Step 6: Commit**

```powershell
git add AGENTS.md README.md CHANGELOG.md LICENSE docs/architecture.md docs/build-with-codex.md docs/decisions demo/runbook.md .github .vscodeignore package.json package-lock.json
git commit -m "docs: prepare CodeTrail Build Week submission"
```

## Final Verification Gate

- [ ] `npm ci` succeeds from a clean dependency directory.
- [ ] `npm run check` reports zero TypeScript errors in production and test files.
- [ ] `npm test -- --coverage` reports zero failures and meaningful core coverage.
- [ ] `npm run build` creates every declared runtime asset.
- [ ] `npm run package` creates an installable `.vsix`.
- [ ] The primary Linux scheduler question produces the expected evidence trail.
- [ ] All graph, file, queue, snapshot, and time budgets are enforced by tests.
- [ ] No runtime source imports an OpenAI or Codex SDK.
- [ ] No source-derived text is injected with `innerHTML`.
- [ ] The original product `.docx` remains unmodified and outside the package.
- [ ] Git status contains only intentional work.
