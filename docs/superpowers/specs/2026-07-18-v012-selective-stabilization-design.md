# CodeTrail v0.1.2 Selective Stabilization Design

## Objective

Turn the existing `v0.1.2` branch into a small, reliable release by retaining only changes that improve the demonstrated CodeTrail workflow and removing incomplete features that weaken its core guarantees.

CodeTrail remains language-extensible and C-first. The release stays local, deterministic, bounded, and free of hosted inference, telemetry, and network calls.

## Retained changes

### Persistent search shell

The webview keeps one stable header and search form while result content changes beneath it. Search text and focus must survive result and discovery rendering so repeated searches feel immediate.

### File-link evidence navigation

Every cross-file relationship row exposes the source range of its supporting edge and an `Open` action. Source-derived labels continue to use DOM `textContent`.

### Indexing progress

Manual indexing reports bounded, per-file progress from the analysis layer through the worker and coordinator to the webview. Progress is informational and does not change partial-result behavior.

### Worker timeouts and recovery

Index, search, and discovery requests retain explicit timeouts. A timed-out worker rejects pending operations, terminates, and respawns so later requests can recover.

### Wider VS Code compatibility

The extension targets VS Code `^1.107.0`. `package.json`, `package-lock.json`, and installation documentation must agree on that version floor.

### Graph adjacency correction

Self-referential edges are added to adjacency once rather than twice. Traversal remains deterministic and bounded by the original compact release limits.

## Removed changes

### Incremental file cache

Remove `FileCacheEntry` and `fileCache` from the language-neutral `WorkspaceIndex`, worker messages, schemas, and extension commands. The current implementation duplicates index data in snapshots and is not propagated through the worker. Incremental indexing requires a later design that keeps parser cache state out of core contracts.

### Automatic background indexing

Remove open/save-triggered background indexing. Silent failures can leave an apparently current but stale index, and full-workspace reindexing on editor events is not minimal. Version 0.1.2 retains explicit manual reindexing and its visible state transitions.

### Kernel-enrichment toggle

Remove the extension setting and MCP CLI flag. The current enrichment module resolves both ordinary C calls and scheduler-specific patterns, so disabling it removes CodeTrail's core relationships. A future toggle requires a separate generic C relationship resolver before scheduler recovery can be optional.

### Expanded traversal budgets

Restore the compact extension budget of 40 nodes, 80 edges, depth 4, and 100 ms, along with the original hard maxima of 100 nodes, 200 edges, depth 8, and 1,000 ms. The enlarged command budget currently fails worker validation and would make trails less focused.

### Reversed discovery hierarchy

Restore `File route` before `Within files`. This is CodeTrail's defining reading model: first understand how execution evidence crosses files, then inspect the ordered symbols inside each file.

## Data flow

Manual indexing flows through `CodeTrailCommands` to `IndexCoordinator`, then through the validated worker protocol to `indexWorkspace`. The indexer emits progress callbacks and always resolves the existing C and scheduler relationship evidence. The completed immutable `WorkspaceIndex` is validated, stored, and used by search and discovery.

Discovery uses the compact graph budget accepted by both the worker schema and the graph implementation. `toTrailView` selects a source-backed edge for each file link and forwards its range to the webview. The webview renders the file route first and sends validated open-source messages back to the extension.

## Behavioral verification

Before production changes, tests must fail for the regressions they protect:

- worker index requests propagate progress while preserving relationship enrichment;
- extension discovery budgets pass the worker request schema;
- default indexing produces direct-call and registration edges;
- the discovery webview renders `File route` before `Within files`;
- the stable search form remains mounted across state changes;
- file-link `Open` sends the evidence source range;
- coordinator timeout recovery rejects pending work and uses a replacement worker;
- package and lockfile agree on `@types/vscode@1.107.0`.

After narrow tests pass, run the repository checks required by `AGENTS.md`: `npm run check`, `npm test`, and `npm run build`. Before packaging, also run the production audit, coverage, package build, package verification, and MCP end-to-end test.

## GitHub outcome

Commit the stabilization on `v0.1.2`, push the branch, open a pull request to `main`, and wait for both Windows and Ubuntu CI jobs. Do not publish Marketplace or Open VSX version 0.1.2 as part of this stabilization task.
