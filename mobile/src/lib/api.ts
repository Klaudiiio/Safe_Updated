export interface AuthUser {
  id: number;
  username: string;
  email: string;
  name?: string;
  student_id?: string;
  course?: string;
  phone_number?: string;
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

export interface ProfileUpdatePayload {
  name: string;
  username: string;
  email?: string; // <-- Added optional email property
  student_id: string;
  course: string;
  phone_number: string;
}

export interface ProfileUpdateResponse {
  message: string;
  supabase_synced: boolean;
  sync_warning: string | null;
  user: AuthUser;
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

export interface IncidentHistoryItem {
  id: number | string;
  incident_type: string;
  description: string;
  location: string;
  status: string;
  reported_at: string | null;
}

export interface SensorDataResponse {
  temperature_c: number;
  humidity_percent?: number;
  recorded_at?: string;
}

export interface IncidentTypeRecord {
  incident_types_id: number;
  incident_name: string;
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
      'API address is not set. Set EXPO_PUBLIC_API_URL to your computer’s LAN IP, then restart Expo.',
    );
  }

  let response: Response;
  try {
    // Route login requests to the dedicated mobile endpoint to restrict roles
    const authEndpoint = action === 'login' ? 'login/mobile' : 'register';
    response = await fetch(`${API_BASE_URL}/api/auth/${authEndpoint}/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error(
      'Could not reach Django. Check that the server is running on port 8000 and both devices use the same Wi-Fi.',
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
    response = await fetch(`${API_BASE_URL}/api/auth/profile/sync/`, {
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

export async function fetchProfile(accessToken: string): Promise<AuthUser> {
  if (!API_BASE_URL) {
    throw new Error('API address is not set. Check EXPO_PUBLIC_API_URL and restart Expo.');
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/auth/profile/`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    throw new Error('Could not reach Django to fetch your profile. Check your network connection.');
  }

  const body = await responseBody(response) as (ApiErrorBody & Partial<AuthUser>) | null;
  if (!response.ok) {
    throw new Error(readableError(body as ApiErrorBody | null, `Failed to fetch profile (${response.status}).`));
  }

  if (!body?.id || !body?.username) {
    throw new Error('Django returned an incomplete profile response.');
  }

  return body as AuthUser;
}

export async function updateProfile(accessToken: string, payload: ProfileUpdatePayload): Promise<ProfileUpdateResponse> {
  if (!API_BASE_URL) {
    throw new Error('Django API address is not set. Check EXPO_PUBLIC_API_URL and restart Expo.');
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/auth/profile/update/`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error('Could not reach Django to update your profile. Check your network connection.');
  }

  const body = await responseBody(response) as (ApiErrorBody & Partial<ProfileUpdateResponse>) | null;
  if (!response.ok) {
    throw new Error(readableError(body, `Failed to update profile credentials (${response.status}).`));
  }

  if (!body?.user) {
    throw new Error('Django returned an incomplete profile update response.');
  }

  return body as ProfileUpdateResponse;
}

async function refreshSupabaseSession(session: AuthSession): Promise<AuthSession> {
  if (!API_BASE_URL) throw new Error('Django API address is not set. Check EXPO_PUBLIC_API_URL.');

  let refreshedResponse: Response;
  try {
    refreshedResponse = await fetch(`${API_BASE_URL}/api/auth/token/refresh/`, {
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
    tokenResponse = await fetch(`${API_BASE_URL}/api/auth/token/supabase/`, {
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

export async function fetchUserIncidents(accessToken: string): Promise<IncidentHistoryItem[]> {
  if (!API_BASE_URL) {
    throw new Error('Django API address is not set. Check EXPO_PUBLIC_API_URL.');
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/auth/incidents/`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    throw new Error('Could not reach Django to fetch incident history. Check your network connection.');
  }

  const body = await responseBody(response);
  if (!response.ok) {
    throw new Error(readableError(body as ApiErrorBody | null, `Failed to fetch incident history (${response.status}).`));
  }

  return (body as IncidentHistoryItem[]) || [];
}

export async function fetchUserIncidentsWithSession(
  session: AuthSession,
): Promise<{ incidents: IncidentHistoryItem[]; session: AuthSession }> {
  try {
    const incidents = await fetchUserIncidents(session.access);
    return { incidents, session };
  } catch (error) {
    if (error instanceof Error && (error.message.includes('401') || error.message.includes('Unauthorized'))) {
      const refreshedSession = await refreshSupabaseSession(session);
      const incidents = await fetchUserIncidents(refreshedSession.access);
      return { incidents, session: refreshedSession };
    }
    throw error;
  }
}

async function submitIncidentReportWithToken(
  session: AuthSession,
  payload: IncidentReportPayload,
): Promise<IncidentReportResponse> {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error('Supabase client settings are missing. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, then restart Expo.');
  }

  const effectiveToken = session.supabase_access_token || SUPABASE_PUBLISHABLE_KEY;

  const request = async (url: string, init?: RequestInit): Promise<Response> => {
    const headers = new Headers(init?.headers);
    headers.set('apikey', SUPABASE_PUBLISHABLE_KEY);
    headers.set('Authorization', `Bearer ${effectiveToken}`);
    try {
      return await fetch(url, { ...init, headers });
    } catch {
      throw new Error('Could not reach Supabase. Check your internet connection and the configured project URL.');
    }
  };

  const typeUrl = `${SUPABASE_URL}/rest/v1/incident_types?select=incident_types_id,incident_name`;
  const typeResponse = await request(typeUrl);
  const typeBody = await responseBody(typeResponse);
 
  if (!typeResponse.ok) {
    throw new SupabaseRestError(
      readableError(typeBody as ApiErrorBody | null, `Supabase incident type lookup failed (${typeResponse.status}).`),
      typeResponse.status,
    );
  }
 
  const types = typeBody as Array<{ incident_types_id?: number; incident_name?: string }> | null;
  const matchedType = types?.find(
    (t) => t.incident_name?.trim().toLowerCase() === payload.incident_type.trim().toLowerCase()
  );
  const incidentTypeId = matchedType?.incident_types_id;

  if (typeof incidentTypeId !== 'number') {
    throw new Error(`Incident type "${payload.incident_type}" not found in Supabase.`);
  }

  const incidentBody: Record<string, unknown> = {
    incident_types_id: incidentTypeId,
    description: payload.description,
    location_description: payload.location,
    user_id: session.user.id,
  };

  const createResponse = await request(`${SUPABASE_URL}/rest/v1/incident`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(incidentBody),
  });
  const createBody = await responseBody(createResponse);
  if (!createResponse.ok) {
    throw new SupabaseRestError(
      readableError(createBody as ApiErrorBody | null, `Supabase report submission failed (${createResponse.status}).`),
      createResponse.status,
    );
  }

  const created = (createBody as Array<Record<string, unknown>> | null)?.[0];
  const rawId = created?.incident_id ?? created?.id;
  const incidentId = Number(rawId);

  if (!Number.isSafeInteger(incidentId) || typeof (created?.status ?? 'pending') !== 'string') {
    throw new Error('Supabase did not return the saved incident confirmation.');
  }

  return {
    incident_id: incidentId,
    status: String(created?.status ?? 'Pending'),
    reported_at: typeof created?.reported_at === 'string' ? created.reported_at : null,
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
    if (session.supabase_access_token) {
      const refreshedSession = await refreshSupabaseSession(session);
      return {
        report: await submitIncidentReportWithToken(refreshedSession, payload),
        session: refreshedSession,
      };
    }
    throw error;
  }
}

