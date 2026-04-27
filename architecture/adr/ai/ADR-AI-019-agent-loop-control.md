# ADR-AI-019: Agent loop control parameters

| Field | Value |
|---|---|
| Status | Proposed |
| Date | 2026-04-27 |
| Owner | AI Engineering |
| Reviewers | Security, FinOps |
| Sources | SPEC-AI §26 (loop control), §23 (cost), §33 (prohibitions), §34 |

## Context

SPEC-AI §26 requires every agent run to have loop control, anomaly detection, cost ceilings, tool-call ceilings, elapsed-time limits, convergence checks, revocation pathways and audit. SPEC-AI §33 prohibits agent loops without these.

## Options Considered

1. **Per-capability default ceilings + tenant policy override** — recommended.
2. **Single global ceiling** — too coarse for varied workloads.

## Decision

TBD. Initial defaults (to be tuned by ADR amendment): max iterations = 25, max wall-clock = 5 min, max cost = $0.50, max distinct tool calls = 50, convergence check = "no progress over 3 iterations → terminate." Tenant can lower; raising requires capability owner sign-off.

## Consequences

- Reversibility: **cheap** — defaults are configuration.

## Compliance and Governance

Limit hits are audit events; sustained limit hits trigger incident review.
