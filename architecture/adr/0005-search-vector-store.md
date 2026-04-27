# ADR-0005: Search and Vector Store

| Field | Value |
|---|---|
| Status | Proposed |
| Date | 2026-04-27 |
| Owner | Real-Time Engineering Lead |
| Reviewers | AI, Security, Platform |
| Sources | SPEC §11, §14 (AI), §22 (cost), §25 (search 99.9% / p95 500ms) |

## Context

SPEC §11 requires permission-aware keyword and semantic search. SPEC §14 adds AI summaries needing vector retrieval over tenant-isolated context. SPEC §22 makes search/vector cost a first-order constraint.

## Options Considered

1. **OpenSearch / Elasticsearch + dedicated vector index (e.g. Pinecone, Weaviate)** — best-in-class search, separate vector vendor adds cost and complexity.
2. **OpenSearch with k-NN plugin** — single system for keyword + vector; weaker semantic ranking.
3. **Postgres + pgvector** — operationally simple, struggles at 100K msg/s indexing rate.
4. **Vespa** — strong combined keyword + vector + filtering; smaller operational community.
5. **Tantivy / Meilisearch (self-hosted)** — cost-effective; limited multi-region story.

## Decision

TBD. Hard requirements:
- Permission filtering must run inside the search system, not post-hoc in service code (SPEC §7: "never returns data without auth check").
- Semantic and keyword results must be combinable (hybrid search) for AI retrieval.
- Per-tenant index isolation OR per-document tenant filter with bucket separation.

## Consequences

- Reversibility: **moderate** — ranking and indexing pipelines bind to vendor capabilities.
- Cost: vector embedding generation is a recurring spend; quotas must be enforced per SPEC §22.

## Compliance and Governance

- Indexes never store data exempt from deletion: SPEC §11 requires deletion to propagate to indexes.
- Vector embeddings derived from tenant data are tenant data — same residency rules apply.
