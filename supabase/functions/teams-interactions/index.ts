// Teams Interactions Edge Function
// Handles button clicks (Action.Submit) from Adaptive Cards in Microsoft Teams
// This is the Bot Framework messaging endpoint

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { getBotAccessToken, sendTeamsMessage } from '../_shared/teams.ts';

// Inline helper: create Supabase client
function getSupabaseClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const activity = await req.json();

    // Bot Framework sends different activity types
    // 'invoke' = Adaptive Card Action.Submit
    // 'message' = user typed a message
    // 'conversationUpdate' = bot added/removed from conversation

    if (activity.type === 'conversationUpdate') {
      const botId = Deno.env.get('TEAMS_BOT_ID') || '4a2f6756-70f8-4802-ba89-eefe3a0aa790';
      // Bot Framework sends member IDs with a "28:" prefix
      const botWasAdded = activity.membersAdded?.some(
        (member: { id: string }) =>
          member.id === botId ||
          member.id === `28:${botId}` ||
          member.id.endsWith(botId)
      );

      console.log('[conversationUpdate] membersAdded:', JSON.stringify(activity.membersAdded), 'botId:', botId, 'botWasAdded:', botWasAdded);

      if (botWasAdded) {
        try {
          const clientId = Deno.env.get('TEAMS_CLIENT_ID')!;
          const clientSecret = Deno.env.get('TEAMS_CLIENT_SECRET')!;
          const tenantId = Deno.env.get('TEAMS_APP_TENANT_ID')!;

          console.log('[welcome] Acquiring bot token for tenant:', tenantId);
          const tokenResult = await getBotAccessToken(clientId, clientSecret, tenantId);
          if (tokenResult) {
            const serviceUrl = activity.serviceUrl;
            const conversationId = activity.conversation?.id;

            console.log('[welcome] Sending welcome card to:', conversationId);
            if (serviceUrl && conversationId) {
              const result = await sendTeamsMessage(tokenResult.token, serviceUrl, conversationId, buildWelcomeCard());
              console.log('[welcome] Send result:', JSON.stringify(result));
            }

            // Backfill conversation_id on the matching employee_teams_connections row,
            // if one exists. This handles the case where the user completes OAuth
            // before (or after) installing the bot on their personal scope.
            const activityTenantId: string | undefined = activity.channelData?.tenant?.id;
            const aadUserId: string | undefined =
              activity.from?.aadObjectId ||
              activity.membersAdded?.find((m: { id?: string; aadObjectId?: string }) => m.aadObjectId)?.aadObjectId;

            if (serviceUrl && conversationId && activityTenantId && aadUserId) {
              try {
                const supabase = getSupabaseClient();
                const { error: backfillError, data: updated } = await supabase
                  .from('employee_teams_connections')
                  .update({
                    conversation_id: conversationId,
                    service_url: serviceUrl,
                  })
                  .eq('tenant_id', activityTenantId)
                  .eq('teams_user_id', aadUserId)
                  .select('id');
                if (backfillError) {
                  console.error('[welcome] conversation_id backfill failed:', backfillError);
                } else {
                  console.log('[welcome] conversation_id backfilled for rows:', updated?.length ?? 0);
                }
              } catch (err) {
                console.error('[welcome] backfill threw:', err);
              }
            } else {
              console.log('[welcome] Skipping backfill — missing tenant or aadObjectId', {
                hasTenant: !!activityTenantId,
                hasAadUserId: !!aadUserId,
              });
            }
          } else {
            console.error('[welcome] Failed to acquire bot token');
          }
        } catch (err) {
          console.error('[welcome] Failed to send welcome message:', err);
        }
      }

      return new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Plain text message from the user (no Adaptive Card submission).
    // Required by Teams Store policy #1140.4.3.3: bot must respond to
    // commands like Hi, Hello, Help with valid responses.
    if (activity.type === 'message' && activity.text && !activity.value) {
      console.log('[message] Received text:', activity.text, 'from conversation:', activity.conversation?.id);
      try {
        const clientId = Deno.env.get('TEAMS_CLIENT_ID')!;
        const clientSecret = Deno.env.get('TEAMS_CLIENT_SECRET')!;
        const tenantId = Deno.env.get('TEAMS_APP_TENANT_ID')!;
        const serviceUrl = activity.serviceUrl;
        const conversationId = activity.conversation?.id;

        console.log('[message] serviceUrl:', serviceUrl, 'hasClientId:', !!clientId, 'hasTenantId:', !!tenantId);

        if (serviceUrl && conversationId) {
          const tokenResult = await getBotAccessToken(clientId, clientSecret, tenantId);
          if (tokenResult) {
            const text = String(activity.text).trim().toLowerCase().replace(/[^a-z0-9\s]/g, '');
            const greetings = ['hi', 'hello', 'hey', 'help', 'menu', 'start', 'get started'];
            const isGreeting = greetings.some((g) => text === g || text.startsWith(g + ' ') || text.endsWith(' ' + g));
            const card = isGreeting ? buildWelcomeCard() : buildFallbackCard();
            console.log('[message] Sending', isGreeting ? 'welcome' : 'fallback', 'card');
            const result = await sendTeamsMessage(tokenResult.token, serviceUrl, conversationId, card);
            console.log('[message] Send result:', JSON.stringify(result));
          } else {
            console.error('[message] Failed to acquire bot token');
          }
        } else {
          console.error('[message] Missing serviceUrl or conversationId');
        }
      } catch (err) {
        console.error('[message] Failed to respond to text message:', err);
      }

      return new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (activity.type === 'invoke' || (activity.type === 'message' && activity.value)) {
      // Adaptive Card Action.Submit sends data in activity.value
      const actionData = activity.value;

      if (!actionData || !actionData.action) {
        return invokeResponse(200, { status: 'no_action' });
      }

      const supabase = getSupabaseClient();
      const conversationId = activity.conversation?.id;
      const actionType = actionData.action;
      const referenceId = actionData.reference_id;

      // Handle complete_action_item
      if (actionType === 'complete_action_item') {
        if (referenceId) {
          const { error: updateError } = await supabase
            .from('action_items')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
            })
            .eq('id', referenceId);

          if (updateError) {
            console.error('Failed to mark action complete:', updateError);
          }
        }

        // Record the nudge response
        await recordNudgeResponse(supabase, conversationId, 'complete_action_item', referenceId);

        // Return updated card showing completion
        return invokeResponse(200, {
          statusCode: 200,
          type: 'application/vnd.microsoft.card.adaptive',
          value: buildCompletionCard('Done! Nice work completing your action item.'),
        });
      }

      // Handle action_done (legacy template-based)
      if (actionType === 'action_done') {
        if (referenceId) {
          await supabase
            .from('action_items')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
            })
            .eq('id', referenceId);
        }

        await recordNudgeResponse(supabase, conversationId, 'action_done', referenceId);

        return invokeResponse(200, {
          statusCode: 200,
          type: 'application/vnd.microsoft.card.adaptive',
          value: buildCompletionCard('Done! Nice work completing your action item.'),
        });
      }

      // Handle action_in_progress
      if (actionType === 'action_in_progress') {
        await recordNudgeResponse(supabase, conversationId, 'action_in_progress', referenceId);

        return invokeResponse(200, {
          statusCode: 200,
          type: 'application/vnd.microsoft.card.adaptive',
          value: buildCompletionCard('Great, keep at it! Every step counts.'),
        });
      }

      // Handle action_reschedule
      if (actionType === 'action_reschedule') {
        await recordNudgeResponse(supabase, conversationId, 'action_reschedule', referenceId);

        return invokeResponse(200, {
          statusCode: 200,
          type: 'application/vnd.microsoft.card.adaptive',
          value: buildCompletionCard('No problem. Discuss a new timeline with your coach.'),
        });
      }

      // Handle need_help
      if (actionType === 'need_help') {
        await recordNudgeResponse(supabase, conversationId, 'need_help', referenceId);

        return invokeResponse(200, {
          statusCode: 200,
          type: 'application/vnd.microsoft.card.adaptive',
          value: buildCompletionCard("That's okay. Bring this to your next session, your coach can help."),
        });
      }

      // Handle progress check-in responses
      if (actionType === 'progress_great' || actionType === 'progress_slow' || actionType === 'progress_stuck') {
        const messages: Record<string, string> = {
          progress_great: 'Awesome! Keep that momentum going!',
          progress_slow: 'Progress is progress! Every step counts.',
          progress_stuck: "That's okay. Bring this to your next session, your coach can help.",
        };

        await recordNudgeResponse(supabase, conversationId, actionType, referenceId);

        return invokeResponse(200, {
          statusCode: 200,
          type: 'application/vnd.microsoft.card.adaptive',
          value: buildCompletionCard(`Thanks for checking in! ${messages[actionType]}`),
        });
      }

      // Unknown action
      console.log('Unknown Teams action:', actionType);
      return invokeResponse(200, { status: 'unknown_action' });
    }

    // Default: acknowledge the activity
    return new Response('', { status: 200 });

  } catch (error) {
    console.error('Teams interaction handler error:', error);
    // Always return 200 to Bot Framework to avoid retries
    return new Response('', { status: 200 });
  }
});

