# CodeTrail: Product and Build Week Master Plan

Date: 14 July 2026
Status: Approved product direction; implementation planning pending
Category: Developer Tools
Build Week deadline: 21 July 2026

## 1. Executive decision

CodeTrail is a local-first, language-extensible codebase comprehension tool. It turns a developer's concrete question into the smallest evidence-backed path through the relevant code.

The product is not limited to the Linux kernel or to C. Its architecture separates language-independent retrieval, graph traversal, trail construction, evidence, persistence, and user experience from language-specific analysis adapters.

The Build Week implementation will prove that architecture with:

- a first-class GNU C adapter;
- a kernel-aware enrichment layer;
- a focused demonstration on the Linux scheduler;
- an optional Clang semantic provider when compile metadata exists;
- a structural fallback that remains useful without building or executing the repository.

The product does not call Codex or an OpenAI API at runtime. Codex is used throughout the development lifecycle: product design, architecture, implementation, test generation, adversarial review, debugging, performance work, documentation, and submission preparation.

## 2. Core promise

> Do not explain the whole repository. Show the developer the smallest code path they need to understand for the task at hand.

The primary one-line description is:

> CodeTrail turns an engineering question into a focused, evidence-backed trail through an unfamiliar codebase.

The technical description is:

> CodeTrail is a local graph-retrieval engine for source code. Language adapters extract symbols and typed relationships; deterministic retrieval and bounded graph traversal assemble the smallest useful investigation trail.

## 3. Why this product should exist

### 3.1 The real problem

Developers working in unfamiliar systems code rarely struggle to open files. They struggle to determine:

- where a behavior begins;
- which indirect calls and registrations connect the path;
- which macros or build conditions change the path;
- which state is read or mutated;
- where control crosses a subsystem boundary;
- which tests or documentation support the behavior;
- which relationships are certain and which are only plausible;
- what to read first without opening dozens of irrelevant files.

Search, definitions, references, call hierarchies, documentation, and debuggers each expose fragments. The developer must manually combine them into a mental model.

### 3.2 Initial high-value audience

The first users are:

- systems-programming students studying operating-system internals;
- developers entering a large C or C++ codebase;
- kernel contributors investigating a subsystem before editing it;
- maintainers reviewing unfamiliar paths;
- security researchers tracing data and control flow;
- incident responders moving from a symptom or symbol to relevant implementation;
- consultants and engineers who repeatedly enter unfamiliar repositories.

### 3.3 Why the Linux scheduler is the right proof

The scheduler is a credible stress case:

- behavior spans multiple large C and header files;
- relationships use direct calls, macros, designated initializers, function pointers, and configuration gates;
- the code has extensive state and concurrency concerns;
- official documentation provides a reference mental model;
- the problem is personally authentic for the product owner;
- a successful focused trail is visually and technically compelling.

The scheduler is the reference implementation target, not the permanent market boundary.

## 4. Product principles

1. Task before topology. Every investigation starts with a question, selected symbol, error, or issue.
2. Trail before graph. The primary output is an ordered reading path, not a force-directed graph.
3. Evidence before explanation. Every node and relationship links to exact source or explicit extraction evidence.
4. Uncertainty is data. Confirmed, probable, inferred, and unresolved relationships are visibly different.
5. Local by default. Core indexing, retrieval, graph construction, and navigation work without source upload.
6. Do not execute untrusted code. Indexing never runs repository scripts, binaries, tests, or build steps automatically.
7. Progressive disclosure. Show the primary path first; reveal branches, macros, state, tests, and diagnostics on demand.
8. Language-extensible, not language-vague. Claim only adapters that actually work while keeping the core independent of language.
9. Deterministic before semantic enhancement. Identical repository state, query, and settings should produce stable results.
10. Minimal and productive. Every visible element must help the developer find, verify, or continue the path.

## 5. Scope contract

### 5.1 Product scope

The product vision supports multiple languages through adapters. The language-neutral core owns:

