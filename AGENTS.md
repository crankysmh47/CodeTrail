# CodeTrail agent guide

## Product boundary

CodeTrail is language-extensible and C-first. The Build Week proof uses Linux scheduler code. Do not describe the current release as general multi-language support.

The runtime is local and deterministic. Do not add OpenAI, Codex, hosted inference, telemetry, or network calls without an explicit product decision.

## Engineering rules

- Write a failing behavioral test before changing production behavior.
- Keep source provenance, confidence, and evidence reasons attached to every edge.
- Bound all file walks, queues, graph traversals, snapshots, and external processes.
- Treat a partial result as usable data with a visible warning.
- Never call a static trail a runtime trace.
- Validate webview, worker, snapshot, and configuration data at their boundaries.
- Render source-derived webview text with DOM `textContent`, not HTML injection.
- Preserve the language-neutral contracts in `src/core`.
- Keep kernel-specific recovery in `src/analysis/kernel-enricher.ts`.

## Verification

Before a commit, run the narrow test for the changed behavior, then:

```powershell
npm run check
npm test
npm run build
```

Before packaging, also run:

```powershell
npm audit --omit=dev --audit-level=high
npm run test:coverage
npm run package
```
