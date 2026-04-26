# Boon Employee Portal: State & UX Audit

> Generated 2026-02-22. Covers every user state and the corresponding UI/UX behavior across all product lines.

---

## Summary Matrix

| State | SCALE | GROW | EXEC | Component | Nav Available |
|-------|-------|------|------|-----------|---------------|
| **No Supabase Auth session** | Login page | Login page | Login page | `LoginPage` | None |
| **Auth session, no employee record** | "Account not found" | "Account not found" | "Account not found" | `NoEmployeeFound` | None |
| **NOT_SIGNED_UP** | Welcome survey CTA | Welcome survey CTA | Welcome survey CTA | `WelcomePage` | None (no Layout) |
| **SIGNED_UP_NOT_MATCHED** | Matching banner + goals + focus areas (18 SCALE areas) | Matching banner + goals + focus areas (12 GROW areas) | Matching banner + goals + focus areas | `MatchingHome` | Home, Sessions (empty), Progress (empty), Practice |
| **MATCHED_PRE_FIRST_SESSION** (no upcoming) | Book CTA + coach card + focus areas | Book CTA + coach card + focus areas | Book CTA + coach card + focus areas | `PreFirstSessionHome` | Home, Sessions, Progress, Practice |
| **MATCHED_PRE_FIRST_SESSION** (upcoming) | Session date card + join link + coach card | Session date card + join link + coach card | Session date card + join link + coach card | `PreFirstSessionHome` | Home, Sessions, Progress, Practice |
| **ACTIVE_PROGRAM** (upcoming session) | SessionPrep + checkpoint prompt (if due) + coach card | SessionPrep + progress bar + coach card | SessionPrep + coach summary + action items | `ScaleHome` / `GrowDashboard` / `ActiveGrowHome` | Home, Sessions, Progress, Practice |
| **ACTIVE_PROGRAM** (no upcoming) | Book CTA + "Where You Left Off" + practice CTA | Book CTA + action items + progress stats | Book CTA + goals + action items | `ScaleHome` / `GrowDashboard` / `ActiveGrowHome` | Home, Sessions, Progress, Practice |
| **ACTIVE_PROGRAM** (checkpoint due, SCALE only) | Purple checkpoint prompt banner | N/A | N/A | `ScaleHome` | Home, Sessions, Progress, Practice |
| **PENDING_REFLECTION** (GROW/EXEC only) | N/A | Reflection CTA + program summary + preview | Reflection CTA + program summary + preview | `PendingReflectionHome` | Home, Sessions, Progress, Practice |
| **COMPLETED_PROGRAM** | N/A (SCALE is ongoing) | Alumni dashboard + completion modal + growth story | Alumni dashboard + completion modal + growth story | `Dashboard` (completed branch) | Home, Archive, Profile, Practice |
| **Survey pending** (any active state) | Native survey modal overlays current view | Native survey modal overlays current view | Native survey modal overlays current view | `SurveyModal` | Blocked by modal |

---

## Architecture Overview

### State Machine
**File:** `src/lib/coachingState.ts`

Single source of truth: `getCoachingState()` (line 207) returns a `CoachingStateData` object consumed by every component.

```
NOT_SIGNED_UP
    |
SIGNED_UP_NOT_MATCHED
    |
MATCHED_PRE_FIRST_SESSION
    |
ACTIVE_PROGRAM -----> (SCALE: ongoing, checkpoint loop)
    |
    |---> PENDING_REFLECTION (GROW/EXEC: all 12 sessions done, no reflection)
    |
COMPLETED_PROGRAM (GROW/EXEC: reflection submitted or status='Completed')
```

### Routing Flow
**File:** `src/App.tsx`

```
/login           --> LoginPage (public)
/auth/callback   --> AuthCallback (public)
/welcome-complete --> WelcomeCompletePage (public)
/help/privacy    --> HelpPrivacyPage (public)
/feedback        --> FeedbackPage (auth required)
/                --> ProtectedApp (auth required)
                     |
                     |--> loading? --> Spinner
                     |--> !employee? --> NoEmployeeFound
                     |--> dataLoading? --> "Getting your dashboard ready..."
                     |--> NOT_SIGNED_UP? --> WelcomePage (no Layout)
                     |--> SIGNED_UP_NOT_MATCHED? --> Layout + MatchingHome
                     |--> all other states --> Layout + view-based routing
```

