// Salesforce Appointment Outbound Message Receiver
// Deploy as: salesforce-appointments

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function getSupabaseClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
}

// Parse XML from Salesforce Outbound Message
function parseOutboundMessage(xml: string): Record<string, string> {
  const result: Record<string, string> = {};
  
  // Extract fields from the Notification XML
  // Salesforce sends: <sObject><FieldName>value</FieldName>...</sObject>
  const sObjectMatch = xml.match(/<sf:sObject[^>]*>([\s\S]*?)<\/sf:sObject>/i);
  if (!sObjectMatch) {
    console.log('No sObject found in XML');
    return result;
  }
  
  const sObjectContent = sObjectMatch[1];
  
  // Extract all sf: prefixed fields
  const fieldRegex = /<sf:(\w+)>([\s\S]*?)<\/sf:\1>/gi;
  let match;
  while ((match = fieldRegex.exec(sObjectContent)) !== null) {
    const fieldName = match[1];
    const fieldValue = match[2].trim();
    result[fieldName] = fieldValue;
  }
  
  return result;
}

// Map Salesforce field names to session_tracking columns
function mapToSessionTracking(sfData: Record<string, string>): Record<string, any> {
  return {
    // Map Salesforce Appointment fields to session_tracking columns
    // Adjust these mappings based on your actual Salesforce field names
    id: sfData.Id || sfData.Appointment_ID__c,
    employee_name: sfData.Client_Name__c || sfData.Contact_Name__c || null,
    session_date: sfData.Appointment_Date__c || sfData.Start_DateTime__c || null,
    status: mapStatus(sfData.Status__c || sfData.Appointment_Status__c),
    coach_name: sfData.Coach_Name__c || sfData.Coach__c || null,
    duration_minutes: sfData.Duration__c ? parseInt(sfData.Duration__c) : 60,
    zoom_join_link: sfData.Zoom_Link__c || sfData.Join_URL__c || null,
    cancel_session_link: sfData.Cancel_Link__c || null,
    reschedule_session_link: sfData.Reschedule_Link__c || null,
    program_name: sfData.Program_Name__c || sfData.Coaching_Program__c || null,
    account_name: sfData.Account_Name__c || sfData.Company__c || null,
    salesforce_program_id: sfData.Program__c || sfData.Coaching_Program_ID__c || null,
    appointment_number: sfData.Appointment_Number__c ? parseInt(sfData.Appointment_Number__c) : null,
  };
}

function mapStatus(sfStatus: string | undefined): string {
  if (!sfStatus) return 'Scheduled';
  
  const statusMap: Record<string, string> = {
    'Scheduled': 'Scheduled',
    'Completed': 'Completed',
    'Canceled': 'Canceled',
    'Cancelled': 'Canceled',
    'No Show': 'No Show',
    'Late Cancel': 'Late Cancel',
    'Rescheduled': 'Rescheduled',
  };
  
  return statusMap[sfStatus] || sfStatus;
}

// Generate ACK response for Salesforce
function generateAckResponse(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Body>
    <notificationsResponse xmlns="http://soap.sforce.com/2005/09/outbound">
      <Ack>true</Ack>
    </notificationsResponse>
  </soapenv:Body>
</soapenv:Envelope>`;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const contentType = req.headers.get('content-type') || '';
    let xmlBody: string;

    if (contentType.includes('xml') || contentType.includes('text')) {
      xmlBody = await req.text();
    } else {
      // Try to read as text anyway
      xmlBody = await req.text();
    }

    console.log('Received Salesforce Outbound Message');
    console.log('Content-Type:', contentType);
    console.log('Body preview:', xmlBody.substring(0, 500));

    // Parse the Salesforce data
    const sfData = parseOutboundMessage(xmlBody);
    console.log('Parsed Salesforce data:', sfData);

    if (Object.keys(sfData).length === 0) {
      console.error('No data parsed from XML');
      // Still return ACK to prevent Salesforce from retrying
      return new Response(generateAckResponse(), {
        headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
      });
    }

    // Map to session_tracking format
    const sessionData = mapToSessionTracking(sfData);
    console.log('Mapped session data:', sessionData);

    // Skip if no meaningful data
    if (!sessionData.employee_name && !sessionData.session_date) {
      console.log('No employee or session date - skipping insert');
      return new Response(generateAckResponse(), {
        headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
      });
    }

    const supabase = getSupabaseClient();

    // Look up employee_id by client email (case-insensitive)
    const clientEmail = sfData.Client_Email__c || sfData.Contact_Email__c || sfData.Email;
    if (clientEmail) {
      const { data: employee } = await supabase
        .from('employee_manager')
        .select('id')
        .ilike('company_email', clientEmail)
        .maybeSingle();

      if (employee) {
        sessionData.employee_id = employee.id;
        console.log(`Matched employee_id: ${employee.id} for ${clientEmail}`);
      } else {
        console.log(`No employee_manager match for: ${clientEmail}`);
      }
    }

    // Upsert into session_tracking (use Salesforce ID as unique key)
    const { data, error } = await supabase
      .from('session_tracking')
      .upsert(
        {
          ...sessionData,
          created_at: new Date().toISOString(),
        },
        {
          onConflict: 'id',
          ignoreDuplicates: false
        }
      )
      .select();

    if (error) {
      console.error('Supabase upsert error:', error);
      // Still ACK to prevent infinite retries, but log the error
    } else {
      console.log('Session tracking upserted:', data);
    }

    // Return ACK to Salesforce
    return new Response(generateAckResponse(), {
      headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
    });

  } catch (error) {
    console.error('Error processing outbound message:', error);
    
    // Still return ACK to prevent Salesforce from retrying indefinitely
    return new Response(generateAckResponse(), {
      headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
    });
  }
});