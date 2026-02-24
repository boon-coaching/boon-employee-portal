// Shared Microsoft Teams utilities for Edge Functions
// Mirrors _shared/slack.ts for the Teams Bot Framework integration

import { renderTemplate } from './slack.ts';

export interface TeamsActivity {
  type: string;
  text?: string;
  attachments?: TeamsAttachment[];
}

export interface TeamsAttachment {
  contentType: string;
  content: Record<string, unknown>;
}

export interface TeamsUser {
  id: string;
  displayName: string;
  mail?: string;
  userPrincipalName?: string;
}

/**
 * Get a Bot Framework access token using client credentials flow.
 * Teams bot tokens are short-lived (1hr), so we fetch on demand.
 */
export async function getBotAccessToken(
  clientId: string,
  clientSecret: string,
  tenantId: string
): Promise<{ token: string; expiresAt: Date } | null> {
  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://api.botframework.com/.default',
      grant_type: 'client_credentials',
    }),
  });

  if (!response.ok) {
    console.error('Failed to get bot token:', await response.text());
    return null;
  }

  const data = await response.json();

  return {
    token: data.access_token,
    expiresAt: new Date(Date.now() + (data.expires_in - 60) * 1000), // subtract 60s buffer
  };
}

/**
 * Send a proactive message to a Teams conversation using Adaptive Card.
 * Returns the activity ID (equivalent to Slack's message_ts).
 */
export async function sendTeamsMessage(
  token: string,
  serviceUrl: string,
  conversationId: string,
  card: Record<string, unknown>
): Promise<{ ok: boolean; activityId?: string; error?: string }> {
  const url = `${serviceUrl.replace(/\/$/, '')}/v3/conversations/${conversationId}/activities`;

  const activity: TeamsActivity = {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: card,
      },
    ],
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(activity),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Failed to send Teams message:', errorText);
    return { ok: false, error: errorText };
  }

  const data = await response.json();
  return { ok: true, activityId: data.id };
}

/**
 * Update an existing Teams message (replace the Adaptive Card).
 */
export async function updateTeamsMessage(
  token: string,
  serviceUrl: string,
  conversationId: string,
  activityId: string,
  card: Record<string, unknown>
): Promise<{ ok: boolean; error?: string }> {
  const url = `${serviceUrl.replace(/\/$/, '')}/v3/conversations/${conversationId}/activities/${activityId}`;

  const activity: TeamsActivity = {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: card,
      },
    ],
  };

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(activity),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Failed to update Teams message:', errorText);
    return { ok: false, error: errorText };
  }

  return { ok: true };
}

/**
 * Look up a Teams user by email via Microsoft Graph API.
 * Requires a Graph token (different from Bot Framework token).
 */
export async function lookupTeamsUserByEmail(
  graphToken: string,
  email: string
): Promise<TeamsUser | null> {
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(email)}`,
    {
      headers: {
        'Authorization': `Bearer ${graphToken}`,
      },
    }
  );

  if (!response.ok) {
    console.error('Failed to lookup Teams user:', await response.text());
    return null;
  }

  const data = await response.json();

  return {
    id: data.id,
    displayName: data.displayName,
    mail: data.mail,
    userPrincipalName: data.userPrincipalName,
  };
}

/**
 * Create a proactive 1:1 conversation with a Teams user.
 * This is required before sending proactive messages.
 * Returns the conversation ID.
 */
export async function createProactiveConversation(
  token: string,
  serviceUrl: string,
  tenantId: string,
  userId: string,
  botId: string
): Promise<string | null> {
  const url = `${serviceUrl.replace(/\/$/, '')}/v3/conversations`;

  // Use AAD object ID directly (not 29: prefixed)
  const body = {
    bot: { id: botId },
    members: [{ id: userId }],
    channelData: {
      tenant: { id: tenantId },
    },
    isGroup: false,
  };

  console.log('Creating proactive conversation:', JSON.stringify({ url, botId, userId, tenantId }));

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Failed to create conversation:', response.status, errorText);
    return null;
  }

  const data = await response.json();
  return data.id;
}

/**
 * Get a Microsoft Graph API token (for user lookups).
 * Uses the same app registration but different scope.
 */
export async function getGraphToken(
  clientId: string,
  clientSecret: string,
  tenantId: string
): Promise<string | null> {
  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    }),
  });

  if (!response.ok) {
    console.error('Failed to get Graph token:', await response.text());
    return null;
  }

  const data = await response.json();
  return data.access_token;
}

/**
 * Exchange an OAuth authorization code for tokens (used in user-facing OAuth flow).
 */
export async function exchangeCodeForTokens(
  clientId: string,
  clientSecret: string,
  code: string,
  redirectUri: string
): Promise<{
  ok: boolean;
  access_token?: string;
  id_token?: string;
  refresh_token?: string;
  error?: string;
}> {
  // Use 'common' tenant for multi-tenant apps
  const tokenUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Token exchange failed:', errorText);
    return { ok: false, error: errorText };
  }

  const data = await response.json();
  return {
    ok: true,
    access_token: data.access_token,
    id_token: data.id_token,
    refresh_token: data.refresh_token,
  };
}

/**
 * Get user profile from Microsoft Graph using a delegated access token.
 */
export async function getGraphUserProfile(
  accessToken: string
): Promise<{ id: string; email: string; displayName: string; tenantId: string } | null> {
  const response = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    console.error('Failed to get user profile:', await response.text());
    return null;
  }

  const data = await response.json();

  // Extract tenant ID from the token
  // The tid claim is in the JWT, but we can also get organization info
  let tenantId = '';
  try {
    // Decode JWT to get tenant ID from 'tid' claim
    const payload = JSON.parse(atob(accessToken.split('.')[1]));
    tenantId = payload.tid || '';
  } catch {
    console.error('Failed to decode access token for tenant ID');
  }

  return {
    id: data.id,
    email: data.mail || data.userPrincipalName,
    displayName: data.displayName,
    tenantId,
  };
}

/**
 * Render an Adaptive Card template with variables.
 * Reuses renderTemplate from slack.ts for {{variable}} replacement.
 */
export function renderAdaptiveCard(
  template: Record<string, unknown>,
  variables: Record<string, string | number | null | undefined>
): Record<string, unknown> {
  const json = JSON.stringify(template);
  const rendered = renderTemplate(json, variables);
  return JSON.parse(rendered);
}

/**
 * Build a daily digest Adaptive Card with interactive action items.
 * Mirrors buildActionItemBlocks from the nudge-scheduler.
 */
export function buildTeamsActionItemsCard(
  firstName: string,
  pendingActions: { id: string; action_text: string }[],
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

  // Add each action item
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

  // Footer
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
