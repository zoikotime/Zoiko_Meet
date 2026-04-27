# ZOIKO SEMA / ZOIKO CONNECT — Master Platform Architecture Specification

| Field | Value |
|---|---|
| Document class | Architecture Document (Class 2) |
| Status | Draft v1.2 — prepared for Architecture Review Board review and approval |
| Owner | Chief Technology Officer |
| Approver | Architecture Review Board |
| Effective | Upon ARB approval |
| Review cadence | Quarterly and upon material architectural change |
| Supersedes | All prior Master Platform Architecture drafts for Zoiko Sema / Zoiko Connect |
| Governing documents | Zoiko Technical Governance Framework; Zoiko Platform Constitution |
| Confidentiality | Internal — Engineering, Product, AI, Security, Data, Infrastructure, Commercial Leadership, Executive Leadership |

This document is the binding system architecture for one shared communications platform core consumed by Zoiko Connect inside ZoikoTime and commercialized externally as Zoiko Sema.

## 1. Purpose

This Master Platform Architecture Specification defines the technical system shape for Zoiko Sema and Zoiko Connect. Its purpose is to convert the Zoiko Platform Constitution into a buildable, reviewable, governable and executable architecture.

The document is binding for all engineering, product, AI, security, data, mobile, desktop, infrastructure, DevOps, billing and integration work related to Zoiko Sema and Zoiko Connect. It is a Class 2 architecture document from which Class 3 specifications and Class 4 operational documents inherit.

## 2. Binding Architectural Doctrine

- One shared core: Zoiko Connect and Zoiko Sema are contextual designations of one platform, not separate products.
- No hardcoded ZoikoTime dependency: Sema must operate independently of ZoikoTime. ZoikoTime enriches Sema; it does not constitute Sema.
- Multi-tenant from inception: every service, event, object, cache key, search index, AI context and log entry must carry tenant attribution or be tenant-neutral.
- AI as platform infrastructure: AI must have architecture, cost controls, governance, evaluation, auditability, tenant isolation and lifecycle management.
- Global-first deployment: US, EU and APAC regions, data residency, latency, media routing and failover are designed in from inception.
- Compliance by design: SOC 2, GDPR, UK GDPR, CCPA/CPRA, EU AI Act readiness, audit logs, retention and DSAR workflows are architectural inputs.
- Cost is architecture: infrastructure, media, AI, search, storage and free-tier cost controls are first-order constraints.
- Clients are not platforms: web, iOS, Android and desktop clients are presentation and interaction layers.
- Events preserve truth: material state changes are versioned, tenant-attributed, replayable where required and audit-aligned.
- Governance is continuous: all material architectural decisions are captured in ADRs and controlled through ARB oversight.

## 3. Scope and Non-Scope

This specification covers system context, operating modes, plane architecture, service decomposition, communication patterns, tenancy primitives, user journeys, messaging, real-time, meetings, AI signal layer, ZoikoTime integration, billing readiness, API surface, client architecture, global infrastructure, security, observability, cost architecture, trust and safety, release architecture, scale targets, failure modes, ADR obligations, downstream documents and diagrams.

It does not define final UX copy, brand launch campaigns, legal contract terms, final commercial pricing, detailed database schemas or vendor contracts. Those are controlled by downstream documents and ADRs.

## 4. Operating Modes

| Mode | Description | Architectural Rule |
|---|---|---|
| Mode 1 — Zoiko Connect inside ZoikoTime | Embedded communication layer inside ZoikoTime for workforce-aware collaboration. | Implemented through configuration and integration contracts, not a separate platform. |
| Mode 2 — Zoiko Sema standalone | Public SaaS communication platform supporting signup, workspaces, messages, meetings, AI, APIs and paid tiers. | Must run without ZoikoTime. |
| Mode 3 — Zoiko Sema + ZoikoTime | Premium integrated intelligence mode combining communication signal with workforce truth. | Integration is bidirectional, versioned, failure-independent and governed. |

## 5. System Context

The platform sits between human users, workspace admins, enterprise identity providers, ZoikoTime, payment processors, AI model providers, media infrastructure providers, external productivity systems, mobile app stores, email/SMS/push providers, compliance systems, observability platforms and customer administrators.

