# ADR-0018: ZoikoTime Integration Contract

| Field | Value |
|---|---|
| Status | Proposed |
| Date | 2026-04-27 |
| Owner | Sema Lead + ZoikoTime Lead |
| Reviewers | Data, Security, Product |
| Sources | SPEC §15 (ZoikoTime integration), §9.5 (propagation journey), §31 (no hardcoded ZoikoTime) |

## Context

SPEC §15 makes ZoikoTime integration a strategic moat AND a constitutional boundary: Sema must work standalone; ZoikoTime *enriches* it. SPEC §31 prohibits embedding ZoikoTime domain logic into core Sema services and prohibits direct database queries.

The current repo has a `Zoiko_Time/` directory in the workspace — separate project, not coupled to Sema yet.

## Options Considered

1. **Webhook + outbound webhook** (Sema → ZoikoTime, ZoikoTime → Sema) — simplest, weakest replay.
2. **Shared event bus topic per direction** — best replay, requires ADR-0003 to be live.
3. **Direct DB integration** — explicitly prohibited by SPEC §31.

## Decision

TBD. Default per SPEC §15: bidirectional, versioned, audited, failure-independent. Recommended:
- **ZoikoTime → Sema**: webhook to Integration Service with HMAC signature + idempotency key + schema_version, fans out via internal event bus.
- **Sema → ZoikoTime**: outbound webhook with retry/backoff and replay log.
- **Linkage**: tenant ↔ ZoikoTime org link stored on Workspace, nullable.

## Consequences

- Reversibility: **expensive** once a tenant has signed up to the bundle.
- Sema features that depend on verified presence must degrade gracefully when the link is absent.

## Compliance and Governance

- Both directions are in-scope for tenant DPA.
- Events crossing the boundary are minimised (verified presence ≠ raw timesheet data).
