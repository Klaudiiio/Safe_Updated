import type { SupabaseOverview } from './data/liveData';

const SESSION_EXPIRED_EVENT = 'safe:admin-session-expired';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/auth';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.replace(/\/+$/, '');
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

let refreshRequest: Promise<string> | null = null;

class AdminSessionExpiredError extends Error {}

function expireAdminSession(): void {
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
}

// Initialize and export the Supabase client instance with robust WebSocket and Auth configuration
import { createClient } from '@supabase/supabase-js';
export const supabase = SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
      accessToken: async () => localStorage.getItem('supabase_access_token') ?? '',
    })
  : null;

function errorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    const data = body as Record<string, unknown>;
    if (typeof data.message === 'string') return data.message;
    if (typeof data.details === 'string') return data.details;
    if (typeof data.hint === 'string') return data.hint;
    if (typeof data.detail === 'string') return data.detail;
    if (typeof data.error === 'string') return data.error;
  }
  return fallback;
}

async function refreshSupabaseAccessToken(): Promise<string> {
  if (!refreshRequest) {
    refreshRequest = (async () => {
      const refresh = localStorage.getItem('refresh_token');
      if (!refresh) throw new Error('No refresh token is available.');

      const response = await fetch(`${API_BASE_URL}/token/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh }),
      });
      if (response.status === 400 || response.status === 401 || response.status === 403) {
        throw new AdminSessionExpiredError('The saved Django refresh token was rejected.');
      }
      if (!response.ok) {
        throw new Error(`Django could not refresh the admin session (${response.status}).`);
      }

      const refreshed = await response.json() as { access?: string; refresh?: string };
      if (!refreshed.access) throw new Error('Django returned no refreshed access token.');

      const tokenResponse = await fetch(`${API_BASE_URL}/token/supabase/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${refreshed.access}` },
      });
      const tokenBody = await tokenResponse.json().catch(() => null) as {
        supabase_access_token?: string;
        detail?: string;
      } | null;
      if (!tokenResponse.ok || !tokenBody?.supabase_access_token) {
        if (tokenResponse.status === 401 || tokenResponse.status === 403) {
          throw new AdminSessionExpiredError('Django rejected the refreshed admin session.');
        }
        throw new Error(tokenBody?.detail ?? `Django could not refresh Supabase access (${tokenResponse.status}).`);
      }

      localStorage.setItem('access_token', refreshed.access);
      if (refreshed.refresh) localStorage.setItem('refresh_token', refreshed.refresh);
      localStorage.setItem('supabase_access_token', tokenBody.supabase_access_token);
      return tokenBody.supabase_access_token;
    })().finally(() => {
      refreshRequest = null;
    });
  }
  return refreshRequest;
}

async function fetchSupabaseTable(
  tableAndQuery: string,
  signal?: AbortSignal,
): Promise<Record<string, unknown>[]> {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error('Supabase client settings are missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.');
  }
  let token = localStorage.getItem('supabase_access_token');
  if (!token) {
    throw new Error('Django login succeeded, but Supabase access was not configured. Set SUPABASE_JWT_SECRET on the Django server and sign in again.');
  }

  const request = async (accessToken: string) => {
    try {
      return await fetch(`${SUPABASE_URL}/rest/v1/${tableAndQuery}`, {
        headers: {
          apikey: SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${accessToken}`,
        },
        signal,
      });
    } catch {
      throw new Error('Could not reach Supabase. Check your internet connection and the configured project URL.');
    }
  };

  let response = await request(token);
  if (response.status === 401) {
    try {
      token = await refreshSupabaseAccessToken();
    } catch (error) {
      if (error instanceof AdminSessionExpiredError) {
        expireAdminSession();
        throw new Error('Your admin session expired. Please sign in again.');
      }
      throw error;
    }
    response = await request(token);
  }
  if (response.status === 401) {
    throw new Error('Supabase rejected the access token. Check that the Django signing secret matches the active Supabase JWT signing key.');
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(errorMessage(body, `Supabase data request failed (${response.status}).`));
  }
  if (!Array.isArray(body)) {
    throw new Error(`Supabase returned an invalid response for ${tableAndQuery}.`);
  }
  return body as Record<string, unknown>[];
}