/**
 * Build the welcome Adaptive Card shown when the bot is first added.
 */
function buildWelcomeCard(): Record<string, unknown> {
  return {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.4',
    body: [
      {
        type: 'TextBlock',
        text: 'Welcome to Boon Coaching!',
        weight: 'Bolder',
        size: 'Large',
        wrap: true,
      },
      {
        type: 'TextBlock',
        text: "I'm your coaching companion. I'll send you nudges and reminders to help you get the most out of your coaching program.",
        wrap: true,
        spacing: 'Medium',
      },
      {
        type: 'TextBlock',
        text: 'Here is what I can help with:',
        weight: 'Bolder',
        spacing: 'Medium',
        wrap: true,
      },
      {
        type: 'FactSet',
        facts: [
          { title: 'Action Reminders', value: 'Stay on track with your coaching action items' },
          { title: 'Goal Check-ins', value: 'Regular progress updates on your development goals' },
          { title: 'Session Prep', value: 'Get ready for upcoming coaching sessions' },
        ],
      },
    ],
    actions: [
      {
        type: 'Action.OpenUrl',
        title: 'Open Boon Portal',
        url: 'https://my.boon-health.com',
      },
      {
        type: 'Action.OpenUrl',
        title: 'Get Help',
        url: 'https://www.boon-health.com/teams-support',
      },
      {
        type: 'Action.OpenUrl',
        title: 'Contact Us',
        url: 'https://www.boon-health.com/contact',
      },
    ],
  };
}

