# ZOIKO PLATFORM — AI ARCHITECTURE SPECIFICATION

**Zoiko Sema / Connect**

| Control | Value |
|---|---|
| Document class | Tier-0 Architecture Document (Class 2) |
| Document ID | ZSC-AI-ARCH-001 |
| Version | v2.0 — Zero-Gaps Final |
| Status | Architecture Review Board Review Pack |
| Owner | Head of Artificial Intelligence |
| Approver | Architecture Review Board |
| Executive sponsor | Chief Technology Officer |
| Effective | Upon ARB approval |
| Review cadence | Quarterly, or upon material architectural, model, regulatory, safety, provider, security, or cost change |
| Governing documents | Zoiko Technical Governance Framework; Zoiko Platform Constitution; Zoiko Master Platform Architecture Specification (`SPEC.md`); Zoiko Data Architecture Specification |
| Confidentiality | Internal — Engineering, Product, AI, Security, Data, Infrastructure, Legal, Compliance, Executive Leadership |

> **Storage note (added by repo maintainer 2026-04-27):** The text below was supplied by the document owner and pasted into the repo verbatim. **Sections 36 (tail), 37 (Open Decisions) and 38 (Final Architectural Position) were truncated in transit** at the line ending "Lists prohibited patterns, required ADRs, downstream specificat…". The truncated tail must be resupplied by the document owner before ARB review.

## Version History

| Version | Date | Author / Owner | Change Summary |
|---|---|---|---|
| v1.0 | Prior draft | Head of AI | Initial AI architecture derived from Master Platform Architecture. |
| v1.1 | Architecture review refinement | Head of AI / CTO Review | Added agentic AI, model lifecycle, provider risk, evaluation infrastructure, cost controls, knowledge architecture, and EU AI Act posture. |
| v2.0 | Final review pack | Architecture Review Board | Expanded all sections so no section relies on "unchanged from v1.0"; integrated zero-gaps production-grade details, approval criteria, operating controls, required ADRs, and downstream specifications. |

> **ARB approval note**
>
> This document is written as a Class 2 architecture specification. It defines mandatory architectural commitments. It is not a product marketing document, not a prompt guide, and not an implementation ticket. Engineering teams must produce Class 3 specifications and Class 4 operational runbooks that conform to this document before production launch.

## 1. Purpose

This AI Architecture Specification defines the mandatory architecture for artificial intelligence across Zoiko Sema Connect and its approved platform integrations. It establishes how AI capabilities are designed, routed, isolated, evaluated, monitored, governed, cost-controlled, secured, and retired.

The purpose is to make the platform genuinely AI-native without allowing AI to become an ungoverned sidecar. AI must enhance organisational memory, decision continuity, work execution, and user productivity while remaining explainable, tenant-isolated, revocable, auditable, cost-bounded, and compliant.

This document is binding for product, engineering, AI/ML engineering, platform engineering, security, legal, compliance, infrastructure, data engineering, and commercial teams. Any AI capability that cannot comply with this architecture is not eligible for production release.

> **Core doctrine** — Sema AI is not a chatbot bolted onto collaboration software. It is a governed intelligence layer that understands communications, decisions, commitments, context, workflow state, and organisational memory — while preserving human authority and tenant control.

## 2. Architectural Position

AI sits inside the governed platform architecture as a controlled capability plane. It does not own tenant truth, does not bypass authorisation, does not become the system of record, and does not operate outside observable, versioned, auditable pathways.

The AI subsystem has four architectural obligations:

- Generate and extract intelligence from authorised tenant context only.
- Preserve tenant isolation, residency, security, and retention obligations end to end.
- Support human-in-command governance for high-impact decisions and side-effecting actions.
- Operate within measurable quality, safety, latency, availability, and cost boundaries.

| Principle | Mandatory implication |
|---|---|
| Human authority | AI may recommend, draft, classify, summarise, extract, and prepare actions; humans or explicit tenant policy retain authority over material state changes. |
| Tenant sovereignty | Tenant data, prompts, embeddings, features, knowledge graph data, logs, and outputs remain logically isolated and subject to tenant policy. |
| Model independence | Business capability must not be hard-coded to any single provider or model family. |
| Evaluation-led release | AI is promoted by evidence, not confidence or subjective preference. |
| Cost boundedness | AI cost is an enforced architectural primitive, not an after-the-fact finance report. |
| Regulatory readiness | The architecture must produce the evidence needed for EU AI Act, ISO/IEC 42001, privacy, security, and audit reviews. |

## 3. Scope

This specification covers all AI capabilities delivered by Sema Connect, including user-facing AI, background AI, signal extraction, meeting intelligence, search augmentation, knowledge graph construction, AI-assisted workflow, agentic workflows, administrative AI controls, and integrations with ZoikoTime and other approved Zoiko platforms.

The scope includes:

- AI gateway and request routing architecture.
- Model provider abstraction, selection, fallback, and risk management.
- Prompt, retrieval, embedding, context, and vector architecture.
- AI output classification and human oversight.
- Tenant AI policy controls, privacy, retention, residency, and DSAR alignment.
- Agentic AI authorisation, tool use, revocation, loop control, and action reversal.
- Continuous evaluation infrastructure, model lifecycle management, model telemetry, and incident response.
- AI cost governance from request level to platform-level circuit breakers.
- Knowledge graph and organisational memory architecture.
- EU AI Act, ISO/IEC 42001, data protection, security, and audit evidence posture.

This document does not define the full physical schemas, model cards, prompt libraries, provider contracts, runbooks, UI designs, or product copy. Those are downstream Class 3 and Class 4 documents governed by this specification.

## 4. Inheritance and Traceability