- repository discovery;
- searchable documents;
- normalized graph nodes and typed edges;
- evidence and confidence;
- query modes;
- candidate fusion and ranking;
- bounded graph expansion;
- primary-trail and branch construction;
- source navigation;
- index snapshots and user state;
- diagnostics and performance reporting.

Language adapters own:

- parsing and declaration extraction;
- symbol identity;
- direct and indirect relationship extraction;
- language-specific source evidence;
- build metadata integration;
- domain-specific enrichers;
- limitations and confidence assignment.

### 5.2 Build Week scope

The Build Week release supports GNU C repositories, with kernel-aware behavior demonstrated on a selected Linux scheduler scope.

The supported analysis boundary is:

- all C and header files under a user-selected root;
- scheduler files under kernel/sched for the primary demo;
- directly referenced local headers when they are inside configured repository boundaries;
- repository documentation indexed as supporting text;
- compiler enrichment when compile commands are already available or explicitly supplied.

### 5.3 Explicit non-goals for the week

- Whole-kernel perfect call-graph completeness.
- Full C++ support.
- Runtime tracing or kernel execution.
- Automatic repository configuration or builds.
- Code generation, patching, or refactoring.
- Chat, generated repository summaries, or an LLM answer surface.
- Hosted accounts, collaboration, telemetry, or cloud indexing.
- A full dependency graph canvas.
- Semantic embeddings.
- Change-impact, data-flow, structural-diff, and architecture modes as separate polished products.

These are excluded to protect the one complete workflow.

## 6. The minimum coherent product

A submission is coherent only if a developer can:

1. Open a repository or scoped subsystem in VS Code.
2. See exactly what CodeTrail will index and what it will ignore.
3. Start local indexing and observe progress.
4. Enter a natural-language engineering question or select a C symbol.
5. See ranked candidate entry points with deterministic reasons.
6. Confirm the intended seed.
7. Generate a small ordered trail with a primary path and collapsed branches.
8. Inspect confidence, extraction provider, and exact source evidence for every step.
9. Open the correct source range in VS Code.
10. See relevant macros, function-pointer mappings, state touches, documentation, and unresolved relationships.
11. Reload the extension and retain the stable index.
12. Complete the same workflow with the network disabled.

If any of steps 4 through 9 are missing, the project is not ready to submit.

## 7. Primary experience

### 7.1 First run

1. CodeTrail detects the workspace root and C/header file counts.
2. The user selects a scope. For the demo, this is kernel/sched plus approved headers.
3. CodeTrail explains that analysis is local and will not execute the repository.
4. The user starts indexing.
5. Progress reports discovery, parsing, structural edges, kernel enrichment, search indexing, and finalization.
6. Search becomes available after declarations and searchable documents are ready.
7. The status area reports index freshness, files indexed, warnings, and whether Clang enrichment is active.

### 7.2 Question to trail

1. The user enters: "How does the Linux fair scheduler choose the next task?"
2. CodeTrail normalizes the query and searches symbol names, comments, paths, macros, documentation, and structural context.
3. Candidate seeds appear with reasons such as identifier match, scheduler-role match, documentation match, or proximity to known dispatch structures.
4. The user confirms the intended entry point.
5. CodeTrail performs mode-aware bounded traversal.
6. The trail builder selects the highest-confidence coherent path and separates alternate dispatch, configuration, and unresolved branches.
7. The main panel presents the ordered path.
8. Selecting a step opens evidence and the exact source range.
9. Expanding a relationship shows its provider, confidence, and alternatives.

### 7.3 Symbol-first use

1. The user places the cursor inside a function or structure field.
2. "Open in CodeTrail" resolves the symbol through the active C adapter.
3. CodeTrail shows callers, callees, macro relations, state touches, dispatch-table membership, and relevant documentation.
4. The symbol becomes a seed for a focused trail.

### 7.4 No-result and partial-result behavior

- No matching seed: show searched evidence fields and suggest exact symbols or a narrower scope.
- Ambiguous seed: require user confirmation rather than guessing silently.
- Parser failure: retain all valid results and show file-level diagnostics.
- Missing compile metadata: continue in structural mode and label semantic resolution as unavailable.
- Dynamic dispatch: show a probable candidate set and the evidence behind it.
- Oversized result: preserve the primary trail, report omitted categories, and require deliberate expansion.
- Stale source: mark the index stale and prevent navigation to an unverified old range.