### Program Type Detection
**File:** `src/App.tsx` lines 116-163

4-level fallback chain:
1. `fetchProgramType(employee.program)` - database lookup
2. Session `program_name` pattern matching (SCALE/SLX/GROW/EXEC)
3. `welcomeSurveyScale` presence implies SCALE
4. `baseline.program_type` field, or baseline without welcomeSurveyScale defaults to GROW

**File:** `src/lib/coachingState.ts` lines 136-155 (`extractProgramType`)
- Pattern matches on uppercase: GROW, EXEC, SCALE, SLX
- SLX maps to SCALE

---

## State-by-State Audit

---

### 0. PRE-AUTH STATES

#### 0a. No Auth Session
**How determined:** `AuthGuard` (App.tsx:654-677) checks `useAuth().session`. If null, redirects to `/login`.

**What user sees:** `LoginPage` (`src/pages/LoginPage.tsx`)
- Boon logo
- Email input field
- "Send Magic Link" button (passwordless auth via Supabase OTP)
- Dev mode: `?dev=true` URL param enables direct email login without magic link

**Actions:** Enter email, receive magic link, click to authenticate

**Edge cases:**
- Dev mode bypass stores email in `boon_dev_email` localStorage
- Preview mode (`VITE_PREVIEW_MODE`) allows `?email=` param to auto-login via RPC
- If employee doesn't exist in `employee_manager`, login still succeeds (auth is separate from employee lookup)

#### 0b. Auth Session, No Employee Record
**How determined:** `AuthContext.fetchEmployeeProfile()` (AuthContext.tsx:75-108) queries `employee_manager` table. If no row matches `company_email`, `employee` is set to `null`.

**File:** `src/pages/NoEmployeeFound.tsx`

**What user sees:**
- Orange warning icon
- "Account not found" heading
- Shows the email they authenticated with
- Explains possible causes: wrong email, not enrolled yet, typo in system
- "Try a different email" button (signs out)
- Support contact link

**Actions:** Sign out and try different email, or contact support

**Edge cases:**
- Case-insensitive matching via `ilike` - should catch most email casing issues
- No retry mechanism without signing out
- If employee record is created AFTER login, user must refresh to pick it up (no polling)

---

### 1. NOT_SIGNED_UP

**How determined:** `coachingState.ts` lines 268-274
```typescript
if (!employee) state = 'NOT_SIGNED_UP'
if (!hasProgram && !hasCompletedOnboarding && !hasCompletedSessions) state = 'NOT_SIGNED_UP'
```
Requires: employee record exists BUT no `program` field, no welcome survey (baseline or scale), AND no session history.

**File:** `src/pages/WelcomePage.tsx`

**What user sees:**
- Boon logo header (minimal, no sidebar/nav)
- Welcome card with smiley icon
- "Welcome, {firstName}!" heading
- Benefits list (matched coach, personalized sessions, growth tools)
- **"Start Welcome Survey"** button (links to external Typeform)
- "Takes about 5 minutes" note
- Sign out link at bottom

**Actions:** Click to start Typeform survey (opens new tab), sign out

**What's hidden:** Entire Layout component. No sidebar, no navigation, no bottom nav. This is a standalone page.

**Edge cases:**
- `welcomeSurveyUrl` is hardcoded as `https://boon.typeform.com/welcome` with a TODO comment (App.tsx:34)
- Legacy clients with sessions but no `program` field will NOT be stuck here because `hasCompletedSessions` overrides (line 273)
- If employee has `program` field but no survey data, they skip to next state (SIGNED_UP_NOT_MATCHED)

**Products:** Identical across SCALE/GROW/EXEC. Survey URL does not differentiate.

---

### 2. SIGNED_UP_NOT_MATCHED

**How determined:** `coachingState.ts` lines 280-281
```typescript
if (!hasCoach) state = 'SIGNED_UP_NOT_MATCHED'
```
`hasCoach` is false when: no `coach_id`, no `booking_link`, and no sessions exist.

**File:** `src/components/MatchingHome.tsx`

**What user sees:**
- Full Layout with sidebar/mobile nav
- "Hi {firstName}" header with "Your coaching journey is starting"
- **Matching Status Banner** (prominent, centered):
  - Pulsing person icon with ping animation
  - "Matching in progress" badge with animated dot
  - "Finding the right coach for you"
  - Timeline: preferences recorded (green check), reviewing coaches (pulsing blue), notification pending (gray)
  - "Most people are matched within 24 hours"
