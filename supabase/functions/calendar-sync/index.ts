// Calendar Sync Cron Edge Function
// Syncs busy blocks from Google Calendar and Microsoft Outlook every 15 minutes.
// Deploy with: supabase functions deploy calendar-sync --schedule "*/15 * * * *"

import { getSupabaseClient } from '../_shared/supabase.ts'
import {
  refreshGoogleToken,
  refreshMicrosoftToken,
  fetchGoogleFreeBusy,
  fetchMicrosoftSchedule,
} from '../_shared/calendar.ts'

interface CalendarConnection {
  id: string
  coach_id: string
  coach_email: string
  provider: string
  access_token: string
  refresh_token: string
  token_expires_at: string
  calendar_email: string
  last_sync_at: string | null
}

Deno.serve(async (req) => {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 })
  }

  const startTime = Date.now()
  const results = {
    synced: 0,
    errors: 0,
    blocks_created: 0,
    tokens_refreshed: 0,
    connections_deactivated: 0,
    blocks_cleaned: 0,
  }

  try {
    const supabase = getSupabaseClient()
    const encryptionKey = Deno.env.get('CALENDAR_ENCRYPTION_KEY')
    if (!encryptionKey) {
      throw new Error('Missing CALENDAR_ENCRYPTION_KEY')
    }

    const googleClientId = Deno.env.get('GOOGLE_CALENDAR_CLIENT_ID') || ''
    const googleClientSecret = Deno.env.get('GOOGLE_CALENDAR_CLIENT_SECRET') || ''
    const microsoftClientId = Deno.env.get('MICROSOFT_CALENDAR_CLIENT_ID') || ''
    const microsoftClientSecret = Deno.env.get('MICROSOFT_CALENDAR_CLIENT_SECRET') || ''

    // Fetch all active connections with decrypted tokens
    const { data: connections, error: fetchError } = await supabase.rpc(
      'get_active_calendar_connections',
      { p_encryption_key: encryptionKey }
    )

    if (fetchError) {
      throw new Error(`Failed to fetch connections: ${fetchError.message}`)
    }

    if (!connections || connections.length === 0) {
      console.log('No active calendar connections to sync')
      return new Response(
        JSON.stringify({ success: true, message: 'No connections to sync', results }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Syncing ${connections.length} calendar connections`)

    // 14-day sync window
    const now = new Date()
    const timeMin = now.toISOString()
    const timeMax = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString()

    for (const conn of connections as CalendarConnection[]) {
      try {
        let { access_token, refresh_token } = conn
        const { id, coach_id, provider, calendar_email } = conn

        // Refresh token if expiring within 5 minutes
        const tokenExpiresAt = new Date(conn.token_expires_at)
        const fiveMinFromNow = new Date(now.getTime() + 5 * 60 * 1000)

        if (tokenExpiresAt < fiveMinFromNow) {
          console.log(`Refreshing ${provider} token for coach ${coach_id}`)
          try {
            let tokenData
            if (provider === 'google') {
              tokenData = await refreshGoogleToken(refresh_token, googleClientId, googleClientSecret)
            } else {
              tokenData = await refreshMicrosoftToken(refresh_token, microsoftClientId, microsoftClientSecret)
            }

            access_token = tokenData.access_token
            // Microsoft may return a new refresh token (rolling refresh)
            const newRefreshToken = tokenData.refresh_token || refresh_token
            const newExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString()

            // Update encrypted tokens in DB
            await supabase.rpc('update_calendar_tokens', {
              p_connection_id: id,
              p_access_token: access_token,
              p_refresh_token: newRefreshToken,
              p_token_expires_at: newExpiresAt,
              p_encryption_key: encryptionKey,
            })

            results.tokens_refreshed++
          } catch (refreshError) {
            // Token refresh failed, likely revoked. Mark inactive.
            console.error(`Token refresh failed for coach ${coach_id} (${provider}):`, refreshError)
            await supabase
              .from('coach_calendar_connections')
              .update({
                is_active: false,
                last_sync_error: `Token refresh failed: ${String(refreshError)}`,
              })
              .eq('id', id)

            results.connections_deactivated++
            results.errors++
            continue
          }
        }

        // Fetch busy blocks from provider
        let busyBlocks: { start: string; end: string }[]
        if (provider === 'google') {
          busyBlocks = await fetchGoogleFreeBusy(access_token, calendar_email, timeMin, timeMax)
        } else {
          busyBlocks = await fetchMicrosoftSchedule(access_token, calendar_email, timeMin, timeMax)
        }

        // Replace future blocks for this coach+source
        // Delete existing future blocks
        const { error: deleteError } = await supabase
          .from('coach_calendar_blocks')
          .delete()
          .eq('coach_id', coach_id)
          .eq('source', provider)
          .gt('busy_end', now.toISOString())

        if (deleteError) {
          console.error(`Failed to delete old blocks for coach ${coach_id}:`, deleteError)
        }

        // Insert new blocks
        if (busyBlocks.length > 0) {
          const rows = busyBlocks.map((block) => ({
            coach_id,
            source: provider,
            busy_start: block.start,
            busy_end: block.end,
            synced_at: now.toISOString(),
          }))

          const { error: insertError } = await supabase
            .from('coach_calendar_blocks')
            .insert(rows)

          if (insertError) {
            console.error(`Failed to insert blocks for coach ${coach_id}:`, insertError)
            results.errors++
            continue
          }

          results.blocks_created += rows.length
        }

        // Update last_sync_at
        await supabase
          .from('coach_calendar_connections')
          .update({ last_sync_at: now.toISOString(), last_sync_error: null })
          .eq('id', id)

        results.synced++
        console.log(`Synced ${busyBlocks.length} blocks for coach ${coach_id} (${provider})`)

      } catch (connError) {
        console.error(`Error syncing coach ${conn.coach_id} (${conn.provider}):`, connError)

        // Store error but keep connection active (transient errors)
        await supabase
          .from('coach_calendar_connections')
          .update({ last_sync_error: String(connError) })
          .eq('id', conn.id)

        results.errors++
      }
    }

    // Cleanup: remove blocks that ended more than 1 day ago
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
    const { data: cleanedData } = await supabase
      .from('coach_calendar_blocks')
      .delete()
      .lt('busy_end', oneDayAgo)
      .select('id')

    results.blocks_cleaned = cleanedData?.length || 0

    const duration = ((Date.now() - startTime) / 1000).toFixed(2)

    console.log('='.repeat(40))
    console.log('Calendar Sync Complete')
    console.log(`Synced: ${results.synced}`)
    console.log(`Blocks created: ${results.blocks_created}`)
    console.log(`Tokens refreshed: ${results.tokens_refreshed}`)
    console.log(`Connections deactivated: ${results.connections_deactivated}`)
    console.log(`Blocks cleaned up: ${results.blocks_cleaned}`)
    console.log(`Errors: ${results.errors}`)
    console.log(`Duration: ${duration}s`)
    console.log('='.repeat(40))

    return new Response(
      JSON.stringify({ success: true, results, duration: `${duration}s` }),
      { headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Calendar sync error:', error)
    return new Response(
      JSON.stringify({ error: 'Calendar sync failed', details: String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
