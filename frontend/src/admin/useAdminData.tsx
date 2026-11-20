import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

export interface EarthquakeAlertRecord {
  id: string;
  external_event_id: string;
  title?: string;
  message?: string;
  magnitude: number | null;
  place: string;
  distance_from_cdo_km: number | null;
  reported_intensity?: string | null;
  classification: string;
  source?: string;
  event_occurred_at?: string;
  evaluated_at?: string;
  alert_detected_at?: string | null;
  alert_expires_at?: string | null;
  alert_active?: boolean | null;
  acknowledged?: boolean | null;
}

interface AdminDataState {
  incidents: Incident[];
  responders: Responder[];
  users: LiveUser[];
  logs: IncidentLog[];
  notifications: LiveNotification[];
  earthquakeAlerts: EarthquakeAlertRecord[];
  activeEarthquakeAlerts: EarthquakeAlertRecord[];
  latestActiveEarthquakeAlert: EarthquakeAlertRecord | null;
  isEarthquakeAlertModalOpen: boolean;
  loading: boolean;
  error: string | null;
  updateIncidentStatus: (id: string | number, status: string) => Promise<void>;
  updateIncident: (id: string | number, updates: any) => Promise<void>;
  updateStatus: (id: string | number, status: string) => Promise<void>;
  deleteNotification: (id: string | number) => Promise<boolean>;
  clearAllNotifications: () => Promise<boolean>;
  markNotificationAsRead: (id: string | number) => Promise<void>;
  dismissEarthquakeAlert: (eventId: string) => void;
  acknowledgeEarthquakeAlert: (eventId: string) => Promise<boolean>;
  stopEarthquakeAlertAudio: () => void;
  refetch: () => Promise<void>;
}

const API_BASE_URL =
  (import.meta as any).env?.VITE_API_BASE_URL?.replace(/\/+$/, '') || '/api/auth';

export function getAlertExpiresAtMs(
  record: EarthquakeAlertRecord | null | undefined
): number | null {
  if (!record || !record.alert_expires_at) return null;
  const parsed = Date.parse(String(record.alert_expires_at));
  return Number.isFinite(parsed) ? parsed : null;
}

export function isEarthquakeAlertActive(
  record: EarthquakeAlertRecord | null | undefined,
  nowMs: number = Date.now(),
  dismissedIds: Set<string> = new Set()
): boolean {
  if (!record) return false;
  if (String(record.classification ?? '').trim().toLowerCase() !== 'earthquake_alert') {
    return false;
  }
  if (Boolean(record.acknowledged)) return false;
  if (record.alert_active === false) return false;

  const eventKey = String(record.external_event_id || record.id || '').trim();
  if (eventKey && dismissedIds.has(eventKey)) return false;

  const expiresAtMs = getAlertExpiresAtMs(record);
  if (expiresAtMs === null) return false;

  return nowMs < expiresAtMs;
}

const isAdminAudienceNotification = (row: any): boolean => {
  if (!row || typeof row !== 'object') return false;
  const audience = String(row.audience ?? '').trim().toLowerCase();
  if (!audience) return true;
  return audience === 'admin';
};

const isEarthquakeAlertPayload = (row: any): boolean => {
  if (!row || typeof row !== 'object') return false;
  const typeVal = String(row.type ?? '').trim().toLowerCase();
  const classVal = String(row.classification ?? '').trim().toLowerCase();
  return (
    typeVal === 'earthquake_alert' ||
    classVal === 'earthquake_alert' ||
    Boolean(row.earthquake_event_id)
  );
};