The system exposes secure client applications, public APIs, webhooks, enterprise administration, billing controls, AI-assisted intelligence and governed integration points.

| Actor / System | Relationship | Notes |
|---|---|---|
| End users | Use messaging, meetings, files, search, AI summaries, tasks and notifications. | May belong to multiple organisations and workspaces. |
| Workspace admins | Configure policy, members, roles, retention, billing, AI usage and security. | Admin operations are audited. |
| ZoikoTime | Exchanges workforce state and communication signal. | Bidirectional and failure-independent. |
| Identity providers | Provide SSO, OIDC, SAML and SCIM. | Tenant-aware identity contracts required. |
| AI providers | Provide model inference. | No customer data training without explicit opt-in. |
| Media providers | Provide SFU/media infrastructure at launch. | Regional routing and failover required. |
| Payment providers | Process subscription, usage, tax, VAT and invoice workflows. | Final vendor choice by ADR. |

## 6. Architectural Model

| Plane | Primary Responsibilities | Examples |
|---|---|---|
| Identity and Control Plane | Authentication, authorisation, organisations, workspaces, roles, policies, entitlement and tenant configuration. | Identity, Workspace, Policy, Entitlement. |
| Collaboration Data Plane | Messaging, channels, threads, reactions, files, search, notifications, presence and real-time sync. | Messaging, Real-Time Gateway, File, Search. |
| Media Plane | Meetings, voice, video, screen sharing, recording, captions, transcription and media routing. | Meeting Orchestration, Media Control, Recording. |
| AI and Signal Plane | Signal extraction, summaries, action extraction, decision tracking, model routing and AI governance. | AI Orchestrator, Signal Service, Model Router. |
| Operations and Governance Plane | Billing, metering, observability, security monitoring, compliance evidence and release management. | Billing, Audit, Observability. |

## 7. Logical Service Architecture

| Service | Plane | Responsibilities | Boundary |
|---|---|---|---|
| Identity Service | Identity and Control | Authentication, sessions, MFA, native login, SSO federation and account lifecycle. | Owns identities and sessions; never owns workspace authorisation rules. |
| Authorisation and Policy Service | Identity and Control | RBAC, policy evaluation, entitlement gating and admin policy enforcement. | Central authority for permission decisions. |
| Organisation and Workspace Service | Identity and Control | Organisation records, workspace creation, configuration, region assignment and ZoikoTime linkage state. | Workspace is platform-native and independent. |
| Guest and External Access Service | Identity and Control | Guest invitations, external collaborators, meeting guests, shared channels and access expiry. | Enforces guest boundaries. |
| Messaging Service | Collaboration Data | Messages, DMs, groups, channels, threads, edits, deletes, retention and message event stream. | High-volume append-only domain. |
| Real-Time Gateway | Collaboration Data | WebSocket connections, presence, typing indicators, delivery events and reconnect state. | Stateless clusters with session routing. |
| Notification Service | Collaboration Data | Push, email, in-app notifications, mention alerts, digests and preferences. | Sensitive data minimised in payloads. |
| File and Object Service | Collaboration Data | Upload, virus scanning, object storage, previews, retention and legal hold integration. | Large objects stored outside relational core. |
| Search and Indexing Service | Collaboration Data | Permission-aware indexing, keyword search, semantic search and index rebuilds. | Never returns data without auth check. |
| Meeting Orchestration Service | Media | Meeting links, lobby, invitations, roles, media token issuance and meeting lifecycle. | Control plane for meetings. |
| Media Control Service | Media | Regional media routing, SFU provider routing, recording/caption routing and media quality telemetry. | Build-vs-buy governed by ADR. |
| Recording and Transcript Service | Media | Recording storage, captions, transcript processing, retention and permission handling. | Feeds AI summaries through governed pipeline. |
| AI Orchestration Service | AI and Signal | Model routing, context assembly, prompt execution, safety checks, response handling and AI audit. | No tenant context blending. |
| Signal Extraction Service | AI and Signal | Action items, decisions, unresolved issues, follow-up recommendations and communication health. | Creates structured signal. |
| AI Evaluation and Governance Service | AI and Signal | Evals, model controls, usage limits, safety evidence and prompt logging policy. | Controls AI deployment readiness. |
| ZoikoTime Integration Service | Integration / Signal | Bidirectional event contract, workforce state sync, signal export, replay and version validation. | Does not hardcode ZoikoTime into core services. |
| Billing and Metering Service | Operations and Governance | Plans, seats, AI usage, storage, meeting minutes, usage records, invoices and upgrades. | Billing accuracy is architecture-critical. |
| Audit, Compliance and Evidence Service | Operations and Governance | Audit logs, evidence exports, admin visibility, legal hold, DSAR and compliance artefacts. | Append-only where required. |

