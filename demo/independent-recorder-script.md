# CodeTrail independent recorder handoff

This is the final recording script. It is written so a recorder who has not followed the project can produce the submission without guessing what to click or say.

## Deliverable

- Maximum platform length: 3:00
- Target cut: 2:58
- Format: 1920 x 1080, 30 fps, spoken narration, readable editor text
- Product shown: installed `codetrail.vsix`, not an Extension Development Host
- Workspace shown: `test/`, containing three real upstream Linux scheduler files

Do not improvise technical claims. CodeTrail produces a bounded static reading order, not a runtime trace.

## Facts used in the narration

| Fact | Verified value |
|---|---:|
| `core.c` | 11,284 lines |
| `fair.c` | 15,459 lines |
| `sched.h` | 4,216 lines |
| Total | 30,959 lines, 848,962 bytes |
| Broad search | `schedule` ranks `__schedule` first at `core.c:7061` |
| Fair-scheduler search | `pick task fair` ranks `pick_task_fair` first at `fair.c:9912` |
| Shortcut | `Alt+Shift+T` |
| Selected-symbol location | `pick_eevdf` call at `fair.c:6380` |

The current release renders **File route** before **Within files**. Its shortcut is `Alt+Shift+T`, not `Ctrl+Alt+T`.

## Prepare before recording

1. Open `C:\sem4\CodeTrail\test` as the only VS Code workspace folder.
2. Trust the folder before the take so the trust prompt does not interrupt the recording.
3. Uninstall any existing CodeTrail version and reload VS Code.
4. Keep `C:\sem4\CodeTrail\codetrail.vsix` ready for the file picker.
5. Open `core.c`, `fair.c`, and the repository `README.md` in editor tabs.
6. Use a clean VS Code profile or hide unrelated extensions, accounts, notifications, terminals, and source-control badges.
7. Use a dark theme and an editor font around 17 px. Keep the CodeTrail panel wide enough to show reasons and confidence labels.
8. Rehearse the complete flow once. Start the recorded take only after both searches and `Alt+Shift+T` return the expected results below.

## Exact shot list and narration

### 0:00-0:18 - Establish the problem

**Actions**

1. Show `core.c`.
2. Press `Ctrl+End` so line `11284` is visible.
3. Briefly move through the minimap.
4. Press `Ctrl+G`, enter `7061`, and press Enter.

**Say**

> This is the real Linux scheduler core, not a hand-written demonstration fixture. `core.c` alone is over eleven thousand lines. Together with `fair.c` and `sched.h`, this workspace contains almost thirty-one thousand lines. Text search can find a function, but it cannot tell me what to read next, what crosses a file boundary, or why two pieces of code are connected.

### 0:18-0:37 - Install the packaged extension

**Actions**

1. Press `Ctrl+Shift+X`.
2. Open the Extensions view `...` menu.
3. Choose **Install from VSIX...**
4. Select `C:\sem4\CodeTrail\codetrail.vsix`.
5. Click **Reload Now**.

Cut file-picker delay, but keep the actual VSIX selection and successful installation visible.

**Say**

> CodeTrail is a packaged VS Code extension that addresses that reading problem directly. I will install the same VSIX that another developer or judge can run.

### 0:37-0:52 - Index the source

**Actions**

1. Press `Ctrl+Shift+P`.
2. Run **CodeTrail: Index Workspace**.
3. Keep the real progress state and completion visible.

**Say**

> I will index this real three-file scheduler workspace. The analysis happens locally and deterministically. There are no API calls, no telemetry, and no AI inside the extension.

### 0:52-1:08 - Run a broad search

**Actions**

1. Enter `schedule` in CodeTrail's search field.
2. Pause on the first result, `__schedule` at `core.c:7061`.
3. Point to its ranking reasons, including `exact symbol phrase`.

**Say**

> The search is deliberately simple. I type "schedule," and CodeTrail ranks `__schedule` first at line 7061, while showing why it matched. This is normal code search, not an imitation of a chatbot.

### 1:08-1:50 - Show the file and function hierarchy

**Actions**

1. Replace the query with `pick task fair`.
2. Select the first result, `pick_task_fair` at `fair.c:9912`.
3. In **File route**, frame these two useful links:
   - `core.c -> fair.c`: `__pick_next_task` calls `pick_task_fair`, with evidence at `core.c:6144`.
   - `sched.h -> fair.c`: `.pick_task` registers `pick_task_fair`, with evidence at `fair.c:15363`.
4. Scroll to **Within files** and frame `pick_task_fair -> pick_next_entity -> pick_eevdf`.
5. Keep `confirmed`, `inferred`, reasons, and evidence counts visible.

**Say**

