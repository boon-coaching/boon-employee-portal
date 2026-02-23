-- ============================================
-- Teams Integration Migration
-- Adds Microsoft Teams as a messaging channel
-- alongside existing Slack integration.
-- ============================================

-- 1. TEAMS INSTALLATION TABLE
-- Per-tenant config (Azure AD tenant)
CREATE TABLE IF NOT EXISTS public.teams_installations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT UNIQUE NOT NULL,        -- Azure AD tenant ID
  bot_token TEXT,                         -- Cached bot token (short-lived, refreshed on demand)
  bot_id TEXT,                            -- Bot's Teams user ID
  service_url TEXT NOT NULL,              -- Bot Framework service URL for this tenant
  installed_by TEXT,                      -- Email of person who connected
  installed_at TIMESTAMPTZ DEFAULT NOW(),
  token_expires_at TIMESTAMPTZ           -- When cached token expires
);

-- 2. EMPLOYEE TEAMS CONNECTIONS TABLE
-- Per-employee link to their Teams account
CREATE TABLE IF NOT EXISTS public.employee_teams_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_email TEXT NOT NULL,
  tenant_id TEXT NOT NULL REFERENCES teams_installations(tenant_id),
  teams_user_id TEXT NOT NULL,            -- Azure AD user object ID
  conversation_id TEXT NOT NULL,          -- 1:1 conversation ID for proactive messaging
  service_url TEXT NOT NULL,              -- Service URL for this conversation
  nudge_enabled BOOLEAN DEFAULT true,
  nudge_frequency TEXT DEFAULT 'smart' CHECK (nudge_frequency IN ('smart', 'daily', 'weekly', 'none')),
  preferred_time TIME DEFAULT '09:00',
  timezone TEXT DEFAULT 'America/New_York',
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_email, tenant_id)
);

-- 3. RENAME slack_nudges -> nudges WITH BACKWARD COMPAT
-- Add channel column, rename message_ts -> message_id

-- Rename the table
ALTER TABLE IF EXISTS public.slack_nudges RENAME TO nudges;

-- Add channel column (defaults to 'slack' for existing rows)
ALTER TABLE public.nudges
  ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'slack';

-- Rename message_ts to message_id for generic use
ALTER TABLE public.nudges
  RENAME COLUMN message_ts TO message_id;

-- Create backward-compatible view so existing code doesn't break during transition
CREATE OR REPLACE VIEW public.slack_nudges AS
SELECT
  id,
  employee_email,
  nudge_type,
  reference_id,
  reference_type,
  message_id AS message_ts,
  channel_id,
  status,
  response,
  sent_at,
  responded_at,
  channel
FROM public.nudges;

-- Make the view insertable (for existing code that inserts into slack_nudges)
CREATE OR REPLACE RULE slack_nudges_insert AS
ON INSERT TO public.slack_nudges
DO INSTEAD
INSERT INTO public.nudges (
  employee_email, nudge_type, reference_id, reference_type,
  message_id, channel_id, status, response, sent_at, responded_at, channel
) VALUES (
  NEW.employee_email, NEW.nudge_type, NEW.reference_id, NEW.reference_type,
  NEW.message_ts, NEW.channel_id, COALESCE(NEW.status, 'sent'), NEW.response,
  COALESCE(NEW.sent_at, NOW()), NEW.responded_at, COALESCE(NEW.channel, 'slack')
);

-- Make the view updatable
CREATE OR REPLACE RULE slack_nudges_update AS
ON UPDATE TO public.slack_nudges
DO INSTEAD
UPDATE public.nudges
SET
  response = NEW.response,
  responded_at = NEW.responded_at,
  status = NEW.status
WHERE id = OLD.id;

-- 4. ADD teams_blocks COLUMN TO nudge_templates
ALTER TABLE public.nudge_templates
  ADD COLUMN IF NOT EXISTS teams_blocks JSONB;