This document inherits from the Zoiko Technical Governance Framework, Zoiko Platform Constitution, Master Platform Architecture (`architecture/SPEC.md`), and Data Architecture. It implements the AI-layer obligations of those parent documents and must not contradict them.

| Parent commitment | Implemented by this document |
|---|---|
| Platform Constitution — tenant control, auditability, governance | Sections 8, 15, 16, 24, 28, 32 |
| Master Architecture — AI and signal architecture | Sections 5–14 and 25B |
| Master Architecture — ZoikoTime integration | Section 29 |
| Master Architecture — observability and SLOs | Sections 21, 22, 23, 32 |
| Master Architecture — failure modes | Sections 23, 25, 25A, 32 |
| Data Architecture — feature stores, embeddings, training/evaluation datasets | Sections 12, 13, 18, 19, 25B, 30 |
| Data Architecture — schema evolution and data products | Sections 19, 25B, 29, 35 |
| Security Architecture — identity, access, encryption, threat controls | Sections 8, 24, 25, 32 |

Where AI Architecture introduces additional requirements not explicitly defined in parent documents, it does so only within the constraints established by those documents. Conflicts are resolved by the Architecture Review Board, with the Platform Constitution and Master Architecture prevailing.

## 5. AI Subsystem Overview

The AI subsystem is organised into eight architectural layers. Each layer has a distinct responsibility and avoids leakage of authority into adjacent layers.

| Layer | Purpose | System-of-record status |
|---|---|---|
| AI Gateway | Entry point for all AI requests, policy enforcement, cost ceilings, rate limits, logging, and request normalisation. | Not system of record |
| Model Router | Selects model/provider by capability, policy, latency, cost, residency, evaluation score, and failover readiness. | Routing decision record only |
| Context Orchestrator | Retrieves authorised context, applies scope, redaction, summarisation, ranking, and prompt-context budgeting. | Not system of record |
| Prompt and Policy Engine | Assembles versioned prompts and applies tenant, safety, privacy, and role policies. | Prompt registry is source of prompt truth |
| Tool and Agent Runtime | Executes authorised tools and agentic workflows under scoped, revocable authority. | Action logs and workflow states are records |
| Signal Extraction Engine | Extracts decisions, commitments, actions, issues, risks, summaries, and communication health indicators. | Derived signal data only |
| Knowledge Graph Layer | Builds tenant-isolated organisational memory from signals and source lineage. | Derived and rebuildable, but governed as high-value data |
| Evaluation and Observability Plane | Measures quality, safety, cost, latency, drift, incidents, provider performance, and model behaviour. | Evaluation records and telemetry are audit data |

## 6. Logical AI Service Architecture

The logical service architecture separates AI concerns into independently deployable services with strict contracts. Services communicate through versioned APIs and events. No service may directly access another service's private storage unless explicitly approved by an ADR.

| Service | Responsibilities | Primary consumers |
|---|---|---|
| ai-gateway | Authentication enforcement, request validation, tenant policy lookup, cost ceiling enforcement, rate limits, audit entry creation. | All AI-enabled application surfaces |
| model-router | Provider/model selection, fallback routing, concentration enforcement, canary routing, champion/challenger routing. | AI Gateway, evaluation services |
| prompt-registry | Versioned prompt templates, policy fragments, system prompts, approval status, rollout metadata. | AI Gateway, model-router, evaluation |
| context-orchestrator | Retrieval planning, permission-aware retrieval, redaction, token budgeting, context compression, source attribution. | AI Gateway, agent runtime |
| embedding-service | Embedding generation, versioning, reindex orchestration, vector write/read abstraction. | Search, knowledge graph, retrieval |
| signal-extractor | Meeting and message analysis; decisions, commitments, action items, unresolved issues, risks. | Knowledge graph, dashboards, notifications |
| knowledge-graph-service | Entity resolution, temporal graph construction, invalidation, query, export, deletion propagation. | AI answers, analytics, workflow services |
| agent-runtime | Tool planning, tool execution, scope checking, loop control, action reversal, revocation. | AI Gateway, workflow surfaces |
| ai-eval-service | Offline, shadow, online, human, champion/challenger evaluation, golden set management. | Model router, release automation, Head of AI |
| ai-observability-service | Telemetry aggregation, drift monitoring, latency, cost, safety, provider metrics, incident detection. | SRE, AI Ops, ARB, FinOps |
| ai-compliance-service | AI Act evidence, model cards, transparency records, risk logs, oversight logs, impact assessment support. | Compliance, Legal, CISO, CTO |

## 7. AI Plane Architecture

The AI plane is a controlled execution environment. It is logically separate from the core application plane, data plane, observability plane, and administrative plane. It may request authorised data and emit derived outputs, but it does not bypass platform controls.

| Plane | AI relationship | Mandatory boundary control |
|---|---|---|
| Application plane | User interface and workflow surfaces invoke AI through AI Gateway only. | No direct model-provider calls from front-end or product services. |
| Data plane | AI reads authorised data through context services and writes derived data through defined domain APIs/events. | No raw datastore access from prompts or model-runtime code. |
| Control plane | Tenant policy, admin settings, provider configuration, rollout policy, and cost ceilings govern AI behaviour. | Changes require RBAC and audit. |
| Observability plane | AI telemetry feeds logs, metrics, traces, eval results, and cost records. | Telemetry must be tenant-aware and privacy-safe. |
| Security plane | Identity, authorisation, encryption, threat detection, secret management, and incident response apply to all AI paths. | Security policy overrides model preference or cost optimisation. |

## 8. Tenant Isolation in AI

Tenant isolation applies to every AI artifact: prompts, request logs, response logs, embeddings, feature values, retrieved context, vector indices, knowledge graph nodes, evaluation samples, human evaluation queues, agent authorisations, tool outputs, and cost records.

