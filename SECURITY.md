# CodeTrail security

## Reporting a vulnerability

Use GitHub's private **Report a vulnerability** flow for this repository when available. If private reporting is unavailable, open a minimal issue asking for a private contact channel; do not post exploit details, private source, tokens, or credentials publicly.

Include the affected version, operating system, VS Code version, reproduction steps, and impact. We will acknowledge a complete report and keep remediation discussion in the private channel.

## Security boundaries

CodeTrail parses source as data. It does not build or run repository code. Indexing skips symlinks and common dependency/build directories, enforces file and byte budgets, and performs analysis in a bounded worker. Source navigation canonicalizes the destination and rejects paths outside the indexed workspace.

Webview and worker messages are schema-validated. The webview uses a nonce-based Content Security Policy and inserts source-derived values as text. Stored snapshots are size-limited, decompressed with a cap, and validated before use.

The optional MCP server is local, read-only, and exposes no mutation tools. It writes protocol messages only to stdout, keeps diagnostics on stderr, validates every input, caps response size, and never returns complete source files.

These controls reduce risk but do not turn CodeTrail into a sandbox. Open untrusted repositories in VS Code's Restricted Mode; the extension declares that it requires workspace trust before analysis.
