// portal-employee-sync: Syncs employee add/deactivate from portal to Salesforce + employee_manager
// Uses Client Credentials OAuth against SF production

import { getSalesforceAuth, getSalesforcePortalConfig } from '../_shared/salesforce.ts'
import { getSupabaseClient } from '../_shared/supabase.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AddRequest {
  action: 'add'
  email: string
  first_name: string
  last_name: string
  company_id: string
  job_title?: string
  company_name?: string
  program?: string
  sf_account_id?: string
}

interface UpdateRequest {
  action: 'update'
  employee_id: number
  company_id: string
  fields: Record<string, any>
}

interface DeactivateRequest {
  action: 'deactivate'
  email: string
  company_id: string
}

type SyncRequest = AddRequest | UpdateRequest | DeactivateRequest

function validateAdd(body: Record<string, unknown>): body is AddRequest {
  return body.action === 'add' &&
    typeof body.email === 'string' &&
    typeof body.first_name === 'string' &&
    typeof body.last_name === 'string' &&
    typeof body.company_id === 'string'
}

function validateUpdate(body: Record<string, unknown>): body is UpdateRequest {
  return body.action === 'update' &&
    typeof body.employee_id === 'number' &&
    typeof body.company_id === 'string' &&
    typeof body.fields === 'object' &&
    body.fields !== null
}

function validateDeactivate(body: Record<string, unknown>): body is DeactivateRequest {
  return body.action === 'deactivate' &&
    typeof body.email === 'string' &&
    typeof body.company_id === 'string'
}

async function handleAdd(req: AddRequest) {
  const supabase = getSupabaseClient()

  // 1. Auth to SF
  const config = getSalesforcePortalConfig()
  const auth = await getSalesforceAuth(config)

  // 2. Look up SF Account ID + program_title from program_config if not provided
  let accountId = req.sf_account_id
  let programTitle: string | null = null
  if (!accountId) {
    let query = supabase
      .from('program_config')
      .select('sf_account_id, program_title')
      .eq('company_id', req.company_id)
      .not('sf_account_id', 'is', null)

    // Narrow by program type if provided (handles multi-program companies)
    if (req.program) {
      query = query.ilike('program_type', req.program)
    }

    const { data: program } = await query.limit(1).single()

    if (program?.sf_account_id) {
      accountId = program.sf_account_id
    }
    if (program?.program_title) {
      programTitle = program.program_title
    }
  }

  // If program_config lookup didn't yield a title, the value itself may be the title
  if (!programTitle && req.program) {
    programTitle = req.program
  }

  // 3. Create Contact in Salesforce
  const contactBody: Record<string, string> = {
    RecordTypeId: '0123h000000R6p5AAC', // Client record type
    FirstName: req.first_name,
    LastName: req.last_name,
    Email: req.email,
    Status__c: 'Unregistered',
  }
  if (accountId) {
    contactBody.AccountId = accountId
  }
  if (req.job_title) {
    contactBody.Title = req.job_title
  }
  // Look up SF Program record by title to set the Coaching_Program__c lookup
  // (Boon_Program__c is a formula that reads from this lookup, so it's read-only)
  if (programTitle) {
    const soql = `SELECT Id FROM Company_Program__c WHERE Program_Title__c = '${programTitle.replace(/'/g, "\\'")}'  LIMIT 1`
    const qRes = await fetch(
      `${auth.instanceUrl}/services/data/v59.0/query?q=${encodeURIComponent(soql)}`,
      { headers: { Authorization: `Bearer ${auth.accessToken}` } }
    )
    if (qRes.ok) {
      const qData = await qRes.json()
      if (qData.records?.length > 0) {
        contactBody.Coaching_Program__c = qData.records[0].Id
      }
    }
  }

  const sfRes = await fetch(`${auth.instanceUrl}/services/data/v59.0/sobjects/Contact`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(contactBody),
  })

  if (!sfRes.ok) {
    const err = await sfRes.text()
    throw new Error(`Salesforce Contact create failed (${sfRes.status}): ${err}`)
  }

  const sfData = await sfRes.json()
  const salesforceContactId = sfData.id as string

  // 4. Insert into employee_manager
  const { data: employee, error: dbError } = await supabase
    .from('employee_manager')
    .insert({
      company_email: req.email,
      first_name: req.first_name,
      last_name: req.last_name,
      company_id: req.company_id,
      job_title: req.job_title || null,
      company_name: req.company_name || null,
      coaching_program: req.program || null,
      status: 'Active',
      salesforce_contact_id: salesforceContactId,
    })
    .select('id')
    .single()

  if (dbError) {
    throw new Error(`employee_manager insert failed: ${dbError.message}`)
  }

  return {
    success: true,
    salesforce_contact_id: salesforceContactId,
    employee_id: employee.id,
  }
}