## 8. Service Communication Patterns

- All external client and API traffic enters through an API gateway or real-time edge gateway. No internal service is directly public.
- Service-to-service synchronous communication uses gRPC over mutual TLS with centrally versioned protobuf schemas.
- Public APIs use REST with OpenAPI. GraphQL is permitted only for approved client-optimised query surfaces.
- Domain events use a managed event bus with schema registry, tenant attribution, versioning and replay within retention windows.
- Cross-service transactions use sagas with explicit compensation logic. Two-phase commit across services is prohibited.
- All write endpoints, webhook receivers, billing events, AI triggers and replay operations support idempotency keys.
- A service mesh provides mTLS, traffic management, retries, timeouts, circuit breaking, policy enforcement and telemetry.
- OpenAPI, protobuf, event schema and webhook schema repositories are source-controlled. Breaking changes require ADR and migration plan.

## 9. Critical User Journey Traces

### 9.1 Message send to channel
- Client submits message to API Gateway with workspace, channel, idempotency key and client timestamp.
- Identity Service validates session; Authorisation Service checks workspace and channel policy.
- Messaging Service persists append-only message event with tenant, workspace, channel, author, message and policy version.
- Messaging Service emits MessagePosted event. Real-Time Gateway fans out; Notification Service queues offline notifications.
- Search indexes the message; Metering records billable event; Audit records security-relevant metadata.
- Target: p95 send-to-visible delivery within 250ms in-region and 500ms cross-region.

### 9.2 Meeting join
- Client opens meeting link. Identity authenticates known users; Guest Service handles guest path and lobby.
- Authorisation validates meeting role and workspace policy.
- Meeting Orchestration issues short-lived media token and requests regional assignment.
- Media Control routes to nearest permitted SFU/media region.
- Client establishes media session; join event updates presence and audit.
- Target: p95 click-to-media-established within 3 seconds.

### 9.3 Workspace creation
- Creator authenticates and initiates organisation/workspace creation with selected region or residency policy.
- Workspace Service creates records and assigns owner role.
- Policy Service attaches defaults; Billing creates trial/free state.
- Search, File, AI, Audit and Notification domains provision or lazy-provision workspace-scoped resources.
- WorkspaceCreated event is emitted and replayable.
- Target: workspace operational for messaging and meetings within 30 seconds.

### 9.4 AI summary generation
- Trigger occurs from meeting end, channel summary or thread summary.
- Authorisation verifies AI entitlement, user rights, tenant region and policy.
- AI Orchestration retrieves tenant-isolated context with minimisation and residency controls.
- Model Router selects model/provider by use case, residency, cost, latency, safety and availability.
- Safety checks apply; summary is stored with audit metadata; metering records cost and billable usage.
- Target: p95 meeting summary available within 60 seconds after meeting end.

### 9.5 ZoikoTime workforce state propagation
- ZoikoTime emits WorkforceStateChanged event through webhook or event bus integration.
- Integration Service validates tenant linkage, schema version, signature and idempotency.
- Event is transformed into Sema internal format and emitted.
- Presence and Signal Services update verified presence and communication context.
- Real-Time Gateway delivers updates; Audit records integration event.
- Target: p95 propagation within 5 seconds; Sema remains functional if ZoikoTime is unavailable.

## 10. Identity, Workspace and Tenancy Architecture

Identity and tenancy are first-class primitives. The platform recognises users, organisations, workspaces, guests, roles, policies, entitlements and regional residency policies. Tenant isolation is enforced in application logic, database schemas, object storage prefixes, search indexes, cache keys, event topics, AI context retrieval, logging metadata and billing records.