## 8. Minimal interface

The product uses three surfaces.

### 8.1 Activity Bar view

Contains:

- repository and scope;
- index status;
- question field;
- candidate seeds;
- recent trail;
- diagnostics count.

### 8.2 Trail editor

The dominant surface is a vertical ordered trail. Each row contains:

- step number;
- symbol or synthetic boundary;
- role;
- file and line;
- relation from the previous step;
- confidence label;
- badges for macro, dispatch, state, branch, documentation, or unresolved evidence.

Branches appear directly beneath the step that creates them. They are collapsed by default.

### 8.3 Evidence panel

Contains:

- declaration and signature;
- exact file and source range;
- relationship explanation;
- provider name and version;
- confidence and ambiguity;
- incoming and outgoing relations;
- related macros and dispatch mappings;
- state reads and writes;
- relevant documentation;
- "Open source" and "Use as seed" actions.

There is no decorative full-graph view in the Build Week release.

## 9. Architecture

### 9.1 Layered hybrid

CodeTrail uses a language-neutral graph core with layered evidence providers.

Processing order:

1. Repository discovery.
2. Scope and exclusion resolution.
3. File hashing.
4. Structural parsing.
5. Language adapter extraction.
6. Optional compiler/LSP enrichment.
7. Domain enrichment.
8. Search-document construction.
9. Index finalization.
10. Candidate retrieval.
11. Bounded typed traversal.
12. Trail construction.
13. Evidence rendering and source navigation.

### 9.2 Components

#### Extension host

Owns VS Code commands, workspace events, configuration, source navigation, lifecycle, and the webview bridge.

#### Index coordinator

Owns file discovery, generation IDs, cancellation, progress, stable promotion, and incremental invalidation.

#### Analysis worker

Runs parsing and extraction in a Node worker thread away from the responsive UI path. Communication is message-based so the worker can move to a child process later without changing product contracts.

#### Adapter registry

Selects one or more language adapters based on files and configuration. It normalizes adapter output into core contracts.

#### C structural provider

Uses Tree-sitter C compiled to WebAssembly to avoid platform-specific native packaging. It extracts:

- functions and declarations;
- parameters and return types as written;
- structs, unions, enums, fields, typedefs, and global variables;
- call expressions;
- assignments and field access;
- includes;
- preprocessor directives and macro invocations;
- comments and source ranges.

#### Clang semantic provider

Activates only when usable compile metadata is supplied. It enriches:

- canonical symbol identity;
- definitions and references;
- resolved direct calls;
- types and aliases;
- include resolution;
- candidate targets for selected indirect relationships;
- compiler diagnostics.

Structural results remain available when this provider is inactive.

#### Kernel scheduler enricher

Recognizes evidence patterns important to the demo:

- scheduler-class declarations and designated initializer mappings;
- function-pointer fields mapped to concrete implementations;
- configuration guards;
- macro-defined declarations;
- scheduling-role hints;
- relevant state structures and mutations;
- documentation links by symbol and concept.

The enricher emits normal graph nodes and edges. It does not bypass core contracts.

#### Search engine

Owns normalization, lexical retrieval, fuzzy identifier matching, field weighting, result fusion, score explanations, and stable ranking versions.

#### Graph engine

Owns adjacency, typed traversal, edge costs, cycle handling, node budgets, diversity quotas, and omitted-result summaries.

#### Trail builder

Owns primary-path selection, branch grouping, reading order, and deterministic "why next" reasons.

#### Index store

Is accessed through an interface rather than directly by higher layers. The Build Week backend writes a versioned, gzip-compressed JSON snapshot into VS Code workspace storage and reconstructs in-memory symbol, search, and adjacency indexes on activation. This removes native database packaging risk while preserving restart persistence. A SQLite-backed implementation replaces this backend after the hackathon without changing higher layers.

#### Webview implementation

