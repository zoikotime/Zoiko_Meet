# ADR-AI-005: Embedding store and vector index isolation design

| Field | Value |
|---|---|
| Status | Proposed |
| Date | 2026-04-27 |
| Owner | Data / AI Engineering |
| Reviewers | Security, Compliance |
| Sources | SPEC-AI §13 (embeddings), §8 (isolation), §30 (retention), §34 |

## Context

SPEC-AI §13 requires every embedding to carry: embedding model ID + version, dimensions, source record ID + schema version, tenant ID, region, timestamp. Index partitioning must enforce tenant isolation by physical separation OR mandatory tenant filters verified by tests.

## Options Considered

1. **Per-tenant index** — strongest isolation, highest infra cost, tenant fan-out problems at 100K tenants.
2. **Shared index with mandatory tenant filter + canary tests** — cost-efficient, requires test discipline.
3. **Hybrid: shared for free tier, per-index for enterprise** — recommended.

## Decision

TBD per ADR-0005. Hard requirements: deletion propagates from source to embedding within the source-data deletion SLA; embedding model upgrades use staged dual-index recompute (no in-place mutation).

## Consequences

- Reversibility: **expensive** — re-embedding 5–50 PB of data is a cost event.
- Vectors are sensitive derived data; same DLP and access controls as source content.

## Compliance and Governance

Embedding lineage must satisfy DSAR/right-to-erasure: deleting a source record deletes derived embeddings within the source SLA.
