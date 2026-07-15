# Three-minute CodeTrail demo

## Before recording

1. Install `codetrail.vsix`.
2. Open `test-fixtures/kernel-mini` or the pinned upstream `kernel/sched` sparse checkout.
3. Run `CodeTrail: Index Workspace` once.
4. Open `fair.c` and leave the cursor in `pick_next_task_fair` so the CodeLens and shortcut are ready.
5. Keep the CodeTrail panel narrow enough to demonstrate its compact layout.

## 0:00-0:25 — the problem

Say: "Kernel scheduler behavior crosses headers, function pointers, designated initializers, and direct calls. Search can find a name, but it does not tell you how the files and functions connect. CodeTrail does."

## 0:25-0:50 — index

Run `CodeTrail: Index Workspace`.

Point out:

- local C file count;
- Clang availability without treating it as required;
- no account, upload, or AI runtime call.

## 0:50-1:15 — search and confirm

Search:

```text
schedule
```

Show the direct scheduler matches and typed related candidates. Point out the visible match reasons, then select `pick_next_task_fair`.

## 1:15-2:05 — follow evidence

Read the result in the same order CodeTrail presents it:

1. In **File route**, show the inferred `sched.h → fair.c` registration link and its evidence count.
2. In **Within files**, show `pick_next_task_fair → pick_eevdf → entity_eligible`.
3. Point out the direct-call edges are confirmed while registration is inferred.
4. Open one source location and return to the panel.

The important visual is progressive disclosure: files first, functions second. There is no unrestricted graph to untangle.

## 2:05-2:30 — editor-native workflow

Return to `pick_next_task_fair` in `fair.c`.

1. Click `CodeTrail: discover links` above the definition.
2. Put the cursor on `pick_eevdf` and press `Alt+Shift+T`.
3. Mention the same action is in the editor context menu.

The exact symbol route opens without retyping the search.

## 2:30-2:45 — trust boundary

Point to: `Static reading order; not a runtime trace.`

Say: "CodeTrail separates what it sees directly from what it infers. It never presents this as runtime execution."

## 2:45-3:00 — Build Week close

Say: "The product is C-first, with language-neutral graph and discovery contracts underneath. Codex was used throughout development and testing. The extension itself stays deterministic and local."

Close on the CodeTrail panel with **File route** and **Within files** both visible.

## Backup

If indexing the upstream folder takes too long, switch to `test-fixtures/kernel-mini`. The same gold test runs in CI. Keep a terminal ready with:

```powershell
npm test -- src/gold.test.ts
```
