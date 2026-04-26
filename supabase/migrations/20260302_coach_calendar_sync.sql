-- Migration: Coach Calendar Sync
-- Date: 2026-03-02
-- Purpose: One-way calendar read integration to prevent double-bookings.
-- Stores OAuth connections, cached busy blocks, and token-based access links.

-- Ensure pgcrypto is available for token encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- Table: coach_calendar_connections
-- Stores encrypted OAuth credentials per coach per provider
-- ============================================================
CREATE TABLE IF NOT EXISTS coach_calendar_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES coaches(id),
  coach_email TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('google', 'microsoft')),
  access_token_encrypted BYTEA NOT NULL,
  refresh_token_encrypted BYTEA NOT NULL,
  token_expires_at TIMESTAMPTZ,
  calendar_email TEXT,
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  last_sync_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(coach_id, provider)
);

-- ============================================================
-- Table: coach_calendar_blocks
-- Cached busy time blocks from external calendars
-- ============================================================
CREATE TABLE IF NOT EXISTS coach_calendar_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES coaches(id),
  source TEXT NOT NULL CHECK (source IN ('google', 'microsoft')),
  busy_start TIMESTAMPTZ NOT NULL,
  busy_end TIMESTAMPTZ NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Table: calendar_connect_tokens
-- Token-based access for the calendar connect page (no auth needed)
-- ============================================================
CREATE TABLE IF NOT EXISTS calendar_connect_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL UNIQUE REFERENCES coaches(id),
  token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_calendar_connections_coach
  ON coach_calendar_connections(coach_id);

CREATE INDEX IF NOT EXISTS idx_calendar_connections_active
  ON coach_calendar_connections(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_calendar_blocks_coach_time
  ON coach_calendar_blocks(coach_id, busy_start, busy_end);

CREATE INDEX IF NOT EXISTS idx_calendar_connect_tokens_token
  ON calendar_connect_tokens(token);

-- ============================================================
-- RLS Policies
-- ============================================================

-- coach_calendar_connections: service_role only (contains encrypted tokens)
ALTER TABLE coach_calendar_connections ENABLE ROW LEVEL SECURITY;
-- No policies = only service_role can access

-- coach_calendar_blocks: service_role writes, anyone can read (just time ranges)
ALTER TABLE coach_calendar_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read calendar blocks"
  ON coach_calendar_blocks FOR SELECT
  USING (true);

-- calendar_connect_tokens: service_role writes, anyone can read (token lookup)
ALTER TABLE calendar_connect_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read calendar connect tokens"
  ON calendar_connect_tokens FOR SELECT
  USING (true);

-- ============================================================
-- Updated_at trigger for connections
-- ============================================================
CREATE OR REPLACE FUNCTION update_calendar_connection_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calendar_connection_updated_at
  BEFORE UPDATE ON coach_calendar_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_calendar_connection_updated_at();

-- ============================================================
-- RPC: upsert_calendar_connection
-- Encrypts tokens and upserts a calendar connection
-- ============================================================
CREATE OR REPLACE FUNCTION upsert_calendar_connection(
  p_coach_id UUID,
  p_coach_email TEXT,
  p_provider TEXT,
  p_access_token TEXT,
  p_refresh_token TEXT,
  p_token_expires_at TIMESTAMPTZ,
  p_calendar_email TEXT,
  p_encryption_key TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO coach_calendar_connections (
    coach_id, coach_email, provider,
    access_token_encrypted, refresh_token_encrypted,
    token_expires_at, calendar_email, is_active,
    last_sync_error
  ) VALUES (
    p_coach_id, p_coach_email, p_provider,
    pgp_sym_encrypt(p_access_token, p_encryption_key),
    pgp_sym_encrypt(p_refresh_token, p_encryption_key),
    p_token_expires_at, p_calendar_email, true,
    NULL
  )
  ON CONFLICT (coach_id, provider) DO UPDATE SET
    access_token_encrypted = pgp_sym_encrypt(p_access_token, p_encryption_key),
    refresh_token_encrypted = pgp_sym_encrypt(p_refresh_token, p_encryption_key),
    token_expires_at = p_token_expires_at,
    calendar_email = p_calendar_email,
    coach_email = p_coach_email,
    is_active = true,
    last_sync_error = NULL
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ============================================================
-- RPC: get_active_calendar_connections
-- Decrypts and returns all active connections
-- ============================================================
CREATE OR REPLACE FUNCTION get_active_calendar_connections(
  p_encryption_key TEXT
)
RETURNS TABLE (
  id UUID,
  coach_id UUID,
  coach_email TEXT,
  provider TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  calendar_email TEXT,
  last_sync_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.coach_id,
    c.coach_email,
    c.provider,
    pgp_sym_decrypt(c.access_token_encrypted, p_encryption_key)::TEXT AS access_token,
    pgp_sym_decrypt(c.refresh_token_encrypted, p_encryption_key)::TEXT AS refresh_token,
    c.token_expires_at,
    c.calendar_email,
    c.last_sync_at
  FROM coach_calendar_connections c
  WHERE c.is_active = true;
END;
$$;

-- ============================================================
-- RPC: update_calendar_tokens
-- Updates tokens after a refresh (re-encrypts)
-- ============================================================
CREATE OR REPLACE FUNCTION update_calendar_tokens(
  p_connection_id UUID,
  p_access_token TEXT,
  p_refresh_token TEXT,
  p_token_expires_at TIMESTAMPTZ,
  p_encryption_key TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  UPDATE coach_calendar_connections
  SET
    access_token_encrypted = pgp_sym_encrypt(p_access_token, p_encryption_key),
    refresh_token_encrypted = pgp_sym_encrypt(p_refresh_token, p_encryption_key),
    token_expires_at = p_token_expires_at
  WHERE id = p_connection_id;
END;
$$;

-- ============================================================
-- RPC: check_coach_availability
-- Returns true if coach has NO calendar conflicts in the given range
-- ============================================================
CREATE OR REPLACE FUNCTION check_coach_availability(
  p_coach_id UUID,
  p_start TIMESTAMPTZ,
  p_end TIMESTAMPTZ
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1
    FROM coach_calendar_blocks
    WHERE coach_id = p_coach_id
      AND busy_start < p_end
      AND busy_end > p_start
  );
END;
$$;

-- ============================================================
-- RPC: get_coach_busy_blocks
-- Returns busy block rows for a coach in a time range
-- ============================================================
CREATE OR REPLACE FUNCTION get_coach_busy_blocks(
  p_coach_id UUID,
  p_start TIMESTAMPTZ,
  p_end TIMESTAMPTZ
)
RETURNS TABLE (
  id UUID,
  source TEXT,
  busy_start TIMESTAMPTZ,
  busy_end TIMESTAMPTZ,
  synced_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id,
    b.source,
    b.busy_start,
    b.busy_end,
    b.synced_at
  FROM coach_calendar_blocks b
  WHERE b.coach_id = p_coach_id
    AND b.busy_start < p_end
    AND b.busy_end > p_start
  ORDER BY b.busy_start;
END;
$$;

-- ============================================================
-- Comments
-- ============================================================
COMMENT ON TABLE coach_calendar_connections IS 'Stores encrypted OAuth tokens for coach calendar integrations (Google/Microsoft)';
COMMENT ON TABLE coach_calendar_blocks IS 'Cached busy time blocks from external calendars, synced every 15 minutes';
COMMENT ON TABLE calendar_connect_tokens IS 'Token-based access links for coaches to connect their calendars (no auth required)';
COMMENT ON FUNCTION check_coach_availability IS 'Returns true if coach has no calendar conflicts in the given time range';
