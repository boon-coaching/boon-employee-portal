// Shared calendar helpers for Google and Microsoft OAuth + calendar APIs
// Used by calendar-oauth and calendar-sync Edge Functions

// ============================================================
// Google OAuth
// ============================================================

interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  token_type: string
}

export async function exchangeGoogleCode(
  code: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string
): Promise<TokenResponse> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Google token exchange failed: ${err}`)
  }

  return res.json()
}

export async function refreshGoogleToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<TokenResponse> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Google token refresh failed: ${err}`)
  }

  return res.json()
}

export async function getGoogleUserEmail(accessToken: string): Promise<string> {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    throw new Error(`Google userinfo failed: ${res.status}`)
  }

  const data = await res.json()
  return data.email
}

interface BusyBlock {
  start: string
  end: string
}

export async function fetchGoogleFreeBusy(
  accessToken: string,
  calendarEmail: string,
  timeMin: string,
  timeMax: string
): Promise<BusyBlock[]> {
  const res = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      timeMin,
      timeMax,
      items: [{ id: calendarEmail }],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Google FreeBusy failed: ${err}`)
  }

  const data = await res.json()
  const calendar = data.calendars?.[calendarEmail]
  if (!calendar) return []

  if (calendar.errors?.length) {
    throw new Error(`Google FreeBusy calendar error: ${JSON.stringify(calendar.errors)}`)
  }

  return (calendar.busy || []).map((b: { start: string; end: string }) => ({
    start: b.start,
    end: b.end,
  }))
}

// ============================================================
// Microsoft OAuth
// ============================================================

export async function exchangeMicrosoftCode(
  code: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string
): Promise<TokenResponse> {
  const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      scope: 'Calendars.Read offline_access User.Read',
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Microsoft token exchange failed: ${err}`)
  }

  return res.json()
}

export async function refreshMicrosoftToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<TokenResponse> {
  const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      scope: 'Calendars.Read offline_access User.Read',
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Microsoft token refresh failed: ${err}`)
  }

  return res.json()
}

export async function getMicrosoftUserEmail(accessToken: string): Promise<string> {
  const res = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    throw new Error(`Microsoft /me failed: ${res.status}`)
  }

  const data = await res.json()
  return data.mail || data.userPrincipalName
}

export async function fetchMicrosoftSchedule(
  accessToken: string,
  userEmail: string,
  startTime: string,
  endTime: string
): Promise<BusyBlock[]> {
  const res = await fetch('https://graph.microsoft.com/v1.0/me/calendar/getSchedule', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      schedules: [userEmail],
      startTime: { dateTime: startTime, timeZone: 'UTC' },
      endTime: { dateTime: endTime, timeZone: 'UTC' },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Microsoft getSchedule failed: ${err}`)
  }

  const data = await res.json()
  const schedule = data.value?.[0]
  if (!schedule) return []

  // Include busy, oof, and tentative statuses
  const busyStatuses = new Set(['busy', 'oof', 'tentative'])

  return (schedule.scheduleItems || [])
    .filter((item: { status: string }) => busyStatuses.has(item.status))
    .map((item: { start: { dateTime: string }; end: { dateTime: string } }) => ({
      start: item.start.dateTime.endsWith('Z') ? item.start.dateTime : item.start.dateTime + 'Z',
      end: item.end.dateTime.endsWith('Z') ? item.end.dateTime : item.end.dateTime + 'Z',
    }))
}
