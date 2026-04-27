# Gap Analysis — Current Codebase vs Master Architecture

| Field | Value |
|---|---|
| Date | 2026-04-27 |
| Author | Engineering (initial draft) |
| Source | `architecture/SPEC.md` (binding) |
| Purpose | Honest map of what exists today vs what SPEC §30 (Minimum Viable Architecture) requires |

This is a snapshot. It is **not** a roadmap or commitment — those are downstream documents per SPEC §29 and require ARB approval.

## 1. SPEC §30 MVA Checklist

| MVA Requirement | Status | Evidence / Gap |
|---|---|---|
| One shared core (Connect = Sema = same code) | **Met** | Single repo, single server. SPEC §31 prohibition observed. |
| Workspace independence from ZoikoTime | **Partial** | `Organization` model exists ([server/app/models/organization.py](../server/app/models/organization.py)). No `Workspace` primitive distinct from organisation; no ZoikoTime-link state on workspace. |
| ZoikoTime linkage | **Not started** | Separate `Zoiko_Time/` directory in workspace; no integration service in repo. |
| Tenant isolation | **Partial** | Organisations and channel membership enforce row-level tenancy; events/logs/cache keys do not carry `tenant_id`. SPEC §10 demands cross-cutting attribution. |
| Real-time messaging | **Met** | WS chat at [server/app/websocket/chat.py](../server/app/websocket/chat.py); REST + WS channels with reactions, threads, files, mentions. |
| Meeting join | **Met (mesh)** | Full meeting flow at [server/app/websocket/signaling.py](../server/app/websocket/signaling.py). **WebRTC mesh, not SFU** — capacity per meeting ≤ ~6 participants. |
| AI summary path | **Met** | [server/app/core/ai.py](../server/app/core/ai.py) uses Anthropic Claude; meeting recap and smart replies live. |
| Billing metering | **Not started** | No usage events, no metering service, no ledger. |
| Audit logs | **Partial** | `server/app/connect/audit/` scaffold exists; not consumed end-to-end. |
| Regional configuration | **Not started** | Single deploy; no region primitive on tenants or services. |
| OpenTelemetry traces | **Not started** | No OTel SDK in dependencies. |
| Feature flags | **Not started** | No flag service or library in dependencies. |
| CI/CD with rollback | **Partial** | `.github/workflows/deploy.yml` builds + pushes + SSH-deploys. No canary, no automated rollback, no migration discipline. Currently failing on missing `DEPLOY_SSH_KEY`. |

## 2. SPEC §7 Logical Service Architecture — Current Mapping

The repo's `server/app/connect/` tree shows the team has begun bounded-services rework. Today most services are **scaffolded modules inside one Python process**, not deployable services.

| SPEC Service | Current Location | Form | Gap |
|---|---|---|---|
| Identity Service | [server/app/api/auth.py](../server/app/api/auth.py), [server/app/connect/session_service/](../server/app/connect/session_service/) | Module | No SAML / OIDC / SCIM; native login + JWT only. |
| Authorisation and Policy Service | Inline checks across handlers | Module (scattered) | No central policy evaluation; no policy versioning. |
| Organisation and Workspace Service | [server/app/api/organizations.py](../server/app/api/organizations.py) | Module | Workspace primitive missing; org ≠ workspace per SPEC §10. |
| Guest and External Access Service | Meeting password + waiting room only | Partial | No guest accounts, no shared channels, no time-bound external access. |
| Messaging Service | [server/app/api/chat.py](../server/app/api/chat.py), [server/app/connect/messaging_service/](../server/app/connect/messaging_service/) | Module | Append-only event store missing; messages stored as relational rows. |
| Real-Time Gateway | [server/app/websocket/](../server/app/websocket/), [server/app/connect/gateway/](../server/app/connect/gateway/) | Module | No session-routing layer; no horizontal scale plan. |
| Notification Service | [server/app/api/notifications.py](../server/app/api/notifications.py) | Module | In-app + WS push only; no native push, no email digests, no preferences. |
| File and Object Service | Inline upload in chat/meetings | Partial | Local filesystem (`uploads/`); no virus scan, no object storage, no retention policy. |
| Search and Indexing Service | None | **Missing** | No keyword search, no semantic search. |
| Meeting Orchestration Service | [server/app/api/meetings.py](../server/app/api/meetings.py) | Module | No regional assignment, no media token issuance for SFU. |
| Media Control Service | [server/app/connect/media_service/](../server/app/connect/media_service/) | **Scaffold** | `livekit_provider.py` and `null_provider.py` stubs; not wired to MeetRoom client. |
| Recording and Transcript Service | Browser MediaRecorder + REST upload | Partial | No transcription. Recording lives on disk, not object storage. |
| AI Orchestration Service | [server/app/core/ai.py](../server/app/core/ai.py) | Module | Direct Anthropic call; no Model Router, no per-tenant context retrieval, no safety pipeline. |
| Signal Extraction Service | Rule-based suggestions in `ai_suggest_actions` | **Scaffold** | No structured signal model. |
| AI Evaluation and Governance Service | None | **Missing** | No evals, no usage caps, no prompt audit. |
| ZoikoTime Integration Service | None | **Missing** | Separate `Zoiko_Time/` directory; no contract service. |
| Billing and Metering Service | None | **Missing** | No metering, no plans, no Stripe integration. |
| Audit, Compliance and Evidence Service | [server/app/connect/audit/](../server/app/connect/audit/) | **Scaffold** | Not invoked from production paths. |