Cross-tenant access requires explicit, audited, policy-approved patterns such as shared channels or guest participation.

| Primitive | Definition | Rules |
|---|---|---|
| User | An individual global platform identity. | May belong to many organisations and workspaces. |
| Organisation | Legal-commercial entity contracting with Zoiko. | Owns billing relationship and one or more workspaces. |
| Workspace | Operational unit for communication, signal, policy and tenant isolation. | Independent of ZoikoTime; may be linked to ZoikoTime. |
| Guest | External participant in a workspace or meeting. | Scoped, audited, revocable and time-bound where appropriate. |
| Role | Named permission bundle. | Evaluated centrally and policy-versioned. |
| Entitlement | Commercial or contractual capability right. | Gates features, AI, storage, meetings, APIs and enterprise controls. |
| Tenant region | Residency and processing policy. | Controls storage, model routing, failover and replication. |

## 11. Data Architecture Summary

The platform uses a relational core for identity, organisation, workspace, policy, billing, entitlement and admin state; event-sourced append-only storage for high-volume collaboration domains; object storage for files and recordings; search infrastructure for permission-aware retrieval; vector storage for semantic retrieval; cache for latency-sensitive derived state; and immutable audit storage for compliance evidence.

Customer data must not be used to train Zoiko-operated, third-party or shared models without explicit tenant opt-in and contractual permission. Deletion and retention must propagate to primary stores, materialised views, indexes, AI-derived artefacts, backups and exports according to downstream policy.

| Data Domain | Primary Pattern | Consistency | Residency |
|---|---|---|---|
| Identity and sessions | Relational + secure session store | Strong for authentication/revocation | Regional with global identity controls |
| Organisations/workspaces | Relational | Strong | Tenant-selected region |
| Messages/events | Append-only event store + views | Per-channel ordering | Workspace region |
| Files/recordings | Object storage + metadata DB | Metadata strong; object durable | Workspace region |
| Search indexes | Managed search | Eventually consistent plus permission validation | Workspace region |
| AI context/summaries | Relational/object/vector | Policy-bound | Tenant region/model constraints |
| Billing/metering | Event ledger + relational views | High accuracy; replayable | Billing jurisdiction |
| Audit logs | Append-only evidence store | Tamper-evident | Compliance region/retention |

## 12. Messaging and Real-Time Architecture

Messaging is the most frequent platform operation. It must support high throughput, predictable ordering, permission-aware delivery, offline reconciliation, retention, eDiscovery readiness, legal hold, deletion, search and AI signal extraction.

The architecture supports DMs, group chats, channels, threads, mentions, reactions, edits, deletes, pinned items, read receipts, delivery states, typing indicators, presence, offline sync and notification preferences. Server state is authoritative; client state is optimistic and reconciled.

## 13. Meetings, Voice and Video Architecture

The Media Plane supports meetings, voice, video, screen sharing, captions, transcription, recording, lobby, guest access, mobile joining and regional media routing. Launch architecture is buy-first for SFU/media infrastructure unless an ADR approves build based on cost, control, scale or strategic necessity.

Meeting links are opaque, revocable, policy-aware and workspace-scoped or guest-enabled. Recording, transcript and caption capabilities are policy-gated, retention-bound and regionally controlled.

## 14. AI and Signal Architecture

The AI and Signal Plane converts communication into structured signal while maintaining tenant isolation, data privacy, cost controls, auditability, prompt governance, model evaluation and human oversight.

Launch AI includes meeting summaries, action extraction, intelligent search and message/thread summarisation. Phase 2 includes decision tracking, unresolved issue detection, follow-up recommendations and communication health. Phase 3 includes autonomous follow-up agents, organisational memory and predictive workflow intelligence under human-in-the-loop governance.

## 15. ZoikoTime Integration Architecture

ZoikoTime integration is a strategic moat and a constitutional boundary. Sema works independently. Sema becomes uniquely powerful with ZoikoTime. The integration is bidirectional, versioned, audited and failure-independent.

