# CodeTrail Relationship Discovery and Product Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make CodeTrail discover cross-file links before presenting within-file symbol paths, correct deterministic search, add editor-native symbol shortcuts, and replace the current promotional webview with a minimal VS Code-native inspection surface.

**Architecture:** Keep Tree-sitter extraction, language-neutral contracts, the worker boundary, and the VS Code adapter separate. Add a pure discovery projection over the existing bounded graph, return it through a validated worker protocol, map it into view models in the extension host, and render file links before grouped symbol steps. Search continues to be lexical and explainable, but gains stable deduplication, bounded typo matching, and relationship-intent scoring.

**Tech Stack:** TypeScript 7, Vitest 4, Tree-sitter C WASM, Zod 4, Node worker threads, VS Code Extension API, semantic VS Code CSS variables, esbuild, VSCE.

## Global Constraints

- Runtime must not call Codex, OpenAI, a hosted service, or any network endpoint.
- Source-derived webview content must use `textContent`; never use `innerHTML`.
- Analysis and UI work must remain bounded by the existing file, byte, node, edge, depth, time, queue, and snapshot limits.
- The result remains a static structural reading path, never a runtime execution claim.
- Cross-file links must be backed by typed `CodeEdge` evidence whose endpoints have different paths.
- Search ordering and discovery ordering must be deterministic.
- The UI must work with VS Code light, dark, and high-contrast themes using host theme variables.
- No UI framework, embedding model, telemetry, remote storage, or unrestricted graph is added.
- Every production behavior change starts with a focused failing test.

---

## File Structure

```text
src/
├── analysis/
│   ├── c-adapter.ts                       # Declaration-only C structure extraction
│   ├── c-adapter.test.ts                  # Reference-vs-definition regression
│   ├── indexer.ts                         # Stable node-ID deduplication
│   └── indexer.test.ts                    # Workspace uniqueness regression
├── core/
│   ├── contracts.ts                       # FileLink/FileSection/CodeDiscovery contracts
│   ├── discovery.ts                       # Cross-file projection and file grouping
│   ├── discovery.test.ts                  # Two-level hierarchy behavior
│   ├── search.ts                          # Correct deterministic ranking
│   └── search.test.ts                     # Duplicate, typo, intent, and gold ranking tests
├── extension/
│   ├── commands.ts                        # Persistent question and exact-node discovery commands
│   ├── index-coordinator.ts               # Validated discovery request lifecycle
│   ├── index-coordinator.test.ts          # Discovery request/response behavior
│   ├── symbol-shortcuts.ts                # Pure indexed-function and exact-symbol resolution
│   └── symbol-shortcuts.test.ts           # Editor shortcut behavior
├── shared/
│   ├── messages.ts                        # Discovery view models and host actions
│   └── schemas.ts                         # CodeDiscovery runtime validation
├── webview/
│   ├── main.ts                            # Minimal persistent toolbar and hierarchy outline
│   ├── main.test.ts                       # User-observable webview behavior
│   └── styles.css                         # Native, dense VS Code visual system
└── worker/
    ├── analysis-worker.ts                 # Build CodeDiscovery in worker
    ├── protocol.ts                        # Discover request/response schemas
    └── protocol.test.ts                   # Protocol boundary tests
package.json                               # Command, menu, and keybinding contributions
README.md                                  # Updated workflow and shortcut documentation
demo/runbook.md                            # Revised file-first judge walkthrough
```

---

### Task 1: Correct declarations and deterministic search

**Files:**
- Modify: `src/analysis/c-adapter.test.ts`
- Modify: `src/analysis/c-adapter.ts`
- Modify: `src/analysis/indexer.test.ts`
- Modify: `src/analysis/indexer.ts`
- Modify: `src/core/search.test.ts`
- Modify: `src/core/search.ts`
- Modify: `src/gold.test.ts`

**Interfaces:**
- Consumes: `WorkspaceIndex`, `CodeNode`, and existing typed edges.
- Produces: unchanged `searchIndex(index: WorkspaceIndex, query: string, limit: number): SearchResult`, now with unique stable candidates and relationship-aware reasons.

- [ ] **Step 1: Write the failing declaration and deduplication tests**

Add a C adapter case where `struct task_struct` appears in three function signatures but has no body. Assert that no `struct` declaration node is emitted for those references. Add an indexer case with repeated node IDs and assert that the completed `WorkspaceIndex.nodes` contains each ID once.