export async function fetchAdminOverview(signal?: AbortSignal): Promise<SupabaseOverview> {
  const [
    rawIncidents,
    incident_types,
    locations,
    responders,
    rawNotifications,
    responder_notifications,
    logs,
    users,
  ] = await Promise.all([
    fetchSupabaseTable('incident?select=*&order=reported_at.desc&limit=500', signal),
    fetchSupabaseTable('incident_types?select=*', signal),
    fetchSupabaseTable('location?select=*', signal),
    fetchSupabaseTable('responder?select=responders_id,name,department,contact_number,availability_status,user_type', signal),
    fetchSupabaseTable('notification?select=*&order=sent_at.desc&limit=500', signal),
    fetchSupabaseTable('responder_notification?select=*', signal),
    fetchSupabaseTable('logs?select=*&order=action_time.desc&limit=500', signal),
    fetchSupabaseTable('user?select=user_id,name,student_id,course,phone_number,created_at,username,user_type', signal),
  ]);

  // Create lookup map for incident types
  const incidentTypeMap = new Map<string, any>();
  for (const it of incident_types) {
    const id = (it as any).incident_types_id ?? (it as any).id;
    if (id !== undefined) {
      incidentTypeMap.set(String(id), it);
    }
  }

  // Enrich incidents with their matching incident_types priority_level
  const incidents = rawIncidents.map((inc: any) => {
    const typeId = inc.incident_type_id ?? inc.incidentType_id ?? inc.type_id;
    const matchedType = typeId !== undefined ? incidentTypeMap.get(String(typeId)) : null;
    const priorityLevel = matchedType?.priority_level || inc.priority_level || inc.priority || 'MINOR';
    const isUrgent = String(priorityLevel).toUpperCase() === 'URGENT' || String(priorityLevel).toUpperCase() === 'CRITICAL';

    return {
      ...inc,
      incident_types: matchedType,
      priority_level: priorityLevel.toUpperCase(),
      priority: isUrgent ? 'critical' : 'minor',
    };
  });

  // Create lookup map for enriched incidents
  const incidentMap = new Map<string, any>();
  for (const inc of incidents) {
    const id = inc.incident_id ?? inc.id;
    if (id !== undefined) {
      incidentMap.set(String(id), inc);
    }
  }

  // Enrich notifications with their related incident & priority
  const notifications = rawNotifications.map((notif: any) => {
    const incId = notif.incident_id ?? notif.incidentId;
    const matchedIncident = incId !== undefined ? incidentMap.get(String(incId)) : null;
    const priorityLevel =
      matchedIncident?.priority_level ||
      notif.priority_level ||
      notif.priority ||
      'MINOR';

    const isUrgent = String(priorityLevel).toUpperCase() === 'URGENT' || String(priorityLevel).toUpperCase() === 'CRITICAL';

    return {
      ...notif,
      incident: matchedIncident,
      priority_level: priorityLevel.toUpperCase(),
      priority: isUrgent ? 'critical' : 'minor',
      isCritical: isUrgent,
    };
  });

  return {
    incidents,
    incident_types,
    locations,
    responders,
    notifications,
    responder_notifications,
    logs,
    users,
  };
}

export async function updateIncidentStatus(incidentId: string | number, status: string): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error('Supabase client settings are missing.');
  }
  let token = localStorage.getItem('supabase_access_token');
  if (!token) {
    throw new Error('Supabase access token is missing.');
  }

  const request = async (accessToken: string) => {
    try {
      let res = await fetch(`${SUPABASE_URL}/rest/v1/incident?incident_id=eq.${incidentId}`, {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
        body: JSON.stringify({ status: status.toLowerCase() }),
      });

      if (!res.ok && (res.status === 400 || res.status === 404)) {
        res = await fetch(`${SUPABASE_URL}/rest/v1/incident?id=eq.${incidentId}`, {
          method: 'PATCH',
          headers: {
            apikey: SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation',
          },
          body: JSON.stringify({ status: status.toLowerCase() }),
        });
      }

      return res;
    } catch {
      throw new Error('Could not reach Supabase. Check your internet connection and the configured project URL.');
    }
  };

  let response = await request(token);
  if (response.status === 401) {
    try {
      token = await refreshSupabaseAccessToken();
    } catch (error) {
      if (error instanceof AdminSessionExpiredError) {
        expireAdminSession();
        throw new Error('Your admin session expired. Please sign in again.');
      }
      throw error;
    }
    response = await request(token);
  }
  if (response.status === 401) {
    throw new Error('Supabase rejected the access token.');
  }
 
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(errorMessage(body, `Failed to update incident status (${response.status}).`));
  }
}

