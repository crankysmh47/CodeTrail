# CodeTrail

Find the files and functions behind unfamiliar C behavior without leaving VS Code.

CodeTrail is a local-first VS Code extension for unfamiliar C codebases. Ask a code question or invoke it on a function definition. CodeTrail shows the cross-file route first, then the ordered symbol path inside each file. Every link includes its relationship, confidence, and source-backed reason.

CodeTrail does not call an AI service at runtime. The index, ranking, graph traversal, and trail ordering are deterministic and run on your machine.

## Contents

- [Install](#install)
- [Quick start](#quick-start)
- [Try the Linux scheduler demo](#try-the-linux-scheduler-demo)
- [How it works](#how-it-works)
- [Commands](#commands)
- [Confidence and evidence](#confidence-and-evidence)
- [Privacy and security](#privacy-and-security)
- [Limits](#limits)
- [Development](#development)
- [Project documents](#project-documents)
- [License](#license)

## Install

### Install the packaged extension

Build the VSIX, then install it in VS Code:

```powershell
npm ci
npm run package
code --install-extension .\codetrail.vsix --force
```

Restart or reload VS Code after installation.

### Run from source

Requirements:

- Node.js 24
- npm 11 or newer
- VS Code 1.125 or newer

```powershell
npm ci
npm run build
code .
```

Press `F5` in VS Code to open an Extension Development Host.

## Quick start

1. Open a folder containing `.c` and `.h` files.
2. Run `CodeTrail: Index Workspace` from the Command Palette.
3. Run `CodeTrail: Ask a Code Question`.
4. Ask a concrete question, for example: `How does the fair scheduler choose the next task?`
5. Confirm the best starting symbol. CodeTrail focuses the highest-ranked result so you can press `Enter` immediately.
6. Read **File route** to see how the relevant files connect.
7. Continue through **Within files**. Use `Open` to jump to any function in the editor.

The status under the question box tells you how many C files were indexed and whether Clang is available. Structural mode works without Clang.

### Start from a function definition

After indexing, open a C file and use any of these entry points:

- Click `CodeTrail: discover links` above an indexed function definition.
- Put the cursor on a symbol and press `Alt+Shift+T`.
- Right-click a symbol and choose `CodeTrail: Discover Symbol Links`.

Exact indexed symbols open their hierarchy directly. If the symbol is ambiguous, CodeTrail shows the same ranked candidate list used by question search.

## Try the Linux scheduler demo

The demo is pinned to Linux commit `7059bdf4f04a3e14f4fafb3ac35fdca913e3e21a`.

For a fast local run, open the included fixture:

```powershell
code .\test-fixtures\kernel-mini
```

For the upstream source, use a sparse checkout:

```powershell
git clone --filter=blob:none --no-checkout https://github.com/torvalds/linux.git linux-codetrail
cd linux-codetrail
git sparse-checkout init --cone
git sparse-checkout set kernel/sched Documentation/scheduler
git checkout 7059bdf4f04a3e14f4fafb3ac35fdca913e3e21a
code kernel\sched
```

Start with these questions:

```text
How does the Linux fair scheduler choose the next task?
How does EEVDF decide whether an entity is eligible?
How is the fair scheduler registered for dispatch?
```

The expected starting points are `pick_next_task_fair`, `entity_eligible`, and `pick_task`, respectively. The exact gold questions also live in `demo/questions.json`.

## How it works

CodeTrail keeps language-specific parsing separate from the product’s graph, search, and UI contracts.

```text
C and header files
    ↓
Tree-sitter C structural parser
    ↓
Kernel-aware relationship enrichment
    ↓
Typed workspace index
    ↓
Deterministic lexical ranking
    ↓
Bounded evidence graph
    ↓
Cross-file route
    ↓
Within-file symbol paths in VS Code
```

The C adapter extracts definitions for functions, structs, fields, and macros, plus direct calls, designated initializers, and preprocessor guards. The scheduler enricher recovers relationships that a plain call graph misses, including scheduler-class registration and function-pointer dispatch.

Search splits identifier forms, handles a bounded one-edit typo, removes duplicate node IDs, and scores typed relationship intent. A question about registration or dispatch therefore ranks the field that provides that relationship instead of whichever symbol shares the most words. Result rows show the reasons used in ranking.

Analysis runs in a Node worker so indexing does not block the extension host. CodeTrail stores validated, gzip-compressed snapshots in VS Code workspace storage and rejects stale or malformed snapshots.

## Commands

| Command | What it does |
|---|---|
| `CodeTrail: Index Workspace` | Parses the current C workspace and creates a fresh local index. |
| `CodeTrail: Ask a Code Question` | Opens the persistent question and discovery panel. |
| `CodeTrail: Discover Symbol Links` | Discovers the hierarchy for the symbol under the cursor. Also available from the editor context menu and `Alt+Shift+T`. |
| `CodeTrail: Explain Symbol` | Compatibility alias for `Discover Symbol Links`. |
| `CodeTrail: Discover Indexed Function` | Opens an exact indexed function. CodeTrail invokes this from CodeLens. |
| `CodeTrail: Open Evidence Source` | Opens a validated source location from the discovery result. |

The `codetrail.filesMax` setting controls the maximum number of C and header files indexed. Its default is 2,000; its hard maximum is 10,000.

## Confidence and evidence

Every relationship has one of three labels:

| Label | Meaning |
|---|---|
| `confirmed` | The source contains a direct structural relationship, such as a direct call. |
| `inferred` | The relationship is backed by source syntax but depends on a pattern such as a designated initializer or function pointer. |
| `possible` | The evidence names a plausible target but cannot select one target safely. |

Cross-file rows show direction, relationship type, confidence, evidence count, and reason. Within-file steps show the symbol, signature, source path, relationship reason, and confidence. Budget warnings stay visible. Every result is labeled `Static reading order; not a runtime trace.`

## Privacy and security

- Source files stay local.
- The extension makes no network request and has no account system.
- Runtime code imports no OpenAI or Codex SDK.
- Webview and worker messages are validated with Zod.
- The webview uses a nonce-based Content Security Policy and renders source-derived text with `textContent`.
- Indexing skips symlinks and excluded build/dependency directories.
- File count, file size, total bytes, queue depth, graph size, traversal depth, snapshot size, and operation time have explicit limits.
- Source navigation rejects paths outside the indexed workspace.

The optional Clang capability check executes only `clang --version` with a three-second timeout. CodeTrail never builds or runs repository code.

## Limits

This release is deliberately narrow.

- It supports GNU C structure, not full C++ semantics.
- It does not preprocess every kernel configuration.
- Macro and function-pointer relationships can remain inferred.
- It does not claim runtime order, frequency, or branch behavior.
- Search is lexical, typo-bounded, and explainable; it does not understand arbitrary natural language or use embeddings.
- Clang availability is reported, but compiler AST enrichment is not part of the Build Week package.
- Whole-kernel indexing is intentionally bounded. Open a subsystem folder for the clearest result.
- Indexing is explicit rather than incremental. Reindex after changing source files.
- The extension currently follows outgoing structural evidence from one selected symbol; it is not a whole-program impact analyzer.

These limits appear in the product instead of being hidden behind a generic confidence score.

## Development

Install dependencies:

```powershell
npm ci
```

Run the complete verification loop:

```powershell
npm run check
npm test
npm run test:coverage
npm run build
npm run package
```

Useful scripts:

| Script | Purpose |
|---|---|
| `npm run check` | Strict TypeScript checking for production and test files. |
| `npm test` | Runs unit, fixture, gold-path, security-boundary, and performance tests. |
| `npm run test:coverage` | Runs the suite with V8 coverage. |
| `npm run build` | Bundles the extension host, worker, and webview; copies WASM assets. |
| `npm run package` | Produces `codetrail.vsix`. |

The current gold suite covers direct calls, macro/designated-initializer registration, scheduler dispatch, configuration guards, unique and typo-tolerant search, all three Linux questions, the `sched.h` to `fair.c` route, the within-file function path, graph budgets, snapshot validation, worker generation safety, CSP, source path confinement, UI states, and latency.

## Project documents

- `docs/architecture.md`: components, boundaries, and data flow
- `docs/build-with-codex.md`: how Codex was used during development
- `demo/runbook.md`: the three-minute judge demo
- `docs/superpowers/specs/2026-07-14-codetrail-product-design.md`: approved product direction
- `docs/superpowers/plans/2026-07-14-codetrail-build-week-mvp.md`: sequential implementation plan
- `docs/superpowers/specs/2026-07-15-codetrail-relationship-discovery-polish-design.md`: file-first discovery and minimal UI design

## License

MIT. See `LICENSE`.
