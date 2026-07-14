# ADR 0002: Static trail trust boundary

Date: 2026-07-14

Status: accepted

## Context

Static source relationships help a developer choose what to read, but they cannot prove runtime order, branch selection, frequency, or the active kernel configuration.

## Decision

Label every trail `Static reading order; not a runtime trace.` Attach provenance, confidence, and a reason to each relationship. Keep partial-result and budget warnings in the main interface.

## Consequences

The product is less flashy than an unrestricted graph or generated narrative. It is also easier to audit: a developer can open every source location and see why it appeared.
