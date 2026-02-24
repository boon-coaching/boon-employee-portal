// Coach Match Notification Edge Function
// Sends personalized coach match notifications via Slack DM or Teams Adaptive Card
// Falls back to email when neither platform is connected

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Coach {
  id: string;
  name: string;
  first_name: string;
  email: string;
  headline?: string;
  bio?: string;
  specialties?: string;
  industries?: string;
  practitioner_type?: string;
  photo_url?: string;
}

interface EmployeeSurvey {
  first_name: string;
  last_name: string;
  name: string;
  email: string;
  role?: string;
  additional_topics?: string;
  matching_preferences?: string;
  [key: string]: any;
}

interface RequestPayload {
  employee_email: string;
  coach_1_email: string;
  coach_1_booking_link: string;
  coach_2_email: string;
  coach_2_booking_link: string;
}

function getSupabaseClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
}

// Extract focus areas as readable list
function getFocusAreas(survey: EmployeeSurvey): string[] {
  const focusMap: Record<string, string> = {
    focus_work_relationships: 'work relationships',
    focus_work_life_balance: 'work-life balance',
    focus_leadership_development: 'leadership development',
    focus_realizing_potential: 'realizing your potential',
    focus_work_performance: 'work performance',
    focus_work_stress: 'managing work stress',
    focus_new_environment: 'navigating a new environment',
    focus_adapting_to_change: 'adapting to change',
    focus_dealing_with_uncertainty: 'dealing with uncertainty',
    focus_bouncing_back: 'bouncing back from setbacks',
    focus_relationship_with_self: 'relationship with self',
    focus_inner_confidence: 'building inner confidence',
    focus_positive_habits: 'building positive habits',
    focus_personal_accountability: 'personal accountability',
    focus_professional_development: 'professional development',
    focus_persevering_through_change: 'persevering through change',
    focus_relationships_self_others: 'relationships with self and others',
    focus_coping_stress_anxiety: 'coping with stress and anxiety',
    focus_effective_communication: 'effective communication',
    focus_persuasion_and_influence: 'persuasion and influence',
    focus_adaptability_and_resilience: 'adaptability and resilience',
    focus_strategic_thinking: 'strategic thinking',
    focus_emotional_intelligence: 'emotional intelligence',
    focus_building_relationships_at_work: 'building relationships at work',
    focus_self_confidence_and_imposter_syndrome: 'self-confidence',
    focus_delegation_and_accountability: 'delegation and accountability',
    focus_giving_and_receiving_feedback: 'giving and receiving feedback',
    focus_effective_planning_and_execution: 'effective planning and execution',
    focus_change_management: 'change management',
    focus_time_management_and_productivity: 'time management and productivity',
  };

  const areas: string[] = [];
  for (const [key, label] of Object.entries(focusMap)) {
    if (survey[key as keyof EmployeeSurvey] === true || survey[key as keyof EmployeeSurvey] === 'true') {
      areas.push(label);
    }
  }
  return areas;
}

// Generate personalized match rationale using Claude
async function generateMatchRationale(
  employee: EmployeeSurvey,
  coach: Coach,
  focusAreas: string[]
): Promise<string> {
  const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
  
  if (!anthropicApiKey) {
    return `${coach.first_name} brings relevant experience to help you with ${focusAreas[0] || 'your professional development'}.`;
  }

  const prompt = `Write a 2-sentence coach match rationale for a Slack message. Be specific and human - not salesy.

EMPLOYEE:
- Role: ${employee.role || 'Not specified'}
- Focus areas: ${focusAreas.join(', ') || 'General development'}
- Additional context: ${employee.additional_topics || 'None'}
- Preferences: ${employee.matching_preferences || 'None'}

COACH:
- Name: ${coach.name}
- Headline: ${coach.headline || 'Executive Coach'}
- Background (excerpt): ${coach.bio?.substring(0, 400) || 'Experienced coach'}
- Specialties: ${coach.specialties || 'Leadership'}

Rules:
- Start with the coach's first name
- 2 sentences max, under 50 words total
- NO phrases like: "uniquely positioned", "directly aligns", "perfectly suited", "holistic approach", "unlock potential"
- Be specific about what in their background connects to the employee's goals
- Write like a colleague explaining the match, not marketing copy`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 100,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json();
    
    if (data.content && data.content[0]?.text) {
      return data.content[0].text.trim();
    }
  } catch (error) {
    console.error('Claude API error:', error);
  }

  // Fallback
  return `${coach.first_name} brings relevant experience to help you with ${focusAreas[0] || 'your professional development'}.`;
}

