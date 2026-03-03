// Calendar OAuth Edge Function
// Handles Google and Microsoft calendar OAuth flows for coach calendar sync.
// Actions: start (redirect to provider), callback (exchange code), status, disconnect

import { getSupabaseClient, getEnvVar } from '../_shared/supabase.ts'
import {
  exchangeGoogleCode,
  exchangeMicrosoftCode,
  getGoogleUserEmail,
  getMicrosoftUserEmail,
} from '../_shared/calendar.ts'
import { createSignedState, verifySignedState } from '../_shared/oauth-state.ts'

// Dynamic CORS: only allow known portal origins
let _currentReqOrigin: string | null = null;

function getAllowedOrigin(reqOrigin: string | null): string {
  const coachPortalUrl = Deno.env.get('COACH_PORTAL_URL') || 'http://localhost:3000';
  const portalUrl = Deno.env.get('PORTAL_URL') || 'http://localhost:5173';
  const allowed = [coachPortalUrl, portalUrl, 'https://my.boon-health.com', 'http://localhost:5173', 'http://localhost:3000'];
  if (reqOrigin && allowed.includes(reqOrigin)) return reqOrigin;
  return coachPortalUrl;
}

function getCorsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': getAllowedOrigin(_currentReqOrigin),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Credentials': 'true',
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(), 'Content-Type': 'application/json' },
  })
}

// Validate that a connect_token maps to the expected coach_id
async function validateConnectToken(connectToken: string, coachId: string): Promise<boolean> {
  const supabase = getSupabaseClient()
  const { data } = await supabase
    .from('calendar_connect_tokens')
    .select('coach_id')
    .eq('token', connectToken)
    .single()

  return data?.coach_id === coachId
}

// Look up coach_id from a connect_token
async function getCoachIdFromToken(connectToken: string): Promise<string | null> {
  const supabase = getSupabaseClient()
  const { data } = await supabase
    .from('calendar_connect_tokens')
    .select('coach_id')
    .eq('token', connectToken)
    .single()

  return data?.coach_id || null
}

