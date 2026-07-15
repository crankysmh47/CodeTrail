# CodeTrail winner release implementation plan

> Execute this plan inline with behavioral TDD. Keep the VS Code extension primary and the MCP adapter secondary.

**Goal:** Deliver a judge-ready CodeTrail release whose installed VS Code workflow, real Linux proof, and restrained read-only MCP adapter make a credible case across implementation, design, impact, and idea quality.

**Architecture:** Extract a VS Code-independent `CodeTrailService` over the existing parser, index, search, graph, and discovery modules. Both the existing worker and a new stable MCP 1.x stdio server consume the same domain operations. Add deterministic evidence generators for MCP context reduction and a pinned Linux scheduler run, then finish the Marketplace-facing metadata and documentation without adding runtime AI or network behavior.

**Stack:** TypeScript 7, Node.js 24, VS Code Extension API, Tree-sitter C WASM, Zod 4, `@modelcontextprotocol/sdk` 1.29, Vitest 4, esbuild, `vsce`.

**Design specification:** `docs/superpowers/specs/2026-07-15-codetrail-winner-release-design.md`

## Global constraints

- Preserve all source provenance, confidence, and evidence reasons.
- Keep every file walk, payload, queue, graph, time budget, and external process bounded.
- Use “static reading path” or “static reading order,” never “runtime trace” or “execution path.”
- The MCP surface is read-only and local: no prompts, sampling, HTTP listener, shell execution, repository mutation, telemetry, or arbitrary file reads.
- Use the stable `@modelcontextprotocol/sdk@1.29.0`; do not adopt the 2.0 beta during Build Week.
- Write and observe a focused failing test before production behavior.
- After each task run its focused tests, `npm run check`, `npm test`, and `npm run build` before committing.
- Before packaging run audit, coverage, the full build, VSIX packaging, bundle smoke tests, package-content verification, and CI on Windows and Ubuntu.

## Task 1: Create an isolated release workspace

**Files:** none

1. Verify the repository is clean and `.worktrees/` is ignored.

   ```powershell
   git status --short --branch
   git check-ignore .worktrees
   ```

2. Create a release worktree from the current `main`.

   ```powershell
   git worktree add .worktrees/winner-release -b codex/winner-release
   ```

3. Install the exact lockfile and run the baseline.

   ```powershell
   npm ci
   npm run check
   npm test
   npm run build
   ```

Expected baseline: 20 test files and 56 tests pass before implementation.

## Task 2: Add a headless CodeTrail service

**Files:**

- Create: `src/service/codetrail-service.test.ts`
- Create: `src/service/codetrail-service.ts`
- Create: `src/service/parser-assets.ts`
- Modify: `src/worker/analysis-worker.ts`

1. Write failing service tests using `test-fixtures/kernel-mini` and real WASM assets. Cover:

   - canonical workspace indexing with the standard index limits;
   - search result projection that returns domain candidates unchanged;
   - exact symbol lookup;
   - deterministic, fixed-budget discovery;
   - unknown-symbol errors;
   - disposal of the parser when supported;
   - rejection of missing paths and non-directory paths.

2. Run the new test and confirm it fails because the service does not exist.

   ```powershell
   npx vitest run src/service/codetrail-service.test.ts
   ```

3. Implement parser asset resolution and the service.

   ```ts
   export type CodeTrailServiceOptions = Readonly<{
     rootPath: string;
     parserWasmPath: string;
     languageWasmPath: string;
     limits?: Partial<IndexLimits>;
   }>;

   export class CodeTrailService {
     static async create(options: CodeTrailServiceOptions): Promise<CodeTrailService>;
     getIndex(): WorkspaceIndex;
     search(query: string, limit: number): SearchResult;
     getSymbol(symbolId: string): CodeNode | undefined;
     discover(symbolId: string): CodeDiscovery;
     dispose(): void;
   }
   ```

   Defaults:

   ```ts
   const serviceIndexLimits = {
     filesMax: 2_000,
     fileBytesMax: 2_000_000,
     totalBytesMax: 50_000_000,
   } as const;

   const serviceGraphBudget = {
     nodesMax: 40,
     edgesMax: 120,
     depthMax: 4,
     timeMsMax: 1_000,
   } as const;
   ```

