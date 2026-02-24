// Nudge Scheduler Edge Function (Standalone)
// Runs on a cron schedule to send coaching nudges via Slack or Microsoft Teams
//
// Deploy with cron: supabase functions deploy nudge-scheduler --schedule "0 * * * *"
// (Runs every hour to catch users in their preferred time windows)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

// Inline helper: create Supabase client
function getSupabaseClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
}

// Inline helper: send Slack message
async function sendSlackMessage(
  botToken: string,
  options: { channel: string; blocks: unknown[]; text: string }
): Promise<{ ok: boolean; ts?: string; error?: string }> {
  const response = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${botToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      channel: options.channel,
      blocks: options.blocks,
      text: options.text,
    }),
  });
  return response.json();
}

// Inline helper: send Teams message via Bot Framework
async function sendTeamsMessage(
  token: string,
  serviceUrl: string,
  conversationId: string,
  card: Record<string, unknown>
): Promise<{ ok: boolean; activityId?: string; error?: string }> {
  const url = `${serviceUrl.replace(/\/$/, '')}/v3/conversations/${conversationId}/activities`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'message',
      attachments: [
        {
          contentType: 'application/vnd.microsoft.card.adaptive',
          content: card,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return { ok: false, error: errorText };
  }

  const data = await response.json();
  return { ok: true, activityId: data.id };
}

// Inline helper: get Teams bot token
async function getBotAccessToken(
  clientId: string,
  clientSecret: string,
  tenantId: string
): Promise<string | null> {
  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://api.botframework.com/.default',
      grant_type: 'client_credentials',
    }),
  });

  if (!response.ok) return null;
  const data = await response.json();
  return data.access_token;
}

// Inline helper: render template blocks with variables
function renderBlocks(
  blocks: unknown[],
  vars: Record<string, string | number | null | undefined>
): unknown[] {
  let json = JSON.stringify(blocks);
  for (const [key, value] of Object.entries(vars)) {
    json = json.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value ?? ''));
  }
  return JSON.parse(json);
}

// Helper: render an Adaptive Card template with variables
function renderAdaptiveCard(
  template: Record<string, unknown>,
  vars: Record<string, string | number | null | undefined>
): Record<string, unknown> {
  let json = JSON.stringify(template);
  for (const [key, value] of Object.entries(vars)) {
    json = json.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value ?? ''));
  }
  return JSON.parse(json);
}

// Helper: Get appropriate greeting based on user's timezone
function getGreeting(timezone: string): string {
  try {
    const userTime = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    }).format(new Date());
    const hour = parseInt(userTime, 10);

    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    if (hour < 21) return 'Good evening';
    return 'Hey';
  } catch {
    return 'Hey';
  }
}