export async function fetchLatestSensorData(): Promise<SensorDataResponse | null> {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error('Supabase client settings are missing.');
  }

  try {
    const url = `${SUPABASE_URL}/rest/v1/safe_sensor_data?select=temperature_c,humidity_percent,recorded_at&order=recorded_at.desc&limit=1`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    const body = await responseBody(response);
    if (!response.ok) {
      throw new SupabaseRestError(
        readableError(body as ApiErrorBody | null, `Failed to fetch sensor data (${response.status}).`),
        response.status,
      );
    }

    const data = body as Array<SensorDataResponse> | null;
    return data && data.length > 0 ? data[0] : null;
  } catch (error) {
    if (error instanceof SupabaseRestError) throw error;
    throw new Error('Could not reach Supabase to fetch sensor data.');
  }
}

export async function fetchIncidentTypes(): Promise<IncidentTypeRecord[]> {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error('Supabase client settings are missing.');
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/incident_types?select=incident_types_id,incident_name`, {
      method: 'GET',
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    const body = await responseBody(response);
    if (!response.ok) {
      throw new SupabaseRestError(
        readableError(body as ApiErrorBody | null, `Failed to fetch incident types (${response.status}).`),
        response.status,
      );
    }

    return (body as IncidentTypeRecord[]) || [];
  } catch (error) {
    console.error('fetchIncidentTypes error:', error);
    return [];
  }
}