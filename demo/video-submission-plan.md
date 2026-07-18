# CodeTrail video submission plan

## Goal

Make one claim memorable in three minutes:

> CodeTrail turns unfamiliar C systems code into a short, source-backed reading path: files first, functions second.

The VS Code extension is the product. The Linux scheduler is the credible proof. MCP gets one brief supporting moment to show that the same bounded evidence can also reduce context retrieval for coding agents; it is not a second demo.

## Final format

- Target length: **2:55**, leaving five seconds of upload tolerance.
- Resolution: **1920 x 1080**, 30 fps, crisp editor text.
- Style: direct screen recording with voice-over and restrained text callouts. No talking head is needed.
- Pace: show one complete developer journey, then prove it scales beyond the fixture.
- Capture real product behavior. Do not animate or recreate outputs.
- Keep the mouse slow, the panel narrow, and VS Code at a readable zoom.

## Judge-facing story

| Criterion | What the video proves |
|---|---|
| Technological implementation | A packaged extension parses C with Tree-sitter, recovers scheduler-specific relationships, ranks search results, and traverses a bounded typed graph. Codex was used throughout the tested development lifecycle, not embedded in the runtime. |
| Design | Search, file-first hierarchy, evidence, source navigation, CodeLens, and the keyboard shortcut form one coherent editor workflow. |
| Potential impact | The product answers a concrete problem for developers entering kernels, runtimes, databases, firmware, and other large C systems: what should I read next, and why? |
| Quality of the idea | CodeTrail deliberately produces an evidence-backed reading order instead of another noisy graph canvas, chat box, or unverifiable runtime-trace claim. |

## Recording preparation

1. Install the freshly packaged `codetrail.vsix` with `--force`, reload VS Code, and open `test-fixtures/kernel-mini`.
2. Use a clean VS Code profile or hide unrelated extensions, notifications, terminals, account details, and source-control badges.
3. Use the dark default theme, a 16-18 px editor font, and a normal-width CodeTrail panel.
4. Index once as a rehearsal. Before recording, reload the window and retain the valid snapshot so activation is immediate; run **Index Workspace** on camera to show visible progress.
5. Open `fair.c` at `pick_next_task_fair`, with its CodeLens visible.
6. Keep these proof files ready in editor tabs:
   - `demo/linux-scheduler-evaluation.md`
   - `demo/mcp-evaluation.md`
   - `docs/build-with-codex.md`
7. Close Explorer sections that reveal noise. Pin only `fair.c`, the CodeTrail panel, and the three proof tabs.
8. Record a silent screen take first, then add the final voice-over. This makes timing and cursor movement controllable without faking product behavior.

## Exact shot list and narration

### 0:00-0:14 - Cold open: the problem

**Picture:** `fair.c` and `sched.h` in a split editor. Briefly highlight a direct call, a designated initializer, and a function-pointer dispatch. Cut to the CodeTrail icon.

**Narration:**

> In unfamiliar systems code, finding a function name is easy. Reconstructing the path across headers, registrations, function pointers, and direct calls is the expensive part.

**On-screen callout:** `Search finds names. CodeTrail finds the reading path.`

### 0:14-0:37 - One deliberate search

**Picture:** Run **CodeTrail: Index Workspace** and let the progress state complete. Open **CodeTrail: Search Code**, type `schedule`, and pause on the ranked results and match reasons. Select `pick_next_task_fair`.

**Narration:**

> CodeTrail indexes C locally, then turns a plain keyword into explainable, ranked symbols. No chat prompt and no runtime AI. I choose the scheduler path I want to understand.

**On-screen callout:** `Local + deterministic`

### 0:37-1:18 - The defining product moment

**Picture:** Hold on **File route** first. Point to `sched.h -> fair.c`, `registers`, `inferred`, and its evidence count. Then move to **Within files** and reveal `pick_next_task_fair -> pick_eevdf -> entity_eligible`. Point to `confirmed` on direct calls. Click **Open** for `entity_eligible` and show the exact editor jump.

**Narration:**

> Instead of dumping a call graph, CodeTrail gives me a reading order. Files first: this initializer in `sched.h` registers behavior implemented in `fair.c`. Functions second: confirmed direct calls lead from `pick_next_task_fair` to `pick_eevdf` and `entity_eligible`. Every edge keeps its confidence, reason, and source range. Open takes me to the evidence, not a generated explanation.

**On-screen callouts, one at a time:**

- `Files first`
- `Functions second`
- `Confidence + source evidence`

### 1:18-1:41 - It belongs inside the editor

**Picture:** Return to `pick_next_task_fair`. Click the CodeLens. Put the cursor on `pick_eevdf` and press `Alt+Shift+T`. Open the context menu only long enough to show **CodeTrail: Discover Symbol Links**.

**Narration:**

> I can start from search, CodeLens, a shortcut, or the editor context menu. Each entry point reaches the same bounded trail without leaving VS Code.

**On-screen callout:** `Search | CodeLens | Alt+Shift+T | Right-click`

### 1:41-1:56 - Trust boundary