Uses vanilla TypeScript, semantic HTML, and CSS bundled with the extension. The Build Week interface does not require a frontend framework or graph-layout library.

## 10. Core contracts

### 10.1 Node

Every node includes:

- stable ID;
- adapter and provider;
- kind;
- display and qualified name;
- file and exact source range when applicable;
- role;
- searchable fields;
- content hash;
- generation ID;
- provider-specific metadata kept behind a typed boundary.

Initial node kinds include function, macro, struct, union, enum, typedef, field, variable, file, documentation section, dispatch table, configuration guard, external symbol, and unresolved target.

### 10.2 Edge

Every edge includes:

- source and optional target;
- explicit type;
- confidence label and numeric confidence;
- evidence location;
- extraction provider and version;
- deterministic explanation;
- ambiguity or unresolved reason;
- generation ID.

Initial edge types include:

- CONTAINS;
- INCLUDES;
- DECLARES;
- CALLS;
- MAY_CALL;
- EXPANDS_MACRO;
- CONFIGURES;
- REGISTERS_HANDLER;
- DISPATCHES_TO;
- READS;
- WRITES;
- REFERENCES_TYPE;
- DOCUMENTS;
- ALTERNATIVE_TO.

### 10.3 Confidence

- Confirmed: direct syntax or compiler resolution supports one target.
- Probable: strong evidence supports one or more candidates.
- Inferred: a known pattern or domain rule supports the relation.
- Unresolved: the relation exists but CodeTrail cannot identify a supported target.

Confidence affects ranking and default expansion but never hides evidence.

## 11. Search and ranking

### 11.1 Searchable fields

Each symbol is indexed with separate weights:

- exact name;
- identifier subtokens;
- declaration text;
- path;
- comments;
- macro names and arguments;
- struct and field context;
- documentation concepts;
- structural neighbors;
- kernel role labels.

### 11.2 Candidate retrieval

Retrieval proceeds in parallel:

- exact qualified-name search;
- fuzzy identifier search;
- weighted lexical search;
- path and file search;
- macro and configuration search;
- documentation search.

Results are deduplicated by stable symbol identity.

### 11.3 Candidate ranking

The initial ranking favors:

1. exact identifiers;
2. strong lexical matches;
3. scheduler-relevant roles;
4. documentation correspondence;
5. graph proximity to high-confidence entry or dispatch nodes;
6. evidence quality;
7. source-scope relevance.

Generic utilities, generated files, external declarations, and unsupported regions receive penalties.

Every candidate exposes the contributing reasons. Weights are versioned and covered by a gold query set.

## 12. Bounded graph and trail construction

### 12.1 Default graph limits

- Visible node target: 12 to 24.
- Default traversal depth: 3.
- Pinned nodes may exceed the budget.
- External and unresolved clusters are collapsed.
- Cycles appear once as a group.

### 12.2 Diversity quotas

The graph budget reserves capacity for:

- the selected entry or seed;
- direct implementation;
- dispatch boundaries;
- key state;
- meaningful terminal behavior;
- one high-value branch;
- unresolved relationships;
- supporting documentation.

### 12.3 Trail selection

1. Start from the confirmed seed.
2. Identify high-value targets based on the question and role.
3. Generate candidate paths with edge-type and confidence costs.
4. Prefer coherent paths that preserve control or conceptual continuity.
5. Select one primary path.
6. Retain materially distinct alternatives as branches.
7. Place dispatch and uncertainty boundaries explicitly.
8. Attach a deterministic reason to every transition.

The trail is a recommended static reading order, not a claimed runtime trace.

## 13. Demo repository and gold set

### 13.1 Repository policy

The demo uses the upstream Linux kernel source at one pinned commit. The commit identifier is recorded in demo/kernel-commit.txt before analyzer implementation begins. The repository itself is not vendored into CodeTrail.

The primary index scope is kernel/sched plus the local headers required by the selected gold path.

### 13.2 Gold question

Primary question:

> How does the Linux fair scheduler choose the next task?

Before implementing ranking, the pinned source is manually inspected and the expected seed, required path nodes, dispatch edges, state evidence, documentation evidence, and unacceptable distractors are recorded in a versioned gold fixture.

