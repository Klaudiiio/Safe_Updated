import { useCallback, useEffect, useState } from 'react';
import { fetchAdminOverview, subscribeToIncidentInserts } from './api';
import {
  mapIncidents,
  mapLogs,
  mapNotifications,
  mapResponders,
  mapUsers,
  type LiveNotification,
  type LiveUser,
  type SupabaseOverview,
} from './data/liveData';
import type { Incident, IncidentLog, Responder } from './data/mockData';

interface AdminDataState {
  incidents: Incident[];
  responders: Responder[];
  users: LiveUser[];
  logs: IncidentLog[];
  notifications: LiveNotification[];
  loading: boolean;
  error: string | null;
}

export function useAdminData(): AdminDataState {
  const [data, setData] = useState<AdminDataState>({
    incidents: [],
    responders: [],
    users: [],
    logs: [],
    notifications: [],
    loading: true,
    error: null,
  });

  const loadData = useCallback(async (signal?: AbortSignal) => {
    try {
      const overview: SupabaseOverview = await fetchAdminOverview(signal);
      setData({
        incidents: mapIncidents(overview),
        responders: mapResponders(overview),
        users: mapUsers(overview),
        logs: mapLogs(overview),
        notifications: mapNotifications(overview),
        loading: false,
        error: null,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setData((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : 'Unable to load dashboard data.',
      }));
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let unsubscribe: (() => void) | null = null;
    void Promise.resolve().then(() => {
      if (active) return loadData(controller.signal);
      return undefined;
    });
    void Promise.resolve()
      .then(() => subscribeToIncidentInserts(
        () => void loadData(),
        (message) => setData((current) => ({ ...current, error: message })),
      ))
      .then((cleanup) => {
        if (active) unsubscribe = cleanup;
        else cleanup();
      })
      .catch((error: unknown) => {
        if (!active) return;
        setData((current) => ({
          ...current,
          error: error instanceof Error ? error.message : 'Could not subscribe to Supabase Realtime.',
        }));
      });
    const intervalId = window.setInterval(() => void loadData(), 15_000);
    return () => {
      active = false;
      controller.abort();
      unsubscribe?.();
      window.clearInterval(intervalId);
    };
  }, [loadData]);

  return data;
}
