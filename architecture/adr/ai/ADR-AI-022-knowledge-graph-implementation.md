# ADR-AI-022: Knowledge graph implementation

| Field | Value |
|---|---|
| Status | Proposed |
| Date | 2026-04-27 |
| Owner | AI / Data Engineering |
| Reviewers | Security, Compliance, Product |
| Sources | SPEC-AI §28 (knowledge architecture), §8 (isolation), §30 (retention), §34 |

## Context

SPEC-AI §28 mandates a tenant-isolated graph linking people, meetings, messages, decisions, action items, commitments, issues, risks, projects, dependencies, source lineage. Temporal reasoning required ("what was known as of date X").

## Options Considered

1. **Property graph on Postgres + AGE / Memgraph / Neo4j Aura** — strongest queries, vendor decision per tenant scale.
2. **Document store + materialised relationships** — simpler ops, weaker traversal.
3. **Defer until Phase 2** — viable; signal extraction outputs flow to a flat store first.

## Decision

TBD. Recommended: Option 3 for MVA, Option 1 once signal volumes justify. Schema deferred to Knowledge Architecture Specification (Class 3).

## Consequences

- Reversibility: **expensive once schemas are populated**.

## Compliance and Governance

Invalidation propagation from source deletion to graph nodes is required for DSAR compliance.