```ts
expect(result.nodes.filter((node) => node.kind === 'struct' && node.name === 'task_struct')).toStrictEqual([]);
expect(new Set(index.nodes.map((node) => node.id)).size).toBe(index.nodes.length);
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```powershell
npx vitest run src/analysis/c-adapter.test.ts src/analysis/indexer.test.ts
```

Expected: failures show reference-only structs are emitted and repeated IDs survive indexing.

- [ ] **Step 3: Implement declaration filtering and stable node deduplication**

In `c-adapter.ts`, emit a struct node only when the `struct_specifier` has a body field. In `indexer.ts`, build a `Map<string, CodeNode>` in deterministic analysis order and keep the first authoritative node for each ID.

```ts
const body = node.childForFieldName('body');
if (body) {
  const name = node.childForFieldName('name')?.text ?? '';
  if (name.length > 0) nodes.push(createNode(normalizedPath, 'struct', name, node));
}
```

- [ ] **Step 4: Write failing search correctness tests**

Cover these observable cases:

```ts
it('should return each stable node ID once before applying the limit', () => {
  const duplicateIndex = { ...index, nodes: [pickNextTaskFair, pickNextTaskFair, pickEevdf] };
  expect(searchIndex(duplicateIndex, 'pick next task', 10).candidates.map((item) => item.nodeId))
    .toStrictEqual([pickNextTaskFair.id, pickEevdf.id]);
});

it('should recover a one-edit identifier typo', () => {
  expect(searchIndex(index, 'pick next taks fair', 5).candidates[0]?.nodeId).toBe(pickNextTaskFair.id);
});

