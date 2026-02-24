// Teams OAuth Edge Function
// Handles OAuth flow, connection management, and settings for Microsoft Teams

import { getSupabaseClient, getEnvVar } from '../_shared/supabase.ts';
import {
  exchangeCodeForTokens,
  getGraphUserProfile,
  getBotAccessToken,
  createProactiveConversation,
} from '../_shared/teams.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Default service URL for Bot Framework
const DEFAULT_SERVICE_URL = 'https://smba.trafficmanager.net/teams/';

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const origin = url.origin.replace('http://', 'https://');
  const action = url.searchParams.get('action');

  try {
    // Action: Start OAuth flow (redirect to Azure AD)
    if (action === 'start') {
      const employeeEmail = url.searchParams.get('email');
      if (!employeeEmail) {
        return new Response(
          JSON.stringify({ error: 'Missing email parameter' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const clientId = getEnvVar('TEAMS_CLIENT_ID');
      const redirectUri = `${origin}/functions/v1/teams-oauth?action=callback`;

      // Store email in state param
      const state = btoa(JSON.stringify({ email: employeeEmail }));

      const authUrl = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('scope', 'User.Read offline_access');
      authUrl.searchParams.set('state', state);
      authUrl.searchParams.set('response_mode', 'query');

      return Response.redirect(authUrl.toString(), 302);
    }

    // Action: Handle OAuth callback from Azure AD
    if (action === 'callback') {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const error = url.searchParams.get('error');

      if (error) {
        console.error('Teams OAuth error:', error, url.searchParams.get('error_description'));
        return redirectToPortal('error=oauth_denied');
      }

      if (!code || !state) {
        return redirectToPortal('error=missing_params');
      }

      // Decode state to get employee email
      let employeeEmail: string;
      try {
        const stateData = JSON.parse(atob(state));
        employeeEmail = stateData.email;
      } catch {
        return redirectToPortal('error=invalid_state');
      }

      // Exchange code for tokens
      const clientId = getEnvVar('TEAMS_CLIENT_ID');
      const clientSecret = getEnvVar('TEAMS_CLIENT_SECRET');
      const redirectUri = `${origin}/functions/v1/teams-oauth?action=callback`;

      const tokenResponse = await exchangeCodeForTokens(
        clientId,
        clientSecret,
        code,
        redirectUri
      );

      if (!tokenResponse.ok || !tokenResponse.access_token) {
        console.error('Token exchange failed:', tokenResponse.error);
        return redirectToPortal('error=token_exchange_failed');
      }

      // Get user profile from Graph API (includes tenant ID)
      const userProfile = await getGraphUserProfile(tokenResponse.access_token);

      if (!userProfile || !userProfile.tenantId) {
        console.error('Could not get user profile or tenant ID');
        return redirectToPortal('error=user_not_found');
      }

      const supabase = getSupabaseClient();
      const serviceUrl = DEFAULT_SERVICE_URL;

      // Get a bot token using the app registration tenant (not the user's tenant)
      const appTenantId = Deno.env.get('TEAMS_APP_TENANT_ID') || userProfile.tenantId;
      const botToken = await getBotAccessToken(clientId, clientSecret, appTenantId);

      if (!botToken) {
        console.error('Could not get bot access token');
        return redirectToPortal('error=bot_token_failed');
      }

      // Get bot ID from env or use the client ID
      const botId = Deno.env.get('TEAMS_BOT_ID') || clientId;

      // Upsert teams installation
      const { error: installError } = await supabase
        .from('teams_installations')
        .upsert({
          tenant_id: userProfile.tenantId,
          bot_token: botToken.token,
          bot_id: botId,
          service_url: serviceUrl,
          installed_by: employeeEmail,
          token_expires_at: botToken.expiresAt.toISOString(),
        }, {
          onConflict: 'tenant_id',
        });

      if (installError) {
        console.error('Failed to save Teams installation:', installError);
        return redirectToPortal('error=save_failed');
      }

      // Try to create proactive 1:1 conversation
      // This may fail if the user hasn't installed the Teams app yet
      let conversationId: string | null = null;
      try {
        conversationId = await createProactiveConversation(
          botToken.token,
          serviceUrl,
          userProfile.tenantId,
          userProfile.id,
          botId
        );
      } catch (e) {
        console.warn('Proactive conversation creation failed (will retry on first nudge):', e);
      }

      if (!conversationId) {
        console.warn('Could not create proactive conversation yet. Connection will be saved without it.');
      }

      // Save employee Teams connection (conversation_id may be null, will be populated on first nudge)
      const { error: connectionError } = await supabase
        .from('employee_teams_connections')
        .upsert({
          employee_email: employeeEmail,
          tenant_id: userProfile.tenantId,
          teams_user_id: userProfile.id,
          conversation_id: conversationId || '',
          service_url: serviceUrl,
          nudge_enabled: true,
          nudge_frequency: 'smart',
        }, {
          onConflict: 'employee_email,tenant_id',
        });

      if (connectionError) {
        console.error('Failed to save Teams connection:', connectionError);
        return redirectToPortal('error=connection_failed');
      }

      // Enforce one-channel-at-a-time: delete any Slack connection
      await supabase
        .from('employee_slack_connections')
        .delete()
        .ilike('employee_email', employeeEmail);

      // Success! Redirect back to portal
      return redirectToPortal('teams_connected=true');
    }

    // Action: Disconnect Teams
    if (action === 'disconnect') {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const supabase = getSupabaseClient();

      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);

      if (authError || !user?.email) {
        return new Response(
          JSON.stringify({ error: 'Invalid token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error: deleteError } = await supabase
        .from('employee_teams_connections')
        .delete()
        .ilike('employee_email', user.email);

      if (deleteError) {
        console.error('Failed to disconnect Teams:', deleteError);
        return new Response(
          JSON.stringify({ error: 'Failed to disconnect' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action: Check connection status
    if (action === 'status') {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const supabase = getSupabaseClient();

      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);

      if (authError || !user?.email) {
        return new Response(
          JSON.stringify({ error: 'Invalid token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: connection } = await supabase
        .from('employee_teams_connections')
        .select('teams_user_id, nudge_enabled, nudge_frequency, preferred_time, timezone')
        .ilike('employee_email', user.email)
        .single();

      return new Response(
        JSON.stringify({
          connected: !!connection,
          settings: connection || null,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action: Update nudge settings
    if (action === 'settings' && req.method === 'POST') {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const supabase = getSupabaseClient();

      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);

      if (authError || !user?.email) {
        return new Response(
          JSON.stringify({ error: 'Invalid token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const body = await req.json();
      const { nudge_enabled, nudge_frequency, preferred_time, timezone } = body;

      const { error: updateError } = await supabase
        .from('employee_teams_connections')
        .update({
          nudge_enabled,
          nudge_frequency,
          preferred_time,
          timezone,
        })
        .ilike('employee_email', user.email);

      if (updateError) {
        console.error('Failed to update Teams settings:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to update settings' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Teams OAuth error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function redirectToPortal(params: string): Response {
  const portalUrl = Deno.env.get('PORTAL_URL') || 'http://localhost:5173';
  return Response.redirect(`${portalUrl}/settings?${params}`, 302);
}
