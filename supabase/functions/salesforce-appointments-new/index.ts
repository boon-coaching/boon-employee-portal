// salesforce-appointments-new
//
// Receives coaching appointment data from Salesforce via Apex HTTP callout.
// 1. Validates required fields
// 2. Looks up program_config for program_type + company_id
// 3. Looks up employee_id (case-insensitive email match)
// 4. Looks up coach_id via salesforce_contact_id (deterministic) or coach_name fallback
// 5. Upserts to session_tracking (keyed on appointment_number)
// 6. Stores salesforce_contact_id on employee_manager for deterministic joins
//
// v4 Changes (2026-04-22):
// - NEW: Accepts coach_sf_contact_id (SA.Coach__r.Id) and resolves coach_id via coaches.salesforce_contact_id.
//        Eliminates the 15% null-coach_id rate caused by first-name-only coach_name strings from legacy Apex.
//        Name fallback retained for payloads that don't yet carry the Contact Id.
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
  coach_sf_contact_id?: string;  // SA.Coach__r.Id — deterministic join key

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

  // Obstacles (coach-reported blockers for the session)
  obstacles?: string;
  obstacles_free_text?: string;

  // Loop prevention — origin of this callout.
  //   'sf_direct'  = real SF-side user edit (default when Apex can't tell)
  //   'sf_callout' = echo from our portal PATCH (Apex would need to stamp this)
  // If absent, we fall back to timestamp-only guard.
  last_modified_source?: string;

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
  coach_id: string | null;
  coach_resolution: "sf_contact_id" | "name_match" | "unresolved" | null;
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
    coach_id: null,
    coach_resolution: null,
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

    // -- Look Up Coach ID --
    // Strategy 1 (deterministic): resolve via salesforce_contact_id (SA.Coach__r.Id).
    // Strategy 2 (fallback): exact case-insensitive coach_name match against coaches.name.
    // If neither hits we leave coach_id null and log a warning — do NOT guess by first name.
    let coachId: string | null = null;

    if (payload.coach_sf_contact_id) {
      const { data: coach } = await supabase
        .from("coaches")
        .select("id")
        .eq("salesforce_contact_id", payload.coach_sf_contact_id)
        .maybeSingle();

      if (coach) {
        coachId = coach.id;
        result.coach_resolution = "sf_contact_id";
      }
    }

    if (!coachId && payload.coach_name) {
      const { data: matches } = await supabase
        .from("coaches")
        .select("id")
        .ilike("name", payload.coach_name);

      if (matches && matches.length === 1) {
        coachId = matches[0].id;
        result.coach_resolution = "name_match";
      } else if (matches && matches.length > 1) {
        result.warnings.push(
          `Ambiguous coach_name "${payload.coach_name}" matched ${matches.length} coaches; coach_id left null`
        );
      }
    }

    if (!coachId) {
      result.coach_resolution = "unresolved";
      result.warnings.push(
        `coach_id unresolved for coach_name="${payload.coach_name || "none"}" sf_contact_id="${payload.coach_sf_contact_id || "none"}"`
      );
    }

    result.coach_id = coachId;

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
      coach_id: coachId,
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
      obstacles: payload.obstacles,
      obstacles_free_text: payload.obstacles_free_text,
    };

    // Remove undefined values
    Object.keys(sessionData).forEach((key) => {
      if (sessionData[key] === undefined) delete sessionData[key];
    });

    // Check if record exists, then update or insert
    const { data: existing } = await supabase
      .from("session_tracking")
      .select("id, last_modified_source, last_modified_at")
      .eq("appointment_number", payload.appointment_number)
      .maybeSingle();

    // Loop-prevention: if the portal just wrote this row, skip the echo that
    // SF Apex fires in response to our PATCH. This guards against a 10-30s
    // window where stale SF data could overwrite fresh portal data.
    //
    // Two-tier check:
    //   1. If the Apex payload explicitly tags itself 'sf_callout', skip when
    //      current row is a recent 'portal' write.
    //   2. Fallback (Apex hasn't been updated yet): pure timestamp guard —
    //      if current row is a recent 'portal' write, skip regardless of
    //      origin. Real SF-side edits within 30s of a portal write will be
    //      dropped; acceptable during pilot where such edits are expected to
    //      be rare.
    const ECHO_WINDOW_MS = 30_000;
    if (existing?.last_modified_source === "portal" && existing.last_modified_at) {
      const ageMs = Date.now() - new Date(existing.last_modified_at).getTime();
      const isEcho = payload.last_modified_source === "sf_callout";
      const withinWindow = ageMs < ECHO_WINDOW_MS;
      if (withinWindow && (isEcho || !payload.last_modified_source)) {
        result.action = "skipped";
        result.warnings.push(
          `echo-skip: portal write ${ageMs}ms ago, incoming source=${payload.last_modified_source || "unknown"}`,
        );
        result.success = true;
        console.log(
          `[SYNC] Echo-skip: ${payload.appointment_number} ageMs=${ageMs} incoming=${payload.last_modified_source || "unknown"}`,
        );
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // Stamp this write as coming from the SF callout path so subsequent portal
    // writes can detect who wrote last.
    sessionData.last_modified_source = payload.last_modified_source === "sf_direct"
      ? "sf_direct"
      : "sf_callout";
    sessionData.last_modified_at = new Date().toISOString();

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
      `[SYNC] Success: ${result.action} | ${payload.appointment_number} | type=${programType} | employee_id=${employeeId} | sf_contact=${payload.salesforce_contact_id || "none"} | coach_id=${coachId || "null"}(${result.coach_resolution}) | warnings=${result.warnings.length}`
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