### 13.3 Secondary gold questions

- Where is EEVDF eligibility checked?
- Which function selects the earliest virtual deadline?
- How is the fair scheduler registered with scheduler-class dispatch?
- Which scheduler state fields influence task selection?

Secondary queries are regression tests, not separate demo stories.

### 13.4 Honest validation

The demo must show:

- at least one direct confirmed call;
- at least one macro or designated-initializer relationship;
- at least one function-pointer or dispatch relationship;
- at least one state relationship;
- at least one documentation relationship;
- at least one visible uncertainty or limitation.

This prevents the demo from being a disguised text search.

## 14. Codex development lifecycle

Codex use must be visible in repository artifacts and engineering quality, without becoming performative.

### 14.1 Repository guidance

Create AGENTS.md before implementation with:

- architecture boundaries;
- source safety rules;
- supported scope;
- test commands;
- evidence and confidence requirements;
- no-overclaim language;
- completion and verification gates.

### 14.2 Decision records

Material choices receive concise architecture decision records:

- parser and packaging;
- index persistence;
- worker model;
- webview stack;
- symbol identity;
- confidence semantics;
- kernel-enrichment rules.

Each record includes context, options, decision, consequences, and revisit trigger.

### 14.3 Build log

Maintain docs/build-with-codex.md. Each meaningful Codex work unit records:

- objective;
- context supplied;
- files changed;
- tests or measurements run;
- review findings;
- human decision or correction;
- resulting commit.

Do not publish raw private conversation transcripts or claim that Codex made unverified decisions.

### 14.4 Codex work sequence

For each implementation slice:

1. Codex inspects current contracts and tests.
2. Codex writes or updates a failing test.
3. Codex implements the narrow slice.
4. Codex runs targeted verification.
5. Codex performs a separate correctness and scope review.
6. Codex records limitations and follow-up risks.
7. The human reviews product behavior and approves any externally visible claim.

### 14.5 Submission evidence

The submission demonstrates thoughtful Codex use through:

- the architecture and decision trail;
- systematic tests;
- gold-set regression;
- adversarial fixtures;
- measured performance iteration;
- code-review fixes;
- the curated build log;
- a clear explanation that Codex accelerated development while CodeTrail remains deterministic at runtime.

## 15. Testing strategy

### 15.1 Unit tests

Cover:

- identifier tokenization;
- C declaration extraction;
- source ranges;
- stable IDs;
- call extraction;
- macro extraction;
- edge confidence;
- query scoring;
- graph pruning;
- cycle grouping;
- trail ordering;
- deterministic explanations.

### 15.2 Analyzer fixtures

Use small original C fixtures for:

- direct calls;
- forward declarations;
- header declarations;
- macros wrapping calls;
- conditional compilation;
- designated initializers;
- function-pointer tables;
- indirect dispatch;
- struct-field reads and writes;
- duplicate names in different files;
- malformed or partial source;
- unresolved external declarations.

Fixtures must not depend on the full Linux repository.

### 15.3 Kernel gold tests

Against the pinned repository:

- expected seed appears in the top five;
- required trail nodes are present;
- known distractors are omitted;
- each displayed edge navigates to valid evidence;
- trail order matches the reviewed gold order;
- identical runs produce stable results;
- structural-only mode continues to work without compile metadata.

### 15.4 Integration tests

Cover the pipeline:

- discover;
- parse;
- enrich;
- index;
- search;
- select seed;
- build graph;
- construct trail;
- serialize result;
- restore stable index;
- navigate source.

### 15.5 Extension tests

Cover:

- commands and activation;
- indexing cancellation;
- state transitions;
- webview messages;
- stale index behavior;
- source navigation;
- reload restoration;
- keyboard navigation;
- empty, error, partial, and oversized states.

### 15.6 Performance tests

Measure on the presentation machine:

- discovery time;
- time to usable index;
- full scoped index time;
- warm and cold query latency;
- trail-build latency;
- memory use;
- index size;
- single-file re-index time.