it.each([
  ['How does the Linux fair scheduler choose the next task?', 'pick_next_task_fair'],
  ['How does EEVDF decide whether an entity is eligible?', 'entity_eligible'],
  ['How is the fair scheduler registered for dispatch?', 'pick_task'],
])('should rank the gold seed for %s', (query, expectedName) => {
  const result = searchIndex(kernelIndex, query, 8);
  expect(nodesById.get(result.candidates[0]!.nodeId)?.name).toBe(expectedName);
});
```

- [ ] **Step 5: Run search and gold tests and verify RED**

Run:

```powershell
npx vitest run src/core/search.test.ts src/gold.test.ts
```

Expected: duplicate, typo, registration/dispatch intent, and the unimplemented gold cases fail for ranking reasons.

- [ ] **Step 6: Implement bounded fuzzy and relationship-intent ranking**

Use exact aliases for morphology, a one-edit Levenshtein check only for tokens of four or more characters, and incident edge scoring for explicit relationship intent. Score source nodes for `registers` and `dispatches-to` intent, apply a small function-kind tie break, deduplicate by node ID before sorting, and keep every reason human-readable.

```ts
const relationshipIntent: Readonly<Record<string, CodeEdgeKind>> = {
  call: 'calls',
  register: 'registers',
  dispatch: 'dispatches-to',
  read: 'reads',
  write: 'writes',
  guard: 'guarded-by',
};
```

- [ ] **Step 7: Verify Task 1 and commit**

Run:

```powershell
npm run check
npx vitest run src/analysis/c-adapter.test.ts src/analysis/indexer.test.ts src/core/search.test.ts src/gold.test.ts
```

Expected: strict type checking and all focused tests pass.

Commit:

```powershell
git add src/analysis/c-adapter.ts src/analysis/c-adapter.test.ts src/analysis/indexer.ts src/analysis/indexer.test.ts src/core/search.ts src/core/search.test.ts src/gold.test.ts
git commit -m "fix: make CodeTrail search unique and relationship-aware"
```

---

### Task 2: Build the two-level relationship discovery projection

**Files:**
- Modify: `src/core/contracts.ts`
- Create: `src/core/discovery.ts`
- Create: `src/core/discovery.test.ts`
- Modify: `src/shared/schemas.ts`

**Interfaces:**
- Consumes: `buildTrail(index, subgraph, seedId)`, `WorkspaceIndex`, `SubgraphResult`.
- Produces: `buildDiscovery(index: WorkspaceIndex, subgraph: SubgraphResult, seedId: string): CodeDiscovery`.

- [ ] **Step 1: Write the failing cross-file discovery tests**

Create an index with a `sched.h` field registering a `fair.c` function, followed by two same-file call edges. Assert:

```ts
const discovery = buildDiscovery(index, subgraph, pickNext.id);
expect(discovery.fileLinks).toStrictEqual([
  expect.objectContaining({
    sourcePath: 'kernel/sched/sched.h',
    targetPath: 'kernel/sched/fair.c',
    kinds: ['registers'],
    confidence: 'inferred',
    evidenceCount: 1,
  }),
]);
expect(discovery.fileSections.map((section) => section.path)).toStrictEqual([
  'kernel/sched/sched.h',
  'kernel/sched/fair.c',
]);
expect(discovery.trail.steps.map((step) => step.nodeId)).toStrictEqual([
  pickNext.id,
  pickEevdf.id,
  eligible.id,
]);
```

Add cases for collapsed supporting edges, least-certain confidence, a single-file neighborhood, stable ordering, and a missing seed.

- [ ] **Step 2: Run the discovery test and verify RED**

Run:

```powershell
npx vitest run src/core/discovery.test.ts
```

Expected: module or exported function is missing.

- [ ] **Step 3: Add discovery contracts and implementation**

Add `FileLink`, `FileSection`, and `CodeDiscovery` to `contracts.ts`. Implement pure deterministic projection in `discovery.ts`. Group cross-file edges by ordered source/target path, merge kinds without duplicates, count evidence, select the least-certain confidence, preserve the first stable reason, and create file sections from file-link paths followed by trail-only paths.

```ts
export function buildDiscovery(
  index: WorkspaceIndex,
  subgraph: SubgraphResult,
  seedId: string,
): CodeDiscovery {
  const trail = buildTrail(index, subgraph, seedId);
  return {
    trail,
    fileLinks: projectFileLinks(index, subgraph.edges),
    fileSections: groupTrailByFile(index, trail, subgraph.edges),
  };
}
```

- [ ] **Step 4: Add runtime schemas**

Extend `shared/schemas.ts` with schemas for file links, file sections, and discovery. Use exact confidence and edge-kind unions already used by node/edge schemas; do not accept unbounded arbitrary objects.

- [ ] **Step 5: Verify Task 2 and commit**

Run:

```powershell
npm run check
npx vitest run src/core/discovery.test.ts src/core/graph.test.ts src/core/trail.test.ts src/core/contracts.test.ts
```

Expected: all focused tests pass.

Commit:

```powershell
git add src/core/contracts.ts src/core/discovery.ts src/core/discovery.test.ts src/shared/schemas.ts
git commit -m "feat: project cross-file and within-file code links"
```

---

### Task 3: Carry discovery through the worker and extension host

**Files:**
- Modify: `src/worker/protocol.test.ts`
- Modify: `src/worker/protocol.ts`
- Modify: `src/worker/analysis-worker.ts`
- Modify: `src/extension/index-coordinator.test.ts`
- Modify: `src/extension/index-coordinator.ts`
- Modify: `src/shared/messages.ts`
- Modify: `src/extension/commands.ts`

**Interfaces:**
- Consumes: `buildDiscovery`, `CodeDiscovery`.
- Produces: `IndexCoordinator.discover(seedId, budget): Promise<CodeDiscovery>` and a `WebviewState` discovery view.

- [ ] **Step 1: Write failing protocol and coordinator tests**

Add a valid `discover` request and `discovery-result` response to protocol tests. In the fake-worker coordinator test, call `discover`, send a matching response, and assert the exact discovery resolves. Add invalid-response and pending-request-limit coverage.

```ts
const promise = coordinator.discover('seed-id', budget);
worker.emit({ kind: 'discovery-result', requestId: 'discover-1', discovery });
await expect(promise).resolves.toStrictEqual(discovery);
```

- [ ] **Step 2: Run boundary tests and verify RED**

Run:

```powershell
npx vitest run src/worker/protocol.test.ts src/extension/index-coordinator.test.ts
```

Expected: `discover` protocol variant and coordinator method are missing.

- [ ] **Step 3: Implement the worker request path**

Replace the interactive `trail` request with `discover`. The worker builds the bounded subgraph, passes it to `buildDiscovery`, and returns a validated `discovery-result`. The coordinator tracks discovery promises in their own map and rejects them on errors or disposal.

- [ ] **Step 4: Define minimal discovery view models**

Add view models containing only UI-needed fields:

```ts
export type FileLinkView = Readonly<{
  sourcePath: string;
  targetPath: string;
  relationship: string;
  confidence: Confidence;
  reason: string;
  evidenceCount: number;
}>;