ZoikoTime to Sema events include workforce state, verified presence, clock-in/out state, task context and activity status. Sema to ZoikoTime events include meeting outcomes, action items, decisions, communication signal and collaboration context. No core Sema service may directly query ZoikoTime databases or embed ZoikoTime domain logic.

## 16. Billing and Monetization Architecture

The platform is billing-ready from inception: Free, Pro, Business, Enterprise and ZoikoTime Bundle tiers; seat billing; workspace billing owner; AI usage metering; storage limits; meeting minutes; recording/transcript usage; API usage; trial logic; upgrades/downgrades; global payments; taxes and VAT; invoice evidence and reconciliation.

Billing accuracy, usage replay and reconciliation are architecture-critical. Usage events must be idempotent, attributable to tenant/workspace/source feature and replayable from event history.

## 17. API and Integration Architecture

The public API is a stability-committed product surface for customer integrations, partner integrations, OAuth apps, bot framework, webhooks, private Zoiko integrations and third-party productivity systems.

APIs are REST/OpenAPI by default, versioned, authenticated, rate-limited and documented. Webhooks are signed, retryable, idempotent, versioned and tenant-scoped. Deprecation requires notice, migration path and ADR.

## 18. Client Architecture

The platform supports web, iOS, Android and desktop. Clients are offline-tolerant, secure, notification-ready and optimised for messaging and meetings. Platform business logic remains server-side.

Mobile and desktop clients use encrypted local state, pending operation queues, exponential retry, server-authoritative reconciliation, minimal push payloads and explicit feedback for unresolved conflicts. Core messaging and meeting parity is mandatory unless a deliberate non-parity decision is recorded.

## 19. Global Infrastructure Architecture

Initial topology includes US primary region, EU region and APAC region with CDN, regional object storage, regional media routing, managed databases, event bus, queues, search, observability, secret management, CI/CD environments and disaster recovery procedures.

The platform is multi-cloud-capable in architecture and single-cloud in initial deployment. Regional failover must respect data residency; data must not be failed over to a prohibited region for convenience.

## 20. Security Architecture Summary

Security boundaries exist across internet, edge/API gateway, real-time gateway, service mesh, internal services, data plane, AI subsystem, media providers, third-party integrations and administrative surfaces.

Security is enforced through central authentication, policy-based authorisation, encryption at rest and in transit, secrets management, dependency controls, SBOMs, vulnerability scanning, audit logging, security monitoring, abuse detection and incident response.

## 21. Observability and SLO Architecture

All services emit OpenTelemetry-compatible logs, metrics and traces. Observability is mandatory for API, messaging, real-time, meetings, AI, billing, security and client surfaces.

Dashboards, alerting, synthetic probes, SLOs, error budgets, on-call procedures, incident response and post-mortem workflows are defined downstream but must inherit the instrumentation baseline in this document.

## 22. Cost Architecture and FinOps Summary

Cost is a design primitive. The platform must support per-tenant cost attribution across compute, database, media, AI inference, storage, search, egress, notifications, observability and support operations.

Free-tier ceilings, AI quotas, media-minute limits, storage lifecycle policies, search/vector cost controls, observability sampling and abuse controls must exist before public launch.

## 23. Trust and Safety Architecture

Trust and Safety governs spam prevention, free-tier abuse, harassment reporting, illegal content escalation, file abuse, fraud detection, account suspension, workspace takedown, content moderation, law enforcement response and appeals.

Trust and Safety integrates with Security Operations and Compliance. Admin misuse controls, abuse reporting, moderation workflows, evidence preservation and auditability are mandatory.

## 24. Release Architecture

The platform is continuously deployable. Release architecture requires CI/CD, environment strategy, feature flags, canary releases, rollback, database migration discipline, security gates, accessibility checks, load testing, media quality testing, AI safety testing, mobile app store compliance, beta gates and public launch gates.

AI releases require evaluation gates, red-team checks, model versioning and rollback. Mobile releases must account for app-store cadence and server compatibility across supported app versions.

## 25. Capacity and Scale Targets

These are architectural baselines for design and capacity planning, not commercial forecasts.