// Build Slack Block Kit message
function buildSlackMessage(
  employee: EmployeeSurvey,
  coach1: Coach,
  coach1BookingLink: string,
  coach1Rationale: string,
  coach2: Coach,
  coach2BookingLink: string,
  coach2Rationale: string,
  focusAreas: string[]
): object[] {
  const focusText = focusAreas.length > 0 
    ? focusAreas.slice(0, 3).join(', ')
    : 'your professional growth';

  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `🎯 *Your coach matches are ready, ${employee.first_name}!*\n\nBased on your focus on *${focusText}*, we found two coaches who are a great fit:`,
      },
    },
    { type: 'divider' },
    // Coach 1
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${coach1.name}*\n_${coach1.headline || 'Executive Coach'}_\n\n${coach1Rationale}`,
      },
      accessory: coach1.photo_url ? {
        type: 'image',
        image_url: coach1.photo_url,
        alt_text: coach1.name,
      } : undefined,
    },
    {
      type: 'actions',
      block_id: `book_coach_${coach1.id}`,
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: `Book with ${coach1.first_name}`,
            emoji: true,
          },
          url: coach1BookingLink,
          action_id: 'book_coach_1',
          style: 'primary',
        },
      ],
    },
    { type: 'divider' },
    // Coach 2
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${coach2.name}*\n_${coach2.headline || 'Executive Coach'}_\n\n${coach2Rationale}`,
      },
      accessory: coach2.photo_url ? {
        type: 'image',
        image_url: coach2.photo_url,
        alt_text: coach2.name,
      } : undefined,
    },
    {
      type: 'actions',
      block_id: `book_coach_${coach2.id}`,
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: `Book with ${coach2.first_name}`,
            emoji: true,
          },
          url: coach2BookingLink,
          action_id: 'book_coach_2',
          style: 'primary',
        },
      ],
    },
    { type: 'divider' },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: '💡 _Not sure which coach to pick? Book a chemistry call with both to see who feels like the best fit._',
        },
      ],
    },
  ];

  // Remove undefined accessory fields
  return blocks.map(block => {
    if (block.type === 'section' && (block as any).accessory === undefined) {
      const { accessory, ...rest } = block as any;
      return rest;
    }
    return block;
  });
}

// Send Slack DM
async function sendSlackDM(
  botToken: string,
  channelId: string,
  blocks: object[]
): Promise<{ ok: boolean; error?: string }> {
  const response = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${botToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      channel: channelId,
      blocks,
      text: 'Your coach matches are ready!',
    }),
  });

  return response.json();
}

// Get Teams bot access token via OAuth2 client credentials
async function getBotAccessToken(
  clientId: string,
  clientSecret: string,
  tenantId: string
): Promise<string | null> {
  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://api.botframework.com/.default',
      grant_type: 'client_credentials',
    }),
  });

  if (!response.ok) return null;
  const data = await response.json();
  return data.access_token;
}

// Send a message via Teams Bot Framework
async function sendTeamsMessage(
  token: string,
  serviceUrl: string,
  conversationId: string,
  card: Record<string, unknown>
): Promise<{ ok: boolean; activityId?: string; error?: string }> {
  const url = `${serviceUrl.replace(/\/$/, '')}/v3/conversations/${conversationId}/activities`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'message',
      attachments: [
        {
          contentType: 'application/vnd.microsoft.card.adaptive',
          content: card,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return { ok: false, error: errorText };
  }

  const data = await response.json();
  return { ok: true, activityId: data.id };
}

// Create a 1:1 conversation with a Teams user via Bot Framework
async function createTeamsConversation(
  token: string,
  serviceUrl: string,
  teamsUserId: string,
  tenantId: string
): Promise<string | null> {
  const url = `${serviceUrl.replace(/\/$/, '')}/v3/conversations`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      bot: { id: Deno.env.get('TEAMS_CLIENT_ID') },
      members: [{ id: teamsUserId }],
      channelData: { tenant: { id: tenantId } },
      isGroup: false,
    }),
  });

  if (!response.ok) return null;
  const data = await response.json();
  return data.id || null;
}