// Helper: Build interactive Slack action items blocks
function buildActionItemBlocks(
  firstName: string,
  timezone: string,
  pendingActions: PendingActionItem[],
  portalUrl: string
): unknown[] {
  const greeting = getGreeting(timezone);

  const blocks: unknown[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${greeting}, ${firstName}!* :wave:\n\nHere are your coaching action items:`,
      },
    },
    {
      type: 'divider',
    },
  ];

  for (const action of pendingActions) {
    blocks.push({
      type: 'section',
      block_id: `action_${action.id}`,
      text: {
        type: 'mrkdwn',
        text: `☐ ${action.action_text}`,
      },
      accessory: {
        type: 'button',
        text: {
          type: 'plain_text',
          text: '✓ Done',
          emoji: true,
        },
        style: 'primary',
        action_id: 'complete_action_item',
        value: action.id,
      },
    });
  }

  blocks.push(
    {
      type: 'divider',
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `${pendingActions.length} pending item${pendingActions.length > 1 ? 's' : ''} • <${portalUrl}|Open Portal>`,
        },
      ],
    }
  );

  return blocks;
}

// Helper: Build interactive Teams Adaptive Card for action items
function buildTeamsActionItemsCard(
  firstName: string,
  pendingActions: PendingActionItem[],
  portalUrl: string
): Record<string, unknown> {
  const bodyItems: Record<string, unknown>[] = [
    {
      type: 'TextBlock',
      text: `Hey ${firstName}! Here are your coaching action items:`,
      weight: 'Bolder',
      size: 'Medium',
      wrap: true,
    },
  ];

  for (const action of pendingActions) {
    bodyItems.push({
      type: 'ColumnSet',
      columns: [
        {
          type: 'Column',
          width: 'stretch',
          items: [
            {
              type: 'TextBlock',
              text: action.action_text,
              wrap: true,
            },
          ],
        },
        {
          type: 'Column',
          width: 'auto',
          items: [
            {
              type: 'ActionSet',
              actions: [
                {
                  type: 'Action.Submit',
                  title: 'Done',
                  style: 'positive',
                  data: {
                    action: 'complete_action_item',
                    reference_id: action.id,
                  },
                },
              ],
            },
          ],
        },
      ],
    });
  }

  bodyItems.push({
    type: 'TextBlock',
    text: `${pendingActions.length} pending item${pendingActions.length > 1 ? 's' : ''}`,
    size: 'Small',
    isSubtle: true,
    spacing: 'Medium',
  });

  return {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.4',
    body: bodyItems,
    actions: [
      {
        type: 'Action.OpenUrl',
        title: 'Open Portal',
        url: portalUrl,
      },
    ],
  };
}

interface PendingActionItem {
  id: string;
  action_text: string;
  coach_name: string | null;
  created_at: string;
}

interface NudgeTemplate {
  nudge_type: string;
  message_blocks: { blocks: unknown[] };
  teams_blocks: Record<string, unknown> | null;
}

// Unified connection info from get_employee_messaging_connection RPC
interface MessagingConnection {
  channel: 'slack' | 'teams';
  user_id: string;
  dm_channel_id: string;
  service_url: string | null;
  nudge_enabled: boolean;
  nudge_frequency: string;
  preferred_time: string;
  timezone: string;
  team_or_tenant_id: string;
  bot_token: string | null;
}

/**
 * Send a nudge to the appropriate channel (Slack or Teams).
 * Returns the message ID (Slack ts or Teams activity ID).
 */
async function sendNudge(
  conn: MessagingConnection,
  slackBlocks: unknown[],
  teamsCard: Record<string, unknown>,
  fallbackText: string
): Promise<{ ok: boolean; messageId?: string; channelId: string }> {
  if (conn.channel === 'teams') {
    // Get a fresh bot token for Teams
    const clientId = Deno.env.get('TEAMS_CLIENT_ID');
    const clientSecret = Deno.env.get('TEAMS_CLIENT_SECRET');

    if (!clientId || !clientSecret || !conn.service_url) {
      return { ok: false, channelId: conn.dm_channel_id };
    }

    const appTenantId = Deno.env.get('TEAMS_APP_TENANT_ID') || conn.team_or_tenant_id;
    const botToken = await getBotAccessToken(clientId, clientSecret, appTenantId);
    if (!botToken) {
      return { ok: false, channelId: conn.dm_channel_id };
    }

    const result = await sendTeamsMessage(botToken, conn.service_url, conn.dm_channel_id, teamsCard);
    return {
      ok: result.ok,
      messageId: result.activityId,
      channelId: conn.dm_channel_id,
    };
  } else {
    // Slack
    if (!conn.bot_token) {
      return { ok: false, channelId: conn.dm_channel_id };
    }

    const result = await sendSlackMessage(conn.bot_token, {
      channel: conn.dm_channel_id,
      blocks: slackBlocks,
      text: fallbackText,
    });

    return {
      ok: result.ok,
      messageId: result.ts,
      channelId: conn.dm_channel_id,
    };
  }
}

Deno.serve(async (req) => {
  // Allow manual trigger via POST or scheduled via GET
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  const startTime = Date.now();
  const results = {
    daily_digests_sent: 0,
    weekly_digests_sent: 0,
    goal_checkins_sent: 0,
    session_preps_sent: 0,
    errors: 0,
  };

  try {
    const supabase = getSupabaseClient();
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday

    // Get nudge templates (now including teams_blocks)
    const { data: templates } = await supabase
      .from('nudge_templates')
      .select('nudge_type, message_blocks, teams_blocks')
      .eq('is_default', true);

    const templateMap = new Map<string, NudgeTemplate>();
    templates?.forEach((t: NudgeTemplate) => templateMap.set(t.nudge_type, t));

    // ============================================
    // 1. DAILY ACTION ITEM DIGEST
    // Query all connected users (both Slack and Teams) with daily frequency
    // ============================================

    // Get Slack daily users
    const { data: slackDailyUsers } = await supabase
      .from('employee_slack_connections')
      .select('employee_email, slack_user_id, slack_dm_channel_id, slack_team_id, nudge_frequency, preferred_time, timezone')
      .eq('nudge_enabled', true)
      .eq('nudge_frequency', 'daily');

    // Get Teams daily users
    const { data: teamsDailyUsers } = await supabase
      .from('employee_teams_connections')
      .select('employee_email, teams_user_id, conversation_id, tenant_id, service_url, nudge_frequency, preferred_time, timezone')
      .eq('nudge_enabled', true)
      .eq('nudge_frequency', 'daily');

    // Normalize into unified connections
    const dailyConnections: { email: string; conn: MessagingConnection }[] = [];

    if (slackDailyUsers) {
      for (const u of slackDailyUsers) {
        // Fetch bot token for this Slack team
        const { data: inst } = await supabase
          .from('slack_installations')
          .select('bot_token')
          .eq('team_id', u.slack_team_id)
          .single();

        dailyConnections.push({
          email: u.employee_email,
          conn: {
            channel: 'slack',
            user_id: u.slack_user_id,
            dm_channel_id: u.slack_dm_channel_id,
            service_url: null,
            nudge_enabled: true,
            nudge_frequency: u.nudge_frequency,
            preferred_time: u.preferred_time,
            timezone: u.timezone,
            team_or_tenant_id: u.slack_team_id,
            bot_token: inst?.bot_token || null,
          },
        });
      }
    }

    if (teamsDailyUsers) {
      for (const u of teamsDailyUsers) {
        dailyConnections.push({
          email: u.employee_email,
          conn: {
            channel: 'teams',
            user_id: u.teams_user_id,
            dm_channel_id: u.conversation_id,
            service_url: u.service_url,
            nudge_enabled: true,
            nudge_frequency: u.nudge_frequency,
            preferred_time: u.preferred_time,
            timezone: u.timezone,
            team_or_tenant_id: u.tenant_id,
            bot_token: null,
          },
        });
      }
    }

    if (dailyConnections.length > 0) {
      console.log(`Processing ${dailyConnections.length} daily digest users (Slack + Teams)`);

      for (const { email, conn } of dailyConnections) {
        try {
          if (!isAppropriateTime(conn.preferred_time, conn.timezone)) continue;

          // Check if we already sent a daily digest today
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);

          const { data: existingNudge } = await supabase
            .from('nudges')
            .select('id')
            .eq('employee_email', email.toLowerCase())
            .eq('nudge_type', 'daily_digest')
            .gte('sent_at', todayStart.toISOString())
            .limit(1);

          if (existingNudge && existingNudge.length > 0) continue;

          // Get pending action items
          const { data: pendingActions } = await supabase
            .from('action_items')
            .select('id, action_text, coach_name, created_at')
            .ilike('email', email)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(5);

          if (!pendingActions || pendingActions.length === 0) continue;

          // Get first name
          const { data: employee } = await supabase
            .from('employee_manager')
            .select('first_name')
            .ilike('company_email', email)
            .single();

          const firstName = employee?.first_name || 'there';
          const portalUrl = Deno.env.get('PORTAL_URL') || 'https://portal.booncoaching.com';

          // Build platform-specific content
          const slackBlocks = buildActionItemBlocks(firstName, conn.timezone || 'America/New_York', pendingActions, portalUrl);
          const teamsCard = buildTeamsActionItemsCard(firstName, pendingActions, portalUrl);
          const fallbackText = `You have ${pendingActions.length} pending coaching action items`;

          const result = await sendNudge(conn, slackBlocks, teamsCard, fallbackText);

          if (result.ok && result.messageId) {
            await supabase.from('nudges').insert({
              employee_email: email.toLowerCase(),
              nudge_type: 'daily_digest',
              reference_id: null,
              reference_type: 'action_items',
              message_id: result.messageId,
              channel_id: result.channelId,
              channel: conn.channel,
            });

            results.daily_digests_sent++;
            console.log(`Sent daily digest via ${conn.channel} to ${email}`);
          } else {
            results.errors++;
          }
        } catch (error) {
          console.error(`Error processing daily digest for ${email}:`, error);
          results.errors++;
        }
      }
    }

    // ============================================
    // 2. WEEKLY DIGEST (Monday only)
    // ============================================
    if (dayOfWeek === 1) {
      const weeklyConnections: { email: string; conn: MessagingConnection }[] = [];

      const { data: slackWeeklyUsers } = await supabase
        .from('employee_slack_connections')
        .select('employee_email, slack_user_id, slack_dm_channel_id, slack_team_id, nudge_frequency, preferred_time, timezone')
        .eq('nudge_enabled', true)
        .eq('nudge_frequency', 'weekly');

      const { data: teamsWeeklyUsers } = await supabase
        .from('employee_teams_connections')
        .select('employee_email, teams_user_id, conversation_id, tenant_id, service_url, nudge_frequency, preferred_time, timezone')
        .eq('nudge_enabled', true)
        .eq('nudge_frequency', 'weekly');

      if (slackWeeklyUsers) {
        for (const u of slackWeeklyUsers) {
          const { data: inst } = await supabase
            .from('slack_installations')
            .select('bot_token')
            .eq('team_id', u.slack_team_id)
            .single();

          weeklyConnections.push({
            email: u.employee_email,
            conn: {
              channel: 'slack',
              user_id: u.slack_user_id,
              dm_channel_id: u.slack_dm_channel_id,
              service_url: null,
              nudge_enabled: true,
              nudge_frequency: u.nudge_frequency,
              preferred_time: u.preferred_time,
              timezone: u.timezone,
              team_or_tenant_id: u.slack_team_id,
              bot_token: inst?.bot_token || null,
            },
          });
        }
      }

      if (teamsWeeklyUsers) {
        for (const u of teamsWeeklyUsers) {
          weeklyConnections.push({
            email: u.employee_email,
            conn: {
              channel: 'teams',
              user_id: u.teams_user_id,
              dm_channel_id: u.conversation_id,
              service_url: u.service_url,
              nudge_enabled: true,
              nudge_frequency: u.nudge_frequency,
              preferred_time: u.preferred_time,
              timezone: u.timezone,
              team_or_tenant_id: u.tenant_id,
              bot_token: null,
            },
          });
        }
      }

      if (weeklyConnections.length > 0) {
        console.log(`Processing ${weeklyConnections.length} weekly digest users`);

        for (const { email, conn } of weeklyConnections) {
          try {
            if (!isAppropriateTime(conn.preferred_time, conn.timezone)) continue;

            const weekStart = new Date();
            weekStart.setDate(weekStart.getDate() - weekStart.getDay());
            weekStart.setHours(0, 0, 0, 0);

            const { data: existingNudge } = await supabase
              .from('nudges')
              .select('id')
              .eq('employee_email', email.toLowerCase())
              .eq('nudge_type', 'weekly_digest')
              .gte('sent_at', weekStart.toISOString())
              .limit(1);

            if (existingNudge && existingNudge.length > 0) continue;

            const { data: pendingActions } = await supabase
              .from('action_items')
              .select('id, action_text, coach_name, created_at')
              .ilike('email', email)
              .eq('status', 'pending')
              .order('created_at', { ascending: false })
              .limit(5);

            if (!pendingActions || pendingActions.length === 0) continue;

            const { data: employee } = await supabase
              .from('employee_manager')
              .select('first_name')
              .ilike('company_email', email)
              .single();

            const firstName = employee?.first_name || 'there';
            const portalUrl = Deno.env.get('PORTAL_URL') || 'https://portal.booncoaching.com';

            const slackBlocks = buildActionItemBlocks(firstName, conn.timezone || 'America/New_York', pendingActions, portalUrl);
            const teamsCard = buildTeamsActionItemsCard(firstName, pendingActions, portalUrl);
            const fallbackText = `Weekly coaching digest: ${pendingActions.length} action items`;

            const result = await sendNudge(conn, slackBlocks, teamsCard, fallbackText);

            if (result.ok && result.messageId) {
              await supabase.from('nudges').insert({
                employee_email: email.toLowerCase(),
                nudge_type: 'weekly_digest',
                reference_id: null,
                reference_type: 'action_items',
                message_id: result.messageId,
                channel_id: result.channelId,
                channel: conn.channel,
              });

              results.weekly_digests_sent++;
              console.log(`Sent weekly digest via ${conn.channel} to ${email}`);
            } else {
              results.errors++;
            }
          } catch (error) {
            console.error('Error processing weekly digest:', error);
            results.errors++;
          }
        }
      }
    }

    // ============================================
    // 3. GOAL CHECK-INS (3 days post-session)
    // For all users with nudges enabled (either platform)
    // ============================================
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const fourDaysAgo = new Date();
    fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);

    const { data: recentSessions } = await supabase
      .from('session_tracking')
      .select(`
        id,
        employee_id,
        goals,
        coach_name,
        employee_manager!inner(company_email, first_name)
      `)
      .eq('status', 'Completed')
      .gte('session_date', fourDaysAgo.toISOString().split('T')[0])
      .lte('session_date', threeDaysAgo.toISOString().split('T')[0])
      .not('goals', 'is', null);

    if (recentSessions && recentSessions.length > 0) {
      console.log(`Found ${recentSessions.length} sessions for goal check-in`);

      for (const session of recentSessions) {
        try {
          const employeeData = (session as any).employee_manager;
          const email = employeeData?.company_email;
          if (!email) continue;

          // Check if already nudged for this session (in unified nudges table)
          const { data: existingNudge } = await supabase
            .from('nudges')
            .select('id')
            .eq('employee_email', email.toLowerCase())
            .eq('nudge_type', 'goal_checkin')
            .eq('reference_id', String(session.id))
            .single();

          if (existingNudge) continue;

          // Use unified messaging connection RPC
          const { data: connData } = await supabase.rpc('get_employee_messaging_connection', {
            lookup_email: email,
          });

          if (!connData || connData.length === 0) continue;
          const conn: MessagingConnection = connData[0];

          if (!isAppropriateTime(conn.preferred_time, conn.timezone)) continue;

          const template = templateMap.get('goal_checkin');
          const templateVars = {
            first_name: employeeData.first_name,
            coach_name: session.coach_name || 'your coach',
            goals: session.goals,
            session_id: String(session.id),
          };

          // Build platform-specific content
          let slackBlocks;
          if (template) {
            slackBlocks = renderBlocks(template.message_blocks.blocks, templateVars);
          } else {
            slackBlocks = [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `*Hey ${employeeData.first_name}!* :wave:\n\nA few days ago you set this goal with ${session.coach_name || 'your coach'}:\n\n_"${session.goals}"_\n\nHow's it going?`,
                },
              },
            ];
          }

          let teamsCard: Record<string, unknown>;
          if (template?.teams_blocks) {
            teamsCard = renderAdaptiveCard(template.teams_blocks, templateVars);
          } else {
            teamsCard = {
              type: 'AdaptiveCard',
              $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
              version: '1.4',
              body: [
                { type: 'TextBlock', text: 'Quick Check-in', weight: 'Bolder', size: 'Medium', color: 'Accent' },
                { type: 'TextBlock', text: `Hey ${employeeData.first_name}! A few days ago you set this goal with ${session.coach_name || 'your coach'}:`, wrap: true },
                { type: 'TextBlock', text: session.goals || '', wrap: true, weight: 'Bolder' },
              ],
              actions: [
                { type: 'Action.Submit', title: 'Great progress', style: 'positive', data: { action: 'progress_great', reference_id: String(session.id) } },
                { type: 'Action.Submit', title: 'Slow but moving', data: { action: 'progress_slow', reference_id: String(session.id) } },
                { type: 'Action.Submit', title: 'Stuck', data: { action: 'progress_stuck', reference_id: String(session.id) } },
              ],
            };
          }

          const result = await sendNudge(conn, slackBlocks, teamsCard, "How's progress on your coaching goals?");

          if (result.ok && result.messageId) {
            await supabase.from('nudges').insert({
              employee_email: email.toLowerCase(),
              nudge_type: 'goal_checkin',
              reference_id: String(session.id),
              reference_type: 'session',
              message_id: result.messageId,
              channel_id: result.channelId,
              channel: conn.channel,
            });

            results.goal_checkins_sent++;
            console.log(`Sent goal check-in via ${conn.channel} to ${email}`);
          } else {
            results.errors++;
          }
        } catch (error) {
          console.error('Error processing session:', error);
          results.errors++;
        }
      }
    }

    // ============================================
    // 4. SESSION PREP REMINDERS (24h before)
    // ============================================
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const { data: upcomingSessions } = await supabase
      .from('session_tracking')
      .select(`
        id,
        employee_id,
        coach_name,
        employee_manager!inner(company_email, first_name)
      `)
      .eq('status', 'Upcoming')
      .eq('session_date', tomorrowStr);

    if (upcomingSessions && upcomingSessions.length > 0) {
      console.log(`Found ${upcomingSessions.length} sessions tomorrow`);

      for (const session of upcomingSessions) {
        try {
          const employeeData = (session as any).employee_manager;
          const email = employeeData?.company_email;
          if (!email) continue;

          const { data: existingNudge } = await supabase
            .from('nudges')
            .select('id')
            .eq('employee_email', email.toLowerCase())
            .eq('nudge_type', 'session_prep')
            .eq('reference_id', String(session.id))
            .single();

          if (existingNudge) continue;

          const { data: connData } = await supabase.rpc('get_employee_messaging_connection', {
            lookup_email: email,
          });

          if (!connData || connData.length === 0) continue;
          const conn: MessagingConnection = connData[0];

          if (!isAppropriateTime(conn.preferred_time, conn.timezone)) continue;

          const template = templateMap.get('session_prep');
          const portalUrl = Deno.env.get('PORTAL_URL') || 'https://portal.booncoaching.com';
          const templateVars = {
            first_name: employeeData.first_name,
            coach_name: session.coach_name || 'your coach',
            session_id: String(session.id),
            portal_url: portalUrl,
          };

          let slackBlocks;
          if (template) {
            slackBlocks = renderBlocks(template.message_blocks.blocks, templateVars);
          } else {
            slackBlocks = [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `*Hey ${employeeData.first_name}!* :calendar:\n\nYou have a coaching session with ${session.coach_name || 'your coach'} tomorrow!\n\nTake a moment to think about what you want to focus on.`,
                },
              },
              {
                type: 'actions',
                elements: [
                  {
                    type: 'button',
                    text: { type: 'plain_text', text: 'Prepare for Session' },
                    url: portalUrl,
                  },
                ],
              },
            ];
          }

          let teamsCard: Record<string, unknown>;
          if (template?.teams_blocks) {
            teamsCard = renderAdaptiveCard(template.teams_blocks, templateVars);
          } else {
            teamsCard = {
              type: 'AdaptiveCard',
              $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
              version: '1.4',
              body: [
                { type: 'TextBlock', text: 'Session Tomorrow', weight: 'Bolder', size: 'Medium', color: 'Accent' },
                { type: 'TextBlock', text: `Hey ${employeeData.first_name}! You have a coaching session with ${session.coach_name || 'your coach'} tomorrow.`, wrap: true },
                { type: 'TextBlock', text: 'Quick prep questions:', weight: 'Bolder', spacing: 'Medium' },
                { type: 'TextBlock', text: "- What's been on your mind this week?\n- Any wins to celebrate?\n- What do you want to focus on?", wrap: true, spacing: 'Small' },
              ],
              actions: [
                { type: 'Action.OpenUrl', title: 'Open Session Prep', url: `${portalUrl}/session-prep` },
              ],
            };
          }

          const result = await sendNudge(conn, slackBlocks, teamsCard, 'You have a coaching session tomorrow!');

          if (result.ok && result.messageId) {
            await supabase.from('nudges').insert({
              employee_email: email.toLowerCase(),
              nudge_type: 'session_prep',
              reference_id: String(session.id),
              reference_type: 'session',
              message_id: result.messageId,
              channel_id: result.channelId,
              channel: conn.channel,
            });

            results.session_preps_sent++;
            console.log(`Sent session prep via ${conn.channel} to ${email}`);
          } else {
            results.errors++;
          }
        } catch (error) {
          console.error('Error processing upcoming session:', error);
          results.errors++;
        }
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('='.repeat(40));
    console.log('Nudge Scheduler Complete');
    console.log(`Daily digests sent: ${results.daily_digests_sent}`);
    console.log(`Weekly digests sent: ${results.weekly_digests_sent}`);
    console.log(`Goal check-ins sent: ${results.goal_checkins_sent}`);
    console.log(`Session preps sent: ${results.session_preps_sent}`);
    console.log(`Errors: ${results.errors}`);
    console.log(`Duration: ${duration}s`);
    console.log('='.repeat(40));

    return new Response(
      JSON.stringify({
        success: true,
        results,
        duration: `${duration}s`,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Nudge scheduler error:', error);
    return new Response(
      JSON.stringify({ error: 'Scheduler failed', details: String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Check if current time matches the user's preferred hour
 * (must be the exact hour they specified)
 */
function isAppropriateTime(preferredTime: string, timezone: string): boolean {
  try {
    const now = new Date();

    const userTime = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    }).format(now);

    const currentHour = parseInt(userTime, 10);
    const preferredHour = parseInt(preferredTime.split(':')[0], 10);

    return currentHour === preferredHour;
  } catch {
    return true;
  }
}