| Artifact | Isolation requirement | Deletion and residency behaviour |
|---|---|---|
| Prompt input | Tenant-scoped and policy-checked before provider call. | Stored only per tenant prompt retention policy and regional assignment. |
| Response output | Tenant-scoped; source attribution preserved where applicable. | Deleted or retained under source and output retention policy. |
| Embeddings | Tenant-partitioned or tenant-indexed with hard access filters. | Deleted when source content is deleted; recomputed on model version change. |
| Vector indices | No cross-tenant shared retrieval surface unless anonymised and explicitly approved. | Mirrors source residency and retention. |
| Feature store values | Tenant-isolated, point-in-time correct, lineage tracked. | Subject to retention and model governance policy. |
| Evaluation samples | Tenant-aware sampling; consent-aware for sensitive workflows. | Stored in eval registry under privacy controls. |
| Agent state | Scoped to tenant, user, authorisation, tool, and invocation. | Destroyed or archived by agent retention policy. |
| Knowledge graph | Tenant-isolated; no cross-tenant inference. | Derived data deletion follows source deletion and DSAR rules. |

> **Non-negotiable isolation rule** — No AI component may use data from Tenant A to generate, evaluate, embed, retrieve, train, optimise, or personalise outputs for Tenant B unless the data has been lawfully anonymised, aggregated, and approved through the Data Architecture and Legal/Compliance review process.

## 9. AI Request Lifecycle

1. User, service, or scheduled workflow initiates an AI request through an approved surface.
2. Application surface calls AI Gateway with user identity, tenant identity, workspace identity, request type, desired capability, and declared purpose.
3. AI Gateway authenticates the principal and evaluates RBAC, ABAC, tenant policy, feature entitlement, data residency, rate limits, and cost ceilings.
4. Context Orchestrator constructs an authorised retrieval plan and fetches only permitted context; unauthorised context is excluded before prompt assembly.
5. Prompt and Policy Engine selects approved prompt version, policy fragments, safety instructions, output schema, and response constraints.
6. Model Router chooses provider/model based on capability, risk class, residency, evaluation score, latency, cost, fallback readiness, and concentration limit.
7. Model call is executed through a provider adapter. Inputs and outputs are logged according to retention and privacy policy.
8. Output passes schema validation, safety filters, grounding checks, policy checks, citation/source checks where applicable, and classification.
9. For low-risk output, response returns to the user. For higher-risk output, human confirmation, review, or workflow approval is required.
10. Telemetry, cost records, evaluation samples, audit entries, and knowledge graph updates are emitted through approved event streams.

## 10. Critical AI Workflows

| Workflow | Purpose | Risk class | Key controls |
|---|---|---|---|
| Meeting summary | Summarise meetings, decisions, follow-ups, blockers, and risks. | Medium | Source-linked outputs, confidence indicators, editability, retention mirroring. |
| Action extraction | Identify action items, assignees, due dates, dependencies. | Medium | Human confirmation before task creation unless tenant policy authorises automation. |
| Decision tracking | Extract formal and informal decisions and attach lineage. | Medium to high | Attribution, temporal validity, contradiction detection, source preservation. |
| AI search answer | Answer using authorised organisational context. | Medium | Permission-aware retrieval, source grounding, no answer when confidence insufficient. |
| Communication health indicators | Detect unresolved issues, response delays, coordination risk. | High if used for employment decisions | Transparency, user controls, no employment action without high-risk controls. |
| Drafting assistant | Draft messages, summaries, updates, and responses. | Low to medium | User edit before send; external send requires confirmation. |
| Agentic workflow | Plan and execute multi-step state-changing workflow. | High | Explicit authorisation, loop limits, tool risk class, revocation, reversal, audit. |
| ZoikoTime enrichment | Blend workforce truth context with Sema knowledge workflows. | High | Integration contract, consent, purpose limitation, high-risk controls when employment-relevant. |

## 11. Prompt Architecture

Prompts are governed software artifacts. They are versioned, reviewed, tested, released, rolled back, and retired. Prompt text is not hard-coded into application surfaces or hidden in service configuration without registry control.

| Prompt class | Purpose | Approval requirement |
|---|---|---|
| System prompt | Defines model role, boundaries, and non-negotiable policy. | Head of AI and Security review. |
| Capability prompt | Implements a specific product capability such as summarisation or extraction. | Capability owner and AI evaluation review. |
| Tenant policy prompt fragment | Applies tenant-specific rules such as retention, allowed tools, or tone. | Tenant admin setting plus policy validation. |
| Safety prompt fragment | Applies safety, privacy, prompt-injection, or tool-use constraints. | Security and AI Safety review. |
| Output schema instruction | Defines structured output format and validation rules. | Engineering owner and schema registry alignment. |

Prompt changes follow the same release discipline as code: pull request, review, evaluation, canary, telemetry, rollback path, and change log. Prompt versions must be traceable to outputs for audit and reproduction.

## 12. Context Retrieval Architecture

Context retrieval is permission-aware, purpose-bound, and token-budgeted. Retrieval does not simply search the tenant corpus; it constructs an authorised context set based on user rights, tenant policy, data residency, source retention, source sensitivity, request purpose, and model capability.

| Stage | Description | Failure handling |
|---|---|---|
| Scope resolution | Determine tenant, workspace, channels, documents, meetings, users, time window, and data classes eligible for retrieval. | Reject or narrow request if scope is ambiguous or overbroad. |
| Permission filtering | Apply RBAC/ABAC and source-specific permissions before ranking. | Unauthorised items never enter candidate set. |
| Hybrid retrieval | Combine keyword, vector, graph, recency, and workflow-state retrieval where appropriate. | Fallback to narrower methods when one index is degraded. |
| Context ranking | Rank by relevance, authority, freshness, source quality, and confidence. | Flag low-confidence retrieval to output validator. |
| Compression | Summarise or chunk context within token budget while preserving citations and lineage. | Abort if compression destroys required grounding. |
| Injection defence | Detect and quarantine malicious instructions in retrieved content. | Treat untrusted content as data, not instructions. |
| Grounding package | Assemble model-visible context with source references and policy guardrails. | If sources are insufficient, instruct model to refuse or ask for clarification. |

