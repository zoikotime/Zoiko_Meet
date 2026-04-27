# ADR-0004: Database Baseline

| Field | Value |
|---|---|
| Status | Proposed |
| Date | 2026-04-27 |
| Owner | Platform Engineering Lead |
| Reviewers | Security, Data, Billing, Real-Time |
| Sources | SPEC §11 (data architecture), §25 (10K→100K msg/s/region) |

## Context

SPEC §11 prescribes a heterogeneous data plane: relational core for identity/workspace/policy/billing; append-only event store for messages; object storage for files; managed search; vector store; cache; immutable audit storage. Current codebase uses SQLite (per project memory) and a single Postgres profile in `docker-compose.prod.yml`. Both are inadequate for the SPEC §25 targets.

## Options Considered

1. **AWS Aurora Postgres + DynamoDB (events) + S3 + OpenSearch + pgvector + ElastiCache + S3 (audit Object Lock)**.
2. **GCP Cloud SQL Postgres + Spanner (events) + GCS + Vertex AI Search + Vertex Vector + Memorystore + GCS (audit Bucket Lock)**.
3. **Single Postgres for everything** — explicitly rejected by SPEC at scale targets.

## Decision

TBD per ADR-0001 (cloud). Constraints regardless of cloud:
- Relational: managed Postgres ≥ v15 with regional replicas.
- Event store: append-only, partitioned by `(tenant_id, channel_id)`, retention ≥ 90 days hot.
- Object storage: per-region buckets, server-side encryption, tenant prefix.
- Audit: WORM storage with retention lock.
- Vector store: choice may be deferred to ADR-0005.

## Consequences

- Reversibility: **expensive** for relational/event store; **moderate** for search/vector.
- Migration from current SQLite must preserve message ordering and IDs.
- Per project memory: SQLite is intentional for *now*; this ADR governs the *production* baseline, not local dev.

## Compliance and Governance

- All stores must support per-tenant encryption keys when tenant requires.
- Backups inherit residency policy; cross-region failover requires policy approval (SPEC §19).
