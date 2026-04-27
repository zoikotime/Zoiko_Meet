# ADR-AI-029: Model rollback and failover runbook

| Field | Value |
|---|---|
| Status | Proposed |
| Date | 2026-04-27 |
| Owner | Head of AI / SRE |
| Reviewers | Security, ARB |
| Sources | SPEC-AI §27 (15-min rollback target), §24 (degradation), §32 (incident), §34 |

## Context

SPEC-AI §27 sets 15 minutes from rollback decision to restored traffic path. SPEC-AI §24 fixes per-failure-mode degradation behaviour.

## Options Considered

1. **Model Router carries pinned-version routing config; rollback flips a flag** — recommended; matches the 15-min target.
2. **Redeploy of router service with new config** — too slow for the SLO.

## Decision

TBD. Recommended: Option 1. Runbook (Class 4 downstream) specifies decision criteria, named approvers, rollback steps, communication plan, post-rollback validation.

## Consequences

- Reversibility of the rollback itself: **immediate** — flip the flag back.

## Compliance and Governance

Each rollback event is a SEV-1 (or higher) incident requiring PIR per SPEC-AI §32.