export type FileSectionView = Readonly<{
  path: string;
  steps: readonly TrailStepView[];
}>;
```

The discovery state includes the original query or selected symbol label, file links, file sections, warnings, and static disclaimer.

- [ ] **Step 5: Map discovery into the webview state**

Update `commands.ts` so selecting a candidate calls `coordinator.discover`. Hydrate IDs from the current index, preserve edge confidence and direction, and post one discovery state. Add a `new-question` host message that returns to the ready state without reindexing.

- [ ] **Step 6: Verify Task 3 and commit**

Run:

```powershell
npm run check
npx vitest run src/worker/protocol.test.ts src/extension/index-coordinator.test.ts
npm run build
```

Expected: strict types, focused tests, and all bundles pass.

Commit:

```powershell
git add src/worker/protocol.ts src/worker/protocol.test.ts src/worker/analysis-worker.ts src/extension/index-coordinator.ts src/extension/index-coordinator.test.ts src/shared/messages.ts src/extension/commands.ts
git commit -m "feat: deliver hierarchical discovery through the worker"
```

---

### Task 4: Add editor-native symbol shortcuts

**Files:**
- Create: `src/extension/symbol-shortcuts.ts`
- Create: `src/extension/symbol-shortcuts.test.ts`
- Modify: `src/extension/commands.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: stable `WorkspaceIndex` and workspace-relative document paths.
- Produces: `indexedFunctionsForDocument(...)`, `resolveIndexedSymbol(...)`, command `codetrail.discoverNode`, CodeLens, context menu, and shortcut.

- [ ] **Step 1: Write failing pure shortcut tests**

Test exact document matching, Windows path normalization, function-only CodeLens entries, stable line ordering, absent-index behavior, and exact symbol resolution before fuzzy fallback.

```ts
expect(indexedFunctionsForDocument(index, '/linux', '/linux/kernel/sched/fair.c')).toStrictEqual([
  { nodeId: pickEevdf.id, lineStart: 8, lineEnd: 13 },
  { nodeId: pickNext.id, lineStart: 15, lineEnd: 18 },
]);
```

- [ ] **Step 2: Run shortcut tests and verify RED**

Run:

```powershell
npx vitest run src/extension/symbol-shortcuts.test.ts
```

Expected: shortcut module is missing.

- [ ] **Step 3: Implement shortcut resolution**

Keep VS Code-independent path and symbol resolution in `symbol-shortcuts.ts`. Never read files or run parsing from CodeLens.

- [ ] **Step 4: Register CodeLens and exact-node discovery**

Register a `CodeLensProvider` for file-scheme C documents. Each lens calls `codetrail.discoverNode` with the stable node ID. Make `discoverNode(nodeId)` a public command handler that opens the existing panel and discovery state. Refresh lenses when an index completes or restores.

- [ ] **Step 5: Add contributions**

Add:

```json
{
  "command": "codetrail.discoverSymbolLinks",
  "title": "CodeTrail: Discover Symbol Links"
}
```

Contribute it to `editor/context` when `editorLangId == c`, and add `alt+shift+t` with macOS `alt+shift+t`. Retain the existing explain-symbol command as a compatibility alias routed to the same behavior.

- [ ] **Step 6: Verify Task 4 and commit**

Run:

```powershell
npm run check
npx vitest run src/extension/symbol-shortcuts.test.ts src/extension/source-navigation.test.ts
npm run build
```

Expected: all focused checks pass and the extension manifest validates during build.

Commit:

```powershell
git add src/extension/symbol-shortcuts.ts src/extension/symbol-shortcuts.test.ts src/extension/commands.ts package.json
git commit -m "feat: discover CodeTrail links from C definitions"
```

---

### Task 5: Replace the webview with a minimal native hierarchy

**Files:**
- Modify: `src/webview/main.test.ts`
- Modify: `src/webview/main.ts`
- Modify: `src/webview/styles.css`

**Interfaces:**
- Consumes: ready, candidate, discovery, indexing, partial, empty, and error `WebviewState` variants.
- Produces: accessible DOM actions using the existing `HostMessage` boundary.

- [ ] **Step 1: Write failing toolbar and discovery tests**

Assert user-visible behavior rather than CSS implementation details:

```ts
expect(document.querySelector('h1')?.textContent).toBe('CodeTrail');
expect(document.body.textContent).not.toContain('Follow the code that matters');
expect([...document.querySelectorAll('section h2')].map((node) => node.textContent)).toStrictEqual([
  'File route',
  'Within files',
]);
expect(document.body.textContent).toContain('sched.h');
expect(document.body.textContent).toContain('registers');
expect(document.body.textContent).toContain('fair.c');
```

