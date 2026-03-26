// Shared Salesforce helpers for Edge Functions
// Client Credentials OAuth flow + REST API wrappers
// Used by sf-absence-sync (and future SF integrations)

// ============================================================
// Types
// ============================================================

export interface SalesforceAuth {
  accessToken: string
  instanceUrl: string
}

interface SalesforceAuthConfig {
  instanceUrl: string
  clientId: string
  clientSecret: string
}

interface SalesforceQueryResult<T> {
  totalSize: number
  done: boolean
  records: T[]
  nextRecordsUrl?: string
}

interface CompositeSubrequest {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  url: string
  referenceId: string
  body?: Record<string, unknown>
}

interface CompositeResponse {
  compositeResponse: Array<{
    body: unknown
    httpHeaders: Record<string, string>
    httpStatusCode: number
    referenceId: string
  }>
}

// ============================================================
// Authentication (Client Credentials Flow)
// ============================================================

export async function getSalesforceAuth(config: SalesforceAuthConfig): Promise<SalesforceAuth> {
  const res = await fetch(`${config.instanceUrl}/services/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Salesforce auth failed (${res.status}): ${err}`)
  }

  const data = await res.json()
  return {
    accessToken: data.access_token,
    instanceUrl: data.instance_url,
  }
}

export function getSalesforceConfig(): SalesforceAuthConfig {
  const get = (name: string): string => {
    const value = Deno.env.get(name)
    if (!value) throw new Error(`Missing env var: ${name}`)
    return value
  }

  return {
    instanceUrl: get('SALESFORCE_INSTANCE_URL'),
    clientId: get('SF_SYNC_CLIENT_ID'),
    clientSecret: get('SF_SYNC_CLIENT_SECRET'),
  }
}

// ============================================================
// Portal config (Client Credentials against SF sandbox)
// ============================================================

export function getSalesforcePortalConfig(): SalesforceAuthConfig {
  const get = (name: string): string => {
    const value = Deno.env.get(name)
    if (!value) throw new Error(`Missing env var: ${name}`)
    return value
  }

  return {
    instanceUrl: get('SF_PORTAL_LOGIN_URL'),
    clientId: get('SF_PORTAL_CLIENT_ID'),
    clientSecret: get('SF_PORTAL_CLIENT_SECRET'),
  }
}

// ============================================================
// SOQL Query
// ============================================================

export async function salesforceQuery<T>(
  auth: SalesforceAuth,
  soql: string
): Promise<T[]> {
  let url = `${auth.instanceUrl}/services/data/v59.0/query?q=${encodeURIComponent(soql)}`
  const allRecords: T[] = []

  while (url) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${auth.accessToken}` },
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Salesforce query failed (${res.status}): ${err}`)
    }

    const data: SalesforceQueryResult<T> = await res.json()
    allRecords.push(...data.records)

    url = data.done ? '' : `${auth.instanceUrl}${data.nextRecordsUrl}`
  }

  return allRecords
}

// ============================================================
// Composite API (batch up to 25 operations per call)
// ============================================================

export async function salesforceComposite(
  auth: SalesforceAuth,
  subrequests: CompositeSubrequest[]
): Promise<CompositeResponse> {
  const url = `${auth.instanceUrl}/services/data/v59.0/composite`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      allOrNone: false,
      compositeRequest: subrequests,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Salesforce composite failed (${res.status}): ${err}`)
  }

  return res.json()
}

// ============================================================
// Batch helpers
// ============================================================

// Splits an array into chunks of the given size
export function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}