4. Refactor the analysis worker only where the service removes duplicated orchestration. Do not change the worker protocol or extension behavior.

5. Run focused and complete verification.

   ```powershell
   npx vitest run src/service/codetrail-service.test.ts src/worker/protocol.test.ts
   npm run check
   npm test
   npm run build
   ```

6. Commit.

   ```powershell
   git add src/service src/worker/analysis-worker.ts
   git commit -m "refactor: expose the CodeTrail analysis service"
   ```

## Task 3: Define bounded MCP projections and schemas

**Files:**

- Create: `src/mcp/contracts.test.ts`
- Create: `src/mcp/contracts.ts`

1. Write failing tests for the three input schemas and all output projections. Cover:

   - `search_code` query trimming, 200-character maximum, limit default, and 1–20 bound;
   - `get_symbol` and `get_reading_path` ID trimming and 500-character maximum;
   - candidate fields and deterministic ordering;
   - incident relationship cap of 40 and stable ordering;
   - evidence path/range, direction, kind, confidence, and reason on every relationship;
   - discovery projection with file links, file sections, warnings, confidence, and the exact static-analysis disclaimer;
   - status projection with no source text, environment data, Git remote, or credential-shaped property;
   - response byte cap behavior and visible truncation.

2. Confirm the test fails.

   ```powershell
   npx vitest run src/mcp/contracts.test.ts
   ```

3. Implement Zod input and output schemas plus pure projection functions. Use type aliases for structured MCP outputs, not interfaces, so they remain compatible with `structuredContent`.

   ```ts
   export const searchCodeInputSchema = z.object({
     query: z.string().trim().min(1).max(200),
     limit: z.number().int().min(1).max(20).default(10),
   });

   export const symbolInputSchema = z.object({
     symbolId: z.string().trim().min(1).max(500),
   });
   ```

4. Use one shared metadata object in relationship-facing outputs.

   ```ts
   const staticAnalysisMetadata = {
     analysisKind: 'static-reading-path',
     disclaimer: 'Static reading order; not a runtime trace.',
   } as const;
   ```

5. Verify and commit.

   ```powershell
   npx vitest run src/mcp/contracts.test.ts
   npm run check
   npm test
   npm run build
   git add src/mcp/contracts.ts src/mcp/contracts.test.ts
   git commit -m "feat: define bounded MCP contracts"
   ```

## Task 4: Implement the read-only MCP server

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/mcp/server.test.ts`
- Create: `src/mcp/server.ts`

1. Add the stable SDK.

   ```powershell
   npm install @modelcontextprotocol/sdk@1.29.0 --save-exact
   ```

2. Write an in-process integration test using the SDK `Client` and linked `InMemoryTransport` pair. The test must initialize the actual server and assert:

   - server name, version, and instructions;
   - exactly `search_code`, `get_symbol`, and `get_reading_path` in `tools/list`;
   - every tool is annotated read-only, non-destructive, and idempotent;
   - exactly `codetrail://workspace/status` in `resources/list`;
   - the status resource reads as JSON;
   - all three valid tool calls return matching text JSON and `structuredContent`;
   - malformed arguments are rejected by the protocol boundary;
   - an unknown symbol returns `isError: true` and directs the client to `search_code`;
   - server closure completes.

3. Confirm the test fails before server implementation.

   ```powershell
   npx vitest run src/mcp/server.test.ts
   ```

4. Implement a factory that accepts a `CodeTrailService` and registers only the approved surface.

   ```ts
   export function createCodeTrailMcpServer(
     service: CodeTrailService,
     version: string,
   ): McpServer;
   ```

5. For each tool:

   - provide a concise description that tells an agent when to use it;
   - define input and output schemas;
   - set read-only annotations;
   - return compact JSON in `content` and the same object in `structuredContent`;
   - catch expected lookup errors and return correction-oriented `isError` results;
   - do not log source data.

