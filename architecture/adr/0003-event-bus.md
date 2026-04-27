# ADR-0003: Managed Event Bus + Schema Registry

| Field | Value |
|---|---|
| Status | Proposed |
| Date | 2026-04-27 |
| Owner | Platform Engineering Lead |
| Reviewers | Real-Time, Search, AI Signal, Billing, Audit |
| Sources | SPEC §8 (eventing), §11 (data), §16 (billing replay), Appendix B (event catalogue) |

## Context

SPEC §8 requires "managed event bus with schema registry, tenant attribution, versioning and replay within retention windows." Appendix B fixes 8 baseline events with mandatory `tenant_id` / `workspace_id` fields. Replay is the foundation of billing reconciliation (SPEC §16) and audit evidence (SPEC §20).

## Options Considered

1. **Confluent Cloud (Kafka)** — strongest schema registry (Avro / Protobuf), proven replay, ksqlDB for derived views. Highest cost.
2. **AWS MSK + Glue Schema Registry** — Kafka-compatible, lower cost, weaker schema tooling.
3. **GCP Pub/Sub + schema service** — auto-scaling, lower ops overhead, weaker replay semantics.
4. **NATS JetStream** — operationally simple, lower cost, less mature schema ecosystem.
5. **Postgres logical replication + outbox pattern** — explicitly rejected at the scale targets in SPEC §25.

## Decision

TBD. Constraint: chosen bus must support per-topic retention ≥ 14 days for reconciliation, schema versioning, and tenant-scoped consumer groups. Schema registry must be source-controlled (SPEC §8).

## Consequences

- Reversibility: **expensive** (event consumers across most services).
- All events must carry `tenant_id`, `workspace_id`, `schema_version` and `event_id` for idempotency.

## Compliance and Governance

- Cross-region replication must respect data residency.
- PII in event payloads requires encryption-at-rest and minimisation per SPEC §11.
