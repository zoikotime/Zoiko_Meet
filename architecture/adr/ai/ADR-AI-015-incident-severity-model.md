# ADR-AI-015: AI incident severity model

| Field | Value |
|---|---|
| Status | Proposed |
| Date | 2026-04-27 |
| Owner | Security / AI Ops |
| Reviewers | Head of AI, Legal, Compliance, CTO |
| Sources | SPEC-AI §32 (incident management), §34 |

## Context

SPEC-AI §32 defines four severity levels (SEV-0..SEV-3) with examples and required response. SEV-0 = cross-tenant leak / autonomous critical action / widespread harmful output / cost runaway.

## Options Considered

1. **Adopt SPEC-AI §32 verbatim** — recommended.
2. **Merge with platform incident model** — desirable; merge keeps single on-call but preserves AI-specific PIR fields.

## Decision

Adopt SPEC-AI §32 with merged on-call rotation per ADR. PIR template adds AI-specific fields: prompt version, model version, eval delta, regulatory notification assessment, tenant data exposure.

## Consequences

- Reversibility: **cheap**.

## Compliance and Governance

SEV-0/SEV-1 PIR with regulatory notification assessment is required input to EU AI Act incident reporting where thresholds apply.