6. Verify and commit.

   ```powershell
   npx vitest run src/mcp/server.test.ts src/mcp/contracts.test.ts
   npm run check
   npm test
   npm run build
   git add package.json package-lock.json src/mcp
   git commit -m "feat: expose CodeTrail through read-only MCP"
   ```

## Task 5: Add the stdio CLI and true end-to-end test

**Files:**

- Modify: `package.json`
- Modify: `esbuild.mjs`
- Modify: `tsconfig.json`
- Create: `src/mcp/cli-options.test.ts`
- Create: `src/mcp/cli-options.ts`
- Create: `src/mcp/stdio.ts`
- Create: `src/mcp/stdio.e2e.test.ts`

1. Write failing CLI option tests. Accept exactly:

   ```text
   codetrail-mcp --workspace <path>
   codetrail-mcp --help
   codetrail-mcp --version
   ```

   Reject missing values, duplicate workspace flags, unknown flags, and NUL-containing paths. Do not accept limits or arbitrary source-file paths.

2. Write a spawned stdio integration test using `StdioClientTransport` against `dist/mcp-server.cjs`. Assert:

   - the build bundle starts on a workspace path containing spaces;
   - initialization succeeds with no non-protocol output on stdout;
   - tools and the status resource are discoverable;
   - `schedule` returns `pick_next_task_fair` among the structured candidates;
   - a reading path contains the exact disclaimer;
   - repeated calls return identical data after removing the index creation time;
   - `client.close()` terminates the child within a bounded timeout;
   - an invalid workspace exits non-zero and writes a concise diagnostic to stderr.

3. Confirm focused tests fail.

   ```powershell
   npx vitest run src/mcp/cli-options.test.ts src/mcp/stdio.e2e.test.ts
   ```

4. Add the server bundle to `esbuild.mjs`, including the parser WASM assets already copied into `dist`.

   ```js
   esbuild.build({
     entryPoints: ['src/mcp/stdio.ts'],
     bundle: true,
     format: 'cjs',
     platform: 'node',
     target: 'node20',
     outfile: `${outdir}/mcp-server.cjs`,
     sourcemap: true,
   })
   ```

5. Add package entry and scripts.

   ```json
   {
     "bin": { "codetrail-mcp": "./dist/mcp-server.cjs" },
     "scripts": {
       "mcp": "node dist/mcp-server.cjs",
       "test:mcp:e2e": "npm run build && vitest run src/mcp/stdio.e2e.test.ts"
     }
   }
   ```

6. Implement canonical path validation, parser asset paths relative to the bundle, one-time index startup, stdio connection, stderr-only diagnostics, and bounded `SIGINT`/`SIGTERM` shutdown.

7. Verify and commit.

   ```powershell
   npm run build
   npx vitest run src/mcp/cli-options.test.ts src/mcp/stdio.e2e.test.ts
   npm run check
   npm test
   git add package.json package-lock.json esbuild.mjs tsconfig.json src/mcp
   git commit -m "feat: add the local CodeTrail MCP server"
   ```

## Task 6: Add a reproducible MCP context benchmark

**Files:**

- Create: `src/evaluation/mcp-context-evaluation.test.ts`
- Create: `src/evaluation/mcp-context-evaluation.ts`
- Create: `scripts/run-mcp-evaluation.mjs`
- Create: `demo/mcp-evaluation.md`
- Generate: `demo/mcp-evaluation-results.json`
- Modify: `package.json`
- Modify: `tsconfig.json`

1. Write a failing evaluation test around the kernel-mini fixture. Define the three tasks and require:

   - expected symbol ID in search results;
   - expected relationship kind and source/target evidence in symbol or reading-path output;
   - two or fewer protocol tool calls per task after index readiness;
   - positive structured response byte count;
   - raw workspace bytes greater than returned structured bytes;
   - a mathematically correct context reduction percentage;
   - stable output after removing generated timestamp and timing.

2. Confirm it fails.

   ```powershell
   npx vitest run src/evaluation/mcp-context-evaluation.test.ts
   ```

