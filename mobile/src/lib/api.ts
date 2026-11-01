export interface AuthUser {
  id: number;
  username: string;
  email: string;
  role: 'user' | 'clinic_staff' | 'admin';
}

export interface AuthSession {
  access: string;
  refresh: string;
  supabase_access_token: string | null;
  supabase_synced?: boolean;
  sync_warning?: string | null;
  user: AuthUser;
}

export interface ProfileSyncResult {
  supabase_synced: boolean;
  sync_warning: string | null;
}

export interface IncidentReportResponse {
  incident_id: number;
  status: string;
  reported_at: string | null;
  notification_sent: false;
}

export interface IncidentReportPayload {
  incident_type: string;
  description: string;
  location: string;
}

interface ApiErrorBody {
  detail?: unknown;
  message?: unknown;
  [key: string]: unknown;
}

export class SupabaseRestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'SupabaseRestError';
  }
}

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '');
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '');
const SUPABASE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

function readableError(body: ApiErrorBody | null, fallback: string): string {
  if (!body) return fallback;
  if (typeof body.detail === 'string') return body.detail;
  if (typeof body.message === 'string') return body.message;

  const messages = Object.entries(body)
    .flatMap(([field, value]) => {
      if (field === 'detail') return [];
      const entries = Array.isArray(value) ? value : [value];
      return entries
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => `${field}: ${entry}`);
    });

  return messages.join('\n') || fallback;
}

async function responseBody(response: Response): Promise<unknown> {
  return response.json().catch(() => null) as Promise<unknown>;
}

export async function authenticate(
  action: 'login' | 'register',
  payload: Record<string, string>,
): Promise<AuthSession> {
  if (!API_BASE_URL) {
    throw new Error(
      'API address is not set. Copy .env.example to .env, set EXPO_PUBLIC_API_URL to your computer’s LAN IP, then restart Expo.',
    );
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/${action}/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error(
      'Could not reach Django. Check that the server is running on 0.0.0.0:8000, both devices use the same Wi-Fi, and the API URL uses your computer’s LAN IP.',
    );
  }

  const body = await responseBody(response) as (ApiErrorBody & Partial<AuthSession>) | null;
  if (!response.ok) {
    throw new Error(readableError(body, `Authentication failed (${response.status}).`));
  }

  if (!body?.access || !body.refresh || !body.user) {
    throw new Error('Django returned an incomplete authentication response.');
  }
  return {
    ...body,
    supabase_access_token: typeof body.supabase_access_token === 'string'
      ? body.supabase_access_token
      : null,
  } as AuthSession;
}

export async function syncProfile(accessToken: string): Promise<ProfileSyncResult> {
  if (!API_BASE_URL) {
    throw new Error('Django API address is not set. Check EXPO_PUBLIC_API_URL and restart Expo.');
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/profile/sync/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    throw new Error('Could not reach Django to sync your profile. Check the server and your network connection.');
  }

  const body = await responseBody(response) as (ApiErrorBody & Partial<ProfileSyncResult>) | null;
  if (!response.ok) {
    throw new Error(readableError(body, `Profile sync failed (${response.status}).`));
  }
  if (typeof body?.supabase_synced !== 'boolean') {
    throw new Error('Django returned an incomplete profile sync response.');
  }
  return {
    supabase_synced: body.supabase_synced,
    sync_warning: typeof body.sync_warning === 'string' ? body.sync_warning : null,
  };
}

