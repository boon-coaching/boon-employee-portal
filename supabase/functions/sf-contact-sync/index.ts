// sf-contact-sync: Pulls coach-match state from Salesforce Contact and mirrors
// it into employee_manager. Replaces the historic one-off backfill that left
// client_status stale (4,391 rows out of date as of 2026-04-25) and never
// populated Coach 1 / Coach 2 booking links the portal needs to surface
// match candidates inline.
//
// Modes:
//   - POST {} or no body                  -> sync everyone with a salesforce_contact_id
//   - POST { contact_ids: ["003..."] }   -> sync only those SF Contact ids
//   - POST { since: "2026-04-20T00:00Z" } -> sync rows last synced before timestamp
//
// Designed to be safe to run repeatedly. Idempotent on each row (PATCH with
// the latest SF values; sets sf_synced_at).
//
// Wire to a daily cron once verified: `0 6 * * *` keeps drift under 24h.

import { getSupabaseClient } from '../_shared/supabase.ts'
import {
  getSalesforceAuth,
  getSalesforcePortalConfig,
  salesforceQuery,
  chunk,
} from '../_shared/salesforce.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// SF Contact fields we mirror onto employee_manager. Names mirror Salesforce
// API names so readers can grep-trace either direction.
const SF_FIELDS = [
  'Id',
  'Email',
  'Status__c',
  'Coach__c',
  'Client_Booking_Link__c',
  'Coach_1_Email__c',
  'Coach_1_Booking_Link__c',
  'Coach_2_Email__c',
  'Coach_2_Booking_Link__c',
  'Initial_Coach_Match_Email_Sent__c',
] as const

interface SfContact {
  Id: string
  Email: string | null
  Status__c: string | null
  Coach__c: string | null
  Client_Booking_Link__c: string | null
  Coach_1_Email__c: string | null
  Coach_1_Booking_Link__c: string | null
  Coach_2_Email__c: string | null
  Coach_2_Booking_Link__c: string | null
  Initial_Coach_Match_Email_Sent__c: string | null
}

// SF returns 18-char ids; employee_manager has a mix of 15- and 18-char
// (historic data). Normalise to first 15 chars for matching — the trailing 3
// are a case-insensitivity checksum, the first 15 are the unique key.
const sfId15 = (id: string | null): string | null =>
  id && id.length >= 15 ? id.slice(0, 15) : id

// Salesforce 'Client_Booking_Link__c' is sometimes the literal string
// "No coach has been selected." instead of a URL. Normalise to null so the
// portal doesn't try to render it as a link.
function normaliseBookingLink(value: string | null): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (!/^https?:/i.test(trimmed)) return null
  return trimmed
}

interface SyncRequest {
  contact_ids?: string[]
  since?: string
  max_rows?: number  // hard cap on employee_manager rows scanned per invocation
}