## 13. Embedding and Vector Architecture

Embeddings are derived data with security and governance implications. They must not become an unmanaged shadow copy of tenant data.

| Control | Requirement |
|---|---|
| Embedding versioning | Every embedding is tied to embedding model ID, version, dimensions, source record ID, source schema version, tenant ID, region, and creation timestamp. |
| Source lineage | Embedding records maintain lineage to source content so deletion, redaction, retention changes, and legal hold can propagate. |
| Index partitioning | Vector indices must enforce tenant isolation through physical partitioning or mandatory tenant filters verified by tests. |
| Recompute policy | Embedding model changes require staged recompute with dual-index operation until cutover is complete. |
| Retention mirroring | Embeddings follow source retention and deletion obligations. |
| Security posture | Vectors are treated as sensitive derived data because they can leak semantic information about source content. |

## 14. AI Output Classification

| Class | Description | Default control |
|---|---|---|
| Informational | Low-impact explanation or summary with no state change. | Return to user with source references where applicable. |
| Advisory | Recommendation that may influence user judgement. | Display uncertainty, rationale, and allow user override. |
| Workflow-preparatory | Drafts or prepares an action but does not execute. | Human review before execution. |
| State-changing | Executes or modifies platform state. | Requires scoped agent authorisation and audit. |
| External-effect | Sends external communication or triggers external service. | Per-action human confirmation unless explicitly authorised by tenant policy. |
| Compliance-impacting | Affects legal hold, retention, access policy, billing, employment, or security posture. | AI may assist only; authenticated human action required. |
| High-risk decision support | Could support employment, credit, access, compliance, safety, or legal decisions. | Additional high-risk controls, evidence, transparency, and human oversight. |

## 15. Human Oversight Doctrine

Human oversight is designed into the architecture, not appended as a disclaimer. The default doctrine is human-in-command for material decisions and human-on-the-loop for lower-risk automated workflows.

| Oversight mode | Use case | Control |
|---|---|---|
| Human-in-command | High-risk, compliance-impacting, employment-relevant, billing, deletion, external send, tenant policy changes. | AI cannot execute final action. Human must authenticate, review, and approve. |
| Human-in-the-loop | Medium side-effect actions, workflow creation, task assignment, meeting summaries with downstream use. | AI prepares; human confirms or edits. |
| Human-on-the-loop | Low-risk background extraction and ranking. | Humans can audit, correct, disable, or override. |
| Autonomous within policy | Low-risk, reversible, tenant-authorised operations. | Explicit policy, limited scope, logging, loop limits, and revocation. |

## 16. Tenant AI Policy Controls

Tenants must be able to govern AI behaviour at workspace and organisational levels. Tenant controls are enforced by the AI Gateway and policy engine, not merely surfaced in UI.

| Policy area | Tenant control |
|---|---|
| Feature enablement | Enable or disable AI capabilities by workspace, role, department, data class, and geography. |
| Data sources | Specify which channels, meetings, files, integrations, and ZoikoTime signals are eligible for AI processing. |
| Retention | Configure prompt, response, summary, embedding, and derived signal retention within platform and legal limits. |
| Training consent | Opt in or out of any permitted training/evaluation use where lawful and offered. |
| Agentic actions | Define which tools may be used autonomously, with confirmation, or never. |
| Cost ceilings | Set workspace and tenant-level budgets, throttling, and escalation thresholds. |
| Transparency | Configure disclosure, labelling, and user-facing explanation settings. |
| High-risk controls | Require extra review, logging, and restrictions for employment-relevant or decision-support uses. |

## 17. Model Provider Strategy

The platform is model-independent and provider-aware. The model router abstracts provider differences while preserving provider-specific evaluation, security, cost, latency, residency, and capability characteristics.

| Routing factor | Meaning |
|---|---|
| Capability fit | Model performance for task type, modality, language, context size, reasoning complexity, tool use, extraction accuracy. |
| Risk class | Higher-risk tasks require models with proven evaluation performance and appropriate controls. |
| Residency and data handling | Provider and region must satisfy tenant and jurisdictional policy. |
| Latency and availability | Service-level requirements and provider health affect routing. |
| Cost efficiency | Cost matters only after capability, safety, policy, and residency are satisfied. |
| Evaluation score | Recent offline, online, shadow, and human eval scores influence selection. |
| Concentration limits | Traffic allocation must respect provider concentration thresholds. |
| Fallback readiness | Features require tested fallback models before production where risk warrants. |

## 18. Provider Risk and Concentration Management

AI provider relationships are managed strategic dependencies, not commodity utilities. The frontier model market is concentrated, fast-moving, and exposed to commercial, regulatory, geopolitical, operational, and capability risk.

| Risk dimension | Examples | Control |
|---|---|---|
| Commercial | Price changes, contract changes, usage minimums, indemnity gaps. | Quarterly commercial review and exit conditions. |
| Capability | Behavioural drift, model deprecation, regression, reduced tool reliability. | Continuous eval, canaries, fallback routing. |
| Availability | Outages, rate-limit changes, regional withdrawal. | Provider health checks, failover, queued degradation. |
| Geopolitical | Export controls, sanctions, sovereign constraints. | Regional provider mapping and legal review. |
| Data handling | Retention, training policy, residency or sub-processor changes. | Contract controls, DPIA review, provider offboarding plan. |
| Concentration | Excessive dependence on one provider. | Default cap: no single provider above 70% token volume without ARB exception. |

