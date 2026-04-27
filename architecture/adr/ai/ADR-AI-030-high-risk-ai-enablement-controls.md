# ADR-AI-030: High-risk AI enablement controls

| Field | Value |
|---|---|
| Status | Proposed |
| Date | 2026-04-27 |
| Owner | Compliance + Head of AI |
| Reviewers | Legal, CTO, ARB |
| Sources | SPEC-AI §14 (high-risk class), §15 (oversight), §16 (tenant policy), §29 (ZoikoTime), §31 (EU AI Act), §34 |

## Context

When a capability is classified as high-risk-on-enablement (per ADR-AI-023), the architecture requires explicit enablement, transparency disclosure, human oversight, documented risk management, data governance evidence, accuracy/robustness monitoring, cybersecurity controls and conformity assessment readiness.

## Options Considered

1. **Tenant admin must explicitly enable each high-risk capability with checkbox + signed acknowledgement** — recommended.
2. **Plan-tier-based enablement** — too coarse; loses per-capability evidence.

## Decision

TBD. Recommended: Option 1. Enablement event is a first-class audit record. AI Gateway refuses requests against a non-enabled high-risk capability.

## Consequences

- Reversibility: **cheap** — disable flips the gate.

## Compliance and Governance

Enablement records, transparency disclosures and oversight logs are bundle inputs to EU AI Act conformity assessment.
