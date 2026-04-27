# Architectural Decision Records — Index

Source authority: `architecture/SPEC.md` §28 (mandatory ADR list) and §34 (open decisions).

For AI-specific ADRs (ADR-AI-001 through ADR-AI-030), see [ai/index.md](ai/index.md).

All ADRs are stubs in **Proposed** state until the Architecture Review Board approves them. Defaults from SPEC §26 apply where the ADR has not yet been resolved.

| ID | Title | Status | Default (per SPEC §26) | Owner |
|---|---|---|---|---|
| [0001](0001-primary-cloud-provider.md) | Primary cloud provider | Proposed | Single-cloud at launch; multi-cloud-capable architecture | Head of SRE |
| [0002](0002-media-provider.md) | Media / SFU provider | Proposed | Buy-first SFU at launch | Media Engineering Lead |
| [0003](0003-event-bus.md) | Managed event bus + schema registry | Proposed | Managed event bus | Platform Engineering Lead |
| [0004](0004-database-baseline.md) | Database baseline | Proposed | Relational core + append-only event store + object + search + vector + cache | Platform Engineering Lead |
| [0005](0005-search-vector-store.md) | Search and vector store | Proposed | Managed search + vector store | Real-Time Engineering Lead |
| [0006](0006-service-mesh.md) | Service mesh | Proposed | Service mesh (mTLS, retries, telemetry) | Head of SRE |
| [0007](0007-payments-tax-engine.md) | Payments and tax engine | Proposed | Vendor TBD; global payments + tax/VAT support | Billing Engineering Lead |
| [0008](0008-mobile-strategy.md) | Mobile strategy | Proposed | Native Swift/Kotlin **or** cross-platform by ADR | Client Engineering Lead |
| [0009](0009-desktop-strategy.md) | Desktop strategy | Proposed | TypeScript-based shell **or** native by ADR | Client Engineering Lead |
| [0010](0010-ai-provider-model-policy.md) | AI provider / model policy | Proposed | Model Router with multi-provider; no training on customer data without opt-in | Head of AI |
| [0011](0011-service-communication-patterns.md) | Service communication patterns | Proposed | gRPC over mTLS internal; REST/OpenAPI external | Platform/API Lead |
| [0012](0012-programming-language.md) | Programming language baseline | Proposed | Go primary; Python for AI; Rust by exception | Platform Engineering Lead |
| [0013](0013-deployment-model.md) | Deployment model | Proposed | Kubernetes primary; serverless by exception | Head of SRE |
| [0014](0014-observability-backend.md) | Observability backend | Proposed | OpenTelemetry instrumentation; backend TBD | Head of SRE |
| [0015](0015-capacity-targets.md) | Capacity targets commitment | Proposed | SPEC §25 baselines | Head of SRE |
| [0016](0016-failure-mode-commitments.md) | Failure-mode commitments and RTOs | Proposed | SPEC §27 RTO targets | Head of SRE |
| [0017](0017-data-residency-enforcement.md) | Data residency enforcement model | Proposed | Workspace region pin; policy-bound failover | Security Lead |
| [0018](0018-zoikotime-contract.md) | ZoikoTime integration contract | Proposed | Bidirectional, versioned, failure-independent (SPEC §15) | Sema Lead + ZoikoTime Lead |
| [0019](0019-billing-ledger-pattern.md) | Billing ledger pattern | Proposed | Event ledger + relational views | Billing Engineering Lead |
| [0020](0020-public-api-versioning.md) | Public API versioning policy | Proposed | REST/OpenAPI versioned; deprecation by ADR | Platform/API Lead |

## Conventions

- New ADRs are numbered sequentially. Numbers are never reused.
- Once **Accepted**, an ADR is amended only via an explicit Superseded → new ADR pair, not in-place edits.
- A Class 3 specification (per SPEC §29) cannot supersede or contradict an Accepted ADR; only a new ADR can.
- All ADRs must record **Reversibility** in the Consequences section (cheap / expensive / one-way).
