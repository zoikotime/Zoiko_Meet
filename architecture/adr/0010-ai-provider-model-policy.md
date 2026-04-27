# ADR-0010: AI Provider and Model Policy

| Field | Value |
|---|---|
| Status | Proposed |
| Date | 2026-04-27 |
| Owner | Head of AI |
| Reviewers | Security, Data, Legal/Compliance, Product |
| Sources | SPEC §14 (AI plane), §11 (no training without opt-in), §22 (AI cost), §25 (1K→10K AI RPS/region) |

## Context

SPEC §14 mandates an AI Orchestration Service with a Model Router selecting by use case, residency, cost, latency, safety and availability. SPEC §11 prohibits training on customer data without explicit tenant opt-in. SPEC §31 prohibits embedding model-provider logic into product services.

The current repo uses Anthropic Claude directly via `server/app/core/ai.py` — that is an MVA shortcut to be regularised by this ADR.

## Options Considered

1. **Anthropic Claude (primary) + OpenAI (fallback)** — strong reasoning + safety + structured outputs.
2. **Multi-provider router with no preference** — full Model Router pattern; highest engineering cost.
3. **Single provider** — explicitly rejected by SPEC §27 (AI failover required).
4. **Self-hosted open-weight models (Llama / Mistral)** — lowest cost at scale, weakest safety controls and ops burden.

## Decision

TBD. Default: Claude as primary; one secondary provider mandatory for SPEC §27 RTO 5min. Constraints:
- All inference goes through `AIOrchestration` service; product code calls the orchestration API only.
- Customer-data training is disabled at the contract level with all providers.
- Per-tenant per-feature usage caps enforced before submission.

## Consequences

- Reversibility: **moderate** if the orchestration boundary stays clean.
- Cost: AI inference is the single fastest-growing OpEx line; quotas in ADR-0019 are mandatory.

## Compliance and Governance

- Provider DPA covers each region the model serves.
- Prompts and completions logged with tenant attribution for SPEC §14 governance, but content excluded from analytics that cross tenants.
- EU AI Act: inventory of models and use cases; high-risk classification check before launch.