-- 5. ENABLE RLS ON NEW TABLES
ALTER TABLE teams_installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_teams_connections ENABLE ROW LEVEL SECURITY;

-- RLS: teams_installations - service_role only
DROP POLICY IF EXISTS "service_role_manage_teams_installations" ON teams_installations;
CREATE POLICY "service_role_manage_teams_installations"
ON teams_installations
FOR ALL
USING (auth.role() = 'service_role');

-- RLS: employee_teams_connections - employees manage their own
DROP POLICY IF EXISTS "employees_manage_own_teams_connection" ON employee_teams_connections;
CREATE POLICY "employees_manage_own_teams_connection"
ON employee_teams_connections
FOR ALL
USING (
  lower(employee_email) = (
    SELECT lower(company_email)
    FROM employee_manager
    WHERE auth_user_id = auth.uid()
  )
  OR
  lower(employee_email) = lower(auth.jwt() ->> 'email')
);

-- RLS on nudges table (renamed from slack_nudges)
-- Drop old policy name, create under new name
DROP POLICY IF EXISTS "employees_view_own_nudges" ON nudges;
CREATE POLICY "employees_view_own_nudges"
ON nudges
FOR SELECT
USING (
  lower(employee_email) = (
    SELECT lower(company_email)
    FROM employee_manager
    WHERE auth_user_id = auth.uid()
  )
  OR
  lower(employee_email) = lower(auth.jwt() ->> 'email')
);

-- 6. INDEXES
CREATE INDEX IF NOT EXISTS idx_teams_connections_email
ON employee_teams_connections(lower(employee_email));

CREATE INDEX IF NOT EXISTS idx_nudges_channel
ON nudges(channel);

-- 7. NEW/UPDATED RPCs

