# ADR-AI-002: Model router routing criteria and provider abstraction

| Field | Value |
|---|---|
| Status | Proposed |
| Date | 2026-04-27 |
| Owner | AI Platform Engineering |
| Reviewers | Head of AI, Security, FinOps |
| Sources | SPEC-AI §6, §17 (provider strategy), §18 (concentration), §24 (degradation), §34 |

## Context

SPEC-AI §17 fixes routing factors: capability fit, risk class, residency, latency, cost, evaluation score, concentration limit, fallback readiness. SPEC-AI §18 caps single-provider share at 70% by default.

## Options Considered

1. **In-house router service with provider adapters** — full control, all SPEC factors implementable.
2. **OpenRouter / LiteLLM proxy** — fast to ship, weaker tenant/policy/eval integration.
3. **Per-feature direct calls with shared client library** — explicitly rejected (SPEC §33 prohibitions).

## Decision

TBD. Default: Option 1. The router must consult: (a) prompt registry for capability requirements, (b) ai-eval-service for current scores, (c) tenant policy for residency/feature, (d) ai-observability-service for provider health, (e) FinOps for cost ceiling.

## Consequences

- Reversibility: **moderate** — provider adapter contracts are portable.
- Single point of routing failure must have its own redundancy plan (multi-instance, no sticky state).

## Compliance and Governance

Routing decision per request must be logged with model ID, version, region, provider for audit reproduction.
