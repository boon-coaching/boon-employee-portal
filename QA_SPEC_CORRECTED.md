# Boon Employee Portal -- QA Test Spec (Corrected)

> **Audit note:** This spec has been corrected based on a full audit of the codebase
> and database schema on 2026-02-12. All table names, column names, status values,
> and survey types have been verified against the actual implementation.

---

## Auth Note

Magic link auth won't work in headless browsers. The app has a **dev mode bypass**:
set `localStorage.setItem('boon_dev_email', '<email>')` and reload. The `AuthContext`
checks for `boon_dev_email` on mount and fetches the employee profile directly.

Each test user needs:
- An entry in `auth.users` with `raw_user_meta_data` containing `company_id`
  *(only needed for production auth; dev bypass skips this)*
- A corresponding record in `employee_manager` with matching `company_email`
- Related records in `session_tracking`, `welcome_survey_baseline` / `welcome_survey_scale`,
  `survey_submissions`, etc. matching their persona state

---

## Database Tables Reference (Corrected)

| Table | Purpose |
|---|---|
| `employee_manager` | Employee records. Key columns: `coach_id` (UUID FK to coaches), `company_email`, `program`, `status`, `auth_user_id`, `booking_link`, `company_id` |
| `coaches` | Coach profiles: `name`, `bio`, `photo_url`, `headline`, `notable_credentials`, `specialties` |
| `session_tracking` | All sessions. Key columns: `status` ('Completed', 'Upcoming', 'Scheduled', 'Cancelled', 'No Show'), `appointment_number` (string -- Salesforce ID, but used numerically in views), `goals`, `plan`, `summary`, `coach_name`, `employee_pre_session_note` |
| `welcome_survey_baseline` | GROW/EXEC welcome survey data. Contains `coaching_goals`, 12 `comp_*` score columns (1-5), 12 `focus_*` boolean columns, `match_summary` |
| `welcome_survey_scale` | SCALE welcome survey data. Contains `coaching_goals`, 18 `focus_*` boolean columns, wellbeing metrics (1-10), `match_summary` |
| `survey_submissions` | Native survey responses. `survey_type` CHECK: `'scale_feedback'`, `'scale_end'`, `'grow_baseline'`, `'grow_first_session'`, `'grow_midpoint'`, `'grow_end'`. Contains `coach_satisfaction` (1-10), `nps` (0-10), `wants_rematch`, `rematch_reason`, `coach_qualities` |
| `survey_competency_scores` | Individual competency scores from native surveys. `score_type`: `'pre'` or `'post'`, linked to `survey_submissions` |
| `core_competencies` | Reference table for the 12 core competencies |
| `programs` | ~~`program_config`~~ Program type ('SCALE'/'GROW'/'EXEC'), `sessions_per_employee`, `program_end_date` |
| `action_items` | Action items from sessions: `action_text`, `due_date`, `status` ('pending', 'completed', 'dismissed') |
| `coaching_wins` | Wins/breakthroughs: `win_text`, `source` ('check_in_survey', 'manual', 'coach_logged') |
| `checkpoints` | SCALE longitudinal tracking every 6 sessions: `competency_scores` (JSONB), `reflection_text`, `focus_area` |
| `reflection_responses` | End-of-program reflections for GROW/EXEC: 12 `comp_*` post-scores, `nps_score` |
| `session_prep` | Employee pre-session notes: `intention` |
| `session_feedback` | Simple post-session feedback: `rating` (1-5), `feedback` (text) |
| `employee_slack_connections` | Slack connections: `nudge_enabled`, `nudge_frequency` ('smart'/'daily'/'weekly'/'none'), `preferred_time`, `timezone` |
| `slack_installations` | Bot tokens per workspace |
| `slack_nudges` | Nudge audit log. `nudge_type`: `'action_reminder'`, `'goal_checkin'`, `'session_prep'`, `'weekly_digest'`, `'daily_digest'`, `'streak_celebration'` |
| `nudge_templates` | Block Kit message templates |

---

## Coaching State Machine

The app uses a deterministic state machine (`src/lib/coachingState.ts`):

```
NOT_SIGNED_UP          -- No program or no welcome survey
SIGNED_UP_NOT_MATCHED  -- Has program/survey but no coach (coach_id, booking_link, or sessions)
MATCHED_PRE_FIRST_SESSION -- Coach assigned, no completed sessions
ACTIVE_PROGRAM         -- Has completed sessions
PENDING_REFLECTION     -- All sessions done, no reflection (GROW/EXEC only)
COMPLETED_PROGRAM      -- Reflection submitted or status contains 'completed'/'graduated'
```

Session statuses that count toward totals: `'Completed'`, `'Late Cancel'`, `'Client No-Show'`

---

## Persona 3a: SCALE -- Matched with Coach, First Session Upcoming

**State:** SCALE user with coach assigned. First session is scheduled but has not occurred.

