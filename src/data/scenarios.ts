// Practice scenarios organized by coaching theme
// These map to the coaching focus areas: Leadership, Communication, Wellbeing

export type ScenarioCategory = 'leadership' | 'communication' | 'wellbeing';
export type ScenarioDifficulty = 'Low' | 'Medium' | 'High';

export interface PracticeScenario {
  id: string;
  title: string;
  category: ScenarioCategory;
  description: string;
  difficulty: ScenarioDifficulty;
  tags: string[];
  explanation: string;
  basePrompt: string;
}

export const SCENARIOS: PracticeScenario[] = [
  // LEADERSHIP SCENARIOS
  {
    id: 'lead-1',
    title: 'Delivering Constructive Feedback',
    category: 'leadership',
    description: 'Structure tough feedback so it lands effectively without destroying morale.',
    difficulty: 'High',
    tags: ['performance', 'growth', '1:1'],
    explanation: 'Uses the "Situation-Behavior-Impact" (SBI) model to remove ambiguity and defensiveness.',
    basePrompt: `**STRATEGY GUIDE:** The SBI Model

1. **Situation:** Be specific about when and where it happened.
2. **Behavior:** Describe the observable action (not personality).
3. **Impact:** Explain the effect on the team or work.

**Key Phrasing:**
"I noticed in the meeting yesterday..." (Situation)
"...that you interrupted the client twice..." (Behavior)
"...which made them hesitate to share their requirements." (Impact)

**Goal:** Move from "Blame" to "Problem Solving".`
  },
  {
    id: 'lead-2',
    title: 'Managing Underperformance',
    category: 'leadership',
    description: 'Creating a Performance Improvement Plan (PIP) or addressing chronic issues.',
    difficulty: 'High',
    tags: ['pip', 'hr', 'documentation'],
    explanation: 'Ensures clarity, measurable goals, and legal defensibility while remaining humane.',
    basePrompt: `**STRATEGY GUIDE:** The Gap Analysis

1. **The Expectation:** "We need X level of output."
2. **The Reality:** "Currently, we are seeing Y."
3. **The Gap:** "This gap is affecting the team by Z."
4. **The Plan:** "Here is what needs to change in 30 days."

**Crucial:** Document everything. Focus on the outcome, not the effort. Ask: "What barriers are getting in your way?"`
  },
  {
    id: 'lead-3',
    title: 'Delegating a High-Stakes Task',
    category: 'leadership',
    description: 'Handing off critical work without micromanaging.',
    difficulty: 'Medium',
    tags: ['delegation', 'trust'],
    explanation: 'Uses the "Commander\'s Intent" framework to define the "What" and "Why" but leave the "How" to them.',
    basePrompt: `**STRATEGY GUIDE:** Commander's Intent

To delegate effectively without micromanaging, define:
1. **The Purpose** (Why we are doing this).
2. **The End State** (What success looks like visually).
3. **The Guardrails** (Budget, Time, Resources).

**Explicitly state:** "I trust you to figure out the 'How'. Come to me if you hit these specific blockers: [List Blockers]."`
  },
  {
    id: 'lead-4',
    title: 'Resolving Team Conflict',
    category: 'leadership',
    description: 'Mediating a dispute between two team members who are clashing.',
    difficulty: 'High',
    tags: ['mediation', 'conflict'],
    explanation: 'Shifts focus from personality clashes to shared business objectives.',
    basePrompt: `**STRATEGY GUIDE:** Interest-Based Relational Approach

1. **De-escalate:** Meet separately first if emotions are high.
2. **Define the Problem:** "We have a misalignment on [Process], not a personality issue."
3. **Shared Goal:** "We both want [Project] to succeed."
4. **Agree on Protocol:** "Moving forward, how will we make decisions when we disagree?"

Focus on the 'Third Entity': The Relationship/Project, not the individuals.`
  },
  {
    id: 'lead-5',
    title: 'Onboarding a New Team Member',
    category: 'leadership',
    description: 'Setting up a newly hired person for success in their first 90 days.',
    difficulty: 'Medium',
    tags: ['onboarding', 'training'],
    explanation: 'Focuses on relationship building and quick wins.',
    basePrompt: `**STRATEGY GUIDE:** The 30-60-90 Framework

- **Days 1-30: Sponge Mode.** Interview everyone. Understand the history. Don't make big changes.
- **Days 31-60: Quick Wins.** Fix the small, annoying things (the 'pebbles in the shoe').
- **Days 61-90: Strategy.** Present the long-term vision.

**Success Metric:** Trust established with the team.`
  },
  {
    id: 'lead-6',
    title: 'Conducting a Stay Interview',
    category: 'leadership',
    description: 'Retaining talent before they think about leaving.',
    difficulty: 'Low',
    tags: ['retention', 'culture'],
    explanation: 'Proactive conversations to understand motivation triggers.',
    basePrompt: `**STRATEGY GUIDE:** The Stay Interview

Don't wait for the exit interview. Ask these now:
1. "When was the last time you felt excited about coming to work?"
2. "If you could change one thing about your role (other than salary), what would it be?"
3. "What talents do you have that we aren't using?"

**Goal:** Re-recruit your top talent every quarter.`
  },

  // COMMUNICATION SCENARIOS
  {
    id: 'comm-1',
    title: 'Refusing a Request (Saying No)',
    category: 'communication',
    description: 'How to push back on unrealistic deadlines or out-of-scope requests.',
    difficulty: 'Medium',
    tags: ['negotiation', 'boundaries'],
    explanation: 'Focuses on trade-offs and resource constraints rather than simple refusal.',
    basePrompt: `**STRATEGY GUIDE:** The "Yes, If" Technique

Instead of saying "No", say "Yes, if we can prioritize X over Y."

**Framework:**
1. Acknowledge the importance of the request.
2. State the current capacity/constraint clearly.
3. Offer the trade-off or alternative timeline.

**Example:**
"I understand this feature is critical. To deliver it by Friday, we would need to pause work on the migration project. Which is the higher priority for this sprint?"`
  },
  {
    id: 'comm-2',
    title: 'Announcing Bad News',
    category: 'communication',
    description: 'Communicating changes that will cause anxiety or uncertainty.',
    difficulty: 'High',
    tags: ['change management', 'transparency'],
    explanation: 'Balances transparency with empathy, acknowledging emotions without validating unfounded fears.',
    basePrompt: `**STRATEGY GUIDE:** The "Rip the Band-Aid" Method

1. **The Headline:** State the news in the first sentence. Don't build up to it.
2. **The Context:** Explain the business reality driving the decision.
3. **The Impact:** Explain exactly what changes for the individual.
4. **The Next Step:** What happens immediately after this meeting.

Do not promise "everything will be fine." Promise "I will be transparent with you."`
  },
  {
    id: 'comm-3',
    title: 'Managing Up Effectively',
    category: 'communication',
    description: 'Influencing and communicating with your own manager or leadership.',
    difficulty: 'Medium',
    tags: ['influence', 'executive'],
    explanation: 'Focuses on speaking their language and aligning with their priorities.',
    basePrompt: `**STRATEGY GUIDE:** The Executive Summary Approach

Leaders are time-constrained. Structure communication as:
1. **Bottom Line Up Front (BLUF):** What do you need from them?
2. **Context:** The 2-sentence background.
3. **Options:** Present 2-3 paths, with your recommendation.
4. **Ask:** "I recommend Option B. Do you agree, or should we discuss?"

**Key:** Reduce their cognitive load. Make it easy to say yes.`
  },
  {
    id: 'comm-4',
    title: 'Running Effective Meetings',
    category: 'communication',
    description: 'Getting real decisions and action items out of meetings.',
    difficulty: 'Low',
    tags: ['facilitation', 'productivity'],
    explanation: 'Uses structured facilitation to prevent meetings from becoming status updates.',
    basePrompt: `**STRATEGY GUIDE:** The Decision Meeting Framework

1. **Agenda with Questions:** Not "Discuss Q3 Budget" but "Should we increase Q3 budget by 15%?"
2. **Pre-Read:** Send context 24hrs before. No reading in the meeting.
3. **Timebox:** Each topic gets a set time. Move on.
4. **End with Actions:** "Who does what by when?"

**Rule:** If no decision is needed, it's an email, not a meeting.`
  },
  {
    id: 'comm-5',
    title: 'Giving Recognition',
    category: 'communication',
    description: 'Making praise specific and meaningful, not generic.',
    difficulty: 'Low',
    tags: ['motivation', 'culture'],
    explanation: 'Specific recognition reinforces the exact behavior you want repeated.',
    basePrompt: `**STRATEGY GUIDE:** The Specific Praise Formula

Generic: "Great job on the project!"
Specific: "The way you structured the client deck—leading with their pain points—was exactly right. The client commented on it after."

**Framework:**
1. **What they did** (specific action)
2. **Why it mattered** (impact on team/business)
3. **Character trait it shows** (connects to their identity)

Make it public when appropriate to amplify the effect.`
  },
  {
    id: 'comm-6',
    title: 'Asking for What You Need',
    category: 'communication',
    description: 'Advocating for resources, support, or changes you need to succeed.',
    difficulty: 'High',
    tags: ['negotiation', 'career'],
    explanation: 'Frames requests in terms of business value, not personal preference.',
    basePrompt: `**STRATEGY GUIDE:** The Value-Based Ask

Don't frame as: "I need this because..."
Frame as: "This will enable the team to..."

**Structure:**
1. **The Opportunity:** What becomes possible with this resource/change.
2. **The Cost of Inaction:** What we're leaving on the table without it.
3. **The Ask:** Specific, measurable, time-bound.
4. **The Commitment:** What you'll deliver in return.

Make it easy for them to champion your request to others.`
  },

  // WELLBEING SCENARIOS
  {
    id: 'well-1',
    title: 'Addressing Burnout',
    category: 'wellbeing',
    description: 'Talking to a high-performer who is visibly exhausted.',
    difficulty: 'Medium',
    tags: ['mental health', 'retention'],
    explanation: 'Focuses on psychological safety and operational changes, not just "take a day off".',
    basePrompt: `**STRATEGY GUIDE:** The "Oxygen Mask" Conversation

1. **Observation:** "I've noticed you sending emails at 11 PM and seem more withdrawn."
2. **Validation:** "You are doing great work, but I'm worried about sustainability."
3. **Operational Change:** "Let's look at your plate. What can we cut, delegate, or pause right now?"

**Avoid:** "Just take a vacation" (The work piles up while they are gone).
**Focus on:** Reducing the load.`
  },
  {
    id: 'well-2',
    title: 'Setting Work-Life Boundaries',
    category: 'wellbeing',
    description: 'Protecting your time and energy without damaging your reputation.',
    difficulty: 'Medium',
    tags: ['boundaries', 'self-care'],
    explanation: 'Reframes boundaries as professional discipline, not lack of commitment.',
    basePrompt: `**STRATEGY GUIDE:** The Professional Boundary

Boundaries aren't "I can't." They're "I don't—so I can."

**Framework:**
1. **State the boundary clearly:** "I don't check email after 7 PM."
2. **Explain the business reason:** "This helps me come in fresh and focused."
3. **Offer the alternative:** "If something is urgent, text me."

**Key insight:** Modeling boundaries gives your team permission to do the same.`
  },
  {
    id: 'well-3',
    title: 'Managing Imposter Syndrome',
    category: 'wellbeing',
    description: 'When you feel like a fraud despite evidence of your competence.',
    difficulty: 'Medium',
    tags: ['confidence', 'mindset'],
    explanation: 'Reframes the internal narrative from "I\'m fooling everyone" to "I\'m still learning."',
    basePrompt: `**STRATEGY GUIDE:** The Evidence Journal

Imposter syndrome ignores evidence. Counter it with:
1. **Keep a "Wins" file:** Every positive feedback, successful project, or compliment goes in.
2. **Reframe the narrative:** Not "I got lucky" but "I prepared well."
3. **Normalize the feeling:** Most high-performers feel this. It means you care.

**Mantra:** "I'm not an imposter. I'm a work in progress—like everyone else."`
  },
  {
    id: 'well-4',
    title: 'Recovering from a Mistake',
    category: 'wellbeing',
    description: 'Bouncing back after a visible failure or error in judgment.',
    difficulty: 'High',
    tags: ['resilience', 'accountability'],
    explanation: 'Focuses on accountability, learning, and forward motion—not rumination.',
    basePrompt: `**STRATEGY GUIDE:** The Mistake Recovery Protocol

1. **Own it immediately:** Don't minimize or deflect. "I made the wrong call."
2. **State the impact:** Show you understand the consequences.
3. **Share the fix:** "Here's what I've done to address it."
4. **State the lesson:** "Going forward, I will [specific change]."

**Key:** Your reputation is built on how you handle mistakes, not on never making them.`
  },
  {
    id: 'well-5',
    title: 'Having a Mental Health Day',
    category: 'wellbeing',
    description: 'Taking time off for mental health without over-explaining.',
    difficulty: 'Low',
    tags: ['self-care', 'boundaries'],
    explanation: 'Normalizes mental health as part of overall health, requiring no special justification.',
    basePrompt: `**STRATEGY GUIDE:** The Simple Ask

You don't need to justify a mental health day any more than a physical sick day.

**Script:**
"I'm taking a personal day tomorrow. I'll be offline but will check for anything urgent before EOD today. Back on [Date]."

**If pressed:** "I need to take care of something personal. I'll make sure [Coverage Plan] is in place."

You owe them your output, not your medical history.`
  },
  {
    id: 'well-6',
    title: 'Dealing with a Difficult Colleague',
    category: 'wellbeing',
    description: 'Managing your own stress when working with someone challenging.',
    difficulty: 'Medium',
    tags: ['conflict', 'emotional regulation'],
    explanation: 'Focuses on what you can control: your response, not their behavior.',
    basePrompt: `**STRATEGY GUIDE:** The Detachment Protocol

You can't change them. You can change your response.

1. **Name the behavior, not the person:** "That comment was dismissive" vs "They're a jerk."
2. **Set interaction boundaries:** Limit 1:1 time. Keep interactions transactional.
3. **Document patterns:** If it escalates, you'll need specifics.
4. **Protect your energy:** They get your professionalism, not your emotional investment.

**Mantra:** "This is their pattern, not my problem to solve."`
  }
];

// Helper to get scenarios by category
export function getScenariosByCategory(category: ScenarioCategory): PracticeScenario[] {
  return SCENARIOS.filter(s => s.category === category);
}

// Helper to get scenarios matching user's coaching themes
export function getScenariosForThemes(themes: { leadership: boolean; communication: boolean; wellbeing: boolean }): PracticeScenario[] {
  return SCENARIOS.filter(s => {
    if (s.category === 'leadership' && themes.leadership) return true;
    if (s.category === 'communication' && themes.communication) return true;
    if (s.category === 'wellbeing' && themes.wellbeing) return true;
    return false;
  });
}

// Category display info
export const CATEGORY_INFO: Record<ScenarioCategory, { label: string; color: string; bgColor: string }> = {
  leadership: { label: 'Leadership', color: 'text-boon-blue', bgColor: 'bg-boon-lightBlue' },
  communication: { label: 'Communication', color: 'text-purple-600', bgColor: 'bg-purple-100' },
  wellbeing: { label: 'Wellbeing', color: 'text-green-600', bgColor: 'bg-green-100' }
};
