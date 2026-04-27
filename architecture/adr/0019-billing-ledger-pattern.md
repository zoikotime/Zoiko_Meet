# ADR-0019: Billing Ledger Pattern

| Field | Value |
|---|---|
| Status | Proposed |
| Date | 2026-04-27 |
| Owner | Billing Engineering Lead |
| Reviewers | Finance, Data, Audit |
| Sources | SPEC §16, §22, §25 (99.99% billing accuracy) |

## Context

SPEC §16 requires usage events to be **idempotent, attributable to tenant/workspace/source feature, and replayable from event history**. SPEC §25 sets 99.99% billing accuracy as architecture-critical.

## Options Considered

1. **Event-sourced ledger (append-only `usage_events` topic)** — replayable, auditable, requires materialised views for invoicing.
2. **Double-entry ledger on Postgres** — strong invariants, harder to scale to 100K events/s.
3. **Vendor-provided metering (Stripe Billing usage records only)** — fast to ship, no replay outside Stripe, vendor lock.
4. **Hybrid: event-sourced internal ledger + sync to Stripe Billing** — recommended.

## Decision

TBD. Recommended: **Option 4** — event-sourced internal ledger feeds the chosen ADR-0007 payments engine. The internal ledger remains the source of truth for reconciliation and disputes.

## Consequences

- Reversibility: **moderate** — invoice format and tax math are vendor-bound; the ledger itself is portable.
- Operational cost: reconciliation jobs run on a schedule; discrepancies open tickets automatically.

## Compliance and Governance

- Usage events carry `tenant_id`, `workspace_id`, `usage_type`, `quantity`, `unit`, `source_event_id`, `timestamp` (SPEC Appendix B).
- Audit retention ≥ 7 years per typical financial regulation; clarified per jurisdiction.