-- Get employee's Teams connection (mirrors get_employee_slack_connection)
CREATE OR REPLACE FUNCTION get_employee_teams_connection(lookup_email TEXT)
RETURNS TABLE(
  teams_user_id TEXT,
  conversation_id TEXT,
  service_url TEXT,
  nudge_enabled BOOLEAN,
  nudge_frequency TEXT,
  preferred_time TIME,
  timezone TEXT,
  tenant_id TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    etc.teams_user_id,
    etc.conversation_id,
    etc.service_url,
    etc.nudge_enabled,
    etc.nudge_frequency,
    etc.preferred_time,
    etc.timezone,
    etc.tenant_id
  FROM employee_teams_connections etc
  WHERE lower(etc.employee_email) = lower(lookup_email)
    AND etc.nudge_enabled = true;
END;
$$;

-- Unified messaging connection lookup
-- Returns whichever channel the employee has connected
CREATE OR REPLACE FUNCTION get_employee_messaging_connection(lookup_email TEXT)
RETURNS TABLE(
  channel TEXT,
  user_id TEXT,
  dm_channel_id TEXT,
  service_url TEXT,
  nudge_enabled BOOLEAN,
  nudge_frequency TEXT,
  preferred_time TIME,
  timezone TEXT,
  team_or_tenant_id TEXT,
  bot_token TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check Teams first (newer integration gets priority if both somehow exist)
  RETURN QUERY
  SELECT
    'teams'::TEXT as channel,
    etc.teams_user_id as user_id,
    etc.conversation_id as dm_channel_id,
    etc.service_url,
    etc.nudge_enabled,
    etc.nudge_frequency,
    etc.preferred_time,
    etc.timezone,
    etc.tenant_id as team_or_tenant_id,
    NULL::TEXT as bot_token  -- Teams tokens are fetched on demand
  FROM employee_teams_connections etc
  WHERE lower(etc.employee_email) = lower(lookup_email)
    AND etc.nudge_enabled = true
  LIMIT 1;

  IF FOUND THEN RETURN; END IF;

  -- Fall back to Slack
  RETURN QUERY
  SELECT
    'slack'::TEXT as channel,
    esc.slack_user_id as user_id,
    esc.slack_dm_channel_id as dm_channel_id,
    NULL::TEXT as service_url,
    esc.nudge_enabled,
    esc.nudge_frequency,
    esc.preferred_time,
    esc.timezone,
    esc.slack_team_id as team_or_tenant_id,
    si.bot_token
  FROM employee_slack_connections esc
  JOIN slack_installations si ON si.team_id = esc.slack_team_id
  WHERE lower(esc.employee_email) = lower(lookup_email)
    AND esc.nudge_enabled = true
  LIMIT 1;
END;
$$;

-- Update record_nudge to accept channel parameter
CREATE OR REPLACE FUNCTION record_nudge(
  p_employee_email TEXT,
  p_nudge_type TEXT,
  p_reference_id UUID,
  p_reference_type TEXT,
  p_message_ts TEXT,
  p_channel_id TEXT,
  p_channel TEXT DEFAULT 'slack'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  nudge_id UUID;
BEGIN
  INSERT INTO nudges (
    employee_email, nudge_type, reference_id, reference_type,
    message_id, channel_id, channel
  ) VALUES (
    p_employee_email, p_nudge_type, p_reference_id, p_reference_type,
    p_message_ts, p_channel_id, p_channel
  )
  RETURNING id INTO nudge_id;

  RETURN nudge_id;
END;
$$;

-- Update record_nudge_response to work with both channels
CREATE OR REPLACE FUNCTION record_nudge_response(
  p_message_ts TEXT,
  p_channel_id TEXT,
  p_response TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE nudges
  SET
    status = 'responded',
    response = p_response,
    responded_at = NOW()
  WHERE message_id = p_message_ts
    AND channel_id = p_channel_id;

  RETURN FOUND;
END;
$$;

-- Update was_recently_nudged to use renamed table
CREATE OR REPLACE FUNCTION was_recently_nudged(
  lookup_email TEXT,
  lookup_nudge_type TEXT,
  hours_threshold INTEGER DEFAULT 24
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM nudges
    WHERE lower(employee_email) = lower(lookup_email)
      AND nudge_type = lookup_nudge_type
      AND sent_at > NOW() - (hours_threshold || ' hours')::INTERVAL
  );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_employee_teams_connection TO service_role;
GRANT EXECUTE ON FUNCTION get_employee_messaging_connection TO service_role;

-- 8. INSERT DEFAULT ADAPTIVE CARD TEMPLATES
-- Update existing nudge_templates with teams_blocks

UPDATE nudge_templates SET teams_blocks = '{
  "type": "AdaptiveCard",
  "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
  "version": "1.4",
  "body": [
    {
      "type": "TextBlock",
      "text": "Coaching Action Reminder",
      "weight": "Bolder",
      "size": "Medium",
      "color": "Accent"
    },
    {
      "type": "TextBlock",
      "text": "Hey {{first_name}}! You set this goal in your session with {{coach_name}}:",
      "wrap": true
    },
    {
      "type": "TextBlock",
      "text": "{{action_text}}",
      "wrap": true,
      "weight": "Bolder",
      "spacing": "Small"
    },
    {
      "type": "TextBlock",
      "text": "Due: {{due_date}}",
      "size": "Small",
      "isSubtle": true,
      "spacing": "Small"
    }
  ],
  "actions": [
    {
      "type": "Action.Submit",
      "title": "Done",
      "style": "positive",
      "data": {"action": "action_done", "reference_id": "{{action_id}}"}
    },
    {
      "type": "Action.Submit",
      "title": "In Progress",
      "data": {"action": "action_in_progress", "reference_id": "{{action_id}}"}
    },
    {
      "type": "Action.Submit",
      "title": "Reschedule",
      "data": {"action": "action_reschedule", "reference_id": "{{action_id}}"}
    },
    {
      "type": "Action.Submit",
      "title": "Need Help",
      "data": {"action": "need_help", "reference_id": "{{action_id}}"}
    }
  ]
}'::jsonb
WHERE nudge_type = 'action_reminder' AND is_default = true;

UPDATE nudge_templates SET teams_blocks = '{
  "type": "AdaptiveCard",
  "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
  "version": "1.4",
  "body": [
    {
      "type": "TextBlock",
      "text": "Quick Check-in",
      "weight": "Bolder",
      "size": "Medium",
      "color": "Accent"
    },
    {
      "type": "TextBlock",
      "text": "It''s been a few days since your session with {{coach_name}}. How''s progress on your goals?",
      "wrap": true
    },
    {
      "type": "TextBlock",
      "text": "{{goals}}",
      "wrap": true,
      "weight": "Bolder",
      "spacing": "Small"
    }
  ],
  "actions": [
    {
      "type": "Action.Submit",
      "title": "Great progress",
      "style": "positive",
      "data": {"action": "progress_great", "reference_id": "{{session_id}}"}
    },
    {
      "type": "Action.Submit",
      "title": "Slow but moving",
      "data": {"action": "progress_slow", "reference_id": "{{session_id}}"}
    },
    {
      "type": "Action.Submit",
      "title": "Stuck",
      "data": {"action": "progress_stuck", "reference_id": "{{session_id}}"}
    }
  ]
}'::jsonb
WHERE nudge_type = 'goal_checkin' AND is_default = true;

UPDATE nudge_templates SET teams_blocks = '{
  "type": "AdaptiveCard",
  "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
  "version": "1.4",
  "body": [
    {
      "type": "TextBlock",
      "text": "Session Tomorrow",
      "weight": "Bolder",
      "size": "Medium",
      "color": "Accent"
    },
    {
      "type": "TextBlock",
      "text": "Hey {{first_name}}! You have a coaching session with {{coach_name}} tomorrow.",
      "wrap": true
    },
    {
      "type": "TextBlock",
      "text": "Quick prep questions:",
      "weight": "Bolder",
      "spacing": "Medium"
    },
    {
      "type": "TextBlock",
      "text": "- What''s been on your mind this week?\n- Any wins to celebrate?\n- What do you want to focus on?",
      "wrap": true,
      "spacing": "Small"
    }
  ],
  "actions": [
    {
      "type": "Action.OpenUrl",
      "title": "Open Session Prep",
      "url": "{{portal_url}}/session-prep"
    }
  ]
}'::jsonb
WHERE nudge_type = 'session_prep' AND is_default = true;

UPDATE nudge_templates SET teams_blocks = '{
  "type": "AdaptiveCard",
  "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
  "version": "1.4",
  "body": [
    {
      "type": "TextBlock",
      "text": "Your Weekly Coaching Digest",
      "weight": "Bolder",
      "size": "Medium",
      "color": "Accent"
    },
    {
      "type": "TextBlock",
      "text": "Here''s where you stand this week:",
      "wrap": true
    },
    {
      "type": "ColumnSet",
      "columns": [
        {
          "type": "Column",
          "width": "stretch",
          "items": [
            {"type": "TextBlock", "text": "Pending Actions", "size": "Small", "isSubtle": true},
            {"type": "TextBlock", "text": "{{pending_count}}", "size": "ExtraLarge", "weight": "Bolder"}
          ]
        },
        {
          "type": "Column",
          "width": "stretch",
          "items": [
            {"type": "TextBlock", "text": "Completed This Week", "size": "Small", "isSubtle": true},
            {"type": "TextBlock", "text": "{{completed_count}}", "size": "ExtraLarge", "weight": "Bolder"}
          ]
        }
      ]
    },
    {
      "type": "TextBlock",
      "text": "Top priority: {{top_action}}",
      "wrap": true,
      "weight": "Bolder",
      "spacing": "Medium"
    }
  ],
  "actions": [
    {
      "type": "Action.OpenUrl",
      "title": "View All Actions",
      "url": "{{portal_url}}/actions"
    }
  ]
}'::jsonb
WHERE nudge_type = 'weekly_digest' AND is_default = true;