| Dimension | 12-Month Target | 36-Month Target |
|---|---|---|
| Registered users | 1,000,000+ | 10,000,000+ |
| Active organisations | 50,000+ | 250,000+ |
| Daily active users | 200,000+ | 2,000,000+ |
| Peak messages per second per region | 10,000 | 100,000 |
| Concurrent meeting participants per region | 50,000 | 500,000 |
| AI inference requests per second per region | 1,000 | 10,000 |
| Public API requests per second per region | 25,000 | 250,000 |
| Total storage | 5 PB | 50 PB |

| Service | Availability | Latency / Quality Baseline |
|---|---|---|
| Public API | 99.95% | p95 200ms |
| Message send | 99.95% | p95 250ms in-region |
| Real-time delivery | 99.9% | p95 500ms |
| Meeting join | 99.9% | p95 3 seconds |
| Search | 99.9% | p95 500ms |
| AI summary generation | 99.5% | p95 60 seconds |
| Notification delivery | 99.9% | p95 10 seconds |
| Billing event accuracy | 99.99% | Replayable and reconcilable |

## 26. Technology Selection Guidance

| Decision Area | Architectural Default | Rationale |
|---|---|---|
| Backend language | Go primary; Python for AI; Rust by exception | Performance, operations, hiring clarity, AI ecosystem. |
| Web client | TypeScript | Type safety and ecosystem maturity. |
| Mobile | Native Swift/Kotlin or cross-platform by ADR | Must optimise long-term quality. |
| Desktop | TypeScript-based shell or native by ADR | Must support meetings, notifications and secure updates. |
| Deployment | Kubernetes primary; serverless by exception | Global, observable, controllable. |
| Internal sync calls | gRPC over mTLS | Typed contracts and performance. |
| External API | REST/OpenAPI; GraphQL by exception | Developer familiarity and stable integration. |
| Eventing | Managed event bus with schema registry | Replayability and coordination. |
| Observability | OpenTelemetry instrumentation | Vendor-neutral telemetry foundation. |
| Identity | Platform identity service with SAML/OIDC/SCIM support | Tenant-aware identity cannot be outsourced entirely. |
| Media | Buy-first SFU/provider route at launch | Speed, reliability and cost visibility. |

## 27. Failure Mode and Effects Analysis

| Component | Failure Mode | User-Visible Effect | Detection | Mitigation | RTO |
|---|---|---|---|---|---|
| Identity Service | Regional outage | New logins fail; existing sessions continue where safe | Synthetic auth probes | Cross-region failover; cached session validation | 5 minutes |
| Authorisation Service | Policy evaluation failure | Writes and sensitive reads fail closed | Policy error alerts | Cached safe policies; fail-closed defaults | 5 minutes |
| Messaging Service | Write store failure | Message sends fail or queue | Write error alerts | Replica promotion; retry queue | 15 minutes |
| Real-Time Gateway | Cluster failure | Live updates pause; reconnect or polling | Heartbeat failures | Multi-AZ failover | 2 minutes |
| Meeting Orchestration | Service outage | New meetings cannot start | Join/create errors | Stateless scale-out; rollback | 5 minutes |
| Media Provider | Regional/provider outage | Meetings degrade or fail | Provider telemetry | Secondary provider/region | 10 minutes |
| AI Orchestration | Model provider outage | AI features unavailable/degraded | Model error rates | Model Router failover | 5 minutes |
| Search Service | Index outage | Search unavailable/degraded | Search alerts | Replica failover; rebuild | 10 minutes |
| ZoikoTime Integration | Webhook/event outage | Verified presence stale; Sema unaffected | Webhook lag | Queue and replay | 30 minutes |
| Billing Service | Metering outage | Usage queued; billing stale | Meter lag | Event replay; reconciliation | 1 hour |
| Regional Cluster | Full regional outage | Affected tenants disrupted | Cross-region probes | Policy-compliant failover | 1 hour |

## 28. Architectural Decision Records

The following ADRs must be created and approved or explicitly scheduled before implementation decisions become irreversible: primary cloud provider, media provider, event bus, database baseline, search/vector store, service mesh, payments/tax, mobile strategy, desktop strategy, AI provider/model policy, service communication patterns, programming language, deployment model, observability backend, capacity targets, failure-mode commitments, data residency enforcement, ZoikoTime contract, billing ledger pattern, public API versioning.

