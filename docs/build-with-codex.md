# Building CodeTrail with Codex

Codex was the implementation partner for this Build Week project. CodeTrail itself does not use Codex or an OpenAI API at runtime.

## Human direction

The human partner supplied the problem and the non-negotiable use case: understanding Linux kernel scheduler code without narrowing the eventual product to one repository. They also set the product values: minimal, productive, and credible enough to win the Developer Tools category.

The human partner approved these decisions before implementation:

- language-extensible architecture, C-first release;
- Linux scheduler as the defining demonstration;
- Tree-sitter structure plus kernel-aware enrichment;
- optional Clang capability, not a hard dependency;
- Codex in the development lifecycle, not in the product runtime;
- vertical evidence trail instead of a full graph visualization.

## Codex work sequence

For each behavior, Codex wrote a focused failing test, ran it to confirm the failure, implemented the narrow production change, and reran strict type checking and the relevant tests. Complete checkpoints also rebuilt the extension and worker bundles.

The repository history preserves those units:

| Commit | Work unit |
|---|---|
| `1384190` | Product and Build Week master plan |
| `2e2e0fb` | Sequential implementation plan |
| `6819bb6` | Reproducible extension foundation and contracts |
| `d31c35c` | WebAssembly C structural parser |
| `cd29bbe` | Linux scheduler relationship recovery |
| `a8aa8ae` | Explainable deterministic search |
| `41145df` | Bounded graph and evidence trails |
| `36e67a9` | Workspace limits, Clang probe, and snapshots |
| `963b1f3` | Worker protocol and isolation |
| `e0592a5` | Complete VS Code/webview experience |
| `6e2dc9b` | Linux scheduler gold and performance tests |
| `2635219` | Unique, typo-tolerant, relationship-aware search |
| `19a41a4` | Cross-file links and within-file hierarchy projection |
| `3e6c22e` | Validated discovery requests through the worker |
| `5ee056b` | CodeLens, context action, and symbol shortcut |
| `801da34` | Minimal progressive discovery panel |

## Debugging evidence

Codex diagnosed several integration failures instead of patching around them:

- A cold npm cache outlived the command timeout. The existing npm process was allowed to finish rather than starting a competing install.
- `web-tree-sitter` 0.26 could not load a C grammar built with the 0.20 ABI. The runtime was pinned to the compatible 0.20.8 release, and the parser was tested against the real WASM asset.
- CommonJS worker output used a `.js` extension inside an ESM package. A real worker smoke test caught the mismatch; runtime bundles now use `.cjs`.
- Zod's mutable inferred arrays conflicted with readonly domain contracts. Runtime schemas and domain response types were separated instead of weakening immutability.
- The security pass found a low-severity development-only `esbuild` advisory. The dependency was upgraded to 0.28.1 and the audit was rerun.

## What Codex verified

- strict TypeScript checks include test files;
- unit and integration tests cover parsing, malformed C recovery, enrichment, unique candidate ranking, bounded typo matching, relationship intent, budgets, snapshots, protocol validation, generation races, CSP, path confinement, UI states, all three Linux questions, the cross-file route, and latency;
- the bundled worker can load both WASM assets and index the scheduler fixture;
- CodeLens and editor symbol resolution use stable index IDs without parsing on the extension host;
- runtime dependencies have no known npm vulnerabilities;
- runtime source contains no OpenAI/Codex SDK, `eval`, or HTML injection;
- the VSIX contents exclude tests, source maps, planning documents, and the original product document.

This file summarizes repository evidence. It does not include private chat transcripts or claim that Codex made unreviewed product decisions.
