// Session Reconciliation Edge Function
// Finds stale "Scheduled" sessions in session_tracking and reconciles with Salesforce.
// Deploy: supabase functions deploy session-reconciliation
// Schedule: set cron "0 7 * * *" via Supabase Dashboard > Edge Functions
//
// Pass 1:   Stale sessions — finds sessions stuck as "Scheduled" (session_date > 24h ago)
//           and reconciles status AND date against Salesforce.
// Pass 1.5: Content backfill — syncs Goals, Plan, and theme fields from SF for
//           Completed sessions where plan IS NULL (last 90 days).
// Pass 2:   Missing appointments — finds recent SF appointments that don't exist in
//           session_tracking and inserts them.
// Pass 3:   Count verification — compares SF vs Supabase appointment counts within the
//           lookback window, alerts on drift.
//
// Query params:
//   ?lookback_days=N    — how far back to search for missing appointments (default 30)
//   ?drift_threshold=N  — max allowed count delta before alerting (default 50)
//
// Env vars:
//   SLACK_OPS_WEBHOOK_URL — Slack incoming webhook for #operations alerts (optional)

import { getSupabaseClient } from '../_shared/supabase.ts'
import {
  getSalesforceAuth,
  getSalesforceConfig,
  salesforceQuery,
  chunk,
} from '../_shared/salesforce.ts'

const SOQL_CHUNK_SIZE = 200
const STALE_HOURS = 24
const UPDATE_BATCH_SIZE = 50

interface StaleSession {
  id: number
  appointment_number: string
  status: string
  session_date: string | null
  duration_minutes: number | null
}

interface SfAppointment {
  AppointmentNumber: string
  Status: string
  SchedStartTime: string | null
  DurationInMinutes: number | null
}

interface SfAppointmentFull {
  AppointmentNumber: string
  Status: string
  SchedStartTime: string | null
  DurationInMinutes: number | null
  Account?: { Name: string } | null
  Contact?: { Name: string; Email: string } | null
  Coach__r?: { Name: string } | null
}

interface SfContentRecord {
  AppointmentNumber: string
  Goals__c: string | null
  Plan__c: string | null
  Leadership_Management_Skills__c: string | null
  Communication_Skills__c: string | null
  Mental_Well_Being__c: string | null
  Other_Themes__c: string | null
}

interface SessionUpdate {
  id: number
  changes: Record<string, unknown>
  statusChanged: boolean
  dateChanged: boolean
  durationChanged: boolean
}

// Same normalization as salesforce-appointments-new/index.ts
function normalizeStatus(status: string): string {
  if (!status) return 'Scheduled'
  const statusMap: Record<string, string> = {
    'Scheduled': 'Scheduled',
    'Completed': 'Completed',
    'Canceled': 'Cancelled',
    'Cancelled': 'Cancelled',
    'canceled': 'Cancelled',
    'cancelled': 'Cancelled',
    'No Show': 'Client No Show',
    'Client No Show': 'Client No Show',
    'Coach No Show': 'Coach No Show',
    'Late Cancel': 'Late Cancel',
    'Rescheduled': 'Rescheduled',
    'None': 'Scheduled',
    'No Label': 'Scheduled',
  }
  return statusMap[status] || status
}

function datesMatch(supabaseDate: string | null, sfDate: string | null): boolean {
  if (!supabaseDate && !sfDate) return true
  if (!supabaseDate || !sfDate) return false
  // Compare as ISO strings truncated to minutes to avoid sub-second drift
  const a = new Date(supabaseDate).toISOString().slice(0, 16)
  const b = new Date(sfDate).toISOString().slice(0, 16)
  return a === b
}