Targets are not public claims until measured.

## 16. Product quality targets

For the selected scheduler scope:

- exact-symbol lookup feels immediate;
- ranked query returns without a blocking wait after warm-up;
- default trail builds in under one second where practical;
- every visible source link is correct;
- repeated query results are stable;
- the extension survives a webview reload;
- indexing can be cancelled safely;
- structural mode works without network or Clang metadata;
- keyboard access covers the full golden workflow;
- errors identify a next action.

## 17. Privacy, security, and trust

- Never run make, scripts, tests, binaries, or post-install hooks during indexing.
- Normalize paths and remain inside approved workspace roots.
- Do not follow external symlinks without explicit user action.
- Apply file-size and parse-work limits.
- Escape all source rendered in the webview.
- Use a strict content security policy and validate webview messages.
- Store indexes locally with clear deletion controls.
- Collect no source, query, path, graph, or note telemetry.
- Do not label a static trail as runtime behavior.
- Do not claim complete coverage of macros, configuration, or indirect dispatch.

## 18. Seven-day execution plan

### Day 1: Product foundation and gold truth

Outcome: a runnable repository with frozen contracts and a manually verified demo target.

Sequence:

1. Initialize the extension and package structure.
2. Add AGENTS.md, architecture boundaries, and verification commands.
3. Pin the Linux kernel commit and scope.
4. Manually establish the primary gold path and distractors.
5. Define core Node, Edge, Evidence, Candidate, Graph, and Trail contracts.
6. Create original C analyzer fixtures.
7. Validate packaging for Tree-sitter C WebAssembly, the worker thread, compressed snapshots, and the vanilla webview.
8. Record the selected architecture decisions and any measured packaging constraints.

Exit gate:

- extension launches;
- fixtures run;
- gold path is documented;
- parser can parse representative scheduler syntax;
- no unresolved packaging risk blocks the vertical slice.

### Day 2: C structural analysis

Outcome: files become normalized symbols and structural relationships.

Sequence:

1. Implement repository discovery, scope, exclusions, and hashing.
2. Implement function, type, variable, field, include, macro, and source-range extraction.
3. Implement direct call, reference, read, and write edges.
4. Add provider evidence and confidence.
5. Add cancellation and parse diagnostics.
6. Verify all analyzer fixtures.

Exit gate:

- a CLI or test harness emits correct graph facts for fixtures and selected scheduler files;
- every edge contains evidence;
- malformed files do not fail the full index.

### Day 3: Kernel enrichment and search

Outcome: the natural-language question retrieves credible scheduler seeds.

Sequence:

1. Implement scheduler-class and designated-initializer recognition.
2. Implement macro and configuration-boundary representation.
3. Implement dispatch-table mapping.
4. Build weighted symbol documents and deterministic query normalization.
5. Implement exact, fuzzy, and lexical retrieval.
6. Implement candidate fusion, ranking, and reasons.
7. Add gold seed and distractor tests.

Exit gate:

- the primary seed appears in the top five;
- ranking reasons are inspectable;
- results remain stable across repeated runs.

### Day 4: Graph budgeting and trail construction

Outcome: the selected seed produces a small readable trail.

Sequence:

1. Implement typed adjacency and bounded traversal.
2. Implement confidence-aware edge costs.
3. Implement role and evidence diversity quotas.
4. Implement cycle and unresolved-target groups.
5. Implement primary-path selection and branch grouping.
6. Implement deterministic "why next" reasons.
7. Add gold required-node, distractor, and order tests.

Exit gate:

- required gold nodes fit inside the default budget;
- the primary path is readable without a full graph;
- branches and uncertainty are separated.

### Day 5: Complete VS Code experience

Outcome: the full golden workflow works inside VS Code.

Sequence:

1. Implement indexing commands and status.
2. Implement question entry and candidate selection.
3. Implement the vertical trail editor.
4. Implement evidence detail.
5. Implement exact source navigation.
6. Implement symbol-first context command.
7. Implement partial, stale, empty, and failure states.
8. Implement index restoration and keyboard navigation.

Exit gate:

