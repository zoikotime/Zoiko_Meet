# ADR-AI-017: Tool registry and risk classification

| Field | Value |
|---|---|
| Status | Proposed |
| Date | 2026-04-27 |
| Owner | AI Engineering |
| Reviewers | Security, Product, Compliance |
| Sources | SPEC-AI §26 (5 tool risk classes), §16 (tenant agentic policy), §34 |

## Context

SPEC-AI §26 fixes five tool risk classes: read-only, low side-effect, medium, high, critical. Critical-class tools are forbidden to autonomous agents.

## Options Considered

1. **Source-controlled tool registry, one entry per tool, mandatory class** — recommended.
2. **Free-form tool list at runtime** — rejected; defeats SPEC-AI §33.

## Decision

Adopt registry with mandatory fields: tool name, signature, side-effects, risk class, reversibility, permitted tenants, default oversight mode, cost units. Tool addition requires Security + Capability Owner review.

## Consequences

- Reversibility: **cheap** — registry is data.

## Compliance and Governance

Registry serves as evidence for what an agent could have done at any point in time.
