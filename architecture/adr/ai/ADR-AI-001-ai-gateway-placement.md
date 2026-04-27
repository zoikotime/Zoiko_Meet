# ADR-AI-001: AI Gateway placement and enforcement responsibilities

| Field | Value |
|---|---|
| Status | Proposed |
| Date | 2026-04-27 |
| Owner | AI Platform Engineering |
| Reviewers | Security, Platform, Compliance |
| Sources | SPEC-AI §6 (logical services), §7 (planes), §9 (request lifecycle), §16 (tenant policy), §34 |
| Supersedes | None |

## Context

SPEC-AI §6 mandates a single `ai-gateway` service as the entry point for *every* AI request, enforcing authentication, request validation, tenant policy lookup, cost ceilings, rate limits and audit entry creation. SPEC §31 (master) prohibits product code calling model providers directly; this ADR formalises the boundary.

The current codebase calls Anthropic directly from `server/app/core/ai.py` — that is an MVA shortcut to be regularised by this decision.

## Options Considered

1. **Dedicated `ai-gateway` service** (per SPEC default) — clear boundary, language-independent, scales with AI traffic.
2. **Library-only enforcement embedded in product services** — faster to ship, leaks AI policy into every service, fails SPEC §31.
3. **Edge-gateway sidecar (mesh-level)** — leverages ADR-0006 service mesh; weaker per-request policy logic.

## Decision

TBD. Default per SPEC: **Option 1**. The gateway must enforce authn, RBAC/ABAC, tenant policy, feature entitlement, residency, rate limits, cost ceilings and audit emission *before* any model call.

## Consequences

- Reversibility: **expensive** once product services depend on the gateway URL/contract.
- Operational impact: introduces a new service on the AI request path; latency budget must absorb it.
- Cost impact: reduces blast radius of cost runaway by enforcing ceilings at the choke point.

## Compliance and Governance

Audit entries written here back the EU AI Act transparency log and ISO/IEC 42001 monitoring requirements.