**Database conditions:**
- `employee_manager` record with `coach_id` populated (UUID FK to `coaches` table), `program` containing 'SCALE'
- `welcome_survey_scale` has a record for this user (completed onboarding)
- `session_tracking` has 1 record with `status = 'Upcoming'` and a future `session_date`
- `session_tracking.appointment_number = '1'` (string, used numerically by pending_surveys view)
- No records with `status = 'Completed'`
- No `survey_submissions` records
- `coaches` table has a record matching `employee_manager.coach_id`

**Expected coaching state:** `MATCHED_PRE_FIRST_SESSION`

**What to validate:**

**Home screen (PreFirstSessionHome component):**
- Header: "Hi {first_name}" with subtitle "Your coaching journey is about to begin"
- **Coach card** appears under "Meet Your Coach" heading with coach name, photo, headline, credentials
- First session card shows date and "Your First Session" label
- "What You Shared" section reflects welcome survey data:
  - Coaching goals displayed if present
  - SCALE focus areas (from `welcome_survey_scale.focus_*` booleans) shown as tags
- Pre-session note textarea present: "Anything specific (beyond your welcome survey)..."
- "Explore Your Toolkit" practice space CTA at bottom
- No errors, no "No data" messages

**Sessions tab (Sessions component, pre-first-session branch):**
- Heading: "My Sessions" with subtitle "Your coaching journey is just beginning."
- Upcoming first session card shows date, time, coach name
- Empty state section: "Session Notes & History" with message about notes appearing after first conversation
- No "No sessions found" or broken empty states

**Progress tab:**
- Intentional empty state acknowledging baseline

---

## Persona 3b: GROW -- Matched with Coach, First Session Upcoming

**State:** GROW user with coach assigned. First session is scheduled but has not occurred.

**Database conditions:**
- `employee_manager` record with `coach_id` populated, `program` containing 'GROW'
- `welcome_survey_baseline` has a record with 12 `comp_*` scores (1-5) and `focus_*` booleans
- `session_tracking` has 1 record with `status = 'Upcoming'` and a future `session_date`
- `session_tracking.appointment_number = '1'`
- No completed sessions
- No `survey_submissions` records
- `coaches` table has matching coach record

**Expected coaching state:** `MATCHED_PRE_FIRST_SESSION`

**What to validate:**

**Home screen (PreFirstSessionHome component):**
- Same structure as 3a, but with GROW-specific data
- "What You Shared" section shows:
  - Coaching goals from `welcome_survey_baseline.coaching_goals`
  - GROW focus areas (from `welcome_survey_baseline.focus_*` booleans) shown as tags (e.g., "Effective Communication", "Strategic Thinking")
- Coach card with full coach profile

**GrowDashboard (when routed as GROW):**
- Since this is pre-first-session, the `Dashboard` component routes to `PreFirstSessionHome`
  (same component for SCALE and GROW in pre-first-session state)
- The distinction is in the data: GROW focus areas are 12 leadership competencies vs SCALE's 18 focus areas

**Sessions tab:**
- Same pre-first-session state as 3a

**Progress tab:**
- Pre-assessment scores visible from `welcome_survey_baseline.comp_*` columns
- 12 competencies displayed (scale 1-5: Learning to Mastering)
- No post-scores yet

---

## Persona 4a: SCALE -- Completed First Session, No Upcoming Sessions

**State:** SCALE user whose first session is completed. No future sessions scheduled. Feedback survey should be pending.

**Database conditions:**
- `employee_manager` with `coach_id` populated, `program` containing 'SCALE'
- `welcome_survey_scale` has onboarding record
- `session_tracking` has 1 record with `status = 'Completed'`, `appointment_number = '1'`
- Session has `goals` and `plan` populated (from coach notes)
- No records with `status = 'Upcoming'`
- **No** `survey_submissions` with `session_id` matching this session (survey is pending)
- `coaches` table has matching coach record

**Expected coaching state:** `ACTIVE_PROGRAM` (has completed sessions)

**Pending survey:** The `pending_surveys` view should return a row for this user:
- SCALE milestone 1 triggers `survey_type = 'scale_feedback'`

**What to validate:**

**Survey trigger (SurveyModal):**
- On dashboard load, `fetchPendingSurvey` should return a pending survey
- `showSurveyModal` should be `true` in `App.tsx` state
- SurveyModal should render with `surveyType = 'scale_feedback'`
- Survey includes: experience rating, coach match rating, NPS
- If survey does NOT trigger, **flag as BUG**

**Home screen (ScaleHome component):**
- Header: "Hi {first_name}" with "Your personal coaching space"
- "Ready for your next session?" booking CTA (no upcoming session)
- "Where You Left Off" section showing:
  - Goals from session 1 (`session_tracking.goals`)
  - Plan items from session 1 (`session_tracking.plan`) as action items
- Coach profile card visible
- Session count visible

**Sessions tab:**
- Session 1 shows as completed with date and coach name
- Green checkmark icon, "Completed" status badge
- Expandable to show goals, plan, and summary
- "Give Feedback" button present in expanded view

