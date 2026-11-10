import { useCallback, useEffect, useState } from 'react';
import { fetchAdminOverview, supabase } from './api';
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

const playAdminAlertSound = () => {
  try {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    audio.play().catch(() => {});
  } catch (e) {
    // Ignore audio autoplay restrictions if blocked by browser
  }
};

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
      const processedIncidents = mapIncidents(overview);
      const processedNotifs = mapNotifications(overview);

      setData((current) => {
        const fetchedIds = new Set(
          processedNotifs.map((n: any) => String(n.id || n.notification_id))
        );

        const localRealtimeNotifs = current.notifications.filter(
          (n: any) => !fetchedIds.has(String(n.id || n.notification_id))
        );

        return {
          incidents: processedIncidents,
          responders: mapResponders(overview),
          users: mapUsers(overview),
          logs: mapLogs(overview),
          notifications: [...localRealtimeNotifs, ...processedNotifs],
          loading: false,
          error: null,
        };
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
    let unsubscribeChannel: (() => void) | null = null;

    // Initial data fetch on mount
    void Promise.resolve().then(() => {
      if (active) return loadData(controller.signal);
      return undefined;
    });

    // Set up Realtime listener using fluent method chaining to avoid race conditions
    try {
      if (supabase) {
        const client = supabase;
        const channelName = `admin-realtime-channel-${Date.now()}`;

        const realTimeChannel = client
          .channel(channelName)
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'notification' },
            async (payload: any) => {
              console.log('⚡ NEW NOTIFICATION ARRIVED:', payload);
              if (!active) return;

              // 1. Re-fetch and re-map all overview data instantly
              await loadData();

              // 2. Play audio chime alert exactly once
              playAdminAlertSound();

              // 3. Notify header notification bell to bounce & increment unread counter
              window.dispatchEvent(
                new CustomEvent('safe:new-incident-alert', {
                  detail: payload.new,
                })
              );
            }
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'responder' },
            async (payload: any) => {
              console.log('⚡ RESPONDER STATUS UPDATED:', payload);
              if (!active) return;

              // Refresh overview data so responder availability updates instantly across dashboard & responders tab
              await loadData();
            }
          )
          .subscribe((status, err) => {
            console.log(`🔌 Supabase Realtime Status [${channelName}]:`, status);
            if (err) {
              console.error('❌ Supabase Realtime Subscription Error:', err);
            }
          });

        unsubscribeChannel = () => {
          try {
            void client.removeChannel(realTimeChannel);
          } catch (err) {
            // Teardown fallback
          }
        };
      }
    } catch (e) {
      console.warn('Could not set up realtime subscription', e);
    }

    return () => {
      active = false;
      controller.abort();
      unsubscribeChannel?.();
    };
  }, [loadData]);

  return data;
} 