# MCP retrieval-context evaluation

MCP is a secondary adapter over the same CodeTrail index used by the VS Code extension. This evaluation asks a narrower question: can a coding agent retrieve the expected symbol and source-backed relationship evidence without loading the complete scheduler source into context?

It does not measure model intelligence, answer quality, or autonomous task completion.

## Method

Each task makes exactly two calls through the real stdio MCP bundle:

1. `search_code` with a result limit of 20;
2. either `get_symbol` or `get_reading_path` for the required symbol.

A task passes only if the expected symbol appears and the follow-up contains every required relationship kind. `structuredResponseBytes` is the UTF-8 size of both structured MCP responses. `contextReductionPercent` compares those bytes with the 2,049,984 bytes of indexed C/header source; it is a retrieval-volume measure, not a token or accuracy claim.

## Results on the pinned Linux scheduler

| Task | Required answer | Rank | Required evidence | Retrieved bytes | Source reduction |
|---|---:|---:|---|---:|---:|
| Scheduler entry | `__schedule` | 1 | `calls` | 129,007 | 93.71% |
| EEVDF eligibility | `entity_eligible` | 2 | `calls` | 13,431 | 99.34% |
| Registration dispatch | `pick_task_fair` | 10 | `registers`, `dispatches-to` | 24,609 | 98.80% |

All three tasks passed the answer and evidence rubric. The broad scheduler path deliberately returns more context than the focused tasks because it crosses more files and relationships, but remains below the MCP response ceiling.

The complete observed output is [mcp-evaluation-results.json](./mcp-evaluation-results.json).

## Reproduce

After creating the pinned sparse checkout described in [linux-scheduler-evaluation.md](./linux-scheduler-evaluation.md):

```powershell
npm run evaluate:mcp -- --workspace .cache/linux-scheduler/kernel/sched --output demo/mcp-evaluation-results.json --profile linux-7059
```

The MCP server is local, read-only, and deterministic after indexing. It has three tools—`search_code`, `get_symbol`, and `get_reading_path`—plus a status resource. Source remains on the machine; the server returns bounded structured evidence, not source-file contents.
