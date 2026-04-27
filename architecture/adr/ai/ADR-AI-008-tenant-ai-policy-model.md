# ADR-AI-008: Tenant AI policy model

| Field | Value |
|---|---|
| Status | Proposed |
| Date | 2026-04-27 |
| Owner | AI Platform Engineering |
| Reviewers | Product, Security, Legal |
| Sources | SPEC-AI §16 (tenant controls), §8 (isolation), §34 |

## Context

SPEC-AI §16 lists eight tenant policy areas: feature enablement, data sources, retention, training consent, agentic actions, cost ceilings, transparency, high-risk controls. Policies must be enforced at the gateway, not surfaced in UI only.

## Options Considered

1. **Centralised policy service queried per request** — clean, adds latency.
2. **Policy cached at gateway with TTL invalidation on change** — recommended.
3. **Inline policy in product code** — explicitly rejected.

## Decision

TBD. Recommended: Option 2. Policy schema versioned; tenant admin actions logged in audit; entitlement checks consult policy + plan + region.

## Consequences

- Reversibility: **moderate** — policy schema migration is a tenant-by-tenant operation.
- TTL window must be short enough that policy revocations are quickly effective.

## Compliance and Governance

Policy versions are part of every audit log for reconstructing the rule set in force at a request time.
