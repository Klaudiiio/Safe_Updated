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
  CheckCircle,
  AlertTriangle,
  Stethoscope,
  X,
  ChevronDown,
  Filter,
  MapPin,
  Check
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
          title: `Incident #${inc.incident_id}`,
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
        fixed md:static inset-y-0 left-0 z-50 w-64 bg-gradient-to-r from-[#151130] via-[#1a153b] to-[#231e4d] flex flex-col justify-between transform transition-transform duration-200 ease-in-out shadow-xl border-r border-indigo-950/60 p-4
        ${mobileMenu ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="space-y-4">
          {/* Clickable Brand Logo Header */}
          <div className="h-20 px-4 flex items-center justify-between border-b border-indigo-950/60">
            <button
              onClick={() => {
                setCurrentTab('dashboard');
                setMobileMenu(false);
              }}
              className="flex items-center space-x-3 text-left focus:outline-none group cursor-pointer"
              title="Go to Dashboard"
            >
              <div className="bg-sky-500 p-2 rounded-xl text-white shadow-md shadow-sky-500/30 group-hover:bg-sky-400 transition-colors shrink-0">
                <Stethoscope className="w-5 h-5" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-extrabold text-white tracking-wider text-base group-hover:text-sky-200 transition-colors truncate">
                  SAFE
                </span>
                <span className="text-[10px] text-sky-400 tracking-wider uppercase font-semibold truncate">
                  Emergency Monitor
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

          {/* Navigation Links */}
          <nav className="space-y-2">
            <button
              onClick={() => { setCurrentTab('dashboard'); setMobileMenu(false); }}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-2xl text-sm transition-all cursor-pointer shadow-sm ${
                currentTab === 'dashboard'
                  ? 'bg-white text-slate-900 font-extrabold shadow-md border border-sky-100'
                  : 'bg-white/10 hover:bg-white/20 text-white font-semibold'
              }`}
            >
              <Activity className={`w-5 h-5 shrink-0 ${currentTab === 'dashboard' ? 'text-sky-600' : 'text-sky-300'}`} />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => { setCurrentTab('assignments'); setMobileMenu(false); }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-sm transition-all cursor-pointer shadow-sm ${
                currentTab === 'assignments'
                  ? 'bg-white text-slate-900 font-extrabold shadow-md border border-sky-100'
                  : 'bg-white/10 hover:bg-white/20 text-white font-semibold'
              }`}
            >
              <div className="flex items-center space-x-3 min-w-0">
                <ShieldAlert className={`w-5 h-5 shrink-0 ${currentTab === 'assignments' ? 'text-sky-600' : 'text-sky-300'}`} />
                <span className="truncate">Incident Reports</span>
              </div>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold shrink-0 ml-2 ${
                currentTab === 'assignments'
                  ? 'bg-sky-100 text-sky-700'
                  : 'bg-slate-900/40 text-sky-200 border border-sky-400/30'
              }`}>
                {incidents.length}
              </span>
            </button>

            <button
              onClick={() => { setCurrentTab('accepted'); setMobileMenu(false); }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-sm transition-all cursor-pointer shadow-sm ${
                currentTab === 'accepted'
                  ? 'bg-white text-slate-900 font-extrabold shadow-md border border-blue-100'
                  : 'bg-white/10 hover:bg-white/20 text-white font-semibold'
              }`}
            >
              <div className="flex items-center space-x-3 min-w-0">
                <ClipboardList className={`w-5 h-5 shrink-0 ${currentTab === 'accepted' ? 'text-blue-600' : 'text-blue-300'}`} />
                <span className="truncate">Assigned Cases</span>
              </div>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold shrink-0 ml-2 ${
                currentTab === 'accepted'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-slate-900/40 text-blue-200 border border-blue-400/30'
              }`}>
                {assignedCount}
              </span>
            </button>

            <button
              onClick={() => { setCurrentTab('schedule'); setMobileMenu(false); }}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-2xl text-sm transition-all cursor-pointer shadow-sm ${
                currentTab === 'schedule'
                  ? 'bg-white text-slate-900 font-extrabold shadow-md border border-sky-100'
                  : 'bg-white/10 hover:bg-white/20 text-white font-semibold'
              }`}
            >
              <CalendarDays className={`w-5 h-5 shrink-0 ${currentTab === 'schedule' ? 'text-sky-600' : 'text-sky-300'}`} />
              <span>Schedule</span>
            </button>
          </nav>
        </div>

        {/* User Footer Card */}
        <div className="bg-white/95 backdrop-blur-md rounded-2xl p-3.5 shadow-lg border border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-sky-600 flex items-center justify-center font-bold text-white text-sm shrink-0 shadow-md shadow-sky-600/30">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900 truncate">{displayName}</p>
              <p className="text-[11px] text-sky-600 font-semibold truncate">Clinic Staff</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            title="Sign out"
            className="text-slate-400 hover:text-rose-600 p-2 rounded-xl hover:bg-rose-50 transition-colors cursor-pointer shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
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
                  className="pl-10 pr-8 py-2 w-80 text-sm bg-indigo-950/80 text-white placeholder-indigo-300 border border-indigo-800 rounded-xl focus:outline-none focus:bg-indigo-950 focus:border-sky-400 focus:ring-2 focus:ring-sky-500/20 transition-all font-medium"
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
                              #{item.incident_id} {item.incident_name}
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
                    <div className="p-6 text-center text-xs text-slate-400 font-medium">
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
                              <span className="text-[10px] text-slate-400 shrink-0 font-medium">{item.time}</span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 font-normal">{item.message}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-6 text-center text-xs text-slate-400 font-medium">No incident notifications</div>
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
                    <p className="text-xs text-slate-500 truncate font-medium">Clinic Staff Portal</p>
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

        {/* CONTENT AREA */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          {error && (
            <div className="mb-6 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm font-medium flex items-center justify-between">
              <span>{error}</span>
              <button onClick={() => setError('')} className="text-rose-500 hover:text-rose-700">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* TAB: DASHBOARD OVERVIEW */}
          {currentTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Stat Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center space-x-4">
                  <div className="p-3 bg-sky-100 text-sky-600 rounded-xl">
                    <ShieldAlert className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Incidents</p>
                    <p className="text-2xl font-extrabold text-slate-900">{incidents.length}</p>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center space-x-4">
                  <div className="p-3 bg-amber-100 text-amber-600 rounded-xl">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending / Active</p>
                    <p className="text-2xl font-extrabold text-slate-900">{pendingCount + activeCount}</p>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center space-x-4">
                  <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
                    <ClipboardList className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Assigned Cases</p>
                    <p className="text-2xl font-extrabold text-slate-900">{assignedCount}</p>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center space-x-4">
                  <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Staff Status</p>
                    <p className="text-sm font-bold capitalize text-emerald-700 mt-1 flex items-center space-x-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-ping" />
                      <span>{availability}</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick Actions & Status Control */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center space-x-2">
                  <Activity className="w-5 h-5 text-sky-600" />
                  <span>Update Your Availability Status</span>
                </h3>
                <div className="flex flex-wrap gap-3">
                  {['available', 'busy', 'on-leave', 'offline'].map((status) => (
                    <button
                      key={status}
                      onClick={() => updateAvailability(status)}
                      className={`px-4 py-2.5 rounded-xl text-xs font-bold capitalize transition-all cursor-pointer ${
                        availability === status
                          ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              {/* RECENT INCIDENT FEED & LOWER RIGHT ASSIGNED CASES GRID */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Recent Incident Feed (Takes 2 columns) */}
                <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                  <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">Recent Incident Feed</h3>
                      <p className="text-xs text-slate-500 mt-0.5">Prioritized incoming emergency reports</p>
                    </div>
                    <button
                      onClick={() => setCurrentTab('assignments')}
                      className="text-xs font-bold text-sky-600 hover:text-sky-700 flex items-center space-x-0.5 cursor-pointer"
                    >
                      <span>View All</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  {loading ? (
                    <div className="py-12 text-center text-slate-400 font-medium text-sm">Loading incident reports...</div>
                  ) : incidents.length > 0 ? (
                    <div className="divide-y divide-slate-100 flex-1">
                      {incidents.slice(0, 4).map((inc) => {
                        const statusLower = (inc.status || 'pending').toLowerCase();
                        let badgeBg = 'bg-amber-50 text-amber-700 border-amber-200';
                        if (statusLower === 'active') badgeBg = 'bg-rose-50 text-rose-700 border-rose-200';
                        else if (['assigned', 'accepted', 'responding'].includes(statusLower)) badgeBg = 'bg-sky-50 text-sky-700 border-sky-200';
                        else if (['resolved', 'completed'].includes(statusLower)) badgeBg = 'bg-emerald-50 text-emerald-700 border-emerald-200';

                        let formattedDate = '';
                        if (inc.reported_at) {
                          const d = new Date(inc.reported_at);
                          const dateStr = d.toLocaleDateString();
                          const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                          formattedDate = `${dateStr}, ${timeStr}`;
                        }

                        return (
                          <div key={inc.incident_id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/60 transition">
                            <div className="flex items-start space-x-4">
                              <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200/60 flex items-center justify-center text-amber-600 shrink-0 mt-0.5 shadow-sm">
                                <ShieldAlert className="w-5 h-5" />
                              </div>
                              
                              <div className="space-y-1">
                                <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
                                  <span className="text-sm font-extrabold text-slate-900">
                                    #{inc.incident_id} {inc.incident_name}
                                  </span>
                                  <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase border ${badgeBg}`}>
                                    {inc.status || 'pending'}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-600 flex items-center space-x-1">
                                  <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                                  <span>{inc.location_description || 'Building 9, 3rd floor'}</span>
                                </p>
                                <p className="text-[11px] text-slate-400 flex items-center space-x-1">
                                  <span>Reported by <strong className="text-slate-600 font-semibold">{inc.reporter_name}</strong></span>
                                  {formattedDate && (
                                    <>
                                      <span>•</span>
                                      <span>{formattedDate}</span>
                                    </>
                                  )}
                                </p>
                              </div>
                            </div>

                            <button
                              onClick={() => setSelectedIncidentForUpdate(inc)}
                              className="px-4 py-2 bg-[#0EA5E9] hover:bg-[#0284C7] text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-md shadow-sky-500/20 shrink-0 text-center"
                            >
                              Update
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-12 text-center text-slate-400 font-medium text-sm">No incidents reported yet.</div>
                  )}
                </div>

                {/* Lower Right Assigned Cases Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                      <div className="flex items-center space-x-2">
                        <div className="p-2 bg-blue-100 text-blue-600 rounded-xl">
                          <ClipboardList className="w-4 h-4" />
                        </div>
                        <h3 className="text-base font-bold text-slate-900">Assigned Cases</h3>
                      </div>
                      <span className="text-xs font-bold bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full border border-blue-200">
                        {assignedCount} active
                      </span>
                    </div>

                    {acceptedIncidents.length > 0 ? (
                      <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                        {acceptedIncidents.slice(0, 4).map((inc) => (
                          <div key={inc.incident_id} className="p-3.5 rounded-xl border border-sky-100 bg-sky-50/50 hover:bg-sky-50 transition space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-extrabold text-slate-900">#{inc.incident_id} {inc.incident_name}</span>
                              <span className="text-[10px] uppercase px-2 py-0.5 rounded font-bold bg-sky-100 text-sky-800 border border-sky-200">
                                {inc.status}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600 truncate">📍 {inc.location_description || 'Campus location'}</p>
                            <div className="flex justify-end pt-1">
                              <button
                                onClick={() => setSelectedIncidentForUpdate(inc)}
                                className="px-3 py-1 bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-bold rounded-lg transition cursor-pointer shadow-sm"
                              >
                                Update Status
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-16 text-center text-slate-400 text-xs font-medium">
                        No active assigned cases currently.
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => setCurrentTab('accepted')}
                    className="w-full mt-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer text-center"
                  >
                    View All Assigned Cases
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB: INCIDENT REPORTS (ASSIGNMENTS) */}
          {currentTab === 'assignments' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex items-center space-x-2">
                  <Filter className="w-4 h-4 text-slate-400" />
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Filter Status:</span>
                  <select
                    value={feedStatusFilter}
                    onChange={(e) => setFeedStatusFilter(e.target.value as any)}
                    className="text-xs bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                  >
                    <option value="all">All Incidents ({incidents.length})</option>
                    <option value="pending">Pending</option>
                    <option value="active">Active</option>
                    <option value="assigned">Assigned / Responding</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>
                <div className="text-xs text-slate-500 font-medium">
                  Showing {prioritizedAndFilteredIncidents.length} results (Prioritized by urgency)
                </div>
              </div>

              {loading ? (
                <div className="py-16 text-center text-slate-400 font-medium">Loading reports...</div>
              ) : prioritizedAndFilteredIncidents.length > 0 ? (
                <div className="grid grid-cols-1 gap-4">
                  {prioritizedAndFilteredIncidents.map((inc) => (
                    <div key={inc.incident_id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center space-x-3">
                          <span className="text-sm font-extrabold text-slate-900">#{inc.incident_id} • {inc.incident_name}</span>
                          <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase border ${
                            (inc.status || 'pending').toLowerCase() === 'pending'
                              ? 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse'
                              : (inc.status || '').toLowerCase() === 'active'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}>
                            {inc.status || 'pending'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600">📍 <strong>Location:</strong> {inc.location_description || 'Not specified'}</p>
                        <p className="text-xs text-slate-600">👤 <strong>Reporter:</strong> {inc.reporter_name}</p>
                        {inc.description && <p className="text-xs text-slate-500 italic bg-slate-50 p-2.5 rounded-xl border border-slate-100 mt-2">"{inc.description}"</p>}
                      </div>

                      <div className="flex items-center space-x-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                        <button
                          onClick={() => setSelectedIncidentForUpdate(inc)}
                          className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-sm shadow-sky-600/20"
                        >
                          Update Status
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white p-16 rounded-2xl text-center border border-slate-200">
                  <ShieldAlert className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-600 font-bold text-sm">No incident reports found</p>
                  <p className="text-xs text-slate-400 mt-1">Try changing your status filter or search criteria.</p>
                </div>
              )}
            </div>
          )}

          {/* TAB: ASSIGNED CASES */}
          {currentTab === 'accepted' && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <h3 className="text-base font-bold text-slate-900 mb-4">Your Active Assigned Cases</h3>
                {acceptedIncidents.length > 0 ? (
                  <div className="space-y-3">
                    {acceptedIncidents.map((inc) => (
                      <div key={inc.incident_id} className="p-4 rounded-xl border border-sky-100 bg-sky-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <span className="text-xs font-bold text-sky-900">Case #{inc.incident_id}: {inc.incident_name}</span>
                          <p className="text-xs text-slate-600">📍 {inc.location_description || 'Campus'} • Reported by {inc.reporter_name}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => setSelectedIncidentForUpdate(inc)}
                            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition cursor-pointer"
                          >
                            Update Status
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 text-center text-slate-400 text-xs font-medium">No active assigned cases currently.</div>
                )}
              </div>
            </div>
          )}

          {/* TAB: SCHEDULE */}
          {currentTab === 'schedule' && (
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center space-y-3">
              <CalendarDays className="w-12 h-12 text-sky-600 mx-auto" />
              <h3 className="text-lg font-bold text-slate-900">Clinic Staff Duty Schedule</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Your duty roster and shift schedules are synchronized with the University Medical Center portal.
              </p>
              <div className="inline-block mt-4 px-4 py-2 bg-sky-50 text-sky-700 font-bold text-xs rounded-xl border border-sky-200">
                Current Shift: Mon - Fri (08:00 AM - 05:00 PM)
              </div>
            </div>
          )}
        </main>
      </div>

      {/* UPDATE STATUS MODAL */}
      {selectedIncidentForUpdate && (
        <div className="fixed inset-0 bg-[#151130]/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-950">Update Incident Status</h3>
                <p className="text-xs text-slate-500 mt-0.5">Incident #{selectedIncidentForUpdate?.incident_id} • {selectedIncidentForUpdate?.incident_name}</p>
              </div>
              <button
                onClick={() => setSelectedIncidentForUpdate(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Select New Status</label>
              
              <div className="space-y-1.5">
                {[
                  { key: 'pending', label: 'Pending', desc: 'Awaiting review or triage' },
                  { key: 'active', label: 'Active', desc: 'Currently being handled' },
                  { key: 'assigned', label: 'Assigned', desc: 'Responder en route / assigned' },
                  { key: 'resolved', label: 'Resolved', desc: 'Case closed and completed' },
                ].map((st) => {
                  const currentStatus = (selectedIncidentForUpdate?.status || 'pending').toLowerCase();
                  const isSelected = currentStatus === st.key;

                  return (
                    <button
                      key={st.key}
                      onClick={() => updateIncidentStatus(selectedIncidentForUpdate!.incident_id, st.key)}
                      className={`w-full text-left p-3.5 rounded-xl border transition flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? 'bg-sky-50 border-sky-300 shadow-sm'
                          : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <div>
                        <p className={`text-xs font-extrabold uppercase ${isSelected ? 'text-sky-900' : 'text-slate-900'}`}>
                          {st.label}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">{st.desc}</p>
                      </div>
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center shrink-0">
                          <Check className="w-3 h-3" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedIncidentForUpdate(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}