const normalizeEarthquakeAlert = (row: any): EarthquakeAlertRecord | null => {
  if (!row || typeof row !== 'object') return null;
  const eventId = String(
    row.earthquake_event_id || row.external_event_id || row.id || ''
  ).trim();
  if (!eventId) return null;

  const parsedMag =
    typeof row.magnitude === 'number'
      ? row.magnitude
      : row.magnitude != null && row.magnitude !== ''
      ? Number(row.magnitude)
      : null;

  const parsedDist =
    typeof row.distance_from_cdo_km === 'number'
      ? row.distance_from_cdo_km
      : row.distance_from_cdo_km != null && row.distance_from_cdo_km !== ''
      ? Number(row.distance_from_cdo_km)
      : null;

  return {
    id: String(row.notification_id ?? row.id ?? eventId),
    external_event_id: eventId,
    title:
      row.title ||
      `Earthquake Alert: ${parsedMag != null ? `M${parsedMag.toFixed(1)}` : 'Alert'} — ${
        row.place || 'Unknown Location'
      }`,
    message: row.message || row.description || '',
    magnitude: Number.isFinite(parsedMag as number) ? parsedMag : null,
    place: String(row.place || 'Unknown Location'),
    distance_from_cdo_km: Number.isFinite(parsedDist as number) ? parsedDist : null,
    reported_intensity: row.reported_intensity ?? null,
    classification: String(row.classification || 'earthquake_alert'),
    source: String(row.source || 'PHIVOLCS'),
    event_occurred_at: row.event_occurred_at || row.created_at,
    evaluated_at: row.evaluated_at || row.created_at,
    alert_detected_at: row.alert_detected_at ?? null,
    alert_expires_at: row.alert_expires_at ?? null,
    alert_active: typeof row.alert_active === 'boolean' ? row.alert_active : undefined,
    acknowledged: Boolean(row.acknowledged),
  };
};