> Now I will search for the fair scheduler's task-selection behavior. CodeTrail finds `pick_task_fair` at line 9912. The first section tells me how the files connect. `core.c` reaches the implementation in `fair.c`, and the scheduler-class initializer registers `pick_task_fair` as its `pick_task` behavior. Indirect and registration-based links remain visibly inferred. Within `fair.c`, CodeTrail gives me a concrete reading order: `pick_task_fair`, then `pick_next_entity`, then `pick_eevdf`. Those direct calls are source-confirmed. I get hierarchy, confidence, a reason, and exact evidence instead of an unexplained graph.

### 1:50-2:08 - Open the evidence

**Actions**

1. Return to the `core.c -> fair.c` route.
2. Click **Open**.
3. Hold on `core.c:6144`, where the editor shows `p = pick_task_fair(rq, rf);`.

**Say**

> Every relationship is navigable. Clicking Open takes me to line 6144 in the original Linux source, where `__pick_next_task` calls `pick_task_fair`. CodeTrail does not ask me to trust a generated explanation. It takes me to the evidence.

### 2:08-2:31 - Discover from selected code

**Actions**

1. Open `fair.c`.
2. Press `Ctrl+G`, enter `6380`, and press Enter.
3. Select or place the cursor inside `pick_eevdf` in `se = pick_eevdf(cfs_rq, protect);`.
4. Briefly right-click so **CodeTrail: Discover Symbol Links** is visible, then dismiss the menu.
5. Press `Alt+Shift+T`.
6. Frame `pick_eevdf -> entity_eligible -> vruntime_eligible` and their confirmed relationship reasons.
7. If visible without extra scrolling, frame the `CONFIG_ARCH_SUPPORTS_INT128` guard.

**Say**

> Search is only one entry point. While reading `fair.c`, I can select `pick_eevdf`, right-click, or press Alt-Shift-T. CodeTrail immediately reconstructs its trail: `pick_eevdf` calls `entity_eligible`, which calls `vruntime_eligible`. It also preserves relevant preprocessor guards. I never have to leave the code I am reading.

### 2:31-2:42 - State the trust boundary

**Actions**

Frame `Static reading order; not a runtime trace.` and one visible traversal warning.

**Say**

> The result is intentionally bounded and honest. Inferred links stay inferred, analysis limits stay visible, and CodeTrail calls this a static reading order, not a runtime trace.

### 2:42-2:54 - Explain Codex and GPT-5.6

**Actions**

Show the **Built with Codex and GPT-5.6** section in `README.md`. Keep the development and marketplace publication evidence readable.

**Say**

> GPT-5.6 drove the product ideation and progression. Codex with GPT-5.6 implemented, tested, debugged, packaged, and verified the project. With my authorization, it also created the publisher account and published CodeTrail to Visual Studio Marketplace and Open VSX. The shipped extension itself has no AI runtime.

### 2:54-2:58 - Close on the product

**Actions**

Return to the completed `pick_eevdf` trail. Do not end on a logo card.

**Say**

> CodeTrail: the shortest evidence-backed path through unfamiliar C code.

## Required visible proof

The final cut must visibly contain all of these:

- installation from `codetrail.vsix`
- indexing of the three-file workspace
- `schedule` returning `__schedule` first
- `pick task fair` returning `pick_task_fair` first
- file route before within-file path
- confirmed and inferred confidence labels
- at least one **Open** jump to exact source
- the editor context-menu item
- `Alt+Shift+T` on `pick_eevdf`
- the static-analysis disclaimer and a visible bound
- the README's Codex and GPT-5.6 disclosure

## Stop conditions and recovery

Do not record around a product failure. Stop and correct the setup if any item below occurs.

| Symptom | Recovery |
|---|---|
| CodeTrail commands are missing | Confirm the VSIX installed successfully, then reload VS Code. |
| Workspace shows more than three indexed C files | Reopen `C:\sem4\CodeTrail\test` as the only workspace folder and reindex. |
| `schedule` does not rank `__schedule` first | Confirm the three files match this repository and run **CodeTrail: Index Workspace** again. |
| The keyboard shortcut does nothing | Put editor focus inside `pick_eevdf` in the C file and use `Alt+Shift+T`. |
| An old result remains in the panel | Use the persistent search field or click **Reindex** before continuing. |
| The panel says no cross-file link was found | Reindex all three files together; do not open one file as a standalone workspace. |
| A traversal-limit warning appears | Keep it visible. It is expected bounded behavior, not a failed analysis. |

## Editing rules

- Record each timed section as a separate clip.
- Cut dead cursor travel and file-picker delay, but do not fabricate results or replace real progress with animation.
- Use burned-in captions and no background music unless speech remains completely clear.
- Do not call the output an execution path, runtime trace, complete call graph, or whole-kernel analysis.
- Do not claim general multi-language support. The current release is C-first.
- Do not make MCP a separate product demo. It is a secondary adapter and is intentionally omitted from this tight recording.
