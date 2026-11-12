import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import {
  Activity,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  HeartPulse,
  LogOut,
  MapPin,
  Menu,
  Search,
  CheckCheck,
  ShieldAlert,
  CheckCircle,
  AlertTriangle,
  Stethoscope,
  X,
  ChevronDown,
  Filter,
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
    } catch (refreshErr) {
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
  const [availability, setAvailability] = useState('available');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'assignments' | 'accepted' | 'schedule'>('dashboard');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [selectedIncidentForUpdate, setSelectedIncidentForUpdate] = useState<IncidentReport | null>(null);

  // Status Filter State for Incident Feed
  const [feedStatusFilter, setFeedStatusFilter] = useState<'all' | 'pending' | 'active' | 'assigned' | 'resolved'>('all');

  // Search Query State for Header Bar & Dropdown
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Live Date and Time State
  const [currentDateTime, setCurrentDateTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Close search dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsSearchFocused(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Dynamic notifications state generated from incidents
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const loadIncidents = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      let rawData: any[] = [];
     
      try {
        const queryWithUser = 'incident_id,description,location_description,status,reported_at,user_id,incident_types_id,incident_types(incident_name),user(username),users(username)';
        rawData = await supabaseRequest(`incident?select=${queryWithUser}&order=reported_at.desc`);
      } catch {
        const baseQuery = 'incident_id,description,location_description,status,reported_at,user_id,incident_types_id,incident_types(incident_name)';
        rawData = await supabaseRequest(`incident?select=${baseQuery}&order=reported_at.desc`);
      }
     
      const formatted = (rawData || []).map((row: any) => ({
        ...row,
        incident_name: row.incident_types?.incident_name || 'General Incident',
        reporter_name: row.user?.username || row.users?.username || row.user_name || (row.user_id ? `User #${row.user_id}` : 'Anonymous User'),
      }));

      setIncidents(formatted);

      // Dynamically populate notifications from the fetched incident reports
      const generatedNotifications: NotificationItem[] = formatted.map((inc: IncidentReport) => {
        const statusLower = (inc.status || 'pending').toLowerCase();
        let title = 'New Incident Reported';
        let type = 'info';

        if (statusLower === 'active' || statusLower === 'critical') {
          title = 'Critical Incident Logged';
          type = 'critical';
        } else if (['assigned', 'accepted', 'responding'].includes(statusLower)) {
          title = 'Case Assigned / Updating';
          type = 'assigned';
        } else if (['resolved', 'completed'].includes(statusLower)) {
          title = 'Incident Resolved';
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
          title: `${title} (#${inc.incident_id})`,
          message: `${inc.incident_name} at ${inc.location_description || 'Campus'} reported by ${inc.reporter_name}.`,
          time: timeStr,
          type,
          unread: statusLower === 'pending' || statusLower === 'active',
          incidentId: inc.incident_id,
        };
      });

      setNotifications(generatedNotifications);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load reported incidents.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadIncidents();

    async function fetchStaffStatus() {
      try {
        const data = await supabaseRequest(`responder?select=availability_status&name=ilike.${encodeURIComponent(displayName ?? '')}`);
        if (data && data.length > 0 && data[0].availability_status) {
          setAvailability(data[0].availability_status.toLowerCase());
        }
      } catch (err) {
        console.error('Failed to fetch initial status:', err);
      }
    }
    void fetchStaffStatus();
  }, [loadIncidents, displayName]);

  const updateAvailability = async (status: string) => {
    const previousStatus = availability;
    setAvailability(status);
    setError('');

    try {
      const response = await supabaseRequest(
        `responder?name=ilike.${encodeURIComponent(displayName ?? '')}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ availability_status: status }),
        }
      );

      if (Array.isArray(response) && response.length === 0) {
        await supabaseRequest(`responder`, {
          method: 'POST',
          body: JSON.stringify({
            name: displayName,
            availability_status: status,
            user_type: 'responder',
          }),
        });
      }
    } catch (err) {
      setAvailability(previousStatus);
      setError(err instanceof Error ? err.message : 'Failed to update availability status in Supabase.');
    }
  };

  const updateIncidentStatus = async (incidentId: number, status: string) => {
    try {
      await supabaseRequest(
        `incident?incident_id=eq.${incidentId}`,
        { method: 'PATCH', body: JSON.stringify({ status }) },
      );
      setSelectedIncidentForUpdate(null);
      await loadIncidents();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update incident status.');
    }
  };

  // Prioritization helper: Pending (1) -> Active (2) -> Assigned/Accepted (3) -> Resolved (4) -> Others (5)
  const getStatusPriority = (status?: string): number => {
    const s = (status || 'pending').toLowerCase();
    if (s === 'pending') return 1;
    if (s === 'active' || s === 'critical') return 2;
    if (['assigned', 'accepted', 'responding'].includes(s)) return 3;
    if (['resolved', 'completed', 'cancelled'].includes(s)) return 4;
    return 5;
  };

  // Sorted and filtered incidents for the Incident Feed / Assignments tab
  const prioritizedAndFilteredIncidents = useMemo(() => {
    let list = [...incidents];

    // Apply Status Dropdown Filter
    if (feedStatusFilter !== 'all') {
      list = list.filter((item) => {
        const s = (item.status || 'pending').toLowerCase();
        if (feedStatusFilter === 'assigned') return ['assigned', 'accepted', 'responding'].includes(s);
        if (feedStatusFilter === 'resolved') return ['resolved', 'completed'].includes(s);
        return s === feedStatusFilter;
      });
    }

    // Apply Search Query filter if present
    if (searchQuery.trim()) {
      const queryTerms = searchQuery.toLowerCase().trim().split(/\s+/);
      list = list.filter((item) => {
        const idStr = String(item.incident_id);
        const typeStr = (item.incident_name ?? '').toLowerCase();
        const reporterStr = (item.reporter_name ?? '').toLowerCase();
        const locStr = (item.location_description ?? '').toLowerCase();
        const descStr = (item.description ?? '').toLowerCase();
        const statusStr = (item.status ?? '').toLowerCase();

        return queryTerms.every((term) =>
          idStr.includes(term) ||
          typeStr.includes(term) ||
          reporterStr.includes(term) ||
          locStr.includes(term) ||
          descStr.includes(term) ||
          statusStr.includes(term)
        );
      });
    }

    // Sort by priority (Pending -> Active -> Assigned -> Resolved)
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
      const descStr = (item.description ?? '').toLowerCase();
      const statusStr = (item.status ?? '').toLowerCase();

      return queryTerms.every((term) =>
        idStr.includes(term) ||
        typeStr.includes(term) ||
        reporterStr.includes(term) ||
        locStr.includes(term) ||
        descStr.includes(term) ||
        statusStr.includes(term)
      );
    });
  }, [incidents, searchQuery]);

  const pendingCount = incidents.filter((row) => (row.status?.toLowerCase() ?? 'pending') === 'pending').length;
  const activeCount = incidents.filter((row) => (row.status?.toLowerCase() ?? '') === 'active').length;
  const assignedCount = incidents.filter((row) => ['assigned', 'accepted', 'responding'].includes(row.status?.toLowerCase() ?? '')).length;
  
  const allActiveIncidentsCount = incidents.filter((row) => {
    const s = (row.status || 'pending').toLowerCase();
    return !['resolved', 'completed', 'cancelled'].includes(s);
  }).length;

  const acceptedIncidents = filteredIncidents.filter((row) => {
    const s = row.status?.toLowerCase() ?? '';
    return ['assigned', 'accepted', 'responding', 'active'].includes(s);
  });

  const unreadCount = notifications.filter(n => n.unread).length;
  const initials = displayName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F0F6FF] via-[#E0F2FE] to-[#BAE6FD] font-sans text-slate-800 flex flex-col md:flex-row antialiased">

      {/* MOBILE SIDEBAR OVERLAY */}
      {mobileMenu && (
        <div
          className="fixed inset-0 bg-[#151130]/60 z-40 md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setMobileMenu(false)}
        />
      )}

      {/* SIDEBAR NAVIGATION */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-50 w-64 bg-gradient-to-b from-[#151130] via-[#1A153B] to-[#231E4D] text-indigo-200 flex flex-col justify-between transform transition-transform duration-200 ease-in-out shadow-xl
        ${mobileMenu ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div>
          {/* Clickable Brand Logo Header */}
          <div className="h-20 px-6 flex items-center justify-between border-b border-indigo-950/60">
            <button
              onClick={() => {
                setCurrentTab('dashboard');
                setMobileMenu(false);
              }}
              className="flex items-center space-x-3 text-left focus:outline-none group cursor-pointer"
              title="Go to Dashboard"
            >
              <div className="bg-sky-500 p-2 rounded-xl text-white shadow-md shadow-sky-500/30 group-hover:bg-sky-400 transition-colors">
                <Stethoscope className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold text-white tracking-wider text-base group-hover:text-sky-200 transition-colors">
                  SAFE
                </span>
                <span className="text-[10px] text-sky-400 tracking-wider uppercase font-semibold">
                  Emergency Monitor
                </span>
              </div>
            </button>
            <button
              onClick={() => setMobileMenu(false)}
              className="md:hidden text-indigo-300 hover:text-white p-1 rounded-md"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1.5">
            <button
              onClick={() => { setCurrentTab('dashboard'); setMobileMenu(false); }}
              className={`w-full flex items-center space-x-3 px-3.5 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                currentTab === 'dashboard'
                  ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/30 font-semibold'
                  : 'hover:bg-indigo-900/50 text-indigo-300 hover:text-white'
              }`}
            >
              <Activity className="w-5 h-5 shrink-0" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => { setCurrentTab('assignments'); setMobileMenu(false); }}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                currentTab === 'assignments'
                  ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/30 font-semibold'
                  : 'hover:bg-indigo-900/50 text-indigo-300 hover:text-white'
              }`}
            >
              <div className="flex items-center space-x-3 min-w-0">
                <ShieldAlert className="w-5 h-5 shrink-0" />
                <span className="truncate">Incident Reports</span>
              </div>
              <span className="bg-indigo-950/80 text-sky-300 border border-sky-800 text-xs px-2 py-0.5 rounded-full font-bold shrink-0 ml-2">{incidents.length}</span>
            </button>

            <button
              onClick={() => { setCurrentTab('accepted'); setMobileMenu(false); }}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                currentTab === 'accepted'
                  ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/30 font-semibold'
                  : 'hover:bg-indigo-900/50 text-indigo-300 hover:text-white'
              }`}
            >
              <div className="flex items-center space-x-3 min-w-0">
                <ClipboardList className="w-5 h-5 shrink-0" />
                <span className="truncate">Assigned Cases</span>
              </div>
              <span className="bg-indigo-950/80 text-blue-300 border border-blue-800 text-xs px-2 py-0.5 rounded-full font-bold shrink-0 ml-2">{assignedCount}</span>
            </button>

            <button
              onClick={() => { setCurrentTab('schedule'); setMobileMenu(false); }}
              className={`w-full flex items-center space-x-3 px-3.5 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                currentTab === 'schedule'
                  ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/30 font-semibold'
                  : 'hover:bg-indigo-900/50 text-indigo-300 hover:text-white'
              }`}
            >
              <CalendarDays className="w-5 h-5 shrink-0" />
              <span>Schedule</span>
            </button>
          </nav>
        </div>

        {/* User Footer */}
        <div className="p-4 border-t border-indigo-950/60">
          <div className="bg-indigo-950/50 rounded-xl p-3 flex items-center justify-between border border-indigo-900/40">
            <div className="flex items-center space-x-3 overflow-hidden">
              <div className="w-9 h-9 rounded-full bg-sky-600 flex items-center justify-center font-bold text-white text-sm shrink-0 shadow-sm">
                {initials}
              </div>
              <div className="truncate">
                <p className="text-sm font-medium text-white truncate">{displayName}</p>
                <p className="text-xs text-sky-400 truncate">Clinic Staff</p>
              </div>
            </div>
            <button
              onClick={onLogout}
              title="Sign out"
              className="text-indigo-400 hover:text-rose-400 p-1.5 rounded-lg hover:bg-indigo-900/50 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTAINER */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* TOP BAR */}
        <header className="h-20 bg-[#201B50] text-white border-b border-indigo-950 px-4 md:px-8 flex items-center justify-between sticky top-0 z-30 shadow-md">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setMobileMenu(true)}
              className="md:hidden p-2 text-indigo-200 hover:bg-indigo-900/60 rounded-lg transition cursor-pointer"
              aria-label="Open sidebar"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold capitalize tracking-tight text-white">
                {currentTab === 'assignments' ? 'Incident Reports' : currentTab === 'accepted' ? 'Assigned Cases' : currentTab}
              </h1>
              <p className="text-xs md:text-sm text-sky-200 hidden sm:block font-medium">
                University Medical Clinic • SAFE Portal Staff
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Live Date and Time Badge */}
            <div className="hidden md:flex flex-col text-right border-r border-indigo-900 pr-4">
              <span className="text-sm font-bold text-white">
                {currentDateTime.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
              <span className="text-xs font-mono text-sky-300 font-bold">
                {currentDateTime.toLocaleTimeString()}
              </span>
            </div>

            {/* SEARCH BAR WITH LIVE DROPDOWN RESULTS */}
            <div className="relative hidden lg:block" ref={searchContainerRef}>
              <div className="relative flex items-center">
                <Search className="w-4 h-4 absolute left-3.5 text-indigo-300" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setIsSearchFocused(true);
                  }}
                  onFocus={() => setIsSearchFocused(true)}
                  placeholder="Search incidents, reporters, locations..."
                  className="pl-10 pr-8 py-2 w-80 text-sm bg-indigo-950/80 text-white placeholder-indigo-300 border border-indigo-800 rounded-xl focus:outline-none focus:bg-indigo-950 focus:border-sky-400 focus:ring-2 focus:ring-sky-500/20 transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 text-indigo-300 hover:text-white"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* LIVE SEARCH RESULTS DROPDOWN */}
              {isSearchFocused && searchQuery.trim().length > 0 && (
                <div className="absolute right-0 mt-2 w-96 bg-white rounded-2xl shadow-2xl border border-[#BAE6FD] py-2 z-50 max-h-96 overflow-y-auto divide-y divide-slate-100 text-slate-800">
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Search Results ({filteredIncidents.length})
                    </span>
                    <span className="text-[11px] text-sky-600 font-medium">Matching Type, Reporter, Location</span>
                  </div>

                  {filteredIncidents.length > 0 ? (
                    filteredIncidents.map((item) => (
                      <div
                        key={item.incident_id}
                        onClick={() => {
                          setCurrentTab('assignments');
                          setIsSearchFocused(false);
                        }}
                        className="p-3.5 hover:bg-sky-50 transition cursor-pointer flex items-start space-x-3"
                      >
                        <div className="p-2 rounded-xl bg-sky-100 text-sky-700 shrink-0 mt-0.5">
                          <ShieldAlert className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-900 truncate">
                              #{item.incident_id} • {item.incident_name}
                            </span>
                            <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-sky-50 text-sky-700 font-semibold shrink-0 border border-sky-200">
                              {item.status ?? 'pending'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 truncate mt-0.5">📍 {item.location_description ?? 'No location specified'}</p>
                          <p className="text-[11px] text-slate-500 truncate">👤 Reported by: <strong className="text-slate-700">{item.reporter_name}</strong></p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-6 text-center text-xs text-slate-400">
                      No matching incidents found for "{searchQuery}"
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* NOTIFICATIONS DROPDOWN */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  setShowProfileMenu(false);
                }}
                className={`relative p-2.5 rounded-xl text-indigo-200 hover:bg-indigo-900/60 transition cursor-pointer ${
                  showNotifications ? 'bg-indigo-950 text-sky-400' : ''
                }`}
                aria-label="Notifications"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-[#201B50] animate-pulse" />
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-[#BAE6FD] py-2 z-50 text-slate-800">
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-sm text-slate-900">Notifications</span>
                      {unreadCount > 0 && (
                        <span className="bg-sky-100 text-sky-800 text-xs px-2 py-0.5 rounded-full font-semibold">
                          {unreadCount} new
                        </span>
                      )}
                    </div>
                    {notifications.length > 0 && (
                      <button
                        onClick={() => setNotifications(notifications.map(n => ({ ...n, unread: false })))}
                        className="text-xs font-semibold text-sky-600 hover:underline cursor-pointer"
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {notifications.length > 0 ? (
                      notifications.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => {
                            setNotifications(notifications.map(n => n.id === item.id ? { ...n, unread: false } : n));
                            setShowNotifications(false);
                            setCurrentTab('assignments');
                          }}
                          className={`p-3.5 hover:bg-slate-50 transition cursor-pointer flex items-start space-x-3 ${
                            item.unread ? 'bg-sky-50/50' : ''
                          }`}
                        >
                          <div className={`p-2 rounded-xl mt-0.5 ${
                            item.type === 'critical' ? 'bg-rose-100 text-rose-600' : 'bg-sky-100 text-sky-600'
                          }`}>
                            <AlertTriangle className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-semibold text-slate-900 truncate">{item.title}</p>
                              <span className="text-[10px] text-slate-400 shrink-0">{item.time}</span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{item.message}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-6 text-center text-xs text-slate-400">No incident notifications</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* PROFILE DROPDOWN */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowProfileMenu(!showProfileMenu);
                  setShowNotifications(false);
                }}
                className="flex items-center space-x-2 p-1.5 rounded-xl hover:bg-indigo-900/60 transition focus:outline-none cursor-pointer"
              >
                <div className="w-10 h-10 rounded-full bg-sky-600 flex items-center justify-center font-bold text-white text-sm ring-2 ring-sky-400/40 shadow-sm">
                  {initials}
                </div>
                <ChevronDown className="w-4 h-4 text-indigo-300 hidden sm:block" />
              </button>

              {showProfileMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-[#BAE6FD] py-1.5 z-50 text-slate-800">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <p className="text-sm font-bold text-slate-900">{displayName}</p>
                    <p className="text-xs text-slate-500 truncate">Clinic Staff Portal</p>
                    <span className="inline-block mt-1.5 px-2 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-800 rounded-md">Available</span>
                  </div>
                  <div className="pt-1">
                    <button
                      onClick={onLogout}
                      className="w-full text-left px-4 py-2.5 text-xs text-rose-600 hover:bg-rose-50 font-semibold flex items-center space-x-2 cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 text-rose-500" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        </header>

        {/* VIEW AREA */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">

          {/* ACTIVE SEARCH FILTER STATUS BANNER */}
          {searchQuery && (
            <div className="mb-6 flex items-center justify-between bg-sky-50 border border-sky-200 px-4 py-3 rounded-2xl max-w-7xl mx-auto shadow-sm">
              <p className="text-xs text-sky-900">
                Found <strong className="font-bold">{filteredIncidents.length}</strong> matching result(s) for query: <strong className="font-bold">"{searchQuery}"</strong>
              </p>
              <button
                onClick={() => setSearchQuery('')}
                className="text-xs font-semibold text-sky-700 hover:text-sky-900 underline cursor-pointer shrink-0 ml-2"
              >
                Clear Search
              </button>
            </div>
          )}

          {/* AVAILABILITY TOGGLE HEADER (ONLY ON DASHBOARD) */}
          {currentTab === 'dashboard' && (
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4 max-w-7xl mx-auto">
              <div>
                <p className="text-sm text-slate-600 font-medium">Clinic Staff Portal Overview</p>
                <h1 className="mt-1 text-2xl md:text-3xl font-extrabold text-slate-900">Good morning, {displayName}</h1>
              </div>
              <div className="flex rounded-xl border border-[#BAE6FD] bg-white p-1 shadow-sm">
                {['available', 'busy', 'offline'].map((status) => (
                  <button
                    key={status}
                    onClick={() => void updateAvailability(status)}
                    className={`rounded-lg px-3.5 py-2 text-xs font-semibold capitalize transition-all cursor-pointer ${
                      availability.toLowerCase() === status
                        ? status === 'available'
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : status === 'busy'
                          ? 'bg-amber-600 text-white shadow-sm'
                          : 'bg-slate-700 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 max-w-7xl mx-auto">{error}</div>}

          {/* DASHBOARD TAB CONTENT */}
          {currentTab === 'dashboard' && (
            <div className="max-w-7xl mx-auto space-y-6">
              {/* Reference-Matched 4-Card Metrics Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-[#BAE6FD] shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">All Active Incidents</p>
                    <p className="text-3xl font-extrabold text-slate-900 mt-1">{allActiveIncidentsCount}</p>
                    <p className="text-[11px] text-sky-600 mt-1 font-medium">Total Tracked</p>
                  </div>
                  <div className="p-3 bg-sky-50 text-sky-600 rounded-2xl border border-sky-100">
                    <Activity className="w-6 h-6" />
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-[#BAE6FD] shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Active Emergencies</p>
                    <p className="text-3xl font-extrabold text-slate-900 mt-1">{activeCount}</p>
                    <p className="text-[11px] text-rose-600 mt-1 font-medium">Requires Attention</p>
                  </div>
                  <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl border border-rose-100">
                    <ShieldAlert className="w-6 h-6" />
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-[#BAE6FD] shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Assigned Cases</p>
                    <p className="text-3xl font-extrabold text-slate-900 mt-1">{assignedCount}</p>
                    <p className="text-[11px] text-blue-600 mt-1">Under Management</p>
                  </div>
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100">
                    <ClipboardList className="w-6 h-6" />
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-[#BAE6FD] shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Pending Reports</p>
                    <p className="text-3xl font-extrabold text-slate-900 mt-1">{pendingCount}</p>
                    <p className="text-[11px] text-slate-400 mt-1">Awaiting Assignment</p>
                  </div>
                  <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl border border-amber-100">
                    <Clock3 className="w-6 h-6" />
                  </div>
                </div>
              </div>

              {/* TWO-COLUMN LAYOUT: Scrollable Incident Feed on Left, Assigned Cases Card on Lower Right */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                
                {/* Left Side: Recent Incidents Overview (Spans 2 columns) with Scrollable Feed */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-[#BAE6FD] shadow-sm overflow-hidden flex flex-col">
                  <div className="px-6 py-4 border-b border-sky-100 flex items-center justify-between shrink-0">
                    <div>
                      <h2 className="font-bold text-slate-900 text-base">Incident Feed</h2>
                      <p className="text-xs text-slate-500">Prioritized & Filtered Feed</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      {/* STATUS FILTER DROPDOWN FOR FEED */}
                      <div className="flex items-center space-x-1.5 bg-sky-50 border border-sky-200 px-3 py-1.5 rounded-xl">
                        <Filter className="w-3.5 h-3.5 text-sky-600" />
                        <select
                          value={feedStatusFilter}
                          onChange={(e) => setFeedStatusFilter(e.target.value as any)}
                          className="bg-transparent text-xs font-semibold text-sky-900 focus:outline-none cursor-pointer capitalize"
                        >
                          <option value="all">All Status</option>
                          <option value="pending">Pending</option>
                          <option value="active">Active</option>
                          <option value="assigned">Assigned</option>
                          <option value="resolved">Resolved</option>
                        </select>
                      </div>

                      <button
                        onClick={() => setCurrentTab('assignments')}
                        className="text-xs font-semibold text-sky-600 hover:text-sky-700 flex items-center space-x-1 cursor-pointer hidden sm:flex"
                      >
                        <span>View all</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Scrollable Feed Container */}
                  <div className="max-h-[440px] overflow-y-auto divide-y divide-sky-50">
                    {prioritizedAndFilteredIncidents.map((inc) => (
                      <div key={inc.incident_id} className="p-4 sm:px-6 flex items-center justify-between hover:bg-sky-50/40 transition">
                        <div className="flex items-start space-x-3 min-w-0">
                          <div className="p-2.5 rounded-xl bg-sky-50 text-sky-600 shrink-0 mt-0.5 border border-sky-100">
                            <Stethoscope className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">
                              #{inc.incident_id} • {inc.incident_name}
                            </p>
                            <p className="text-xs text-slate-500 truncate mt-0.5">📍 {inc.location_description || 'Campus'} • Reported by {inc.reporter_name}</p>
                          </div>
                        </div>
                        <span className={`text-[11px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider shrink-0 ml-2 ${
                          inc.status === 'resolved' ? 'bg-emerald-100 text-emerald-800' :
                          inc.status === 'active' || inc.status === 'critical' ? 'bg-rose-100 text-rose-800' :
                          ['assigned', 'accepted', 'responding'].includes(inc.status || '') ? 'bg-blue-100 text-blue-800' : 'bg-sky-100 text-sky-800'
                        }`}>
                          {inc.status || 'pending'}
                        </span>
                      </div>
                    ))}
                    {prioritizedAndFilteredIncidents.length === 0 && (
                      <div className="p-8 text-center text-sm text-slate-400">No incident reports found for this filter.</div>
                    )}
                  </div>
                </div>

                {/* Right Side / Lower Right: Your Assigned Cases Card */}
                <div className="bg-white rounded-2xl border border-[#BAE6FD] shadow-sm overflow-hidden sticky top-28">
                  <div className="px-5 py-4 border-b border-sky-100 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <ClipboardList className="w-4 h-4 text-sky-600" />
                      <h2 className="font-bold text-slate-900 text-sm">Assigned Cases</h2>
                    </div>
                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                      {assignedCount} Active
                    </span>
                  </div>
                  <p className="px-5 pt-2.5 text-[11px] text-slate-500">
                    Cases managed by {displayName}
                  </p>

                  <div className="p-4 space-y-3 max-h-[420px] overflow-y-auto">
                    {acceptedIncidents.map((inc) => {
                      const statusText = (inc.status || 'ASSIGNED').toUpperCase();
                      return (
                        <div
                          key={inc.incident_id}
                          className="bg-white border border-[#BAE6FD] rounded-xl p-3.5 shadow-sm hover:border-sky-300 transition"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center space-x-2.5">
                              <div className="w-8 h-8 rounded-full bg-sky-50 text-sky-600 flex items-center justify-center font-bold text-[11px] shrink-0 border border-sky-100">
                                #{inc.incident_id}
                              </div>
                              <div className="min-w-0">
                                <h3 className="text-xs font-bold text-slate-900 truncate capitalize">
                                  {inc.incident_name}
                                </h3>
                                <p className="text-[11px] text-slate-500 truncate">📍 {inc.location_description || 'Building 9'}</p>
                              </div>
                            </div>
                            <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                              statusText === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-sky-50 text-sky-700 border-sky-200'
                            }`}>
                              {statusText}
                            </span>
                          </div>

                          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                            <span className="text-slate-500 truncate">
                              👤 <strong className="text-slate-700">{inc.reporter_name}</strong>
                            </span>
                            <div className="flex items-center space-x-2 shrink-0">
                              <button
                                onClick={() => void updateIncidentStatus(inc.incident_id, 'resolved')}
                                className="text-emerald-600 hover:text-emerald-700 font-semibold transition cursor-pointer"
                              >
                                Resolve
                              </button>
                              <span className="text-slate-300">•</span>
                              <button
                                onClick={() => {
                                  const nextStatus = inc.status === 'active' ? 'assigned' : 'active';
                                  void updateIncidentStatus(inc.incident_id, nextStatus);
                                }}
                                className="text-sky-600 hover:text-sky-700 font-semibold flex items-center space-x-0.5 transition cursor-pointer"
                              >
                                <span>Status</span>
                                <ChevronRight className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {acceptedIncidents.length === 0 && (
                      <div className="py-8 text-center text-xs text-slate-400">
                        No active assigned cases right now.
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* INCIDENT REPORTS TAB CONTENT */}
          {currentTab === 'assignments' && (
            <div className="max-w-7xl mx-auto space-y-4">
              <div className="bg-white rounded-2xl border border-[#BAE6FD] shadow-sm overflow-hidden flex flex-col">
                <div className="px-6 py-5 border-b border-sky-100 flex flex-wrap items-center justify-between gap-4 shrink-0">
                  <div>
                    <h2 className="font-bold text-slate-900 text-lg">All Incoming & Pending Incidents</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Prioritized: Pending $\rightarrow$ Active/Assigned $\rightarrow$ Resolved</p>
                  </div>

                  {/* STATUS FILTER DROPDOWN */}
                  <div className="flex items-center space-x-2 bg-sky-50 border border-sky-200 px-3.5 py-2 rounded-xl">
                    <Filter className="w-4 h-4 text-sky-600" />
                    <span className="text-xs font-semibold text-sky-800">Filter Status:</span>
                    <select
                      value={feedStatusFilter}
                      onChange={(e) => setFeedStatusFilter(e.target.value as any)}
                      className="bg-white border border-sky-200 text-xs font-semibold text-slate-700 px-2.5 py-1 rounded-lg focus:outline-none focus:border-sky-500 cursor-pointer capitalize shadow-sm"
                    >
                      <option value="all">All Statuses</option>
                      <option value="pending">Pending</option>
                      <option value="active">Active</option>
                      <option value="assigned">Assigned</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </div>
                </div>

                {/* Scrollable Feed Container for Assignments Tab */}
                <div className="max-h-[600px] overflow-y-auto divide-y divide-sky-50">
                  {prioritizedAndFilteredIncidents.map((inc) => (
                    <div key={inc.incident_id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-sky-50/30 transition">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-slate-900">#{inc.incident_id}</span>
                          <span className="text-sky-700 font-semibold text-sm">• {inc.incident_name}</span>
                          <span className={`text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full ${
                            inc.status === 'resolved' ? 'bg-emerald-100 text-emerald-800' :
                            inc.status === 'active' || inc.status === 'critical' ? 'bg-rose-100 text-rose-800' :
                            ['assigned', 'accepted', 'responding'].includes(inc.status || '') ? 'bg-blue-100 text-blue-800' : 'bg-sky-100 text-sky-800'
                          }`}>
                            {inc.status || 'pending'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600">📍 Location: <strong className="text-slate-800">{inc.location_description || 'Not specified'}</strong></p>
                        <p className="text-xs text-slate-600">👤 Reporter: <strong className="text-slate-800">{inc.reporter_name}</strong></p>
                        {inc.description && <p className="text-xs text-slate-600 bg-sky-50/80 border border-sky-100 p-2.5 rounded-xl mt-2">"{inc.description}"</p>}
                      </div>
                      <div className="flex items-center space-x-2 shrink-0">
                        <select
                          value={inc.status || 'pending'}
                          onChange={(e) => void updateIncidentStatus(inc.incident_id, e.target.value)}
                          className="text-xs bg-white border border-[#BAE6FD] rounded-xl px-3 py-2.5 font-semibold text-slate-700 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 shadow-sm cursor-pointer"
                        >
                          <option value="pending">Pending</option>
                          <option value="assigned">Assigned</option>
                          <option value="accepted">Accepted</option>
                          <option value="active">Active</option>
                          <option value="resolved">Resolved</option>
                        </select>
                      </div>
                    </div>
                  ))}
                  {prioritizedAndFilteredIncidents.length === 0 && (
                    <div className="p-12 text-center text-sm text-slate-400">No incident reports found for this filter.</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ASSIGNED CASES TAB CONTENT */}
          {currentTab === 'accepted' && (
            <div className="max-w-7xl mx-auto space-y-6">
              <div className="bg-white rounded-2xl border border-[#BAE6FD] shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-sky-100 flex items-center justify-between">
                  <div>
                    <h2 className="font-bold text-slate-900 text-lg">Your Assigned Cases</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Cases actively assigned to or handled by {displayName}</p>
                  </div>
                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold px-3.5 py-1.5 rounded-full">
                    {assignedCount} Active
                  </span>
                </div>

                <div className="p-6 space-y-4 max-h-[600px] overflow-y-auto">
                  {acceptedIncidents.map((inc) => {
                    const statusText = (inc.status || 'ASSIGNED').toUpperCase();
                    return (
                      <div
                        key={inc.incident_id}
                        className="bg-white border border-[#BAE6FD] rounded-xl p-5 shadow-sm hover:border-sky-300 transition"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 rounded-full bg-sky-50 text-sky-600 flex items-center justify-center font-bold text-xs shrink-0 border border-sky-100">
                              #{inc.incident_id}
                            </div>
                            <div>
                              <h3 className="text-sm font-bold text-slate-900 capitalize">
                                {inc.incident_name}
                              </h3>
                              <p className="text-xs text-slate-500 mt-0.5">📍 {inc.location_description || 'Building 9 3rd Floor'}</p>
                            </div>
                          </div>
                          <span className={`text-[10px] uppercase font-bold px-3 py-1 rounded-full border ${
                            statusText === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-sky-50 text-sky-700 border-sky-200'
                          }`}>
                            {statusText}
                          </span>
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs gap-2">
                          <span className="text-slate-500">
                            👤 Reported by: <strong className="text-slate-700">{inc.reporter_name}</strong>
                          </span>
                          <div className="flex items-center space-x-3">
                            <button
                              onClick={() => void updateIncidentStatus(inc.incident_id, 'resolved')}
                              className="text-emerald-600 hover:text-emerald-700 font-semibold transition cursor-pointer"
                            >
                              Mark Resolved
                            </button>
                            <span className="text-slate-300">•</span>
                            <button
                              onClick={() => {
                                const nextStatus = inc.status === 'active' ? 'assigned' : 'active';
                                void updateIncidentStatus(inc.incident_id, nextStatus);
                              }}
                              className="text-sky-600 hover:text-sky-700 font-semibold flex items-center space-x-1 transition cursor-pointer"
                            >
                              <span>Edit Status</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {acceptedIncidents.length === 0 && (
                    <div className="p-12 text-center text-xs text-slate-400">
                      No active assigned cases right now.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* SCHEDULE TAB CONTENT */}
          {currentTab === 'schedule' && (
            <div className="max-w-7xl mx-auto space-y-6">
              <div className="bg-white rounded-2xl border border-[#BAE6FD] shadow-sm p-6 sm:p-8">
                <h2 className="font-bold text-slate-900 text-lg mb-1">Clinic Staff Duty Roster</h2>
                <p className="text-xs text-slate-500 mb-6">Weekly shift schedule and emergency standby assignments.</p>
               
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-5 rounded-2xl border border-sky-100 bg-sky-50/50">
                    <p className="text-xs font-bold text-sky-700 uppercase tracking-wider">Today's Shift</p>
                    <p className="text-base font-bold text-slate-900 mt-1">08:00 AM – 05:00 PM</p>
                    <p className="text-xs text-slate-600 mt-2">Status: <span className="text-emerald-600 font-semibold capitalize">{availability}</span></p>
                  </div>
                  <div className="p-5 rounded-2xl border border-sky-100 bg-sky-50/50">
                    <p className="text-xs font-bold text-sky-700 uppercase tracking-wider">Assigned Station</p>
                    <p className="text-base font-bold text-slate-900 mt-1">Main University Clinic</p>
                    <p className="text-xs text-slate-600 mt-2">Room 102 • Emergency Response Unit</p>
                  </div>
                  <div className="p-5 rounded-2xl border border-sky-100 bg-sky-50/50">
                    <p className="text-xs font-bold text-sky-700 uppercase tracking-wider">Standby Partner</p>
                    <p className="text-base font-bold text-slate-900 mt-1">Main University Medical Team B</p>
                    <p className="text-xs text-slate-600 mt-2">Hotline: Ext. 402</p>
                  </div>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}