3. Implement an evaluation function that consumes an MCP client-shaped interface. Keep metrics honest:

   ```ts
   export type ContextEvaluationResult = Readonly<{
     benchmarkKind: 'retrieval-context';
     claimBoundary: 'Measures retrieved context and evidence presence; does not measure model intelligence.';
     workspace: Readonly<{ files: number; bytes: number }>;
     tasks: readonly ContextEvaluationTaskResult[];
   }>;
   ```

4. Make the script spawn the real built stdio server, run all tasks, and write deterministic formatted JSON. Add:

   ```json
   "evaluate:mcp": "npm run build && node scripts/run-mcp-evaluation.mjs"
   ```

5. Write `demo/mcp-evaluation.md` with the claim boundary, task rubric, metric definitions, exact command, and result interpretation. Do not call it an LLM benchmark or claim improved answer accuracy beyond the asserted evidence rubric.

6. Run the generator twice and compare committed output.

   ```powershell
   npm run evaluate:mcp
   Copy-Item demo/mcp-evaluation-results.json $env:TEMP/codetrail-mcp-eval.json
   npm run evaluate:mcp
   Compare-Object (Get-Content demo/mcp-evaluation-results.json) (Get-Content $env:TEMP/codetrail-mcp-eval.json)
   ```

7. Verify and commit.

   ```powershell
   npx vitest run src/evaluation/mcp-context-evaluation.test.ts src/mcp/stdio.e2e.test.ts
   npm run check
   npm test
   npm run build
   git add src/evaluation scripts demo/mcp-evaluation.md demo/mcp-evaluation-results.json package.json tsconfig.json
   git commit -m "test: measure MCP retrieval context"
   ```

## Task 7: Generate pinned real Linux scheduler evidence

**Files:**

- Create: `src/evaluation/linux-evaluation.test.ts`
- Create: `src/evaluation/linux-evaluation.ts`
- Create: `scripts/run-linux-evaluation.mjs`
- Generate: `demo/linux-scheduler-evaluation.json`
- Create: `demo/linux-scheduler-evaluation.md`
- Modify: `package.json`
- Modify: `.gitignore`

1. Add `.cache/` to `.gitignore`. The upstream Linux checkout is development evidence, not a packaged source dependency.

2. Write a failing unit test for the report builder. It must validate:

   - requested Git revision equals `7059bdf4f04a3e14f4fafb3ac35fdca913e3e21a`;
   - included paths stay under `kernel/sched` or `Documentation/scheduler`;
   - index counts, byte counts, warnings, partial state, and duration are present;
   - all three search outputs retain score reasons;
   - the selected path contains evidence, confidence, bounds, and disclaimer;
   - any missing expected result fails generation rather than producing a flattering report.

3. Implement a script that accepts a user-supplied sparse checkout:

   ```text
   node scripts/run-linux-evaluation.mjs --workspace C:\path\to\linux
   ```

   The script must read `.git/HEAD` and packed refs without invoking Git, validate the pinned revision, index only the supplied scheduler scope, and emit JSON. It must not fetch source or modify the Linux checkout.

4. Create the pinned sparse checkout in `.cache/linux-scheduler` using the documented upstream commands. This is a development-only network operation, not product runtime behavior.

5. Generate the evidence artifact, inspect every warning and expected result, and rerun it for determinism with timing normalized.

6. Write the companion Markdown report with machine context, exact source scope, result summary, known limitations, and reproduction instructions.

7. Verify and commit only scripts, tests, reports, and generated JSON—not Linux source.

   ```powershell
   npx vitest run src/evaluation/linux-evaluation.test.ts
   npm run check
   npm test
   npm run build
   git add .gitignore package.json src/evaluation scripts demo/linux-scheduler-evaluation.*
   git commit -m "test: prove CodeTrail on upstream Linux scheduler"
   ```

## Task 8: Finish Marketplace identity and trust metadata

**Files:**

- Modify: `package.json`
- Create: `media/icon.png`
- Create: `media/hero.png`
- Create: `SUPPORT.md`
- Create: `SECURITY.md`
- Create: `PRIVACY.md`
- Modify: `CHANGELOG.md`
- Modify: `.vscodeignore`

1. Use a durable Marketplace publisher ID. If the owner has not supplied one, keep publication itself explicitly blocked and use the agreed durable project ID only after confirming it is available.