**Picture:** Return to the trail and frame the disclaimer plus a confidence label or traversal warning.

**Narration:**

> CodeTrail is honest about static analysis. Inferred links stay inferred, limits stay visible, and every result says: static reading order, not a runtime trace.

**On-screen callout:** `Static reading order - not a runtime trace`

### 1:56-2:20 - Prove it is not fixture-only

**Picture:** Open `demo/linux-scheduler-evaluation.md`. Zoom into the pinned commit, 50 files, 3,743 nodes, 33,099 typed edges, and the three search ranks. Do not scroll through raw JSON.

**Narration:**

> The small workspace makes the interaction easy to see. The same analyzer also runs reproducibly on 50 files from a pinned upstream Linux scheduler commit: 3,743 symbols, 33,099 typed edges, and the required scheduler, eligibility, and dispatch answers at ranks one, two, and ten.

**On-screen callout:** `Pinned upstream Linux proof`

### 2:20-2:38 - Codex and implementation depth

**Picture:** Show the concise commit/evidence table in `docs/build-with-codex.md`, then a pre-recorded terminal result from `npm run verify:release`: `31 passed`, `128 passed`, `0 vulnerabilities`, and the verified 18-file VSIX. Keep this visual to one terminal screen.

**Narration:**

> Codex was our engineering partner across product decisions, test-first implementation, debugging, security review, packaging, and installed-extension verification. The product itself has no Codex or OpenAI runtime dependency. The release passes 128 tests, a production vulnerability audit, package inspection, and spawned MCP protocol tests.

**On-screen callout:** `Built with Codex - not powered by Codex at runtime`

### 2:38-2:50 - MCP as the indirect win

**Picture:** Show only the three-row results table in `demo/mcp-evaluation.md`. Visually connect it back to the same CodeTrail evidence model; do not open an MCP inspector or lead with tool names.

**Narration:**

> As a secondary adapter, the same local evidence is available to coding agents. On these tasks, two structured calls returned the answer and its evidence with 97 to 99 percent less retrieved data than the indexed source. That is a context-volume result, not an AI accuracy claim.

**On-screen callout:** `Same evidence, less agent context`

### 2:50-2:55 - Close

**Picture:** Return to the completed VS Code trail with **File route** and **Within files** both visible. End on the product, not a logo card.

**Narration:**

> CodeTrail: the shortest evidence-backed path through unfamiliar C code.

## Editing rules

- Use hard cuts or very short dissolves; no energetic template transitions.
- Add no background music unless it remains inaudible beneath narration.
- Use one callout style: small neutral rectangle, editor-native colors, six words maximum.
- Remove dead cursor travel, command-palette typing delays, indexing rehearsal time, and tab-finding time.
- Preserve enough real-time interaction that the extension clearly works.
- Normalize narration, remove room noise, and add accurate burned-in captions.
- Never crop away confidence labels, warnings, evidence counts, or the static-analysis disclaimer while discussing trust.

## Claims to avoid

- Do not call the trail a runtime trace, execution path, or complete call graph.
- Do not claim general multi-language support; this release is C-first.
- Do not claim whole-kernel indexing; the proof is the bounded `kernel/sched` subsystem.
- Do not describe MCP context reduction as token savings, model accuracy, or productivity gain.
- Do not imply Codex runs inside the extension.
- Do not promise incremental indexing, complete preprocessing, or definitive function-pointer targets.

## Capture checklist

- [ ] Installed VSIX, not Extension Development Host
- [ ] Activation and visible indexing progress
- [ ] Search input `schedule` and ranked reasons
- [ ] File route before within-file path
- [ ] `confirmed` and `inferred` evidence visible
- [ ] Exact source navigation through **Open**
- [ ] CodeLens, shortcut, and context-menu entry points
- [ ] Persistent search remains visible
- [ ] Static-analysis disclaimer or traversal bound visible
- [ ] Pinned upstream Linux metrics and ranks
- [ ] Codex development-lifecycle evidence
- [ ] Test, audit, MCP E2E, and VSIX verification result
- [ ] MCP limited to one supporting result
- [ ] Final frame is the CodeTrail trail

## Backup assets and recovery

- Record each timed section as a separate clean clip so one UI mistake does not require a complete retake.
- Keep the complete installed-extension click-through observations in `docs/build-with-codex.md` as evidence if a capture action fails.
- If live indexing is slower than expected, show its genuine progress state, then cut to completion. Do not replace it with a fabricated animation.
- If CodeLens is initially absent, open and save `fair.c`, then wait for the indexed-generation refresh before recording that segment.
- If the three-minute platform limit differs, preserve sections 0:14-2:20 first; shorten MCP and development proof before cutting the core product path.

## Final review rubric

Before upload, watch once with sound off and once without looking at the screen.

The silent pass must still communicate the problem, search, hierarchy, evidence, real Linux proof, and local deterministic boundary. The audio-only pass must accurately distinguish confirmed, inferred, static, fixture, upstream proof, and MCP context-volume claims. If either pass is ambiguous, fix the narration or callout rather than adding another feature.