## 3. SPEC §25 Capacity Targets — Current Headroom

| Dimension | 12-Month Target | Estimated Current Capacity | Δ |
|---|---|---|---|
| Peak msg/s/region | 10,000 | < 100 (single Python process, SQLite/Postgres single instance) | **100× short** |
| Concurrent meeting participants/region | 50,000 | ~6 per meeting (WebRTC mesh) | **structural gap** — needs SFU |
| AI inference RPS/region | 1,000 | bounded by Anthropic rate limits per single API key | **gateway needed** |
| Public API RPS/region | 25,000 | unmeasured; rate-limited at 10 req/min/IP via [middleware.py](../server/app/core/middleware.py) | **rate limiter is for abuse, not throughput** |
| Total storage | 5 PB | local filesystem `uploads/` and `recordings/` volumes | **structural gap** — object storage required |

## 4. SPEC §31 Prohibitions — Compliance Status

| Prohibition | Status |
|---|---|
| Connect and Sema as separate codebases | ✅ Single repo |
| Workspaces requiring ZoikoTime | ✅ No coupling exists |
| Single-tenant first, retrofit later | ⚠️ Multi-tenant only via Organisation; not deeply enforced |
| Embedded model-provider logic in product services | ❌ `core/ai.py` is imported directly across endpoints — must be wrapped by AI Orchestration |
| Cross-tenant context blending | ⚠️ AI prompt assembly in `ai_chat` includes meeting context but no formal tenant guard |
| Internal services exposed to public traffic | ✅ Single FastAPI app behind nginx, no internal-only services yet exposed |
| Public API for service-to-service | N/A — single service today |
| AI without metering / evals / safety / rollback | ❌ No metering, no evals |
| Billing-relevant features without metering | ❌ No metering exists |
| Global features assuming US-only | ⚠️ No region primitive; defaults assume US |
| Secrets in source / logs / config | ✅ `.env` pattern; no committed secrets observed |
| Undocumented architecture exceptions | N/A until SPEC v1.2 is approved |

## 5. What This Means

The current codebase is at the **"first build" exploration stage** relative to SPEC. It validates the product surface (messaging, meetings, AI features, host controls, recording, attendance) but **does not yet implement the SPEC's tenancy, scale, region, observability or governance primitives**.

The honest path to SPEC compliance is a multi-quarter, multi-team effort that requires:

1. ARB approval of SPEC v1.2 (the document itself).
2. ARB approval of ADRs 0001–0020 (especially 0001 cloud, 0002 media, 0003 event bus, 0004 database).
3. Class 3 specifications per SPEC §29 written and approved.
4. Hiring against the ownership matrix in SPEC Appendix C.
5. A Phase-0 program that introduces `tenant_id` plumbing, OTel instrumentation, region primitive, event bus and SFU integration without breaking the existing product.

## 6. Recommended Phase-0 Sequencing (for ARB consideration, not commitment)

Each item is roughly one quarter of work for a small team; items can parallelise where shown.

| # | Phase-0 Workstream | Dependencies | Why first |
|---|---|---|---|
| 1 | Add `tenant_id` to every event, log, cache key, AI prompt | None | Unblocks every SPEC §10 conformance check |
| 2 | OpenTelemetry instrumentation across the monolith | None | Required before any SLO claim is meaningful |
| 3 | Wire `livekit_provider.py` end-to-end behind a feature flag | ADR-0002 | Removes the mesh ceiling that blocks scale targets |
| 4 | Object storage (S3-compatible) for uploads + recordings | ADR-0001, ADR-0004 | Required before any region work |
| 5 | Region primitive on `Workspace`; persist + propagate | ADR-0017 | Required before any multi-region deploy |
| 6 | Metering events on message-send, meeting-minutes, AI-call | ADR-0019 | Required before any paid tier |
| 7 | Stand up managed event bus + first internal consumer | ADR-0003 | Required before splitting services |
| 8 | Extract Real-Time Gateway as a separate deployable | ADR-0006, ADR-0013 | First step of bounded services per SPEC §7 |

The existing `server/app/connect/` scaffold (audit, conversation_service, events, gateway, media_service, messaging_service, presence_service, session_service, shared/) is the right shape for this work — the modules are pre-positioned for extraction.

## 7. What This Document Is Not

- It is **not** a commitment that any of the above will be built.
- It is **not** a Class 3 specification — those are owned per SPEC §29.
- It is **not** a substitute for ADR approval — ADRs in `architecture/adr/` remain Proposed.
- It is **not** an estimate; estimates require team capacity inputs not present here.

It exists so that the ARB and engineering organisation share a common, honest baseline before reviewing SPEC v1.2.
