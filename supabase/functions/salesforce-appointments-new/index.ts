// salesforce-appointments-new
//
// Receives coaching appointment data from Salesforce via Apex HTTP callout.
// 1. Validates required fields
// 2. Looks up program_config for program_type + company_id
// 3. Looks up employee_id (case-insensitive email match)
// 4. Upserts to session_tracking (keyed on appointment_number)
// 5. Stores salesforce_contact_id on employee_manager for deterministic joins
//
// v3 Changes:
// - FIX: .eq() -> .ilike() for email matching (case-insensitive)
// - FIX: Removed booking_link overwrite with reschedule_session_link
// - NEW: Accepts and stores salesforce_contact_id on session_tracking + employee_manager

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("SF_WEBHOOK_SECRET") || "";

// -- Types --

interface SalesforcePayload {
  // Appointment fields
  appointment_number: string;
  status: string;
  scheduled_start: string;
  scheduled_end?: string;
  duration?: number;
  actual_start?: string;
  actual_end?: string;
  actual_duration?: number;
  description?: string;
  subject?: string;

  // Client/Employee fields
  client_name?: string;
  client_email?: string;
  client_first_name?: string;
  client_last_name?: string;
  salesforce_contact_id?: string;  // NEW: SF Contact record ID

  // Coach fields
  coach_name?: string;

  // Program fields
  program_name?: string;
  program_number?: string;
  salesforce_program_id?: string;

  // Account
  account_name?: string;

  // Session content
  zoom_join_link?: string;
  cancel_session_link?: string;
  reschedule_session_link?: string;
  goals?: string;
  plan?: string;
  notes?: string;
  employee_pre_session_notes?: string;

  // Skills/themes
  leadership_management_skills?: string;
  communication_skills?: string;
  mental_well_being?: string;
  other_themes?: string;

  // Session type
  session_type?: string;
  billable?: boolean;
}

interface SyncResult {
  success: boolean;
  appointment_number: string;
  action: "created" | "updated" | "skipped";
  program_type: string | null;
  company_id: string | null;
  employee_id: number | null;
  warnings: string[];
  error?: string;
}

// -- Program Type Derivation (fallback) --

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

// -- Status Normalization --

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