- **Your Goals section** (if survey data exists):
  - Coaching goals quoted from welcome survey
  - Focus areas as pill/chip tags
  - "Your coach will use this to personalize your first conversation"
- **About Your Program section:**
  - Company name + program display name
  - SCALE: "Ongoing coaching sessions"
  - GROW: "12 structured sessions"
  - EXEC: "Executive coaching sessions"
- **What to Expect** (3-step numbered list)
- **Explore While You Wait** - Practice Space CTA (purple button)
- Support email link

**Actions:** Navigate to Practice, Sessions (empty), Progress (empty), Settings. Explore Practice Space.

**What's hidden:** Coach-related content, session booking, session prep.

**SCALE-specific:** Shows 18 focus areas from `welcome_survey_scale` boolean fields, uses `SCALE_FOCUS_AREA_LABELS` mapping.

**GROW-specific:** Shows 12 focus areas from `welcome_survey_baseline` boolean fields (`focus_*` fields).

**EXEC-specific:** Same as GROW (uses baseline survey).

**Edge cases:**
- `isValidCoachingGoals()` filters out junk responses: "no", "n/a", "none", "idk", etc. (lines 33-39)
- If no survey data exists (`!hasWelcomeSurvey`), goals section is hidden entirely
- User can navigate to Sessions (shows empty state) and Progress (shows empty state)

---

### 3. MATCHED_PRE_FIRST_SESSION

**How determined:** `coachingState.ts` lines 282-283
```typescript
if (!hasCompletedSessions) state = 'MATCHED_PRE_FIRST_SESSION'
```
Has coach (via `coach_id`, `booking_link`, or sessions exist) but zero completed/counted sessions.

**File:** `src/components/PreFirstSessionHome.tsx`

**What user sees:**

#### Sub-state 3a: Has upcoming session scheduled
- "Hi {firstName}" + "Your coaching journey is about to begin"
- **First Session Card** (prominent blue gradient):
  - Full date (e.g., "Thursday, March 6, 2026")
  - Time + coach name
  - **Join Session button** (green, appears 30 min before to 60 min after session)
  - **Join Link** (blue, appears within 24 hours of session)
- **Meet Your Coach** section:
  - Coach photo (from `coaches` table, falls back to picsum.photos placeholder)
  - Coach name, headline, notable credentials
  - Match summary (extracted from `match_summary` field, personalized, or coach bio fallback)
  - Loading skeleton while coach data loads
- **What You Shared** section (from welcome survey):
  - Coaching goals quoted
  - Focus area pills
  - "{CoachFirstName} will use this to personalize your first conversation"
- **Pre-Session Note** textarea:
  - Auto-saves to `session_tracking.employee_pre_session_note` via RPC
  - Falls back to localStorage if DB write fails
  - Shows saving/saved/error indicators
  - "{CoachFirstName} will see this before your session"
- **Explore Your Toolkit** - Practice Space CTA
- Support link

#### Sub-state 3b: No upcoming session (coach assigned but nothing booked)
- Same header
- **Book Your First Session** card instead of date card:
  - "Ready to meet {coachFirstName}?"
  - "Book Your Session" button linking to `employee.booking_link`
- All other sections same as 3a

**Actions:**
- Join session (if within time window)
- Book first session (if no upcoming)
- Write pre-session note
- Navigate to Practice Space
- Navigate via sidebar to Sessions, Progress, etc.

**What's hidden:** Session history, action items, checkpoint prompts, coaching wins

**Edge cases:**
- If no `booking_link` AND no upcoming session: neither booking CTA nor session card shown. User sees coach info + survey recap only. **This is a dead end** - user has no way to book.
- Coach lookup tries: `fetchCoachByName()` from session, then `fetchCoachById()` from employee.coach_id
- Match summary extraction uses regex to find the specific coach's paragraph in a multi-coach summary string
- `createPersonalizedDescription()` generates a fallback: "Based on your goal to [goals], {coach} will partner with you..."

**SCALE vs GROW vs EXEC:** Same component. Only difference is which focus areas are shown (18 SCALE vs 12 GROW).

---

### 4. ACTIVE_PROGRAM

**How determined:** `coachingState.ts` line 285-286 (default/else case)
Has coach AND has completed sessions AND not all sessions done AND not fully completed.