async function refreshSupabaseSession(session: AuthSession): Promise<AuthSession> {
  if (!API_BASE_URL) throw new Error('Django API address is not set. Check EXPO_PUBLIC_API_URL.');

  let refreshedResponse: Response;
  try {
    refreshedResponse = await fetch(`${API_BASE_URL}/token/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: session.refresh }),
    });
  } catch {
    throw new Error('Could not reach Django to renew your sign-in. Connect to the network and sign in again.');
  }
  const refreshedBody = await responseBody(refreshedResponse) as (ApiErrorBody & {
    access?: string;
    refresh?: string;
  }) | null;
  if (!refreshedResponse.ok || !refreshedBody?.access) {
    throw new Error(readableError(refreshedBody, 'Your sign-in has expired. Sign in again.'));
  }

  let tokenResponse: Response;
  try {
    tokenResponse = await fetch(`${API_BASE_URL}/token/supabase/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${refreshedBody.access}` },
    });
  } catch {
    throw new Error('Could not reach Django to refresh Supabase access. Connect to the network and retry.');
  }
  const tokenBody = await responseBody(tokenResponse) as (ApiErrorBody & {
    supabase_access_token?: string;
  }) | null;
  if (!tokenResponse.ok || !tokenBody?.supabase_access_token) {
    throw new Error(readableError(tokenBody, `Could not refresh Supabase access (${tokenResponse.status}).`));
  }

  return {
    ...session,
    access: refreshedBody.access,
    refresh: refreshedBody.refresh ?? session.refresh,
    supabase_access_token: tokenBody.supabase_access_token,
  };
}

async function submitIncidentReportWithToken(
  session: AuthSession,
  payload: IncidentReportPayload,
): Promise<IncidentReportResponse> {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error('Supabase client settings are missing. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, then restart Expo.');
  }
  if (!session.supabase_access_token) {
    throw new Error('Supabase access is not configured for this account. Configure the Django Supabase JWT signing settings, then sign in again.');
  }

  const request = async (url: string, init?: RequestInit): Promise<Response> => {
    const headers = new Headers(init?.headers);
    headers.set('apikey', SUPABASE_PUBLISHABLE_KEY);
    headers.set('Authorization', `Bearer ${session.supabase_access_token}`);
    try {
      return await fetch(url, { ...init, headers });
    } catch {
      throw new Error('Could not reach Supabase. Check your internet connection and the configured project URL.');
    }
  };
  const typeUrl = `${SUPABASE_URL}/rest/v1/incident_types?incident_name=eq.${encodeURIComponent(payload.incident_type)}&select=incident_types_id&limit=1`;
  const typeResponse = await request(typeUrl);
  const typeBody = await responseBody(typeResponse);
  if (!typeResponse.ok) {
    throw new SupabaseRestError(
      readableError(typeBody as ApiErrorBody | null, `Supabase incident type lookup failed (${typeResponse.status}).`),
      typeResponse.status,
    );
  }
  const types = typeBody as Array<{ incident_types_id?: number }> | null;
  const incidentTypeId = types?.[0]?.incident_types_id;
  if (typeof incidentTypeId !== 'number') {
    throw new Error('This incident type is not configured in Supabase. Apply the client data migration and try again.');
  }

  const createResponse = await request(`${SUPABASE_URL}/rest/v1/incident`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({
      user_id: session.user.id,
      incident_types_id: incidentTypeId,
      location_description: payload.location,
      description: payload.description,
    }),
  });
  const createBody = await responseBody(createResponse);
  if (!createResponse.ok) {
    throw new SupabaseRestError(
      readableError(createBody as ApiErrorBody | null, `Supabase report submission failed (${createResponse.status}).`),
      createResponse.status,
    );
  }
  const created = (createBody as Array<{
    incident_id?: number | string;
    status?: string;
    reported_at?: string;
  }> | null)?.[0];
  const incidentId = Number(created?.incident_id);
  if (!Number.isSafeInteger(incidentId) || typeof created?.status !== 'string') {
    throw new Error('Supabase did not return the saved incident confirmation.');
  }
  return {
    incident_id: incidentId,
    status: created.status,
    reported_at: typeof created.reported_at === 'string' ? created.reported_at : null,
    notification_sent: false,
  };
}

export async function submitIncidentReport(
  session: AuthSession,
  payload: IncidentReportPayload,
): Promise<{ report: IncidentReportResponse; session: AuthSession }> {
  try {
    return {
      report: await submitIncidentReportWithToken(session, payload),
      session,
    };
  } catch (error) {
    if (!(error instanceof SupabaseRestError) || error.status !== 401) throw error;
    const refreshedSession = await refreshSupabaseSession(session);
    return {
      report: await submitIncidentReportWithToken(refreshedSession, payload),
      session: refreshedSession,
    };
  }
}
