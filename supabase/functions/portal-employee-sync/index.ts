// portal-employee-sync: Syncs employee add/update/deactivate from portal to employee_manager                                        
  // Salesforce writes are DISABLED — a Slack notification is sent instead for manual SF entry                                       
                                                                                                                                       
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
                                                                                                                                       
  async function sendSlackNotification(text: string): Promise<void> {                                                                
    const webhookUrl = Deno.env.get('SLACK_WEBHOOK_URL')
    if (!webhookUrl) {                                                                                                                 
      console.warn('SLACK_WEBHOOK_URL not set — skipping Slack notification')
      return                                                                                                                           
    }                                                                                                                                
    const res = await fetch(webhookUrl, {                                                                                              
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },                                                                                 
      body: JSON.stringify({ text }),                                                                                                
    })
    if (!res.ok) {
      console.error('Slack notification failed:', await res.text())                                                                    
    }
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
                                                                                                                                       
    // Send Slack notification with everything needed for manual SF entry
    const lines = [                                                                                                                    
      `🆕 *New Employee Added — needs Salesforce Contact created*`,                                                                  
      `• *Name:* ${req.first_name} ${req.last_name}`,                                                                                  
      `• *Email:* ${req.email}`,                                                                                                       
      `• *Company:* ${req.company_name || '—'} (company_id: ${req.company_id})`,                                                       
      `• *Job Title:* ${req.job_title || '—'}`,                                                                                        
      `• *Program:* ${programTitle || req.program || '—'}`,                                                                          
      `• *SF Account ID:* ${accountId || '— (not found in program_config)'}`,                                                          
      `• *employee_manager ID:* ${employee.id}`,                                                                                       
      `\n_Once added to Salesforce, the next sync run will auto-link this row via email match._`,                                      
    ]                                                                                                                                  
    await sendSlackNotification(lines.join('\n'))                                                                                    
                                                                                                                                       
    return {                                                                                                                         
      success: true,
      employee_id: employee.id,
    }
  }                                                                                                                                    
   
  async function handleUpdate(req: UpdateRequest) {                                                                                    
    const supabase = getSupabaseClient()                                                                                             

    // Look up employee to get current SF contact ID (for Slack notification)                                                          
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

    // Build list of SF-relevant field changes for the notification                                                                    
    const sfRelevantFields: Record<string, string> = {}
    if (req.fields.first_name !== undefined) sfRelevantFields['FirstName'] = req.fields.first_name                                     
    if (req.fields.last_name !== undefined) sfRelevantFields['LastName'] = req.fields.last_name                                        
    if (req.fields.company_email !== undefined) sfRelevantFields['Email'] = req.fields.company_email                                   
    if (req.fields.job_title !== undefined) sfRelevantFields['Title'] = req.fields.job_title                                           
    if (req.fields.program !== undefined) sfRelevantFields['Coaching_Program__c'] = req.fields.program                               
                                                                                                                                       
    const fieldLines = Object.entries(sfRelevantFields).length > 0                                                                     
      ? Object.entries(sfRelevantFields).map(([k, v]) => `  - ${k}: ${v}`).join('\n')                                                  
      : '  (no Salesforce-mapped fields changed)'                                                                                      
                                                                                                                                     
    const lines = [                                                                                                                    
      `✏️  *Employee Updated — needs Salesforce Contact updated*`,                                                                    
      `• *Name:* ${employee.first_name} ${employee.last_name}`,                                                                        
      `• *Email:* ${employee.company_email}`,
      `• *SF Contact ID:* ${employee.salesforce_contact_id || '— (not linked)'}`,                                                      
      `• *Fields to update in SF:*\n${fieldLines}`,                                                                                  
      `• *employee_manager ID:* ${employee.id}`,                                                                                       
    ]                                                                                                                                  
    await sendSlackNotification(lines.join('\n'))                                                                                      
                                                                                                                                       
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

    // Send Slack notification
    const lines = [
      `🔴 *Employee Terminated — needs Salesforce Contact updated*`,
      `• *Name:* ${employee.first_name} ${employee.last_name}`,                                                                        
      `• *Email:* ${req.email}`,
      `• *Company ID:* ${req.company_id}`,                                                                                             
      `• *SF Contact ID:* ${employee.salesforce_contact_id || '— (not linked)'}`,                                                      
      `• *Update in SF:* \`Status__c\` → \`Terminated\``,
      `• *employee_manager ID:* ${employee.id}`,                                                                                       
    ]                                                                                                                                
    await sendSlackNotification(lines.join('\n'))                                                                                      
                                                                                                                                     
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