See `architecture/adr/` for stubs.

## 29. Required Downstream Documents

Mandatory downstream documents are: Data Architecture, AI Architecture, Security Architecture, Identity/Tenancy/Workspace Specification, Messaging and Real-Time Engine Specification, Meetings/Voice/Video Specification, AI Signal Layer Specification, ZoikoTime Integration Specification, Billing and Monetization Specification, Global Infrastructure and DevOps Blueprint, Security/Privacy/Compliance Operations, Mobile/Desktop Specification, API/Webhooks/Integration Framework and Release/QA/Certification Plan.

## 30. Minimum Viable Architecture for First Build

The first build must prove the constitutional architecture: one shared core; workspace independence; ZoikoTime linkage; tenant isolation; real-time messaging; meeting join; AI summary path; billing metering; audit logs; regional configuration; OpenTelemetry traces; feature flags; CI/CD with rollback.

See `architecture/gap-analysis.md` for current state vs target.

## 31. Explicit Prohibitions

- Building Zoiko Connect and Zoiko Sema as separate systems or codebases.
- Creating workspaces that require ZoikoTime to exist.
- Building single-tenant first and retrofitting multi-tenancy later.
- Embedding model-provider logic directly into product services.
- Allowing cross-tenant context blending in AI prompts, search, logs, caches or indexes.
- Exposing internal services directly to public traffic.
- Using public API for internal service-to-service communication.
- Shipping AI without cost metering, evaluation, safety checks and rollback.
- Shipping billing-relevant features without usage metering and reconciliation.
- Shipping global features that assume US-only region, law, identity, tax or data residency.
- Storing secrets in source code, logs, configuration files or unencrypted storage.
- Allowing undocumented architecture exceptions or silent divergence.

## 32. Architectural Diagrams and Mermaid Source

The diagrams below are authoritative architecture artefacts and must be stored alongside the specification in the architecture repository. Where diagrams and prose conflict, the conflict is escalated to the Architecture Review Board.

| Diagram | Purpose | Format | Repository Path |
|---|---|---|---|
| D-01 | System Context | Mermaid | architecture/diagrams/D-01-system-context.mmd |
| D-02 | Container View | Mermaid | architecture/diagrams/D-02-container.mmd |
| D-03 | Identity and Control Plane | Mermaid | architecture/diagrams/D-03-identity-plane.mmd |
| D-04 | Collaboration Data Plane | Mermaid | architecture/diagrams/D-04-collaboration-plane.mmd |
| D-05 | Media Plane | Mermaid | architecture/diagrams/D-05-media-plane.mmd |
| D-06 | AI and Signal Plane | Mermaid | architecture/diagrams/D-06-ai-plane.mmd |
| D-07 | Operations and Governance Plane | Mermaid | architecture/diagrams/D-07-ops-plane.mmd |
| D-08 | Message Send Flow | Mermaid sequence | architecture/diagrams/D-08-message-flow.mmd |
| D-09 | Meeting Join Flow | Mermaid sequence | architecture/diagrams/D-09-meeting-flow.mmd |
| D-10 | Regional Topology | Mermaid | architecture/diagrams/D-10-regional-topology.mmd |
| D-11 | Trust Boundaries | Mermaid | architecture/diagrams/D-11-trust-boundaries.mmd |
| D-12 | Tenancy Model | Mermaid | architecture/diagrams/D-12-tenancy.mmd |
| D-13 | ZoikoTime Integration | Mermaid sequence | architecture/diagrams/D-13-zoikotime-integration.mmd |

## 33. Approval Criteria

- Implements the Zoiko Platform Constitution without contradiction.
- Defines one shared platform core supporting all three operating modes.
- Establishes workspace independence from ZoikoTime.
- Defines service boundaries and communication patterns.
- Includes user journey traces for the five critical journeys.
- Includes identity, tenancy, data, security, AI, billing, infrastructure, client and cost architecture baselines.
- Includes capacity, scale, SLO and failure-mode targets.
- Includes mandatory ADRs and downstream documents.
- Includes diagram catalogue and diagram source appendix.
- Identifies explicit prohibitions.

## 34. Open Decisions

