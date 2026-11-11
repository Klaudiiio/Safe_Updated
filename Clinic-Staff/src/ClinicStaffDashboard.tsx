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

        // Format relative time or timestamp
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

  // Robust multi-parameter search filter for incidents
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
  const resolvedCount = incidents.filter((row) => ['resolved', 'completed'].includes(row.status?.toLowerCase() ?? '')).length;

  const unassignedIncidents = filteredIncidents.filter((row) => {
    const s = row.status?.toLowerCase() ?? 'pending';
    return !['assigned', 'accepted', 'resolved', 'completed', 'cancelled', 'responding'].includes(s);
  });
 
  const acceptedIncidents = filteredIncidents.filter((row) => {
    const s = row.status?.toLowerCase() ?? '';
    return ['assigned', 'accepted', 'responding', 'active'].includes(s);
  });

  const unreadCount = notifications.filter(n => n.unread).length;
  const initials = displayName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col md:flex-row antialiased">

      {/* MOBILE SIDEBAR OVERLAY */}
      {mobileMenu && (
        <div
          className="fixed inset-0 bg-slate-900/50 z-40 md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setMobileMenu(false)}
        />
      )}

      {/* SIDEBAR NAVIGATION */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-300 flex flex-col justify-between transform transition-transform duration-200 ease-in-out
        ${mobileMenu ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div>
          {/* Clickable Brand Logo Header */}
          <div className="h-20 px-6 flex items-center justify-between border-b border-slate-800">
            <button
              onClick={() => {
                setCurrentTab('dashboard');
                setMobileMenu(false);
              }}
              className="flex items-center space-x-3 text-left focus:outline-none group cursor-pointer"
              title="Go to Dashboard"
            >
              <div className="bg-teal-500 p-2 rounded-lg text-white shadow-md shadow-teal-500/20 group-hover:bg-teal-400 transition-colors">
                <Stethoscope className="w-5 h-5" />
              </div>
              <span className="font-bold text-lg text-white tracking-wide group-hover:text-teal-300 transition-colors">
                SAFE <span className="text-teal-400 font-normal text-xs uppercase px-1.5 py-0.5 rounded bg-teal-950 border border-teal-800 ml-1">Staff</span>
              </span>
            </button>
            <button
              onClick={() => setMobileMenu(false)}
              className="md:hidden text-slate-400 hover:text-white p-1 rounded-md"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1.5">
            <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Main Menu</p>
           
            <button
              onClick={() => { setCurrentTab('dashboard'); setMobileMenu(false); }}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                currentTab === 'dashboard'
                  ? 'bg-teal-600 text-white shadow-md shadow-teal-600/30'
                  : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Activity className="w-5 h-5" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => { setCurrentTab('assignments'); setMobileMenu(false); }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                currentTab === 'assignments'
                  ? 'bg-teal-600 text-white shadow-md shadow-teal-600/30'
                  : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center space-x-3">
                <ShieldAlert className="w-5 h-5" />
                <span>Incident Reports</span>
              </div>
              <span className="bg-amber-500/20 text-amber-400 text-xs px-2 py-0.5 rounded-full border border-amber-500/30 font-semibold">{incidents.length}</span>
            </button>

            <button
              onClick={() => { setCurrentTab('accepted'); setMobileMenu(false); }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                currentTab === 'accepted'
                  ? 'bg-teal-600 text-white shadow-md shadow-teal-600/30'
                  : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center space-x-3">
                <ClipboardList className="w-5 h-5" />
                <span>Assigned Cases</span>
              </div>
              <span className="bg-teal-500/20 text-teal-300 text-xs px-2 py-0.5 rounded-full border border-teal-500/30 font-semibold">{assignedCount}</span>
            </button>

            <button
              onClick={() => { setCurrentTab('schedule'); setMobileMenu(false); }}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                currentTab === 'schedule'
                  ? 'bg-teal-600 text-white shadow-md shadow-teal-600/30'
                  : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <CalendarDays className="w-5 h-5" />
              <span>Schedule</span>
            </button>
          </nav>
        </div>

        {/* User Footer */}
        <div className="p-4 border-t border-slate-800">
          <div className="bg-slate-800/60 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center space-x-3 overflow-hidden">
              <div className="w-9 h-9 rounded-full bg-teal-700 flex items-center justify-center font-bold text-white text-sm shrink-0">
                {initials}
              </div>
              <div className="truncate">
                <p className="text-sm font-medium text-white truncate">{displayName}</p>
                <p className="text-xs text-slate-400 truncate">Clinic Staff</p>
              </div>
            </div>
            <button
              onClick={onLogout}
              title="Sign out"
              className="text-slate-400 hover:text-rose-400 p-1.5 rounded-lg hover:bg-slate-700/50 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTAINER */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* HEADER BAR */}
        <header className="h-20 bg-white border-b border-slate-200 px-4 md:px-8 flex items-center justify-between sticky top-0 z-30 shadow-sm">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setMobileMenu(true)}
              className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              aria-label="Open sidebar"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900 capitalize tracking-tight">
                {currentTab === 'assignments' ? 'Incident Reports' : currentTab === 'accepted' ? 'Assigned Cases' : currentTab}
              </h1>
              <p className="text-sm text-slate-500 hidden sm:block font-medium">
                University Medical Clinic • SAFE Portal Staff
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Live Date and Time Badge */}
            <div className="hidden md:flex flex-col text-right border-r border-slate-200 pr-4">
              <span className="text-base font-bold text-slate-800">
                {currentDateTime.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
              <span className="text-base font-mono text-teal-600 font-bold">
                {currentDateTime.toLocaleTimeString()}
              </span>
            </div>

            {/* SEARCH BAR WITH LIVE DROPDOWN RESULTS */}
            <div className="relative hidden lg:block" ref={searchContainerRef}>
              <div className="relative flex items-center">
                <Search className="w-4 h-4 absolute left-3 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setIsSearchFocused(true);
                  }}
                  onFocus={() => setIsSearchFocused(true)}
                  placeholder="Search type, reporter, location..."
                  className="pl-9 pr-8 py-2 w-72 text-sm bg-slate-100 border border-transparent rounded-lg focus:outline-none focus:bg-white focus:border-teal-500 transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 text-slate-400 hover:text-slate-600"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* LIVE SEARCH RESULTS DROPDOWN */}
              {isSearchFocused && searchQuery.trim().length > 0 && (
                <div className="absolute left-0 mt-2 w-96 bg-white rounded-xl shadow-2xl border border-slate-200 py-2 z-50 max-h-96 overflow-y-auto divide-y divide-slate-100">
                  <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Search Results ({filteredIncidents.length})
                    </span>
                    <span className="text-[11px] text-teal-600 font-medium">Matching Type, Reporter, Location</span>
                  </div>

                  {filteredIncidents.length > 0 ? (
                    filteredIncidents.map((item) => (
                      <div
                        key={item.incident_id}
                        onClick={() => {
                          setCurrentTab('assignments');
                          setIsSearchFocused(false);
                        }}
                        className="p-3 hover:bg-teal-50/60 transition cursor-pointer flex items-start space-x-3"
                      >
                        <div className="p-2 rounded-lg bg-teal-100 text-teal-700 shrink-0 mt-0.5">
                          <ShieldAlert className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-900 truncate">
                              #{item.incident_id} - {item.incident_name}
                            </span>
                            <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold shrink-0">
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
                className={`relative p-2.5 rounded-lg text-slate-600 hover:bg-slate-100 transition cursor-pointer ${
                  showNotifications ? 'bg-slate-100 text-teal-600' : ''
                }`}
                aria-label="Notifications"
              >
                <Bell className="w-6 h-6" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-3 h-3 bg-rose-500 rounded-full ring-2 ring-white animate-pulse" />
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50">
                  <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-sm text-slate-800">Notifications</span>
                      {unreadCount > 0 && (
                        <span className="bg-teal-100 text-teal-800 text-xs px-2 py-0.5 rounded-full font-medium">
                          {unreadCount} new
                        </span>
                      )}
                    </div>
                    {notifications.length > 0 && (
                      <button
                        onClick={() => setNotifications(notifications.map(n => ({ ...n, unread: false })))}
                        className="text-[11px] font-semibold text-teal-600 hover:underline cursor-pointer"
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
                            item.unread ? 'bg-teal-50/40' : ''
                          }`}
                        >
                          <div className={`p-2 rounded-full mt-0.5 ${
                            item.type === 'critical' ? 'bg-rose-100 text-rose-600' : 'bg-teal-100 text-teal-600'
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
                className="flex items-center space-x-2 p-1.5 rounded-lg hover:bg-slate-100 transition focus:outline-none cursor-pointer"
              >
                <div className="w-10 h-10 rounded-full bg-teal-600 flex items-center justify-center font-bold text-white text-sm ring-2 ring-teal-100">
                  {initials}
                </div>
                <ChevronDown className="w-4 h-4 text-slate-500 hidden sm:block" />
              </button>

              {showProfileMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-50">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <p className="text-sm font-semibold text-slate-900">{displayName}</p>
                    <p className="text-xs text-slate-500 truncate">Clinic Staff Portal</p>
                    <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-800 rounded">Available</span>
                  </div>
                  <div className="border-t border-slate-100 pt-1">
                    <button
                      onClick={onLogout}
                      className="w-full text-left px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 font-medium flex items-center space-x-2 cursor-pointer"
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
        <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50/50">

          {/* ACTIVE SEARCH FILTER STATUS BANNER */}
          {searchQuery && (
            <div className="mb-4 flex items-center justify-between bg-teal-50 border border-teal-200 px-4 py-2.5 rounded-lg max-w-7xl mx-auto shadow-sm">
              <p className="text-xs text-teal-900">
                Found <strong className="font-bold">{filteredIncidents.length}</strong> matching result(s) for query: <strong className="font-bold">"{searchQuery}"</strong> (matching incident type, reporter, location, or status)
              </p>
              <button
                onClick={() => setSearchQuery('')}
                className="text-xs font-semibold text-teal-700 hover:text-teal-900 underline cursor-pointer shrink-0 ml-2"
              >
                Clear Search
              </button>
            </div>
          )}

          {/* AVAILABILITY TOGGLE HEADER (ONLY ON DASHBOARD) */}
          {currentTab === 'dashboard' && (
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4 max-w-7xl mx-auto">
              <div>
                <p className="text-sm text-slate-500 font-medium">Clinic Staff Portal Overview</p>
                <h1 className="mt-1 text-3xl font-extrabold text-slate-900">Good morning, {displayName}</h1>
              </div>
              <div className="flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
                {['available', 'busy', 'offline'].map((status) => (
                  <button
                    key={status}
                    onClick={() => void updateAvailability(status)}
                    className={`rounded-md px-3 py-2 text-xs font-semibold capitalize transition-colors cursor-pointer ${
                      availability.toLowerCase() === status
                        ? status === 'available'
                          ? 'bg-emerald-500 text-white shadow-sm'
                          : status === 'busy'
                          ? 'bg-amber-600 text-white shadow-sm'
                          : 'bg-slate-600 text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 max-w-7xl mx-auto">{error}</div>}

          {/* DASHBOARD VIEW */}
          {currentTab === 'dashboard' && (
            <div className="space-y-6 max-w-7xl mx-auto">
             
              {/* Metric Stat Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Pending Reports</p>
                    <h3 className="text-2xl font-bold text-amber-600 mt-1">{pendingCount}</h3>
                    <p className="text-xs text-slate-400 mt-1">Requires review</p>
                  </div>
                  <div className="p-3 rounded-xl text-white bg-amber-500">
                    <Clock3 className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Active Incidents</p>
                    <h3 className="text-2xl font-bold text-red-600 mt-1">{activeCount}</h3>
                    <p className="text-xs text-slate-400 mt-1">Urgent attention</p>
                  </div>
                  <div className="p-3 rounded-xl text-white bg-red-500">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Assigned Cases</p>
                    <h3 className="text-2xl font-bold text-blue-600 mt-1">{assignedCount}</h3>
                    <p className="text-xs text-slate-400 mt-1">Staff assigned</p>
                  </div>
                  <div className="p-3 rounded-xl text-white bg-blue-500">
                    <ClipboardList className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Resolved Cases</p>
                    <h3 className="text-2xl font-bold text-teal-600 mt-1">{resolvedCount}</h3>
                    <p className="text-xs text-slate-400 mt-1">Successfully closed</p>
                  </div>
                  <div className="p-3 rounded-xl text-white bg-teal-500">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                </div>
              </div>

              {/* MAIN DASHBOARD LAYOUT */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* LEFT 2 COLS: INCOMING UNACCEPTED INCIDENTS */}
                <div className="lg:col-span-2 space-y-4">
                  <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div>
                      <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                        <span>Incoming Clinic Incidents</span>
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">Review and accept incoming emergency cases</p>
                    </div>
                    <button
                      onClick={() => setCurrentTab('assignments')}
                      className="text-xs text-teal-600 font-semibold hover:text-teal-800 flex items-center cursor-pointer"
                    >
                      View All Reports ({incidents.length}) <ChevronRight className="w-4 h-4 ml-0.5" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    {unassignedIncidents.length > 0 ? (
                      unassignedIncidents.map((incident) => (
                        <div
                          key={incident.incident_id}
                          className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition p-6 relative overflow-hidden"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-slate-900 text-base">Incident #{incident.incident_id}</span>
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700 border border-rose-200">
                                {incident.incident_name || 'Emergency'}
                              </span>
                            </div>
                            <span className="text-xs text-slate-400 font-medium flex items-center">
                              <Clock3 className="w-3.5 h-3.5 mr-1" />
                              {incident.reported_at ? new Date(incident.reported_at).toLocaleString() : 'Recently'}
                            </span>
                          </div>

                          <h3 className="text-lg font-bold text-slate-800 mb-1">{incident.incident_name}</h3>
                          <div className="flex items-center space-x-4 text-xs text-slate-500 mb-3">
                            <span>📍 <strong>{incident.location_description ?? 'Location pending'}</strong></span>
                            <span>👤 Reported by: <strong className="text-slate-700">{incident.reporter_name}</strong></span>
                          </div>

                          <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100 mb-4 leading-relaxed">
                            {incident.description ?? 'Clinic response requested'}
                          </p>

                          <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-2">
                            <div className="flex items-center space-x-2">
                              <span className="text-xs text-slate-400 font-semibold">Status:</span>
                              <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded border border-amber-200 capitalize">
                                {incident.status ?? 'pending'}
                              </span>
                            </div>

                            <div className="flex items-center space-x-3">
                              <button
                                onClick={() => setSelectedIncidentForUpdate(incident)}
                                className="px-3 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-bold rounded-lg transition flex items-center space-x-1 cursor-pointer"
                              >
                                <span>Update Status</span>
                                <ChevronDown className="w-3.5 h-3.5 ml-0.5" />
                              </button>

                              <button
                                onClick={() => void updateIncidentStatus(incident.incident_id, 'assigned')}
                                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center space-x-1.5 cursor-pointer"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                                <span>Accept Case</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">
                        <CheckCircle2 className="w-10 h-10 mx-auto text-teal-500 mb-2" />
                        <p className="text-sm font-semibold text-slate-700">No incoming incidents match your search.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* RIGHT 1 COL: ACCEPTED CASES PANEL */}
                <div className="space-y-4">
                  <div className="bg-slate-900 rounded-xl p-5 text-white shadow-md">
                    <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-3">
                      <div className="flex items-center space-x-2">
                        <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse" />
                        <h3 className="font-bold text-sm text-white">Your Assigned Cases</h3>
                      </div>
                      <span className="bg-teal-500/20 text-teal-300 border border-teal-500/30 text-xs px-2 py-0.5 rounded-full font-bold">
                        {acceptedIncidents.length} Active
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mb-4">
                      Cases actively assigned to or handled by {displayName}
                    </p>

                    <div className="space-y-3">
                      {acceptedIncidents.length > 0 ? (
                        acceptedIncidents.map((acc) => (
                          <div
                            key={acc.incident_id}
                            className="bg-slate-800/90 rounded-lg p-3.5 border border-slate-700 hover:border-teal-500 transition space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs text-teal-300">#{acc.incident_id}</span>
                              <span className="text-[10px] bg-teal-950 text-teal-300 border border-teal-800 font-semibold px-2 py-0.5 rounded uppercase">
                                {acc.status ?? 'assigned'}
                              </span>
                            </div>
                            <p className="text-xs font-semibold text-white leading-tight">{acc.incident_name}</p>
                            <p className="text-[11px] text-slate-400">📍 {acc.location_description ?? 'Location pending'}</p>
                            <p className="text-[11px] text-slate-400">👤 Reported by: <strong className="text-slate-200">{acc.reporter_name}</strong></p>
                           
                            <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between text-[11px]">
                              <span className="text-slate-400">Assigned: <strong className="text-slate-200">Self</strong></span>
                              <button
                                onClick={() => setSelectedIncidentForUpdate(acc)}
                                className="text-teal-400 hover:text-teal-300 font-semibold hover:underline cursor-pointer"
                              >
                                Edit Status &rarr;
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-4 border border-dashed border-slate-800 rounded-lg text-center text-xs text-slate-500">
                          No assigned cases match your search.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* ASSIGNMENTS / INCIDENT REPORTS TAB */}
          {currentTab === 'assignments' && (
            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm max-w-7xl mx-auto">
              <div className="border-b border-slate-100 pb-4 mb-4">
                <h2 className="text-base font-bold text-slate-900">All Incident Reports</h2>
                <p className="text-xs text-slate-500">Complete history of reported campus incidents</p>
              </div>
              <div className="divide-y divide-slate-100">
                {loading && <div className="py-12 text-center text-sm text-slate-400">Loading incidents...</div>}
                {!loading && filteredIncidents.length === 0 && <div className="py-12 text-center text-slate-500">No matching incidents found.</div>}
                {filteredIncidents.map((incident) => {
                  const isAssigned = ['assigned', 'accepted', 'responding', 'resolved', 'completed'].includes(incident.status?.toLowerCase() ?? '');
                  return (
                    <div key={incident.incident_id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-slate-900">Incident #{incident.incident_id}</h3>
                          <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded">{incident.incident_name}</span>
                          <span className="text-xs uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold">{incident.status ?? 'pending'}</span>
                        </div>
                        <p className="text-sm text-slate-600 mt-1">{incident.description ?? 'No description'}</p>
                        <p className="text-xs text-slate-500 mt-1">👤 Reported by: <span className="font-semibold">{incident.reporter_name}</span> | 📍 {incident.location_description ?? 'Location pending'}</p>
                      </div>
                      {!isAssigned ? (
                        <button onClick={() => void updateIncidentStatus(incident.incident_id, 'assigned')} className="px-4 py-2 bg-teal-600 text-white rounded-lg text-xs font-semibold hover:bg-teal-700 w-fit cursor-pointer">
                          Accept Case
                        </button>
                      ) : (
                        <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-3 py-1.5 rounded border border-blue-200">
                          Assigned
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* ACCEPTED CASES TAB */}
          {currentTab === 'accepted' && (
            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm max-w-7xl mx-auto">
              <div className="border-b border-slate-100 pb-4 mb-4">
                <h2 className="text-base font-bold text-slate-900">Assigned Cases</h2>
                <p className="text-xs text-slate-500">Active emergency cases managed by clinic team</p>
              </div>
              <div className="divide-y divide-slate-100">
                {acceptedIncidents.length === 0 && <div className="py-12 text-center text-slate-400">No matching assigned cases.</div>}
                {acceptedIncidents.map((incident) => (
                  <div key={incident.incident_id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-900">Incident #{incident.incident_id}</h3>
                        <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded">{incident.incident_name}</span>
                        <span className="text-xs uppercase px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold">{incident.status ?? 'assigned'}</span>
                      </div>
                      <p className="text-sm text-slate-600 mt-1">{incident.description ?? 'No description'}</p>
                      <p className="text-xs text-slate-500 mt-1">👤 Reported by: <span className="font-semibold">{incident.reporter_name}</span></p>
                    </div>
                    <select
                      value={incident.status ?? 'assigned'}
                      onChange={(e) => void updateIncidentStatus(incident.incident_id, e.target.value)}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 cursor-pointer shadow-sm"
                    >
                      <option value="pending">Pending</option>
                      <option value="active">Active</option>
                      <option value="assigned">Assigned</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* SCHEDULE TAB */}
          {currentTab === 'schedule' && (
            <section className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm max-w-2xl mx-auto">
              <CalendarDays className="mx-auto h-12 w-12 text-teal-500 mb-3" />
              <h2 className="text-lg font-bold text-slate-900">Clinic Staff Schedule</h2>
              <p className="mt-1 text-sm text-slate-500">Your shift schedules and availability calendar will appear here.</p>
            </section>
          )}

        </main>
      </div>

      {/* STATUS UPDATE MODAL */}
      {selectedIncidentForUpdate && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">Update Incident Status</h3>
              <button onClick={() => setSelectedIncidentForUpdate(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500">Incident #{selectedIncidentForUpdate.incident_id}</p>
              <p className="text-sm font-bold text-slate-800 mt-0.5">{selectedIncidentForUpdate.incident_name}</p>
              <p className="text-xs text-slate-600 mt-2 bg-slate-50 p-3 rounded-lg">{selectedIncidentForUpdate.description}</p>
            </div>
            <div className="space-y-2 pt-2">
              <label className="text-xs font-semibold text-slate-700">Set New Status:</label>
              <div className="grid grid-cols-2 gap-2">
                {['pending', 'active', 'assigned', 'resolved'].map((st) => (
                  <button
                    key={st}
                    onClick={() => void updateIncidentStatus(selectedIncidentForUpdate.incident_id, st)}
                    className="p-2.5 text-xs font-bold uppercase rounded-lg border border-slate-200 hover:border-teal-500 hover:bg-teal-50 text-slate-700 transition cursor-pointer"
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
} 