# ADR-AI-004: Context retrieval and permission filtering architecture

| Field | Value |
|---|---|
| Status | Proposed |
| Date | 2026-04-27 |
| Owner | Search / AI Engineering |
| Reviewers | Security, Data, Compliance |
| Sources | SPEC-AI §12 (retrieval pipeline), §8 (tenant isolation), §21 (safety layers), §34 |

## Context

SPEC-AI §12 specifies the retrieval pipeline: scope resolution → permission filtering → hybrid retrieval → ranking → compression → injection defence → grounding package. Permission filtering must run *before* ranking, not after.

## Options Considered

1. **Permission filter inside the search engine** (ADR-0005) — strongest correctness, ties to vendor capabilities.
2. **Pre-filter authorised IDs, then search** — vendor-portable, expensive at high cardinality.
3. **Post-filter results** — explicitly rejected; SPEC-AI §8 requires unauthorised items never enter candidate set.

## Decision

TBD per ADR-0005. Hard requirement: zero items from outside the user's authorised scope may appear in the candidate set, verified by synthetic canary tests in CI.

## Consequences

- Reversibility: **moderate** — retrieval contracts bind to the search vendor.
- Performance: permission filter dominates latency for high-fanout users; cache strategy required.

## Compliance and Governance

Cross-tenant retrieval test (synthetic canary) required as a release gate.
