# ADR-0020: Public API Versioning Policy

| Field | Value |
|---|---|
| Status | Proposed |
| Date | 2026-04-27 |
| Owner | Platform/API Lead |
| Reviewers | Security, Developer Relations, Product |
| Sources | SPEC §17 (API), §31 (no public API for service-to-service) |

## Context

SPEC §17 commits the public API as a stability surface for customer integrations, partner integrations, OAuth apps, bots and webhooks. Deprecation requires notice, migration path and ADR.

## Options Considered

1. **URL versioning (`/v1/...`, `/v2/...`)** — most explicit, most familiar to developers.
2. **Header versioning (`Api-Version: 2026-04-27`)** — Stripe-style date pinning, finer-grained.
3. **Hybrid (URL major + header minor)** — Stripe + GitHub style.
4. **No versioning** — explicitly prohibited.

## Decision

TBD. Recommended: **URL major + header date pin** (Option 3). Major versions live for ≥ 24 months after a successor ships. Per-customer date pin via header allows controlled rollout of additive changes.

Webhooks: signed (HMAC), retryable with exponential backoff, idempotent via `idempotency_key`, versioned via `Webhook-Version` header.

## Consequences

- Reversibility: **one-way door for major versions** — breaking changes require a new major and migration plan.
- Documentation site must render version history; required before public API GA.

## Compliance and Governance

- API auth via OAuth 2.1 + workspace-scoped tokens; SCIM for enterprise provisioning.
- Rate limits per token, per workspace, per route.