2. Add manifest metadata:

   ```json
   {
     "repository": { "type": "git", "url": "https://github.com/crankysmh47/CodeTrail.git" },
     "homepage": "https://github.com/crankysmh47/CodeTrail#readme",
     "bugs": { "url": "https://github.com/crankysmh47/CodeTrail/issues" },
     "author": { "name": "CodeTrail contributors" },
     "icon": "media/icon.png",
     "keywords": ["C", "Linux kernel", "code navigation", "call graph", "static analysis", "MCP"],
     "galleryBanner": { "color": "#101418", "theme": "dark" },
     "pricing": "Free",
     "preview": true
   }
   ```

3. Create a restrained 256×256 PNG icon and a wide hero visual. The mark should communicate a path through code without using gradients, mascots, fake IDE chrome, or AI imagery. Verify exact dimensions and contrast at 32×32.

4. Write concise support, privacy, and security documents:

   - support routes reproducible bugs to GitHub Issues and defines the diagnostic data users may choose to share;
   - privacy states that runtime analysis is local, with no telemetry, account, hosted inference, or source upload;
   - security defines private reporting, source-navigation boundary behavior, and the no-code-execution guarantee.

5. Update `.vscodeignore` so the icon and user-facing trust documents are included while tests, plans, source maps, DOCX files, evaluation internals, and caches remain excluded.

6. Update release notes with the complete user-visible editor experience and secondary MCP availability.

7. Verify PNGs, manifest validation, build, and package contents; then commit.

   ```powershell
   npm run check
   npm test
   npm run build
   npm run package
   npx vsce ls --no-dependencies
   git add package.json package-lock.json media SUPPORT.md SECURITY.md PRIVACY.md CHANGELOG.md .vscodeignore
   git commit -m "docs: finish Marketplace identity and trust"
   ```

## Task 9: Rewrite the judge-facing README and demo

**Files:**

- Modify: `README.md`
- Modify: `docs/architecture.md`
- Modify: `docs/build-with-codex.md`
- Modify: `demo/runbook.md`
- Create: `demo/judging-criteria.md`
- Create: `demo/mcp-config.example.json`

1. Fix any mojibake in user-facing documents and ensure UTF-8 arrows, apostrophes, and separators render correctly.

2. Reorder README around the product outcome:

   - one-sentence thesis and hero;
   - 60-second installed-extension workflow;
   - screenshots showing search and evidence path;
   - real pinned Linux proof;
   - confidence, evidence, limits, privacy, and security;
   - secondary “For coding agents” MCP section with exact build/config/tool examples;
   - development verification and Codex lifecycle evidence.

3. Keep MCP visually subordinate. Do not put “MCP” in the product title, opening sentence, first screenshot, or first workflow.

4. Add a client-agnostic MCP config example that runs the local built bundle with a workspace argument. State that the path must be absolute and the server is read-only.

5. Update architecture to show both adapters over one core and document stdout cleanliness, startup indexing, and response bounds.

6. Update the Codex development log with this release’s TDD units, cross-platform CI evidence, and honest division of human/Codex work.

7. Tighten the three-minute demo runbook and add a judging-criteria proof matrix. Every claim must point to a runnable command, UI moment, test, or committed evidence artifact.

8. Review the prose for natural, precise language. Remove promotional filler, fake quotations, generic “revolutionary” wording, and unsupported claims.

9. Verify links and commit.

   ```powershell
   rg -n "â|Â|runtime trace|execution path|multi-language|full C\+\+|AI-powered" README.md docs demo SUPPORT.md SECURITY.md PRIVACY.md
   npm run check
   npm test
   npm run build
   git add README.md docs demo
   git commit -m "docs: sharpen the judge-facing product story"
   ```

## Task 10: Extend CI and release verification

**Files:**

- Modify: `.github/workflows/ci.yml`
- Create: `scripts/verify-package.mjs`
- Create: `scripts/verify-package.test.mjs` or `src/release/package-content.test.ts`
- Modify: `package.json`

