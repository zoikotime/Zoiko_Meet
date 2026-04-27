# ADR-AI-003: Prompt registry implementation and approval workflow

| Field | Value |
|---|---|
| Status | Proposed |
| Date | 2026-04-27 |
| Owner | AI Engineering |
| Reviewers | Head of AI, Security, AI Safety, Compliance |
| Sources | SPEC-AI §11, §33 (no hidden prompts), §34 |

## Context

SPEC-AI §11 mandates prompts as governed artifacts: versioned, reviewed, evaluated, canary-rolled, rolled back. SPEC-AI §33 prohibits prompt text outside the registry.

## Options Considered

1. **Git-backed registry** with PR review + CI evals + signed releases — strongest governance, slowest iteration.
2. **Database-backed registry with admin UI** — fastest iteration, weaker change control unless combined with audit.
3. **Hybrid: source-controlled definitions + DB-cached runtime** — recommended; combines both.

## Decision

TBD. Recommended: hybrid. Promotion requires Capability Owner approval + AI evaluation pass + Security review for system/safety prompts. Tenant prompt fragments configured by tenant admin with policy validation.

## Consequences

- Reversibility: **moderate** — schema changes are migration-bound.
- Every prompt rendered to a provider must trace to a registry version ID for audit reproduction.

## Compliance and Governance

Prompt-to-output traceability is required evidence under SPEC-AI §31 (compliance).
