# ADR-AI-027: Human evaluation operating model

| Field | Value |
|---|---|
| Status | Proposed |
| Date | 2026-04-27 |
| Owner | AI Evaluation Lead |
| Reviewers | Head of AI, Legal, HR, Compliance |
| Sources | SPEC-AI §20 (human eval), §19 (consent), §34 |

## Context

SPEC-AI §20 requires human evaluation with trained raters, inter-rater agreement, bias controls, consent and labour standards. Raters may be employees, contractors or vendor-managed.

## Options Considered

1. **In-house rater team** — strongest quality + confidentiality + tenant data exposure control.
2. **Vendor (Surge, Scale, Invisible)** — faster to scale, weaker tenant-data exposure control.
3. **Hybrid: in-house for sensitive tenants, vendor for synthetic/public eval** — recommended.

## Decision

TBD. Recommended: Option 3. Tenant-data exposure to raters requires explicit tenant consent (default opt-out).

## Consequences

- Reversibility: **moderate** — vendor swap requires re-onboarding.

## Compliance and Governance

Rater consent, inter-rater agreement, and bias-control evidence per SPEC-AI §31.
