# ADR-0015: Capacity Targets Commitment

| Field | Value |
|---|---|
| Status | Proposed |
| Date | 2026-04-27 |
| Owner | Head of SRE |
| Reviewers | Platform, Finance, Product |
| Sources | SPEC §25 (capacity tables), §22 (FinOps), §27 (failure modes) |

## Context

SPEC §25 fixes 12-month and 36-month capacity baselines: 1M→10M users; 200K→2M DAU; 10K→100K msg/s/region; 50K→500K concurrent meeting participants/region; 5PB→50PB storage. These are **architectural baselines for design and capacity planning**, not commercial forecasts.

## Options Considered

1. **Adopt SPEC §25 verbatim** — recommended; this ADR formalises the commitment.
2. **Reduce baselines** — only with explicit ARB approval and re-derived SLO/cost models.
3. **Increase baselines** — requires re-deriving infrastructure cost ceiling.

## Decision

Adopt SPEC §25 as the architectural baseline. Capacity reviews happen quarterly; downward revision requires an ADR amendment.

## Consequences

- Reversibility: **expensive** if downstream services were sized to a different number.
- Cost: drives ADR-0019 quotas and ADR-0007 free-tier ceilings.

## Compliance and Governance

- SLO tables in SPEC §25 are mirrored in `architecture/slos.md` (downstream document, not yet written).
- Quarterly capacity report cross-checks utilisation against these targets.
