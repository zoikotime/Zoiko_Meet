# ADR-AI-013: AI cost ceilings and circuit breakers

| Field | Value |
|---|---|
| Status | Proposed |
| Date | 2026-04-27 |
| Owner | FinOps + AI Platform Engineering |
| Reviewers | Head of AI, Product, Finance, ARB |
| Sources | SPEC-AI §23 (cost governance), §24 (degradation), §34 |

## Context

SPEC-AI §23 mandates cost enforcement at seven levels: request, session, workspace, tenant, feature, provider, platform. Breach response must degrade gracefully, not hard-fail.

## Options Considered

1. **Token + cost counters in Redis with tiered checks at gateway** — recommended.
2. **Async post-hoc reconciliation only** — rejected; permits unbounded burst cost.
3. **Provider-side rate limits only** — rejected; provider limits are not tenant-aware.

## Decision

TBD. Recommended: Option 1. Each level has a soft (warn + log) and hard (degrade or block) threshold. Platform-level circuit breaker disables AI features while preserving non-AI workflow.

## Consequences

- Reversibility: **cheap** at the threshold level; **moderate** for the counter infra.
- Cost: counter infra is itself a cost; sized per ADR-0015 capacity targets.

## Compliance and Governance

Threshold breaches and degradation events feed incident metrics and FinOps reporting.
