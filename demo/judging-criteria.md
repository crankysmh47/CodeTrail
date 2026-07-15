# Judge evidence map

CodeTrail's claim is deliberately narrow: it turns unfamiliar C source into the smallest source-backed reading path a developer can follow in VS Code. The optional MCP adapter lets coding agents request the same evidence, but it does not lead the demo.

## Technological implementation

| What a skeptical judge may ask | Evidence |
|---|---|
| Is this more than a webview mockup? | The packaged worker loads Tree-sitter WASM, indexes C/header files, enriches Linux scheduler registrations and dispatch, builds a typed graph, ranks results, and traverses explicit budgets. Run `npm test` and `npm run test:coverage`. |
| Did Codex do substantial development work? | [build-with-codex.md](../docs/build-with-codex.md) records the TDD units, integration failures, installed click-through, and commit trail. CodeTrail has no Codex/OpenAI runtime dependency. |
| Does the installed artifact work? | `npm run package` produces the same VSIX used for the installed-extension click-through. `npm run verify:package` checks its contents. |
| Is MCP real or decorative? | `src/mcp/stdio.e2e.test.ts` spawns the bundled stdio server. In-process protocol tests cover tools, resources, invalid input, unknown symbols, deterministic repeats, and shutdown. |

## Design

| Product moment | What it demonstrates |
|---|---|
| Search `schedule` | A plain keyword box with ranked, explainable code results. No fake conversation. |
| Select `pick_next_task_fair` | Progressive disclosure: file route first, symbol path second. |
| Open source evidence | The result drives editor navigation as well as visualization. |
| Use CodeLens, `Alt+Shift+T`, and context menu | The workflow fits the editor instead of requiring a separate graph tool. |
| Read confidence and the static-analysis disclaimer | Uncertainty and bounds are part of the experience. |

## Potential impact

The audience is developers and coding agents entering large C systems: kernels, runtimes, databases, embedded firmware, and infrastructure tools. Their problem is not finding one identifier; it is reconstructing why multiple files and indirect calls belong to the behavior they are debugging.

The pinned upstream run is the impact proof. CodeTrail indexed 2,049,984 source bytes and found all three required scheduler answers. For an agent, two MCP calls returned the required answer and evidence with 97.33% to 99.34% less data than the indexed source. This measures retrieved context only. It does not claim that an LLM became smarter or more accurate.

## Quality of the idea

The distinctive part is the reading-path product decision. Generic call graphs become noisy; text search misses registrations and indirect dispatch; an LLM chat box would make evidence and repeatability harder to audit. CodeTrail combines structural parsing with a small domain-aware enrichment layer, then collapses the graph into a recommended sequence with source ranges and explicit uncertainty.

The product also knows what it is not. It does not claim runtime order, whole-program C++ understanding, compiler-complete preprocessing, or unrestricted natural-language search.

## Known risks that remain

| Risk | Current handling | Why it remains |
|---|---|---|
| Macro-heavy GNU C creates partial-parse regions | Warnings are recorded; verified structure remains usable. | Full preprocessing needs build configuration and is beyond the one-week release. |
| Function pointers can have multiple targets | Confidence stays `inferred` or `possible`; reasons and source ranges remain visible. | Static source alone cannot prove runtime selection. |
| Whole-kernel scope can overwhelm a first-use demo | File, byte, graph, and response bounds are explicit; the demo opens one subsystem. | CodeTrail is a focused reader, not an unbounded index service. |
| Marketplace identity requires owner credentials | The VSIX is complete and publisher metadata is prepared. | Microsoft publisher creation/login must be done by the human owner. |

These are product boundaries, not hidden roadmap promises. The release is complete inside them.