Deno.serve(async (req) => {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 })
  }

  const startTime = Date.now()
  const url = new URL(req.url)
  const lookbackDays = parseInt(url.searchParams.get('lookback_days') || '30', 10)
  const driftThreshold = parseInt(url.searchParams.get('drift_threshold') || '50', 10)

  const results = {
    // Pass 1
    stale_found: 0,
    updated: 0,
    dates_corrected: 0,
    durations_corrected: 0,
    no_sf_match: 0,
    already_correct: 0,
    updates_by_status: {} as Record<string, number>,
    // Pass 1.5
    content_candidates: 0,
    content_synced: 0,
    // Pass 2
    missing_found: 0,
    missing_inserted: 0,
    // Pass 3
    sf_total_count: 0,
    supabase_total_count: 0,
    count_delta: 0,
    counts_in_sync: true,
    // Shared
    errors: 0,
  }

  try {
    const supabase = getSupabaseClient()
    const sfConfig = getSalesforceConfig()
    const sfAuth = await getSalesforceAuth(sfConfig)

    console.log('[RECONCILE] Authenticated to Salesforce:', sfAuth.instanceUrl)

    // ================================================================
    // PASS 1: Reconcile stale "Scheduled" sessions
    // ================================================================
    console.log('[RECONCILE] === Pass 1: Reconcile stale sessions ===')

    const cutoff = new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000).toISOString()

    const { data: staleSessions, error: staleError } = await supabase
      .from('session_tracking')
      .select('id, appointment_number, status, session_date, duration_minutes')
      .eq('status', 'Scheduled')
      .lt('session_date', cutoff)
      .not('appointment_number', 'is', null)

    if (staleError) {
      throw new Error(`Failed to query stale sessions: ${staleError.message}`)
    }

    if (!staleSessions || staleSessions.length === 0) {
      console.log('[RECONCILE] No stale sessions found')
    } else {
      results.stale_found = staleSessions.length
      console.log(`[RECONCILE] Found ${staleSessions.length} stale sessions`)

      // Build lookup map: appointment_number -> session
      const sessionMap = new Map<string, StaleSession>()
      for (const session of staleSessions as StaleSession[]) {
        if (session.appointment_number) {
          sessionMap.set(session.appointment_number, session)
        }
      }

      const appointmentNumbers = Array.from(sessionMap.keys())

      // Query Salesforce in chunks of 200
      const sfRecordMap = new Map<string, SfAppointment>()
      const chunks = chunk(appointmentNumbers, SOQL_CHUNK_SIZE)

      console.log(`[RECONCILE] Querying Salesforce in ${chunks.length} batch(es)`)

      for (const batch of chunks) {
        const inClause = batch.map(n => `'${n}'`).join(',')
        const soql = `SELECT AppointmentNumber, Status, SchedStartTime, DurationInMinutes FROM ServiceAppointment WHERE AppointmentNumber IN (${inClause})`

        try {
          const records = await salesforceQuery<SfAppointment>(sfAuth, soql)
          for (const record of records) {
            sfRecordMap.set(record.AppointmentNumber, record)
          }
          console.log(`[RECONCILE] Batch returned ${records.length} SF records`)
        } catch (queryError) {
          console.error(`[RECONCILE] SOQL batch failed (${batch.length} appts):`, String(queryError))
          results.errors++
        }
      }

      console.log(`[RECONCILE] Got ${sfRecordMap.size} records from Salesforce`)

      // Compare status, date, and duration — build per-session updates
      const pendingUpdates: SessionUpdate[] = []
      const noMatch: string[] = []

      for (const [apptNum, session] of sessionMap) {
        const sfRecord = sfRecordMap.get(apptNum)

        if (!sfRecord) {
          noMatch.push(apptNum)
          results.no_sf_match++
          continue
        }

        const normalizedStatus = normalizeStatus(sfRecord.Status)
        const statusChanged = normalizedStatus !== session.status
        const dateChanged = !datesMatch(session.session_date, sfRecord.SchedStartTime)
        const durationChanged = sfRecord.DurationInMinutes != null
          && sfRecord.DurationInMinutes !== session.duration_minutes

        if (!statusChanged && !dateChanged && !durationChanged) {
          results.already_correct++
          continue
        }

        const changes: Record<string, unknown> = {}
        if (statusChanged) changes.status = normalizedStatus
        if (dateChanged && sfRecord.SchedStartTime) changes.session_date = sfRecord.SchedStartTime
        if (durationChanged) changes.duration_minutes = sfRecord.DurationInMinutes

        pendingUpdates.push({
          id: session.id,
          changes,
          statusChanged,
          dateChanged,
          durationChanged,
        })
      }

      if (noMatch.length > 0) {
        console.log(`[RECONCILE] ${noMatch.length} sessions had no Salesforce match (first 10): ${noMatch.slice(0, 10).join(', ')}`)
      }

      // Execute updates in parallel batches of 50
      const updateBatches = chunk(pendingUpdates, UPDATE_BATCH_SIZE)

      for (const batch of updateBatches) {
        const promises = batch.map(async (update) => {
          try {
            const { error: updateError } = await supabase
              .from('session_tracking')
              .update(update.changes)
              .eq('id', update.id)

            if (updateError) {
              console.error(`[RECONCILE] Failed to update session ${update.id}:`, updateError)
              results.errors++
              return
            }

            results.updated++
            if (update.statusChanged) {
              const newStatus = update.changes.status as string
              results.updates_by_status[newStatus] = (results.updates_by_status[newStatus] || 0) + 1
            }
            if (update.dateChanged) results.dates_corrected++
            if (update.durationChanged) results.durations_corrected++
          } catch (err) {
            console.error(`[RECONCILE] Update error for session ${update.id}:`, err)
            results.errors++
          }
        })

        await Promise.all(promises)
      }

      console.log(`[RECONCILE] Pass 1 complete: ${results.updated} updated, ${results.dates_corrected} dates corrected, ${results.durations_corrected} durations corrected`)
    }

    // ================================================================
    // PASS 1.5: Content backfill (Goals, Plan, Themes from SF)
    // ================================================================
    console.log('[RECONCILE] === Pass 1.5: Content backfill ===')

    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

    const { data: contentCandidates, error: contentQueryError } = await supabase
      .from('session_tracking')
      .select('id, appointment_number')
      .eq('status', 'Completed')
      .is('plan', null)
      .gte('session_date', ninetyDaysAgo)
      .not('appointment_number', 'is', null)

    if (contentQueryError) {
      console.error('[RECONCILE] Pass 1.5 query failed:', contentQueryError.message)
      results.errors++
    } else if (!contentCandidates || contentCandidates.length === 0) {
      console.log('[RECONCILE] No completed sessions missing content')
    } else {
      results.content_candidates = contentCandidates.length
      console.log(`[RECONCILE] Found ${contentCandidates.length} completed sessions missing plan/goals`)

      const contentMap = new Map<string, number>()
      for (const row of contentCandidates) {
        if (row.appointment_number) {
          contentMap.set(row.appointment_number, row.id)
        }
      }

      const contentApptNumbers = Array.from(contentMap.keys())
      const contentChunks = chunk(contentApptNumbers, SOQL_CHUNK_SIZE)

      const sfContentMap = new Map<string, SfContentRecord>()

      for (const batch of contentChunks) {
        const inClause = batch.map(n => `'${n}'`).join(',')
        const soql = `SELECT AppointmentNumber, Goals__c, Plan__c, Leadership_Management_Skills__c, Communication_Skills__c, Mental_Well_Being__c, Other_Themes__c FROM ServiceAppointment WHERE AppointmentNumber IN (${inClause})`

        try {
          const records = await salesforceQuery<SfContentRecord>(sfAuth, soql)
          for (const record of records) {
            // Only include if SF actually has content
            if (record.Goals__c || record.Plan__c || record.Leadership_Management_Skills__c || record.Communication_Skills__c || record.Mental_Well_Being__c || record.Other_Themes__c) {
              sfContentMap.set(record.AppointmentNumber, record)
            }
          }
        } catch (queryError) {
          console.error(`[RECONCILE] Pass 1.5 SOQL batch failed:`, String(queryError))
          results.errors++
        }
      }

      console.log(`[RECONCILE] ${sfContentMap.size} SF records have content to sync`)

      // Build and execute updates
      const contentUpdates: Array<{ id: number; changes: Record<string, unknown> }> = []

      for (const [apptNum, sfRecord] of sfContentMap) {
        const sessionId = contentMap.get(apptNum)
        if (!sessionId) continue

        const changes: Record<string, unknown> = {}
        if (sfRecord.Goals__c) changes.goals = sfRecord.Goals__c
        if (sfRecord.Plan__c) changes.plan = sfRecord.Plan__c
        if (sfRecord.Leadership_Management_Skills__c) changes.leadership_management_skills = sfRecord.Leadership_Management_Skills__c
        if (sfRecord.Communication_Skills__c) changes.communication_skills = sfRecord.Communication_Skills__c
        if (sfRecord.Mental_Well_Being__c) changes.mental_well_being = sfRecord.Mental_Well_Being__c
        if (sfRecord.Other_Themes__c) changes.other_themes = sfRecord.Other_Themes__c

        if (Object.keys(changes).length > 0) {
          contentUpdates.push({ id: sessionId, changes })
        }
      }

      const contentBatches = chunk(contentUpdates, UPDATE_BATCH_SIZE)

      for (const batch of contentBatches) {
        const promises = batch.map(async (update) => {
          try {
            const { error: updateError } = await supabase
              .from('session_tracking')
              .update(update.changes)
              .eq('id', update.id)

            if (updateError) {
              console.error(`[RECONCILE] Pass 1.5 update failed for session ${update.id}:`, updateError)
              results.errors++
              return
            }

            results.content_synced++
          } catch (err) {
            console.error(`[RECONCILE] Pass 1.5 update error for session ${update.id}:`, err)
            results.errors++
          }
        })

        await Promise.all(promises)
      }

      console.log(`[RECONCILE] Pass 1.5 complete: ${results.content_synced} sessions synced with content`)
    }

    // ================================================================
    // PASS 2: Find and insert missing appointments
    // ================================================================
    console.log(`[RECONCILE] === Pass 2: Find missing appointments (lookback ${lookbackDays} days) ===`)

    let sfAppointments: SfAppointmentFull[] = []
    const fullSoql = `SELECT AppointmentNumber, Status, SchedStartTime, DurationInMinutes, Account.Name, Contact.Name, Contact.Email, Coach__r.Name FROM ServiceAppointment WHERE SchedStartTime >= LAST_N_DAYS:${lookbackDays} AND Status != 'Canceled'`

    try {
      sfAppointments = await salesforceQuery<SfAppointmentFull>(sfAuth, fullSoql)
      console.log(`[RECONCILE] Pass 2 SOQL returned ${sfAppointments.length} appointments`)
    } catch (soqlError) {
      console.warn(`[RECONCILE] Pass 2 full SOQL failed, retrying without relationship fields:`, String(soqlError))
      // Fallback: core fields only
      try {
        const fallbackSoql = `SELECT AppointmentNumber, Status, SchedStartTime, DurationInMinutes FROM ServiceAppointment WHERE SchedStartTime >= LAST_N_DAYS:${lookbackDays} AND Status != 'Canceled'`
        const fallbackRecords = await salesforceQuery<SfAppointmentFull>(sfAuth, fallbackSoql)
        sfAppointments = fallbackRecords
        console.log(`[RECONCILE] Pass 2 fallback SOQL returned ${sfAppointments.length} appointments`)
      } catch (fallbackError) {
        console.error(`[RECONCILE] Pass 2 fallback SOQL also failed:`, String(fallbackError))
        results.errors++
      }
    }

    if (sfAppointments.length > 0) {
      // Get all appointment numbers from SF
      const sfApptNumbers = sfAppointments.map(a => a.AppointmentNumber).filter(Boolean)

      // Check which ones already exist in session_tracking (in batches)
      const existingApptNumbers = new Set<string>()
      const checkBatches = chunk(sfApptNumbers, SOQL_CHUNK_SIZE)

      for (const batch of checkBatches) {
        const { data: existing, error: checkError } = await supabase
          .from('session_tracking')
          .select('appointment_number')
          .in('appointment_number', batch)

        if (checkError) {
          console.error(`[RECONCILE] Pass 2 existence check failed:`, checkError)
          results.errors++
          continue
        }

        for (const row of existing || []) {
          if (row.appointment_number) {
            existingApptNumbers.add(row.appointment_number)
          }
        }
      }

      // Filter to truly missing
      const missing = sfAppointments.filter(
        a => a.AppointmentNumber && !existingApptNumbers.has(a.AppointmentNumber)
      )
      results.missing_found = missing.length

      if (missing.length === 0) {
        console.log('[RECONCILE] No missing appointments to insert')
      } else {
        console.log(`[RECONCILE] Found ${missing.length} missing appointments to insert`)

        // Insert in batches
        const insertBatches = chunk(missing, UPDATE_BATCH_SIZE)

        for (const batch of insertBatches) {
          const rows = batch.map(appt => ({
            appointment_number: appt.AppointmentNumber,
            status: normalizeStatus(appt.Status),
            session_date: appt.SchedStartTime || null,
            duration_minutes: appt.DurationInMinutes || null,
            account_name: appt.Account?.Name || null,
            employee_name: appt.Contact?.Name || null,
            coach_name: appt.Coach__r?.Name || null,
          }))

          const { error: insertError, data: inserted } = await supabase
            .from('session_tracking')
            .insert(rows)
            .select('id')

          if (insertError) {
            console.error(`[RECONCILE] Pass 2 insert batch failed:`, insertError)
            results.errors++
            continue
          }

          const count = inserted?.length || rows.length
          results.missing_inserted += count
          console.log(`[RECONCILE] Inserted ${count} missing sessions`)
        }
      }
    }

    // ================================================================
    // PASS 3: Count verification (direct comparison by appointment number)
    // ================================================================
    console.log('[RECONCILE] === Pass 3: Count verification ===')

    let sfApptNumbersForCount: string[] = []

    try {
      const countSoql = `SELECT AppointmentNumber FROM ServiceAppointment WHERE SchedStartTime >= LAST_N_DAYS:${lookbackDays} AND Status != 'Canceled'`
      const sfCountRecords = await salesforceQuery<{ AppointmentNumber: string }>(sfAuth, countSoql)
      sfApptNumbersForCount = sfCountRecords.map(r => r.AppointmentNumber).filter(Boolean)
      results.sf_total_count = sfApptNumbersForCount.length
    } catch (countErr) {
      console.error('[RECONCILE] SF count query failed:', String(countErr))
      results.errors++
    }

    if (sfApptNumbersForCount.length > 0) {
      const missingFromSupabase = new Set(sfApptNumbersForCount)
      const verifyBatches = chunk(sfApptNumbersForCount, SOQL_CHUNK_SIZE)

      for (const batch of verifyBatches) {
        try {
          const { data: found, error: verifyError } = await supabase
            .from('session_tracking')
            .select('appointment_number')
            .in('appointment_number', batch)

          if (verifyError) {
            console.error('[RECONCILE] Pass 3 verify batch failed:', verifyError)
            results.errors++
            continue
          }

          for (const row of found || []) {
            if (row.appointment_number) {
              missingFromSupabase.delete(row.appointment_number)
            }
          }
        } catch (err) {
          console.error('[RECONCILE] Pass 3 verify error:', String(err))
          results.errors++
        }
      }

      results.supabase_total_count = results.sf_total_count - missingFromSupabase.size
      results.count_delta = missingFromSupabase.size
      results.counts_in_sync = results.count_delta <= driftThreshold

      if (missingFromSupabase.size > 0) {
        const sample = Array.from(missingFromSupabase).slice(0, 10)
        console.log(`[RECONCILE] ${missingFromSupabase.size} SF appointments missing from Supabase (first 10): ${sample.join(', ')}`)
      }
    }

    console.log(`[RECONCILE] Last ${lookbackDays}d — SF: ${results.sf_total_count} | In Supabase: ${results.supabase_total_count} | Missing: ${results.count_delta} | In sync: ${results.counts_in_sync}`)

    // ================================================================
    // Summary
    // ================================================================
    const duration = ((Date.now() - startTime) / 1000).toFixed(2)

    console.log('='.repeat(50))
    console.log('Session Reconciliation Complete')
    console.log(`--- Pass 1: Stale Sessions ---`)
    console.log(`Stale found: ${results.stale_found}`)
    console.log(`Updated: ${results.updated}`)
    console.log(`  Dates corrected: ${results.dates_corrected}`)
    console.log(`  Durations corrected: ${results.durations_corrected}`)
    console.log(`  Status changes: ${JSON.stringify(results.updates_by_status)}`)
    console.log(`No SF match: ${results.no_sf_match}`)
    console.log(`Already correct: ${results.already_correct}`)
    console.log(`--- Pass 1.5: Content Backfill ---`)
    console.log(`Candidates (plan IS NULL): ${results.content_candidates}`)
    console.log(`Content synced: ${results.content_synced}`)
    console.log(`--- Pass 2: Missing Appointments ---`)
    console.log(`Missing found: ${results.missing_found}`)
    console.log(`Missing inserted: ${results.missing_inserted}`)
    console.log(`--- Pass 3: Count Verification (last ${lookbackDays}d, excl. cancelled) ---`)
    console.log(`SF appointments: ${results.sf_total_count}`)
    console.log(`In Supabase: ${results.supabase_total_count}`)
    console.log(`Missing: ${results.count_delta} (threshold: ${driftThreshold})`)
    console.log(`--- Totals ---`)
    console.log(`Errors: ${results.errors}`)
    console.log(`Duration: ${duration}s`)
    console.log('='.repeat(50))

    // ================================================================
    // Slack alert (skip silently if webhook not configured)
    // ================================================================
    const slackWebhookUrl = Deno.env.get('SLACK_OPS_WEBHOOK_URL')
    const workDone = results.updated > 0 || results.content_synced > 0 || results.missing_inserted > 0 || results.errors > 0
    const driftAlert = !results.counts_in_sync

    if (slackWebhookUrl && (workDone || driftAlert)) {
      const today = new Date().toISOString().slice(0, 10)
      const driftIcon = results.counts_in_sync ? '\u2705' : '\u26a0\ufe0f'
      const sfFmt = results.sf_total_count.toLocaleString()
      const supFmt = results.supabase_total_count.toLocaleString()

      const message = [
        `*Session Reconciliation - ${today}*`,
        '',
        `Pass 1: ${results.updated} updated (${results.dates_corrected} dates, ${results.durations_corrected} durations) | ${results.already_correct} already correct | ${results.no_sf_match} no SF match`,
        `Pass 1.5: ${results.content_synced} sessions backfilled with goals/plan/themes (${results.content_candidates} candidates)`,
        `Pass 2: ${results.missing_found} missing found | ${results.missing_inserted} inserted`,
        `Counts (last ${lookbackDays}d, excl. cancelled): SF ${sfFmt} | In Supabase ${supFmt} | Missing: ${results.count_delta} ${driftIcon}`,
        `Errors: ${results.errors} | Duration: ${duration}s`,
      ].join('\n')

      try {
        const slackRes = await fetch(slackWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: message }),
        })
        if (!slackRes.ok) {
          console.error(`[RECONCILE] Slack webhook failed: ${slackRes.status} ${await slackRes.text()}`)
        } else {
          console.log('[RECONCILE] Slack alert sent')
        }
      } catch (slackErr) {
        console.error('[RECONCILE] Slack webhook error:', String(slackErr))
      }
    } else if (!slackWebhookUrl) {
      console.log('[RECONCILE] SLACK_OPS_WEBHOOK_URL not set, skipping alert')
    } else {
      console.log('[RECONCILE] Quiet run, no Slack alert needed')
    }

    return jsonResponse({ success: true, results, duration: `${duration}s` })

  } catch (error) {
    console.error('[RECONCILE] Fatal error:', error)
    return jsonResponse(
      { error: 'Session reconciliation failed', details: String(error) },
      500
    )
  }
})

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
