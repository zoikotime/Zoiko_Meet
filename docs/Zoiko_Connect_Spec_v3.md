# Zoiko Connect — Engineering Architecture Specification

**Version:** 3.0 — Implementation-Ready, GCP-Deployable
**Classification:** CONFIDENTIAL — Internal Engineering Use Only
**Supersedes:** v2.0 — Tier-0 Production Standard
**Stack override from v2.0:** Backend is **Python 3.12 + FastAPI** (not Node.js/TypeScript). Frontend is **React + Vite**. All Node/TS references in v2.0 map to their Python/FastAPI equivalents as defined in §5 Technology Stack.

> This document is authoritative for all Zoiko Connect implementation, API design, data modeling, compliance, and deployment decisions. It preserves the 4-plane model, enterprise-grade compliance posture, and Tier-0 SLOs from v2.0, and adds the missing implementation layer: API contracts, full PostgreSQL DDL, JSON Schemas for every event, sequence flows, security middleware, failure-handling patterns, observability wiring, and GCP deployment topology.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architectural Pillars](#2-architectural-pillars)
3. [Product Definition](#3-product-definition)
4. [Core Architecture — Four-Plane Model](#4-core-architecture--four-plane-model)
5. [Technology Stack](#5-technology-stack)
6. [Bounded Services — Responsibilities](#6-bounded-services--responsibilities)
7. [Canonical Domain Model](#7-canonical-domain-model)
8. [Database Schema (DDL)](#8-database-schema-ddl)
9. [API Specification — REST & WebSocket](#9-api-specification--rest--websocket)
10. [Event Contracts](#10-event-contracts)
11. [Sequence Flows](#11-sequence-flows)
12. [Authorization & Security](#12-authorization--security)
13. [Media Architecture](#13-media-architecture)
14. [Service Level Objectives](#14-service-level-objectives)
15. [Observability Implementation](#15-observability-implementation)
16. [Failure Handling Implementation](#16-failure-handling-implementation)
17. [Reliability & Scaling Roadmap](#17-reliability--scaling-roadmap)
18. [Compliance & Governance](#18-compliance--governance)
19. [Engineering Risks to Avoid](#19-engineering-risks-to-avoid)
20. [Code Structure & Conventions](#20-code-structure--conventions)
21. [Deployment Architecture — GCP](#21-deployment-architecture--gcp)
22. [Environment Separation](#22-environment-separation)
23. [Delivery Sequence](#23-delivery-sequence)
24. [Architectural Directive](#24-architectural-directive)

---

## 1. Executive Summary

Zoiko Connect is the real-time collaboration domain inside ZoikoTime. It unifies persistent chat, audio/video calls, group meetings, screen sharing, file attachments, presence, notifications, recordings, and compliance controls under a single architecturally coherent platform.

**Design mandate:** Zoiko Connect is *not* "chat plus a video plugin." It is a real-time collaboration domain with durable session/conversation models, media-provider abstraction, compliance-ready persistence, and clean service boundaries. This distinction drives every architectural decision.

---

## 2. Architectural Pillars

| Pillar | Statement |
|---|---|
| **One Collaboration Context** | Chat and media are two modes of the same object. A `Conversation` and a `Session` share the same collaboration context. |
| **Persistent by Default** | Messages survive calls. Meeting logs are durable. Nothing is ephemeral unless policy explicitly declares it so. |
| **Media Provider Abstraction** | The platform owns the session, authorization, roster, and compliance record. The SFU owns media transport only. |
| **Compliance-First Persistence** | Every join, leave, message, and admin action writes an auditable record. The data model is compliance-ready *before* the compliance UI exists. |
| **Transient vs. Durable Separation** | Presence, typing, ringing live in Redis. Messages, session logs, audit events live in PostgreSQL. These **never commingle**. |
| **Graceful Degradation** | If media transport fails, session control and chat remain fully coherent. No single-plane failure cascades across planes. |

---

## 3. Product Definition

### 3.1 Required Capabilities

| Capability | Description | Category |
|---|---|---|
| 1:1 Chat | Direct persistent messaging between two users | Messaging |
| Team Chat | Group channels with membership, permissions, history | Messaging |
| 1:1 Audio Call | Direct audio routed through SFU | Media |
| 1:1 Video Call | Direct video with quality adaptation | Media |
| Group Meeting | Multi-participant video/audio with host controls | Media |
| Screen Sharing | Presenter broadcast with role-gated control | Media |
| In-Call Chat | Persistent messaging within an active session | Messaging |
| Post-Call Chat | Meeting-linked thread that survives session end | Messaging |
| File Attachments | Virus-scanned, policy-retained, authorized delivery | Content |
| Read Receipts | Per-user delivery and read confirmation | Messaging |
| Presence | `online`, `away`, `busy`, `in_meeting`, `dnd` | Presence |
| Meeting Logs | Join/leave, duration, host actions per session | Compliance |
| Participation Records | Per-user timestamps, roles, network events | Compliance |
| Admin Auditability | Immutable, exportable audit trail | Compliance |

**UX mandate:** Chat and meetings are not separate applications. They are two modes of the same collaboration context.

---

## 4. Core Architecture — Four-Plane Model

Zoiko Connect is organized into four **independently operable planes**. Each plane has a bounded responsibility set. Cross-plane communication occurs through **defined event contracts**, not shared state.

| Plane | Owns | Key Responsibilities |
|---|---|---|
| **Control Plane** | Identity · Auth · Session lifecycle · Room membership · Policies · Audit hooks · Notification dispatch | Source of truth for authorization and session lifecycle. Produces authoritative lifecycle records. |
| **Messaging Plane** | Messages · Threads · Reactions · Read receipts · Attachments · Search · Persistent history | Owns all durable text/file communication. Guarantees persistence, delivery status, searchable history within tenant. |
| **Media Plane** | A/V transport · Screen share · Media quality · Room orchestration · Recording hooks | Abstracts SFU infrastructure from domain. Issues tokens, tracks media state, exposes telemetry. No SFU vendor concepts leak into platform models. |
| **Compliance Plane** | Retention · Audit trail · Legal hold · Export packages · Moderation · Supervisory access | Immutable records satisfying enterprise/regulatory requirements. Functions independently even if other planes degrade. |

### 4.1 Plane Interaction Contract

- Planes **do not share databases**.
- **Control Plane** is the source of truth for identity, session state, authorization.
- **Messaging Plane** consumes authorization decisions from Control; does not re-implement them.
- **Media Plane** receives session context from Control and session IDs from the platform — *never* from the SFU vendor.
- **Compliance Plane** consumes domain events from all planes via a durable event bus. It never writes to other planes.
- Real-time socket events are **notifications**. They are never the authoritative record.

**CRITICAL:** The Media Plane is an infrastructure abstraction. The Collaboration `Session` is the business object. Vendor-specific room models (LiveKit room IDs, tokens) **must never** leak into the platform domain model.

---

## 5. Technology Stack

| Layer | Technology | Role |
|---|---|---|
| Runtime | **Python 3.12 + FastAPI 0.115+** | Service runtime for gateway, signaling, and all control surfaces. Async-first. |
| ASGI server | **Uvicorn** (one process per container, scaled by replicas) | No gunicorn — orchestration is handled by GKE/Cloud Run. |
| WebSocket transport | **FastAPI native WebSockets** + **Redis Pub/Sub fan-out** | Replaces Socket.IO/Redis-adapter pattern from v2.0 with the Python-native equivalent. Same semantics: horizontal scaling with no sticky sessions. |
| Media Transport | **LiveKit (SFU) + WebRTC** | SFU for group audio/video/screen share. All tokens issued server-side with platform-controlled permissions. |
| Primary Database | **PostgreSQL 15+** on **Cloud SQL for PostgreSQL** | Durable domain records. Multi-tenant with `tenant_id` on every table. HA: regional, automated backups, PITR. |
| Transient State | **Redis 7+** on **Memorystore for Redis (Standard tier)** | Presence cache, typing, ringing, WS pub/sub, short-TTL locks. |
| Object Storage | **Google Cloud Storage (GCS)** with uniform bucket-level access | Attachment binaries, recording artifacts, export packages. Never in PostgreSQL. |
| Search Index | **OpenSearch** (self-hosted on GKE) or **Elasticsearch on GCE** | Full-text search over messages/conversations/sessions. Async-indexed, tenant-isolated, permission-filtered. |
| Job Queue | **ARQ** (async Redis queue) for hot async work; **Cloud Tasks** for long-horizon scheduled jobs | Recording post-processing, retention enforcement, notification retries, search indexing, export generation. |
| API Layer | **REST** (CRUD) + **WebSocket** (real-time) | REST for resource management; WS for real-time delivery. GraphQL deferred to Phase 3. |
| Observability | **OpenTelemetry → Cloud Trace + Cloud Monitoring + Cloud Logging**; Prometheus + Grafana optional | Traces, JSON logs with correlation IDs, metrics, alerting. |
| Secret mgmt | **Secret Manager** (GCP) | Runtime secrets. No secrets in images or env files committed to repo. |
| CI/CD | **GitHub Actions → Artifact Registry → GKE rollout** | Existing pipeline extended; see §21. |

> **Migration note:** The current [server/](../server/) uses FastAPI with split routers in [server/app/api/](../server/app/api/) and native WebSockets in [server/app/websocket/](../server/app/websocket/). This spec extends — does not replace — that foundation.

---

## 6. Bounded Services — Responsibilities

Zoiko Connect decomposes into **ten bounded services**. Each owns its data, API surface, and domain logic. Services communicate via internal REST and a shared event bus. **No shared tables across services.**

Full API contracts for each are in **[§9 API Specification](#9-api-specification--rest--websocket)**. Data ownership is in **[§8 Database Schema](#8-database-schema-ddl)**. This section is the responsibility summary only.

| # | Service | Plane | Owns | Core Tables |
|---|---|---|---|---|
| 6.1 | **Collaboration Gateway** | Control | WS admission · Auth · Routing · Rate limit · Fan-out | *(stateless)* |
| 6.2 | **Session Service** | Control | Session lifecycle · Scheduling · Roster · Policies | `connect_sessions`, `connect_session_members`, `connect_session_policies`, `connect_session_events` |
| 6.3 | **Conversation Service** | Messaging | Direct/group/meeting-linked chats · Membership · Channel metadata | `connect_conversations`, `connect_conversation_members`, `connect_conversation_policies` |
| 6.4 | **Messaging Service** | Messaging | Send/edit/delete · Threads · Reactions · Receipts · History | `connect_messages`, `connect_message_threads`, `connect_message_reactions`, `connect_message_receipts`, `connect_message_edits` |
| 6.5 | **Presence Service** | Control | Online/away/busy/DND · Typing · Ringing · Device tracking | *(Redis only — no PG)* |
| 6.6 | **Media Orchestration** | Media | Create room · Issue tokens · Map session→room · Media telemetry | `connect_media_rooms`, `connect_media_room_members`, `connect_media_room_events` |
| 6.7 | **Attachment Service** | Messaging | Signed URLs · Virus scan · Metadata · Thumbnails · Retention | `connect_attachments`, `connect_attachment_links`, `connect_attachment_versions` |
| 6.8 | **Notification Service** | Control | Ringing · Missed calls · Mentions · Push/email fallback | `connect_notifications`, `connect_notification_preferences`, `connect_notification_delivery_attempts` |
| 6.9 | **Recording & Artifact** | Compliance | Policy-gated recording · Artifact storage · Access control | `connect_recordings`, `connect_recording_artifacts`, `connect_recording_access_logs` |
| 6.10 | **Compliance & Audit** | Compliance | Append-only audit · Export · Retention · Legal hold | `connect_audit_events`, `connect_compliance_exports`, `connect_retention_actions`, `connect_access_logs` |

### 6.1 Gateway — additional properties

| Property | Value |
|---|---|
| Scale model | Horizontal, stateless. Fan-out via Redis Pub/Sub. No sticky sessions. |
| Rate limits | Per-connection: 100 events/s default. Per-tenant: tier-based (§9.3). |
| Connection lifecycle | JWT validated on `CONNECT`; periodic refresh via `auth.refresh` WS frame; idle timeout 120 s with ping/pong heartbeat. |

### 6.2 Session Service — state machine

```
scheduled ──┐
            ├─► pending_start ──► active ──► ended ──► archived
ad_hoc  ────┘                                  └──► cancelled
```

Every transition **must** emit a durable `session.*` event (see §10) *and* a `connect_audit_events` row.

### 6.4 Messaging Service — performance target

p99 message delivery confirmation **< 300 ms** under nominal load. High-write table (`connect_messages`, `connect_message_receipts`) — see §8.5 partitioning strategy.

### 6.5 Presence Service — graceful degradation

Redis outage must not fail other planes. On Redis unavailability:
- Presence reads return last-known value from in-process LRU cache (max age 30 s) or `offline`.
- Presence writes are dropped (best-effort).
- **Messaging and Session planes continue unaffected.**

### 6.6 Media Orchestration — vendor contract

- Only service permitted to hold LiveKit credentials.
- `MediaRoomProvider` interface MUST be implementable against Agora/Daily/Twilio/Janus. LiveKit is v1 provider.
- Clients **never** receive tokens directly from the SFU vendor — always via `POST /media/rooms/{session_id}/token`.

### 6.7 Attachment Service — security invariant

Every download request is **re-authorized** at request time. Signed GCS URLs are short-lived (**max 15 minutes**). No public attachment URLs. Virus scan hook (ClamAV container in cluster) runs before attachment is marked `available`.

### 6.10 Compliance Service — durability

`connect_audit_events` is **append-only**. No `UPDATE` or `DELETE` permitted. Enforced by:
- PostgreSQL role grants (service role has only `INSERT` + `SELECT`).
- Trigger that raises exception on `UPDATE` / `DELETE`.

---

## 7. Canonical Domain Model

| Entity | Plane | Definition |
|---|---|---|
| **User** | Control | Authenticated ZoikoTime identity. Scoped to a tenant. Root of all authorization. |
| **Conversation** | Messaging | Persistent named communication space. Owns membership, permissions, history. `direct` / `group` / `meeting_linked` / `temporary`. |
| **ConversationMember** | Messaging | Membership: user, role, mute, archive, last-read marker. |
| **Session** | Control | Meeting/call object. Authoritative business record for a real-time collaboration event. |
| **SessionMember** | Control | Roster entry: join/leave timestamps, role, participation state. |
| **MediaRoom** | Media | Infrastructure mapping between Session and SFU provider room. Replaceable. Must not leak into business logic. |
| **Message** | Messaging | Persistent chat record. Belongs to a Conversation. States, edits, receipts, reactions, attachments. |
| **MessageThread** | Messaging | Reply chain attached to a parent Message. |
| **Attachment** | Messaging | Durable file/media object. Stored in GCS. Referenced via `connect_attachment_links`. |
| **PresenceState** | Control | Transient availability state of a User per tenant. Redis + TTL. Not audited. |
| **NotificationEvent** | Control | Outbound alert. Carries idempotency key and delivery attempt history. |
| **AuditEvent** | Compliance | Immutable compliance/trace record. Written at every lifecycle boundary. Append-only. |
| **RecordingArtifact** | Compliance | Stored media or derived content (transcript/summary). Access-controlled, retention-governed. |

### 7.1 Relationship Rules

| Relationship | Rule |
|---|---|
| Conversation ↔ Session | A Session attaches to exactly one Conversation. A Conversation hosts many Sessions over time. |
| Session ↔ MediaRoom | A Session has at most one active MediaRoom. Rooms are created/destroyed; Sessions are archived. |
| Session ↔ Messages | In-call messages are written to the Session's linked Conversation, **not** a separate store. |
| Conversation ↔ Messages | A Conversation owns its complete message history. Persists after Session end per retention policy. |
| Session ↔ AuditEvents | Every Session lifecycle transition emits an AuditEvent. |
| Message ↔ Attachments | Via `connect_attachment_links`. No binary in message row. |
| User ↔ PresenceState | Exactly one effective PresenceState per user per tenant context, resolved from most-recent active device. |

---

## 8. Database Schema (DDL)

All DDL targets **PostgreSQL 15+** on **Cloud SQL**. Schema is `connect`. Every query MUST filter by `tenant_id`.

### 8.1 Extensions & Setup

```sql
CREATE SCHEMA IF NOT EXISTS connect;
SET search_path TO connect, public;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";     -- gen_random_uuid() (UUID v4 fallback)
CREATE EXTENSION IF NOT EXISTS "pg_trgm";      -- trigram indexes for search fallback
CREATE EXTENSION IF NOT EXISTS "btree_gin";    -- composite GIN indexes

-- UUID v7 generator (time-ordered). Implement as a SQL function or rely on app-side generation.
-- Preferred: application-side generation via uuid7 Python library. DB column remains UUID.
```

### 8.2 Standard Fields Contract

Every major table **must** include:

| Field | Type | Purpose |
|---|---|---|
| `id` | `UUID` | UUID v7 (app-generated), time-ordered for index locality. |
| `tenant_id` | `UUID NOT NULL` | Non-negotiable multi-tenancy scope. Every query filters by this. |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT now()` | UTC creation time. Indexed on high-volume tables. |
| `updated_at` | `TIMESTAMPTZ NOT NULL DEFAULT now()` | Maintained by trigger; not trusted from client. |
| `created_by` | `UUID` | Originating user. Audit attribution. |
| `status` | `VARCHAR(32)` | Lifecycle status for state-machine logic. |
| `version` | `INTEGER NOT NULL DEFAULT 1` | Optimistic concurrency. Incremented on update. |
| `correlation_id` | `UUID` | Distributed tracing token, propagated from request context. |

### 8.3 Reusable `updated_at` Trigger

```sql
CREATE OR REPLACE FUNCTION connect.tg_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := now();
    NEW.version   := COALESCE(OLD.version, 0) + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

Apply to every table as `CREATE TRIGGER tg_<table>_updated_at BEFORE UPDATE ON <table> FOR EACH ROW EXECUTE FUNCTION connect.tg_set_updated_at();`

### 8.4 Conversation Plane

```sql
-- ---------------------------------------------------------------
-- connect_conversations
-- ---------------------------------------------------------------
CREATE TABLE connect.connect_conversations (
    id              UUID PRIMARY KEY,
    tenant_id       UUID NOT NULL,
    conv_type       VARCHAR(32) NOT NULL
        CHECK (conv_type IN ('direct','group','meeting_linked','temporary')),
    name            VARCHAR(200),                 -- NULL for direct
    topic           TEXT,
    is_archived     BOOLEAN NOT NULL DEFAULT FALSE,
    legal_hold      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      UUID NOT NULL,
    status          VARCHAR(32) NOT NULL DEFAULT 'active',
    version         INTEGER NOT NULL DEFAULT 1,
    correlation_id  UUID
);

CREATE INDEX ix_conv_tenant_updated    ON connect.connect_conversations (tenant_id, updated_at DESC);
CREATE INDEX ix_conv_tenant_type       ON connect.connect_conversations (tenant_id, conv_type);
CREATE INDEX ix_conv_legal_hold        ON connect.connect_conversations (tenant_id) WHERE legal_hold = TRUE;

-- ---------------------------------------------------------------
-- connect_conversation_members
-- ---------------------------------------------------------------
CREATE TABLE connect.connect_conversation_members (
    id                  UUID PRIMARY KEY,
    tenant_id           UUID NOT NULL,
    conversation_id     UUID NOT NULL REFERENCES connect.connect_conversations(id) ON DELETE CASCADE,
    user_id             UUID NOT NULL,
    role                VARCHAR(32) NOT NULL DEFAULT 'participant'
        CHECK (role IN ('participant','channel_admin','guest')),
    is_muted            BOOLEAN NOT NULL DEFAULT FALSE,
    is_archived         BOOLEAN NOT NULL DEFAULT FALSE,
    last_read_message_id UUID,
    last_read_at        TIMESTAMPTZ,
    joined_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    left_at             TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by          UUID,
    status              VARCHAR(32) NOT NULL DEFAULT 'active',
    version             INTEGER NOT NULL DEFAULT 1,
    correlation_id      UUID,
    UNIQUE (conversation_id, user_id)
);

CREATE INDEX ix_convmember_user        ON connect.connect_conversation_members (tenant_id, user_id, status);
CREATE INDEX ix_convmember_conv        ON connect.connect_conversation_members (conversation_id);

-- ---------------------------------------------------------------
-- connect_conversation_policies
-- ---------------------------------------------------------------
CREATE TABLE connect.connect_conversation_policies (
    id                       UUID PRIMARY KEY,
    tenant_id                UUID NOT NULL,
    conversation_id          UUID NOT NULL UNIQUE REFERENCES connect.connect_conversations(id) ON DELETE CASCADE,
    message_retention_days   INTEGER,     -- NULL = inherit tenant default
    attachment_retention_days INTEGER,
    allow_guests             BOOLEAN NOT NULL DEFAULT FALSE,
    allow_external_sharing   BOOLEAN NOT NULL DEFAULT FALSE,
    moderation_enabled       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by               UUID,
    version                  INTEGER NOT NULL DEFAULT 1
);
```

### 8.5 Messaging Plane (high-write, partitioned)

```sql
-- ---------------------------------------------------------------
-- connect_messages — partitioned by created_at (monthly RANGE)
-- Rationale: high write volume, retention-driven archival, enables
--            partition drop as a fast retention primitive.
-- ---------------------------------------------------------------
CREATE TABLE connect.connect_messages (
    id                  UUID NOT NULL,
    tenant_id           UUID NOT NULL,
    conversation_id     UUID NOT NULL,
    session_id          UUID,                 -- set iff sent during a live session
    sender_id           UUID NOT NULL,
    parent_message_id   UUID,                 -- thread parent
    body               TEXT NOT NULL,
    body_format         VARCHAR(16) NOT NULL DEFAULT 'plain'
        CHECK (body_format IN ('plain','markdown','rich')),
    mentions            JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{user_id, offset, length}]
    has_attachments     BOOLEAN NOT NULL DEFAULT FALSE,
    delivery_state      VARCHAR(16) NOT NULL DEFAULT 'pending'
        CHECK (delivery_state IN ('pending','delivered','seen','failed','deleted','redacted')),
    edited_at           TIMESTAMPTZ,
    redacted_at         TIMESTAMPTZ,
    legal_hold          BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by          UUID NOT NULL,
    status              VARCHAR(32) NOT NULL DEFAULT 'active',
    version             INTEGER NOT NULL DEFAULT 1,
    correlation_id      UUID,
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Bootstrap partitions (pg_partman recommended for automation)
CREATE TABLE connect.connect_messages_p2026_04 PARTITION OF connect.connect_messages
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE connect.connect_messages_p2026_05 PARTITION OF connect.connect_messages
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
-- Create remaining months via pg_partman or a scheduled job.

-- Indexes (created on each partition; pg_partman handles propagation)
CREATE INDEX ix_msg_conv_created ON connect.connect_messages (tenant_id, conversation_id, created_at DESC);
CREATE INDEX ix_msg_sender       ON connect.connect_messages (tenant_id, sender_id, created_at DESC);
CREATE INDEX ix_msg_thread       ON connect.connect_messages (parent_message_id) WHERE parent_message_id IS NOT NULL;
CREATE INDEX ix_msg_legal_hold   ON connect.connect_messages (tenant_id) WHERE legal_hold = TRUE;
CREATE INDEX ix_msg_mentions_gin ON connect.connect_messages USING GIN (mentions);
CREATE INDEX ix_msg_body_trgm    ON connect.connect_messages USING GIN (body gin_trgm_ops);  -- fallback search

-- ---------------------------------------------------------------
-- connect_message_threads  (thread metadata / summary)
-- ---------------------------------------------------------------
CREATE TABLE connect.connect_message_threads (
    id                   UUID PRIMARY KEY,
    tenant_id            UUID NOT NULL,
    parent_message_id    UUID NOT NULL,
    reply_count          INTEGER NOT NULL DEFAULT 0,
    last_reply_at        TIMESTAMPTZ,
    participant_user_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    version              INTEGER NOT NULL DEFAULT 1,
    UNIQUE (parent_message_id)
);

-- ---------------------------------------------------------------
-- connect_message_receipts — per-user delivery/read
-- Very high write volume. Consider Redis-first with async flush.
-- ---------------------------------------------------------------
CREATE TABLE connect.connect_message_receipts (
    id              UUID PRIMARY KEY,
    tenant_id       UUID NOT NULL,
    message_id      UUID NOT NULL,
    user_id         UUID NOT NULL,
    delivered_at    TIMESTAMPTZ,
    read_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (message_id, user_id)
);
CREATE INDEX ix_receipt_user_unread ON connect.connect_message_receipts (tenant_id, user_id)
    WHERE read_at IS NULL;

-- ---------------------------------------------------------------
-- connect_message_reactions
-- ---------------------------------------------------------------
CREATE TABLE connect.connect_message_reactions (
    id              UUID PRIMARY KEY,
    tenant_id       UUID NOT NULL,
    message_id      UUID NOT NULL,
    user_id         UUID NOT NULL,
    emoji           VARCHAR(32) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (message_id, user_id, emoji)
);
CREATE INDEX ix_reaction_msg ON connect.connect_message_reactions (message_id);

-- ---------------------------------------------------------------
-- connect_message_edits — edit history for compliance
-- ---------------------------------------------------------------
CREATE TABLE connect.connect_message_edits (
    id              UUID PRIMARY KEY,
    tenant_id       UUID NOT NULL,
    message_id      UUID NOT NULL,
    editor_user_id  UUID NOT NULL,
    previous_body   TEXT NOT NULL,
    edit_reason     VARCHAR(200),
    edited_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_edit_message ON connect.connect_message_edits (message_id, edited_at DESC);
```

### 8.6 Session Plane

```sql
CREATE TABLE connect.connect_sessions (
    id                UUID PRIMARY KEY,
    tenant_id         UUID NOT NULL,
    conversation_id   UUID REFERENCES connect.connect_conversations(id),
    session_type      VARCHAR(32) NOT NULL
        CHECK (session_type IN ('ad_hoc_1on1','group_meeting','scheduled')),
    title             VARCHAR(200),
    scheduled_start   TIMESTAMPTZ,
    scheduled_end     TIMESTAMPTZ,
    actual_start      TIMESTAMPTZ,
    actual_end        TIMESTAMPTZ,
    state             VARCHAR(32) NOT NULL DEFAULT 'scheduled'
        CHECK (state IN ('scheduled','pending_start','active','ended','cancelled','archived')),
    host_user_id      UUID NOT NULL,
    legal_hold        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by        UUID NOT NULL,
    status            VARCHAR(32) NOT NULL DEFAULT 'active',
    version           INTEGER NOT NULL DEFAULT 1,
    correlation_id    UUID
);
CREATE INDEX ix_session_tenant_state   ON connect.connect_sessions (tenant_id, state);
CREATE INDEX ix_session_conv           ON connect.connect_sessions (conversation_id);
CREATE INDEX ix_session_scheduled      ON connect.connect_sessions (scheduled_start) WHERE state = 'scheduled';
CREATE INDEX ix_session_legal_hold     ON connect.connect_sessions (tenant_id) WHERE legal_hold = TRUE;

CREATE TABLE connect.connect_session_members (
    id                  UUID PRIMARY KEY,
    tenant_id           UUID NOT NULL,
    session_id          UUID NOT NULL REFERENCES connect.connect_sessions(id) ON DELETE CASCADE,
    user_id             UUID NOT NULL,
    role                VARCHAR(32) NOT NULL DEFAULT 'participant'
        CHECK (role IN ('host','co_host','presenter','participant','guest')),
    invitation_state    VARCHAR(32) NOT NULL DEFAULT 'invited'
        CHECK (invitation_state IN ('invited','accepted','declined','pending')),
    joined_at           TIMESTAMPTZ,
    left_at             TIMESTAMPTZ,
    left_reason         VARCHAR(64),       -- 'user_left','host_kicked','timeout','error'
    last_network_event  VARCHAR(32),       -- 'connected','reconnecting','disconnected'
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    version             INTEGER NOT NULL DEFAULT 1,
    UNIQUE (session_id, user_id)
);
CREATE INDEX ix_sessmember_session ON connect.connect_session_members (session_id);
CREATE INDEX ix_sessmember_user    ON connect.connect_session_members (tenant_id, user_id);

CREATE TABLE connect.connect_session_policies (
    id                          UUID PRIMARY KEY,
    tenant_id                   UUID NOT NULL,
    session_id                  UUID NOT NULL UNIQUE REFERENCES connect.connect_sessions(id) ON DELETE CASCADE,
    recording_enabled           BOOLEAN NOT NULL DEFAULT FALSE,
    recording_consent_required  BOOLEAN NOT NULL DEFAULT TRUE,
    max_participants            INTEGER NOT NULL DEFAULT 200,
    waiting_room_enabled        BOOLEAN NOT NULL DEFAULT FALSE,
    allow_guests                BOOLEAN NOT NULL DEFAULT FALSE,
    allow_screen_share          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    version                     INTEGER NOT NULL DEFAULT 1
);

-- session_events = compliance-plane table (append-only)
CREATE TABLE connect.connect_session_events (
    id              UUID PRIMARY KEY,
    tenant_id       UUID NOT NULL,
    session_id      UUID NOT NULL,
    actor_user_id   UUID,
    event_type      VARCHAR(64) NOT NULL,
    from_state      VARCHAR(32),
    to_state        VARCHAR(32),
    payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
    emitted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    correlation_id  UUID
);
CREATE INDEX ix_sessev_session ON connect.connect_session_events (session_id, emitted_at);

-- append-only enforcement
CREATE OR REPLACE FUNCTION connect.reject_mutation() RETURNS TRIGGER AS $$
BEGIN RAISE EXCEPTION 'table is append-only'; END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER tg_sessev_noup BEFORE UPDATE OR DELETE ON connect.connect_session_events
    FOR EACH ROW EXECUTE FUNCTION connect.reject_mutation();
```

### 8.7 Media Plane

```sql
CREATE TABLE connect.connect_media_rooms (
    id               UUID PRIMARY KEY,
    tenant_id        UUID NOT NULL,
    session_id       UUID NOT NULL REFERENCES connect.connect_sessions(id) ON DELETE CASCADE,
    provider         VARCHAR(32) NOT NULL DEFAULT 'livekit',
    provider_room_id VARCHAR(200) NOT NULL,   -- opaque vendor identifier
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at        TIMESTAMPTZ,
    status           VARCHAR(32) NOT NULL DEFAULT 'active',
    version          INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX ix_mediaroom_session ON connect.connect_media_rooms (session_id);
CREATE INDEX ix_mediaroom_active  ON connect.connect_media_rooms (tenant_id) WHERE status = 'active';

CREATE TABLE connect.connect_media_room_members (
    id              UUID PRIMARY KEY,
    tenant_id       UUID NOT NULL,
    media_room_id   UUID NOT NULL REFERENCES connect.connect_media_rooms(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL,
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    left_at         TIMESTAMPTZ,
    peer_ip_hash    VARCHAR(64),    -- SHA-256(ip + tenant_salt) — never plain IP
    client_version  VARCHAR(64),
    UNIQUE (media_room_id, user_id, joined_at)
);

CREATE TABLE connect.connect_media_room_events (
    id              UUID PRIMARY KEY,
    tenant_id       UUID NOT NULL,
    media_room_id   UUID NOT NULL,
    user_id         UUID,
    event_type      VARCHAR(64) NOT NULL,   -- 'quality_degraded','reconnected','ice_failure',...
    payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
    emitted_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_medev_room ON connect.connect_media_room_events (media_room_id, emitted_at);
```

### 8.8 Attachment Plane

```sql
CREATE TABLE connect.connect_attachments (
    id                  UUID PRIMARY KEY,
    tenant_id           UUID NOT NULL,
    filename            VARCHAR(500) NOT NULL,
    content_type        VARCHAR(200) NOT NULL,
    size_bytes          BIGINT NOT NULL,
    storage_bucket      VARCHAR(200) NOT NULL,
    storage_key         VARCHAR(1000) NOT NULL,
    sha256              VARCHAR(64) NOT NULL,
    scan_state          VARCHAR(16) NOT NULL DEFAULT 'pending'
        CHECK (scan_state IN ('pending','clean','infected','failed','skipped')),
    scan_result         JSONB,
    thumbnail_key       VARCHAR(1000),
    uploaded_by         UUID NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    status              VARCHAR(32) NOT NULL DEFAULT 'uploading',
    version             INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX ix_att_tenant_scan ON connect.connect_attachments (tenant_id, scan_state);
CREATE INDEX ix_att_sha256      ON connect.connect_attachments (tenant_id, sha256);

CREATE TABLE connect.connect_attachment_links (
    id              UUID PRIMARY KEY,
    tenant_id       UUID NOT NULL,
    attachment_id   UUID NOT NULL REFERENCES connect.connect_attachments(id) ON DELETE CASCADE,
    message_id      UUID NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (attachment_id, message_id)
);

CREATE TABLE connect.connect_attachment_versions (
    id                  UUID PRIMARY KEY,
    tenant_id           UUID NOT NULL,
    attachment_id       UUID NOT NULL REFERENCES connect.connect_attachments(id) ON DELETE CASCADE,
    version_index       INTEGER NOT NULL,
    storage_key         VARCHAR(1000) NOT NULL,
    size_bytes          BIGINT NOT NULL,
    uploaded_by         UUID NOT NULL,
    uploaded_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (attachment_id, version_index)
);
```

### 8.9 Notification Plane

```sql
CREATE TABLE connect.connect_notifications (
    id                UUID PRIMARY KEY,
    tenant_id         UUID NOT NULL,
    recipient_user_id UUID NOT NULL,
    notification_type VARCHAR(64) NOT NULL,  -- 'call.ringing','mention','missed_call',...
    payload           JSONB NOT NULL DEFAULT '{}'::jsonb,
    idempotency_key   VARCHAR(200) NOT NULL,
    state             VARCHAR(32) NOT NULL DEFAULT 'queued'
        CHECK (state IN ('queued','dispatching','delivered','failed','dead_letter')),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    delivered_at      TIMESTAMPTZ,
    expires_at        TIMESTAMPTZ NOT NULL,
    version           INTEGER NOT NULL DEFAULT 1,
    UNIQUE (tenant_id, idempotency_key)
);
CREATE INDEX ix_notif_recipient ON connect.connect_notifications (tenant_id, recipient_user_id, state);

CREATE TABLE connect.connect_notification_preferences (
    id                UUID PRIMARY KEY,
    tenant_id         UUID NOT NULL,
    user_id           UUID NOT NULL,
    channel           VARCHAR(32) NOT NULL CHECK (channel IN ('ws','push','email','sms')),
    event_class       VARCHAR(64) NOT NULL,  -- 'calls','mentions','missed_calls',...
    enabled           BOOLEAN NOT NULL DEFAULT TRUE,
    quiet_hours_start TIME,
    quiet_hours_end   TIME,
    timezone          VARCHAR(64),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, user_id, channel, event_class)
);

CREATE TABLE connect.connect_notification_delivery_attempts (
    id                 UUID PRIMARY KEY,
    tenant_id          UUID NOT NULL,
    notification_id    UUID NOT NULL REFERENCES connect.connect_notifications(id) ON DELETE CASCADE,
    channel            VARCHAR(32) NOT NULL,
    attempt_number     INTEGER NOT NULL,
    attempted_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    outcome            VARCHAR(32) NOT NULL,     -- 'success','transient_error','permanent_error'
    error_code         VARCHAR(64),
    error_message      TEXT,
    provider_message_id VARCHAR(200)
);
CREATE INDEX ix_ndel_notif ON connect.connect_notification_delivery_attempts (notification_id);
```

### 8.10 Recording Plane

```sql
CREATE TABLE connect.connect_recordings (
    id                      UUID PRIMARY KEY,
    tenant_id               UUID NOT NULL,
    session_id              UUID NOT NULL REFERENCES connect.connect_sessions(id),
    started_by              UUID NOT NULL,
    policy_grant_id         UUID NOT NULL,
    consent_notified_at     TIMESTAMPTZ NOT NULL,
    started_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at                TIMESTAMPTZ,
    state                   VARCHAR(32) NOT NULL DEFAULT 'starting'
        CHECK (state IN ('starting','recording','stopping','completed','partial','failed')),
    retention_until         TIMESTAMPTZ,
    legal_hold              BOOLEAN NOT NULL DEFAULT FALSE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    version                 INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX ix_rec_session ON connect.connect_recordings (session_id);
CREATE INDEX ix_rec_tenant_state ON connect.connect_recordings (tenant_id, state);

CREATE TABLE connect.connect_recording_artifacts (
    id                  UUID PRIMARY KEY,
    tenant_id           UUID NOT NULL,
    recording_id        UUID NOT NULL REFERENCES connect.connect_recordings(id) ON DELETE CASCADE,
    artifact_type       VARCHAR(32) NOT NULL
        CHECK (artifact_type IN ('video','audio','transcript','summary')),
    storage_bucket      VARCHAR(200) NOT NULL,
    storage_key         VARCHAR(1000) NOT NULL,
    size_bytes          BIGINT,
    mime_type           VARCHAR(200),
    checksum_sha256     VARCHAR(64),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE connect.connect_recording_access_logs (
    id              UUID PRIMARY KEY,
    tenant_id       UUID NOT NULL,
    recording_id    UUID NOT NULL,
    user_id         UUID NOT NULL,
    access_type     VARCHAR(32) NOT NULL,    -- 'view','download','export'
    ip_hash         VARCHAR(64),
    user_agent      VARCHAR(500),
    accessed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_recacc_recording ON connect.connect_recording_access_logs (recording_id, accessed_at DESC);
CREATE TRIGGER tg_recacc_noup BEFORE UPDATE OR DELETE ON connect.connect_recording_access_logs
    FOR EACH ROW EXECUTE FUNCTION connect.reject_mutation();
```

### 8.11 Compliance Plane (append-only)

```sql
-- connect_audit_events — PARTITIONED monthly for scalable retention
CREATE TABLE connect.connect_audit_events (
    id              UUID NOT NULL,
    tenant_id       UUID NOT NULL,
    actor_user_id   UUID,                     -- NULL for system actions
    actor_service   VARCHAR(64),
    event_type      VARCHAR(64) NOT NULL,
    resource_type   VARCHAR(64) NOT NULL,     -- 'session','message','recording',...
    resource_id     UUID,
    payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_hash         VARCHAR(64),
    correlation_id  UUID,
    emitted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id, emitted_at)
) PARTITION BY RANGE (emitted_at);

CREATE TABLE connect.connect_audit_events_p2026_04 PARTITION OF connect.connect_audit_events
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
-- ... one per month; automate via pg_partman.

CREATE INDEX ix_audit_tenant_time ON connect.connect_audit_events (tenant_id, emitted_at DESC);
CREATE INDEX ix_audit_resource    ON connect.connect_audit_events (resource_type, resource_id);
CREATE INDEX ix_audit_actor       ON connect.connect_audit_events (tenant_id, actor_user_id);

CREATE TRIGGER tg_audit_noup BEFORE UPDATE OR DELETE ON connect.connect_audit_events
    FOR EACH ROW EXECUTE FUNCTION connect.reject_mutation();

-- Role grants — the audit service role can INSERT/SELECT only.
-- Run as superuser during setup:
-- REVOKE UPDATE, DELETE, TRUNCATE ON connect.connect_audit_events FROM connect_audit_rw;

CREATE TABLE connect.connect_compliance_exports (
    id                  UUID PRIMARY KEY,
    tenant_id           UUID NOT NULL,
    requested_by        UUID NOT NULL,
    request_scope       JSONB NOT NULL,       -- {"conversation_ids":[...],"date_range":{...}}
    manifest_storage_key VARCHAR(1000),
    package_storage_key VARCHAR(1000),
    state               VARCHAR(32) NOT NULL DEFAULT 'queued'
        CHECK (state IN ('queued','building','completed','failed')),
    requested_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at        TIMESTAMPTZ,
    expires_at          TIMESTAMPTZ NOT NULL,
    sha256              VARCHAR(64)
);

CREATE TABLE connect.connect_retention_actions (
    id              UUID PRIMARY KEY,
    tenant_id       UUID NOT NULL,
    policy_id       UUID,
    resource_type   VARCHAR(64) NOT NULL,
    scope           JSONB NOT NULL,
    action          VARCHAR(32) NOT NULL CHECK (action IN ('purge','redact','anonymize')),
    affected_count  BIGINT,
    executed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    executed_by     VARCHAR(64) NOT NULL      -- service identity
);

CREATE TABLE connect.connect_access_logs (
    id              UUID PRIMARY KEY,
    tenant_id       UUID NOT NULL,
    actor_user_id   UUID NOT NULL,
    access_type     VARCHAR(64) NOT NULL,    -- 'supervisory','admin','compliance'
    resource_type   VARCHAR(64) NOT NULL,
    resource_id     UUID,
    justification   TEXT,
    ip_hash         VARCHAR(64),
    accessed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 8.12 Data Rules (enforced)

- Every query filters by `tenant_id`. Enforced at repository layer (§20.4) **and** via Postgres Row-Level Security policies where feasible.
- Attachment binaries **never** live in PostgreSQL.
- `connect_audit_events`, `connect_session_events`, `connect_recording_access_logs` are append-only (trigger + role grants).
- Soft deletes via `status`; hard purge only via documented retention workflow.
- High-write tables (`connect_messages`, `connect_audit_events`) are partitioned monthly.

---

## 9. API Specification — REST & WebSocket

### 9.1 Conventions

| Aspect | Rule |
|---|---|
| Base URL | `/api/v1/...` for REST; `/ws/v1` for WebSocket |
| Auth | `Authorization: Bearer <jwt>` on REST; JWT in `?token=` query OR first WS message on WebSocket (§12) |
| Content-Type | `application/json; charset=utf-8` |
| Tenant scope | Resolved from JWT `tenant_id`. Client-supplied tenant_id is **rejected**. |
| Idempotency | All non-idempotent POSTs accept `Idempotency-Key` header. 24 h dedupe window in Redis. |
| Pagination | Cursor-based: `?cursor=<opaque>&limit=<1..100>`. Response: `{ items, next_cursor }`. |
| Correlation | Every request carries `X-Correlation-Id` (generated if absent). Propagated to downstream services. |
| Errors | RFC 7807 Problem Details (§9.2). |
| Timestamps | ISO 8601 UTC with milliseconds. |

### 9.2 Error Envelope (RFC 7807)

```http
HTTP/1.1 403 Forbidden
Content-Type: application/problem+json

{
  "type": "https://connect.zoikotime/errors/authz.forbidden",
  "title": "Forbidden",
  "status": 403,
  "detail": "User lacks join_session permission for session 3f…",
  "code": "AUTHZ_FORBIDDEN",
  "correlation_id": "01JHX…",
  "retriable": false
}
```

Standard `code` values: `AUTH_INVALID_TOKEN`, `AUTH_EXPIRED`, `AUTHZ_FORBIDDEN`, `VALIDATION_FAILED`, `RESOURCE_NOT_FOUND`, `RESOURCE_CONFLICT`, `RATE_LIMITED`, `TENANT_MISMATCH`, `DEPENDENCY_UNAVAILABLE`, `INTERNAL_ERROR`.

### 9.3 Rate Limits

Enforced at Gateway + per-service middleware. Implemented via Redis (token-bucket) keyed by `tenant_id + user_id + route_class`.

| Tier | REST req/s/user | WS events/s/conn | Upload MB/hour/user |
|---|---|---|---|
| Free | 20 | 50 | 200 |
| Standard | 50 | 100 | 2,000 |
| Enterprise | 200 | 500 | configurable |

Headers returned on every response:

```
X-RateLimit-Limit: 50
X-RateLimit-Remaining: 47
X-RateLimit-Reset: 1745218200
Retry-After: 3          # only when 429
```

### 9.4 Validation

- Bodies validated via Pydantic models (`server/app/schemas/`).
- Lengths: message body ≤ 32 KB; conversation name ≤ 200; filename ≤ 500.
- Reject any field unknown in schema (`model_config = ConfigDict(extra='forbid')`).
- Emoji reactions: single grapheme cluster OR short-code (`:thumbsup:`); ≤ 32 chars.

### 9.5 Conversation Service — REST

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/conversations` | Create direct/group/meeting-linked conversation |
| GET | `/api/v1/conversations` | List conversations for current user (cursor-paged) |
| GET | `/api/v1/conversations/{id}` | Fetch conversation detail |
| PATCH | `/api/v1/conversations/{id}` | Update name/topic/archive |
| POST | `/api/v1/conversations/{id}/members` | Add members |
| DELETE | `/api/v1/conversations/{id}/members/{user_id}` | Remove member |
| PATCH | `/api/v1/conversations/{id}/members/{user_id}` | Update role / mute / archive |
| PUT | `/api/v1/conversations/{id}/policy` | Set retention/guest/moderation policy |

**Create conversation**

```http
POST /api/v1/conversations
Authorization: Bearer <jwt>
Idempotency-Key: c8f0…
Content-Type: application/json

{
  "type": "group",
  "name": "Design Team",
  "topic": "Product design coordination",
  "member_ids": ["7a2b…","9e31…"]
}
```

```http
HTTP/1.1 201 Created
Location: /api/v1/conversations/019…

{
  "id": "019…",
  "type": "group",
  "name": "Design Team",
  "topic": "Product design coordination",
  "members": [
    {"user_id":"<caller>","role":"channel_admin"},
    {"user_id":"7a2b…","role":"participant"},
    {"user_id":"9e31…","role":"participant"}
  ],
  "created_at": "2026-04-21T09:13:22.118Z"
}
```

Errors: `400 VALIDATION_FAILED` (bad member_ids), `403 AUTHZ_FORBIDDEN` (missing `create_conversation`), `409 RESOURCE_CONFLICT` (direct conversation already exists between the two users — returns existing id in `Location`).

### 9.6 Messaging Service — REST

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/conversations/{id}/messages` | Send a message |
| GET | `/api/v1/conversations/{id}/messages` | List messages (cursor-paged, reverse chronological) |
| GET | `/api/v1/messages/{id}` | Fetch single message |
| PATCH | `/api/v1/messages/{id}` | Edit (own, or admin) |
| DELETE | `/api/v1/messages/{id}` | Delete (policy-gated) |
| POST | `/api/v1/messages/{id}/reactions` | Add/remove reaction |
| POST | `/api/v1/messages/{id}/receipts/read` | Mark as read |
| GET | `/api/v1/conversations/{id}/search?q=...` | Full-text search within conversation |

**Send message**

```http
POST /api/v1/conversations/019.../messages
Authorization: Bearer <jwt>
Idempotency-Key: 8b2e…

{
  "body": "Kickoff at 10 AM?",
  "body_format": "markdown",
  "session_id": null,
  "parent_message_id": null,
  "mentions": [{"user_id":"7a2b…","offset":0,"length":5}],
  "attachment_ids": []
}
```

```http
HTTP/1.1 202 Accepted
Content-Type: application/json

{
  "id": "019…",
  "delivery_state": "pending",
  "created_at": "2026-04-21T09:14:01.221Z",
  "server_timestamp_ms": 1745220841221
}
```

The `202` response returns **before** WebSocket fan-out; `message.delivered` event arrives asynchronously. Idempotent retries with same `Idempotency-Key` return `200 OK` with original id.

### 9.7 Session Service — REST

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/sessions` | Create ad hoc or scheduled session |
| GET | `/api/v1/sessions/{id}` | Fetch session |
| PATCH | `/api/v1/sessions/{id}` | Update title/schedule |
| POST | `/api/v1/sessions/{id}/join` | Join session — returns join context |
| POST | `/api/v1/sessions/{id}/leave` | Leave session |
| POST | `/api/v1/sessions/{id}/end` | Host ends session |
| POST | `/api/v1/sessions/{id}/cancel` | Cancel scheduled session |
| POST | `/api/v1/sessions/{id}/members/{user_id}/kick` | Host kicks participant |
| GET | `/api/v1/sessions/{id}/members` | List members + participation state |

**Create ad hoc 1:1 session**

```http
POST /api/v1/sessions
{
  "session_type": "ad_hoc_1on1",
  "conversation_id": "019…",
  "invitee_user_id": "7a2b…",
  "policy": {"recording_enabled": false}
}
```

```http
HTTP/1.1 201 Created
{
  "id": "019…",
  "state": "pending_start",
  "conversation_id": "019…",
  "host_user_id": "<caller>",
  "media_room": {
    "provider": "livekit",
    "join_url": "https://livekit.connect.zoikotime/rtc",
    "access_token": "eyJhbGciOiJIUzI1NiJ9…",
    "expires_at": "2026-04-21T09:30:00Z"
  }
}
```

Tokens are single-use per join cycle and carry the minimum LiveKit grants (`roomJoin`, `room=<room_id>`, `canPublish`, `canSubscribe`). Server NEVER embeds tenant claims in LiveKit tokens.

### 9.8 Media Orchestration — REST

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/media/rooms` | Internal-only: create media room for a session |
| POST | `/api/v1/media/rooms/{session_id}/tokens` | Issue a participant token (re-issuable) |
| DELETE | `/api/v1/media/rooms/{session_id}` | Internal: destroy media room |
| GET | `/api/v1/media/rooms/{session_id}/telemetry` | Pull recent quality events |

### 9.9 Attachment Service — REST

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/attachments/initiate-upload` | Get GCS signed PUT URL |
| POST | `/api/v1/attachments/{id}/finalize` | Mark upload complete — triggers virus scan |
| GET | `/api/v1/attachments/{id}` | Metadata + short-lived download URL |
| GET | `/api/v1/attachments/{id}/thumbnail` | Short-lived thumbnail URL |

**Initiate upload**

```http
POST /api/v1/attachments/initiate-upload
{
  "filename": "design_v3.pdf",
  "content_type": "application/pdf",
  "size_bytes": 3145728,
  "sha256": "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
  "conversation_id": "019…"
}
```

```http
HTTP/1.1 201 Created
{
  "attachment_id": "019…",
  "upload_url": "https://storage.googleapis.com/connect-prod-attachments/019…?X-Goog-Algorithm=…",
  "upload_headers": {"x-goog-content-length-range":"0,3145728"},
  "expires_at": "2026-04-21T09:28:00Z"
}
```

### 9.10 Notification Service — REST

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/notifications` | List notifications for current user |
| POST | `/api/v1/notifications/{id}/ack` | Mark as acknowledged |
| GET | `/api/v1/notifications/preferences` | Get preferences |
| PUT | `/api/v1/notifications/preferences` | Update preferences |

### 9.11 Recording & Compliance

| Method | Path | Purpose | Permission |
|---|---|---|---|
| POST | `/api/v1/sessions/{id}/recording/start` | Begin recording (consent dispatched) | `start_recording` |
| POST | `/api/v1/sessions/{id}/recording/stop` | Stop recording | `stop_recording` |
| GET | `/api/v1/recordings/{id}` | Get recording metadata + artifacts | owner OR `compliance_admin` |
| POST | `/api/v1/recordings/{id}/download` | Issue short-lived download URL | same as above, logged |
| POST | `/api/v1/compliance/exports` | Request export package | `export_session_log` |
| GET | `/api/v1/compliance/exports/{id}` | Poll export status + download | requester OR `compliance_admin` |
| POST | `/api/v1/compliance/legal-holds` | Apply legal hold | `apply_legal_hold` |
| DELETE | `/api/v1/compliance/legal-holds/{id}` | Release legal hold | `apply_legal_hold` |
| GET | `/api/v1/compliance/audit` | Query audit events | `access_compliance_history` |

### 9.12 WebSocket Endpoint — `/ws/v1`

```
wss://connect.zoikotime/ws/v1?token=<jwt>
```

**Handshake:** Gateway validates JWT during WS `CONNECT` (§12.3). On success server emits `connection.ready`. Client MAY send `room.subscribe` frames to join additional rooms (gateway confirms membership against Conversation/Session service).

**Frame envelope (all WS events):**

```json
{
  "id":             "019…",
  "type":           "message.sent",
  "version":        "1",
  "tenant_id":      "<uuid>",
  "correlation_id": "<uuid>",
  "emitted_at":     "2026-04-21T09:14:01.221Z",
  "payload":        { /* event-specific, see §10 */ }
}
```

**Heartbeat:** Client sends `{"type":"ping"}` every 25 s. Server responds `{"type":"pong","server_ms":…}`. Missed 3 pongs → client reconnect.

**Acks for critical frames:** Outbound events in the `message.*` and `session.*` families include a server-side id. Client responds with `{"type":"ack","event_id":"…"}` within 5 s; unacked events are redelivered once with `redelivery:true`. Third failure lands in per-connection DLQ log and is dropped.

### 9.13 WebSocket Client→Server Frames

| Type | Purpose |
|---|---|
| `auth.refresh` | Refresh JWT on the open socket (before expiry) |
| `room.subscribe` / `room.unsubscribe` | Opt into rooms: `conversation:<id>` or `session:<id>` |
| `typing.start` / `typing.stop` | Typing indicators |
| `presence.update` | Client-asserted presence change (validated) |
| `signal.offer` / `signal.answer` / `signal.ice_candidate` | WebRTC signaling (1:1) |
| `ping` | Heartbeat |
| `ack` | Ack an inbound server event |

### 9.14 WebSocket Server→Client Frames

All events in **§10 Event Contracts** are delivered over this channel.

---

## 10. Event Contracts

All real-time events conform to the envelope in §9.12. `version` is a **string major version**; additive changes stay on the same major, breaking changes bump major and the gateway serves at least the previous major for one release window.

Versioning strategy:

- **MAJOR** bump = breaking (field removed, type changed, semantics changed). Gateway runs N and N-1 in parallel during rollouts.
- **MINOR** payload extensions are additive (new optional fields). Clients ignore unknown fields.
- Deprecated events: gateway emits `X-Event-Deprecated: true` and logs a metric. Removed only after ≥ 60-day sunset.

### 10.1 Event Catalog (with durability)

| Event | Plane | Durable? | Summary |
|---|---|---|---|
| `session.created` | Control | ✅ | Session record created |
| `session.started` | Control | ✅ | First join → state `active` |
| `session.ended` | Control | ✅ | Host or policy ends session |
| `session.cancelled` | Control | ✅ | Scheduled session cancelled |
| `session.member.joined` | Control | ✅ | Participant joined |
| `session.member.left` | Control | ✅ | Participant left or DC |
| `session.member.kicked` | Control | ✅ | Host removed participant |
| `signal.offer` | Media | ❌ | WebRTC offer (1:1) |
| `signal.answer` | Media | ❌ | WebRTC answer (1:1) |
| `signal.ice_candidate` | Media | ❌ | ICE exchange (1:1) |
| `message.sent` | Messaging | ✅ | Message persisted |
| `message.delivered` | Messaging | ✅ | Delivered to recipient device |
| `message.read` | Messaging | ✅ | Recipient viewed |
| `message.edited` | Messaging | ✅ | Body modified; edit recorded |
| `message.deleted` | Messaging | ✅ | Policy-gated delete |
| `message.reacted` | Messaging | ✅ | Reaction add/remove |
| `presence.updated` | Presence | ❌ | User availability change |
| `typing.started` | Presence | ❌ | Composing |
| `typing.stopped` | Presence | ❌ | Stopped composing |
| `call.ringing` | Control | ✅ | Inbound call alert |
| `call.missed` | Control | ✅ | Timeout without accept |
| `mention.created` | Control | ✅ | Mention notification queued |
| `recording.started` | Compliance | ✅ | Recording began, consent dispatched |
| `recording.ended` | Compliance | ✅ | Artifact pipeline triggered |
| `retention.executed` | Compliance | ✅ | Retention job done |
| `export.generated` | Compliance | ✅ | Export package built |
| `legalhold.applied` | Compliance | ✅ | Legal hold placed |
| `legalhold.released` | Compliance | ✅ | Legal hold removed |

### 10.2 JSON Schemas

All schemas use [JSON Schema 2020-12](https://json-schema.org/draft/2020-12). The common envelope is defined once:

```json
{
  "$id": "https://connect.zoikotime/schemas/envelope-v1.json",
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "EventEnvelope",
  "type": "object",
  "required": ["id","type","version","tenant_id","correlation_id","emitted_at","payload"],
  "properties": {
    "id":             {"type":"string","format":"uuid"},
    "type":           {"type":"string"},
    "version":        {"type":"string","pattern":"^[0-9]+$"},
    "tenant_id":      {"type":"string","format":"uuid"},
    "correlation_id": {"type":"string","format":"uuid"},
    "emitted_at":     {"type":"string","format":"date-time"},
    "payload":        {"type":"object"}
  },
  "additionalProperties": false
}
```

#### `message.sent` v1

```json
{
  "$id": "https://connect.zoikotime/schemas/message.sent.v1.json",
  "title": "message.sent",
  "type": "object",
  "required": ["message_id","conversation_id","sender_id","body","body_format","created_at"],
  "properties": {
    "message_id":       {"type":"string","format":"uuid"},
    "conversation_id":  {"type":"string","format":"uuid"},
    "session_id":       {"type":["string","null"],"format":"uuid"},
    "sender_id":        {"type":"string","format":"uuid"},
    "parent_message_id":{"type":["string","null"],"format":"uuid"},
    "body":             {"type":"string","maxLength":32768},
    "body_format":      {"enum":["plain","markdown","rich"]},
    "mentions":         {"type":"array","items":{"type":"object",
                          "required":["user_id","offset","length"],
                          "properties":{
                            "user_id":{"type":"string","format":"uuid"},
                            "offset":{"type":"integer","minimum":0},
                            "length":{"type":"integer","minimum":1}}}},
    "attachment_ids":   {"type":"array","items":{"type":"string","format":"uuid"}},
    "created_at":       {"type":"string","format":"date-time"}
  },
  "additionalProperties": false
}
```

Example payload:

```json
{
  "id":"019…","type":"message.sent","version":"1",
  "tenant_id":"11111111-…","correlation_id":"22222222-…",
  "emitted_at":"2026-04-21T09:14:01.221Z",
  "payload":{
    "message_id":"019…",
    "conversation_id":"019…",
    "session_id":null,
    "sender_id":"7a2b…",
    "parent_message_id":null,
    "body":"Kickoff at 10 AM?",
    "body_format":"markdown",
    "mentions":[],
    "attachment_ids":[],
    "created_at":"2026-04-21T09:14:01.221Z"
  }
}
```

#### `session.member.joined` v1

```json
{
  "$id":"https://connect.zoikotime/schemas/session.member.joined.v1.json",
  "type":"object",
  "required":["session_id","user_id","role","joined_at"],
  "properties":{
    "session_id":{"type":"string","format":"uuid"},
    "user_id":   {"type":"string","format":"uuid"},
    "role":      {"enum":["host","co_host","presenter","participant","guest"]},
    "device_kind":{"enum":["web","mobile","desktop","phone"]},
    "joined_at": {"type":"string","format":"date-time"}
  },
  "additionalProperties": false
}
```

#### `call.ringing` v1

```json
{
  "type":"object",
  "required":["session_id","caller_id","recipient_id","expires_at"],
  "properties":{
    "session_id":  {"type":"string","format":"uuid"},
    "caller_id":   {"type":"string","format":"uuid"},
    "recipient_id":{"type":"string","format":"uuid"},
    "call_type":   {"enum":["audio","video"]},
    "expires_at":  {"type":"string","format":"date-time"}
  }
}
```

#### `presence.updated` v1

```json
{
  "type":"object",
  "required":["user_id","state"],
  "properties":{
    "user_id":{"type":"string","format":"uuid"},
    "state":  {"enum":["offline","online","away","busy","in_meeting","dnd"]},
    "since":  {"type":"string","format":"date-time"},
    "device": {"type":"string"}
  }
}
```

*(Schemas for every other event follow the same pattern; they live under `server/app/schemas/events/*.json` and are validated on both send and receive.)*

---

## 11. Sequence Flows

Legend: **C** = Client · **GW** = Gateway · **SS** = Session Svc · **CS** = Conversation Svc · **MS** = Messaging Svc · **MO** = Media Orchestration · **NS** = Notification Svc · **PS** = Presence Svc · **AS** = Compliance/Audit Svc · **PG** = PostgreSQL · **RD** = Redis · **LK** = LiveKit

### 11.1 Ad Hoc 1:1 Call from Direct Chat

```
 1. C    -> GW:  POST /api/v1/sessions  {type:ad_hoc_1on1, invitee}
 2. GW   -> SS:  createSession(caller, invitee, conv_id)
 3. SS   -> PG:  INSERT connect_sessions (state=pending_start)
 4. SS   -> MO:  createMediaRoom(session_id)
 5. MO   -> LK:  CreateRoom(room_name=f"s_{session_id}")
 6. LK  --> MO:  {room_id}
 7. MO   -> PG:  INSERT connect_media_rooms
 8. MO   -> LK:  MintToken(caller, room_id, grants)
 9. MO  --> SS:  {access_token, room_url}
10. SS   -> AS:  emit AuditEvent(session.created)
11. SS   -> NS:  enqueue Notification(call.ringing, invitee)
12. NS   -> RD:  LPUSH notifications:<invitee>
13. NS   -> GW:  PUBLISH ws:user:<invitee> {type:call.ringing}
14. GW  --> C(invitee): call.ringing frame
15. SS  --> C(caller):  201 Created + token + room_url
16. C(caller) -> LK:  WebRTC join with token (media only)
17. C(invitee) -> GW: POST /api/v1/sessions/{id}/join
18. GW   -> SS:  join(session_id, invitee)
19. SS   -> PG:  UPDATE connect_sessions SET state=active
20. SS   -> PG:  INSERT connect_session_members (joined_at)
21. SS   -> PS:  setPresence(invitee, in_meeting)
22. SS   -> AS:  emit AuditEvent(session.started, session.member.joined)
23. SS   -> GW:  PUBLISH ws:session:<id> {type:session.member.joined}
24. GW  --> C(all): session.member.joined
25. [in-call chat: §11.3 flow using session_id on messages]
26. C(either) -> GW: POST /api/v1/sessions/{id}/leave
27. GW   -> SS:  leave(...)
28. SS   -> PG:  UPDATE session_members SET left_at
29. SS   -> SS:  if last participant → state=ended
30. SS   -> MO:  destroyMediaRoom(session_id)
31. MO   -> LK:  DeleteRoom(room_id)
32. SS   -> AS:  emit AuditEvent(session.member.left, session.ended)
33. SS   -> GW:  PUBLISH ws:session:<id> {type:session.ended}
```

### 11.2 Group Meeting from Group Channel

```
 1. C(host) -> GW:  POST /api/v1/sessions {type:group_meeting, conversation_id}
 2. GW   -> SS:  createSession
 3. SS   -> CS:  fetchMembers(conversation_id)        # for invitation list
 4. SS   -> PG:  INSERT session + session_members (invitation_state=invited) for each
 5. SS   -> MO:  createMediaRoom
 6. MO   -> LK:  CreateRoom + MintToken(host)
 7. SS   -> NS:  bulk enqueue call.ringing for members
 8. NS   -> GW:  PUBLISH ws:user:<each> call.ringing
 9. GW  --> C(members): call.ringing
10. Member accepts:
    C -> GW: POST /api/v1/sessions/{id}/join
    GW -> SS: join
    SS -> MO: MintToken(member)
    SS -> PG: UPDATE session_members SET invitation_state=accepted, joined_at
    SS -> AS: emit session.member.joined
    SS -> GW: PUBLISH ws:session:<id> session.member.joined
    GW --> C(all in room): broadcast
11. Repeat for each member. First join sets session state=active.
12. In-session chat (§11.3) carries session_id on each message.
13. Recording (optional):
    C(host) -> GW -> Recording Svc -> LK (start egress)
    Recording Svc -> PG: INSERT connect_recordings (state=recording)
    Recording Svc -> AS: emit recording.started + consent dispatch to members
14. Host ends:
    C(host) -> GW: POST /api/v1/sessions/{id}/end
    SS -> MO: destroyMediaRoom
    Recording Svc -> LK: StopEgress → artifact pipeline
    SS -> PG: UPDATE state=ended
    SS -> AS: emit session.ended
    SS -> GW: broadcast session.ended
```

### 11.3 Message Send (persistent chat, with in-session context)

```
 1. C -> GW:  POST /api/v1/conversations/{id}/messages (Idempotency-Key)
 2. GW -> GW: validate JWT + rate limit + tenant check
 3. GW -> MS: sendMessage(conv_id, body, session_id?, attachment_ids?)
 4. MS -> RD: check idempotency key
 5. MS -> PG: INSERT connect_messages (delivery_state=pending)
 6. MS -> PG: INSERT connect_attachment_links (if any)
 7. MS -> AS: emit AuditEvent(message.sent)  [async via event bus]
 8. MS --> GW: 202 Accepted (returns message id)
 9. GW --> C(sender): 202 response
10. MS -> GW: PUBLISH ws:conversation:<id> {type:message.sent, payload:{...}}
11. GW fan-out to all connected recipients in that conversation room
12. Recipient client ACKs:
    C -> GW: {type:ack, event_id:...}
    MS -> PG: UPDATE connect_messages SET delivery_state=delivered
    MS -> PG: UPSERT connect_message_receipts (delivered_at)
13. Recipient reads:
    C -> GW: POST /api/v1/messages/{id}/receipts/read
    MS -> PG: UPDATE receipts.read_at
    MS -> GW: broadcast message.read
14. Search indexer:
    outbox → async worker → OpenSearch index (§16.3 event bus pattern)
```

### 11.4 Missed Call

```
 1. Caller initiates Session (§11.1 steps 1-15)
 2. NS schedules missed-call timer: RD SET key=missed:<session>:<invitee> EX=30
 3. Ringing dispatched to invitee
 4. Invitee does NOT accept within 30 s:
     ARQ worker fires on TTL expiry OR scheduled job polls.
 5. Worker -> SS: markMissed(session_id, invitee_id)
 6. SS -> PG:
      UPDATE session_members SET invitation_state='declined', left_reason='timeout'
      UPDATE sessions SET state='ended', actual_end=now()
 7. SS -> MO: destroyMediaRoom
 8. SS -> MS: insertSystemMessage(conversation_id, "Missed call from <caller>")
 9. SS -> AS: emit AuditEvent(call.missed)
10. SS -> NS: emit call.missed notification (push/email per prefs)
11. NS -> GW: PUBLISH ws:user:<invitee> call.missed
12. PS:  caller presence returns to pre-call state.
```

---

## 12. Authorization & Security

### 12.1 JWT Structure

Signed with **RS256** using keys rotated monthly (stored in Secret Manager; public JWKS served at `https://connect.zoikotime/.well-known/jwks.json`).

```json
{
  "iss":   "https://auth.zoikotime",
  "sub":   "019…",                  // user id
  "aud":   "connect.zoikotime",
  "tenant_id": "019…",
  "roles":     ["participant","session_host"],
  "scopes":    ["read:messages","write:messages","manage:channel"],
  "device_id": "01JHX…",
  "iat":   1745218000,
  "exp":   1745221600,               // 1 h access token
  "nbf":   1745218000,
  "jti":   "01JHX…"                  // for revocation list
}
```

Refresh tokens (opaque, stored server-side in Redis with rotation) live 14 days. Access tokens are never stored client-side in `localStorage` — use `sessionStorage` or in-memory with silent refresh via refresh-token cookie (HttpOnly, Secure, SameSite=Strict).

### 12.2 Token Validation Flow (REST)

```
Request arrives → Middleware: JwtAuthMiddleware
  1. Extract Authorization: Bearer <token>  (401 AUTH_INVALID_TOKEN if missing)
  2. Decode JWT header → pick kid → load public key from JWKS cache (5 min TTL)
  3. Verify signature + exp + nbf + aud + iss  (401 AUTH_EXPIRED on exp)
  4. Check jti against revocation set in Redis  (401 AUTH_INVALID_TOKEN if revoked)
  5. Materialize RequestContext(user_id, tenant_id, roles, scopes, device_id, correlation_id)
  6. Attach to request.state; pass to next handler
```

### 12.3 Token Validation Flow (WebSocket)

```
wss://.../ws/v1?token=<jwt>
  CONNECT:
    1. Parse token from query OR first 'auth' frame
    2. Same validation chain as REST
    3. If invalid: close with code 4001 AUTH_INVALID_TOKEN
    4. Register connection in Redis: sockets:<tenant>:<user> = {gateway_id, conn_id, expires}
    5. Subscribe gateway to Redis pub/sub channels:
         ws:user:<user_id>
         ws:conversation:<id>   (on room.subscribe)
         ws:session:<id>        (on room.subscribe)
  Token refresh:
    Client sends {type:'auth.refresh', token:'...'} before exp.
    Gateway re-validates; on failure sends {type:'auth.expired'} and closes with 4002.
  Disconnect:
    On WS close: gateway removes Redis registration, updates PS (presence→offline after 30 s grace).
```

### 12.4 Tenant Isolation Enforcement

Three defensive layers, all three required:

1. **Application layer** — every service's base repository prefixes WHERE clauses with `tenant_id = %s` from `RequestContext.tenant_id`. Linting rule (`no_raw_sql_without_tenant`) in code review.
2. **Database layer** — Postgres Row-Level Security policies on all `connect_*` tables where workloads permit the planner cost:
   ```sql
   ALTER TABLE connect.connect_messages ENABLE ROW LEVEL SECURITY;
   CREATE POLICY tenant_isolation ON connect.connect_messages
     USING (tenant_id = current_setting('app.tenant_id')::uuid);
   ```
   Session variable `app.tenant_id` is SET by the connection pool at lease time.
3. **Event bus layer** — every event carries `tenant_id`; subscribers reject cross-tenant payloads and emit a P0 security metric.

### 12.5 Authorization Middleware Design

Pattern: FastAPI dependency injection returning `RequestContext`, composed with a `Permission` guard.

```python
# server/app/core/auth.py
from fastapi import Depends, HTTPException, Request
from .context import RequestContext

async def require_context(request: Request) -> RequestContext:
    ctx = request.state.ctx  # populated by JwtAuthMiddleware
    if ctx is None:
        raise HTTPException(401, "AUTH_INVALID_TOKEN")
    return ctx

def require_permission(*perms: str):
    async def _dep(ctx: RequestContext = Depends(require_context)) -> RequestContext:
        missing = [p for p in perms if p not in ctx.effective_permissions]
        if missing:
            raise HTTPException(403, {"code":"AUTHZ_FORBIDDEN",
                                      "detail":f"missing: {missing}"})
        return ctx
    return _dep

# usage:
# @router.post("/conversations", dependencies=[Depends(require_permission("create_conversation"))])
```

Permissions resolved from the role catalog in §9 (spec v2), augmented with per-resource ACLs (e.g., `join_session` requires user to be on `session_members` OR have `workspace_admin`). Per-resource checks live in the service, not the middleware.

### 12.6 Secure Defaults

- TLS 1.2+ only at ingress; HSTS (`max-age=63072000; preload`).
- CORS allowlist per env (not `*`).
- CSRF: not needed for pure-JWT API; if cookies are adopted, add double-submit token.
- Content Security Policy (frontend): `default-src 'self'; connect-src 'self' wss://…;`
- Signed GCS URLs: ≤ 15 min TTL.
- Passwords (where handled by Auth upstream): Argon2id, ≥ 12 chars.
- All secrets in **Secret Manager**, injected at runtime via Workload Identity. Never in images, env files, or repo.

---

## 13. Media Architecture

### 13.1 SFU Requirement

Group meetings **must not** use mesh peer-to-peer WebRTC. Mesh produces O(n²) upload bandwidth per participant and degrades severely past three participants. LiveKit is the initial SFU; the `MediaRoomProvider` abstraction must be swappable to Agora/Daily/Twilio/Janus without domain-model changes.

### 13.2 Capabilities Matrix

| Capability | Phase | Implementation |
|---|---|---|
| Audio 1:1/group | 1 | OPUS, adaptive bitrate, PLC |
| Video camera | 1 | VP8/VP9/H.264 simulcast, bandwidth adaptation |
| Screen share | 1 | Role-gated; single presenter |
| Mute/unmute | 1 | Client + host override |
| Camera on/off | 1 | Client only (privacy: host cannot force on) |
| Quality adaptation | 1 | Simulcast layer selection by subscriber |
| Reconnect | 1 | Client-initiated with session preservation |
| Noise suppression | 2 | Client-side (insertable streams) |
| Virtual backgrounds | 2 | Client-side ML |
| Breakout rooms | 3 | Sub-session model in Session Service |
| Live transcription | 3 | SFU audio tap → transcription pipeline → Artifact Service |

### 13.3 Platform Ownership (never delegated to SFU)

- Session identity and lifecycle
- Room authorization and token issuance (server-generated only)
- Participant role and permission enforcement
- Room policy (recording consent, max participants, lobby)
- Compliance and retention obligations
- All audit and access logs

### 13.4 LiveKit Integration Points

| Platform op | LiveKit call | Notes |
|---|---|---|
| Create media room | `RoomService.CreateRoom(name=f"s_{session_id}", max_participants)` | Name is derived from session id so recovery is idempotent |
| Mint token | `AccessToken(api_key, api_secret).add_grant(RoomJoin{room, canPublish, canSubscribe}).set_identity(user_id).to_jwt()` | TTL = min(session scheduled_end+1h, 6h) |
| Destroy room | `RoomService.DeleteRoom(name)` | Called on session end |
| Recording | `EgressClient.StartRoomCompositeEgress(...)` to GCS | Only after `recording.started` audit event written |

LiveKit webhook endpoint `/internal/livekit/webhook` receives room/participant events and emits `connect_media_room_events`. Webhook signature verified (`Authorization: <token>` signed by LiveKit).

---

## 14. Service Level Objectives

| Metric | Target | Alert | Priority |
|---|---|---|---|
| Message delivery (p99) | < 300 ms | ≥ 500 ms | P0 |
| WebSocket connection setup | < 500 ms | ≥ 1 s | P0 |
| Call setup latency (p95) | < 2 s | ≥ 4 s | P0 |
| Gateway availability | 99.95% | < 99.9% | P0 |
| Media join success rate | ≥ 99.5% | < 99.0% | P0 |
| Attachment upload success | ≥ 99.9% | < 99.5% | P1 |
| Notification delivery (p99) | < 5 s | ≥ 10 s | P1 |
| Search query response (p95) | < 500 ms | ≥ 1 s | P1 |
| Recording job success | ≥ 99.0% | < 98.0% | P1 |
| Audit event write (p99) | < 200 ms | ≥ 500 ms | P0 |

---

## 15. Observability Implementation

### 15.1 Structured JSON Log Format

Every log line is a single JSON object on one line:

```json
{
  "ts": "2026-04-21T09:14:01.221Z",
  "level": "INFO",
  "service": "messaging-svc",
  "env": "prod",
  "version": "2026.04.21-a4f8",
  "host": "messaging-7b9d-4kq2p",
  "correlation_id": "01JHX5K1AQ9Z0EPY4XGQ5M6N7B",
  "tenant_id": "11111111-2222-3333-4444-555555555555",
  "user_id": "7a2b…",
  "trace_id": "5a1e4d5b4c3b2a1f5a1e4d5b4c3b2a1f",
  "span_id": "5a1e4d5b4c3b2a1f",
  "event": "message.sent",
  "message": "persisted inbound message",
  "duration_ms": 42,
  "resource": {"type":"message","id":"019…"}
}
```

Logger config in [server/app/core/logging.py](../server/app/core/logging.py):

```python
import logging, json, contextvars
from pythonjsonlogger import jsonlogger

request_ctx: contextvars.ContextVar = contextvars.ContextVar("request_ctx", default=None)

class ContextFilter(logging.Filter):
    def filter(self, record):
        ctx = request_ctx.get()
        if ctx:
            record.correlation_id = ctx.correlation_id
            record.tenant_id = str(ctx.tenant_id)
            record.user_id = str(ctx.user_id) if ctx.user_id else None
        return True

def setup_logging(service: str, env: str, version: str):
    handler = logging.StreamHandler()
    handler.setFormatter(jsonlogger.JsonFormatter(
        "%(asctime)s %(levelname)s %(name)s %(message)s",
        rename_fields={"asctime":"ts","levelname":"level","name":"logger"}))
    handler.addFilter(ContextFilter())
    root = logging.getLogger()
    root.handlers[:] = [handler]
    root.setLevel(logging.INFO)
    logging.getLogger().info("boot", extra={"service":service,"env":env,"version":version})
```

Destination: **stdout** in containers. **Cloud Logging** agent ingests automatically on GKE. Log-based metrics + log sinks to BigQuery for long-term audit (§18).

### 15.2 Metrics Naming Convention

Format: `<domain>_<resource>_<signal>_<unit>`

Examples:

| Metric | Type | Labels |
|---|---|---|
| `connect_messages_send_latency_ms` | histogram | tenant_tier, plane, outcome |
| `connect_messages_send_total` | counter | tenant_tier, outcome, body_format |
| `connect_ws_connections_active` | gauge | gateway_id, tenant_tier |
| `connect_ws_connect_latency_ms` | histogram | gateway_id, outcome |
| `connect_session_setup_latency_ms` | histogram | session_type, outcome |
| `connect_media_join_total` | counter | provider, outcome, failure_reason |
| `connect_attachment_upload_total` | counter | scan_state, content_type_class |
| `connect_notifications_delivery_latency_ms` | histogram | channel, event_class |
| `connect_audit_write_latency_ms` | histogram | plane, event_type |
| `connect_search_query_latency_ms` | histogram | index, outcome |
| `connect_dlq_depth` | gauge | queue_name |

Histograms use powers-of-two buckets: `0.5, 1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000` ms.

Cardinality budget: **no** free-form strings in labels. `tenant_id` is NOT a label (too high-cardinality); `tenant_tier` is.

### 15.3 Trace Propagation (W3C Trace Context)

OpenTelemetry auto-instrumentation for FastAPI + SQLAlchemy + Redis + httpx. Incoming `traceparent` header honored; outgoing propagated.

```python
# server/app/core/tracing.py
from opentelemetry import trace
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry.instrumentation.redis import RedisInstrumentor
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor

def setup_tracing(app, engine, service: str, env: str):
    provider = TracerProvider(resource=Resource.create({
        "service.name": service,
        "deployment.environment": env,
    }))
    provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter()))  # Cloud Trace via OTLP
    trace.set_tracer_provider(provider)
    FastAPIInstrumentor.instrument_app(app)
    SQLAlchemyInstrumentor().instrument(engine=engine)
    RedisInstrumentor().instrument()
    HTTPXClientInstrumentor().instrument()
```

Example propagation — inbound request arrives with `traceparent: 00-5a1e4d5b4c3b2a1f5a1e4d5b4c3b2a1f-5a1e4d5b4c3b2a1f-01`; the Messaging service creates a child span `message.send`, publishes to Redis pub/sub with headers `{traceparent: 00-5a1e…-<new_span>-01}`; gateway consumer continues the trace when fanning out.

### 15.4 Required Tooling Checklist

- ✅ Structured JSON logs with `correlation_id`, `tenant_id`, `service`, `event_type` on every line.
- ✅ OTel distributed traces propagated across REST, WS, and internal event bus.
- ✅ Prometheus/Cloud Monitoring dashboards per SLO (§14).
- ✅ Alerting (PagerDuty / Cloud Monitoring alert policies) with clear severity & runbook links.
- ✅ Audit-log pipeline independently observable (its own latency & DLQ metrics).

### 15.5 Dashboards (minimum set)

1. **Gateway Health** — WS connect rate, reconnect rate, active connections, 4xx/5xx rate.
2. **Messaging Health** — send latency, delivery-state distribution, DLQ depth, search index lag.
3. **Session Health** — setup latency, join success, media room failure reason breakdown.
4. **Audit & Compliance** — audit write p99, export job success, retention job last-run age.
5. **Infra** — Cloud SQL CPU/IOPS/replication lag, Memorystore memory, GKE pod restarts, Cloud Tasks queue depth.

---

## 16. Failure Handling Implementation

### 16.1 Retry Strategy

All inter-service calls and external dependencies use a common `RetryPolicy`:

| Policy | Applied to | Attempts | Backoff |
|---|---|---|---|
| `critical_read` | Auth, session fetch | 2 | 50 ms, 150 ms |
| `critical_write` | Session create, recording control | 3 | 100 ms, 300 ms, 900 ms (jitter ±30%) |
| `idempotent_async` | Notification dispatch, indexing | 6 | 1s, 3s, 9s, 27s, 81s, 240s (capped) |
| `non_retriable` | Anything returning 4xx (except 429) | 0 | — |

Implementation with `tenacity`:

```python
# server/app/core/retry.py
from tenacity import retry, stop_after_attempt, wait_exponential_jitter, retry_if_exception_type
from .errors import TransientDependencyError

critical_write = retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential_jitter(initial=0.1, max=0.9, jitter=0.03),
    retry=retry_if_exception_type(TransientDependencyError),
    reraise=True,
)
```

### 16.2 Circuit Breaker

Every outbound HTTP client wraps in a breaker (`aiobreaker` or `purgatory`). Trip thresholds:

| Dependency | Failure rate | Sample window | Open → Half-open delay |
|---|---|---|---|
| LiveKit API | 50% of 20 | 30 s | 20 s |
| OpenSearch | 40% of 50 | 60 s | 30 s |
| Email provider | 60% of 20 | 120 s | 60 s |
| Auth service (intra) | 30% of 20 | 30 s | 10 s |

When open: fail fast (`503 DEPENDENCY_UNAVAILABLE`). Downgrade rules:

- **LiveKit open:** Reject new session creation with `503`. Active sessions continue. Chat unaffected.
- **OpenSearch open:** Search endpoint returns `503` with `Retry-After`. History fetch via Postgres unaffected.
- **Email provider open:** Queue to Cloud Tasks with long delay; WS/push paths unaffected.

### 16.3 Event Bus & Dead-Letter Queues

Event bus: **Redis Streams** for in-cluster low-latency events, + **Pub/Sub (GCP)** for cross-service durable delivery of audit/compliance events.

For every durable event:

```
Producer:
  1. Write domain row in PG (transaction A).
  2. Insert outbox row (connect_outbox) in same transaction.
  3. COMMIT.
Outbox Relay (background worker):
  4. Poll pending outbox rows.
  5. Publish to Redis Stream / Pub/Sub with traceparent + idempotency key.
  6. Mark outbox row delivered.
Consumer:
  7. Idempotent processing keyed by event id.
  8. On transient failure → XADD redelivery stream with backoff delay.
  9. After maxDelivery (default 8) → move to DLQ topic.
```

Outbox table:

```sql
CREATE TABLE connect.connect_outbox (
    id              UUID PRIMARY KEY,
    tenant_id       UUID NOT NULL,
    topic           VARCHAR(128) NOT NULL,
    key             VARCHAR(256) NOT NULL,
    payload         JSONB NOT NULL,
    headers         JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    delivered_at    TIMESTAMPTZ,
    attempts        INTEGER NOT NULL DEFAULT 0,
    last_error      TEXT
);
CREATE INDEX ix_outbox_pending ON connect.connect_outbox (created_at)
    WHERE delivered_at IS NULL;
```

DLQ queues:
- `dlq.notifications`
- `dlq.search_index`
- `dlq.audit_export`
- `dlq.recording_pipeline`

Each has a dashboard (§15.5) and an alert at depth > 100 or age > 10 min.

### 16.4 Timeouts

| Call | Read timeout | Connect timeout |
|---|---|---|
| PG (OLTP) | 3 s | 2 s |
| PG (search fallback) | 10 s | 2 s |
| Redis | 500 ms | 500 ms |
| LiveKit API | 5 s | 2 s |
| GCS signed URL gen | 2 s | 1 s |
| Intra-service HTTP | 3 s | 1 s |
| External webhook (notif delivery) | 10 s | 3 s |

Per-endpoint server response budget: 1.5 s (p99); beyond that, return `202 Accepted` and finish async.

### 16.5 Failure Mode Matrix (required behavior)

| Failure | Required Behavior |
|---|---|
| Participant drops connection | Marked `reconnecting`. Auto-rejoin attempted client-side. Session remains active until host action or all participants disconnect. |
| ICE negotiation failure | Retry via TURN fallback. After max retries → `session.member.left` emitted, participant marked `disconnected`. |
| Media room unavailable (SFU) | Session stays `active`. Chat continues. Notify participants. Media Orchestration retries room recreation with backoff. |
| Redis outage | Presence degrades (stale). WS fan-out degrades to single-instance. **No message loss, no session data loss.** Resumes on Redis recovery. |
| Delayed notification dispatch | Retry with exponential backoff. DLQ captures failures. Alert on DLQ depth. |
| Attachment scan delay | File held in `scan_state=pending`. Message delivered; download blocked until clean. Timeout > 5 min → admin alert. |
| Partial recording failure | Recording marked `state=partial`. Metadata + start/stop preserved. Alert if partial rate > 1%. |
| PG replica lag > 500 ms | Reads fall back to primary for affected paths. |

> **Golden rule:** If media fails, session control and chat remain fully coherent. No single-plane failure may cascade.

---

## 17. Reliability & Scaling Roadmap

| Stage | Architecture |
|---|---|
| **Phase 1 (Launch)** | Single-region GCP (us-central1). Cloud SQL HA (regional). Memorystore Standard. GCS for attachments. LiveKit managed or self-hosted in GKE. GKE cluster with horizontal gateway pods behind HTTPS L7 LB. Outbox + Redis Streams event bus. |
| **Phase 2 (Growth)** | Independent HPA per service. Dedicated ARQ worker fleet for recording, indexing, notifications. OpenSearch cluster with dedicated nodes. DLQ alerting tightened. Notification pipeline hardened (per-channel workers). |
| **Phase 3 (Enterprise)** | Regional data-residency variants (us-central1, europe-west1, asia-northeast1). Per-tenant retention policy engine. Tenant-dedicated GCS prefixes / CMEK on sensitive buckets. Gateway multi-region active-active with Global L7 LB + sticky-less design. External guest isolation. |

---

## 18. Compliance & Governance

### 18.1 Required Capabilities

- Configurable message and attachment retention **per conversation type and tenant**.
- Audit log export in JSON/CSV for any time range.
- Admin access logging (`connect_access_logs`) — user, timestamp, resource, justification.
- Legal hold API (`POST /compliance/legal-holds`) suspends retention on any scoped data set.
- Moderation events captured to audit trail.
- Recording access logs (`connect_recording_access_logs`) — who/when/IP-hash.
- Deletion and redaction workflows are distinct:
  - `deleted` → candidate for purge per retention policy
  - `redacted` → compliance-held, content replaced with tombstone, metadata retained

### 18.2 Persistence Classification

| Must Be Durable | May Be Transient | Must Be Policy-Configurable |
|---|---|---|
| Messages & edit history | Typing indicators | Message retention duration |
| Thread structure | Ringing status | Recording retention duration |
| Session metadata & meeting logs | Live presence cache | Delete behavior (purge vs. redact) |
| Participant join/leave timestamps | Ephemeral network hints | External guest access permissions |
| Notifications requiring audit | In-progress ICE candidates | In-call chat persistence after session end |
| Recording metadata | | |
| All admin actions | | |

### 18.3 Long-Term Audit Storage

- Primary: `connect_audit_events` in Cloud SQL (hot, 180 days).
- Sink: Log-router → BigQuery dataset `connect_audit_cold` partitioned by day. Retention: 7 years (or per tenant policy).
- Export: compliance exports draw from BOTH hot (recent) and cold (historical) sources.

---

## 19. Engineering Risks to Avoid

| Anti-Pattern | Correct Approach |
|---|---|
| Hard-coding SFU vendor concepts in domain | SFU room IDs/tokens live only in Media Orchestration. Session/Conversation/Compliance models contain no vendor concepts. |
| Storing attachment binaries in PostgreSQL | All binaries in GCS. PG stores metadata + storage keys only. |
| Delegating business logic to WS handlers | WS handlers are event routers. Business logic lives in domain services with explicit APIs. |
| Treating chat as ephemeral | Durable by default. Ephemeral only via explicit policy config. |
| Skipping audit for "internal" admin actions | Every admin action emits `AuditEvent`. No exemptions. |
| Recording without retention policy engine | Recording infrastructure without retention is not shippable. Retention is designed first. |
| Tying presence to a single socket instance | Presence resolved from Redis, propagated via pub/sub to all gateway pods. |
| Client-asserted tenant ID | `tenant_id` always from verified JWT. Client-supplied is rejected. |
| Mixing transient + durable state in same store | Redis = transient only. PG = durable only. Never commingle. |
| Unversioned real-time events | Every event carries `version`. Gateway runs current + previous during rolling deploys. |

---

## 20. Code Structure & Conventions

### 20.1 Backend — Python / FastAPI

```
server/
├── app/
│   ├── __init__.py
│   ├── main.py                      # app factory, router mounting, lifecycle
│   │
│   ├── core/                        # cross-cutting framework
│   │   ├── config.py                # Pydantic Settings (env-driven)
│   │   ├── context.py               # RequestContext, contextvars
│   │   ├── auth.py                  # JWT verify, deps, require_permission
│   │   ├── middleware.py            # correlation, error envelope, rate limit
│   │   ├── logging.py               # JSON logger + ContextFilter
│   │   ├── tracing.py               # OTel setup
│   │   ├── metrics.py               # Prometheus / OTel metrics
│   │   ├── db.py                    # SQLAlchemy async engine, session mgr
│   │   ├── redis.py                 # Redis client factory + pub/sub
│   │   ├── errors.py                # domain exceptions + HTTP mapping
│   │   ├── retry.py                 # retry policies (tenacity)
│   │   ├── breaker.py               # circuit breaker wrappers
│   │   └── idempotency.py           # Redis-backed dedupe
│   │
│   ├── api/                         # REST routers (thin controllers)
│   │   ├── v1/
│   │   │   ├── conversations.py
│   │   │   ├── messages.py
│   │   │   ├── sessions.py
│   │   │   ├── media.py
│   │   │   ├── attachments.py
│   │   │   ├── notifications.py
│   │   │   ├── recordings.py
│   │   │   └── compliance.py
│   │   └── internal/                # service-to-service + webhooks
│   │       └── livekit_webhook.py
│   │
│   ├── schemas/                     # Pydantic DTOs
│   │   ├── common.py
│   │   ├── conversations.py
│   │   ├── messages.py
│   │   ├── sessions.py
│   │   ├── attachments.py
│   │   ├── events/                  # JSON Schemas for WS events (10.2)
│   │   └── errors.py
│   │
│   ├── models/                      # SQLAlchemy ORM models
│   │   ├── base.py                  # StandardFields mixin
│   │   ├── conversation.py
│   │   ├── message.py
│   │   ├── session.py
│   │   ├── media.py
│   │   ├── attachment.py
│   │   ├── notification.py
│   │   ├── recording.py
│   │   ├── audit.py
│   │   └── outbox.py
│   │
│   ├── services/                    # domain services (business logic)
│   │   ├── conversation_service.py
│   │   ├── message_service.py
│   │   ├── session_service.py
│   │   ├── media_orchestration/
│   │   │   ├── provider.py          # MediaRoomProvider ABC
│   │   │   ├── livekit.py           # LiveKit implementation
│   │   │   └── service.py
│   │   ├── attachment_service.py
│   │   ├── notification_service.py
│   │   ├── recording_service.py
│   │   ├── presence_service.py
│   │   └── compliance_service.py
│   │
│   ├── repositories/                # data access (tenant-scoped)
│   │   ├── base.py                  # TenantScopedRepository
│   │   ├── conversations.py
│   │   ├── messages.py
│   │   └── …
│   │
│   ├── websocket/                   # WS gateway
│   │   ├── manager.py               # connection registry + Redis bridge
│   │   ├── router.py                # frame dispatch
│   │   ├── handlers/
│   │   │   ├── auth.py
│   │   │   ├── rooms.py
│   │   │   ├── typing.py
│   │   │   ├── signaling.py
│   │   │   └── presence.py
│   │   └── fanout.py                # Redis pub/sub bridge
│   │
│   ├── events/                      # event bus (outbox + streams)
│   │   ├── bus.py
│   │   ├── outbox_relay.py
│   │   └── subscribers/
│   │       ├── audit.py             # Compliance plane subscriber
│   │       └── search_indexer.py
│   │
│   ├── workers/                     # ARQ background tasks
│   │   ├── notifications.py
│   │   ├── retention.py
│   │   ├── recording_pipeline.py
│   │   ├── exports.py
│   │   └── search_index.py
│   │
│   └── integrations/                # external SDK adapters
│       ├── livekit_client.py
│       ├── gcs_client.py
│       ├── pubsub_client.py
│       └── email/
│
├── alembic/                         # migrations
│   └── versions/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── contract/                    # JSON-schema-validated event contracts
├── pyproject.toml
├── Dockerfile
└── requirements.txt
```

### 20.2 Naming Conventions (Python)

- Modules: `snake_case`. Files mirror public class: `conversation_service.py` → `class ConversationService`.
- DB tables: `connect_<plural_noun>`. Columns: `snake_case`, plain nouns.
- REST paths: `/api/v1/<plural-noun>` (kebab-case only if multi-word).
- WS event types: `<domain>.<noun>` or `<domain>.<noun>.<verb_past>` (e.g., `session.member.joined`).
- Env vars: `CONNECT_<AREA>_<NAME>` — e.g., `CONNECT_DB_URL`, `CONNECT_REDIS_URL`, `CONNECT_LIVEKIT_API_KEY`.
- Constants: `UPPER_SNAKE` at module top.

### 20.3 Module Boundaries

- **`api/`** is thin — validate, resolve context, delegate to service. No SQL, no business logic.
- **`services/`** owns transactions. Calls one or more repositories. Emits outbox events.
- **`repositories/`** wraps `AsyncSession`. Every query filters by `tenant_id`. No cross-service joins.
- **`models/`** = ORM only. No business methods (anemic models OK here).
- **`events/`** reads outbox; never called from request path.
- **`workers/`** are idempotent.

### 20.4 Tenant-Scoped Repository Base

```python
# server/app/repositories/base.py
from typing import TypeVar, Generic, Type
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.context import RequestContext

T = TypeVar("T")

class TenantScopedRepository(Generic[T]):
    model: Type[T]

    def __init__(self, session: AsyncSession, ctx: RequestContext):
        self.session = session
        self.ctx = ctx

    async def get(self, id_: str) -> T | None:
        stmt = select(self.model).where(
            self.model.id == id_,
            self.model.tenant_id == self.ctx.tenant_id,
        )
        return (await self.session.execute(stmt)).scalar_one_or_none()

    def _scoped(self):
        return select(self.model).where(self.model.tenant_id == self.ctx.tenant_id)
```

Lint rule: any `select(Model)` that isn't reached through `_scoped()` or explicitly filters by `tenant_id` fails `ruff` custom rule `C001` (implemented as a small `ast` plugin in `tools/lint/`).

### 20.5 Frontend — React + Vite (integration points)

```
client/src/
├── api/                      # REST + WS clients, codegen-optional
│   ├── rest.ts               # fetch wrapper w/ auth + correlation
│   ├── ws.ts                 # WS client w/ auto-reconnect + heartbeat
│   ├── endpoints/
│   │   ├── conversations.ts
│   │   ├── messages.ts
│   │   ├── sessions.ts
│   │   └── …
│   └── events.ts             # typed event dispatcher
├── components/               # (existing) shared UI
├── pages/                    # (existing) route-level views
├── context/                  # AuthContext, SocketContext, PresenceContext
├── hooks/                    # useConversation, useSession, usePresence
└── state/                    # store (Zustand/Redux) per domain
```

Frontend integration contract:

1. **Auth:** on login, store refresh cookie (HttpOnly) + in-memory access JWT. Silent refresh 2 min before `exp`.
2. **REST:** all calls set `Authorization`, `X-Correlation-Id`, `Idempotency-Key` (on POST).
3. **WS:** connect after auth resolves, subscribe to `conversation:<id>` / `session:<id>` rooms on mount, unsubscribe on unmount. ACK inbound `message.*` frames.
4. **Optimistic UI:** render pending message immediately keyed by `Idempotency-Key`; reconcile on `message.sent` with server id.
5. **Presence:** push `presence.update` + `typing.start/stop` on user actions; consume `presence.updated` for UI.
6. **Call flow:** after `POST /sessions`, hand the returned `access_token` to LiveKit client SDK; never parse or mutate it.

---

## 21. Deployment Architecture — GCP

### 21.1 Target Topology (Phase 1)

```
                  Internet
                     │
          ┌──────────▼───────────┐
          │  Cloud Armor (WAF)   │
          └──────────┬───────────┘
                     │
          ┌──────────▼───────────┐
          │ Global HTTPS L7 LB    │  (managed cert, HTTP→HTTPS redirect)
          │  URL map splits:      │
          │   /api/*  → api-svc   │
          │   /ws/*   → ws-svc    │
          │   /static → CDN+GCS   │
          └──────────┬───────────┘
                     │
             ┌───────▼────────┐
             │  GKE Autopilot │  (regional, us-central1)
             │                │
             │  Deployments:  │
             │   - gateway    │  (HPA 3-30, WS sticky-less via Redis)
             │   - conversation-svc
             │   - messaging-svc
             │   - session-svc
             │   - media-orch-svc
             │   - attachment-svc
             │   - notification-svc
             │   - recording-svc
             │   - compliance-svc
             │   - presence-svc
             │   - workers (ARQ pool)
             │   - outbox-relay
             │   - livekit (optional self-host)
             │   - opensearch (3-node)
             └────────────────┘
                     │
   ┌─────────────────┼────────────────────────┐
   │                 │                        │
┌──▼─────────┐  ┌────▼────────┐   ┌──────────▼────────┐
│ Cloud SQL  │  │ Memorystore │   │ Google Cloud      │
│ for PG 15  │  │ Redis 7     │   │ Storage (GCS)     │
│ Regional HA│  │ Standard HA │   │ buckets:          │
│ + read     │  │ + pub/sub   │   │  connect-attach-  │
│ replica    │  │ + streams   │   │    ments          │
└────────────┘  └─────────────┘   │  connect-record-  │
                                  │    ings           │
                                  │  connect-exports  │
                                  └───────────────────┘

┌──────────────────┐   ┌────────────────┐   ┌─────────────────┐
│ Artifact Registry│   │ Secret Manager │   │ Cloud Logging / │
│ (container images)│  │ (runtime keys) │   │   Trace / Mon.  │
└──────────────────┘   └────────────────┘   └─────────────────┘

┌────────────────────────────────┐
│ BigQuery: connect_audit_cold   │  ← Log Router sink from Cloud Logging
│ (7-yr audit retention)         │
└────────────────────────────────┘
```

### 21.2 Compute — GKE Autopilot

- **Why GKE, not Cloud Run:** long-lived WebSocket connections, multi-service mesh, internal pub/sub, opensearch colocation.
- **Cluster:** Regional Autopilot (3 zones). Private nodes, public control plane with authorized networks.
- **Workload Identity** for pod-to-GCP-API auth (no service-account keys).
- **Ingress:** GKE Gateway API + `gcp-global-external-managed` LB.
- **HPA:** CPU 60% + custom metric `connect_ws_connections_active` for gateway.

Example gateway `Deployment` excerpt:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata: {name: connect-gateway, namespace: connect}
spec:
  replicas: 3
  selector: {matchLabels: {app: connect-gateway}}
  template:
    metadata:
      labels: {app: connect-gateway}
      annotations:
        iam.gke.io/gcp-service-account: connect-gateway@PROJECT.iam.gserviceaccount.com
    spec:
      serviceAccountName: connect-gateway
      containers:
      - name: gateway
        image: us-central1-docker.pkg.dev/PROJECT/connect/gateway:2026.04.21-a4f8
        ports: [{containerPort: 8080, name: http}]
        env:
          - {name: CONNECT_ENV, value: prod}
          - {name: CONNECT_DB_URL, valueFrom: {secretKeyRef: {name: connect-db-url, key: url}}}
          - {name: CONNECT_REDIS_URL, valueFrom: {secretKeyRef: {name: connect-redis-url, key: url}}}
        readinessProbe: {httpGet: {path: /healthz/ready, port: http}, periodSeconds: 5}
        livenessProbe:  {httpGet: {path: /healthz/live,  port: http}, periodSeconds: 15}
        resources:
          requests: {cpu: 250m, memory: 512Mi}
          limits:   {cpu: 1,    memory: 1Gi}
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata: {name: connect-gateway, namespace: connect}
spec:
  scaleTargetRef: {apiVersion: apps/v1, kind: Deployment, name: connect-gateway}
  minReplicas: 3
  maxReplicas: 30
  metrics:
    - type: Resource
      resource: {name: cpu, target: {type: Utilization, averageUtilization: 60}}
    - type: Pods
      pods:
        metric: {name: connect_ws_connections_active}
        target: {type: AverageValue, averageValue: "1500"}
```

### 21.3 Database — Cloud SQL for PostgreSQL

| Setting | Value |
|---|---|
| Edition | Enterprise Plus (for HA + PITR) |
| Version | PostgreSQL 15 |
| Availability | Regional (sync replica) |
| Read replica | Cross-zone, same region (Phase 1); cross-region (Phase 3) |
| Backups | Daily automated + 7-day PITR |
| Connection | Private IP via VPC + Cloud SQL Auth Proxy in GKE pods |
| Pool | `pgbouncer` sidecar OR `asyncpg` pool (50 per pod) |
| Encryption | CMEK (Cloud KMS key per env) |

**Replication behavior:** writes go to primary; reads with replica-lag gate — if `pg_last_wal_replay_lag()` > 500 ms, caller falls back to primary. Implemented in `core/db.py` connection router.

### 21.4 Redis — Memorystore

| Setting | Value |
|---|---|
| Tier | Standard HA |
| Version | 7.x |
| Capacity | 5 GB Phase 1 → scale with presence + pub/sub volume |
| Read replicas | 1 (Phase 1), more for Phase 2 |
| Auth | AUTH required + TLS in-transit |
| Key policy | Namespace per function: `pres:*`, `ws:*`, `stream:*`, `idemp:*`, `lock:*` |

Redis Cluster (Phase 3): when pub/sub fanout exceeds single-node throughput (≈ 100k msg/s), migrate to **Memorystore Cluster** with sharding + client-side partition routing. Design pub/sub channels now so cluster-mode is feasible (single slot per topic using hashtags: `{conv:<id>}:msg`).

### 21.5 Object Storage — GCS

| Bucket | Retention | Access |
|---|---|---|
| `connect-prod-attachments` | Tenant policy (default 365 days) | Uniform BLA, signed URLs only, IAM deny public |
| `connect-prod-recordings` | Tenant policy (default 90 days) | Same |
| `connect-prod-exports` | 30 days | Same |
| `connect-prod-thumbnails` | Mirrors attachments | Cache-Control headers for CDN fronting |

All buckets CMEK-encrypted. Object Lifecycle Management rules auto-transition cold data to **Nearline** → **Coldline** → delete.

### 21.6 Event Bus

| Use | Tech |
|---|---|
| Fast fan-out (WS) | Memorystore Redis Pub/Sub |
| Durable intra-cluster | Redis Streams |
| Cross-service durable | **Pub/Sub (GCP)** — `connect-audit`, `connect-notifications`, `connect-search-index`, `connect-recording-pipeline` |
| Scheduled jobs | **Cloud Tasks** (long-horizon) / **Cloud Scheduler** (cron) |

### 21.7 CI/CD Pipeline

Existing pipeline in [.github/workflows/deploy.yml](../.github/workflows/deploy.yml) extends to:

```
push → GitHub Actions
 1. verify: lint, typecheck, unit tests, schema validation
 2. build-and-push: Docker build per service → Artifact Registry
 3. migrate:      alembic upgrade head against staging / prod SQL
 4. deploy:       kubectl set image + rollout status (canary 10% → 100%)
 5. smoke test:   synthetic probes hit /healthz + /api/v1/conversations (dry)
 6. tag release:  git tag + BigQuery deploy-log insert
```

Use **Workload Identity Federation** so GitHub Actions authenticates to GCP without service-account keys.

### 21.8 Networking

- VPC `connect-prod`, /20. Subnets per region.
- **Private Service Connect** for Cloud SQL + Memorystore.
- **Cloud NAT** for egress (LiveKit cloud, email provider).
- **Cloud Armor** policies: OWASP Core Rule Set, rate rule per IP (1000 req/min), geo-block list.
- Inter-service traffic: mTLS via GKE mesh (Cloud Service Mesh) — Phase 2.

---

## 22. Environment Separation

Three environments with full parity:

| Env | Project | Scale | Data |
|---|---|---|---|
| `dev` | `zoikotime-connect-dev` | minimal (1 pod per svc) | synthetic seed data |
| `staging` | `zoikotime-connect-stg` | prod-like (1/3) | anonymized prod snapshot (nightly) |
| `prod` | `zoikotime-connect-prod` | full | live |

- **No shared resources** across envs (no shared DB, Redis, or buckets).
- **Secrets per env** in Secret Manager — same secret names, different values; injected by Workload Identity.
- **Promotion path:** image built once, tagged with commit SHA, promoted `dev → stg → prod` via GitHub Environments + manual approval gate for prod.
- **Config:** env-specific `app/core/config.py` via `CONNECT_ENV=prod` — Pydantic Settings loads `prod.env` overrides from Secret Manager at boot.
- **DB migrations:** `alembic upgrade head` runs before deploy; failed migration rolls back deployment (no in-place `DROP`).

---

## 23. Delivery Sequence

### Phase 1 — Collaboration Core

| Capability | Exit Criteria |
|---|---|
| Conversation model (direct + group) | SLO P0 targets met in load test |
| Session model with lifecycle | Audit events for every state transition |
| Gateway with auth + rate limiting | |
| Persistent chat with history | Message persistence verified under simulated media failure |
| Ad hoc 1:1 audio/video | No SFU vendor concepts in domain model |
| Group meeting join/leave | |
| Basic presence (online/offline/in_meeting) | |
| File attachment upload | |
| Admin audit logs | |
| Basic observability + alerting | Dashboards live for all P0 metrics |

### Phase 2 — Enterprise Maturity

- Threaded replies, read receipts, reactions
- Scheduled meetings + reminders
- Recurring sessions
- Waiting room / lobby
- Host controls (mute all, kick)
- Full presence model (DND, away, busy)
- Search (messages, participants, sessions)
- Exit: all P0 + P1 met; search permission-filtered; 100% reminder accuracy in test

### Phase 3 — Advanced Control

- Meeting recording with consent enforcement
- Transcript + summarization hooks
- Tenant-configurable retention engine
- Compliance export packages
- Legal hold workflows
- Admin dashboards
- External guest isolation
- Multi-region gateway
- Exit: exports verifiable by external counsel; retention enforces purge and hold concurrently on disjoint sets.

---

## 24. Architectural Directive

ZoikoTime requires a communication system that is real-time, durable, policy-aware, enterprise-safe, and architecturally clean. **Do not build this as a chat application with a video plugin. Build it as a real-time collaboration domain.**

The correct standard is a system with:

- A durable **Session** model with explicit lifecycle states and full audit coverage.
- A durable **Conversation** model that persists across and beyond Session boundaries.
- A **Media abstraction layer** that isolates SFU vendor concepts from the platform domain.
- **Compliance-ready persistence** designed into the data model from day one.
- **Clear service boundaries** with no shared databases and no cross-plane state mutation.
- **Observability as a first-class** architectural requirement, instrumented from Phase 1.
- **Authorization enforced server-side** at every boundary — no client trust.

---

## Appendix A — Implementation Pack Index

| # | Artifact | Section |
|---|---|---|
| 1 | Service-by-Service API Design | §9 |
| 2 | Database Schema (full DDL) | §8 |
| 3 | Socket/Event Contract List | §10 |
| 4 | LiveKit Integration Map | §13.4 |
| 5 | Deployment Topology (GCP) | §21 |
| 6 | Sequence Diagrams | §11 |
| 7 | Tenant Isolation Architecture | §12.4 |
| 8 | Disaster Recovery Runbook | *deferred to separate doc* |
| 9 | Code Structure & Conventions | §20 |
| 10 | Security Implementation | §12 |
| 11 | Failure Handling | §16 |
| 12 | Observability Implementation | §15 |

## Appendix B — Disaster Recovery Targets (summary)

| Metric | Target |
|---|---|
| RPO (DB) | ≤ 5 minutes (PITR) |
| RTO (regional failure) | ≤ 30 minutes (Phase 1 single-region → Phase 3 multi-region) |
| RPO (GCS) | 0 (versioning + multi-region bucket) |
| Backup cadence | Continuous (WAL) + daily full |
| Restoration drill | Quarterly, logged to `connect_audit_events` |

Full DR runbook to be produced as a separate artifact and linked here.

---

**End of Document — v3.0**