// Build Adaptive Card for coach match notification
function buildTeamsMatchCard(
  employee: EmployeeSurvey,
  coach1: Coach,
  coach1BookingLink: string,
  coach1Rationale: string,
  coach2: Coach,
  coach2BookingLink: string,
  coach2Rationale: string,
  focusAreas: string[]
): Record<string, unknown> {
  const focusText = focusAreas.length > 0
    ? focusAreas.slice(0, 3).join(', ')
    : 'your professional growth';

  function coachColumns(coach: Coach, rationale: string): Record<string, unknown> {
    const columns: Record<string, unknown>[] = [];

    if (coach.photo_url) {
      columns.push({
        type: 'Column',
        width: 'auto',
        items: [
          {
            type: 'Image',
            url: coach.photo_url,
            size: 'Medium',
            style: 'Person',
            altText: coach.name,
          },
        ],
      });
    }

    columns.push({
      type: 'Column',
      width: 'stretch',
      items: [
        {
          type: 'TextBlock',
          text: coach.name,
          weight: 'Bolder',
          size: 'Medium',
          wrap: true,
        },
        {
          type: 'TextBlock',
          text: coach.headline || 'Executive Coach',
          isSubtle: true,
          spacing: 'None',
          wrap: true,
        },
        {
          type: 'TextBlock',
          text: rationale,
          wrap: true,
          spacing: 'Small',
        },
      ],
    });

    return { type: 'ColumnSet', columns };
  }

  return {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.4',
    body: [
      {
        type: 'TextBlock',
        text: `Your coach matches are ready, ${employee.first_name}!`,
        weight: 'Bolder',
        size: 'Large',
        wrap: true,
      },
      {
        type: 'TextBlock',
        text: `Based on your focus on ${focusText}, we found two coaches who are a great fit:`,
        wrap: true,
        spacing: 'Small',
      },
      // Coach 1
      coachColumns(coach1, coach1Rationale),
      {
        type: 'ActionSet',
        actions: [
          {
            type: 'Action.OpenUrl',
            title: `Book with ${coach1.first_name}`,
            url: coach1BookingLink,
            style: 'positive',
          },
        ],
      },
      // Separator
      {
        type: 'TextBlock',
        text: ' ',
        separator: true,
        spacing: 'Medium',
      },
      // Coach 2
      coachColumns(coach2, coach2Rationale),
      {
        type: 'ActionSet',
        actions: [
          {
            type: 'Action.OpenUrl',
            title: `Book with ${coach2.first_name}`,
            url: coach2BookingLink,
            style: 'positive',
          },
        ],
      },
      // Footer
      {
        type: 'TextBlock',
        text: 'Not sure which coach to pick? Book a chemistry call with both to see who feels like the best fit.',
        isSubtle: true,
        wrap: true,
        separator: true,
        spacing: 'Medium',
        size: 'Small',
      },
    ],
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = getSupabaseClient();
    const payload: RequestPayload = await req.json();

    const employeeEmail = payload.employee_email.toLowerCase();

    // 1. Determine messaging channel: Slack, Teams, or email fallback
    let channel: 'slack' | 'teams' | 'email' = 'email';
    let slackBotToken: string | null = null;
    let slackChannelId: string | null = null;
    let teamsBotToken: string | null = null;
    let teamsServiceUrl: string | null = null;
    let teamsConversationId: string | null = null;

    // 1a. Check Slack first
    const { data: slackConnection } = await supabase
      .from('employee_slack_connections')
      .select('slack_user_id, slack_dm_channel_id, slack_team_id')
      .eq('employee_email', employeeEmail)
      .single();

    if (slackConnection?.slack_dm_channel_id) {
      const { data: installation } = await supabase
        .from('slack_installations')
        .select('bot_token')
        .eq('team_id', slackConnection.slack_team_id)
        .single();

      if (installation?.bot_token) {
        channel = 'slack';
        slackBotToken = installation.bot_token;
        slackChannelId = slackConnection.slack_dm_channel_id;
      }
    }

    // 1b. If no Slack, check Teams
    if (channel === 'email') {
      const { data: teamsConnection } = await supabase
        .from('employee_teams_connections')
        .select('teams_user_id, conversation_id, tenant_id, service_url')
        .eq('employee_email', employeeEmail)
        .single();

      if (teamsConnection?.teams_user_id && teamsConnection?.service_url) {
        const clientId = Deno.env.get('TEAMS_CLIENT_ID');
        const clientSecret = Deno.env.get('TEAMS_CLIENT_SECRET');
        const appTenantId = Deno.env.get('TEAMS_APP_TENANT_ID') || teamsConnection.tenant_id;

        if (clientId && clientSecret) {
          const botToken = await getBotAccessToken(clientId, clientSecret, appTenantId);

          if (botToken) {
            teamsBotToken = botToken;
            teamsServiceUrl = teamsConnection.service_url;

            // Create conversation if not already established
            if (!teamsConnection.conversation_id) {
              const newConvId = await createTeamsConversation(
                botToken,
                teamsConnection.service_url,
                teamsConnection.teams_user_id,
                teamsConnection.tenant_id
              );

              if (newConvId) {
                teamsConversationId = newConvId;
                // Persist so we don't have to create it again
                await supabase
                  .from('employee_teams_connections')
                  .update({ conversation_id: newConvId })
                  .eq('employee_email', employeeEmail);
              }
            } else {
              teamsConversationId = teamsConnection.conversation_id;
            }

            if (teamsConversationId) {
              channel = 'teams';
            }
          }
        }
      }
    }

    // 1c. If neither connected, return email fallback
    if (channel === 'email') {
      return new Response(
        JSON.stringify({
          fallback: 'email',
          reason: 'Employee not connected to Slack or Teams'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Fetch employee survey data (try Scale first, then Baseline)
    let employee: EmployeeSurvey | null = null;
    let surveyTable: 'welcome_survey_scale' | 'welcome_survey_baseline' = 'welcome_survey_scale';

    const { data: scaleEmployee } = await supabase
      .from('welcome_survey_scale')
      .select('*')
      .eq('email', employeeEmail)
      .single();

    if (scaleEmployee) {
      employee = scaleEmployee;
    } else {
      const { data: baselineEmployee } = await supabase
        .from('welcome_survey_baseline')
        .select('*')
        .eq('email', employeeEmail)
        .single();

      if (baselineEmployee) {
        employee = baselineEmployee;
        surveyTable = 'welcome_survey_baseline';
      }
    }

    if (!employee) {
      return new Response(
        JSON.stringify({ error: 'Employee survey data not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Fetch coach profiles
    const { data: coach1 } = await supabase
      .from('coaches')
      .select('*')
      .eq('email', payload.coach_1_email.toLowerCase())
      .single();

    const { data: coach2 } = await supabase
      .from('coaches')
      .select('*')
      .eq('email', payload.coach_2_email.toLowerCase())
      .single();

    if (!coach1 || !coach2) {
      return new Response(
        JSON.stringify({
          error: 'One or both coaches not found',
          coach_1_found: !!coach1,
          coach_2_found: !!coach2
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Get focus areas and generate personalized rationales
    const focusAreas = getFocusAreas(employee);

    const [coach1Rationale, coach2Rationale] = await Promise.all([
      generateMatchRationale(employee, coach1, focusAreas),
      generateMatchRationale(employee, coach2, focusAreas),
    ]);

    // 5. Send via the appropriate channel
    if (channel === 'slack') {
      const blocks = buildSlackMessage(
        employee,
        coach1,
        payload.coach_1_booking_link,
        coach1Rationale,
        coach2,
        payload.coach_2_booking_link,
        coach2Rationale,
        focusAreas
      );

      const slackResult = await sendSlackDM(
        slackBotToken!,
        slackChannelId!,
        blocks
      );

      if (!slackResult.ok) {
        console.error('Slack API error:', slackResult.error);
        return new Response(
          JSON.stringify({ error: 'Failed to send Slack message', slack_error: slackResult.error }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // Teams
      const card = buildTeamsMatchCard(
        employee,
        coach1,
        payload.coach_1_booking_link,
        coach1Rationale,
        coach2,
        payload.coach_2_booking_link,
        coach2Rationale,
        focusAreas
      );

      const teamsResult = await sendTeamsMessage(
        teamsBotToken!,
        teamsServiceUrl!,
        teamsConversationId!,
        card
      );

      if (!teamsResult.ok) {
        console.error('Teams API error:', teamsResult.error);
        return new Response(
          JSON.stringify({ error: 'Failed to send Teams message', teams_error: teamsResult.error }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 6. Save rationale to survey table
    const matchRationale = `Coach 1: ${coach1.name} - ${coach1Rationale}\nCoach 2: ${coach2.name} - ${coach2Rationale}`;

    await supabase
      .from(surveyTable)
      .update({ slack_match_rationale: matchRationale })
      .eq('email', employeeEmail);

    return new Response(
      JSON.stringify({
        success: true,
        channel,
        message: `Coach match notification sent via ${channel === 'slack' ? 'Slack' : 'Teams'}`,
        employee: employee.name,
        coaches: [coach1.name, coach2.name]
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Coach match notification error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});