// -- Main Handler --

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers":
          "Content-Type, Authorization, X-SF-Webhook-Secret",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  // -- Auth --
  const authHeader = req.headers.get("Authorization") || "";
  const incomingSecret =
    req.headers.get("X-SF-Webhook-Secret") ||
    authHeader.replace("Bearer ", "");

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

  const result: SyncResult = {
    success: false,
    appointment_number: payload.appointment_number || "UNKNOWN",
    action: "skipped",
    program_type: null,
    company_id: null,
    employee_id: null,
    warnings: [],
  };

  try {
    console.log(
      `[SYNC] Processing: ${payload.appointment_number} | status=${payload.status} | client=${payload.client_email || "no-email"} | sf_contact=${payload.salesforce_contact_id || "none"}`
    );

    // Validate required fields
    if (!payload.appointment_number) {
      throw new Error("Missing required field: appointment_number");
    }

    // -- Look Up Program Config --
    let programType: string | null = null;
    let companyId: string | null = null;
    let programTitle: string | null = null;

    // Try by salesforce_program_id first
    if (payload.salesforce_program_id) {
      const { data: pc } = await supabase
        .from("program_config")
        .select(
          "program_type, company_id, program_title, program_number"
        )
        .eq("salesforce_program_id", payload.salesforce_program_id)
        .maybeSingle();

      if (pc) {
        programType = pc.program_type;
        companyId = pc.company_id;
        programTitle = pc.program_title;
        console.log(
          `[SYNC] Matched program_config by SF ID: type=${programType}, company_id=${companyId}`
        );
      }
    }

    // Try by program_number (CP-XXXX)
    if (!programType && payload.program_number) {
      const { data: pc } = await supabase
        .from("program_config")
        .select(
          "program_type, company_id, program_title, salesforce_program_id"
        )
        .eq("program_number", payload.program_number)
        .maybeSingle();

      if (pc) {
        programType = pc.program_type;
        companyId = pc.company_id;
        programTitle = pc.program_title;
        console.log(
          `[SYNC] Matched program_config by program_number: ${payload.program_number} -> ${programType}`
        );
      }
    }

    // Fallback: derive from program_name
    if (!programType && payload.program_name) {
      programType = deriveProductType(payload.program_name);
      result.warnings.push(
        `No program_config match. Derived from name: "${payload.program_name}" -> ${programType}`
      );
    }

    // Fallback: look up company_id by account_name
    if (!companyId && payload.account_name) {
      const { data: company } = await supabase
        .from("companies")
        .select("id")
        .or(
          `account_name.eq.${payload.account_name},name.eq.${payload.account_name}`
        )
        .maybeSingle();

      if (company) {
        companyId = company.id;
      } else {
        result.warnings.push(
          `No company found for: ${payload.account_name}`
        );
      }
    }

    result.program_type = programType;
    result.company_id = companyId;

    // -- Look Up Employee ID --
    // Try salesforce_contact_id first (deterministic), then email (case-insensitive)
    let employeeId: number | null = null;

    // Strategy 1: Match by salesforce_contact_id (deterministic, no case issues)
    if (!employeeId && payload.salesforce_contact_id) {
      const { data: employee } = await supabase
        .from("employee_manager")
        .select("id")
        .eq("salesforce_contact_id", payload.salesforce_contact_id)
        .maybeSingle();

      if (employee) {
        employeeId = employee.id;
        console.log(
          `[SYNC] Matched employee by salesforce_contact_id: ${employeeId}`
        );
      }
    }

    // Strategy 2: Match by email (case-insensitive)
    if (!employeeId && payload.client_email) {
      const { data: employee } = await supabase
        .from("employee_manager")
        .select("id")
        .ilike("company_email", payload.client_email)
        .maybeSingle();

      if (employee) {
        employeeId = employee.id;
        console.log(
          `[SYNC] Matched employee by email (ilike): ${employeeId}`
        );
      } else {
        result.warnings.push(
          `No employee found for email: ${payload.client_email}`
        );
      }
    }

    result.employee_id = employeeId;

    // -- Build employee_name from parts or whole --
    const employeeName =
      payload.client_name ||
      [payload.client_first_name, payload.client_last_name]
        .filter(Boolean)
        .join(" ") ||
      null;

    // -- Upsert Session Tracking --
    const sessionData: Record<string, unknown> = {
      appointment_number: payload.appointment_number,
      employee_name: employeeName,
      employee_id: employeeId,
      company_id: companyId,
      account_name: payload.account_name,
      program_name: payload.program_name,
      program_title: programTitle || payload.program_name,
      program_number: payload.program_number,
      program_type: programType,
      salesforce_program_id: payload.salesforce_program_id,
      salesforce_contact_id: payload.salesforce_contact_id,
      coach_name: payload.coach_name,
      session_date: payload.scheduled_start,
      status: normalizeStatus(payload.status),
      duration_minutes:
        payload.duration || payload.actual_duration || null,
      zoom_join_link: payload.zoom_join_link,
      cancel_session_link: payload.cancel_session_link,
      reschedule_session_link: payload.reschedule_session_link,
      leadership_management_skills:
        payload.leadership_management_skills,
      communication_skills: payload.communication_skills,
      mental_well_being: payload.mental_well_being,
      other_themes: payload.other_themes,
      goals: payload.goals,
      plan: payload.plan,
      notes: payload.notes,
      employee_pre_session_note: payload.employee_pre_session_notes,
    };

    // Remove undefined values
    Object.keys(sessionData).forEach((key) => {
      if (sessionData[key] === undefined) delete sessionData[key];
    });

    // Check if record exists, then update or insert
    const { data: existing } = await supabase
      .from("session_tracking")
      .select("id")
      .eq("appointment_number", payload.appointment_number)
      .maybeSingle();

    if (existing) {
      const { error: updateError } = await supabase
        .from("session_tracking")
        .update(sessionData)
        .eq("appointment_number", payload.appointment_number);

      if (updateError) throw updateError;
      result.action = "updated";
    } else {
      const { error: insertError } = await supabase
        .from("session_tracking")
        .insert(sessionData);

      if (insertError) throw insertError;
      result.action = "created";
    }

    // -- Update Employee Manager (salesforce_contact_id backfill) --
    // Only set salesforce_contact_id if we matched an employee and
    // they don't already have one. Builds up the deterministic
    // join key over time as sessions sync.
    if (employeeId && payload.salesforce_contact_id) {
      const { error: emError } = await supabase
        .from("employee_manager")
        .update({
          salesforce_contact_id: payload.salesforce_contact_id,
        })
        .eq("id", employeeId)
        .is("salesforce_contact_id", null);

      if (emError) {
        result.warnings.push(
          `employee_manager sf_contact_id update failed: ${emError.message}`
        );
      }
    }

    result.success = true;
    console.log(
      `[SYNC] Success: ${result.action} | ${payload.appointment_number} | type=${programType} | employee_id=${employeeId} | sf_contact=${payload.salesforce_contact_id || "none"} | warnings=${result.warnings.length}`
    );
  } catch (err) {
    const errorMsg =
      err instanceof Error ? err.message : "Unknown error";
    result.error = errorMsg;
    console.error(
      `[SYNC] Error for ${payload.appointment_number}: ${errorMsg}`
    );
  }

  return new Response(JSON.stringify(result), {
    status: result.success ? 200 : 500,
    headers: { "Content-Type": "application/json" },
  });
});
