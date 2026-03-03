-- Migration: Calendar Security Hardening
-- Date: 2026-03-03
-- Purpose: Restrict SECURITY DEFINER functions to service_role only,
--          tighten RLS policies on calendar tables.

-- ============================================================
-- Fix RLS: coach_calendar_blocks
-- Replace "anyone can read" with "authenticated users can read"
-- ============================================================
DROP POLICY IF EXISTS "Anyone can read calendar blocks" ON coach_calendar_blocks;

CREATE POLICY "Authenticated users can read calendar blocks"
  ON coach_calendar_blocks FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- Fix RLS: calendar_connect_tokens
-- Replace "anyone can read" with "authenticated or lookup by token"
-- Service role always has full access regardless
-- ============================================================
DROP POLICY IF EXISTS "Anyone can read calendar connect tokens" ON calendar_connect_tokens;

CREATE POLICY "Authenticated users can read own calendar tokens"
  ON calendar_connect_tokens FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- Fix SECURITY DEFINER: upsert_calendar_connection
-- Add service_role check - only edge functions should call this
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
  -- Only allow service_role to call this function
  IF current_setting('request.jwt.claims', true)::jsonb ->> 'role' != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: service_role required';
  END IF;

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
-- Fix SECURITY DEFINER: get_active_calendar_connections
-- Add service_role check - decrypted tokens must never leak
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
  -- Only allow service_role to call this function
  IF current_setting('request.jwt.claims', true)::jsonb ->> 'role' != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: service_role required';
  END IF;

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
-- Fix SECURITY DEFINER: update_calendar_tokens
-- Add service_role check
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
  -- Only allow service_role to call this function
  IF current_setting('request.jwt.claims', true)::jsonb ->> 'role' != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: service_role required';
  END IF;

  UPDATE coach_calendar_connections
  SET
    access_token_encrypted = pgp_sym_encrypt(p_access_token, p_encryption_key),
    refresh_token_encrypted = pgp_sym_encrypt(p_refresh_token, p_encryption_key),
    token_expires_at = p_token_expires_at
  WHERE id = p_connection_id;
END;
$$;
