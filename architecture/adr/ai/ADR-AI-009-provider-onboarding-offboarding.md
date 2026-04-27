# ADR-AI-009: Provider onboarding and offboarding process

| Field | Value |
|---|---|
| Status | Proposed |
| Date | 2026-04-27 |
| Owner | Head of AI |
| Reviewers | Security, Legal, Compliance, FinOps, ARB |
| Sources | SPEC-AI §17, §18 (provider risk), §27 (lifecycle), §34 |

## Context

SPEC-AI §18 requires provider onboarding to include commercial review, security review, privacy/data handling review, residency verification, shadow eval, canary, ARB record. Offboarding requires traffic drain, data verification, cost reconciliation, audit preservation, replacement readiness.

## Options Considered

1. **Adopt SPEC-AI §18 verbatim as a process** — recommended.
2. **Lighter onboarding for "research-only" providers** — limited to non-production paths only; documented exception.

## Decision

Adopt SPEC-AI §18. Each onboarding produces an entry in the provider register with checklists; each offboarding produces a closure record.

## Consequences

- Reversibility: **expensive** mid-flight; both ops require multi-week elapsed time.

## Compliance and Governance

Provider register entries and DPA artefacts feed SOC 2 vendor-management evidence and EU AI Act third-party records.