Provider onboarding requires commercial review, security review, privacy/data handling assessment, residency verification, evaluation in shadow mode, canary rollout, and ARB-recorded provider entry. Provider offboarding requires traffic drain, data handling verification, cost reconciliation, audit preservation, and replacement readiness.

## 19. AI Training Data Policy

The default customer-data rule is conservative: tenant content is not used to train general models unless explicitly permitted by contract, law, tenant configuration, and governance approval. The platform may use synthetic data, public/licensed data, internal test data, anonymised/aggregated data, and opt-in tenant data only under documented governance.

| Data type | Training use | Conditions |
|---|---|---|
| Raw tenant content | Prohibited by default. | Only with explicit tenant opt-in, lawful basis, contract coverage, and ARB-approved control set. |
| Prompt/response logs | Prohibited for general training by default. | May be used for safety/evaluation under retention and consent policy. |
| Synthetic data | Permitted. | Generation process and quality checks recorded. |
| Anonymised/aggregated data | Permitted where truly anonymised and lawful. | Re-identification risk assessment required. |
| Human evaluation labels | Permitted for improving evaluation and supervised fine-tuning where policy allows. | Rater consent, quality controls, data provenance. |
| Opt-in data | Permitted within scope of consent. | Consent version, withdrawal, lineage, and deletion controls required. |

## 20. Evaluation Architecture

Evaluation is continuous infrastructure. It is not a one-off approval step. The platform measures quality, safety, grounding, hallucination, extraction accuracy, reasoning quality, instruction adherence, tool-use correctness, latency, cost, fairness, robustness, and user outcomes.

| Evaluation track | Purpose | Minimum standard |
|---|---|---|
| Pre-deployment | Block unsafe or low-quality changes before release. | Every prompt/model/tool change evaluated against versioned suite. |
| Shadow evaluation | Compare new model against production traffic without user exposure. | Minimum 14 days for production-scale or high-risk capabilities. |
| Online evaluation | Sample production outputs for continuing quality measurement. | Tenant-aware and consent-aware sampling. |
| Champion/challenger | Compare incumbent and candidate models under controlled routing. | Statistical significance plus safety and cost thresholds. |
| Human evaluation | Assess cases automated metrics cannot judge. | Trained raters, inter-rater agreement, bias controls. |
| Golden set testing | Protect critical capabilities against regression. | Hand-curated, never used for training, versioned. |
| Adversarial evaluation | Test prompt injection, jailbreaks, unsafe tool use, data exfiltration. | Required for release of agentic or sensitive workflows. |

Promotion between environments is gated by automated evaluation thresholds. Manual bypass requires a documented exception, named approver, expiry, and compensating controls.

## 21. Safety and Guardrail Architecture

Safety controls are layered. The platform does not rely solely on provider-level safety. Sema applies controls before retrieval, during prompt assembly, after model output, before tool execution, and during human presentation.

| Control layer | Examples |
|---|---|
| Input safety | Prompt injection detection, malicious instruction isolation, PII and secret detection, request abuse rate limits. |
| Retrieval safety | Permission filtering, source trust ranking, injection defence, context redaction. |
| Generation safety | System instructions, policy fragments, provider safety settings, output schema constraints. |
| Output safety | Toxicity, privacy, hallucination, legal/medical/financial disclaimers where applicable, groundedness checks. |
| Tool safety | Tool registry, risk class, authorisation scope, confirmations, loop control, revocation. |
| Post-output safety | User reporting, correction flows, incident escalation, evaluation feedback. |

## 22. AI Observability

The AI subsystem must be observable at request, session, workspace, tenant, provider, model, feature, and platform levels. Observability must support debugging, safety, evaluation, compliance, FinOps, and incident response without violating privacy.

| Telemetry category | Required fields / examples |
|---|---|
| Request metadata | Tenant, workspace, user role, capability, prompt version, model, provider, region, token counts, latency. |
| Quality telemetry | Eval scores, user corrections, thumbs-up/down, edit distance, groundedness, extraction precision/recall. |
| Safety telemetry | Blocked requests, policy violations, injection attempts, unsafe output, tool denial, agent revocation. |
| Cost telemetry | Input/output tokens, retrieval cost, tool cost, provider cost, allocated cost center, tenant budget consumption. |
| Reliability telemetry | Provider errors, retries, fallback events, queue latency, timeout, circuit breaker activation. |
| Compliance telemetry | AI labels, high-risk feature use, human oversight logs, consent version, retention class, data residency. |

## 23. AI Cost Governance

AI cost is an architectural constraint and is enforced in real time. A platform that can generate unbounded model calls, long-context retrieval, or uncontrolled agent loops is not production-grade.

| Cost control level | Controls |
|---|---|
| Request level | Maximum tokens, context size, retrieved chunks, tool calls, retries, and provider cost per request. |
| Session level | Compounded cost ceilings for multi-turn and agentic workflows. |
| Workspace level | Daily, weekly, monthly ceilings with tenant policy controls. |
| Tenant level | Plan-defined AI allowance, overage settings, throttling, degradation, approval workflow. |
| Feature level | Cost budgets by product capability with ROI and usage monitoring. |
| Provider level | Traffic allocation, rate-limit controls, quota management, price-change alerts. |
| Platform level | Circuit breakers for runaway cost, abnormal token growth, retrieval explosion, or loop storms. |

Cost breach response must degrade gracefully: reduce context, use lower-cost approved models, queue non-critical jobs, require confirmation, throttle, suspend feature, or trigger incident response depending on severity.

## 24. AI Reliability and Degradation

AI features must degrade predictably. A provider outage must not bring down core collaboration workflows. A failed summary must not prevent message delivery. A delayed extraction must not block meeting completion.