- question to source works end to end;
- every golden trail step opens the correct range;
- reload preserves the stable index;
- the product looks coherent rather than like a debug panel.

### Day 6: Reliability, measurement, and adversarial review

Outcome: the project is defensible under judge scrutiny.

Sequence:

1. Run the complete automated test suite.
2. Add adversarial macro, pointer, duplicate-symbol, and malformed-file fixtures.
3. Run security and webview message review.
4. Measure indexing, query, trail, memory, and disk behavior.
5. Profile and fix the largest bottleneck only.
6. Test with network disabled.
7. Test from a clean install and clean repository clone.
8. Conduct a small before/after navigation exercise.
9. Record limitations and measured results.

Exit gate:

- no critical defect remains in the golden workflow;
- all public performance claims have measurements;
- source and confidence claims are accurate;
- offline operation is demonstrated.

### Day 7: Submission and demonstration

Outcome: a clear, reproducible submission.

Sequence:

1. Freeze the demo commit and extension build.
2. Run the go/no-go checklist.
3. Record the final demo video.
4. Capture a backup recording and static evidence image.
5. Finalize README, architecture diagram, build-with-Codex log, limitations, and setup.
6. Prepare the concise project description.
7. Rehearse the demo to time.
8. Submit the repository, video, description, and required materials.

No new feature may be started on Day 7.

## 19. Demo plan

### 19.1 Story

1. Start with the real problem: understanding scheduler behavior without reading the subsystem linearly.
2. Show the pinned Linux repository and scoped local index.
3. Disconnect or visibly disable network access.
4. Ask the primary question.
5. Show ranked candidates and why the correct seed ranked highly.
6. Generate the trail.
7. Follow the direct path into fair-scheduler and EEVDF selection logic.
8. Expand the scheduler-class dispatch relationship.
9. Show an exact source edge and one uncertain relationship.
10. Open source for several steps.
11. Conclude with measured navigation improvement and the multi-language adapter architecture.

### 19.2 Time allocation

- Problem and audience: 15 percent.
- Live product workflow: 50 percent.
- Technical implementation: 20 percent.
- Evidence and Codex development lifecycle: 10 percent.
- Closing vision: 5 percent.

### 19.3 Backup

- Keep the index prebuilt and validated.
- Keep a local copy of the pinned source.
- Keep a clean recorded demo.
- Keep one static trail/evidence image.
- Keep the gold regression output.

## 20. Judging-criteria strategy

### 20.1 Technological implementation

Evidence:

- real C parsing;
- optional compiler semantics;
- kernel-specific indirect dispatch extraction;
- typed evidence graph;
- deterministic search ranking;
- budgeted graph traversal;
- trail construction;
- source navigation;
- fixtures, integration tests, and gold regression;
- documented Codex-assisted engineering lifecycle.

Judge takeaway:

> This is a working non-trivial developer tool whose depth is visible in both code and behavior.

### 20.2 Design

Evidence:

- a complete first-run and investigation flow;
- candidate confirmation instead of silent guessing;
- a stable ordered trail;
- progressive branches;
- exact evidence;
- meaningful empty, partial, stale, and failure states;
- keyboard-accessible actions;
- persistence and offline use.

Judge takeaway:

> This is a coherent product a developer can run, not a graph algorithm wrapped in a demo page.

### 20.3 Potential impact

Evidence:

- authentic founder problem;
- a defined systems-code audience;
- a real kernel repository;
- before/after time, files-opened, and required-node measurements;
- a credible adapter path to additional languages.

Judge takeaway:

> The demonstrated workflow reduces a costly and recurring form of developer uncertainty.

### 20.4 Quality of the idea

Evidence:

- task-specific trails instead of whole-repository diagrams;
- evidence and uncertainty instead of generated prose;
- static structure plus domain-aware dispatch reasoning;
- local operation;
- an honest understanding of compiler and kernel-analysis limits.

Judge takeaway:

> The team understands why existing navigation tools fail and has chosen a focused, technically appropriate solution.

## 21. Known shortcomings and responses

### 21.1 Static analysis cannot prove runtime behavior

