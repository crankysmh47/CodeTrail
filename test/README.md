# Linux scheduler demo source

This directory is the real-source workspace used in the CodeTrail submission demo. It contains three unmodified files from the upstream Linux kernel:

| File | Lines | Purpose in the demo |
|---|---:|---|
| `core.c` | 11,284 | scheduler entry and dispatch logic |
| `fair.c` | 15,459 | fair-scheduler and EEVDF implementation |
| `sched.h` | 4,216 | scheduler declarations and internal helpers |

## Provenance

- Repository: <https://github.com/torvalds/linux>
- Revision: `7059bdf4f04a3e14f4fafb3ac35fdca913e3e21a`
- Original paths: `kernel/sched/core.c`, `kernel/sched/fair.c`, and `kernel/sched/sched.h`
- Snapshot totals: 30,959 lines and 848,962 bytes

The contents match those paths at the stated revision. Line endings may differ after checkout on Windows.

## Licensing

These files retain their upstream copyright notices and SPDX identifiers. They are licensed under GPL-2.0 and are not covered by CodeTrail's MIT license. The applicable license text is in [`LICENSES/GPL-2.0`](LICENSES/GPL-2.0).

## Open the demo workspace

From the CodeTrail repository root:

```powershell
code .\test
```

Install `codetrail.vsix`, run **CodeTrail: Index Workspace**, and follow the [independent recorder handoff](../demo/independent-recorder-script.md).