export function useAdminData(): AdminDataState {
  const [data, setData] = useState<{
    incidents: Incident[];
    responders: Responder[];
    users: LiveUser[];
    logs: IncidentLog[];
    notifications: LiveNotification[];
    earthquakeAlerts: EarthquakeAlertRecord[];
    loading: boolean;
    error: string | null;
  }>({
    incidents: [],
    responders: [],
    users: [],
    logs: [],
    notifications: [],
    earthquakeAlerts: [],
    loading: true,
    error: null,
  });

  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [dismissedQuakeIds, setDismissedQuakeIds] = useState<Set<string>>(() => new Set());
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const playedAlertIdsRef = useRef<Set<string>>(new Set());

  const stopEarthquakeAlertAudio = useCallback(() => {
    try {
      const audio = audioElementRef.current;
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
    } catch {
      // Ignore audio pause errors
    }
  }, []);

  const playAdminAlertSound = useCallback((alertId?: string) => {
    try {
      stopEarthquakeAlertAudio();
      if (!audioElementRef.current) {
        audioElementRef.current = new Audio(
          'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'
        );
      }
      const audio = audioElementRef.current;
      audio.currentTime = 0;
      void audio.play().catch(() => {
        // Ignore browser autoplay restrictions
      });
      if (alertId) {
        playedAlertIdsRef.current.add(alertId);
      }
    } catch {
      // Ignore audio errors
    }
  }, [stopEarthquakeAlertAudio]);

  // 1-second tick while any unacknowledged, undismissed alert has a future alert_expires_at
  useEffect(() => {
    const hasPendingAlert = data.earthquakeAlerts.some((eq) => {
      if (String(eq.classification ?? '').trim().toLowerCase() !== 'earthquake_alert') {
        return false;
      }
      if (Boolean(eq.acknowledged) || eq.alert_active === false) return false;
      const key = String(eq.external_event_id || eq.id || '').trim();
      if (key && dismissedQuakeIds.has(key)) return false;
      const expiresAtMs = getAlertExpiresAtMs(eq);
      return expiresAtMs !== null && Date.now() < expiresAtMs;
    });

    setNowMs(Date.now());
    if (!hasPendingAlert) return;

    const tickInterval = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => clearInterval(tickInterval);
  }, [data.earthquakeAlerts, dismissedQuakeIds]);

  // Keep full history in `earthquakeAlerts`; filter active alerts by `isEarthquakeAlertActive`
  const activeEarthquakeAlerts = useMemo(() => {
    return data.earthquakeAlerts.filter((eq) =>
      isEarthquakeAlertActive(eq, nowMs, dismissedQuakeIds)
    );
  }, [data.earthquakeAlerts, nowMs, dismissedQuakeIds]);

  const latestActiveEarthquakeAlert =
    activeEarthquakeAlerts.length > 0 ? activeEarthquakeAlerts[0] : null;
  const isEarthquakeAlertModalOpen = Boolean(latestActiveEarthquakeAlert);

  // Stop audio immediately when no active alert remains (expired, dismissed, or acknowledged)
  useEffect(() => {
    if (!latestActiveEarthquakeAlert) {
      stopEarthquakeAlertAudio();
      return;
    }
    return () => {
      stopEarthquakeAlertAudio();
    };
  }, [latestActiveEarthquakeAlert, stopEarthquakeAlertAudio]);

  const dismissEarthquakeAlert = useCallback(
    (eventId: string) => {
      const cleanId = String(eventId || '').trim();
      stopEarthquakeAlertAudio();
      if (!cleanId) return;
      setDismissedQuakeIds((prev) => {
        const next = new Set(prev);
        next.add(cleanId);
        return next;
      });
    },
    [stopEarthquakeAlertAudio]
  );

  const acknowledgeEarthquakeAlert = useCallback(
    async (eventId: string): Promise<boolean> => {
      const cleanId = String(eventId || '').trim();
      if (!cleanId) return false;

      stopEarthquakeAlertAudio();
      setDismissedQuakeIds((prev) => {
        const next = new Set(prev);
        next.add(cleanId);
        return next;
      });

      setData((current) => ({
        ...current,
        earthquakeAlerts: current.earthquakeAlerts.map((eq) =>
          String(eq.external_event_id || eq.id) === cleanId
            ? { ...eq, acknowledged: true, alert_active: false }
            : eq
        ),
      }));

      try {
        const token =
          localStorage.getItem('access_token') ||
          localStorage.getItem('clinic_staff_access_token') ||
          '';
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }

        const res = await fetch(
          `${API_BASE_URL}/earthquakes/${encodeURIComponent(cleanId)}/acknowledge/`,
          {
            method: 'POST',
            headers,
          }
        );
        return res.ok;
      } catch {
        return false;
      }
    },
    [stopEarthquakeAlertAudio]
  );

  const loadData = useCallback(async (signal?: AbortSignal) => {
    try {
      const overview: SupabaseOverview = await fetchAdminOverview(signal);
      const processedIncidents = mapIncidents(overview);
      const processedNotifs = mapNotifications(overview).filter(isAdminAudienceNotification);

      setData((current) => {
        const fetchedIds = new Set(
          processedNotifs.map((n: any) => String(n.notification_id || n.id))
        );

        const localRealtimeNotifs = current.notifications.filter(
          (n: any) =>
            isAdminAudienceNotification(n) &&
            !fetchedIds.has(String(n.notification_id || n.id))
        );

        const mergedNotifications = [...localRealtimeNotifs, ...processedNotifs];
        const derivedEqAlerts = mergedNotifications
          .filter(isEarthquakeAlertPayload)
          .map(normalizeEarthquakeAlert)
          .filter((item): item is EarthquakeAlertRecord => item !== null);

        const eqMap = new Map<string, EarthquakeAlertRecord>();
        for (const item of [...current.earthquakeAlerts, ...derivedEqAlerts]) {
          const existing = eqMap.get(item.external_event_id);
          eqMap.set(item.external_event_id, {
            ...existing,
            ...item,
            alert_expires_at:
              item.alert_expires_at ?? existing?.alert_expires_at ?? null,
            alert_detected_at:
              item.alert_detected_at ?? existing?.alert_detected_at ?? null,
            acknowledged: Boolean(item.acknowledged || existing?.acknowledged),
          });
        }

        return {
          incidents: processedIncidents,
          responders: mapResponders(overview),
          users: mapUsers(overview),
          logs: mapLogs(overview),
          notifications: mergedNotifications,
          earthquakeAlerts: Array.from(eqMap.values()),
          loading: false,
          error: null,
        };
      });
      setNowMs(Date.now());
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setData((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : 'Unable to load dashboard data.',
      }));
    }
  }, []);

  const updateIncidentStatus = useCallback(async (id: string | number, status: string) => {
    try {
      if (!supabase) throw new Error('Supabase client not initialized');

      const { error: updateError } = await supabase
        .from('incidents')
        .update({ status })
        .eq('id', id);

      if (updateError) {
        const { error: altError } = await supabase
          .from('incident')
          .update({ status })
          .eq('incident_id', id);
        if (altError) throw altError;
      }

      await loadData();
    } catch (err) {
      console.error('Failed to update incident status in Supabase:', err);
    }
  }, [loadData]);

  const updateIncident = useCallback(async (id: string | number, updates: any) => {
    try {
      if (!supabase) throw new Error('Supabase client not initialized');

      const { error: updateError } = await supabase
        .from('incidents')
        .update(updates)
        .eq('id', id);

      if (updateError) throw updateError;
      await loadData();
    } catch (err) {
      console.error('Failed to update incident details:', err);
    }
  }, [loadData]);

  const deleteNotification = useCallback(async (id: string | number): Promise<boolean> => {
    try {
      if (!supabase) throw new Error('Supabase client not initialized');

      const { data: deletedRows, error } = await supabase
        .from('notification')
        .delete()
        .eq('notification_id', id)
        .select();

      if (error) throw error;
      if (!deletedRows || deletedRows.length === 0) {
        throw new Error('Deletion blocked by Supabase RLS policies or notification not found.');
      }

      setData((current) => ({
        ...current,
        notifications: current.notifications.filter(
          (n: any) => String(n.notification_id || n.id) !== String(id)
        ),
        earthquakeAlerts: current.earthquakeAlerts.filter((eq) => eq.id !== String(id)),
      }));
      return true;
    } catch (err) {
      console.error('Failed to delete notification:', err);
      return false;
    }
  }, []);

  const clearAllNotifications = useCallback(async (): Promise<boolean> => {
    try {
      if (!supabase) throw new Error('Supabase client not initialized');

      const { data: deletedRows, error } = await supabase
        .from('notification')
        .delete()
        .gt('notification_id', 0)
        .select();

      if (error) throw error;
      if (!deletedRows || deletedRows.length === 0) {
        throw new Error('Clear all blocked by Supabase RLS policies.');
      }

      setData((current) => ({
        ...current,
        notifications: [],
        earthquakeAlerts: [],
      }));
      return true;
    } catch (err) {
      console.error('Failed to clear all notifications:', err);
      return false;
    }
  }, []);

  const markNotificationAsRead = useCallback(async (id: string | number) => {
    try {
      if (!supabase) throw new Error('Supabase client not initialized');

      const { error } = await supabase
        .from('notification')
        .update({ status: 'read', is_read: true })
        .eq('notification_id', id);

      if (error) throw error;

      setData((current) => ({
        ...current,
        notifications: current.notifications.map((n: any) =>
          String(n.notification_id || n.id) === String(id)
            ? { ...n, unread: false, is_read: true, status: 'read' }
            : n
        ),
      }));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let currentChannel: any = null;

    void Promise.resolve().then(() => {
      if (active) return loadData(controller.signal);
      return undefined;
    });

    try {
      if (supabase) {
        const client = supabase;
        const channelName = `admin-global-realtime-${Math.random().toString(36).substring(2, 9)}`;

        currentChannel = client
          .channel(channelName)
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'notification' },
            async (payload: any) => {
              if (!active) return;

              const newRow = payload?.new;
              if (!isAdminAudienceNotification(newRow)) {
                return;
              }

              await loadData();

              if (isEarthquakeAlertPayload(newRow)) {
                const normalizedAlert = normalizeEarthquakeAlert(newRow);
                if (normalizedAlert) {
                  setNowMs(Date.now());
                  setData((current) => ({
                    ...current,
                    earthquakeAlerts: [
                      normalizedAlert,
                      ...current.earthquakeAlerts.filter(
                        (item) => item.external_event_id !== normalizedAlert.external_event_id
                      ),
                    ],
                  }));

                  if (
                    isEarthquakeAlertActive(normalizedAlert, Date.now(), dismissedQuakeIds) &&
                    !playedAlertIdsRef.current.has(normalizedAlert.external_event_id)
                  ) {
                    playAdminAlertSound(normalizedAlert.external_event_id);
                  }
                }
                window.dispatchEvent(
                  new CustomEvent('safe:new-earthquake-alert', {
                    detail: newRow,
                  })
                );
              } else {
                playAdminAlertSound();
              }

              window.dispatchEvent(
                new CustomEvent('safe:new-incident-alert', {
                  detail: newRow,
                })
              );
            }
          )
          .on(
            'postgres_changes',
            { event: 'DELETE', schema: 'public', table: 'notification' },
            async () => {
              if (!active) return;
              await loadData();
            }
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'earthquake_monitoring' },
            async (payload: any) => {
              if (!active) return;

              const eqRow = payload?.new;
              if (
                eqRow &&
                String(eqRow.classification || '').trim().toLowerCase() === 'earthquake_alert'
              ) {
                const normalizedAlert = normalizeEarthquakeAlert(eqRow);
                if (normalizedAlert) {
                  setNowMs(Date.now());
                  setData((current) => ({
                    ...current,
                    earthquakeAlerts: [
                      normalizedAlert,
                      ...current.earthquakeAlerts.filter(
                        (item) => item.external_event_id !== normalizedAlert.external_event_id
                      ),
                    ],
                  }));

                  if (
                    isEarthquakeAlertActive(normalizedAlert, Date.now(), dismissedQuakeIds) &&
                    !playedAlertIdsRef.current.has(normalizedAlert.external_event_id)
                  ) {
                    playAdminAlertSound(normalizedAlert.external_event_id);
                  } else if (!isEarthquakeAlertActive(normalizedAlert, Date.now(), dismissedQuakeIds)) {
                    stopEarthquakeAlertAudio();
                  }
                }
                window.dispatchEvent(
                  new CustomEvent('safe:new-earthquake-alert', {
                    detail: eqRow,
                  })
                );
              }
            }
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'responder' },
            async () => {
              if (!active) return;
              await loadData();
            }
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'incidents' },
            async () => {
              if (!active) return;
              await loadData();
            }
          );

        currentChannel.subscribe((status: string, err: any) => {
          console.log(`🔌 Supabase Realtime Status [${channelName}]:`, status);
          if (err) {
            console.error('❌ Supabase Realtime Subscription Error:', err);
          }
        });
      }
    } catch (e) {
      console.warn('Could not set up realtime subscription', e);
    }

    return () => {
      active = false;
      controller.abort();
      stopEarthquakeAlertAudio();
      if (currentChannel && supabase) {
        try {
          void supabase.removeChannel(currentChannel);
        } catch {
          // Cleanup ignore
        }
      }
    };
  }, [dismissedQuakeIds, loadData, playAdminAlertSound, stopEarthquakeAlertAudio]);

  return {
    ...data,
    activeEarthquakeAlerts,
    latestActiveEarthquakeAlert,
    isEarthquakeAlertModalOpen,
    updateIncidentStatus,
    updateIncident,
    updateStatus: updateIncidentStatus,
    deleteNotification,
    clearAllNotifications,
    markNotificationAsRead,
    dismissEarthquakeAlert,
    acknowledgeEarthquakeAlert,
    stopEarthquakeAlertAudio,
    refetch: loadData,
  };
}