Response: use "static trail," expose confidence, and never hide unresolved dispatch.

### 21.2 Kernel configuration changes the compiled program

Response: record the active analysis configuration when compile metadata exists; otherwise show configuration guards as visible branches.

### 21.3 Macros can obscure declarations and calls

Response: preserve macro nodes and invocation evidence; resolve only supported patterns.

### 21.4 Function pointers create multiple possible targets

Response: recognize designated-initializer and dispatch-table mappings, rank candidates, and keep ambiguity visible.

### 21.5 Structural parsing is less precise than a configured compiler

Response: make Clang enrichment additive while retaining a useful zero-configuration fallback.

### 21.6 Whole-kernel indexing may be slow or noisy

Response: make scope selection a first-class product feature and demonstrate the scheduler subsystem.

### 21.7 Natural-language lexical search can miss synonyms

Response: combine comments, documentation, paths, roles, and graph context. Add local semantic retrieval only after the deterministic core is proven.

### 21.8 Multi-language architecture is not multi-language support

Response: say "language-extensible, C-first." Do not list a language as supported until its adapter passes acceptance fixtures.

### 21.9 C++ is not included in the first release

Response: the Clang provider and language-neutral contracts are designed for reuse, but a C++ adapter must separately address overloads, templates, namespaces, methods, inheritance, and generated instantiations.

## 22. Go/no-go checklist

The project may be submitted only when:

- the extension installs and activates from a clean build;
- the selected repository indexes without executing code;
- the primary query returns the expected seed in the top five;
- the default trail includes every required gold node;
- distractors remain below the agreed threshold;
- every visible edge has valid evidence or an unresolved label;
- every source action opens the correct current range;
- the extension restores the stable index after reload;
- the core workflow works with network disabled;
- tests pass;
- measured performance is acceptable on the presentation machine;
- the demo video fits the submission limit;
- the README states setup, supported scope, limitations, and architecture;
- the build-with-Codex evidence is accurate and reviewable;
- no submission claim exceeds demonstrated behavior.

If time is short, cut optional Clang enrichment before cutting structural evidence, search reasons, trail readability, or source navigation.

## 23. Post-hackathon roadmap

### Phase 1: Stronger C

- compile-database workflow;
- incremental re-indexing;
- richer preprocessor configuration;
- improved alias and pointer analysis;
- test and documentation association;
- whole-repository scale work.

### Phase 2: C++ adapter

- methods and namespaces;
- overload resolution;
- inheritance and virtual dispatch;
- templates and specialization evidence;
- CMake and compile-database onboarding.

### Phase 3: Additional language adapters

- TypeScript through the TypeScript compiler API;
- Go through Go package and type information;
- Rust through rust-analyzer or compiler-derived data;
- Python through structural and type-checker providers.

### Phase 4: Additional investigation modes

- data flow;
- change impact;
- structural diff;
- related tests;
- saved investigations;
- architecture views.

### Phase 5: Team and ecosystem

- read-only extension API;
- exportable trails;
- shared reviewed trails without uploading source by default;
- adapter SDK;
- community adapters and domain enrichers.

## 24. Final submission language

### Short description

CodeTrail is a local-first VS Code tool that turns an engineering question into the smallest evidence-backed path through an unfamiliar codebase. Its language-adapter architecture combines structural parsing, optional compiler semantics, deterministic retrieval, and typed graph traversal. The Build Week release proves the approach on Linux scheduler code, including macros, function-pointer dispatch, state relationships, source provenance, and visible uncertainty.

### Closing line

> Built with Codex. Grounded in code. Designed to show only the path that matters.

## 25. References

- OpenAI Build Week: https://openai.com/build-week/
- Linux kernel programming language: https://docs.kernel.org/process/programming-language.html
- Building Linux with Clang/LLVM: https://docs.kernel.org/kbuild/llvm.html
- Linux scheduler documentation: https://docs.kernel.org/scheduler/
- EEVDF scheduler: https://docs.kernel.org/scheduler/sched-eevdf.html
- Linux kernel source: https://github.com/torvalds/linux