export async function createResponder(responderData: {
  username?: string;
  email?: string;
  password?: string;
  name: string;
  department: string;
  contact_number: string;
  availability_status?: string;
  user_type?: string;
  role?: string;
}): Promise<void> {
  const token = localStorage.getItem('access_token') || localStorage.getItem('clinic_staff_access_token');
  if (!token) {
    throw new Error('Admin access token is missing. Please sign in again.');
  }

  const response = await fetch(`${API_BASE_URL}/clinic-staff/create/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      username: responderData.username || (responderData.email ? responderData.email.split('@')[0] : undefined),
      email: responderData.email,
      password: responderData.password,
      name: responderData.name,
      department: responderData.department,
      contact_number: responderData.contact_number,
      availability_status: responderData.availability_status || 'available',
      role: responderData.role || responderData.user_type || 'Responder',
    }),
  });

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    throw new Error(errorMessage(body, `Failed to create responder or staff member (${response.status}).`));
  }
}

export async function createUser(userData: {
  name: string;
  username: string;
  course?: string;
  phone_number?: string;
  user_type?: string;
  student_id?: string;
}): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error('Supabase client settings are missing.');
  }
  let token = localStorage.getItem('supabase_access_token');
  if (!token) throw new Error('Supabase access token is missing.');

  const headers = {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  };

  const requestPost = async (accessToken: string) => {
    const uniqueUserId = Math.floor(Date.now() / 1000);
    const randomSuffix = Math.floor(Math.random() * 9000) + 1000;

    return await fetch(`${SUPABASE_URL}/rest/v1/user`, {
      method: 'POST',
      headers: { ...headers, Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        user_id: uniqueUserId,
        name: userData.name,
        username: userData.username || userData.name.toLowerCase().replace(/[^a-z0-9_]/g, '_') + '_' + randomSuffix,
        course: userData.course || 'General',
        phone_number: userData.phone_number || '',
        user_type: userData.user_type || 'user',
        student_id: userData.student_id || `ID-${randomSuffix}`,
      }),
    });
  };

  let response = await requestPost(token);
  if (response.status === 401) {
    token = await refreshSupabaseAccessToken();
    response = await requestPost(token);
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(errorMessage(body, `Failed to create user (${response.status}).`));
  }
}

export async function deleteUser(userId: string | number): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error('Supabase client settings are missing.');
  }
  let token = localStorage.getItem('supabase_access_token');
  if (!token) throw new Error('Supabase access token is missing.');

  const requestDelete = async (accessToken: string) => {
    let res = await fetch(`${SUPABASE_URL}/rest/v1/user?user_id=eq.${userId}`, {
      method: 'DELETE',
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${accessToken}`,
        'Prefer': 'return=representation',
      },
    });

    if (!res.ok && (res.status === 400 || res.status === 404)) {
      res = await fetch(`${SUPABASE_URL}/rest/v1/user?id=eq.${userId}`, {
        method: 'DELETE',
        headers: {
          apikey: SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${accessToken}`,
          'Prefer': 'return=representation',
        },
      });
    }

    return res;
  };

  let response = await requestDelete(token);
  if (response.status === 401) {
    token = await refreshSupabaseAccessToken();
    response = await requestDelete(token);
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(errorMessage(body, `Failed to delete user (${response.status}).`));
  }
}

export async function subscribeToIncidentInserts(
  onInsert: () => void,
  onError: (message: string) => void,
): Promise<() => void> {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY || !supabase) {
    throw new Error('Supabase client settings are missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.');
  }
  if (!localStorage.getItem('supabase_access_token')) {
    throw new Error('Django login succeeded, but Supabase access was not configured. Set SUPABASE_JWT_SECRET on the Django server and sign in again.');
  }

  const channel = supabase
    .channel('admin-incident-inserts')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'incident' },
      onInsert,
    )
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        onError(`Supabase Realtime subscription ${status.toLowerCase()}. Live updates may be delayed.`);
      }
    });

  return () => {
    void supabase.removeChannel(channel);
  };
}

export function isSupabaseRequestError(error: string): boolean {
  return error.toLowerCase().includes('supabase');
}