// SF Absence Sync Edge Function
// Pushes coach_calendar_blocks to Salesforce as ResourceAbsence records.
// Deploy with: supabase functions deploy sf-absence-sync --schedule "7,22,37,52 * * * *"
//
// Runs every 15 minutes, offset from calendar-sync (which runs at 0,15,30,45).
// Uses delete-and-recreate strategy: removes all Boon-created absences, then
// recreates from current calendar blocks. This mirrors calendar-sync's approach.

import { getSupabaseClient } from '../_shared/supabase.ts'
import {
  getSalesforceAuth,
  getSalesforceConfig,
  salesforceQuery,
  salesforceComposite,
  chunk,
} from '../_shared/salesforce.ts'

const ABSENCE_MARKER = 'Boon Calendar Sync'
const SYNC_WINDOW_DAYS = 14
const COMPOSITE_BATCH_SIZE = 25

interface CoachWithSfResource {
  id: string
  name: string
  salesforce_resource_id: string
}

interface CalendarBlock {
  busy_start: string
  busy_end: string
}

interface ResourceAbsenceRecord {
  Id: string
  Description: string | null
}

Deno.serve(async (req) => {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 })
  }

  const startTime = Date.now()
  const results = {
    coaches_processed: 0,
    absences_deleted: 0,
    absences_created: 0,
    errors: 0,
  }

  try {
    const supabase = getSupabaseClient()
    const sfConfig = getSalesforceConfig()
    const sfAuth = await getSalesforceAuth(sfConfig)

    console.log('Authenticated to Salesforce:', sfAuth.instanceUrl)

    // Fetch coaches that have a Salesforce ServiceResource mapping
    const { data: coaches, error: coachError } = await supabase
      .from('coaches')
      .select('id, name, salesforce_resource_id')
      .not('salesforce_resource_id', 'is', null)

    if (coachError) {
      throw new Error(`Failed to fetch coaches: ${coachError.message}`)
    }

    if (!coaches || coaches.length === 0) {
      console.log('No coaches with salesforce_resource_id set')
      return jsonResponse({ success: true, message: 'No coaches to sync', results })
    }

    console.log(`Processing ${coaches.length} coaches with SF resource IDs`)

    const now = new Date()
    const futureWindow = new Date(now.getTime() + SYNC_WINDOW_DAYS * 24 * 60 * 60 * 1000)

    for (const coach of coaches as CoachWithSfResource[]) {
      try {
        // Step 1: Query SF for existing Boon-created absences for this resource
        // SF IDs are 15/18-char alphanumeric only; reject anything unexpected
        if (!/^[a-zA-Z0-9]{15,18}$/.test(coach.salesforce_resource_id)) {
          console.error(`Invalid SF resource ID for coach ${coach.name}: ${coach.salesforce_resource_id}`)
          results.errors++
          continue
        }

        // Description is not filterable in SOQL, so fetch all future absences
        // for this resource and filter client-side by our marker
        const allAbsences = await salesforceQuery<ResourceAbsenceRecord>(
          sfAuth,
          `SELECT Id, Description FROM ResourceAbsence ` +
          `WHERE ResourceId = '${coach.salesforce_resource_id}' ` +
          `AND Start >= ${now.toISOString()}`
        )
        const existingAbsences = allAbsences.filter(a => a.Description === ABSENCE_MARKER)

        // Step 2: Delete existing absences in batches of 25
        if (existingAbsences.length > 0) {
          const deleteBatches = chunk(existingAbsences, COMPOSITE_BATCH_SIZE)

          for (const batch of deleteBatches) {
            const deleteRequests = batch.map((absence, idx) => ({
              method: 'DELETE' as const,
              url: `/services/data/v59.0/sobjects/ResourceAbsence/${absence.Id}`,
              referenceId: `delete_${idx}`,
            }))

            const deleteResult = await salesforceComposite(sfAuth, deleteRequests)

            // Count successful deletes
            for (const sub of deleteResult.compositeResponse) {
              if (sub.httpStatusCode >= 200 && sub.httpStatusCode < 300) {
                results.absences_deleted++
              } else {
                console.error(`Delete failed for ${sub.referenceId}:`, JSON.stringify(sub.body))
              }
            }
          }
        }

        // Step 3: Read calendar blocks from Supabase (next 14 days)
        const { data: blocks, error: blockError } = await supabase
          .from('coach_calendar_blocks')
          .select('busy_start, busy_end')
          .eq('coach_id', coach.id)
          .gte('busy_end', now.toISOString())
          .lte('busy_start', futureWindow.toISOString())

        if (blockError) {
          console.error(`Failed to fetch blocks for coach ${coach.name}:`, blockError)
          results.errors++
          continue
        }

        // Step 4: Create ResourceAbsence records in batches of 25
        if (blocks && blocks.length > 0) {
          const createBatches = chunk(blocks as CalendarBlock[], COMPOSITE_BATCH_SIZE)

          for (const batch of createBatches) {
            const createRequests = batch.map((block, idx) => ({
              method: 'POST' as const,
              url: '/services/data/v59.0/sobjects/ResourceAbsence',
              referenceId: `create_${idx}`,
              body: {
                ResourceId: coach.salesforce_resource_id,
                Start: block.busy_start,
                End: block.busy_end,
                Type: 'Meeting',
                Description: ABSENCE_MARKER,
              },
            }))

            const createResult = await salesforceComposite(sfAuth, createRequests)

            for (const sub of createResult.compositeResponse) {
              if (sub.httpStatusCode >= 200 && sub.httpStatusCode < 300) {
                results.absences_created++
              } else {
                console.error(`Create failed for ${sub.referenceId}:`, JSON.stringify(sub.body))
              }
            }
          }
        }

        results.coaches_processed++
        console.log(
          `Coach ${coach.name}: deleted ${existingAbsences.length} old, ` +
          `created ${blocks?.length || 0} new absences`
        )

      } catch (coachError) {
        console.error(`Error syncing coach ${coach.name}:`, coachError)
        results.errors++
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2)

    console.log('='.repeat(40))
    console.log('SF Absence Sync Complete')
    console.log(`Coaches processed: ${results.coaches_processed}`)
    console.log(`Absences deleted: ${results.absences_deleted}`)
    console.log(`Absences created: ${results.absences_created}`)
    console.log(`Errors: ${results.errors}`)
    console.log(`Duration: ${duration}s`)
    console.log('='.repeat(40))

    return jsonResponse({ success: true, results, duration: `${duration}s` })

  } catch (error) {
    console.error('SF Absence Sync error:', error)
    return jsonResponse(
      { error: 'SF Absence Sync failed', details: String(error) },
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
