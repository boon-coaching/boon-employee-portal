// Teams Interactions Edge Function
// Handles button clicks (Action.Submit) from Adaptive Cards in Microsoft Teams
// This is the Bot Framework messaging endpoint

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

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
      // Bot was added to a conversation, acknowledge it
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
