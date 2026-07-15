# CodeTrail Relationship Discovery and Product Polish Design

**Date:** 2026-07-15
**Status:** Approved through delegated product authority
**Scope:** Search correctness, cross-file discovery, within-file hierarchy, editor entry points, and a minimal VS Code-native interface

## 1. Outcome

CodeTrail will turn a code search into two levels:

1. Show how the relevant files connect.
2. Show the ordered and branched symbol relationships inside those files.

The same discovery must be available directly from a C function definition through CodeLens, the editor context menu, and a keyboard shortcut. The panel must feel like a focused VS Code inspection surface rather than a landing page.

## 2. Product Decisions

### 2.1 Chosen approach: progressive relationship outline

The result surface uses progressive disclosure:

- a compact file route first;
- symbol paths grouped by file second;
- exact evidence and source navigation within each symbol row;
- bounded related branches instead of an unrestricted graph.

This retains CodeTrail's minimal product character while making repository topology visible.

### 2.2 Rejected alternatives

**Full repository graph:** rejected because dense graphs obscure reading order, perform poorly in narrow editor panels, and encourage decorative visualization.

**Separate repository explorer:** rejected for the Build Week release because it adds another navigation model without strengthening the question-to-evidence loop.

**Flat trail with file badges:** rejected because it does not explain why files are connected and keeps the product centered on individual symbols.

## 3. Information Architecture

### 3.1 Persistent search toolbar

Every usable state shows a compact header containing:

- `CodeTrail`;
- local index status;
- a single-line code search input;
- a `Search` action;
- a secondary reindex action.

There is no marketing headline inside the working product surface. A user can run another search without reopening a command.

### 3.2 Candidate confirmation

Search results appear as dense selectable rows. Each row contains:

- symbol and kind;
- file and line;
- compact relevance explanation;
- deterministic score only when useful for diagnosis.

The first result receives focus. The UI shows unique candidates only.

### 3.3 File route

After a seed is selected, the first result section is `File route`. It projects cross-file symbol edges into file-level links.

Each link contains:

- source file;
- target file;
- relationship kind;
- confidence;
- the exact source-backed reason;
- the number of supporting symbol edges when links collapse together.

If the bounded neighborhood contains only one file, the section states that the discovered path is local to that file instead of fabricating a cross-file route.

### 3.4 Within-file paths

The second section is `Within files`. Symbols are grouped by path in file-route order. Each group contains:

- ordered main-trail symbols;
- incoming and outgoing relationship direction;
- relationship kind and confidence as text, not decorative pills;
- signature, evidence reason, and line range;
- `Open` source action.

The main path remains ordered and readable. A bounded set of related incoming or outgoing branches may appear beneath the relevant symbol. Cycles are never expanded repeatedly.

## 4. Core Relationship Model

The existing `CodeNode` and `CodeEdge` contracts remain authoritative. A new discovery projection derives presentation-neutral file and hierarchy structures from a bounded subgraph.

```ts
type FileLink = Readonly<{
  sourcePath: string;
  targetPath: string;
  kinds: readonly CodeEdgeKind[];
  confidence: Confidence;
  reason: string;
  evidenceCount: number;
}>;

type FileSection = Readonly<{
  path: string;
  steps: readonly TrailStep[];
  relatedEdgeIds: readonly string[];
}>;

type CodeDiscovery = Readonly<{
  trail: Trail;
  fileLinks: readonly FileLink[];
  fileSections: readonly FileSection[];
}>;
```

File links are derived only from edges whose endpoints have different paths. Confidence collapses to the least certain supporting relationship so uncertainty is not hidden. Ordering is deterministic: main-trail file order, edge priority, path, then stable ID.

## 5. Search Correctness

Search remains local, lexical, deterministic, and explainable.

The product is keyword-first rather than conversational. The visible input asks for symbols, files, and relationship terms. Common source vocabulary is normalized, including `schedule`, `scheduled`, and `scheduling` to the kernel abbreviation `sched`. Direct symbol, signature, summary, and path matches rank first. Typed one-hop neighbors may appear with an explicit relationship reason so a matched header field can expose its registered implementation. The UI requests at most 20 deterministic results. Longer natural-language input may still tokenize, but it is not presented as a conversational interface.

Required behavior:

