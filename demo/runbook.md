# Three-minute CodeTrail demo

## Before recording

1. Install `codetrail.vsix`.
2. Open `test-fixtures/kernel-mini` or the pinned upstream `kernel/sched` sparse checkout.
3. Run `CodeTrail: Index Workspace` once.
4. Keep `fair.c` closed so source navigation is visible.
5. Set the editor zoom so the trail and source fit on screen.

## 0:00-0:25 — the problem

Say: "Kernel scheduler behavior is spread across direct calls, macros, designated initializers, function pointers, state fields, and configuration guards. A symbol search gives you files. CodeTrail gives you a reading path and shows why every step is there."

## 0:25-0:50 — index

Run `CodeTrail: Index Workspace`.

Point out:

- local C file count;
- Clang availability without treating it as required;
- no account, upload, or AI runtime call.

## 0:50-1:20 — ask and confirm

Ask:

```text
How does the Linux fair scheduler choose the next task?
```

Show the ranked candidates and the visible match reasons. Confirm `pick_next_task_fair`.

## 1:20-2:25 — follow evidence

Walk through:

1. `pick_next_task_fair` as the entry point;
2. the direct call to `pick_eevdf`;
3. eligibility logic and scheduler state;
4. scheduler-class registration or dispatch as inferred evidence;
5. any configuration or graph-budget warning.

Open at least two source locations. Read the confidence label and evidence reason aloud once.

## 2:25-2:45 — trust boundary

Point to: `Static reading order; not a runtime trace.`

Say: "CodeTrail would rather show an honest inferred edge than write a confident story it cannot prove."

## 2:45-3:00 — Build Week close

Say: "The product is language-extensible and C-first. Codex built and tested the parser, worker, ranking, graph budgets, VS Code experience, package, and demo with us. The shipped runtime stays deterministic and local."

Close on:

> Built with Codex. Grounded in code. Designed to show only the path that matters.

## Backup

If indexing the upstream folder takes too long, switch to `test-fixtures/kernel-mini`. The same gold test runs in CI. Keep a terminal ready with:

```powershell
npm test -- src/gold.test.ts
```
