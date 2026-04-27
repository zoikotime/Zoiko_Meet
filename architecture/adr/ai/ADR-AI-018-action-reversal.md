# ADR-AI-018: Action reversal architecture

| Field | Value |
|---|---|
| Status | Proposed |
| Date | 2026-04-27 |
| Owner | AI Engineering |
| Reviewers | Security, Product |
| Sources | SPEC-AI §26 ("reversal primitives must be implemented"), §32 (incident response), §34 |

## Context

SPEC-AI §26 requires reversible-tool reversal primitives, and prepare/execute split for irreversible actions. This ADR specifies how reversal is recorded and invoked.

## Options Considered

1. **Per-tool inverse function registered alongside the tool** — recommended.
2. **Generic "rollback last action" using snapshots** — costly and brittle.

## Decision

TBD. Recommended: Option 1. Registry entry pairs each reversible tool with its inverse and idempotency key. Reversal can be invoked by the user, an admin, or an incident responder.

## Consequences

- Reversibility: **cheap** — pure additive.

## Compliance and Governance

Reversal events are first-class audit records; SEV incidents include reversal-success metrics.