| Failure mode | Required degradation |
|---|---|
| Provider outage | Fallback to alternate provider/model; if unavailable, disable AI feature and preserve core workflow. |
| Model timeout | Retry within budget; fallback to smaller model or asynchronous processing. |
| Retrieval failure | Return ungrounded refusal or narrower answer; never invent source context. |
| Embedding/index outage | Fallback to keyword search where safe; queue reindex. |
| Evaluation service outage | Block promotion; continue serving approved production models. |
| Agent runtime anomaly | Terminate in-flight agent, revoke scope, preserve audit and notify user/admin. |
| Cost circuit breaker | Suspend or throttle AI features while preserving non-AI platform operation. |

## 25. AI Security Architecture

AI security covers both traditional controls and AI-specific threat surfaces: prompt injection, tool abuse, data exfiltration, model output leakage, cross-tenant retrieval, training data contamination, provider compromise, and agentic overreach.

| Threat | Control |
|---|---|
| Prompt injection | Treat retrieved content as data, isolate untrusted instructions, scan prompts and outputs, test adversarially. |
| Cross-tenant leakage | Hard tenant filters, index partitioning, audit tests, synthetic canary records, retrieval validation. |
| Tool abuse | Tool registry, scoped authorisation, risk classification, confirmation, rate limits, anomaly detection. |
| Secret exposure | Secret scanning, redaction, provider restrictions, output filters, DLP. |
| Model supply-chain risk | Provider review, contractual controls, model registry, canary tests, behaviour drift monitoring. |
| Eval contamination | Separate training and evaluation datasets, access controls, dataset lineage. |
| Agentic escalation | No self-authorisation, no scope expansion, revocation, loop limits, human confirmation for high-risk actions. |
| Insider misuse | RBAC, least privilege, audit logs, privacy-preserving access to prompt/response logs. |

## 26. AI Tool and Agent Architecture

Agentic AI is the highest-risk AI surface. Any workflow that takes action, modifies state, calls tools, sends communications, creates obligations, or invokes external services is governed by this section.

| Tool risk class | Definition | Default authorisation |
|---|---|---|
| Read-only | Retrieves authorised data with no side effects. | Normal access controls plus logging. |
| Low side-effect | Modifies non-critical user-controlled state and is fully reversible. | Session confirmation or tenant-authorised automation. |
| Medium side-effect | Creates visible artifacts or obligations, such as drafts or tasks. | Human confirmation by default. |
| High side-effect | Sends external communications, modifies shared workflow, affects others. | Per-action human confirmation required unless ARB-approved narrow exception. |
| Critical | Billing, deletion, legal hold, compliance settings, tenant policy, security settings. | Prohibited to autonomous agents; authenticated human action required. |

Agent authorisation is explicit, scoped, time-bounded, revocable, auditable, and non-transferable. It identifies the authorising principal, permitted actions, constraints, expiry, revocation conditions, and maximum cost/time/iteration boundaries.

Every agentic workflow must include loop control, anomaly detection, cost ceilings, tool-call ceilings, elapsed-time limits, convergence checks, revocation pathways, and action audit records. Where actions are reversible, reversal primitives must be implemented. Where actions are irreversible, the architecture must split prepare and execute phases whenever possible.

## 27. Model Lifecycle Management

Models are managed through a controlled lifecycle parallel to software systems. No model may be used in production without registry entry, evaluation evidence, risk classification, routing policy, rollback path, and owner.

| Lifecycle stage | Requirements |
|---|---|
| Introduction | Provider review, security review, residency/data handling review, cost characterisation, eval suite performance, ADR. |
| Experimentation | Non-production or shadow mode only; no user-visible reliance. |
| Canary | Controlled traffic at 1%, then 5%, 25%, 50%, 100% with hold points. |
| Champion/challenger | Traffic split with quality, safety, latency, and cost comparison. |
| Production | Continuous monitoring, provider health, evaluation sampling, incident response readiness. |
| Deprecation | Internal notice, successor model, traffic drain, reproduction availability, registry update. |
| Rollback | 15-minute rollback target from decision to restored traffic path. |
| Retirement | No production use; retained only for reproduction where lawful and necessary. |

## 28. Knowledge Architecture for Organisational Memory

Sema's strategic AI promise depends on organisational memory: remembering what was decided, who committed to what, what remains unresolved, what changed, and what is at risk. This requires a knowledge architecture, not only a request-response assistant.

| Knowledge capability | Architectural requirement |
|---|---|
| Knowledge graph | Tenant-isolated graph linking people, meetings, messages, decisions, action items, commitments, issues, risks, projects, dependencies, and source lineage. |
| Temporal reasoning | Queries must answer "what was known/decided as of date X" and distinguish current state from historical state. |
| Invalidation | Corrections, deletions, contradictions, retention changes, and DSAR actions propagate to derived knowledge. |
| Entity resolution | People, projects, decisions, tasks, organisations, and work objects require deterministic and explainable linking. |
| Retrieval modes | Structured, semantic, temporal, graph-neighbour, and reasoning retrieval supported under authorisation. |
| Governance | Admins control capture, retention, export, deletion, and integration of knowledge graph data. |
| ZoikoTime boundary | Workforce truth signals enter only under explicit contract, consent, and authorisation boundaries. |

## 29. ZoikoTime AI Integration

The Sema-ZoikoTime integration is strategically important and high-risk. It blends organisational communication context with workforce truth infrastructure. It must therefore be governed by explicit contracts, data minimisation, consent, role boundaries, and high-risk controls where employment-relevant use cases arise.

