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
  ExternalLink
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
  incidentId: number;
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
  const [feedStatusFilter, setFeedStatusFilter] = useState<'all' | 'pending' | 'active' | 'assigned' | 'resolved'>('all');
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
        const queryWithUser = 'incident_id,description,location_description,status,reported_at,user_id,incident_types_id,incident_types(incident_name),user(username,name),users(username,name),auth_user(username)';
        rawIncidents = await supabaseRequest(`incident?select=${queryWithUser}&order=reported_at.desc`);
      } catch {
        try {
          const queryFallback = 'incident_id,description,location_description,status,reported_at,user_id,incident_types_id,incident_types(incident_name),users(username)';
          rawIncidents = await supabaseRequest(`incident?select=${queryFallback}&order=reported_at.desc`);
        } catch {
          const baseQuery = 'incident_id,description,location_description,status,reported_at,user_id,incident_types_id,incident_types(incident_name)';
          rawIncidents = await supabaseRequest(`incident?select=${baseQuery}&order=reported_at.desc`);
        }
      }

      let rawResponders: any[] = [];
      try {
        rawResponders = await supabaseRequest('responder?select=*&order=name.asc');
      } catch (err) {
        console.error('Failed to load responder roster:', err);
      }
      setResponders(rawResponders || []);

      const assignmentMap: Record<number, number> = {};
      try {
        const notifAssignments = await supabaseRequest('responder_notification?select=incident_id,responder_id&order=created_at.desc');
        if (Array.isArray(notifAssignments)) {
          notifAssignments.forEach((n: any) => {
            if (n.incident_id && n.responder_id && !assignmentMap[n.incident_id]) {
              assignmentMap[n.incident_id] = n.responder_id;
            }
          });
        }
      } catch {
        try {
          const notifAssignmentsAlt = await supabaseRequest('responder_notification?select=incident_id,responder_id');
          if (Array.isArray(notifAssignmentsAlt)) {
            notifAssignmentsAlt.forEach((n: any) => {
              if (n.incident_id && n.responder_id) {
                assignmentMap[n.incident_id] = n.responder_id;
              }
            });
          }
        } catch {}
      }

      const userIds = Array.from(new Set((rawIncidents || []).map(r => r.user_id).filter(Boolean)));
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

      for (const uid of userIds) {
        if (!usernameMap[uid]) {
          try {
            const uRes = await supabaseRequest(`user?user_id=eq.${uid}&select=username,name`);
            if (Array.isArray(uRes) && uRes.length > 0) {
              usernameMap[uid] = uRes[0].username || uRes[0].name;
            }
          } catch {}
        }
      }

      const responderMap: Record<number, string> = {};
      (rawResponders || []).forEach((resp: any) => {
        const rid = resp.responder_id ?? resp.id;
        if (rid) responderMap[rid] = resp.name;
      });

      const formattedIncidents: IncidentReport[] = (rawIncidents || []).map((row: any) => {
        const embeddedName =
          row.user?.username ||
          row.user?.name ||
          row.users?.username ||
          row.users?.name ||
          row.auth_user?.username;

        const lookupName = row.user_id ? usernameMap[row.user_id] : undefined;
        const resolvedReporterName = embeddedName || lookupName || row.user_name || (row.user_id ? `User #${row.user_id}` : 'Anonymous User');

        const assignedId = row.assigned_responder_id ?? assignmentMap[row.incident_id];
        const assignedName = assignedId ? responderMap[assignedId] : undefined;

        return {
          ...row,
          incident_name: row.incident_types?.incident_name || 'General Incident',
          reporter_name: resolvedReporterName,
          assigned_responder_id: assignedId,
          assigned_responder_name: assignedName,
        };
      });

      setIncidents(formattedIncidents);

      const generatedNotifications: NotificationItem[] = formattedIncidents.map((inc: IncidentReport) => {
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
          const diffMins = Math.floor((new Date().getTime() - new Date(inc.reported_at).getTime()) / (1000 * 60));
          if (diffMins < 1) timeStr = 'Just now';
          else if (diffMins < 60) timeStr = `${diffMins} mins ago`;
          else if (diffMins < 1440) timeStr = `${Math.floor(diffMins / 60)} hrs ago`;
          else timeStr = new Date(inc.reported_at).toLocaleDateString();
        }

        return {
          id: inc.incident_id,
          title,
          message: `${inc.incident_name} at ${inc.location_description || 'Campus'} reported by ${inc.reporter_name}.`,
          time: timeStr,
          type,
          unread: statusLower === 'pending' || statusLower === 'active',
          incidentId: inc.incident_id,
        };
      });

      setNotifications(generatedNotifications);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load incident reports and roster.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadEarthquakes = useCallback(async () => {
    setLoadingEarthquakes(true);
    try {
      const token = localStorage.getItem('clinic_staff_access_token');
      const res = await fetch(`${API_BASE_URL}/earthquakes/`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setEarthquakes(data.events || []);
      }
    } catch (err) {
      console.error('Failed to load earthquake feed:', err);
    } finally {
      setLoadingEarthquakes(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
    void loadEarthquakes();
  }, [loadData, loadEarthquakes]);

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

  const getStatusPriority = (status?: string): number => {
    const s = (status || 'pending').toLowerCase();
    if (s === 'pending') return 1;
    if (s === 'active' || s === 'critical') return 2;
    if (['assigned', 'accepted', 'responding'].includes(s)) return 3;
    if (['resolved', 'completed', 'cancelled'].includes(s)) return 4;
    return 5;
  };

  const prioritizedAndFilteredIncidents = useMemo(() => {
    let list = [...incidents];
    if (feedStatusFilter !== 'all') {
      list = list.filter((item) => {
        const s = (item.status || 'pending').toLowerCase();
        if (feedStatusFilter === 'assigned') return ['assigned', 'accepted', 'responding'].includes(s);
        if (feedStatusFilter === 'resolved') return ['resolved', 'completed'].includes(s);
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

    return list.sort((a, b) => getStatusPriority(a.status) - getStatusPriority(b.status));
  }, [incidents, feedStatusFilter, searchQuery]);

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

  const acceptedIncidents = filteredIncidents.filter((row) => {
    const s = row.status?.toLowerCase() ?? '';
    return ['assigned', 'accepted', 'responding', 'active'].includes(s);
  });

  const unreadCount = notifications.filter(n => n.unread).length;
  const initials = editableName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F0F6FF] via-[#E0F2FE] to-[#BAE6FD] text-slate-800 flex flex-col md:flex-row antialiased">
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
                {incidents.length}
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
              <span className="text-xs font-mono text-sky-300 font-bold">
                {currentDateTime.toLocaleTimeString()}
              </span>
            </div>

            {/* SEARCH BAR */}
            <div className="relative hidden lg:block" ref={searchContainerRef}>
              <div className="relative flex items-center">
                <Search className="w-4 h-4 absolute left-3.5 text-indigo-300" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search incidents, reporters..."
                  className="pl-10 pr-8 py-2 w-72 text-sm bg-indigo-950/80 text-white placeholder-indigo-300 border border-indigo-800 rounded-xl focus:outline-none focus:bg-indigo-950 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition-all font-medium"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-3 text-indigo-300 hover:text-white">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* NOTIFICATIONS */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  setShowProfileModal(false);
                }}
                className={`relative p-2.5 rounded-xl text-indigo-200 hover:bg-indigo-900/60 transition cursor-pointer ${
                  showNotifications ? 'bg-indigo-950 text-indigo-400' : ''
                }`}
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-[#201B50] animate-pulse" />
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-indigo-200 py-2 z-50 text-slate-800">
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-900">Notifications</span>
                    <span className="text-xs text-indigo-600 font-semibold cursor-pointer" onClick={() => setNotifications(notifications.map(n => ({ ...n, unread: false })))}>
                      Mark all read
                    </span>
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {notifications.length > 0 ? (
                      notifications.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => {
                            setShowNotifications(false);
                            setCurrentTab('assignments');
                          }}
                          className={`p-3.5 hover:bg-slate-50 transition cursor-pointer flex items-start space-x-3 ${item.unread ? 'bg-indigo-50/50' : ''}`}
                        >
                          <div className={`p-2 rounded-xl mt-0.5 ${item.type === 'critical' ? 'bg-rose-100 text-rose-600' : 'bg-indigo-100 text-indigo-600'}`}>
                            <AlertTriangle className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-bold text-slate-900 truncate">{item.title}</p>
                              <span className="text-[10px] text-slate-400 shrink-0 ml-2">{item.time}</span>
                            </div>
                            <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">{item.message}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-8 text-center text-sm text-slate-500">No notifications</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* USER PROFILE BUTTON */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowProfileModal(!showProfileModal);
                  setShowNotifications(false);
                }}
                className="flex items-center space-x-3 pl-2 py-1.5 rounded-xl hover:bg-indigo-900/50 transition cursor-pointer"
              >
                <div className="w-9 h-9 rounded-xl bg-indigo-600 font-bold text-white flex items-center justify-center text-sm shadow-md">
                  {initials}
                </div>
                <div className="hidden xl:block text-left">
                  <span className="block text-sm font-bold text-white truncate max-w-[130px]">{editableName}</span>
                  <span className="block text-[11px] text-sky-300 truncate max-w-[130px]">Coordinator</span>
                </div>
                <ChevronDown className="w-4 h-4 text-indigo-300 hidden xl:block" />
              </button>

              {showProfileModal && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-indigo-200 py-3 z-50 text-slate-800">
                  <div className="px-4 pb-3 border-b border-slate-100 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white font-extrabold text-xl flex items-center justify-center mx-auto mb-2 shadow-lg shadow-indigo-600/30">
                      {initials}
                    </div>
                    <p className="font-bold text-slate-900 text-base">{editableName}</p>
                    <p className="text-xs text-indigo-600 font-medium mt-0.5">{editableRole}</p>
                    <p className="text-xs text-slate-400 mt-1">{editableEmail}</p>
                  </div>

                  <div className="p-2 space-y-1">
                    <button
                      onClick={() => {
                        setShowProfileModal(false);
                        onLogout();
                      }}
                      className="w-full flex items-center space-x-2 px-3 py-2.5 rounded-xl text-sm font-semibold text-rose-600 hover:bg-rose-50 transition cursor-pointer"
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

        {/* MAIN BODY CONTENT */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-2xl text-sm flex items-center justify-between shadow-sm">
              <span className="font-medium">{error}</span>
              <button onClick={() => setError('')} className="text-rose-400 hover:text-rose-700 font-bold ml-4">×</button>
            </div>
          )}

          {/* DASHBOARD TAB */}
          {currentTab === 'dashboard' && (
            <div className="space-y-6">
              {/* STATS OVERVIEW CARDS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-indigo-100 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pending Reports</p>
                    <p className="text-3xl font-extrabold text-slate-900 mt-1">{pendingCount}</p>
                  </div>
                  <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl shadow-sm border border-indigo-100 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Incidents</p>
                    <p className="text-3xl font-extrabold text-rose-600 mt-1">{activeCount}</p>
                  </div>
                  <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
                    <ShieldAlert className="w-6 h-6" />
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl shadow-sm border border-indigo-100 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Assigned Cases</p>
                    <p className="text-3xl font-extrabold text-indigo-600 mt-1">{assignedCount}</p>
                  </div>
                  <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                    <ClipboardList className="w-6 h-6" />
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl shadow-sm border border-indigo-100 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Available Responders</p>
                    <p className="text-3xl font-extrabold text-emerald-600 mt-1">
                      {availableRespondersList.length} <span className="text-sm font-medium text-slate-400">/ {responders.length}</span>
                    </p>
                  </div>
                  <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                    <UserCheck className="w-6 h-6" />
                  </div>
                </div>
              </div>

              {/* TWO-COLUMN MAIN DASHBOARD SPLIT: LEFT (INCIDENTS), RIGHT (EARTHQUAKES) */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                {/* LEFT: INCIDENT REPORT QUICK VIEW TABLE (2 COLUMNS WIDE, SCROLLABLE) */}
                <div className="lg:col-span-2 bg-white rounded-3xl p-6 shadow-sm border border-indigo-100 flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-base font-bold text-slate-900">Incident Report</h2>
                      <p className="text-xs text-slate-500">Latest distress calls and medical requests from campus</p>
                    </div>
                    <button
                      onClick={() => setCurrentTab('assignments')}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center space-x-1 cursor-pointer"
                    >
                      <span>View All</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="overflow-x-auto overflow-y-auto max-h-[420px] pr-1">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead className="sticky top-0 bg-white z-10">
                        <tr className="border-b border-slate-100 text-xs text-slate-400 uppercase tracking-wider">
                          <th className="py-3 px-4 font-bold">ID / Type</th>
                          <th className="py-3 px-4 font-bold">Reporter</th>
                          <th className="py-3 px-4 font-bold">Location</th>
                          <th className="py-3 px-4 font-bold">Status</th>
                          <th className="py-3 px-4 font-bold">Responder</th>
                          <th className="py-3 px-4 font-bold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {incidents.map((inc) => {
                          const statusLower = (inc.status || 'pending').toLowerCase();
                          return (
                            <tr key={inc.incident_id} className="hover:bg-slate-50/80 transition">
                              <td className="py-3.5 px-4">
                                <span className="font-bold text-slate-900">#{inc.incident_id}</span>
                                <span className="block text-xs text-indigo-600 font-semibold">{inc.incident_name}</span>
                              </td>
                              <td className="py-3.5 px-4 text-xs font-medium text-slate-700">{inc.reporter_name}</td>
                              <td className="py-3.5 px-4 text-xs text-slate-600">{inc.location_description || 'Campus'}</td>
                              <td className="py-3.5 px-4">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-extrabold capitalize ${
                                  statusLower === 'pending' ? 'bg-amber-100 text-amber-700' :
                                  statusLower === 'active' || statusLower === 'critical' ? 'bg-rose-100 text-rose-700' :
                                  ['assigned', 'accepted', 'responding'].includes(statusLower) ? 'bg-indigo-100 text-indigo-700' :
                                  'bg-emerald-100 text-emerald-700'
                                }`}>
                                  {inc.status || 'Pending'}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-xs font-semibold text-slate-700">
                                {inc.assigned_responder_name || <span className="text-slate-400 italic">Unassigned</span>}
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                <button
                                  onClick={() => openManageModal(inc)}
                                  className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl text-xs font-bold transition cursor-pointer"
                                >
                                  Manage
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        {incidents.length === 0 && (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-sm text-slate-400">
                              {loading ? 'Loading incidents...' : 'No incident reports found.'}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* RIGHT: LIVE EARTHQUAKE MONITORING CARD (1 COLUMN WIDE, SCROLLABLE) */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-indigo-100 flex flex-col">
                  <div className="flex items-start justify-between gap-2 mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl shrink-0">
                        <MapPin className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="text-base font-bold text-slate-900">Regional Earthquake Monitoring</h2>
                        <p className="text-xs text-slate-500">Seismic activity near CDO</p>
                      </div>
                    </div>
                    <button
                      onClick={() => void loadEarthquakes()}
                      disabled={loadingEarthquakes}
                      className="text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl transition cursor-pointer shrink-0"
                    >
                      {loadingEarthquakes ? '...' : 'Refresh'}
                    </button>
                  </div>

                  {loadingEarthquakes && earthquakes.length === 0 ? (
                    <div className="py-8 text-center text-sm text-slate-400">Loading seismic activity...</div>
                  ) : earthquakes.length > 0 ? (
                    <div className="space-y-3 overflow-y-auto max-h-[420px] pr-1">
                      {earthquakes.map((eq) => (
                        <div
                          key={eq.id}
                          onClick={() => setSelectedEarthquakeForDetails(eq)}
                          className="p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-indigo-300 hover:shadow-md transition cursor-pointer flex flex-col justify-between space-y-2 group"
                        >
                          <div className="flex items-center justify-between">
                            <span className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full ${eq.magnitude >= 5 ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                              Mag {eq.magnitude.toFixed(1)}
                            </span>
                            <span className="text-[11px] font-mono text-slate-400">{Math.round(eq.distance_from_cdo_km)} km from CDO</span>
                          </div>
                          <p className="text-xs font-bold text-slate-800 group-hover:text-indigo-600 transition-colors truncate">{eq.place}</p>
                          <p className="text-[11px] text-slate-500">Depth: {eq.depth_km} km • {new Date(eq.time).toLocaleTimeString()}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center text-sm text-slate-500 bg-slate-50 rounded-2xl border border-slate-100">
                      No recent significant seismic events reported in the region.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* INCIDENT REPORTS TAB */}
          {currentTab === 'assignments' && (
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-indigo-100 space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">All Incident Reports</h2>
                  <p className="text-xs text-slate-500">Filter, dispatch responders, and manage campus emergency cases</p>
                </div>

                <div className="flex items-center space-x-2 overflow-x-auto pb-2 md:pb-0">
                  {(['all', 'pending', 'active', 'assigned', 'resolved'] as const).map((st) => (
                    <button
                      key={st}
                      onClick={() => setFeedStatusFilter(st)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold capitalize transition cursor-pointer shrink-0 ${
                        feedStatusFilter === st
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {prioritizedAndFilteredIncidents.map((inc) => {
                  const statusLower = (inc.status || 'pending').toLowerCase();
                  return (
                    <div key={inc.incident_id} className="bg-slate-50 rounded-2xl p-5 border border-slate-200/80 flex flex-col justify-between space-y-4 shadow-sm hover:shadow-md transition">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-slate-900 text-sm">Incident #{inc.incident_id}</span>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-extrabold capitalize ${
                            statusLower === 'pending' ? 'bg-amber-100 text-amber-700' :
                            statusLower === 'active' || statusLower === 'critical' ? 'bg-rose-100 text-rose-700' :
                            ['assigned', 'accepted', 'responding'].includes(statusLower) ? 'bg-indigo-100 text-indigo-700' :
                            'bg-emerald-100 text-emerald-700'
                          }`}>
                            {inc.status || 'Pending'}
                          </span>
                        </div>

                        <p className="text-sm font-bold text-indigo-600">{inc.incident_name}</p>
                        <p className="text-xs text-slate-600">{inc.description || 'No detailed description provided.'}</p>
                        
                        <div className="pt-2 border-t border-slate-200/60 space-y-1 text-xs text-slate-500">
                          <p><strong className="text-slate-700">Reporter:</strong> {inc.reporter_name}</p>
                          <p><strong className="text-slate-700">Location:</strong> {inc.location_description || 'Campus Area'}</p>
                          <p><strong className="text-slate-700">Assigned:</strong> {inc.assigned_responder_name || <span className="text-slate-400 italic">None</span>}</p>
                        </div>
                      </div>

                      <button
                        onClick={() => openManageModal(inc)}
                        className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
                      >
                        Manage & Dispatch
                      </button>
                    </div>
                  );
                })}

                {prioritizedAndFilteredIncidents.length === 0 && (
                  <div className="col-span-full py-12 text-center text-slate-400 text-sm">
                    No incident reports match your filter criteria.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ASSIGNED CASES TAB */}
          {currentTab === 'accepted' && (
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-indigo-100 space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Active & Assigned Cases</h2>
                <p className="text-xs text-slate-500">Monitor ongoing medical dispatches and active responder deployments</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {acceptedIncidents.map((inc) => (
                  <div key={inc.incident_id} className="bg-slate-50 rounded-2xl p-5 border border-indigo-100 flex flex-col justify-between space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-slate-900 text-sm">Case #{inc.incident_id}</span>
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-indigo-100 text-indigo-700 capitalize">
                          {inc.status || 'Assigned'}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-indigo-600">{inc.incident_name}</p>
                      <p className="text-xs text-slate-600">{inc.location_description || 'Campus'}</p>
                      <div className="text-xs text-slate-500 pt-2 border-t border-slate-200">
                        <p><strong className="text-slate-700">Responder:</strong> {inc.assigned_responder_name || 'Assigned'}</p>
                        <p><strong className="text-slate-700">Reporter:</strong> {inc.reporter_name}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => openManageModal(inc)}
                      className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      Update Case Status
                    </button>
                  </div>
                ))}

                {acceptedIncidents.length === 0 && (
                  <div className="col-span-full py-12 text-center text-slate-400 text-sm">
                    No active or assigned cases currently in progress.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STAFF ROSTER TAB */}
          {currentTab === 'roster' && (
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-indigo-100 space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Clinic Staff & Responder Roster</h2>
                  <p className="text-xs text-slate-500">Manage medical personnel availability and contact directory</p>
                </div>

                <div className="flex items-center space-x-2 overflow-x-auto pb-2 md:pb-0">
                  {(['all', 'available', 'busy', 'offline'] as const).map((st) => (
                    <button
                      key={st}
                      onClick={() => setRosterFilter(st)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold capitalize transition cursor-pointer shrink-0 ${
                        rosterFilter === st
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredResponders.map((resp) => {
                  const rid = resp.responder_id ?? resp.id;
                  const status = (resp.availability_status || 'offline').toLowerCase();
                  return (
                    <div key={rid} className="bg-slate-50 rounded-2xl p-5 border border-slate-200/80 flex flex-col justify-between space-y-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white font-bold flex items-center justify-center text-sm">
                            {resp.name.split(/\s+/).map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold capitalize ${
                            status === 'available' ? 'bg-emerald-100 text-emerald-700' :
                            status === 'busy' ? 'bg-amber-100 text-amber-700' :
                            'bg-slate-200 text-slate-600'
                          }`}>
                            {resp.availability_status || 'Offline'}
                          </span>
                        </div>

                        <div>
                          <p className="text-sm font-bold text-slate-900">{resp.name}</p>
                          <p className="text-xs text-indigo-600 font-semibold">{resp.user_type || 'Medical Responder'}</p>
                        </div>

                        <div className="space-y-1 text-xs text-slate-500 pt-2 border-t border-slate-200/60">
                          <p className="flex items-center space-x-2">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            <span>{resp.contact_number || 'No phone listed'}</span>
                          </p>
                          <p className="flex items-center space-x-2">
                            <Mail className="w-3.5 h-3.5 text-slate-400" />
                            <span>{resp.email || 'No email listed'}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => updateResponderAvailability(resp, status === 'available' ? 'offline' : 'available')}
                          className={`flex-1 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                            status === 'available'
                              ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          }`}
                        >
                          Set {status === 'available' ? 'Offline' : 'Available'}
                        </button>
                        <button
                          onClick={() => setSelectedResponderForDetails(resp)}
                          className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl text-xs font-bold transition cursor-pointer"
                        >
                          View
                        </button>
                      </div>
                    </div>
                  );
                })}

                {filteredResponders.length === 0 && (
                  <div className="col-span-full py-12 text-center text-slate-400 text-sm">
                    No staff members match the selected filter.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SCHEDULE TAB */}
          {currentTab === 'schedule' && (
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-indigo-100 space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Clinic Shift Schedule</h2>
                <p className="text-xs text-slate-500">Upcoming medical staff duty rosters and shift assignments</p>
              </div>

              <div className="py-16 text-center space-y-3 bg-slate-50 rounded-2xl border border-slate-100">
                <CalendarDays className="w-12 h-12 text-indigo-400 mx-auto" />
                <p className="text-sm font-bold text-slate-700">Weekly Shift Calendar</p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Staff shift rotations and coordinator schedules are synchronized with the university HR portal.
                </p>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* MODAL: MANAGE & DISPATCH INCIDENT */}
      {selectedIncidentForUpdate && (
        <div className="fixed inset-0 bg-[#151130]/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-indigo-100 space-y-6 text-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Manage Incident #{selectedIncidentForUpdate.incident_id}</h3>
                <p className="text-xs text-slate-500">{selectedIncidentForUpdate.incident_name}</p>
              </div>
              <button
                onClick={() => setSelectedIncidentForUpdate(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Update Incident Status</label>
                <select
                  id="incident-status-select"
                  defaultValue={selectedIncidentForUpdate.status || 'pending'}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  <option value="pending">Pending</option>
                  <option value="active">Active</option>
                  <option value="assigned">Assigned</option>
                  <option value="responding">Responding</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Assign Medical Responder</label>
                <select
                  value={selectedResponderIdForModal}
                  onChange={(e) => setSelectedResponderIdForModal(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  <option value={0}>-- Select Responder --</option>
                  {responders.map((resp) => {
                    const rid = resp.responder_id ?? resp.id;
                    return (
                      <option key={rid} value={rid}>
                        {resp.name} ({resp.availability_status || 'offline'})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="p-4 bg-indigo-50/60 rounded-2xl border border-indigo-100 text-xs text-indigo-900 space-y-1">
                <p><strong>Location:</strong> {selectedIncidentForUpdate.location_description || 'Campus Area'}</p>
                <p><strong>Reporter:</strong> {selectedIncidentForUpdate.reporter_name}</p>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
              <button
                onClick={() => setSelectedIncidentForUpdate(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
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
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-md shadow-indigo-600/30 cursor-pointer disabled:opacity-50"
              >
                {submittingAssignment ? 'Saving...' : 'Save & Dispatch'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: RESPONDER DETAILS */}
      {selectedResponderForDetails && (
        <div className="fixed inset-0 bg-[#151130]/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-indigo-100 space-y-6 text-slate-800">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-2xl bg-indigo-600 text-white font-extrabold text-xl flex items-center justify-center mx-auto shadow-lg shadow-indigo-600/30">
                {selectedResponderForDetails.name.split(/\s+/).map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <h3 className="text-base font-bold text-slate-900">{selectedResponderForDetails.name}</h3>
              <p className="text-xs text-indigo-600 font-semibold">{selectedResponderForDetails.user_type || 'Medical Responder'}</p>
            </div>

            <div className="space-y-2 text-xs text-slate-600 bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <p><strong className="text-slate-800">Status:</strong> <span className="capitalize">{selectedResponderForDetails.availability_status}</span></p>
              <p><strong className="text-slate-800">Phone:</strong> {selectedResponderForDetails.contact_number || 'N/A'}</p>
              <p><strong className="text-slate-800">Email:</strong> {selectedResponderForDetails.email || 'N/A'}</p>
            </div>

            <button
              onClick={() => setSelectedResponderForDetails(null)}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* MODAL: EARTHQUAKE DETAILS */}
      {selectedEarthquakeForDetails && (
        <div className="fixed inset-0 bg-[#151130]/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-indigo-100 space-y-6 text-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Earthquake Details</h3>
                  <p className="text-xs text-slate-500">Seismic Event Report</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedEarthquakeForDetails(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div>
                  <p className="text-[11px] uppercase tracking-wider font-bold text-slate-400">Magnitude</p>
                  <p className={`text-2xl font-extrabold mt-0.5 ${selectedEarthquakeForDetails.magnitude >= 5 ? 'text-rose-600' : 'text-amber-600'}`}>
                    {selectedEarthquakeForDetails.magnitude.toFixed(1)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] uppercase tracking-wider font-bold text-slate-400">Distance from CDO</p>
                  <p className="text-lg font-extrabold text-slate-900 mt-0.5">{Math.round(selectedEarthquakeForDetails.distance_from_cdo_km)} km</p>
                </div>
              </div>

              <div className="space-y-2 text-xs text-slate-700 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <p><strong className="text-slate-900">Location / Place:</strong> {selectedEarthquakeForDetails.place}</p>
                <p><strong className="text-slate-900">Focal Depth:</strong> {selectedEarthquakeForDetails.depth_km} km</p>
                <p><strong className="text-slate-900">Timestamp:</strong> {new Date(selectedEarthquakeForDetails.time).toLocaleString()}</p>
                <p><strong className="text-slate-900">Data Source:</strong> {selectedEarthquakeForDetails.source || 'USGS / PHIVOLCS Feed'}</p>
              </div>

              {selectedEarthquakeForDetails.url && (
                <a
                  href={selectedEarthquakeForDetails.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center space-x-2 w-full py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition"
                >
                  <span>View Official Event Page</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>

            <button
              onClick={() => setSelectedEarthquakeForDetails(null)}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}