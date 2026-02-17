// supabase/functions/salesforce-session-sync/index.ts
//
// Receives coaching appointment data from Salesforce Flow HTTP Callout
// Replaces: Zapier 6-step flow
// 
// Trigger: Salesforce Flow on ServiceAppointment create/update
// 
// What it does:
// 1. Validates required fields
// 2. Looks up program_config for program_type + company_id
// 3. Upserts to session_tracking (keyed on appointment_number)
// 4. Updates employee_manager booking link
// 5. Logs everything

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("SF_WEBHOOK_SECRET") || "";

// ── Types ────────────────────────────────────────────────────────────

interface SalesforcePayload {
  // Appointment fields (from ServiceAppointment)
  appointment_number: string;       // AppointmentNumber (auto-number)
  status: string;                   // Status (picklist)
  scheduled_start: string;          // SchedStartTime
  scheduled_end?: string;           // SchedEndTime
  duration?: number;                // Duration
  actual_start?: string;            // ActualStartTime
  actual_end?: string;              // ActualEndTime
  actual_duration?: number;         // ActualDuration
  description?: string;             // Description
  subject?: string;                 // Subject

  // Client/Employee fields (from Client__c Contact lookup)
  client_name?: string;             // Client__c -> Contact.Name
  client_email?: string;            // Client__c -> Contact.Email
  client_first_name?: string;       // Client__c -> Contact.FirstName
  client_last_name?: string;        // Client__c -> Contact.LastName
  client_contact_id?: string;       // Client__c -> Contact.Id (SF record ID)
  client_booking_link?: string;     // Client__c -> Contact.Client_Booking_Link__c

  // Coach fields (from Coach__c Contact lookup)
  coach_name?: string;              // Coach__c -> Contact.Name

  // Program fields (from Company_Program__c lookup)
  program_name?: string;            // Company_Program__c -> Name
  program_number?: string;          // Company_Program__c -> Program_Number (CP-XXXX)
  salesforce_program_id?: string;   // Company_Program__c -> Id (SF record ID)

  // Account
  account_name?: string;            // Account_Name__c (formula field)

  // Session content
  zoom_join_link?: string;          // Zoom_Join_Link__c
  cancel_session_link?: string;     // Cancel_Session_Link__c (formula)
  reschedule_session_link?: string; // Reschedule_Session_Link__c (formula)
  goals?: string;                   // Goals__c
  plan?: string;                    // Plan__c
  notes?: string;                   // Notes__c
  employee_pre_session_notes?: string; // Employee_Pre_Session_Notes__c

  // Skills/themes (multi-select picklists)
  leadership_management_skills?: string;  // Leadership_Management_Skills__c
  communication_skills?: string;          // Communication_Skills__c
  mental_well_being?: string;             // Mental_Well_Being__c
  other_themes?: string;                  // Other_Themes__c

  // Session type
  session_type?: string;            // Session_Type__c (formula)
}

interface SyncResult {
  success: boolean;
  appointment_number: string;
  action: "created" | "updated" | "skipped";
  program_type: string | null;
  company_id: string | null;
  warnings: string[];
  error?: string;
}

// ── Program Type Derivation (fallback) ───────────────────────────────

function deriveProductType(programName: string): string {
  if (!programName) return "UNKNOWN";
  const name = programName.toUpperCase();

  if (name.includes("SCALE")) return "SCALE";
  if (name.includes("EXEC") || name.includes("EXECUTIVE COACHING")) return "EXEC";
  if (name.includes("TOGETHER")) return "TOGETHER";
  if (name.includes("GROW")) return "GROW";
  if (name.includes("LEAD PROGRAM")) return "GROW";
  if (name.includes("SLX")) return "GROW";
  if (name.includes("SALES LEADERSHIP")) return "GROW";
  if (name.includes("COHORT")) return "GROW";
  if (name.includes("B2C")) return "B2C";

  return "UNKNOWN";
}

// ── Status Normalization ─────────────────────────────────────────────

function normalizeStatus(status: string): string {
  if (!status) return "Scheduled";
  const statusMap: Record<string, string> = {
    "Scheduled": "Scheduled",
    "Completed": "Completed",
    "Canceled": "Cancelled",
    "Cancelled": "Cancelled",
    "canceled": "Cancelled",
    "cancelled": "Cancelled",
    "No Show": "Client No Show",
    "Client No Show": "Client No Show",
    "Coach No Show": "Coach No Show",
    "Late Cancel": "Late Cancel",
    "Rescheduled": "Rescheduled",
    "None": "Scheduled",
  };
  return statusMap[status] || status;
}