| Integration direction | Examples | Controls |
|---|---|---|
| ZoikoTime to Sema | Verified work periods, task context, presence state, productivity indicators, workforce state events. | Purpose limitation, permission checks, consent/tenant policy, staleness indicators. |
| Sema to ZoikoTime | Action items, commitments, meeting decisions, project context, unresolved blockers. | Schema contract, lineage, confidence, human confirmation for material workflow change. |
| Bidirectional knowledge | Project/work context linked with workforce evidence. | No employment decision automation without high-risk controls. |
| AI evaluation | Integration-specific evals for accuracy, fairness, privacy, and role appropriateness. | Joint ownership by Sema AI and ZoikoTime engineering leads. |

The integration contract must specify events, schemas, freshness, replay, failure modes, consent, authorisation, retention, legal hold, versioning, deprecation, and incident procedures. Contract changes follow schema evolution governance.

## 30. AI Data Retention

AI data retention must balance auditability, privacy, product usefulness, model evaluation, cost, and regulatory obligations. Retention applies differently to inputs, outputs, derived data, telemetry, eval data, and agent state.

| Data class | Default posture |
|---|---|
| Prompt inputs | Retain only per tenant policy and security/evaluation need; sensitive prompts may be redacted or not stored. |
| Model outputs | Retain according to output class, source retention, and tenant policy. |
| Embeddings | Retain while source data remains eligible; delete when source is deleted. |
| Knowledge graph | Derived retention mirrors source and tenant policy; invalidation required. |
| Evaluation samples | Limited retention, access-controlled, purpose-bound, contamination-protected. |
| Agent state | Retained for audit and troubleshooting; terminated state preserved according to risk class. |
| Cost/telemetry | Retained for FinOps, reliability, compliance, and incident investigation under privacy controls. |
| High-risk evidence | Retained long enough to satisfy regulatory/audit obligations and conformity readiness. |

## 31. AI Compliance Architecture

The AI architecture is designed to produce evidence, not merely policy statements. Compliance is supported through technical documentation, risk registers, model cards, evaluation records, transparency logs, human oversight logs, provider records, incident logs, and auditability.

| Framework / regime | Architecture posture |
|---|---|
| EU AI Act | General-purpose AI, transparency, and potential high-risk controls for employment-relevant ZoikoTime-linked features. |
| ISO/IEC 42001 | Supports AI management system controls: lifecycle, risk, governance, monitoring, third-party management, incident response. |
| NIST AI RMF | Maps to Govern, Map, Measure, Manage through policy, risk classification, evaluation, monitoring, and response. |
| GDPR / UK GDPR | Purpose limitation, lawful basis support, DSAR, deletion, transparency, DPIA support, residency and minimisation. |
| SOC 2 / ISO 27001 | Security, availability, confidentiality, change management, access control, logging, vendor management. |
| Employment-related controls | No automated employment decisions; high-risk controls required for workforce decision support contexts. |

**EU AI Act posture:** Sema's general summarisation, search, drafting, and extraction capabilities are not targeted as high-risk by default. However, ZoikoTime-integrated workforce analytics may become high-risk when configured for employment-related decision support. Those capabilities require explicit enablement, transparency, human oversight, documented risk management, data governance evidence, accuracy/robustness monitoring, cybersecurity controls, and conformity assessment readiness.

## 32. AI Incident Management

AI incidents include safety failures, privacy leakage, cross-tenant leakage, hallucinations causing material harm, unauthorised agent action, provider outages, provider behavioural drift, cost runaway, evaluation contamination, high-risk control failure, security compromise, and compliance evidence failure.

| Severity | Examples | Response |
|---|---|---|
| SEV-0 | Cross-tenant data leak, autonomous critical action, widespread harmful output, uncontrolled cost runaway. | Immediate feature suspension/circuit breaker, incident commander, executive/legal/security notification. |
| SEV-1 | Provider outage affecting core AI, significant hallucination in high-impact workflow, repeated unsafe tool use. | Failover/degradation, incident response, customer impact assessment. |
| SEV-2 | Localized quality regression, evaluation pipeline failure, elevated prompt injection attempts. | Mitigate, monitor, fix, post-incident review. |
| SEV-3 | Minor output issue, non-material telemetry gap, delayed background extraction. | Normal remediation backlog with owner and due date. |

Every SEV-0/SEV-1 incident requires a post-incident review covering timeline, root cause, blast radius, data exposure, regulatory notification assessment, customer impact, corrective actions, evaluation updates, and architecture changes.

## 33. Prohibited AI Architecture Patterns

- Direct front-end calls to model providers.
- Hard-coded provider/model dependencies in product features.
- Prompt text hidden outside the prompt registry.
- AI access to raw databases outside authorised context services.
- Cross-tenant retrieval, embedding, feature use, evaluation, or knowledge graph exposure.
- Use of tenant data for training without explicit lawful and contractual basis.
- Production model without evaluation evidence, owner, registry entry, rollback, and fallback plan.
- Agent self-authorisation, implicit authorisation, or scope expansion.
- Agent loops without cost, time, iteration, and convergence limits.
- Critical actions performed autonomously by AI.
- Provider concentration beyond limits without ARB exception.
- Evaluation gates bypassed without documented exception.
- Knowledge graph data without lineage to source events.
- Embeddings without deletion propagation and model-version lineage.
- AI cost measured but not enforced.
- High-risk employment-relevant AI enabled without high-risk controls and evidence.
- Opaque AI output where transparency, source attribution, or labelling is required.
- Prompt/response logs accessible without need-to-know controls.
- Dead or deprecated models left in production routing.
- AI features launched without incident response and owner coverage.

## 34. Required ADRs