- deduplicate candidates by stable node ID before limiting results;
- prevent reference-only `struct` occurrences from becoming repeated declarations;
- normalize common morphology such as `registered`, `registration`, and `register`;
- normalize scheduler vocabulary such as `choose` to `pick`;
- support bounded one-edit typo matching for identifier tokens of at least four characters;
- boost exact identifier and ordered identifier-phrase matches;
- use relationship intent when the query contains terms such as `call`, `register`, `dispatch`, `read`, `write`, or `guard`;
- apply a small function-entry preference only as a tie-breaker, never as a substitute for evidence;
- return concise, user-readable match reasons;
- preserve stable ordering for equal scores.

The three questions in `demo/questions.json` are mandatory gold ranking cases. Punctuation-only and stop-word-only questions return an explicit empty result.

## 6. Editor Entry Points

### 6.1 CodeLens

After an index is ready, every indexed C function definition in an open workspace document may show one CodeLens:

`CodeTrail: discover links`

Selecting it opens the relationship discovery for that exact node ID. CodeLens is derived from the completed stable index and must not initiate parsing per function.

### 6.2 Context menu and keyboard

The editor context menu exposes `CodeTrail: Discover Symbol Links` for C files. The command uses the symbol under the cursor and resolves the best exact indexed candidate.

Default shortcut:

- Windows/Linux: `Alt+Shift+T`
- macOS: `Option+Shift+T`

The existing Command Palette path remains available.

## 7. Visual Direction

The webview uses VS Code theme variables exclusively.

- Maximum content width: 680 px.
- Body size: the host editor font size.
- Heading hierarchy: 20 px page title, 13 px section title.
- Radius: 2–3 px only where the host uses controls.
- No gradients, shadows, hero copy, oversized headings, glowing accents, or capsule badges.
- Dividers and whitespace establish hierarchy.
- Confidence uses a small status marker plus text.
- Primary blue is reserved for the main action and links.
- Focus indicators remain visible.
- Light, dark, high-contrast, 320 px width, and reduced-motion states are required.

The Accelint design package will not be added: CodeTrail is a plain VS Code webview and should use the host's semantic theme tokens rather than importing an unrelated component system.

## 8. State and Error Handling

- `welcome`: index action and a one-sentence explanation.
- `indexing`: stage, percentage, and cancellation-safe generation.
- `ready`: persistent search toolbar and index summary.
- `candidates`: unique selectable rows and the searched evidence fields.
- `discovery`: file route followed by within-file sections.
- `empty`: no-match explanation with exact-symbol and subsystem suggestions.
- `partial`: visible partial-index warning without disabling available results.
- `error`: concise recovery action.

Malformed webview and worker messages remain rejected by Zod. Source-derived text continues to render through `textContent`.

## 9. Testing

Implementation follows failing-test-first cycles.

Core tests must cover:

- duplicate declaration and candidate removal;
- exact identifier, `schedule` subsystem keyword, typo, relationship-intent, empty, and stable-order search;
- all three scheduler gold questions;
- cross-file link projection with registration from `sched.h` to `fair.c`;
- one-file fallback;
- deterministic file-section ordering;
- cycle and budget behavior.

Extension and webview tests must cover:

- CodeLens generation only for indexed function definitions;
- command dispatch with exact node IDs;
- compact persistent toolbar;
- file route before within-file sections;
- confidence and relationship direction text;
- persistent search flow and source actions;
- empty, partial, indexing, and error states;
- CSP and `textContent` safety.

The packaged VSIX must be installed and manually exercised against `test-fixtures/kernel-mini` after automated verification.

## 10. Deliberate Limits

- The hierarchy is a static structural neighborhood, not runtime execution.
- Cross-file routes exist only when a typed symbol edge crosses file boundaries.
- C and GNU/kernel patterns remain the implemented adapter; the contracts stay language-extensible.
- No embeddings, model calls, telemetry, remote index, or unrestricted graph rendering are added.
- CodeLens is read-only navigation and does not edit source.

## 11. Follow-on Product Improvements

After this polish release, the highest-value sequence is:

1. incremental file reindexing with visible staleness metadata;
2. explicit test-to-symbol relationships and `find related tests`;
3. optional compiler-backed type and indirect-call resolution;
4. read-only local MCP adapter over the same discovery contracts;
5. structural change-impact comparison between two snapshots;
6. a second language adapter only after C accuracy metrics are stable.

These remain outside this implementation unless required to preserve an interface boundary.