// ── Main Handler ─────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-SF-Webhook-Secret",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ── Auth ──────────────────────────────────────────────────────────
  const incomingSecret = req.headers.get("X-SF-Webhook-Secret") || "";
  if (WEBHOOK_SECRET && incomingSecret !== WEBHOOK_SECRET) {
    console.error("[AUTH] Invalid webhook secret");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let payload: SalesforcePayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  console.log(`[SYNC] Processing: ${payload.appointment_number} | ${payload.account_name} | ${payload.status}`);

  const result: SyncResult = {
    success: false,
    appointment_number: payload.appointment_number || "MISSING",
    action: "skipped",
    program_type: null,
    company_id: null,
    warnings: [],
  };

  try {
    // ── Validate ────────────────────────────────────────────────────
    if (!payload.appointment_number) {
      throw new Error("Missing appointment_number");
    }

    // ── Look Up Program Config ──────────────────────────────────────
    let programType: string | null = null;
    let companyId: string | null = null;
    let programTitle: string | null = null;

    // Try by salesforce_program_id first (SF record ID)
    if (payload.salesforce_program_id) {
      const { data: pc } = await supabase
        .from("program_config")
        .select("program_type, company_id, program_title, program_number")
        .eq("salesforce_program_id", payload.salesforce_program_id)
        .maybeSingle();

      if (pc) {
        programType = pc.program_type;
        companyId = pc.company_id;
        programTitle = pc.program_title;
        console.log(`[SYNC] Matched program_config by SF ID: type=${programType}`);
      }
    }

    // Try by program_number (CP-XXXX)
    if (!programType && payload.program_number) {
      const { data: pc } = await supabase
        .from("program_config")
        .select("program_type, company_id, program_title, salesforce_program_id")
        .eq("program_number", payload.program_number)
        .maybeSingle();

      if (pc) {
        programType = pc.program_type;
        companyId = pc.company_id;
        programTitle = pc.program_title;
        console.log(`[SYNC] Matched program_config by program_number: ${payload.program_number} -> ${programType}`);
      }
    }

    // Fallback: derive from program_name
    if (!programType && payload.program_name) {
      programType = deriveProductType(payload.program_name);
      result.warnings.push(`No program_config match. Derived from name: "${payload.program_name}" -> ${programType}`);
    }

    // Fallback: look up company_id by account_name
    if (!companyId && payload.account_name) {
      const { data: company } = await supabase
        .from("companies")
        .select("id")
        .or(`account_name.eq.${payload.account_name},name.eq.${payload.account_name}`)
        .maybeSingle();

      if (company) {
        companyId = company.id;
      } else {
        result.warnings.push(`No company found for: ${payload.account_name}`);
      }
    }

    result.program_type = programType;
    result.company_id = companyId;

    // ── Look Up Employee ID ─────────────────────────────────────────
    let employeeId: number | null = null;
    if (payload.client_email) {
      const { data: employee } = await supabase
        .from("employee_manager")
        .select("id")
        .ilike("company_email", payload.client_email)
        .maybeSingle();

      if (employee) {
        employeeId = employee.id;
      } else {
        result.warnings.push(`No employee_manager match for: ${payload.client_email}`);
      }
    }

    // ── Build Session Data ──────────────────────────────────────────
    const sessionData: Record<string, unknown> = {
      appointment_number: payload.appointment_number,
      status: normalizeStatus(payload.status),
      session_date: payload.scheduled_start,
      duration_minutes: payload.duration || payload.actual_duration,
      employee_name: payload.client_name,
      employee_id: employeeId,
      coach_name: payload.coach_name,
      account_name: payload.account_name,
      program_name: payload.program_name,
      program_title: programTitle || payload.program_name,
      program_type: programType,
      program_number: payload.program_number,
      salesforce_program_id: payload.salesforce_program_id,
      company_id: companyId,
      zoom_join_link: payload.zoom_join_link,
      cancel_session_link: payload.cancel_session_link,
      reschedule_session_link: payload.reschedule_session_link,
      leadership_management_skills: payload.leadership_management_skills,
      communication_skills: payload.communication_skills,
      mental_well_being: payload.mental_well_being,
      other_themes: payload.other_themes,
      summary: payload.description,
      goals: payload.goals,
      plan: payload.plan,
      employee_pre_session_note: payload.employee_pre_session_notes,
    };

    // Remove undefined values
    Object.keys(sessionData).forEach((key) => {
      if (sessionData[key] === undefined) delete sessionData[key];
    });

    // ── Upsert ──────────────────────────────────────────────────────
    // Check if record exists first
    const { data: existing } = await supabase
      .from("session_tracking")
      .select("id")
      .eq("appointment_number", payload.appointment_number)
      .maybeSingle();

    if (existing) {
      // Update existing record
      const { error: updateError } = await supabase
        .from("session_tracking")
        .update(sessionData)
        .eq("appointment_number", payload.appointment_number);

      if (updateError) throw updateError;
      result.action = "updated";
    } else {
      // Insert new record
      const { error: insertError } = await supabase
        .from("session_tracking")
        .insert(sessionData);

      if (insertError) throw insertError;
      result.action = "created";
    }

    // ── Update Employee Manager Booking Link ────────────────────────
    // Only update if client_booking_link is provided (the proper per-client
    // scheduling URL from the SF Contact record). Do NOT use
    // reschedule_session_link, which is a per-appointment URL that expires.
    if (payload.client_email && payload.client_booking_link) {
      const { error: emError } = await supabase
        .from("employee_manager")
        .update({ booking_link: payload.client_booking_link })
        .ilike("company_email", payload.client_email);

      if (emError) {
        result.warnings.push(`employee_manager booking_link update failed: ${emError.message}`);
      }
    }

    result.success = true;
    console.log(`[SYNC] ${result.action}: ${payload.appointment_number} | status=${sessionData.status} | type=${programType} | warnings=${result.warnings.length}`);

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    result.error = errorMsg;
    console.error(`[SYNC] Error: ${payload.appointment_number}: ${errorMsg}`);
  }

  return new Response(JSON.stringify(result), {
    status: result.success ? 200 : 422,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
});