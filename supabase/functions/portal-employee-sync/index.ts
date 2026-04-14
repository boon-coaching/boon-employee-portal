// portal-employee-sync: Syncs employee add/update/deactivate from portal to employee_manager                                        
  // Salesforce writes are DISABLED — a Slack notification is sent instead for manual SF entry                                         
                                                                                                                                       
  import { getSupabaseClient } from '../_shared/supabase.ts'                                                                           
  import { sendSlackMessage } from '../_shared/slack.ts'                                                                               
                                                                                                                                       
  const SLACK_CHANNEL = '#employee-manager-new'                                                                                      

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
                                                                                                                                       
    // Look up SF Account ID + program_title from program_config (for Slack notification)                                              
    let accountId = req.sf_account_id
    let programTitle: string | null = null                                                                                             
    if (!accountId) {                                                                                                                
      let query = supabase                                                                                                             
        .from('program_config')
        .select('sf_account_id, program_title')                                                                                        
        .eq('company_id', req.company_id)                                                                                            
        .not('sf_account_id', 'is', null)                                                                                              
   
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
                                                                                                                                       
    if (!programTitle && req.program) {
      programTitle = req.program                                                                                                       
    }                                                                                                                                

    // Insert into employee_manager (no SF contact ID — will be linked after manual SF entry)                                          
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
      })                                                                                                                               
      .select('id')
      .single()                                                                                                                        
                                                                                                                                     
    if (dbError) {
      throw new Error(`employee_manager insert failed: ${dbError.message}`)
    }                                                                                                                                  
   
    const botToken = Deno.env.get('SLACK_BOT_TOKEN')!                                                                                  
    await sendSlackMessage(botToken, {                                                                                               
      channel: SLACK_CHANNEL,                                                                                                          
      text: `New employee added: ${req.first_name} ${req.last_name} — needs Salesforce Contact created`,
      blocks: [                                                                                                                        
        {                                                                                                                            
          type: 'header',                                                                                                              
          text: { type: 'plain_text', text: '🆕 New Employee Added — Add to Salesforce' },                                           
        },                                                                                                                             
        {
          type: 'section',                                                                                                             
          fields: [                                                                                                                  
            { type: 'mrkdwn', text: `*Name:*\n${req.first_name} ${req.last_name}` },
            { type: 'mrkdwn', text: `*Email:*\n${req.email}` },                                                                        
            { type: 'mrkdwn', text: `*Company:*\n${req.company_name || '—'}` },                                                        
            { type: 'mrkdwn', text: `*Job Title:*\n${req.job_title || '—'}` },                                                         
            { type: 'mrkdwn', text: `*Program:*\n${programTitle || req.program || '—'}` },                                             
            { type: 'mrkdwn', text: `*SF Account ID:*\n${accountId || '— (not found)'}` },                                             
          ],                                                                                                                           
        },                                                                                                                             
        {                                                                                                                              
          type: 'context',                                                                                                           
          elements: [
            {
              type: 'mrkdwn',
              text: `employee_manager ID: ${employee.id} · Once added to Salesforce, the next sync will auto-link this row via email 
  match`,                                                                                                                              
            },
          ],                                                                                                                           
        },                                                                                                                           
      ],
    })

    return {
      success: true,
      employee_id: employee.id,                                                                                                        
    }
  }                                                                                                                                    
                                                                                                                                     
  async function handleUpdate(req: UpdateRequest) {
    const supabase = getSupabaseClient()

    // Look up employee
    const { data: employee, error: lookupError } = await supabase
      .from('employee_manager')                                                                                                        
      .select('id, salesforce_contact_id, first_name, last_name, company_email')
      .eq('id', req.employee_id)                                                                                                       
      .eq('company_id', req.company_id)                                                                                              
      .single()                                                                                                                        
                                                                                                                                     
    if (lookupError || !employee) {                                                                                                    
      throw new Error(`Employee not found: id=${req.employee_id}, company=${req.company_id}`)
    }                                                                                                                                  
                                                                                                                                     
    // Update employee_manager                                                                                                         
    const dbFields = { ...req.fields }
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

    // Build list of SF-relevant field changes                                                                                         
    const sfRelevantFields: Record<string, string> = {}
    if (req.fields.first_name !== undefined) sfRelevantFields['FirstName'] = req.fields.first_name                                     
    if (req.fields.last_name !== undefined) sfRelevantFields['LastName'] = req.fields.last_name                                        
    if (req.fields.company_email !== undefined) sfRelevantFields['Email'] = req.fields.company_email                                   
    if (req.fields.job_title !== undefined) sfRelevantFields['Title'] = req.fields.job_title                                           
    if (req.fields.program !== undefined) sfRelevantFields['Coaching_Program__c'] = req.fields.program                                 
                                                                                                                                       
    const fieldText = Object.entries(sfRelevantFields).length > 0                                                                      
      ? Object.entries(sfRelevantFields).map(([k, v]) => `• ${k}: ${v}`).join('\n')                                                    
      : '_(no Salesforce-mapped fields changed)_'                                                                                      
                                                                                                                                       
    const botToken = Deno.env.get('SLACK_BOT_TOKEN')!                                                                                  
    await sendSlackMessage(botToken, {                                                                                                 
      channel: SLACK_CHANNEL,                                                                                                          
      text: `Employee updated: ${employee.first_name} ${employee.last_name} — needs Salesforce Contact updated`,
      blocks: [                                                                                                                        
        {                                                                                                                            
          type: 'header',                                                                                                              
          text: { type: 'plain_text', text: '✏️  Employee Updated — Update in Salesforce' },
        },                                                                                                                             
        {                                                                                                                            
          type: 'section',
          fields: [                                                                                                                    
            { type: 'mrkdwn', text: `*Name:*\n${employee.first_name} ${employee.last_name}` },
            { type: 'mrkdwn', text: `*Email:*\n${employee.company_email}` },                                                           
            { type: 'mrkdwn', text: `*SF Contact ID:*\n${employee.salesforce_contact_id || '— (not linked)'}` },                       
          ],                                                                                                                           
        },                                                                                                                             
        {                                                                                                                              
          type: 'section',                                                                                                           
          text: { type: 'mrkdwn', text: `*Fields to update in Salesforce:*\n${fieldText}` },
        },                                                                                                                             
        {
          type: 'context',                                                                                                             
          elements: [{ type: 'mrkdwn', text: `employee_manager ID: ${employee.id}` }],                                               
        },                                                                                                                             
      ],
    })                                                                                                                                 
                                                                                                                                     
    return {
      success: true,
      employee_id: updated.id,
    }                                                                                                                                  
  }
                                                                                                                                       
  async function handleDeactivate(req: DeactivateRequest) {                                                                          
    const supabase = getSupabaseClient()

    // Look up employee
    const { data: employee, error: lookupError } = await supabase
      .from('employee_manager')                                                                                                        
      .select('id, salesforce_contact_id, first_name, last_name')
      .ilike('company_email', req.email)                                                                                               
      .eq('company_id', req.company_id)                                                                                                
      .single()
                                                                                                                                       
    if (lookupError || !employee) {                                                                                                  
      throw new Error(`Employee not found for ${req.email} in company ${req.company_id}`)
    }                                                                                                                                  
   
    // Update employee_manager status + end_date                                                                                       
    const { error: updateError } = await supabase                                                                                    
      .from('employee_manager')                                                                                                        
      .update({ status: 'Terminated', end_date: new Date().toISOString().split('T')[0] })                                            
      .eq('id', employee.id)                                                                                                           
   
    if (updateError) {                                                                                                                 
      throw new Error(`employee_manager update failed: ${updateError.message}`)                                                      
    }                                                                                                                                  
                                                                                                                                     
    const botToken = Deno.env.get('SLACK_BOT_TOKEN')!
    await sendSlackMessage(botToken, {
      channel: SLACK_CHANNEL,                                                                                                          
      text: `Employee terminated: ${employee.first_name} ${employee.last_name} — needs Salesforce Contact updated`,
      blocks: [                                                                                                                        
        {                                                                                                                              
          type: 'header',
          text: { type: 'plain_text', text: '🔴 Employee Terminated — Update in Salesforce' },                                         
        },                                                                                                                           
        {
          type: 'section',
          fields: [                                                                                                                    
            { type: 'mrkdwn', text: `*Name:*\n${employee.first_name} ${employee.last_name}` },
            { type: 'mrkdwn', text: `*Email:*\n${req.email}` },                                                                        
            { type: 'mrkdwn', text: `*Company ID:*\n${req.company_id}` },                                                              
            { type: 'mrkdwn', text: `*SF Contact ID:*\n${employee.salesforce_contact_id || '— (not linked)'}` },                       
          ],                                                                                                                           
        },                                                                                                                             
        {                                                                                                                              
          type: 'section',
          text: { type: 'mrkdwn', text: `*Update in Salesforce:* set \`Status__c\` → \`Terminated\`` },                                
        },                                                                                                                             
        {
          type: 'context',                                                                                                             
          elements: [{ type: 'mrkdwn', text: `employee_manager ID: ${employee.id}` }],                                               
        },                                                                                                                             
      ],
    })                                                                                                                                 
                                                                                                                                     
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
        JSON.stringify({ error: 'Invalid request. Required: action (add|update|deactivate). See docs for required fields per action.'  
  }),                                                                                                                                  
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