| ADR | Decision required |
|---|---|
| ADR-AI-001 | AI Gateway placement and enforcement responsibilities |
| ADR-AI-002 | Model router routing criteria and provider abstraction |
| ADR-AI-003 | Prompt registry implementation and approval workflow |
| ADR-AI-004 | Context retrieval and permission filtering architecture |
| ADR-AI-005 | Embedding store and vector index isolation design |
| ADR-AI-006 | AI output classification taxonomy |
| ADR-AI-007 | Human oversight policy by risk class |
| ADR-AI-008 | Tenant AI policy model |
| ADR-AI-009 | Provider onboarding and offboarding process |
| ADR-AI-010 | AI training data policy implementation |
| ADR-AI-011 | Evaluation infrastructure and gating thresholds |
| ADR-AI-012 | AI observability data model |
| ADR-AI-013 | AI cost ceilings and circuit breakers |
| ADR-AI-014 | AI security controls for prompt injection and tool abuse |
| ADR-AI-015 | AI incident severity model |
| ADR-AI-016 | Agentic AI authorisation model |
| ADR-AI-017 | Tool registry and risk classification |
| ADR-AI-018 | Action reversal architecture |
| ADR-AI-019 | Agent loop control parameters |
| ADR-AI-020 | Model lifecycle management process |
| ADR-AI-021 | Provider risk classification and exit conditions |
| ADR-AI-022 | Knowledge graph implementation |
| ADR-AI-023 | EU AI Act classification approach |
| ADR-AI-024 | Continuous evaluation infrastructure |
| ADR-AI-025 | ZoikoTime integration contract |
| ADR-AI-026 | Feature store and AI telemetry architecture |
| ADR-AI-027 | Human evaluation operating model |
| ADR-AI-028 | AI compliance evidence repository |
| ADR-AI-029 | Model rollback and failover runbook |
| ADR-AI-030 | High-risk AI enablement controls |

ADR stubs live under `architecture/adr/ai/` (one file per ADR), all in **Proposed** state pending ARB approval.

## 35. Required Downstream Specifications

| Specification | Class | Owner | Purpose |
|---|---|---|---|
| AI Gateway Technical Specification | Class 3 | AI Platform Engineering | API, enforcement, logging, rate/cost controls. |
| Model Router Specification | Class 3 | AI Platform Engineering | Routing, provider adapters, failover, canary, champion/challenger. |
| Prompt Registry Specification | Class 3 | AI Engineering | Prompt lifecycle, approvals, versioning, rollback. |
| Context Retrieval Specification | Class 3 | Search / AI Engineering | Permission-aware retrieval, ranking, compression, injection defence. |
| Embedding and Vector Specification | Class 3 | Data / AI Engineering | Embeddings, index partitioning, reindexing, deletion propagation. |
| Agentic AI and Tool Specification | Class 3 | AI Engineering / Security | Tool registry, authorisation, loop control, reversal. |
| Knowledge Architecture Specification | Class 3 | AI / Data Engineering | Graph schema, temporal model, invalidation, export/deletion. |
| ZoikoTime AI Integration Contract | Class 3 | Sema + ZoikoTime Engineering | Events, schemas, consent, replay, failure modes, retention. |
| Continuous Evaluation Infrastructure Specification | Class 3 | AI Evaluation Lead | Offline, shadow, online, human eval, golden sets. |
| Model Lifecycle Specification | Class 3 | Head of AI | Introduction, rollout, deprecation, rollback, retirement. |
| EU AI Act Compliance Operating Procedure | Class 4 | Compliance / Legal | Classification, evidence, documentation, high-risk enablement. |
| AI Safety Operations Runbook | Class 4 | AI Safety / Security | Monitoring, incident response, red-team, escalation. |
| AI Cost Operations Runbook | Class 4 | FinOps / AI Ops | Budgeting, alerts, throttling, circuit breakers, reporting. |
| Human Evaluation Operations Manual | Class 4 | AI Evaluation Lead | Rater training, bias control, QA, labour standards. |
| AI Incident Response Runbook | Class 4 | Security / AI Ops | SEV classifications, responsibilities, comms, PIR templates. |

Downstream-spec status is tracked in `architecture/downstream-specs.md`.

## 36. Approval Criteria *(partially truncated in source)*

- ☐ Defines AI subsystem position as a governed platform plane, not an unbounded assistant.
- ☐ Provides full traceability to parent architecture documents.
- ☐ Defines tenant isolation across prompts, outputs, embeddings, features, evaluation data, agent state, and knowledge graph.
- ☐ Defines the AI request lifecycle from gateway through model call, validation, output, telemetry, and audit.
- ☐ Specifies prompt, retrieval, embedding, vector, output classification, and human oversight architecture.
- ☐ Specifies provider risk, concentration, failover, onboarding, and offboarding.
- ☐ Specifies training data controls and default no-customer-training posture.
- ☐ Specifies continuous evaluation infrastructure and evaluation-gated release.
- ☐ Defines safety and guardrail layers across input, retrieval, generation, output, tools, and post-output review.
- ☐ Defines observability and cost governance as enforceable architecture.
- ☐ Defines reliability and degradation for provider, retrieval, evaluation, agent, and cost failures.
- ☐ Defines security controls for AI-specific threat surfaces.
- ☐ Defines agentic AI as first-class risk surface with scoped authorisation, revocation, loop control, and reversal.
- ☐ Defines model lifecycle management and rollback readiness.
- ☐ Defines organisational memory knowledge architecture.
- ☐ Defines ZoikoTime integration contract requirements and high-risk boundaries.
- ☐ Defines AI data retention and compliance evidence posture.
- ☐ Defines EU AI Act posture concretely, including possible high-risk employment-relevant use cases.
- ☐ Defines AI incident management and severity model.
- ☐ Lists prohibited patterns, required ADRs, downstream specificat… *(truncated)*

## 37. Open Decisions

*(truncated in source — to be supplied)*

## 38. Final Architectural Position

*(truncated in source — to be supplied)*