/**
 * Fallback card shown when the user types something we don't recognize.
 * Points them toward the supported commands.
 */
function buildFallbackCard(): Record<string, unknown> {
  return {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.4',
    body: [
      {
        type: 'TextBlock',
        text: "I'm a notification companion for your Boon coaching program.",
        wrap: true,
        weight: 'Bolder',
      },
      {
        type: 'TextBlock',
        text: "Type **help** to see what I can do, or use the buttons below to jump to the portal.",
        wrap: true,
        spacing: 'Small',
      },
    ],
    actions: [
      {
        type: 'Action.OpenUrl',
        title: 'Open Boon Portal',
        url: 'https://my.boon-health.com',
      },
      {
        type: 'Action.OpenUrl',
        title: 'Get Help',
        url: 'https://www.boon-health.com/teams-support',
      },
    ],
  };
}

/**
 * Build a simple Adaptive Card for post-action confirmation.
 */
function buildCompletionCard(message: string): Record<string, unknown> {
  return {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.4',
    body: [
      {
        type: 'TextBlock',
        text: message,
        wrap: true,
        weight: 'Bolder',
        color: 'Good',
      },
    ],
  };
}

/**
 * Build a Bot Framework invoke response (for Adaptive Card updates).
 */
function invokeResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Record a nudge response in the database.
 * Uses conversation_id as the channel_id for Teams messages.
 */
async function recordNudgeResponse(
  supabase: ReturnType<typeof getSupabaseClient>,
  conversationId: string,
  response: string,
  _referenceId?: string
) {
  try {
    // For Teams, we use conversation_id as channel_id
    // Find the most recent nudge for this conversation and update it
    const { error } = await supabase
      .from('nudges')
      .update({
        response,
        status: 'responded',
        responded_at: new Date().toISOString(),
      })
      .eq('channel_id', conversationId)
      .eq('channel', 'teams')
      .is('responded_at', null)
      .order('sent_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Failed to record nudge response:', error);
    }
  } catch (error) {
    console.error('Failed to record nudge response:', error);
  }
}
