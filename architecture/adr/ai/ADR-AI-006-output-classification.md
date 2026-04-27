# ADR-AI-006: AI output classification taxonomy

| Field | Value |
|---|---|
| Status | Proposed |
| Date | 2026-04-27 |
| Owner | Head of AI |
| Reviewers | Security, Legal, Compliance, Product |
| Sources | SPEC-AI §14 (classification), §15 (oversight), §34 |

## Context

SPEC-AI §14 fixes seven output classes: Informational, Advisory, Workflow-preparatory, State-changing, External-effect, Compliance-impacting, High-risk decision support. Each class has a default control. The classification at runtime drives the oversight mode in SPEC-AI §15.

## Options Considered

1. **Adopt SPEC-AI §14 verbatim as runtime taxonomy.**
2. **Collapse to 3–4 classes for engineering simplicity** — rejected; loses the high-risk distinction required by EU AI Act.

## Decision

Adopt SPEC-AI §14 verbatim. Each AI capability declares its classes at the prompt-registry level; runtime can only narrow, not widen.

## Consequences

- Reversibility: **moderate** — taxonomy bound into UI labels and audit schemas.
- Engineering must add classifier checks to every output path.

## Compliance and Governance

Output class is logged with every response for compliance evidence and incident review.
