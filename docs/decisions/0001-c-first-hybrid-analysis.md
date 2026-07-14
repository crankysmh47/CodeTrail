# ADR 0001: C-first hybrid analysis

Date: 2026-07-14

Status: accepted

## Context

The original product direction was language-agnostic, but the motivating code is the Linux scheduler. Linux uses GNU C patterns that a generic call graph misses, including macros, designated initializers, configuration guards, and function-pointer dispatch.

## Decision

Keep graph, search, trail, and UI contracts language-neutral. Ship a GNU C adapter backed by Tree-sitter WASM and a separate kernel scheduler enricher. Treat Clang semantics as additive capability, not a baseline dependency.

## Consequences

The release makes a credible C claim without pretending to support every language. C++ requires its own adapter for overloads, templates, methods, namespaces, and inheritance. Kernel-specific rules stay out of the core graph model.
