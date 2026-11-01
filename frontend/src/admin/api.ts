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

function errorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    const data = body as Record<string, unknown>;
    if (typeof data.message === 'string') return data.message;
    if (typeof data.details === 'string') return data.details;
    if (typeof data.hint === 'string') return data.hint;
    if (typeof data.detail === 'string') return data.detail;
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
    incidents,
    incident_types,
    locations,
    responders,
    notifications,
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

export async function subscribeToIncidentInserts(
  onInsert: () => void,
  onError: (message: string) => void,
): Promise<() => void> {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error('Supabase client settings are missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.');
  }
  if (!localStorage.getItem('supabase_access_token')) {
    throw new Error('Django login succeeded, but Supabase access was not configured. Set SUPABASE_JWT_SECRET on the Django server and sign in again.');
  }

  const { createClient } = await import('@supabase/supabase-js');
  const client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    accessToken: async () => localStorage.getItem('supabase_access_token') ?? '',
  });
  const channel = client
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
    void client.removeChannel(channel);
  };
}

export function isSupabaseRequestError(error: string): boolean {
  return error.toLowerCase().includes('supabase');
}