Open decisions to be resolved through ADR include primary cloud provider, media provider, mobile strategy, desktop strategy, payment and tax engines, search/vector store, observability backend, model provider policy, data residency enforcement model and billing ledger implementation. The defaults in this document apply unless varied by approved ADR.

## 35. Final Architectural Position

Zoiko Sema and Zoiko Connect are two designations of one governed communications, signal and intelligence platform. The architecture is built around one shared core; workspace independence from ZoikoTime; multi-tenancy from inception; AI as infrastructure; global-first deployment; compliance by design; cost-aware operations; mobile and desktop readiness; billing readiness; and bidirectional integration with ZoikoTime.

This is the master architecture from which all downstream technical specifications inherit. The engineering organisation must not implement subsystem work that materially contradicts this architecture unless an approved, time-bounded exception has been recorded and an ADR documents the decision.

## Appendix B. Event Catalogue Baseline

| Event | Producer | Consumers | Minimum Fields |
|---|---|---|---|
| WorkspaceCreated | Workspace Service | Billing, Audit, Search, AI Context | tenant_id, workspace_id, organisation_id, region, creator_id, timestamp, schema_version |
| MessagePosted | Messaging Service | Real-Time, Notifications, Search, Billing, AI Signal, Audit | tenant_id, workspace_id, channel_id, message_id, author_id, timestamp, policy_version |
| MeetingStarted | Meeting Orchestration | Presence, Audit, Billing, AI Signal | tenant_id, workspace_id, meeting_id, host_id, region, timestamp |
| MeetingEnded | Meeting Orchestration | Recording, Transcript, AI, Billing | tenant_id, workspace_id, meeting_id, duration, participants, timestamp |
| AISummaryGenerated | AI Orchestration | Notifications, Audit, Billing, Search | tenant_id, workspace_id, source_id, model_id, cost_units, timestamp |
| WorkforceStateChanged | ZoikoTime Integration | Presence, Signal, Real-Time, Audit | tenant_id, workspace_id, user_id, state, source_version, timestamp |
| UsageMetered | Metering Service | Billing, Finance, Audit | tenant_id, workspace_id, usage_type, quantity, unit, source_event_id, timestamp |
| PolicyChanged | Policy Service | All policy-consuming services, Audit | tenant_id, workspace_id, policy_id, version, actor_id, timestamp |

## Appendix C. Domain Service Ownership Matrix

| Domain | Primary Owner | Secondary Reviewers |
|---|---|---|
| Identity | Identity Engineering Lead | Security, Platform, Product |
| Workspace/Tenancy | Platform Engineering Lead | Security, Data, Billing |
| Messaging/Real-Time | Real-Time Engineering Lead | Mobile, Search, AI Signal |
| Meetings/Media | Media Engineering Lead | Mobile, Security, AI |
| AI/Signal | Head of AI | Security, Data, Product, Legal/Compliance |
| ZoikoTime Integration | Sema Lead + ZoikoTime Lead | Data, Security, Product |
| Billing/Metering | Billing Engineering Lead | Finance, Product, Data |
| API/Integrations | Platform/API Lead | Security, Developer Relations |
| Mobile/Desktop | Client Engineering Lead | Platform, Security, Product |
| Infrastructure/SRE | Head of SRE | Security, Data, Engineering |

## Appendix D. Glossary

| Term | Definition |
|---|---|
| Zoiko Connect | Internal or embedded designation for the shared platform when consumed inside ZoikoTime. |
| Zoiko Sema | External commercial brand for the same shared communications platform. |
| Workspace | Operational tenant-scoped unit for communication, signal, intelligence, policy and collaboration. |
| Organisation | Commercial/legal entity that owns workspaces and billing relationship. |
| Tenant | Logical isolation context, normally workspace-aligned and organisation-governed. |
| Signal | Structured intelligence derived from messages, meetings, decisions, actions, presence and workforce context. |
| Verified presence | Presence enriched by ZoikoTime workforce state rather than simple online/offline status. |
| ADR | Architectural Decision Record. |
| SLO | Service Level Objective. |
| SFU | Selective Forwarding Unit used for scalable video/audio meetings. |
| DSAR | Data Subject Access Request. |