**Dashboard routing:** `src/components/Dashboard.tsx` lines 44-128 routes to different home components:

```typescript
if (isPreFirst) return <PreFirstSessionHome />     // State 3 (handled above)
if (isPendingReflection) return <PendingReflectionHome /> // State 5
if (isScale && !isCompleted) return <ScaleHome />   // 4a
if (isGrowOrExec && programType === 'GROW') return <GrowDashboard /> // 4b
if (!isCompleted) return <ActiveGrowHome />          // 4c (EXEC + unknown)
// else: completed dashboard (State 6)
```

---

#### 4a. ACTIVE_PROGRAM - SCALE
**File:** `src/components/ScaleHome.tsx`

**Sub-states within SCALE active:**

##### With upcoming session:
- "Hi {firstName}" header
- **SessionPrep** component (session prep guide with action items, coach name)
- Checkpoint prompt (if due, see below)
- Practice Space CTA
- Coach card

##### Without upcoming session:
- **Book next session CTA** (if `booking_link` exists)
- **Checkpoint prompt** (if due):
  - Purple gradient card
  - "Time for your first check-in" or "{N} sessions in. See what's shifted."
  - "Start Check-In" button launches `CheckpointFlow` modal
  - Dismiss button (remind me later)
- **Current Focus** (from latest checkpoint's `focus_area`) OR **Where You Left Off** (goals/plan from most recent session with content):
  - Goals displayed
  - Action items from plan with checkboxes (matched against `action_items` table)
  - Toggle completion status
- Practice Space CTA
- Coach Profile card

**Checkpoint schedule:** `[1, 3, 6, 12, 18, 24, 30, 36, 42, 48]` sessions, then every 6.
**Checkpoint flow:** `CheckpointFlow.tsx` (44KB) - multi-step modal with competency self-assessment, wellbeing metrics, focus area selection, reflection text, NPS.

**What's hidden:** Program progress percentage (SCALE is ongoing, `programProgress = 0`), reflection flow, completion state.

**Edge cases:**
- No `booking_link` AND no upcoming session: only "Where You Left Off" + Practice shown. No way to book. (same dead-end as state 3b)
- `checkpointStatus.isCheckpointDue` is false until counted sessions >= next milestone
- Session counting includes Late Cancel and Client No-Show (via `COUNTED_SESSION_STATUSES`)

---

#### 4b. ACTIVE_PROGRAM - GROW
**File:** `src/components/GrowDashboard.tsx`

**What user sees:**
- "Hi {firstName}" header
- **SessionPrep** (if upcoming session) OR **Book next session CTA** (if no upcoming + has booking link)
- **Program Progress Card** (`ProgramProgressCard.tsx`):
  - "{completed} of 12 Sessions" with progress bar
  - Percentage display
- **Competency Progress Card** (`CompetencyProgressCard.tsx`):
  - Shows focus areas from baseline survey
  - Current scores vs baseline if available
- **Coaching at a Glance** grid:
  - Coach photo + name
  - Progress (X of 12)
  - Next session date
  - Last session date
- **Your Coach** compact card (if upcoming session)
- **From Your Coach** (last session summary, if exists)
- **Things You're Working On** (pending action items):
  - Action text
  - Add/edit notes per action item
  - Notes auto-save
- **Practice Space CTA**

**Key differences from SCALE:**
- Fixed program structure (12 sessions)
- Progress bar and percentage
- Competency tracking from baseline
- No checkpoint system

---

#### 4c. ACTIVE_PROGRAM - EXEC (and unknown program types)
**File:** `src/components/ActiveGrowHome.tsx` (37KB)

Catches EXEC, unknown program types, and legacy clients with sessions but no program field.

**What user sees:** Very similar to GrowDashboard but with some differences:
- Session prep or book CTA
- Coach profile with match summary
- Action items
- Practice Space
- "Coaching at a Glance" summary stats

**Edge case:** This is the fallback for any program type that doesn't match SCALE or GROW specifically.

---

### 5. PENDING_REFLECTION (GROW/EXEC only)

**How determined:** `coachingState.ts` lines 277-279
```typescript
if (allSessionsDone && !hasReflection) state = 'PENDING_REFLECTION'
```
All 12 sessions completed (counted sessions >= expected AND no upcoming), but no reflection submitted AND no end-of-program competency scores.

**File:** `src/components/PendingReflectionHome.tsx`

**What user sees:**
- "Hi {firstName}" + "Your GROW program is complete" (hardcoded as "GROW")
- **Reflection CTA** (primary, prominent blue gradient):
  - "One Last Step" badge
  - "Complete your final reflection to unlock your full Leadership Profile"
  - "You'll see how you've grown across 12 competencies, baseline to now."
  - **"Complete Reflection"** button + "~3 min" estimate
- **Program Summary** grid:
  - Coach photo + name
  - Program: "GROW"
  - Total sessions count
  - Duration (month range)
- **Preview of What's Coming** (what reflection unlocks):
  - Growth across 12 leadership competencies
  - How you compare to where you started
  - Your complete Leadership Profile
  - "Your baseline is ready" note if baseline exists
- **Your Goals** (from final session)
- **Areas of Growth** (session themes: leadership, communication, well-being)
- **Practice Space** soft prompt
- **Secondary Reflection CTA** (text link at bottom)

**Actions:** Start reflection flow (opens `ReflectionFlow` modal), navigate to Practice, navigate via sidebar

**What's hidden:** Booking CTAs (program is done), checkpoint prompts

**Edge cases:**
- Says "GROW" hardcoded even for EXEC users (line 43: "Your GROW program is complete"). **Bug for EXEC users.**
- If no sessions have theme data, "Areas of Growth" shows: "Themes from your sessions will appear here."
- This state is impossible for SCALE (line 245: `!isScale && areAllSessionsDone`)
- `isPendingReflection` in Dashboard.tsx requires `onStartReflection` prop to be truthy (line 65)

---

### 6. COMPLETED_PROGRAM

**How determined:** `coachingState.ts` lines 275-276
```typescript
if (isFullyCompleted) state = 'COMPLETED_PROGRAM'
```
`isProgramFullyCompleted()` (lines 87-114) returns true if ANY of:
1. `employee.status` contains 'completed', 'graduated', or 'finished' (case-insensitive)
2. `competencyScores` has entries with `score_type === 'end_of_program'`
3. `reflection` response exists

**File:** `src/components/Dashboard.tsx` (the completed branch, lines 130-481)

**What user sees:**

**One-time Completion Modal** (`CompletionAcknowledgment.tsx`):
- Full-screen overlay with backdrop blur
- Green celebration checkmark icon
- "You've completed your GROW program." (hardcoded as "GROW")
- Coach photo, name, session count, program duration
- "This space has shifted to reflect where you are now..."
- "Continue to Your Portal" button
- Stored in localStorage (`completion_acknowledged_{email}`) - shows only once per user

**Alumni Dashboard:**
- "Hi {firstName}" + "Your leadership journey with Boon"
- **Program Summary** grid: Coach, Program name, Total Sessions, Duration (month range)
- **Growth Story** (`GrowthStory.tsx`): narrative progress summary based on sessions and competency scores
- **Your Leadership Goals** (from last session)
- **Areas of Growth** (session themes with "Explored" prefix instead of "Since")
- **Final Words from Your Coach** (last session summary, italic with quote mark)
- **Key Takeaways** (`KeyTakeaways.tsx`) instead of Action Items
- **What's Next section:**
  - Practice Space soft prompt: "When hard moments come up, your practice space is still here."
  - Leadership Profile CTA: "See your complete competency profile"
  - Session Archive CTA: "Revisit your complete coaching history"
  - SCALE upsell (if user's program !== 'SCALE'): "Some people continue with ongoing 1:1 coaching. Learn about SCALE"

**Navigation changes:**
- "Sessions" renamed to "Archive" in sidebar/mobile nav (Layout.tsx:22)
- "Progress" renamed to "Profile" in sidebar/mobile nav (Layout.tsx:23)
- Same 4 nav items: Home, Archive, Profile, Practice

**Edge cases:**
- CompletionAcknowledgment says "GROW" hardcoded (line 85). **Bug for EXEC users.**
- Coach images use picsum.photos placeholder with coach name as seed (not real photos)
- SCALE users should never reach this state (line 246: `!isScale && isProgramFullyCompleted`)
- If `employee.status` is set to 'Completed' externally (e.g., by admin), user jumps straight to completed even without reflection

---

## Cross-Cutting Features

### Navigation (Layout.tsx)
**File:** `src/components/Layout.tsx`

Nav items (all states except NOT_SIGNED_UP):
| Nav Item | Default Label | Completed Label | View ID |
|----------|--------------|-----------------|---------|
| Home | Home | Home | `dashboard` |
| Sessions | Sessions | Archive | `sessions` |
| Progress | Progress | Profile | `progress` |
| Practice | Practice | Practice | `practice` |

Settings accessible via gear icon (not in main nav). Sign out in sidebar footer.

**Missing from nav:** Coach page, Resources page, Feedback page. These exist as components but are only accessible via internal navigation (e.g., `onNavigate('coach')`).

### Sessions Page (Sessions.tsx)
**File:** `src/components/Sessions.tsx` (32KB)

Behavior varies by state:
- **SIGNED_UP_NOT_MATCHED:** Empty sessions list passed
- **MATCHED_PRE_FIRST_SESSION:** Shows upcoming session(s) only
- **ACTIVE_PROGRAM:** Full session history with filters (All/Completed/Upcoming)
- **COMPLETED_PROGRAM:** Default filter set to "Completed", title is "Session Archive"

Session detail includes: date, status, coach name, themes, summary, goals, plan, zoom link, session feedback submission.

### Progress Page (Progress.tsx)
**File:** `src/components/Progress.tsx` (109KB - largest file)

**SCALE view** (if `isScale && welcomeSurveyScale`):
- Checkpoint trendlines
- Wellbeing metrics over time (satisfaction, productivity, work-life balance)
- Focus area history from checkpoints
- Competency radar chart from checkpoint data

**GROW/EXEC view** (`isGrowOrExec`):
- Baseline vs current competency scores (radar chart)
- Individual competency cards with growth indicators
- Tabs: Overview / Competencies
- "Practice a scenario" CTA for low-scoring competencies
- End-of-program scores shown if reflection completed
- **Completed users:** "Leadership Profile" title, growth summary, pre/post comparison

**Neither SCALE nor GROW/EXEC:**
- Falls through to a minimal view (session themes only)

### Practice Page (Practice.tsx)
**File:** `src/components/Practice.tsx` (22KB)

- Available in ALL states (even SIGNED_UP_NOT_MATCHED)
- **Completed users:** Title changes to "Leadership Toolkit"
- Shows AI-powered practice scenarios
- Scenarios contextualized to competency scores if available
- Opens `PracticeModal.tsx` (25KB) for interactive practice

### Native Survey System (SurveyModal.tsx)
**File:** `src/components/SurveyModal.tsx` (49KB)

Auto-triggered when `fetchPendingSurvey()` finds a pending survey after data loads (App.tsx:181-185).

Survey types:
- **SCALE:** Session feedback (after sessions 1, 3, 6+), touchpoint surveys
- **GROW:** First session, baseline, midpoint (session ~6), end-of-program
- Modal overlays the current view, no way to dismiss initially

### Admin State Preview (AdminStatePreview.tsx)
- Dev/admin panel visible in all states
- Allows overriding coaching state and program type for testing
- Mock data generated for preview states (App.tsx:281-421)
- Useful for testing UX without changing real data

---

## Edge Cases & Issues Found

### Bugs

1. **EXEC users see "GROW" in completion messages**
   - `PendingReflectionHome.tsx:43` - hardcoded "Your GROW program is complete"
   - `CompletionAcknowledgment.tsx:85` - hardcoded "You've completed your GROW program."
   - Should use `programType` to display correct product name

2. **Welcome survey URL is hardcoded placeholder**
   - `App.tsx:34` - `WELCOME_SURVEY_URL = 'https://boon.typeform.com/welcome'` with TODO comment
   - Should differentiate by program type (SCALE vs GROW use different Typeform surveys)

3. **Dead-end state: coach assigned, no booking link, no upcoming session**
   - `PreFirstSessionHome.tsx:412-447` - if `!profile?.booking_link` AND no upcoming session, nothing renders in the session card area
   - User sees coach info but has no way to take action to schedule

### Missing States

4. **Paused/Inactive** - `employee.status` can be "Paused" but this isn't a coaching state. Paused users fall into ACTIVE_PROGRAM and see the normal dashboard. There's no "your program is paused" messaging.

5. **Terminated** - `employee.status = 'Terminated'` isn't handled. User would still see ACTIVE_PROGRAM or COMPLETED_PROGRAM depending on other data. No "your access has been revoked" state.

6. **Coach reassignment** - If coach changes mid-program, sessions from old coach and new coach coexist. Coach name is pulled from `sessions[0]` which may be the old coach if sorted DESC.

7. **SCALE completion** - SCALE is treated as ongoing (`programProgress = 0`, no completion state). If a SCALE user's status is set to 'Completed', they'd see the GROW-style completion dashboard which may not be appropriate.

### Data Integrity Concerns

8. **Program type detection relies on 4-level fallback** - If all fallbacks fail, `programType` is null. The dashboard falls through to `ActiveGrowHome` which is designed for GROW/EXEC. SCALE users with missing program data would get the wrong UI.

9. **`isUpcomingSession` filters stale Salesforce data** (coachingState.ts:57-64) - Past-dated sessions with status "Scheduled" are treated as not upcoming. This is correct but means some sessions may be invisible if Salesforce sync is delayed.

10. **Session counting includes Late Cancel and Client No-Show** - These count towards program progress (e.g., 12 sessions). A user who no-showed 6 of 12 GROW sessions would show as 100% complete.

### UX Gaps

11. **No error state for data loading failures** - `App.tsx:186-188` catches errors with `console.error` only. User sees the dashboard with whatever data loaded successfully. Partial data could lead to wrong state determination.

12. **No polling/refresh for matching state** - Users in SIGNED_UP_NOT_MATCHED must manually refresh to see their coach assignment. No WebSocket, no polling interval.

13. **CompletionAcknowledgment uses localStorage** - If user clears browser data or uses a different device, they see the completion modal again. Not server-side tracked.

14. **Together product** - Mentioned in CLAUDE.md as a Boon product but has zero implementation in the portal. No routes, no components, no program type detection.

---

## File Reference Index

| File | Size | Purpose |
|------|------|---------|
| `src/App.tsx` | ~709 lines | Main routing, data loading, state management |
| `src/lib/coachingState.ts` | 358 lines | State machine (single source of truth) |
| `src/lib/coachingState.test.ts` | - | Unit tests for state logic |
| `src/lib/dataFetcher.ts` | ~2070 lines | All Supabase queries |
| `src/lib/types.ts` | ~453 lines | TypeScript interfaces |
| `src/lib/AuthContext.tsx` | 157 lines | Auth provider, employee lookup |
| `src/lib/useLifecycleStage.ts` | 58 lines | Simplified lifecycle (used alongside coachingState) |
| `src/lib/supabase.ts` | ~107 lines | Supabase client, auth helpers |
| `src/components/Layout.tsx` | 155 lines | Sidebar + mobile nav |
| `src/components/Dashboard.tsx` | 483 lines | Dashboard router + completed view |
| `src/components/ScaleHome.tsx` | 297 lines | SCALE active home |
| `src/components/GrowDashboard.tsx` | ~750 lines | GROW active home |
| `src/components/ActiveGrowHome.tsx` | ~750 lines | EXEC/fallback active home |
| `src/components/PreFirstSessionHome.tsx` | 653 lines | Pre-first-session (all products) |
| `src/components/MatchingHome.tsx` | 317 lines | Matching/waiting state |
| `src/components/PendingReflectionHome.tsx` | 250 lines | Pending reflection (GROW/EXEC) |
| `src/components/CompletionAcknowledgment.tsx` | 131 lines | One-time completion modal |
| `src/components/Sessions.tsx` | ~900 lines | Session list/detail |
| `src/components/Progress.tsx` | ~3000 lines | Progress/competency tracking |
| `src/components/Practice.tsx` | ~600 lines | AI practice scenarios |
| `src/components/CheckpointFlow.tsx` | ~1200 lines | SCALE checkpoint assessment modal |
| `src/components/ReflectionFlow.tsx` | - | GROW/EXEC end-of-program reflection modal |
| `src/components/SurveyModal.tsx` | ~1500 lines | Native survey system |
| `src/components/SessionPrep.tsx` | - | Pre-session preparation guide |
| `src/components/AdminStatePreview.tsx` | - | Dev tool for state override |
| `src/pages/LoginPage.tsx` | 174 lines | Login/magic link |
| `src/pages/NoEmployeeFound.tsx` | 55 lines | No employee record error |
| `src/pages/WelcomePage.tsx` | 95 lines | Welcome/survey CTA |
| `src/pages/WelcomeCompletePage.tsx` | - | Post-survey redirect |
| `src/pages/GettingStartedPage.tsx` | - | Onboarding intro |