**Progress tab:**
- Begins showing data (even if minimal after 1 session)

---

## Persona 4b: GROW -- Completed First Session, No Upcoming Sessions

**State:** GROW user whose first session is completed. No future sessions scheduled. Session 1 feedback survey should be pending.

**Database conditions:**
- `employee_manager` with `coach_id` populated, `program` containing 'GROW'
- `welcome_survey_baseline` has record with 12 `comp_*` pre-scores and `focus_*` booleans
- `session_tracking` has 1 record with `status = 'Completed'`, `appointment_number = '1'`
- Session has `goals` and `plan` populated
- No records with `status = 'Upcoming'`
- **No** `survey_submissions` matching this session
- `coaches` table has matching coach record

**Expected coaching state:** `ACTIVE_PROGRAM`

**Pending survey:** The `pending_surveys` view should return:
- GROW session 1 triggers `survey_type = 'grow_first_session'`

**What to validate:**

**Survey trigger (SurveyModal):**
- On dashboard load, `fetchPendingSurvey` should return a pending survey
- SurveyModal should render with `surveyType = 'grow_first_session'`
- Survey includes: experience rating, coach match rating, NPS
- If survey does NOT trigger, **flag as BUG**

**Home screen (GrowDashboard component):**
- Header: "Hi {first_name}" with "Your GROW coaching journey"
- **Program progress card:** "Session **1** of 12" with progress bar (~8%)
- "Book Your Next Session" hero CTA (no upcoming session)
- "Where We Left Off" section:
  - Current Goal from session 1 (`session_tracking.goals`)
  - Action Items from session 1 (from `action_items` table or `session_tracking.plan`)
- Coach card with photo, headline, session count ("1 session together")

**Sessions tab:**
- Session 1 shows as completed with date and coach name
- Expandable with goals, plan, summary
- "Give Feedback" button present

**Progress tab:**
- Pre-assessment scores visible (from `welcome_survey_baseline.comp_*` columns)
- 12 competencies displayed with scale 1-5
- "Session 1 of 12" or equivalent progress indicator
- No post-scores yet

---

## Survey Cadence Quick Reference

### SCALE Milestones

| Session # | Triggers? | `survey_type` |
|---|---|---|
| 1 | YES | `'scale_feedback'` |
| 2 | NO | -- |
| 3 | YES | `'scale_feedback'` |
| 4-5 | NO | -- |
| 6 | YES | `'scale_feedback'` |
| 7-11 | NO | -- |
| 12 | YES | `'scale_feedback'` |
| 13-17 | NO | -- |
| 18 | YES | `'scale_feedback'` |
| 24, 30, 36 | YES | `'scale_feedback'` |
| End of program | YES | `'scale_end'` |

### GROW Milestones

| Session # | Triggers? | `survey_type` |
|---|---|---|
| 1 | YES | `'grow_first_session'` |
| 2-5 | NO | -- |
| 6 (midpoint) | YES | `'grow_midpoint'` |
| 7-11 | NO | -- |
| 12 (final) | YES | `'grow_end'` |

### EXEC Milestones
Same as GROW (sessions 1, 6, end).

---

## Key Corrections from Audit

| # | Original Spec | Corrected |
|---|---|---|
| 1 | `program_config` table | `programs` table |
| 2 | `employee_manager.coach_name` | `employee_manager.coach_id` (UUID FK to `coaches`) |
| 3 | `employee_manager.status = 'Pending'` | Not used; state determined by absence of welcome survey + no coach |
| 4 | `program_config.onboarding_data` / `slack_enabled` | Does not exist; Slack via `employee_slack_connections` + `slack_installations` |
| 5 | `program_config.selected_competencies` | `welcome_survey_baseline.focus_*` booleans or `survey_submissions.focus_areas` |
| 6 | `survey_type = 'welcome_survey_scale'` | Not a survey_type; `welcome_survey_scale` is a separate table |
| 7 | `survey_type = 'welcome_survey_baseline'` | Not a survey_type; `welcome_survey_baseline` is a separate table |
| 8 | `competency_scores` with `score_type = 'pre'` | Pre-scores are `comp_*` columns on `welcome_survey_baseline`, not rows |
| 9 | `session_tracking.action_plan` | `session_tracking.plan` |
| 10 | `appointment_number = 1` (integer) | String field (Salesforce ID); seed as `'1'` for test compatibility |
| 11 | `GROW_END` (uppercase) | `'grow_end'` (lowercase) |
| 12 | `survey_reminder` nudge type | Does not exist; not among the 6 implemented nudge types |
| 13 | `sessions_per_employee = null` for SCALE | Default is 36 (not null/unlimited) |
| 14 | `feedback_text` column | Code uses `feedback_suggestions` |
| 15 | Session status `'Upcoming'` only | `'Scheduled'` is also valid; code checks for both |