Deno.serve(async (req) => {
  _currentReqOrigin = req.headers.get('origin');

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders() })
  }

  const url = new URL(req.url)
  const action = url.searchParams.get('action')
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || url.origin
  const redirectUri = `${supabaseUrl}/functions/v1/calendar-oauth?action=callback`

  try {
    // ============================================================
    // ACTION: start - Redirect to Google or Microsoft OAuth consent
    // ============================================================
    if (action === 'start') {
      const coachId = url.searchParams.get('coach_id')
      const coachEmail = url.searchParams.get('coach_email')
      const provider = url.searchParams.get('provider')
      const connectToken = url.searchParams.get('connect_token')

      if (!coachId || !coachEmail || !provider || !connectToken) {
        return jsonResponse({ error: 'Missing required parameters: coach_id, coach_email, provider, connect_token' }, 400)
      }

      if (provider !== 'google' && provider !== 'microsoft') {
        return jsonResponse({ error: 'Provider must be google or microsoft' }, 400)
      }

      const state = await createSignedState({ coach_id: coachId, coach_email: coachEmail, provider, connect_token: connectToken })
      // redirectUri defined above

      if (provider === 'google') {
        const clientId = getEnvVar('GOOGLE_CALENDAR_CLIENT_ID')
        const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
        authUrl.searchParams.set('client_id', clientId)
        authUrl.searchParams.set('redirect_uri', redirectUri)
        authUrl.searchParams.set('response_type', 'code')
        authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/calendar.readonly email profile')
        authUrl.searchParams.set('access_type', 'offline')
        authUrl.searchParams.set('prompt', 'consent')
        authUrl.searchParams.set('state', state)

        return Response.redirect(authUrl.toString(), 302)
      }

      // Microsoft
      const clientId = getEnvVar('MICROSOFT_CALENDAR_CLIENT_ID')
      const authUrl = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize')
      authUrl.searchParams.set('client_id', clientId)
      authUrl.searchParams.set('redirect_uri', redirectUri)
      authUrl.searchParams.set('response_type', 'code')
      authUrl.searchParams.set('scope', 'Calendars.Read offline_access User.Read')
      authUrl.searchParams.set('state', state)

      return Response.redirect(authUrl.toString(), 302)
    }

    // ============================================================
    // ACTION: callback - Exchange code for tokens, store encrypted
    // ============================================================
    if (action === 'callback') {
      const code = url.searchParams.get('code')
      const stateParam = url.searchParams.get('state')
      const error = url.searchParams.get('error')
      const coachPortalUrl = Deno.env.get('COACH_PORTAL_URL') || 'http://localhost:3000'

      if (error) {
        console.error('OAuth error from provider:', error)
        return Response.redirect(`${coachPortalUrl}/calendar/error?error=oauth_denied`, 302)
      }

      if (!code || !stateParam) {
        return Response.redirect(`${coachPortalUrl}/calendar/error?error=missing_params`, 302)
      }

      const stateData = await verifySignedState(stateParam)
      if (!stateData || !stateData.coach_id) {
        return Response.redirect(`${coachPortalUrl}/calendar/error?error=invalid_state`, 302)
      }

      const { coach_id, coach_email, provider, connect_token } = stateData

      // Validate connect_token maps to the claimed coach_id
      const isValid = await validateConnectToken(connect_token, coach_id)
      if (!isValid) {
        console.error('Connect token does not match coach_id:', { connect_token, coach_id })
        return Response.redirect(`${coachPortalUrl}/calendar/error?error=invalid_token`, 302)
      }

      try {
        const encryptionKey = getEnvVar('CALENDAR_ENCRYPTION_KEY')

        let accessToken: string
        let refreshToken: string
        let expiresIn: number
        let calendarEmail: string

        console.log('Callback redirect_uri:', redirectUri)
        console.log('Callback code (first 20 chars):', code.substring(0, 20))
        console.log('Callback full URL:', req.url)

        if (provider === 'google') {
          const clientId = getEnvVar('GOOGLE_CALENDAR_CLIENT_ID')
          const clientSecret = getEnvVar('GOOGLE_CALENDAR_CLIENT_SECRET')

          const tokenData = await exchangeGoogleCode(code, redirectUri, clientId, clientSecret)
          accessToken = tokenData.access_token
          refreshToken = tokenData.refresh_token || ''
          expiresIn = tokenData.expires_in

          calendarEmail = await getGoogleUserEmail(accessToken)
        } else {
          const clientId = getEnvVar('MICROSOFT_CALENDAR_CLIENT_ID')
          const clientSecret = getEnvVar('MICROSOFT_CALENDAR_CLIENT_SECRET')

          const tokenData = await exchangeMicrosoftCode(code, redirectUri, clientId, clientSecret)
          accessToken = tokenData.access_token
          refreshToken = tokenData.refresh_token || ''
          expiresIn = tokenData.expires_in

          calendarEmail = await getMicrosoftUserEmail(accessToken)
        }

        if (!refreshToken) {
          console.error('No refresh token received. For Google, ensure prompt=consent and access_type=offline.')
          return Response.redirect(
            `${coachPortalUrl}/calendar/${connect_token}?error=no_refresh_token`,
            302
          )
        }

        const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

        // Store encrypted tokens via RPC
        const supabase = getSupabaseClient()
        const { error: upsertError } = await supabase.rpc('upsert_calendar_connection', {
          p_coach_id: coach_id,
          p_coach_email: coach_email,
          p_provider: provider,
          p_access_token: accessToken,
          p_refresh_token: refreshToken,
          p_token_expires_at: tokenExpiresAt,
          p_calendar_email: calendarEmail,
          p_encryption_key: encryptionKey,
        })

        if (upsertError) {
          console.error('Failed to store calendar connection:', upsertError)
          return Response.redirect(
            `${coachPortalUrl}/calendar/${connect_token}?error=save_failed`,
            302
          )
        }

        console.log(`Calendar connected: coach=${coach_id}, provider=${provider}, calendar=${calendarEmail}`)
        return Response.redirect(
          `${coachPortalUrl}/calendar/${connect_token}?calendar_connected=true&provider=${provider}`,
          302
        )
      } catch (callbackError) {
        console.error('Callback processing error:', callbackError)
        return Response.redirect(
          `${coachPortalUrl}/calendar/${connect_token}?error=callback_failed`,
          302
        )
      }
    }

    // ============================================================
    // ACTION: status - Return connection status for a coach
    // Requires connect_token for authorization
    // ============================================================
    if (action === 'status') {
      const connectToken = url.searchParams.get('connect_token')
      if (!connectToken) {
        return jsonResponse({ error: 'Missing connect_token parameter' }, 400)
      }

      const coachId = await getCoachIdFromToken(connectToken)
      if (!coachId) {
        return jsonResponse({ error: 'Invalid connect token' }, 403)
      }

      const supabase = getSupabaseClient()
      const { data: connections, error: fetchError } = await supabase
        .from('coach_calendar_connections')
        .select('provider, calendar_email, last_sync_at, is_active')
        .eq('coach_id', coachId)

      if (fetchError) {
        console.error('Failed to fetch connections:', fetchError)
        return jsonResponse({ error: 'Failed to fetch status' }, 500)
      }

      const result: Record<string, unknown> = { google: null, microsoft: null }

      for (const conn of connections || []) {
        result[conn.provider] = {
          connected: conn.is_active,
          calendar_email: conn.calendar_email,
          last_sync_at: conn.last_sync_at,
          // Only indicate that there's an error, don't expose details
          last_sync_error: conn.is_active ? null : 'Connection needs to be reconnected',
        }
      }

      return jsonResponse(result)
    }

    // ============================================================
    // ACTION: disconnect - Remove a calendar connection
    // Requires connect_token for authorization
    // ============================================================
    if (action === 'disconnect') {
      const connectToken = url.searchParams.get('connect_token')
      const provider = url.searchParams.get('provider')

      if (!connectToken || !provider) {
        return jsonResponse({ error: 'Missing connect_token or provider parameter' }, 400)
      }

      const coachId = await getCoachIdFromToken(connectToken)
      if (!coachId) {
        return jsonResponse({ error: 'Invalid connect token' }, 403)
      }

      const supabase = getSupabaseClient()

      // Delete the connection
      const { error: deleteConnError } = await supabase
        .from('coach_calendar_connections')
        .delete()
        .eq('coach_id', coachId)
        .eq('provider', provider)

      if (deleteConnError) {
        console.error('Failed to delete connection:', deleteConnError)
        return jsonResponse({ error: 'Failed to disconnect' }, 500)
      }

      // Delete associated busy blocks
      const { error: deleteBlocksError } = await supabase
        .from('coach_calendar_blocks')
        .delete()
        .eq('coach_id', coachId)
        .eq('source', provider)

      if (deleteBlocksError) {
        console.error('Failed to delete blocks:', deleteBlocksError)
        // Non-fatal, connection is already removed
      }

      console.log(`Calendar disconnected: coach=${coachId}, provider=${provider}`)
      return jsonResponse({ success: true })
    }

    return jsonResponse({ error: 'Invalid action. Valid actions: start, callback, status, disconnect' }, 400)

  } catch (error) {
    console.error('Calendar OAuth error:', error)
    return jsonResponse({ error: 'Internal server error' }, 500)
  }
})
