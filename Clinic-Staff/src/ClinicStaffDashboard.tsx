import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import {
  Activity,
  Bell,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  LogOut,
  Menu,
  Search,
  ShieldAlert,
  AlertTriangle,
  Stethoscope,
  X,
  ChevronDown,
  Filter,
  MapPin,
  Lock,
  Mail,
  Phone,
  Users,
  UserCheck,
  UserPlus,
  ExternalLink,
  Volume2,
  RefreshCw
} from 'lucide-react';

interface StaffDashboardProps {
  displayName: string;
  onLogout: () => void;
}

interface IncidentReport {
  incident_id: number;
  description?: string;
  location_description?: string;
  status?: string;
  reported_at?: string;
  incident_types_id?: number;
  incident_name?: string;
  user_id?: number;
  reporter_name?: string;
  assigned_responder_id?: number;
  assigned_responder_name?: string;
}

interface Responder {
  responder_id?: number;
  id?: number;
  name: string;
  availability_status: string;
  user_type?: string;
  contact_number?: string;
  email?: string;
}

interface NotificationItem {
  id: string | number;
  title: string;
  message: string;
  time: string;
  type: string;
  unread: boolean;
  incidentId?: number;
}

interface EarthquakeEvent {
  id: string;
  magnitude: number;
  place: string;
  time: number;
  url: string;
  depth_km: number;
  distance_from_cdo_km: number;
  source: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/auth';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.replace(/\/+$/, '');
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function refreshSupabaseToken(): Promise<string> {
  const djangoAccessToken = localStorage.getItem('clinic_staff_access_token');
  if (!djangoAccessToken) throw new Error('Django access token missing. Please sign in again.');

  const res = await fetch(`${API_BASE_URL}/token/supabase/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${djangoAccessToken}`,
    },
  });

  if (!res.ok) {
    throw new Error('Failed to refresh Supabase access token.');
  }

  const data = await res.json();
  const newToken = data.supabase_access_token;
  if (!newToken) throw new Error('No Supabase token returned from server.');

  localStorage.setItem('clinic_staff_supabase_token', newToken);
  return newToken;
}

async function supabaseRequest(path: string, options: RequestInit = {}): Promise<any> {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Supabase is not configured.');

  let token = localStorage.getItem('clinic_staff_supabase_token');
  if (!token) {
    token = await refreshSupabaseToken();
  }

  const executeFetch = async (authToken: string) => {
    return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      ...options,
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
        ...options.headers,
      },
    });
  };

  let response = await executeFetch(token);

  if (response.status === 401) {
    try {
      const freshToken = await refreshSupabaseToken();
      response = await executeFetch(freshToken);
    } catch {
      throw new Error('Your session has expired. Please sign in again.');
    }
  }

  if (!response.ok) {
    const body = await response.text();
    try {
      const parsed = JSON.parse(body);
      if (parsed.message === 'JWT expired' || parsed.code === 'PGRST303') {
        throw new Error('Supabase JWT expired.');
      }
      throw new Error(parsed.message || body);
    } catch (e) {
      throw new Error(body || `Supabase request failed (${response.status}).`);
    }
  }

  return response.status === 204 ? null : response.json();
}