1. Write a failing package-content test. It must require:

   - extension, worker, webview, MCP bundle, parser WASM, C grammar WASM, CSS, icon, README, changelog, license, support, privacy, and security documents;
   - no `src`, tests, source maps, lockfile, DOCX, plans/specs, cache, or evaluation implementation in the VSIX;
   - the packaged manifest matches version and publisher from `package.json`;
   - the VSIX remains below a documented size ceiling.

2. Add scripts:

   ```json
   {
     "verify:package": "node scripts/verify-package.mjs codetrail.vsix",
     "verify:release": "npm run check && npm test && npm run test:coverage && npm audit --omit=dev --audit-level=high && npm run package && npm run verify:package && npm run test:mcp:e2e"
   }
   ```

3. Extend Windows and Ubuntu CI to run the MCP end-to-end test, both deterministic evaluation generators in verification mode, and package-content verification. Upload the VSIX and JSON evidence artifacts.

4. Verify locally and commit.

   ```powershell
   npm run verify:release
   git add .github/workflows/ci.yml scripts package.json package-lock.json src/release
   git commit -m "ci: gate the complete CodeTrail release"
   ```

## Task 11: Conduct the final judge review and installed click-through

**Files:**

- Modify: `docs/build-with-codex.md`
- Modify only if a verified defect requires it: implementation and tests

1. Review the finished product as four hostile judges:

   - **Implementation:** Is MCP genuinely backed by the core? Are the analyzer and integration non-trivial? Are all important paths tested through real bundles?
   - **Design:** Can a new user install, index, search, navigate, and understand uncertainty without reading documentation first?
   - **Impact:** Does the real Linux and context evidence prove a specific reduction in navigation work without overclaiming?
   - **Idea quality:** Does the demo reveal registrations, function-pointer dispatch, guards, and cross-file paths that plain search misses?

2. Install the newly packaged VSIX and repeat the complete click-through against `test-fixtures/kernel-mini`:

   - activation and indexing;
   - all three searches;
   - persistent search;
   - file route and within-file hierarchy;
   - confidence, evidence, warning, and disclaimer;
   - source navigation;
   - CodeLens;
   - keyboard shortcut;
   - editor context menu.

3. Connect a real MCP client to the packaged server bundle and capture `tools/list`, status resource, all three calls, unknown-symbol behavior, and shutdown.

4. Record only observed results in `docs/build-with-codex.md`. Do not add post-hackathon scope.

5. Run the final release gate from a clean install.

   ```powershell
   npm ci
   npm run verify:release
   git diff --check
   git status --short
   ```

6. Commit any verification-log update.

   ```powershell
   git add docs/build-with-codex.md
   git commit -m "docs: record winner release verification"
   ```

## Task 12: Integrate and publish the verified branch

**Files:** none unless conflict resolution is required

1. Confirm the release worktree is clean and all expected commits exist.

   ```powershell
   git status --short --branch
   git log --oneline main..HEAD
   ```

2. Update the branch from `main` without rewriting shared history, rerun the release gate if the base changed, then fast-forward `main` from the primary worktree.

   ```powershell
   git switch main
   git merge --ff-only codex/winner-release
   ```

3. Push `main` and wait for Windows and Ubuntu CI.

   ```powershell
   git push origin main
   gh run watch --exit-status
   ```

4. Verify remote commit and final worktree cleanliness.

   ```powershell
   git rev-parse HEAD
   git rev-parse origin/main
   git status --short --branch
   ```

5. Prepare Marketplace publication without crossing the credential boundary:

   - verify the durable publisher exists and owns the extension identity;
   - confirm public repository visibility and HTTPS image rendering;
   - document `vsce login <publisher>` and `vsce publish` or manual VSIX upload;
   - have the human owner create/use the Microsoft Marketplace identity and credential;
   - publish only the same verified VSIX or the identical source/version.

6. Report:

   - final commit and remote URL;
   - test, coverage, audit, CI, evaluation, and package results;
   - installed and packaged VSIX paths;
   - package-content verification;
   - README, demo, Linux evidence, MCP evidence, support, privacy, and security locations;
   - Marketplace readiness and the remaining human credential step;
   - known limitations that remain by design.