Test persistent question submission from discovery, new-question behavior, first-candidate autofocus, source actions, one-file fallback, visible inferred confidence, and all non-ready states.

- [ ] **Step 2: Run webview tests and verify RED**

Run:

```powershell
npx vitest run src/webview/main.test.ts
```

Expected: the current hero/card UI has no file route, persistent toolbar, or discovery state.

- [ ] **Step 3: Implement the semantic DOM hierarchy**

Split rendering into focused functions:

```ts
renderToolbar(root, state, post);
renderCandidates(root, state, post);
renderFileRoute(root, state.discovery.fileLinks);
renderFileSections(root, state.discovery.fileSections, post);
renderNotice(root, state);
```

Use buttons, headings, ordered lists, details/summary only where collapse behavior is needed, and `textContent` for all source-derived values. The search form remains available on every ready/candidate/discovery state.

- [ ] **Step 4: Implement the minimal VS Code-native visual system**

Use `--vscode-*` variables, 680 px maximum width, native font sizes, square host-like controls, whitespace and one-pixel dividers. Remove hero, eyebrow, large headings, pill badges, card backgrounds, shadows, and marketing copy. Add high-contrast outlines, responsive 320 px behavior, and reduced-motion handling.

- [ ] **Step 5: Verify Task 5 and commit**

Run:

```powershell
npm run check
npx vitest run src/webview/main.test.ts src/extension/trail-panel.test.ts
npm run build
```

Expected: focused tests, type checking, and bundles pass.

Commit:

```powershell
git add src/webview/main.ts src/webview/main.test.ts src/webview/styles.css
git commit -m "feat: present code links in a minimal VS Code hierarchy"
```

---

### Task 6: Gold-path, documentation, packaging, and live VS Code verification

**Files:**
- Modify: `src/gold.test.ts`
- Modify: `README.md`
- Modify: `demo/runbook.md`
- Modify: `docs/architecture.md`
- Modify: `docs/build-with-codex.md`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: complete packaged product.
- Produces: verified `codetrail.vsix`, accurate documentation, and a repeatable judge demonstration.

- [ ] **Step 1: Extend the scheduler gold test**

Assert all three demo questions rank the expected seed and that the primary discovery contains the `sched.h → fair.c` registration link plus the `pick_next_task_fair → pick_eevdf → entity_eligible` within-file trail.

- [ ] **Step 2: Run the gold test and fix only demonstrated integration gaps**

Run:

```powershell
npx vitest run src/gold.test.ts
```

Expected: PASS after Tasks 1–5; any failure identifies a real integration mismatch to correct with another failing test at its owning layer.

- [ ] **Step 3: Update user and submission documentation**

Document the file-first interaction, CodeLens, context command, shortcut, search behavior, exact limitations, and revised three-minute demo. Record the relationship/search/UI polish work truthfully in the Codex build log.

- [ ] **Step 4: Run the clean full gate**

Run:

```powershell
npm ci
npm audit --audit-level=low
npm run check
npm run test:coverage
npm run build
npm run package
```

Expected:

- zero npm audit findings;
- all tests pass;
- strict TypeScript passes;
- extension, worker, and webview bundles succeed;
- `codetrail.vsix` is created.

- [ ] **Step 5: Validate the VSIX payload and bundled worker**

Inspect the archive for required runtime files and reject source, tests, source maps, planning documents, lockfiles, and `node_modules`. Run the real bundled worker against `test-fixtures/kernel-mini`; require two indexed files, unique node IDs, a correct top candidate for all gold questions, a cross-file registration link, and a three-step local trail.

- [ ] **Step 6: Install and exercise the VSIX in VS Code**

Install with:

```powershell
code --install-extension .\codetrail.vsix --force
```

Open `test-fixtures/kernel-mini`, index, ask the primary gold question, verify `File route` appears before `Within files`, click each source action, invoke the CodeLens over `pick_next_task_fair`, invoke `Alt+Shift+T`, and verify the minimal layout at narrow width.

- [ ] **Step 7: Commit the release polish**

```powershell
git add README.md demo/runbook.md docs/architecture.md docs/build-with-codex.md CHANGELOG.md src/gold.test.ts
git commit -m "docs: finalize the CodeTrail relationship discovery release"
```

- [ ] **Step 8: Perform final review and branch completion workflow**

Run `git diff main...HEAD`, `git diff --check`, scan for placeholders and unsafe DOM/process patterns, rerun `npm test`, and use the finishing-development-branch workflow to choose merge, PR, or branch preservation.
