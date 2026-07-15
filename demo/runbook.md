# Three-minute CodeTrail demo

Use `test-fixtures/kernel-mini` for the live UI. It contains the same scheduler relationship patterns as the upstream evaluation but keeps the route short enough to explain. Keep `demo/linux-scheduler-evaluation.json` ready as proof that the required searches also pass on 50 real upstream files.

## Before the timer

1. Install the release `codetrail.vsix` and reload VS Code.
2. Open `test-fixtures/kernel-mini`.
3. Run `CodeTrail: Index Workspace` once.
4. Open `fair.c` at `pick_next_task_fair` so CodeLens is visible.
5. Leave the CodeTrail panel at its normal narrow width.

## 0:00-0:25 | The problem

Say:

> Kernel behavior crosses headers, function pointers, registrations, and direct calls. Text search finds names. It does not tell me which files and functions to read, or which links are inferred. CodeTrail does.

## 0:25-0:55 | Find the route

Run `CodeTrail: Search Code` and enter:

```text
schedule
```

Point to the ranked results and their match reasons. Select `pick_next_task_fair`.

Do not narrate every row. The important transition is from a broad term to one evidence-backed path.

## 0:55-1:45 | Read files first, functions second

In **File route**, show the inferred `sched.h -> fair.c` registration and its source evidence count.

Then read the first three **Within files** steps:

```text
pick_next_task_fair -> pick_eevdf -> entity_eligible
```

Point out that direct calls are `confirmed`, while registration and pointer dispatch stay `inferred`. Select `Open` on `entity_eligible` and show the editor jump to the exact source range.

## 1:45-2:15 | Stay in the editor

Return to `pick_next_task_fair`.

1. Click its `CodeTrail: discover links` CodeLens.
2. Put the cursor on `pick_eevdf` and press `Alt+Shift+T`.
3. Open the editor context menu long enough to show the same command there.

Say: "I can start from search or from the code under my cursor. The result is the same bounded trail."

## 2:15-2:35 | Make the trust boundary visible

Point to:

```text
Static reading order; not a runtime trace.
```

If a depth or trail warning is visible, use it. The product shows where it stopped instead of hiding a limit behind a confidence score.

## 2:35-2:50 | Prove it is not fixture-only

Open `demo/linux-scheduler-evaluation.md` or its JSON result.

Say:

> The same analyzer indexed 50 upstream scheduler files at a pinned Linux commit: 3,743 nodes and 33,099 typed edges. The three required searches found `__schedule`, `entity_eligible`, and `pick_task_fair` at ranks 1, 2, and 10.

## 2:50-3:00 | Close

Say:

> CodeTrail is a minimal reading tool, not an AI chat panel or an unrestricted graph. Codex built and tested it; the product itself stays deterministic and local.

Close on the VS Code trail, not the MCP report.

## Backup commands

```powershell
npm exec -- vitest run src/gold.test.ts src/core/search.test.ts
npm run evaluate:linux -- --workspace .cache/linux-scheduler
```

MCP is optional backup evidence if a judge asks about agent workflows. Show the two-call retrieval result, then return to the extension.
