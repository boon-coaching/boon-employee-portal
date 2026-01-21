// Slack Interactions Edge Function (Standalone)
// Handles button clicks from Slack messages

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

// Inline helper: create Supabase client
function getSupabaseClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
}

// Inline helper: verify Slack signature
async function verifySlackSignature(
  signingSecret: string,
  signature: string,
  timestamp: string,
  body: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(signingSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const baseString = `v0:${timestamp}:${body}`;
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(baseString));
  const signatureArray = Array.from(new Uint8Array(signatureBuffer));
  const computedSignature = 'v0=' + signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return computedSignature === signature;
}

// Inline helper: update Slack message
async function updateSlackMessage(
  botToken: string,
  channel: string,
  ts: string,
  blocks: unknown[]
): Promise<{ ok: boolean; error?: string }> {
  const response = await fetch('https://slack.com/api/chat.update', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${botToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      channel,
      ts,
      blocks,
      text: 'Action items updated',
    }),
  });
  return response.json();
}

Deno.serve(async (req) => {
  // Slack sends interactions as form data
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const body = await req.text();

    // Verify Slack signature
    const signature = req.headers.get('x-slack-signature') || '';
    const timestamp = req.headers.get('x-slack-request-timestamp') || '';
    const signingSecret = Deno.env.get('SLACK_SIGNING_SECRET') || '';

    const isValid = await verifySlackSignature(signingSecret, signature, timestamp, body);

    if (!isValid) {
      console.error('Invalid Slack signature');
      return new Response('Invalid signature', { status: 401 });
    }

    // Parse the payload
    const params = new URLSearchParams(body);
    const payloadStr = params.get('payload');

    if (!payloadStr) {
      return new Response('Missing payload', { status: 400 });
    }

    const payload = JSON.parse(payloadStr);
    const { type, actions, message, channel } = payload;

    // Handle URL verification (for initial setup)
    if (type === 'url_verification') {
      return new Response(JSON.stringify({ challenge: payload.challenge }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Handle block actions (button clicks)
    if (type === 'block_actions' && actions?.length > 0) {
      const action = actions[0];
      const actionId = action.action_id;

      const supabase = getSupabaseClient();

      // Get bot token for this team
      const { data: installation } = await supabase
        .from('slack_installations')
        .select('bot_token')
        .eq('team_id', payload.team?.id)
        .single();

      if (!installation?.bot_token) {
        console.error('No installation found for team:', payload.team?.id);
        return new Response('', { status: 200 });
      }

      // Handle complete_action_item (new interactive handler)
      if (actionId === 'complete_action_item') {
        const actionItemId = action.value;

        // Mark action item as completed in database
        const { error: updateError } = await supabase
          .from('action_items')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
          })
          .eq('id', actionItemId);

        if (updateError) {
          console.error('Failed to mark action complete:', updateError);
        }

        // Update the message blocks to show this item as completed
        const updatedBlocks = updateBlocksWithCompletion(message.blocks, actionItemId);

        await updateSlackMessage(
          installation.bot_token,
          channel.id,
          message.ts,
          updatedBlocks
        );

        // Record the response
        await recordNudgeResponse(supabase, message.ts, channel.id, 'complete_action_item', actionItemId);

        return new Response('', { status: 200 });
      }

      // Handle legacy action handlers
      const blockId = action.block_id || '';
      const referenceId = blockId.split('_')[1];

      switch (actionId) {
        case 'action_done': {
          // Legacy: Mark action item as completed
          const { error } = await supabase
            .from('action_items')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
            })
            .eq('id', referenceId);

          if (error) {
            console.error('Failed to mark action complete:', error);
          }

          await recordNudgeResponse(supabase, message.ts, channel.id, 'action_done', referenceId);

          await updateSlackMessage(
            installation.bot_token,
            channel.id,
            message.ts,
            [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `:white_check_mark: *Done!* Nice work completing your action item.`,
                },
              },
            ]
          );
          break;
        }

        case 'progress_great':
        case 'progress_slow':
        case 'progress_stuck': {
          const progressEmoji: Record<string, string> = {
            'progress_great': ':rocket:',
            'progress_slow': ':turtle:',
            'progress_stuck': ':construction:',
          };

          const progressMessage: Record<string, string> = {
            'progress_great': "Awesome! Keep that momentum going!",
            'progress_slow': "Progress is progress! Every step counts.",
            'progress_stuck': "That's okay - bring this to your next session. Your coach can help.",
          };

          await recordNudgeResponse(supabase, message.ts, channel.id, actionId, referenceId);

          await updateSlackMessage(
            installation.bot_token,
            channel.id,
            message.ts,
            [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `${progressEmoji[actionId]} *Thanks for checking in!* ${progressMessage[actionId]}`,
                },
              },
            ]
          );
          break;
        }

        default:
          console.log('Unknown action:', actionId);
      }

      return new Response('', { status: 200 });
    }

    // Default acknowledgment
    return new Response('', { status: 200 });

  } catch (error) {
    console.error('Interaction handler error:', error);
    return new Response('', { status: 200 });
  }
});

/**
 * Update message blocks to show a specific action item as completed
 * Changes: ☐ → ✅, removes the button, shows "Done!"
 */
function updateBlocksWithCompletion(blocks: unknown[], completedItemId: string): unknown[] {
  const updatedBlocks: unknown[] = [];
  let completedCount = 0;
  let pendingCount = 0;

  for (const block of blocks) {
    const b = block as Record<string, unknown>;

    // Check if this is an action item block
    if (b.type === 'section' && b.block_id && (b.block_id as string).startsWith('action_')) {
      const blockActionId = (b.block_id as string).replace('action_', '');
      const text = (b.text as Record<string, string>)?.text || '';

      if (blockActionId === completedItemId) {
        // This is the item being completed - mark it done
        const itemText = text.replace('☐ ', '');
        updatedBlocks.push({
          type: 'section',
          block_id: b.block_id,
          text: {
            type: 'mrkdwn',
            text: `✅ ~${itemText}~ Done!`,
          },
          // No accessory button - it's completed
        });
        completedCount++;
      } else if (text.startsWith('✅')) {
        // Already completed item - keep as is
        updatedBlocks.push(block);
        completedCount++;
      } else {
        // Still pending - keep button
        updatedBlocks.push(block);
        pendingCount++;
      }
    } else if (b.type === 'context') {
      // Update the footer with new counts
      // Will be added at the end
    } else {
      // Keep other blocks (header, dividers)
      updatedBlocks.push(block);
    }
  }

  // Add updated footer
  updatedBlocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: pendingCount > 0
          ? `${pendingCount} pending • ${completedCount} completed`
          : `🎉 All done! ${completedCount} item${completedCount > 1 ? 's' : ''} completed`,
      },
    ],
  });

  return updatedBlocks;
}

async function recordNudgeResponse(
  supabase: ReturnType<typeof getSupabaseClient>,
  messageTs: string,
  channelId: string,
  response: string,
  actionItemId?: string
) {
  try {
    // Try to update the nudge record
    const { error } = await supabase
      .from('slack_nudges')
      .update({
        response,
        responded_at: new Date().toISOString(),
      })
      .eq('message_ts', messageTs)
      .eq('channel_id', channelId);

    if (error) {
      console.error('Failed to record nudge response:', error);
    }
  } catch (error) {
    console.error('Failed to record nudge response:', error);
  }
}
