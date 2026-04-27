# ADR-AI-020: Model lifecycle management process

| Field | Value |
|---|---|
| Status | Proposed |
| Date | 2026-04-27 |
| Owner | Head of AI |
| Reviewers | Security, Compliance, ARB |
| Sources | SPEC-AI §27 (lifecycle stages), §20 (eval), §29 (rollback runbook), §34 |

## Context

SPEC-AI §27 fixes eight stages: introduction, experimentation, canary (1/5/25/50/100), champion/challenger, production, deprecation, rollback (15-min target), retirement. No production use without registry entry, eval evidence, risk classification, routing policy, rollback path, owner.

## Options Considered

1. **Adopt SPEC-AI §27 verbatim** — recommended.

## Decision

Adopt verbatim. Each model change requires an ADR-AI-020 conforming entry in the model registry; canary holds at each percentage are gated by ai-eval-service quality + safety + cost thresholds.

## Consequences

- Reversibility: **15-minute target from rollback decision to traffic restoration**.

## Compliance and Governance

Registry entries are EU AI Act technical documentation evidence.
