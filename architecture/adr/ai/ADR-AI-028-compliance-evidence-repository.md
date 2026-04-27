# ADR-AI-028: AI compliance evidence repository

| Field | Value |
|---|---|
| Status | Proposed |
| Date | 2026-04-27 |
| Owner | Compliance + AI Platform Engineering |
| Reviewers | Legal, Security, ARB |
| Sources | SPEC-AI §31, §32 (incident evidence), parent SPEC §20, §34 |

## Context

SPEC-AI §31 requires the architecture to *produce* evidence: technical documentation, risk registers, model cards, eval records, transparency logs, human oversight logs, provider records, incident logs, auditability.

## Options Considered

1. **Centralised evidence service `ai-compliance-service` with append-only storage + access controls** — recommended.
2. **Distributed across services with central index** — harder to audit completeness.

## Decision

TBD. Recommended: Option 1. Service ingests structured evidence from gateway, router, eval, lifecycle, oversight, incident pipelines.

## Consequences

- Reversibility: **moderate** — schemas freeze for audit reproducibility.

## Compliance and Governance

Evidence retention satisfies SOC 2 + EU AI Act + ISO/IEC 42001. Retention class per SPEC-AI §30.