interface SyncResult {
  scanned_employee_rows: number
  fetched_sf_records: number
  updated_rows: number
  unmatched_sf_records: number
  errors: string[]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST only' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let body: SyncRequest = {}
  try {
    const text = await req.text()
    if (text.trim()) body = JSON.parse(text) as SyncRequest
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const result = await runSync(body)
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

async function runSync(req: SyncRequest): Promise<SyncResult> {
  const supabase = getSupabaseClient()
  const errors: string[] = []

  // 1. Pull the employee_manager rows we want to keep in sync. PostgREST
  // caps at 1000 rows per request — paginate explicitly so we don't silently
  // truncate at 13k+ row table size.
  const PAGE = 1000
  const MAX = Math.min(req.max_rows ?? 100_000, 100_000)
  const employeeRows: Array<{ id: number; salesforce_contact_id: string | null }> = []
  for (let from = 0; from < MAX; from += PAGE) {
    let q = supabase
      .from('employee_manager')
      .select('id, salesforce_contact_id')
      .not('salesforce_contact_id', 'is', null)
      .order('sf_synced_at', { ascending: true, nullsFirst: true })
      .range(from, from + PAGE - 1)

    if (req.contact_ids && req.contact_ids.length > 0) {
      const ids15 = req.contact_ids.map((id) => sfId15(id) || id)
      q = q.or(
        [
          `salesforce_contact_id.in.(${req.contact_ids.join(',')})`,
          `salesforce_contact_id.in.(${ids15.join(',')})`,
        ].join(',')
      )
    } else if (req.since) {
      q = q.or(`sf_synced_at.is.null,sf_synced_at.lt.${req.since}`)
    }

    const { data, error } = await q
    if (error) throw new Error(`Failed to read employee_manager: ${error.message}`)
    if (!data || data.length === 0) break
    employeeRows.push(...(data as typeof employeeRows))
    if (data.length < PAGE) break
    if (employeeRows.length >= MAX) break
  }

  // Build map: 15-char SF id -> [employee_manager.id...] (multiple rows can
  // share an SF id during the duplicate-cleanup transition; we update all).
  const idMap = new Map<string, number[]>()
  for (const row of employeeRows) {
    const k = sfId15(row.salesforce_contact_id as string | null)
    if (!k) continue
    const list = idMap.get(k) || []
    list.push(row.id as number)
    idMap.set(k, list)
  }

  if (idMap.size === 0) {
    return {
      scanned_employee_rows: employeeRows.length,
      fetched_sf_records: 0,
      updated_rows: 0,
      unmatched_sf_records: 0,
      errors: [],
    }
  }

  // 2. Fetch matching SF Contacts in chunks (SOQL IN clause limit ~4k chars).
  const auth = await getSalesforceAuth(getSalesforcePortalConfig())
  const allKeys = Array.from(idMap.keys())
  const chunks = chunk(allKeys, 200)
  const sfRecords: SfContact[] = []

  for (const batch of chunks) {
    const idList = batch.map((id) => `'${id}'`).join(',')
    const soql = `SELECT ${SF_FIELDS.join(', ')} FROM Contact WHERE Id IN (${idList})`
    try {
      const records = await salesforceQuery<SfContact>(auth, soql)
      sfRecords.push(...records)
    } catch (err) {
      errors.push(
        `SOQL batch failed (${batch.length} ids): ${
          err instanceof Error ? err.message : String(err)
        }`
      )
    }
  }

  // 3. Apply updates in parallel batches. Sequential PATCHes are ~100ms each
  // and would push 13k rows past the 300s edge function timeout. 50 in flight
  // at a time keeps the connection pool happy and finishes in ~30s.
  let updated = 0
  let unmatched = 0
  const now = new Date().toISOString()
  const PARALLEL = 25

  type Task = { sfId: string; rowId: number; update: Record<string, unknown> }
  const tasks: Task[] = []
  for (const sf of sfRecords) {
    const k = sfId15(sf.Id)
    const targets = (k && idMap.get(k)) || []
    if (targets.length === 0) {
      unmatched++
      continue
    }
    const update = {
      client_status: sf.Status__c,
      coach: sf.Coach__c,
      booking_link: normaliseBookingLink(sf.Client_Booking_Link__c),
      sf_coach_1_email: sf.Coach_1_Email__c,
      sf_coach_1_booking_link: normaliseBookingLink(sf.Coach_1_Booking_Link__c),
      sf_coach_2_email: sf.Coach_2_Email__c,
      sf_coach_2_booking_link: normaliseBookingLink(sf.Coach_2_Booking_Link__c),
      sf_initial_match_email_sent_at: sf.Initial_Coach_Match_Email_Sent__c,
      sf_synced_at: now,
    }
    for (const id of targets) {
      tasks.push({ sfId: sf.Id, rowId: id, update })
    }
  }

  for (let i = 0; i < tasks.length; i += PARALLEL) {
    const batch = tasks.slice(i, i + PARALLEL)
    const results = await Promise.all(
      batch.map((t) =>
        supabase.from('employee_manager').update(t.update).eq('id', t.rowId)
      )
    )
    for (let j = 0; j < results.length; j++) {
      const r = results[j]
      const t = batch[j]
      if (r.error) {
        errors.push(`Update id=${t.rowId} (sf=${t.sfId}) failed: ${r.error.message}`)
      } else {
        updated++
      }
    }
  }

  return {
    scanned_employee_rows: employeeRows.length,
    fetched_sf_records: sfRecords.length,
    updated_rows: updated,
    unmatched_sf_records: unmatched,
    errors,
  }
}
