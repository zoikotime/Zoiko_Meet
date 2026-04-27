# ADR-AI-026: Feature store and AI telemetry architecture

| Field | Value |
|---|---|
| Status | Proposed |
| Date | 2026-04-27 |
| Owner | Data / AI Engineering |
| Reviewers | Security, Compliance |
| Sources | SPEC-AI §8, §22, parent Data Architecture, §34 |

## Context

SPEC-AI §8 requires feature store values to be tenant-isolated, point-in-time correct, lineage-tracked. SPEC-AI §22 telemetry data model must include feature usage. Parent Data Architecture owns store choice.

## Options Considered

1. **Feast on Postgres + Redis online store** — open-source, vendor-portable.
2. **Vendor feature store (Tecton, Hopsworks)** — full-featured, lock-in + cost.
3. **Defer until ML training/serving justifies** — recommended for MVA.

## Decision

TBD. Recommended: Option 3 for MVA. When required, point-in-time correctness and tenant isolation are non-negotiable.

## Consequences

- Reversibility: **moderate** — feature definitions are portable.

## Compliance and Governance

Feature lineage to source events required for DSAR + audit.