export default function ClinicStaffDashboard({ displayName, onLogout }: StaffDashboardProps) {
  const [incidents, setIncidents] = useState<IncidentReport[]>([]);
  const [responders, setResponders] = useState<Responder[]>([]);
  const [earthquakes, setEarthquakes] = useState<EarthquakeEvent[]>([]);
  const [dismissedQuakeIds, setDismissedQuakeIds] = useState<string[]>([]);

  // Audio alert state. The first normal interaction unlocks future sound playback
  // in browsers that block autoplay until the user interacts with the page.
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUnlockedRef = useRef(false);
  const pendingQuakeAudioIdRef = useRef<string | null>(null);
  const audioHandledQuakeIdsRef = useRef<Set<string>>(new Set());
  const latestQuakeAlertRef = useRef<EarthquakeEvent | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadingEarthquakes, setLoadingEarthquakes] = useState(false);
  const [submittingAssignment, setSubmittingAssignment] = useState(false);
  const [error, setError] = useState('');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'assignments' | 'accepted' | 'roster' | 'schedule'>('dashboard');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Modals State
  const [selectedIncidentForUpdate, setSelectedIncidentForUpdate] = useState<IncidentReport | null>(null);
  const [selectedResponderIdForModal, setSelectedResponderIdForModal] = useState<number>(0);
  const [selectedResponderForDetails, setSelectedResponderForDetails] = useState<Responder | null>(null);
  const [selectedEarthquakeForDetails, setSelectedEarthquakeForDetails] = useState<EarthquakeEvent | null>(null);

  // Profile Edit States
  const [editableName] = useState(displayName);
  const [editableRole] = useState('Clinic Dispatch & Roster Coordinator');
  const [editableEmail] = useState('clinic.dispatch@ustp.edu.ph');
  const [editablePhone] = useState('+63 912 345 6789');

  // Filter & Search States
  const [feedStatusFilter, setFeedStatusFilter] = useState<'all' | 'pending' | 'active' | 'assigned'>('all');
  const [rosterFilter, setRosterFilter] = useState<'all' | 'available' | 'busy' | 'offline'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Live Date and Time State
  const [currentDateTime, setCurrentDateTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        // click outside handled
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      let rawIncidents: any[] = [];
      try {
        const queryWithRelations = 'incident_id,description,location_description,status,reported_at,user_id,incident_types_id,incident_types(incident_name)';
        rawIncidents = await supabaseRequest(`incident?select=${queryWithRelations}&order=reported_at.desc`);
      } catch {
        try {
          rawIncidents = await supabaseRequest('incident?select=*,incident_types(incident_name)&order=reported_at.desc');
        } catch {
          rawIncidents = await supabaseRequest('incident?select=*');
        }
      }

      let rawResponders: any[] = [];
      try {
        rawResponders = await supabaseRequest('responder?select=*');
      } catch (err) {
        console.error('Failed to load responder roster:', err);
      }
      setResponders(rawResponders || []);

      const assignmentMap: Record<number, number> = {};
      try {
        const notifAssignments = await supabaseRequest('responder_notification?select=incident_id,responder_id');
        if (Array.isArray(notifAssignments)) {
          notifAssignments.forEach((n: any) => {
            if (n.incident_id && n.responder_id) {
              assignmentMap[n.incident_id] = n.responder_id;
            }
          });
        }
      } catch {}

      const usernameMap: Record<number, string> = {};
      try {
        const allUsers = await supabaseRequest('user?select=*');
        if (Array.isArray(allUsers)) {
          allUsers.forEach((u: any) => {
            const uid = u.user_id ?? u.id;
            const uname = u.username || u.name;
            if (uid && uname) usernameMap[uid] = uname;
          });
        }
      } catch {
        try {
          const allUsersAlt = await supabaseRequest('users?select=*');
          if (Array.isArray(allUsersAlt)) {
            allUsersAlt.forEach((u: any) => {
              const uid = u.user_id ?? u.id;
              const uname = u.username || u.name;
              if (uid && uname) usernameMap[uid] = uname;
            });
          }
        } catch {}
      }

      const responderMap: Record<number, string> = {};
      (rawResponders || []).forEach((resp: any) => {
        const rid = resp.responder_id ?? resp.id;
        if (rid) responderMap[rid] = resp.name;
      });

      const formattedIncidents: IncidentReport[] = (rawIncidents || []).map((row: any) => {
        const lookupName = row.user_id ? usernameMap[row.user_id] : undefined;
        const resolvedReporterName = lookupName || row.user_name || (row.user_id ? `User #${row.user_id}` : 'Anonymous User');

        const assignedId = row.assigned_responder_id ?? assignmentMap[row.incident_id];
        const assignedName = assignedId ? responderMap[assignedId] : undefined;

        const resolvedIncidentName = row.incident_types?.incident_name || row.incident_name || `Medical Assistance #${row.incident_types_id || 'General'}`;

        return {
          ...row,
          incident_name: resolvedIncidentName,
          reporter_name: resolvedReporterName,
          assigned_responder_id: assignedId,
          assigned_responder_name: assignedName,
        };
      });

      setIncidents(formattedIncidents);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load incident reports and roster.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadEarthquakes = useCallback(async (showLoading = true) => {
    if (showLoading) setLoadingEarthquakes(true);
    try {
      const token = localStorage.getItem('clinic_staff_access_token');
      const res = await fetch(`${API_BASE_URL}/earthquakes/`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        // Keep locally generated test events visible while real earthquake data refreshes.
        setEarthquakes((previous) => [
          ...(data.events || []),
          ...previous.filter((event) => event.source === 'Simulation Test'),
        ]);
      }
    } catch (err) {
      console.error('Failed to load earthquake feed:', err);
    } finally {
      if (showLoading) setLoadingEarthquakes(false);
    }
  }, []);

  // Add a local-only earthquake event to test the existing alert modal and audio.
  // This does not call the backend or create a real earthquake record.
  const handleTestEarthquake = useCallback(() => {
    const testId = `manual-test-${Date.now()}`;
    const testEarthquake: EarthquakeEvent = {
      id: testId,
      magnitude: 6.2,
      place: 'Test Seismic Zone, Philippines',
      time: Date.now(),
      url: 'https://earthquake.usgs.gov/',
      depth_km: 15,
      distance_from_cdo_km: 20,
      source: 'Simulation Test',
    };

    setDismissedQuakeIds((previous) => previous.filter((id) => id !== testId));
    setEarthquakes((previous) => [
      testEarthquake,
      ...previous.filter((event) => event.source !== 'Simulation Test'),
    ]);
  }, []);

  // Refresh incident reports once per minute, but check the earthquake feed
  // every 10 seconds so new alerts are detected sooner.
  useEffect(() => {
    void loadData();
    void loadEarthquakes();

    const dataPolling = setInterval(() => {
      void loadData();
    }, 60 * 1000);

    const earthquakePolling = setInterval(() => {
      // Silent background refresh; keep the manual refresh icon from flashing.
      void loadEarthquakes(false);
    }, 10 * 1000);

    return () => {
      clearInterval(dataPolling);
      clearInterval(earthquakePolling);
    };
  }, [loadData, loadEarthquakes]);

  // Supabase Realtime Subscription for instant Incident Feed updates
  useEffect(() => {
    if (!SUPABASE_URL || !SUPABASE_KEY) return;
    const wsProtocol = SUPABASE_URL.startsWith('https') ? 'wss://' : 'ws://';
    const cleanHost = SUPABASE_URL.replace(/^https?:\/\//, '');
    const realtimeUrl = `${wsProtocol}${cleanHost}/realtime/v1/websocket?apikey=${SUPABASE_KEY}&vsn=1.0.0`;

    let socket: WebSocket | null = null;
    try {
      socket = new WebSocket(realtimeUrl);
      socket.onopen = () => {
        socket?.send(JSON.stringify({
          topic: 'realtime:public:incident',
          event: 'phx_join',
          payload: { config: { postgres_changes: [{ event: '*', schema: 'public', table: 'incident' }] } },
          ref: '1'
        }));
      };
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.event === 'postgres_changes') {
            void loadData();
          }
        } catch {}
      };
    } catch (err) {
      console.warn('Realtime socket connection failed, relying on polling:', err);
    }

    return () => {
      if (socket) socket.close();
    };
  }, [loadData]);

  // Derive active recent earthquake (within 24 hours, magnitude >= 4.0 or within 300km)
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const currentTimestamp = new Date().getTime();

  const activeEarthquakeAlerts = useMemo(() => {
    return earthquakes.filter((eq) => {
      const isWithin24Hours = currentTimestamp - eq.time <= ONE_DAY_MS;
      const meetsCriteria = eq.magnitude >= 4.0 || eq.distance_from_cdo_km <= 300;
      const notDismissed = !dismissedQuakeIds.includes(eq.id);
      return isWithin24Hours && meetsCriteria && notDismissed;
    });
  }, [earthquakes, dismissedQuakeIds, currentTimestamp]);

  // Select the most recent qualifying event, regardless of the API's array order.
  const latestQuakeAlert = activeEarthquakeAlerts.reduce<EarthquakeEvent | null>(
    (latest, quake) => (!latest || quake.time > latest.time ? quake : latest),
    null
  );
  latestQuakeAlertRef.current = latestQuakeAlert;

  const stopEarthquakeAudio = useCallback(() => {
    pendingQuakeAudioIdRef.current = null;
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
  }, []);

  const playEarthquakeAudio = useCallback((quakeId: string) => {
    const audio = audioRef.current;
    if (!audio) return;

    // Save the alert until the browser permits sound playback after user interaction.
    if (!audioUnlockedRef.current) {
      pendingQuakeAudioIdRef.current = quakeId;
      return;
    }

    audio.muted = false;
    audio.loop = true;
    audio.currentTime = 0;
    void audio.play().then(() => {
      if (pendingQuakeAudioIdRef.current === quakeId) {
        pendingQuakeAudioIdRef.current = null;
      }
    }).catch((err) => {
      pendingQuakeAudioIdRef.current = quakeId;
      audioUnlockedRef.current = false;
      console.warn('Earthquake audio is waiting for a user interaction:', err);
    });
  }, []);

  // Play once for each newly displayed earthquake. Older alerts revealed after
  // dismissing the current one will not restart the siren.
  useEffect(() => {
    if (!latestQuakeAlert) {
      stopEarthquakeAudio();
      return;
    }

    if (audioHandledQuakeIdsRef.current.has(latestQuakeAlert.id)) return;
    audioHandledQuakeIdsRef.current.add(latestQuakeAlert.id);
    playEarthquakeAudio(latestQuakeAlert.id);
  }, [latestQuakeAlert?.id, playEarthquakeAudio, stopEarthquakeAudio]);

  // Browsers block audible autoplay until the user interacts with the page.
  // A muted play/pause primes the audio element; when an alert is already
  // waiting, the first non-dismiss interaction starts its sound directly.
  const handleAudioUserGesture = useCallback((event: any) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest?.('[data-earthquake-dismiss="true"]')) return;

    const audio = audioRef.current;
    if (!audio || audioUnlockedRef.current) return;

    const pendingId = pendingQuakeAudioIdRef.current;
    if (pendingId && latestQuakeAlertRef.current?.id === pendingId) {
      audio.muted = false;
      audio.loop = true;
      audio.currentTime = 0;
      void audio.play().then(() => {
        audioUnlockedRef.current = true;
        pendingQuakeAudioIdRef.current = null;
      }).catch((err) => {
        console.warn('Unable to start earthquake audio after user interaction:', err);
      });
      return;
    }

    audio.muted = true;
    audio.loop = false;
    void audio.play().then(() => {
      audio.pause();
      audio.currentTime = 0;
      audio.muted = false;
      audioUnlockedRef.current = true;

      // An earthquake may have arrived while the muted audio was being primed.
      const waitingId = pendingQuakeAudioIdRef.current;
      if (waitingId && latestQuakeAlertRef.current?.id === waitingId) {
        audio.loop = true;
        audio.currentTime = 0;
        void audio.play().then(() => {
          pendingQuakeAudioIdRef.current = null;
        }).catch((err) => {
          console.warn('Unable to start the pending earthquake audio:', err);
        });
      }
    }).catch(() => {
      audio.muted = false;
    });
  }, []);

  // Combined Notifications (Incidents + Earthquakes)
  useEffect(() => {
    const now = Date.now();
    const incidentNotifs: NotificationItem[] = incidents.map((inc: IncidentReport) => {
      const statusLower = (inc.status || 'pending').toLowerCase();
      let title = `Incident #${inc.incident_id}`;
      let type = 'info';

      if (statusLower === 'active' || statusLower === 'critical') {
        type = 'critical';
      } else if (['assigned', 'accepted', 'responding'].includes(statusLower)) {
        type = 'assigned';
      } else if (['resolved', 'completed'].includes(statusLower)) {
        type = 'success';
      }

      let timeStr = 'Recently';
      if (inc.reported_at) {
        const diffMins = Math.floor((now - new Date(inc.reported_at).getTime()) / (1000 * 60));
        if (diffMins < 1) timeStr = 'Just now';
        else if (diffMins < 60) timeStr = `${diffMins} mins ago`;
        else if (diffMins < 1440) timeStr = `${Math.floor(diffMins / 60)} hrs ago`;
        else timeStr = new Date(inc.reported_at).toLocaleDateString();
      }

      return {
        id: `inc-${inc.incident_id}`,
        title,
        message: `${inc.incident_name} at ${inc.location_description || 'Campus'} reported by ${inc.reporter_name}.`,
        time: timeStr,
        type,
        unread: statusLower === 'pending' || statusLower === 'active',
        incidentId: inc.incident_id,
      };
    });

    const earthquakeNotifs: NotificationItem[] = earthquakes
      .filter((eq) => now - eq.time <= ONE_DAY_MS && (eq.magnitude >= 4.0 || eq.distance_from_cdo_km <= 300))
      .map((eq) => ({
        id: `eq-${eq.id}`,
        title: `⚠️ Earthquake Reported (Mag ${eq.magnitude.toFixed(1)})`,
        message: `${eq.place} — ${eq.distance_from_cdo_km} km from CDO (Depth: ${eq.depth_km} km). Drop, Cover, and Hold On.`,
        time: 'Recent',
        type: 'critical',
        unread: true,
      }));

    setNotifications([...earthquakeNotifs, ...incidentNotifs]);
  }, [incidents, earthquakes]);

  const updateResponderAvailability = async (responder: Responder, newStatus: string) => {
    const rid = responder.responder_id ?? responder.id;
    if (!rid) return;

    const filterCol = responder.responder_id ? 'responder_id' : 'id';
    setError('');

    try {
      await supabaseRequest(
        `responder?${filterCol}=eq.${rid}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ availability_status: newStatus }),
        }
      );

      if (selectedResponderForDetails && (selectedResponderForDetails.responder_id ?? selectedResponderForDetails.id) === rid) {
        setSelectedResponderForDetails({ ...selectedResponderForDetails, availability_status: newStatus });
      }
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update responder availability status.');
    }
  };

  const handleSaveIncidentAssignment = async (incident: IncidentReport, newStatus: string, responderId: number) => {
    setSubmittingAssignment(true);
    setError('');

    try {
      await supabaseRequest(
        `incident?incident_id=eq.${incident.incident_id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status: newStatus }),
        }
      );

      if (responderId > 0 && responderId !== incident.assigned_responder_id) {
        const chosenResponder = responders.find(r => (r.responder_id ?? r.id) === responderId);
        try {
          await supabaseRequest('responder_notification', {
            method: 'POST',
            body: JSON.stringify({
              responder_id: responderId,
              incident_id: incident.incident_id,
              message: `Assigned to Incident #${incident.incident_id} (${incident.incident_name}) at ${incident.location_description || 'Campus'}.`,
              is_read: false,
            }),
          });
        } catch {
          await supabaseRequest('responder_notification', {
            method: 'POST',
            body: JSON.stringify({
              responder_id: responderId,
              incident_id: incident.incident_id,
            }),
          });
        }

        if (chosenResponder && ['assigned', 'active'].includes(newStatus.toLowerCase())) {
          await updateResponderAvailability(chosenResponder, 'busy');
        }
      }

      if (newStatus.toLowerCase() === 'resolved' && responderId > 0) {
        const chosenResponder = responders.find(r => (r.responder_id ?? r.id) === responderId);
        if (chosenResponder) {
          await updateResponderAvailability(chosenResponder, 'available');
        }
      }

      setSelectedIncidentForUpdate(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update incident and assign responder.');
    } finally {
      setSubmittingAssignment(false);
    }
  };

  const openManageModal = (item: IncidentReport) => {
    setSelectedIncidentForUpdate(item);
    setSelectedResponderIdForModal(item.assigned_responder_id || 0);
  };

  // Case-insensitive filtering excluding resolved/completed cases for active operational feed
  const activeOperationalIncidents = useMemo(() => {
    return incidents.filter((item) => {
      const s = (item.status || 'pending').toLowerCase();
      return s !== 'resolved' && s !== 'completed';
    });
  }, [incidents]);

  const prioritizedAndFilteredIncidents = useMemo(() => {
    let list = [...activeOperationalIncidents];
    if (feedStatusFilter !== 'all') {
      list = list.filter((item) => {
        const s = (item.status || 'pending').toLowerCase();
        if (feedStatusFilter === 'assigned') return ['assigned', 'accepted', 'responding'].includes(s);
        return s === feedStatusFilter;
      });
    }

    if (searchQuery.trim()) {
      const queryTerms = searchQuery.toLowerCase().trim().split(/\s+/);
      list = list.filter((item) => {
        const idStr = String(item.incident_id);
        const typeStr = (item.incident_name ?? '').toLowerCase();
        const reporterStr = (item.reporter_name ?? '').toLowerCase();
        const locStr = (item.location_description ?? '').toLowerCase();
        const assignedStr = (item.assigned_responder_name ?? '').toLowerCase();
        const statusStr = (item.status ?? '').toLowerCase();

        return queryTerms.every((term) =>
          idStr.includes(term) ||
          typeStr.includes(term) ||
          reporterStr.includes(term) ||
          locStr.includes(term) ||
          assignedStr.includes(term) ||
          statusStr.includes(term)
        );
      });
    }

    // Sort incidents by reported_at newest-first
    return list.sort((a, b) => {
      const timeA = a.reported_at ? new Date(a.reported_at).getTime() : 0;
      const timeB = b.reported_at ? new Date(b.reported_at).getTime() : 0;
      return timeB - timeA;
    });
  }, [activeOperationalIncidents, feedStatusFilter, searchQuery]);

  const filteredIncidents = useMemo(() => {
    if (!searchQuery.trim()) return incidents;
    const queryTerms = searchQuery.toLowerCase().trim().split(/\s+/);
    return incidents.filter((item) => {
      const idStr = String(item.incident_id);
      const typeStr = (item.incident_name ?? '').toLowerCase();
      const reporterStr = (item.reporter_name ?? '').toLowerCase();
      const locStr = (item.location_description ?? '').toLowerCase();
      const assignedStr = (item.assigned_responder_name ?? '').toLowerCase();

      return queryTerms.every((term) =>
        idStr.includes(term) ||
        typeStr.includes(term) ||
        reporterStr.includes(term) ||
        locStr.includes(term) ||
        assignedStr.includes(term)
      );
    });
  }, [incidents, searchQuery]);

  const filteredResponders = useMemo(() => {
    if (rosterFilter === 'all') return responders;
    return responders.filter((r) => (r.availability_status || 'offline').toLowerCase() === rosterFilter);
  }, [responders, rosterFilter]);

  const availableRespondersList = useMemo(() => {
    return responders.filter((r) => (r.availability_status || '').toLowerCase() === 'available');
  }, [responders]);

  const pendingCount = incidents.filter((row) => (row.status?.toLowerCase() ?? 'pending') === 'pending').length;
  const activeCount = incidents.filter((row) => (row.status?.toLowerCase() ?? '') === 'active').length;
  const assignedCount = incidents.filter((row) => ['assigned', 'accepted', 'responding'].includes(row.status?.toLowerCase() ?? '')).length;

  const acceptedIncidents = incidents.filter((row) => {
    const s = row.status?.toLowerCase() ?? '';
    return ['assigned', 'accepted', 'responding', 'active'].includes(s);
  });

  const unreadCount = notifications.filter(n => n.unread).length;
  const initials = editableName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div
      onPointerDownCapture={handleAudioUserGesture}
      onKeyDownCapture={handleAudioUserGesture}
      className="min-h-screen bg-gradient-to-br from-[#F0F6FF] via-[#E0F2FE] to-[#BAE6FD] text-slate-800 flex flex-col md:flex-row antialiased"
    >
      {/* Hidden Audio Element */}
      <audio ref={audioRef} src="/earthquake-alert.mp3" preload="auto" loop />

      {/* CENTERED EARTHQUAKE ALERT MODAL CARD */}
      {latestQuakeAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-[#2a0808] text-white rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl border border-red-600/50 flex flex-col items-center text-center relative overflow-hidden">

            <div className="w-20 h-20 bg-[#ffeb99] rounded-full flex items-center justify-center shadow-lg shadow-red-950/50 mb-5 animate-bounce">
              <AlertTriangle className="w-10 h-10 text-amber-700 stroke-[2.5]" />
            </div>

            <h2 className="text-2xl font-black tracking-wider text-amber-400 mb-2">
              EARTHQUAKE ALERT!
            </h2>
            <p className="text-base font-bold text-white mb-1">
              Mag {latestQuakeAlert.magnitude.toFixed(1)} — {latestQuakeAlert.place}
            </p>
            <p className="text-xs font-medium text-red-200/80 mb-6">
              {latestQuakeAlert.distance_from_cdo_km} km from CDO | Depth: {latestQuakeAlert.depth_km} km
            </p>

            <div className="w-full bg-[#180404] rounded-2xl p-4 mb-6 border border-red-900/60 text-center">
              <h4 className="text-xs font-black uppercase tracking-widest text-amber-400 mb-2">
                Drop, Cover, and Hold On
              </h4>
              <p className="text-xs text-red-100/90 leading-relaxed">
                Drop to your hands and knees; take cover under sturdy furniture and protect your head and neck; hold on until the shaking stops.
              </p>
            </div>

            {latestQuakeAlert.url && (
              <a
                href={latestQuakeAlert.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-bold text-sky-400 hover:text-sky-300 underline underline-offset-4 flex items-center space-x-1.5 mb-6 transition"
              >
                <span>View USGS / PHIVOLCS Report</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}

            <button
              data-earthquake-dismiss="true"
              onClick={() => {
                // Mark every alert already in this batch as handled so switching
                // to an older alert does not restart the sound after Dismiss.
                activeEarthquakeAlerts.forEach((quake) => {
                  audioHandledQuakeIdsRef.current.add(quake.id);
                });
                stopEarthquakeAudio();
                setDismissedQuakeIds((prev) =>
                  prev.includes(latestQuakeAlert.id) ? prev : [...prev, latestQuakeAlert.id]
                );
              }}
              className="w-full py-3.5 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white rounded-2xl text-sm font-black shadow-lg shadow-red-900/50 transition cursor-pointer tracking-wide"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* MOBILE SIDEBAR OVERLAY */}
      {mobileMenu && (
        <div
          className="fixed inset-0 bg-[#151130]/60 z-40 md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setMobileMenu(false)}
        />
      )}

      {/* SIDEBAR NAVIGATION */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-50 w-64 bg-gradient-to-r from-[#0F0C29] via-[#1a153b] to-[#24243E] flex flex-col justify-between transform transition-transform duration-200 ease-in-out shadow-xl border-r border-indigo-950/60 p-4
        ${mobileMenu ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="space-y-4">
          <div className="h-20 px-4 flex items-center justify-between border-b border-indigo-950/60">
            <button
              onClick={() => {
                setCurrentTab('dashboard');
                setMobileMenu(false);
              }}
              className="flex items-center space-x-3 text-left focus:outline-none group cursor-pointer"
            >
              <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-md shadow-indigo-600/30 group-hover:bg-indigo-500 transition-colors shrink-0">
                <Stethoscope className="w-5 h-5 text-indigo-100" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-extrabold text-white tracking-wider text-base group-hover:text-indigo-200 transition-colors truncate">
                  SAFE
                </span>
                <span className="text-[10px] text-indigo-400 tracking-wider uppercase font-semibold truncate">
                  Clinic Dispatch
                </span>
              </div>
            </button>
            <button
              onClick={() => setMobileMenu(false)}
              className="md:hidden text-indigo-300 hover:text-white p-1 rounded-md shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="space-y-2">
            <button
              onClick={() => { setCurrentTab('dashboard'); setMobileMenu(false); }}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-2xl text-sm transition-all cursor-pointer shadow-sm ${
                currentTab === 'dashboard'
                  ? 'bg-white text-slate-900 font-extrabold shadow-md border border-indigo-100'
                  : 'bg-white/10 hover:bg-white/20 text-white font-semibold'
              }`}
            >
              <Activity className={`w-5 h-5 shrink-0 ${currentTab === 'dashboard' ? 'text-indigo-600' : 'text-indigo-300'}`} />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => { setCurrentTab('assignments'); setMobileMenu(false); }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-sm transition-all cursor-pointer shadow-sm ${
                currentTab === 'assignments'
                  ? 'bg-white text-slate-900 font-extrabold shadow-md border border-indigo-100'
                  : 'bg-white/10 hover:bg-white/20 text-white font-semibold'
              }`}
            >
              <div className="flex items-center space-x-3 min-w-0">
                <ShieldAlert className={`w-5 h-5 shrink-0 ${currentTab === 'assignments' ? 'text-indigo-600' : 'text-indigo-300'}`} />
                <span className="truncate">Incident Reports</span>
              </div>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold shrink-0 ml-2 ${
                currentTab === 'assignments' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-900/40 text-indigo-200 border border-indigo-400/30'
              }`}>
                {activeOperationalIncidents.length}
              </span>
            </button>

            <button
              onClick={() => { setCurrentTab('accepted'); setMobileMenu(false); }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-sm transition-all cursor-pointer shadow-sm ${
                currentTab === 'accepted'
                  ? 'bg-white text-slate-900 font-extrabold shadow-md border border-indigo-100'
                  : 'bg-white/10 hover:bg-white/20 text-white font-semibold'
              }`}
            >
              <div className="flex items-center space-x-3 min-w-0">
                <ClipboardList className={`w-5 h-5 shrink-0 ${currentTab === 'accepted' ? 'text-indigo-600' : 'text-indigo-300'}`} />
                <span className="truncate">Assigned Cases</span>
              </div>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold shrink-0 ml-2 ${
                currentTab === 'accepted' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-900/40 text-indigo-200 border border-indigo-400/30'
              }`}>
                {assignedCount}
              </span>
            </button>

            <button
              onClick={() => { setCurrentTab('roster'); setMobileMenu(false); }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-sm transition-all cursor-pointer shadow-sm ${
                currentTab === 'roster'
                  ? 'bg-white text-slate-900 font-extrabold shadow-md border border-indigo-100'
                  : 'bg-white/10 hover:bg-white/20 text-white font-semibold'
              }`}
            >
              <div className="flex items-center space-x-3 min-w-0">
                <Users className={`w-5 h-5 shrink-0 ${currentTab === 'roster' ? 'text-indigo-600' : 'text-indigo-300'}`} />
                <span className="truncate">Staff Roster</span>
              </div>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold shrink-0 ml-2 ${
                currentTab === 'roster' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-900/40 text-indigo-200 border border-indigo-400/30'
              }`}>
                {availableRespondersList.length}/{responders.length}
              </span>
            </button>

            <button
              onClick={() => { setCurrentTab('schedule'); setMobileMenu(false); }}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-2xl text-sm transition-all cursor-pointer shadow-sm ${
                currentTab === 'schedule'
                  ? 'bg-white text-slate-900 font-extrabold shadow-md border border-indigo-100'
                  : 'bg-white/10 hover:bg-white/20 text-white font-semibold'
              }`}
            >
              <CalendarDays className={`w-5 h-5 shrink-0 ${currentTab === 'schedule' ? 'text-indigo-600' : 'text-indigo-300'}`} />
              <span>Schedule</span>
            </button>
          </nav>
        </div>

        <div className="pt-4 border-t border-indigo-950/60">
          <div className="text-[10px] text-indigo-400 text-center font-medium">
            SAFE Clinic Dispatch v2.4
          </div>
        </div>
      </aside>

      {/* MAIN CONTAINER */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden" style={{ fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif' }}>
        {/* TOP BAR */}
        <header className="h-20 bg-[#201B50] text-white border-b border-indigo-950 px-4 md:px-8 flex items-center justify-between sticky top-0 z-30 shadow-md">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setMobileMenu(true)}
              className="md:hidden p-2 text-indigo-200 hover:bg-indigo-900/60 rounded-lg transition cursor-pointer"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold capitalize tracking-tight text-white">
                {currentTab === 'assignments' ? 'Incident Reports' : currentTab === 'accepted' ? 'Assigned Cases' : currentTab === 'roster' ? 'Staff Roster' : currentTab}
              </h1>
              <p className="text-xs md:text-sm text-sky-200 hidden sm:block font-medium">
                University Medical Clinic • Dispatch & Roster Management
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="hidden md:flex flex-col text-right border-r border-indigo-900 pr-4">
              <span className="text-sm font-bold text-white">
                {currentDateTime.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
              <span className="text-xs text-sky-200 font-semibold">
                {currentDateTime.toLocaleTimeString()}
              </span>
            </div>

            {/* Notification Bell Dropdown Toggle */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2.5 bg-indigo-900/60 hover:bg-indigo-900 text-indigo-200 hover:text-white rounded-xl relative transition cursor-pointer"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-600 text-white rounded-full text-[10px] font-extrabold flex items-center justify-center border-2 border-[#201B50]">
                    {unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-3 w-80 md:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden text-slate-800 animate-in fade-in duration-150">
                  <div className="px-4 py-3 bg-[#201B50] text-white flex items-center justify-between">
                    <span className="font-extrabold text-sm">Notifications & Alerts</span>
                    <span className="text-xs bg-indigo-900 px-2 py-0.5 rounded-full text-indigo-200 font-bold">
                      {unreadCount} New
                    </span>
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-slate-400 text-sm">No notifications available</div>
                    ) : (
                      notifications.map((n) => (
                        <div key={n.id} className={`p-3.5 hover:bg-slate-50 transition ${n.unread ? 'bg-indigo-50/50' : ''}`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-slate-900">{n.title}</span>
                            <span className="text-[10px] text-slate-400 font-medium">{n.time}</span>
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed">{n.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile Avatar Button with Dropdown Menu */}
            <div className="relative">
              <button
                onClick={() => setShowProfileModal(!showProfileModal)}
                className="w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center font-extrabold text-sm shadow-md transition cursor-pointer"
              >
                {initials}
              </button>

              {showProfileModal && (
                <div className="absolute right-0 mt-3 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden text-slate-800 animate-in fade-in duration-150 p-4 space-y-4">
                  <div className="flex items-center space-x-3 border-b border-slate-100 pb-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-sm shrink-0">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-black text-slate-900 truncate">{editableName}</h4>
                      <p className="text-[10px] text-indigo-600 font-bold truncate">{editableRole}</p>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600 font-medium">
                    <p className="truncate"><strong>Email:</strong> {editableEmail}</p>
                    <p className="truncate"><strong>Phone:</strong> {editablePhone}</p>
                  </div>

                  <div className="pt-2 border-t border-slate-100">
                    <button
                      onClick={() => {
                        setShowProfileModal(false);
                        onLogout();
                      }}
                      className="w-full flex items-center justify-center space-x-2 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-extrabold transition cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* TAB CONTENT AREA */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-2xl text-sm font-semibold flex items-center justify-between shadow-sm">
              <span>{error}</span>
              <button onClick={() => setError('')} className="text-rose-500 hover:text-rose-700 font-bold ml-2">Dismiss</button>
            </div>
          )}

          {currentTab === 'dashboard' && (
            <div className="space-y-6">
              {/* METRICS CARDS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div
                  onClick={() => { setCurrentTab('assignments'); setFeedStatusFilter('pending'); }}
                  className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80 hover:shadow-md transition cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Pending Incidents</span>
                    <div className="p-2.5 bg-rose-50 text-rose-600 rounded-2xl group-hover:bg-rose-100 transition">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="text-3xl font-black text-slate-900 mb-1">{pendingCount}</div>
                  <span className="text-xs font-semibold text-rose-600">Requires immediate review</span>
                </div>

                <div
                  onClick={() => { setCurrentTab('assignments'); setFeedStatusFilter('active'); }}
                  className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80 hover:shadow-md transition cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Active Cases</span>
                    <div className="p-2.5 bg-amber-50 text-amber-600 rounded-2xl group-hover:bg-amber-100 transition">
                      <Activity className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="text-3xl font-black text-slate-900 mb-1">{activeCount}</div>
                  <span className="text-xs font-semibold text-amber-600">In progress on campus</span>
                </div>

                <div
                  onClick={() => { setCurrentTab('accepted'); }}
                  className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80 hover:shadow-md transition cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Assigned / Responding</span>
                    <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl group-hover:bg-indigo-100 transition">
                      <ClipboardList className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="text-3xl font-black text-slate-900 mb-1">{assignedCount}</div>
                  <span className="text-xs font-semibold text-indigo-600">Responders deployed</span>
                </div>

                <div
                  onClick={() => { setCurrentTab('roster'); setRosterFilter('available'); }}
                  className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80 hover:shadow-md transition cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Available Responders</span>
                    <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl group-hover:bg-emerald-100 transition">
                      <Users className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="text-3xl font-black text-slate-900 mb-1">
                    {availableRespondersList.length} / {responders.length}
                  </div>
                  <span className="text-xs font-semibold text-emerald-600">Ready for dispatch</span>
                </div>
              </div>

              {/* TWO COLUMN GRID */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Live Incident Feed Summary */}
                <div className="lg:col-span-2 bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-extrabold text-slate-900">Live Incident Feed</h3>
                      <p className="text-xs text-slate-500 font-medium">Real-time emergency reports from students and kiosks</p>
                    </div>
                    <button
                      onClick={() => setCurrentTab('assignments')}
                      className="text-xs font-extrabold text-indigo-600 hover:text-indigo-800 flex items-center space-x-1 cursor-pointer"
                    >
                      <span>View All</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  {loading ? (
                    <div className="py-12 text-center text-slate-400 text-sm">Loading incident reports...</div>
                  ) : prioritizedAndFilteredIncidents.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 text-sm">No active incident reports recorded.</div>
                  ) : (
                    <div className="space-y-3 overflow-y-auto max-h-[420px] pr-1">
                      {prioritizedAndFilteredIncidents.map((inc) => {
                        const statusLower = (inc.status || 'pending').toLowerCase();
                        return (
                          <div key={inc.incident_id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200/60 flex items-center justify-between gap-4">
                            <div className="min-w-0">
                              <div className="flex items-center space-x-2 mb-1">
                                <span className="text-xs font-black text-slate-900">#{inc.incident_id}</span>
                                <span className="text-xs font-bold text-slate-700">{inc.incident_name}</span>
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${
                                  statusLower === 'pending' ? 'bg-rose-100 text-rose-700' :
                                  statusLower === 'active' ? 'bg-amber-100 text-amber-700' :
                                  ['assigned', 'accepted', 'responding'].includes(statusLower) ? 'bg-indigo-100 text-indigo-700' :
                                  'bg-emerald-100 text-emerald-700'
                                }`}>
                                  {inc.status || 'Pending'}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 truncate">
                                📍 {inc.location_description || 'Campus'} • Reported by {inc.reporter_name}
                              </p>
                            </div>
                            <button
                              onClick={() => openManageModal(inc)}
                              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-sm shrink-0 cursor-pointer"
                            >
                              Manage
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Regional Earthquakes Panel */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 flex flex-col">
                  <div className="flex items-center justify-between mb-4 gap-3">
                    <div className="min-w-0">
                      <h3 className="text-lg font-extrabold text-slate-900">Regional Earthquakes</h3>
                      <p className="text-xs text-slate-500 font-medium">USGS / PHIVOLCS (300 km radius)</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={handleTestEarthquake}
                        className="flex items-center gap-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-extrabold transition shadow-sm cursor-pointer"
                        title="Trigger a local test earthquake alert"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Test Alert
                      </button>
                      <button
                        type="button"
                        onClick={() => void loadEarthquakes()}
                        disabled={loadingEarthquakes}
                        className="p-2 text-slate-400 hover:text-slate-600 rounded-xl transition cursor-pointer disabled:opacity-50"
                        title="Refresh earthquakes"
                      >
                        <RefreshCw className={`w-4 h-4 ${loadingEarthquakes ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                  </div>

                  {earthquakes.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 text-sm">No recent regional earthquakes detected.</div>
                  ) : (
                    <div className="space-y-3 overflow-y-auto max-h-[420px] pr-1">
                      {earthquakes.map((eq) => (
                        <div
                          key={eq.id}
                          onClick={() => setSelectedEarthquakeForDetails(eq)}
                          className="p-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200/60 transition cursor-pointer"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-xs font-black px-2 py-0.5 rounded-md ${
                              eq.magnitude >= 5.0 ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                            }`}>
                              Mag {eq.magnitude.toFixed(1)}
                            </span>
                            <span className="text-[10px] text-slate-400 font-bold">{eq.distance_from_cdo_km} km from CDO</span>
                          </div>
                          <h4 className="text-xs font-bold text-slate-900 truncate mb-1">{eq.place}</h4>
                          <div className="flex items-center justify-between text-[10px] text-slate-500">
                            <span>Depth: {eq.depth_km} km</span>
                            <span className="uppercase font-bold text-indigo-600">{eq.source}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {currentTab === 'assignments' && (
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">Incident Reports Roster</h3>
                  <p className="text-xs text-slate-500">Manage and dispatch responders to reported campus incidents</p>
                </div>
                <div className="flex items-center space-x-2 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-64">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      placeholder="Search incidents..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {prioritizedAndFilteredIncidents.length === 0 ? (
                <div className="py-16 text-center text-slate-400 text-sm">No operational incidents match your search criteria.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                        <th className="py-3 px-4">ID</th>
                        <th className="py-3 px-4">Incident Type</th>
                        <th className="py-3 px-4">Location</th>
                        <th className="py-3 px-4">Reporter</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Assigned Responder</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                      {prioritizedAndFilteredIncidents.map((inc) => {
                        const statusLower = (inc.status || 'pending').toLowerCase();
                        return (
                          <tr key={inc.incident_id} className="hover:bg-slate-50 transition">
                            <td className="py-4 px-4 font-black text-slate-900">#{inc.incident_id}</td>
                            <td className="py-4 px-4 font-bold text-slate-900">{inc.incident_name}</td>
                            <td className="py-4 px-4">{inc.location_description || 'Campus'}</td>
                            <td className="py-4 px-4">{inc.reporter_name}</td>
                            <td className="py-4 px-4">
                              <span className={`px-2.5 py-1 rounded-full font-black uppercase text-[10px] ${
                                statusLower === 'pending' ? 'bg-rose-100 text-rose-700' :
                                statusLower === 'active' ? 'bg-amber-100 text-amber-700' :
                                ['assigned', 'accepted', 'responding'].includes(statusLower) ? 'bg-indigo-100 text-indigo-700' :
                                'bg-emerald-100 text-emerald-700'
                              }`}>
                                {inc.status || 'Pending'}
                              </span>
                            </td>
                            <td className="py-4 px-4 font-bold text-indigo-600">
                              {inc.assigned_responder_name || 'Unassigned'}
                            </td>
                            <td className="py-4 px-4 text-right">
                              <button
                                onClick={() => openManageModal(inc)}
                                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition shadow-sm cursor-pointer"
                              >
                                Manage
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {currentTab === 'accepted' && (
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 space-y-6">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">Assigned & In-Progress Cases</h3>
                <p className="text-xs text-slate-500">Monitor active emergency deployments across the university</p>
              </div>

              {acceptedIncidents.length === 0 ? (
                <div className="py-16 text-center text-slate-400 text-sm">No currently active or assigned cases.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {acceptedIncidents.map((inc) => (
                    <div key={inc.incident_id} className="p-5 rounded-3xl bg-slate-50 border border-slate-200/80 space-y-4 flex flex-col justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-slate-900">Incident #{inc.incident_id}</span>
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                            {inc.status}
                          </span>
                        </div>
                        <h4 className="text-sm font-black text-slate-900">{inc.incident_name}</h4>
                        <p className="text-xs text-slate-600">📍 {inc.location_description || 'Campus'}</p>
                        <p className="text-xs font-semibold text-indigo-600">Responder: {inc.assigned_responder_name || 'Unassigned'}</p>
                      </div>
                      <button
                        onClick={() => openManageModal(inc)}
                        className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
                      >
                        Update Status / Responder
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {currentTab === 'roster' && (
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">Staff & Responder Roster</h3>
                  <p className="text-xs text-slate-500">View real-time availability of medical staff and emergency responders</p>
                </div>
                <div className="flex items-center space-x-2">
                  {(['all', 'available', 'busy', 'offline'] as const).map((filterOpt) => (
                    <button
                      key={filterOpt}
                      onClick={() => setRosterFilter(filterOpt)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-extrabold capitalize transition cursor-pointer ${
                        rosterFilter === filterOpt ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {filterOpt}
                    </button>
                  ))}
                </div>
              </div>

              {filteredResponders.length === 0 ? (
                <div className="py-16 text-center text-slate-400 text-sm">No responders found for this status filter.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredResponders.map((resp) => {
                    const status = (resp.availability_status || 'offline').toLowerCase();
                    return (
                      <div
                        key={resp.responder_id ?? resp.id}
                        onClick={() => setSelectedResponderForDetails(resp)}
                        className="p-5 rounded-3xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 transition cursor-pointer space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-sm">
                              {resp.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <h4 className="text-sm font-black text-slate-900">{resp.name}</h4>
                              <span className="text-[10px] text-slate-400 font-semibold">{resp.user_type || 'Responder'}</span>
                            </div>
                          </div>
                          <span className={`w-3 h-3 rounded-full ${
                            status === 'available' ? 'bg-emerald-500' : status === 'busy' ? 'bg-amber-500' : 'bg-slate-400'
                          }`} />
                        </div>
                        <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs text-slate-600 font-medium">
                          <span>Status: <strong className="capitalize">{status}</strong></span>
                          <span className="text-indigo-600 font-bold hover:underline">View Profile</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {currentTab === 'schedule' && (
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 space-y-6">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">Clinic Staff Schedule</h3>
                <p className="text-xs text-slate-500">Weekly shift assignments and dispatch coordinator schedules</p>
              </div>
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200/60 text-slate-500 text-sm">
                Schedule calendar management is fully synchronized with university HR dispatch records.
              </div>
            </div>
          )}
        </main>
      </div>

      {/* MODAL: MANAGE INCIDENT ASSIGNMENT */}
      {selectedIncidentForUpdate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl border border-slate-200 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900">Manage Incident #{selectedIncidentForUpdate.incident_id}</h3>
                <p className="text-xs text-slate-500 font-medium">{selectedIncidentForUpdate.incident_name}</p>
              </div>
              <button
                onClick={() => setSelectedIncidentForUpdate(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">Update Status</label>
                <select
                  id="incident-status-select"
                  defaultValue={selectedIncidentForUpdate.status || 'pending'}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="pending">Pending</option>
                  <option value="active">Active</option>
                  <option value="assigned">Assigned</option>
                  <option value="responding">Responding</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">Assign Responder</label>
                <select
                  value={selectedResponderIdForModal}
                  onChange={(e) => setSelectedResponderIdForModal(Number(e.target.value))}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value={0}>Select a responder...</option>
                  {responders.map((r) => {
                    const rid = r.responder_id ?? r.id;
                    return (
                      <option key={rid} value={rid}>
                        {r.name} ({r.availability_status})
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
              <button
                onClick={() => setSelectedIncidentForUpdate(null)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={submittingAssignment}
                onClick={() => {
                  const statusSelect = document.getElementById('incident-status-select') as HTMLSelectElement;
                  const newStatus = statusSelect ? statusSelect.value : (selectedIncidentForUpdate.status || 'pending');
                  void handleSaveIncidentAssignment(selectedIncidentForUpdate, newStatus, selectedResponderIdForModal);
                }}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-extrabold shadow-md transition cursor-pointer disabled:opacity-50"
              >
                {submittingAssignment ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: RESPONDER DETAILS */}
      {selectedResponderForDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl border border-slate-200 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-base">
                  {selectedResponderForDetails.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">{selectedResponderForDetails.name}</h3>
                  <span className="text-xs text-slate-400 font-semibold">{selectedResponderForDetails.user_type || 'Responder'}</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedResponderForDetails(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 bg-slate-50 p-4 rounded-2xl border border-slate-200/60 font-medium">
              <p><strong>Availability:</strong> <span className="capitalize">{selectedResponderForDetails.availability_status}</span></p>
              <p><strong>Contact Number:</strong> {selectedResponderForDetails.contact_number || 'Not provided'}</p>
              <p><strong>Email:</strong> {selectedResponderForDetails.email || 'Not provided'}</p>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs font-bold text-slate-500">Quick Availability Change:</span>
              <div className="flex space-x-2">
                {['available', 'busy', 'offline'].map((stat) => (
                  <button
                    key={stat}
                    onClick={() => void updateResponderAvailability(selectedResponderForDetails, stat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition cursor-pointer ${
                      selectedResponderForDetails.availability_status === stat ? 'bg-indigo-600 text-white shadow' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {stat}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedResponderForDetails(null)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}