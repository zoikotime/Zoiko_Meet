# AI ADR Index

Source authority: `architecture/SPEC-AI.md` §34 (Required ADRs).

All AI ADRs are stubs in **Proposed** state until the Architecture Review Board approves them. Defaults from SPEC-AI body apply where the ADR has not yet been resolved.

| ID | Title | Owner | Source |
|---|---|---|---|
| [ADR-AI-001](ADR-AI-001-ai-gateway-placement.md) | AI Gateway placement and enforcement responsibilities | AI Platform Engineering | §6, §9, §16 |
| [ADR-AI-002](ADR-AI-002-model-router.md) | Model router routing criteria and provider abstraction | AI Platform Engineering | §6, §17, §18 |
| [ADR-AI-003](ADR-AI-003-prompt-registry.md) | Prompt registry implementation and approval workflow | AI Engineering | §11 |
| [ADR-AI-004](ADR-AI-004-context-retrieval.md) | Context retrieval and permission filtering architecture | Search / AI Engineering | §12, §8 |
| [ADR-AI-005](ADR-AI-005-embedding-vector-isolation.md) | Embedding store and vector index isolation design | Data / AI Engineering | §13, §8 |
| [ADR-AI-006](ADR-AI-006-output-classification.md) | AI output classification taxonomy | Head of AI | §14 |
| [ADR-AI-007](ADR-AI-007-human-oversight-policy.md) | Human oversight policy by risk class | Head of AI | §15 |
| [ADR-AI-008](ADR-AI-008-tenant-ai-policy-model.md) | Tenant AI policy model | AI Platform Engineering | §16 |
| [ADR-AI-009](ADR-AI-009-provider-onboarding-offboarding.md) | Provider onboarding and offboarding process | Head of AI | §18 |
| [ADR-AI-010](ADR-AI-010-training-data-policy.md) | AI training data policy implementation | Head of AI | §19 |
| [ADR-AI-011](ADR-AI-011-evaluation-infrastructure.md) | Evaluation infrastructure and gating thresholds | AI Evaluation Lead | §20, §27 |
| [ADR-AI-012](ADR-AI-012-observability-data-model.md) | AI observability data model | AI Platform Engineering | §22 |
| [ADR-AI-013](ADR-AI-013-cost-ceilings-circuit-breakers.md) | AI cost ceilings and circuit breakers | FinOps + AI Platform | §23 |
| [ADR-AI-014](ADR-AI-014-security-prompt-injection-tool-abuse.md) | AI security controls for prompt injection and tool abuse | Security | §21, §25 |
| [ADR-AI-015](ADR-AI-015-incident-severity-model.md) | AI incident severity model | Security / AI Ops | §32 |
| [ADR-AI-016](ADR-AI-016-agentic-ai-authorisation.md) | Agentic AI authorisation model | AI Engineering / Security | §26 |
| [ADR-AI-017](ADR-AI-017-tool-registry-risk-classification.md) | Tool registry and risk classification | AI Engineering | §26 |
| [ADR-AI-018](ADR-AI-018-action-reversal.md) | Action reversal architecture | AI Engineering | §26 |
| [ADR-AI-019](ADR-AI-019-agent-loop-control.md) | Agent loop control parameters | AI Engineering | §26 |
| [ADR-AI-020](ADR-AI-020-model-lifecycle-management.md) | Model lifecycle management process | Head of AI | §27 |
| [ADR-AI-021](ADR-AI-021-provider-risk-classification.md) | Provider risk classification and exit conditions | Head of AI | §18 |
| [ADR-AI-022](ADR-AI-022-knowledge-graph-implementation.md) | Knowledge graph implementation | AI / Data Engineering | §28 |
| [ADR-AI-023](ADR-AI-023-eu-ai-act-classification.md) | EU AI Act classification approach | Compliance / Legal | §31 |
| [ADR-AI-024](ADR-AI-024-continuous-evaluation-infrastructure.md) | Continuous evaluation infrastructure | AI Evaluation Lead | §20 |
| [ADR-AI-025](ADR-AI-025-zoikotime-integration-contract.md) | ZoikoTime integration contract | Sema + ZoikoTime Lead | §29 |
| [ADR-AI-026](ADR-AI-026-feature-store-and-telemetry.md) | Feature store and AI telemetry architecture | Data / AI Engineering | §8, §22 |
| [ADR-AI-027](ADR-AI-027-human-evaluation-operating-model.md) | Human evaluation operating model | AI Evaluation Lead | §20 |
| [ADR-AI-028](ADR-AI-028-compliance-evidence-repository.md) | AI compliance evidence repository | Compliance + AI Platform | §31, §32 |
| [ADR-AI-029](ADR-AI-029-rollback-failover-runbook.md) | Model rollback and failover runbook | Head of AI / SRE | §27, §32 |
| [ADR-AI-030](ADR-AI-030-high-risk-ai-enablement-controls.md) | High-risk AI enablement controls | Compliance + Head of AI | §14, §31 |

## Cross-references to platform ADRs

The AI ADRs assume but do not duplicate platform-level decisions in `architecture/adr/`:

| AI concern | Platform ADR |
|---|---|
| Cloud / observability backend / capacity / failure modes | ADR-0001, ADR-0014, ADR-0015, ADR-0016 |
| Service mesh + gRPC patterns for AI service-to-service | ADR-0006, ADR-0011 |
| Search/vector store substrate | ADR-0005 |
| Event bus for AI events (eval, audit, lifecycle) | ADR-0003 |
| Data residency primitive | ADR-0017 |
| ZoikoTime contract (platform-wide) | ADR-0018 |
