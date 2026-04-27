# ADR-0011: Service Communication Patterns

| Field | Value |
|---|---|
| Status | Proposed |
| Date | 2026-04-27 |
| Owner | Platform/API Lead |
| Reviewers | Security, All service owners |
| Sources | SPEC §8, §17 (public API), §31 (no public API for service-to-service) |

## Context

SPEC §8 fixes the core patterns: gRPC over mTLS internally, REST/OpenAPI externally, GraphQL by exception, sagas instead of 2PC, idempotency keys on all writes, schema repos source-controlled. This ADR formalises adoption and exception process.

## Options Considered

1. **Adopt SPEC §8 verbatim** — recommended.
2. **Defer gRPC; use REST internally too** — explicitly rejected by SPEC.
3. **Async-first via event bus only** — rejected; sync RPC is required for read paths.

## Decision

Default to SPEC §8. The exception process: any service that wishes to expose GraphQL or skip gRPC requires an ADR amendment. Schema repositories live under `protos/`, `openapi/`, `events/` — to be created by the Platform team.

## Consequences

- Reversibility: **expensive** — flips downstream mobile/desktop client patterns.
- Tooling investment: protobuf code-gen pipeline, OpenAPI client gen, schema-CI gates.

## Compliance and Governance

- Every public REST endpoint must declare authentication, rate limit, and tenant scope in OpenAPI.
- Every gRPC method must enforce mTLS identity and tenant attribution before business logic.