async function handleUpdate(req: UpdateRequest) {
  const supabase = getSupabaseClient()

  // 1. Look up employee to get salesforce_contact_id
  const { data: employee, error: lookupError } = await supabase
    .from('employee_manager')
    .select('id, salesforce_contact_id')
    .eq('id', req.employee_id)
    .eq('company_id', req.company_id)
    .single()

  if (lookupError || !employee) {
    throw new Error(`Employee not found: id=${req.employee_id}, company=${req.company_id}`)
  }

  // 2. Build SF Contact PATCH payload from changed fields
  const sfPatch: Record<string, string> = {}
  const fields = req.fields

  if (fields.first_name !== undefined) sfPatch.FirstName = fields.first_name
  if (fields.last_name !== undefined) sfPatch.LastName = fields.last_name
  if (fields.company_email !== undefined) sfPatch.Email = fields.company_email
  if (fields.job_title !== undefined) sfPatch.Title = fields.job_title

  // 3. Auth to SF once (if we have a contact to update)
  let sfStatus: number | null = null
  let sfError: string | null = null
  let auth: Awaited<ReturnType<typeof getSalesforceAuth>> | null = null
  if (employee.salesforce_contact_id && (Object.keys(sfPatch).length > 0 || (fields.program !== undefined && fields.program))) {
    const config = getSalesforcePortalConfig()
    auth = await getSalesforceAuth(config)
  }

  // 4. If program changed, find the SF Program record ID and set the lookup
  // Boon_Program__c is a formula (read-only). The writable field is Coaching_Program__c (lookup).
  if (fields.program !== undefined && fields.program && auth) {
    // Resolve program_title to search SF
    let programTitle = fields.program
    const { data: byType } = await supabase
      .from('program_config')
      .select('program_title')
      .eq('company_id', req.company_id)
      .ilike('program_type', fields.program)
      .limit(1)
      .single()
    if (byType?.program_title) {
      programTitle = byType.program_title
    }

    // Query SF for the Program record by title
    const soql = `SELECT Id FROM Company_Program__c WHERE Program_Title__c = '${programTitle.replace(/'/g, "\\'")}'  LIMIT 1`
    const qRes = await fetch(
      `${auth.instanceUrl}/services/data/v59.0/query?q=${encodeURIComponent(soql)}`,
      { headers: { Authorization: `Bearer ${auth.accessToken}` } }
    )
    if (qRes.ok) {
      const qData = await qRes.json()
      if (qData.records?.length > 0) {
        sfPatch.Coaching_Program__c = qData.records[0].Id
      }
    }
  }

  // 5. PATCH the SF Contact (only if we have the SF id and there are SF-relevant changes)
  if (auth && employee.salesforce_contact_id && Object.keys(sfPatch).length > 0) {
    const sfRes = await fetch(
      `${auth.instanceUrl}/services/data/v59.0/sobjects/Contact/${employee.salesforce_contact_id}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sfPatch),
      }
    )

    sfStatus = sfRes.status
    if (!sfRes.ok) {
      sfError = await sfRes.text()
      console.error('SF Contact PATCH failed:', sfStatus, sfError)
      // Log but don't block — still update employee_manager
    }
  }

  // 5. Update employee_manager with all fields
  // Remap program -> coaching_program for canonical storage
  const dbFields = { ...fields }
  if (dbFields.program !== undefined) {
    dbFields.coaching_program = dbFields.program
    delete dbFields.program
  }
  const { data: updated, error: updateError } = await supabase
    .from('employee_manager')
    .update(dbFields)
    .eq('id', req.employee_id)
    .eq('company_id', req.company_id)
    .select('id')
    .single()

  if (updateError) {
    throw new Error(`employee_manager update failed: ${updateError.message}`)
  }

  return {
    success: true,
    employee_id: updated.id,
    sf_updated: sfStatus === 204,
    sf_error: sfError,
  }
}

async function handleDeactivate(req: DeactivateRequest) {
  const supabase = getSupabaseClient()

  // 1. Look up employee to get salesforce_contact_id
  const { data: employee, error: lookupError } = await supabase
    .from('employee_manager')
    .select('id, salesforce_contact_id')
    .ilike('company_email', req.email)
    .eq('company_id', req.company_id)
    .single()

  if (lookupError || !employee) {
    throw new Error(`Employee not found for ${req.email} in company ${req.company_id}`)
  }

  // 2. Auth to SF
  const config = getSalesforcePortalConfig()
  const auth = await getSalesforceAuth(config)

  // 3. Update Contact status in Salesforce (if we have the SF id)
  if (employee.salesforce_contact_id) {
    const sfRes = await fetch(
      `${auth.instanceUrl}/services/data/v59.0/sobjects/Contact/${employee.salesforce_contact_id}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ Status__c: 'Terminated' }),
      }
    )

    if (!sfRes.ok) {
      const err = await sfRes.text()
      throw new Error(`Salesforce Contact update failed (${sfRes.status}): ${err}`)
    }
  }

  // 4. Update employee_manager status + end_date
  const { error: updateError } = await supabase
    .from('employee_manager')
    .update({ status: 'Terminated', end_date: new Date().toISOString().split('T')[0] })
    .eq('id', employee.id)

  if (updateError) {
    throw new Error(`employee_manager update failed: ${updateError.message}`)
  }

  return { success: true }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body = await req.json()

    if (body.action === 'add' && validateAdd(body)) {
      const result = await handleAdd(body)
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (body.action === 'update' && validateUpdate(body)) {
      const result = await handleUpdate(body)
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (body.action === 'deactivate' && validateDeactivate(body)) {
      const result = await handleDeactivate(body)
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Invalid request. Required: action (add|update|deactivate). See docs for required fields per action.' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('portal-employee-sync error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
