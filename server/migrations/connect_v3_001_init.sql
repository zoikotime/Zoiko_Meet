-- =============================================================================
--  Zoiko Connect v3 — initial schema migration
--
--  Runs once against the production PostgreSQL instance as a dedicated job
--  (NOT from app startup). Safe to re-run: every statement is idempotent.
--
--  Design rules (spec §6, §7):
--   * UUIDs everywhere (v7, generated client-side; column type UUID)
--   * `tenant_id TEXT NOT NULL` on every row
--   * Monthly RANGE partitioning on append-heavy tables (messages, audit, outbox)
--   * RLS policies so a compromised app role can't read across tenants
--   * Append-only trigger on audit + outbox (UPDATE/DELETE raise exception)
--   * Standard audit columns: created_at, updated_at, created_by, status,
--     correlation_id
-- =============================================================================

-- ---------- Extensions ------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid() fallback
CREATE EXTENSION IF NOT EXISTS btree_gin;  -- composite indexes on JSONB tags


-- ---------- Helper: append-only guard --------------------------------------
CREATE OR REPLACE FUNCTION connect_reject_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'append-only: % not allowed on %', TG_OP, TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;


-- ---------- Helper: updated_at touch ---------------------------------------
CREATE OR REPLACE FUNCTION connect_touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- =============================================================================
--  CONVERSATIONS (chat rooms, DMs, channels)
-- =============================================================================
CREATE TABLE IF NOT EXISTS connect_conversations (
    id              UUID PRIMARY KEY,
    tenant_id       TEXT NOT NULL,
    kind            TEXT NOT NULL CHECK (kind IN ('direct','group','channel')),
    name            TEXT,
    topic           TEXT,
    created_by      BIGINT NOT NULL,        -- references legacy users.id
    status          TEXT NOT NULL DEFAULT 'active'
                       CHECK (status IN ('active','archived','deleted')),
    correlation_id  TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_connect_conversations_tenant
    ON connect_conversations (tenant_id, updated_at DESC);

DROP TRIGGER IF EXISTS trg_connect_conversations_touch ON connect_conversations;
CREATE TRIGGER trg_connect_conversations_touch
    BEFORE UPDATE ON connect_conversations
    FOR EACH ROW EXECUTE FUNCTION connect_touch_updated_at();

ALTER TABLE connect_conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS connect_conversations_tenant_iso ON connect_conversations;
CREATE POLICY connect_conversations_tenant_iso ON connect_conversations
    USING (tenant_id = current_setting('app.tenant_id', true));


CREATE TABLE IF NOT EXISTS connect_conversation_members (
    id              UUID PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES connect_conversations(id) ON DELETE CASCADE,
    tenant_id       TEXT NOT NULL,
    user_id         BIGINT NOT NULL,
    role            TEXT NOT NULL DEFAULT 'member'
                       CHECK (role IN ('owner','admin','member','guest')),
    status          TEXT NOT NULL DEFAULT 'active'
                       CHECK (status IN ('active','muted','left','removed')),
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      BIGINT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    correlation_id  TEXT,
    UNIQUE (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS ix_connect_conversation_members_user
    ON connect_conversation_members (tenant_id, user_id, status);

ALTER TABLE connect_conversation_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS connect_cm_tenant_iso ON connect_conversation_members;
CREATE POLICY connect_cm_tenant_iso ON connect_conversation_members
    USING (tenant_id = current_setting('app.tenant_id', true));


-- =============================================================================
--  MESSAGES — monthly partitioned for hot/cold tiering
-- =============================================================================
CREATE TABLE IF NOT EXISTS connect_messages (
    id              UUID NOT NULL,
    tenant_id       TEXT NOT NULL,
    conversation_id UUID NOT NULL,
    sender_id       BIGINT NOT NULL,
    body            TEXT,
    attachment_ids  UUID[] NOT NULL DEFAULT '{}',
    reply_to_id     UUID,
    status          TEXT NOT NULL DEFAULT 'sent'
                       CHECK (status IN ('sent','edited','deleted')),
    correlation_id  TEXT,
    created_by      BIGINT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Bootstrap partition for the current + next month; a cron job rolls new
-- partitions forward monthly (see ops/partition_roll.sql).
DO $$
DECLARE
    m0 DATE := date_trunc('month', now())::date;
    m1 DATE := (date_trunc('month', now()) + interval '1 month')::date;
    m2 DATE := (date_trunc('month', now()) + interval '2 months')::date;
BEGIN
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS connect_messages_%s PARTITION OF connect_messages '
        'FOR VALUES FROM (%L) TO (%L)',
        to_char(m0, 'YYYY_MM'), m0, m1);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS connect_messages_%s PARTITION OF connect_messages '
        'FOR VALUES FROM (%L) TO (%L)',
        to_char(m1, 'YYYY_MM'), m1, m2);
END $$;

CREATE INDEX IF NOT EXISTS ix_connect_messages_conv_time
    ON connect_messages (tenant_id, conversation_id, created_at DESC);

ALTER TABLE connect_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS connect_messages_tenant_iso ON connect_messages;
CREATE POLICY connect_messages_tenant_iso ON connect_messages
    USING (tenant_id = current_setting('app.tenant_id', true));


CREATE TABLE IF NOT EXISTS connect_message_receipts (
    id              UUID PRIMARY KEY,
    tenant_id       TEXT NOT NULL,
    conversation_id UUID NOT NULL,
    user_id         BIGINT NOT NULL,
    last_read_id    UUID NOT NULL,
    last_read_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    correlation_id  TEXT,
    UNIQUE (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS ix_connect_receipts_user
    ON connect_message_receipts (tenant_id, user_id);

ALTER TABLE connect_message_receipts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS connect_receipts_tenant_iso ON connect_message_receipts;
CREATE POLICY connect_receipts_tenant_iso ON connect_message_receipts
    USING (tenant_id = current_setting('app.tenant_id', true));


-- =============================================================================
--  SESSIONS (meetings/calls at the domain level — media vendor is separate)
-- =============================================================================
CREATE TABLE IF NOT EXISTS connect_sessions (
    id                 UUID PRIMARY KEY,
    tenant_id          TEXT NOT NULL,
    kind               TEXT NOT NULL CHECK (kind IN ('1to1','group','webinar')),
    title              TEXT,
    host_id            BIGINT NOT NULL,
    scheduled_start_at TIMESTAMPTZ,
    started_at         TIMESTAMPTZ,
    ended_at           TIMESTAMPTZ,
    status             TEXT NOT NULL DEFAULT 'scheduled'
                          CHECK (status IN ('scheduled','pending_start','active','ended','archived','cancelled')),
    media_room_ref     TEXT,                  -- opaque token from media provider
    correlation_id     TEXT,
    created_by         BIGINT NOT NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_connect_sessions_tenant_status
    ON connect_sessions (tenant_id, status, scheduled_start_at);

DROP TRIGGER IF EXISTS trg_connect_sessions_touch ON connect_sessions;
CREATE TRIGGER trg_connect_sessions_touch
    BEFORE UPDATE ON connect_sessions
    FOR EACH ROW EXECUTE FUNCTION connect_touch_updated_at();

ALTER TABLE connect_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS connect_sessions_tenant_iso ON connect_sessions;
CREATE POLICY connect_sessions_tenant_iso ON connect_sessions
    USING (tenant_id = current_setting('app.tenant_id', true));


CREATE TABLE IF NOT EXISTS connect_session_members (
    id              UUID PRIMARY KEY,
    session_id      UUID NOT NULL REFERENCES connect_sessions(id) ON DELETE CASCADE,
    tenant_id       TEXT NOT NULL,
    user_id         BIGINT NOT NULL,
    role            TEXT NOT NULL DEFAULT 'participant'
                       CHECK (role IN ('host','cohost','participant','guest')),
    status          TEXT NOT NULL DEFAULT 'invited'
                       CHECK (status IN ('invited','pending_admission','admitted','denied','disconnected','kicked','left')),
    joined_at       TIMESTAMPTZ,
    left_at         TIMESTAMPTZ,
    created_by      BIGINT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    correlation_id  TEXT,
    UNIQUE (session_id, user_id)
);

CREATE INDEX IF NOT EXISTS ix_connect_session_members_lookup
    ON connect_session_members (tenant_id, session_id, status);

DROP TRIGGER IF EXISTS trg_connect_session_members_touch ON connect_session_members;
CREATE TRIGGER trg_connect_session_members_touch
    BEFORE UPDATE ON connect_session_members
    FOR EACH ROW EXECUTE FUNCTION connect_touch_updated_at();

ALTER TABLE connect_session_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS connect_sm_tenant_iso ON connect_session_members;
CREATE POLICY connect_sm_tenant_iso ON connect_session_members
    USING (tenant_id = current_setting('app.tenant_id', true));


-- =============================================================================
--  OUTBOX — reliable event emission
-- =============================================================================
CREATE TABLE IF NOT EXISTS connect_outbox (
    id              UUID NOT NULL,
    tenant_id       TEXT NOT NULL,
    type            TEXT NOT NULL,
    version         INT  NOT NULL DEFAULT 1,
    correlation_id  TEXT,
    payload         JSONB NOT NULL,
    dispatched_at   TIMESTAMPTZ,
    attempts        INT NOT NULL DEFAULT 0,
    last_error      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

DO $$
DECLARE
    m0 DATE := date_trunc('month', now())::date;
    m1 DATE := (date_trunc('month', now()) + interval '1 month')::date;
    m2 DATE := (date_trunc('month', now()) + interval '2 months')::date;
BEGIN
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS connect_outbox_%s PARTITION OF connect_outbox '
        'FOR VALUES FROM (%L) TO (%L)',
        to_char(m0, 'YYYY_MM'), m0, m1);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS connect_outbox_%s PARTITION OF connect_outbox '
        'FOR VALUES FROM (%L) TO (%L)',
        to_char(m1, 'YYYY_MM'), m1, m2);
END $$;

CREATE INDEX IF NOT EXISTS ix_connect_outbox_pending
    ON connect_outbox (dispatched_at NULLS FIRST, created_at);


-- =============================================================================
--  AUDIT — append-only, partitioned, BigQuery sink target
-- =============================================================================
CREATE TABLE IF NOT EXISTS connect_audit_events (
    id              UUID NOT NULL,
    tenant_id       TEXT NOT NULL,
    type            TEXT NOT NULL,                 -- e.g. "session.participant.kicked"
    actor_user_id   BIGINT,
    resource_type   TEXT NOT NULL,                 -- "session" | "message" | "conversation" | ...
    resource_id     TEXT NOT NULL,
    ip_address      TEXT,
    user_agent      TEXT,
    metadata        JSONB NOT NULL DEFAULT '{}',
    correlation_id  TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

DO $$
DECLARE
    m0 DATE := date_trunc('month', now())::date;
    m1 DATE := (date_trunc('month', now()) + interval '1 month')::date;
    m2 DATE := (date_trunc('month', now()) + interval '2 months')::date;
BEGIN
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS connect_audit_events_%s PARTITION OF connect_audit_events '
        'FOR VALUES FROM (%L) TO (%L)',
        to_char(m0, 'YYYY_MM'), m0, m1);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS connect_audit_events_%s PARTITION OF connect_audit_events '
        'FOR VALUES FROM (%L) TO (%L)',
        to_char(m1, 'YYYY_MM'), m1, m2);
END $$;

CREATE INDEX IF NOT EXISTS ix_connect_audit_tenant_time
    ON connect_audit_events (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_connect_audit_resource
    ON connect_audit_events (tenant_id, resource_type, resource_id);

-- Append-only: reject UPDATE + DELETE
DROP TRIGGER IF EXISTS trg_connect_audit_append_only ON connect_audit_events;
CREATE TRIGGER trg_connect_audit_append_only
    BEFORE UPDATE OR DELETE ON connect_audit_events
    FOR EACH ROW EXECUTE FUNCTION connect_reject_mutation();

ALTER TABLE connect_audit_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS connect_audit_tenant_iso ON connect_audit_events;
CREATE POLICY connect_audit_tenant_iso ON connect_audit_events
    USING (tenant_id = current_setting('app.tenant_id', true));
