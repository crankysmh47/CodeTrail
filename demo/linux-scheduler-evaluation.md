# Pinned Linux scheduler evaluation

This report tests CodeTrail on upstream Linux scheduler source rather than a hand-shaped demo. It is a static-source validation, not a runtime benchmark.

## Source and scope

- Repository: `https://github.com/torvalds/linux.git`
- Revision: `7059bdf4f04a3e14f4fafb3ac35fdca913e3e21a`
- Indexed scope: `kernel/sched`
- Indexed files: 50 C and header files
- Indexed source: 2,049,984 bytes
- Result: 3,743 nodes and 33,099 typed edges

The generator reads `.git/HEAD` and refs itself and refuses to run if the checkout is not at the pinned revision. It never fetches, builds, or executes Linux source.

## Observed results

| Search | Required answer | Rank | What it proves |
|---|---:|---:|---|
| `schedule` | `__schedule` | 1 | A broad behavior term finds the central scheduler function. |
| `eevdf eligible` | `entity_eligible` | 2 | Split identifier concepts reach the concrete eligibility function. |
| `register dispatch` | `pick_task_fair` | 10 | Relationship intent recovers scheduler-class registration and indirect dispatch rather than lexical matches alone. |

The generated `__schedule` reading path contains 12 ordered symbols across 17 file sections. Every included relationship carries source coordinates, a reason, and a confidence label. The path is visibly truncated at its configured graph and trail budgets and remains labeled `Static reading order; not a runtime trace.`

The machine-readable result is [linux-scheduler-evaluation.json](./linux-scheduler-evaluation.json). It includes the full top-20 result sets, score reasons, index warnings, configured bounds, file-route evidence samples, and the selected reading path.

## Reproduce

Create a sparse checkout:

```powershell
git clone --filter=blob:none --no-checkout https://github.com/torvalds/linux.git .cache/linux-scheduler
git -C .cache/linux-scheduler sparse-checkout init --cone
git -C .cache/linux-scheduler sparse-checkout set kernel/sched Documentation/scheduler
git -C .cache/linux-scheduler checkout 7059bdf4f04a3e14f4fafb3ac35fdca913e3e21a
```

Then generate the report:

```powershell
npm run evaluate:linux -- --workspace .cache/linux-scheduler
```

## Boundaries

Tree-sitter reports recoverable syntax-error regions in 35 of the macro-heavy GNU C files. CodeTrail records those warnings and keeps only the structure it can verify; the index itself did not hit its file, byte, graph, or time bounds. It does not preprocess every kernel configuration, and inferred function-pointer relationships remain static possibilities rather than runtime facts.
