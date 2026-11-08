import { useCallback, useEffect, useState } from 'react';
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
  PlusCircle,
  Search,
  Stethoscope,
  X,
  CheckCheck,
} from 'lucide-react';
import { createClinicStaff } from './services/authServices';

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
  priority?: string;
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

  // If JWT expired (401 / PGRST303), refresh token once and retry
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

  // Add Responder or Staff Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newStaffData, setNewStaffData] = useState({
    name: '',
    email: '',
    password: '',
    department: '',
    contact_number: '',
    availability_status: 'available',
    role: 'Responder',
  });
  const [submittingStaff, setSubmittingStaff] = useState(false);
  const [modalError, setModalError] = useState('');
  const [modalSuccess, setModalSuccess] = useState('');

  const loadIncidents = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const incidentsData = await supabaseRequest('incident?select=*&order=reported_at.desc');
      setIncidents(incidentsData as IncidentReport[]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load reported incidents.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch initial incidents and staff status on load
  useEffect(() => {
    void loadIncidents();

    async function fetchStaffStatus() {
      try {
        // Use ilike for case-insensitive matching in Supabase
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
    setAvailability(status); // Optimistic UI update
    setError('');

    try {
      // Use ilike for case-insensitive matching on PATCH updates
      const response = await supabaseRequest(
        `responder?name=ilike.${encodeURIComponent(displayName ?? '')}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ availability_status: status }),
        }
      );

      if (Array.isArray(response) && response.length === 0) {
        throw new Error(`Database update failed: No responder row found matching name "${displayName}".`);
      }
    } catch (err) {
      setAvailability(previousStatus); // Revert UI if it failed
      setError(err instanceof Error ? err.message : 'Failed to update availability status in Supabase.');
    }
  };

  const updateIncidentStatus = async (incidentId: number, status: string) => {
    try {
      await supabaseRequest(
        `incident?incident_id=eq.${incidentId}`,
        { method: 'PATCH', body: JSON.stringify({ status }) },
      );
      await loadIncidents();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update incident status.');
    }
  };

  const handleCreateStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');
    setModalSuccess('');

    if (!newStaffData.name || !newStaffData.email || !newStaffData.password || !newStaffData.department || !newStaffData.contact_number) {
      setModalError('Please fill out all required fields including password.');
      return;
    }

    if (newStaffData.password.length < 6) {
      setModalError('Password must be at least 6 characters long.');
      return;
    }

    setSubmittingStaff(true);
    try {
      const adminToken = localStorage.getItem('clinic_staff_access_token') || '';
      await createClinicStaff({
        username: newStaffData.email.split('@')[0],
        email: newStaffData.email,
        name: newStaffData.name,
        password: newStaffData.password,
        department: newStaffData.department,
        contact_number: newStaffData.contact_number,
        availability_status: newStaffData.availability_status,
        role: newStaffData.role,
      }, adminToken);

      setModalSuccess(`Successfully created account for '${newStaffData.name}' with login credentials!`);
      setNewStaffData({
        name: '',
        email: '',
        password: '',
        department: '',
        contact_number: '',
        availability_status: 'available',
        role: 'Responder',
      });
      await loadIncidents();
      setTimeout(() => {
        setShowAddModal(false);
        setModalSuccess('');
      }, 2000);
    } catch (err: any) {
      setModalError(err.message || 'Failed to create responder or staff member.');
    } finally {
      setSubmittingStaff(false);
    }
  };

  const activeIncidents = incidents.filter((row) => !['completed', 'resolved', 'cancelled'].includes(row.status?.toLowerCase() ?? ''));
 
  const acceptedIncidents = incidents.filter((row) => {
    const s = row.status?.toLowerCase() ?? '';
    return !['completed', 'resolved', 'cancelled'].includes(s);
  });

  const initials = displayName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <aside className={`fixed inset-y-0 left-0 z-40 w-[248px] bg-[#132238] transition-transform lg:translate-x-0 ${mobileMenu ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-[76px] items-center gap-3 border-b border-white/10 px-6">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-500 text-white"><HeartPulse size={23} /></div>
          <div><p className="text-lg font-bold text-white">Clinic Portal</p><p className="text-[11px] text-slate-400">SAFE Staff</p></div>
        </div>
        <nav className="space-y-2 p-4">
          <button
            onClick={() => setCurrentTab('dashboard')}
            className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold transition-colors ${currentTab === 'dashboard' ? 'bg-cyan-500 text-white' : 'text-slate-300 hover:bg-white/5'}`}
          >
            <Activity size={18} /> Dashboard
          </button>
          <button
            onClick={() => setCurrentTab('assignments')}
            className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold transition-colors ${currentTab === 'assignments' ? 'bg-cyan-500 text-white' : 'text-slate-300 hover:bg-white/5'}`}
          >
            <ClipboardList size={18} /> Incident Reports <span className="ml-auto rounded-full bg-white/10 px-2 text-xs">{activeIncidents.length}</span>
          </button>
          <button
            onClick={() => setCurrentTab('accepted')}
            className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold transition-colors ${currentTab === 'accepted' ? 'bg-cyan-500 text-white' : 'text-slate-300 hover:bg-white/5'}`}
          >
            <CheckCheck size={18} /> Accepted Cases <span className="ml-auto rounded-full bg-white/10 px-2 text-xs">{acceptedIncidents.length}</span>
          </button>
          <button
            onClick={() => setCurrentTab('schedule')}
            className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold transition-colors ${currentTab === 'schedule' ? 'bg-cyan-500 text-white' : 'text-slate-300 hover:bg-white/5'}`}
          >
            <CalendarDays size={18} /> Schedule
          </button>
         
          <button
            onClick={() => setShowAddModal(true)}
            className="flex w-full items-center gap-3 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-300 hover:bg-cyan-500/20 mt-4"
          >
            <PlusCircle size={18} /> Add Responder / Staff
          </button>
        </nav>
        <button onClick={onLogout} className="absolute bottom-5 left-4 right-4 flex items-center gap-3 rounded-lg border border-white/10 px-4 py-3 text-sm text-slate-300 hover:bg-white/5"><LogOut size={18} /> Sign out</button>
      </aside>

      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-30 flex h-[76px] items-center border-b border-slate-200 bg-white px-5 lg:px-8">
          <button className="mr-3 lg:hidden" onClick={() => setMobileMenu(!mobileMenu)} aria-label="Toggle menu"><Menu /></button>
          <div className="relative hidden max-w-md flex-1 md:block"><Search className="absolute left-3 top-2.5 text-slate-400" size={18} /><input className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-cyan-500" placeholder="Search incidents, patients..." /></div>
          <div className="ml-auto flex items-center gap-4">
           
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative rounded-full border border-slate-200 p-2 text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Toggle notifications"
              >
                <Bell size={19} />
                {activeIncidents.length > 0 && (
                  <span className="absolute right-1.5 top-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 rounded-xl border border-slate-200 bg-white shadow-lg z-50 p-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                    <h3 className="font-bold text-sm text-slate-800">Pending Reports</h3>
                    <span className="rounded-full bg-cyan-50 px-2 py-0.5 text-xs font-semibold text-cyan-600">
                      {activeIncidents.length} Active
                    </span>
                  </div>
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {activeIncidents.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-4">No pending reports</p>
                    ) : (
                      activeIncidents.map((incident) => (
                        <div
                          key={incident.incident_id}
                          className="p-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-xs transition-colors cursor-pointer"
                          onClick={() => {
                            setCurrentTab('assignments');
                            setShowNotifications(false);
                          }}
                        >
                          <p className="font-semibold text-slate-700">Incident #{incident.incident_id}</p>
                          <p className="text-slate-500 truncate mt-0.5">
                            {incident.description ?? 'Medical attention required'}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Clickable Profile Menu / Logout Dropdown */}
            <div className="relative border-l border-slate-200 pl-4">
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center gap-3 cursor-pointer group focus:outline-none"
                aria-label="Profile menu"
              >
                <div className="grid h-9 w-9 place-items-center rounded-full bg-cyan-100 text-sm font-bold text-cyan-700 group-hover:bg-cyan-200 transition-colors">
                  {initials}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-semibold group-hover:text-cyan-600 transition-colors">{displayName}</p>
                  <p className="text-xs text-slate-500">Clinic Staff</p>
                </div>
              </button>

              {showProfileMenu && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white shadow-lg z-50 p-2">
                  <div className="border-b border-slate-100 pb-2 px-3 pt-1">
                    <p className="font-bold text-sm text-slate-800">{displayName}</p>
                    <p className="text-xs text-slate-500">Clinic Staff Portal</p>
                  </div>
                  <div className="pt-2">
                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        onLogout();
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                    >
                      <LogOut size={16} /> Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        </header>

        <main className="mx-auto max-w-[1400px] p-5 lg:p-8">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div><p className="text-sm text-slate-500">Sunday, November 8, 2026</p><h1 className="mt-1 text-2xl font-bold">Good morning, {displayName}</h1><p className="mt-1 text-sm text-slate-500">Here is your clinic activity overview.</p></div>
            <div className="flex rounded-lg border border-slate-200 bg-white p-1">
              {['available', 'busy', 'offline'].map((status) => (
                <button
                  key={status}
                  onClick={() => void updateAvailability(status)}
                  className={`rounded-md px-3 py-2 text-xs font-semibold capitalize transition-colors ${
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

          {error && <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
         
          {currentTab === 'dashboard' && (
            <>
              <section className="grid gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-white p-5"><div className="flex items-center justify-between"><div><p className="text-sm text-slate-500">Active reports</p><p className="mt-2 text-3xl font-bold">{activeIncidents.length}</p></div><div className="grid h-11 w-11 place-items-center rounded-lg bg-red-50 text-red-500"><ClipboardList /></div></div><p className="mt-3 text-xs text-slate-400">Pending incident cases</p></div>
                <div className="rounded-xl border border-slate-200 bg-white p-5"><div className="flex items-center justify-between"><div><p className="text-sm text-slate-500">Accepted cases</p><p className="mt-2 text-3xl font-bold">{acceptedIncidents.length}</p></div><div className="grid h-11 w-11 place-items-center rounded-lg bg-emerald-50 text-emerald-500"><CheckCheck /></div></div><p className="mt-3 text-xs text-slate-400">Under management</p></div>
                <div className="rounded-xl border border-slate-200 bg-white p-5"><div className="flex items-center justify-between"><div><p className="text-sm text-slate-500">Availability</p><p className="mt-2 text-xl font-bold capitalize">{availability}</p></div><div className="grid h-11 w-11 place-items-center rounded-lg bg-cyan-50 text-cyan-600"><Stethoscope /></div></div><p className="mt-3 text-xs text-cyan-600">Synced with responder status</p></div>
              </section>

              <section className="mt-6 rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="text-base font-bold">Pending Active Incidents</h2><p className="mt-0.5 text-xs text-slate-500">Reports requiring immediate medical attention</p></div><button onClick={() => setCurrentTab('assignments')} className="flex items-center gap-1 text-sm font-semibold text-cyan-600">View all <ChevronRight size={16} /></button></div>
                <div className="divide-y divide-slate-100">
                  {loading && <div className="px-5 py-12 text-center text-sm text-slate-400">Loading incidents...</div>}
                  {!loading && activeIncidents.length === 0 && <div className="px-5 py-12 text-center"><CheckCircle2 className="mx-auto text-emerald-500" /><p className="mt-3 font-semibold">No active incidents</p><p className="mt-1 text-sm text-slate-500">New emergency reports will appear here.</p></div>}
                  {activeIncidents.map((incident) => {
                    const urgent = /urgent|critical/i.test(incident.priority ?? '');
                    return <article key={incident.incident_id} className="flex flex-col gap-4 px-5 py-5 md:flex-row md:items-center">
                      <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-lg ${urgent ? 'bg-red-50 text-red-500' : 'bg-cyan-50 text-cyan-600'}`}><HeartPulse /></div>
                      <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">Incident #{incident.incident_id}</h3><span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-800">{incident.status ?? 'PENDING'}</span></div><p className="mt-1 truncate text-sm text-slate-500">{incident.description ?? 'Clinic response requested'}</p><div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-400"><span className="flex items-center gap-1"><MapPin size={13} />{incident.location_description ?? 'Location pending'}</span><span className="flex items-center gap-1"><Clock3 size={13} />{incident.reported_at ? new Date(incident.reported_at).toLocaleString() : 'Recently reported'}</span></div></div>
                      <button onClick={() => void updateIncidentStatus(incident.incident_id, 'ACCEPTED')} className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700">Accept case</button>
                    </article>;
                  })}
                </div>
              </section>
            </>
          )}

          {currentTab === 'assignments' && (
            <section className="rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="text-base font-bold">All Incident Reports</h2><p className="mt-0.5 text-xs text-slate-500">Complete history of reported campus incidents</p></div></div>
              <div className="divide-y divide-slate-100">
                {loading && <div className="px-5 py-12 text-center text-sm text-slate-400">Loading incidents...</div>}
                {!loading && incidents.length === 0 && <div className="px-5 py-12 text-center"><CheckCircle2 className="mx-auto text-emerald-500" /><p className="mt-3 font-semibold">No incidents found</p></div>}
                {incidents.map((incident) => {
                  const isAccepted = incident.status?.toLowerCase() === 'accepted';
                  return <article key={incident.incident_id} className="flex flex-col gap-4 px-5 py-5 md:flex-row md:items-center">
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-cyan-50 text-cyan-600"><HeartPulse /></div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">Incident #{incident.incident_id}</h3>
                        <span className={`rounded px-2 py-0.5 text-xs font-medium uppercase ${isAccepted ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                          {incident.status ?? 'PENDING'}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-500">{incident.description ?? 'Clinic response requested'}</p>
                      <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-400">
                        <span className="flex items-center gap-1"><MapPin size={13} />{incident.location_description ?? 'Location pending'}</span>
                        <span className="flex items-center gap-1"><Clock3 size={13} />{incident.reported_at ? new Date(incident.reported_at).toLocaleString() : 'Recently reported'}</span>
                      </div>
                    </div>
                    {!isAccepted && (
                      <button onClick={() => void updateIncidentStatus(incident.incident_id, 'ACCEPTED')} className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700">Accept case</button>
                    )}
                  </article>;
                })}
              </div>
            </section>
          )}

          {currentTab === 'accepted' && (
            <section className="rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="text-base font-bold">Accepted Cases</h2><p className="mt-0.5 text-xs text-slate-500">List of emergency cases accepted by the clinic team</p></div></div>
              <div className="divide-y divide-slate-100">
                {loading && <div className="px-5 py-12 text-center text-sm text-slate-400">Loading accepted cases...</div>}
                {!loading && acceptedIncidents.length === 0 && <div className="px-5 py-12 text-center"><CheckCircle2 className="mx-auto text-slate-400" /><p className="mt-3 font-semibold text-slate-600">No accepted cases yet</p><p className="mt-1 text-sm text-slate-400">Incidents you accept will appear here.</p></div>}
                {acceptedIncidents.map((incident) => {
                  return <article key={incident.incident_id} className="flex flex-col gap-4 px-5 py-5 md:flex-row md:items-center">
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-600"><CheckCheck /></div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">Incident #{incident.incident_id}</h3>
                        <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-semibold uppercase text-emerald-800">
                          {incident.status ?? 'ACCEPTED'}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-500">{incident.description ?? 'Clinic response requested'}</p>
                      <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-400">
                        <span className="flex items-center gap-1"><MapPin size={13} />{incident.location_description ?? 'Location pending'}</span>
                        <span className="flex items-center gap-1"><Clock3 size={13} />{incident.reported_at ? new Date(incident.reported_at).toLocaleString() : 'Recently reported'}</span>
                      </div>
                    </div>
                   
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-semibold uppercase text-slate-500">Status:</label>
                      <select
                        value={incident.status ?? 'Accepted'}
                        onChange={(e) => void updateIncidentStatus(incident.incident_id, e.target.value)}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-cyan-500 cursor-pointer shadow-sm"
                      >
                        <option value="Pending">Pending</option>
                        <option value="Active">Active</option>
                        <option value="Assigned">Assigned</option>
                        <option value="Responding">Responding</option>
                        <option value="Accepted">Accepted</option>
                        <option value="Resolved">Resolved</option>
                      </select>
                    </div>
                  </article>;
                })}
              </div>
            </section>
          )}

          {currentTab === 'schedule' && (
            <section className="rounded-xl border border-slate-200 bg-white p-8 text-center">
              <CalendarDays className="mx-auto h-12 w-12 text-cyan-500" />
              <h2 className="mt-3 text-lg font-bold">Clinic Staff Schedule</h2>
              <p className="mt-1 text-sm text-slate-500">Your shift schedules and availability calendar will appear here.</p>
            </section>
          )}
        </main>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-[#132238] p-6 text-white shadow-2xl border border-slate-700">
            <div className="flex items-center justify-between border-b border-slate-700 pb-4">
              <h3 className="text-lg font-bold">Add New Responder or Staff</h3>
              <button onClick={() => setShowAddModal(false)} className="rounded-lg p-1 text-slate-400 hover:bg-white/10"><X size={20} /></button>
            </div>

            <form onSubmit={handleCreateStaffSubmit} className="mt-4 space-y-4">
              {modalError && <div className="rounded-lg bg-red-500/20 border border-red-500/50 p-3 text-sm text-red-300">{modalError}</div>}
              {modalSuccess && <div className="rounded-lg bg-emerald-500/20 border border-emerald-500/50 p-3 text-sm text-emerald-300">{modalSuccess}</div>}

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400">Full Name *</label>
                <input
                  type="text"
                  required
                  value={newStaffData.name}
                  onChange={(e) => setNewStaffData({ ...newStaffData, name: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-[#0c1624] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-500"
                  placeholder="e.g., Nurse Maria Santos"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={newStaffData.email}
                    onChange={(e) => setNewStaffData({ ...newStaffData, email: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-[#0c1624] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-500"
                    placeholder="maria@clinic.com"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400">Password * (For Login)</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newStaffData.password}
                    onChange={(e) => setNewStaffData({ ...newStaffData, password: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-[#0c1624] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-500"
                    placeholder="Min. 6 characters"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400">Department / Unit *</label>
                <input
                  type="text"
                  required
                  value={newStaffData.department}
                  onChange={(e) => setNewStaffData({ ...newStaffData, department: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-[#0c1624] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-500"
                  placeholder="e.g., University Clinic / Medical Team"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400">Contact Number *</label>
                <input
                  type="text"
                  required
                  value={newStaffData.contact_number}
                  onChange={(e) => setNewStaffData({ ...newStaffData, contact_number: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-[#0c1624] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-500"
                  placeholder="e.g., 09123456789"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400">Initial Status</label>
                  <select
                    value={newStaffData.availability_status}
                    onChange={(e) => setNewStaffData({ ...newStaffData, availability_status: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-[#0c1624] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-500"
                  >
                    <option value="available">Available</option>
                    <option value="busy">Busy</option>
                    <option value="offline">Offline</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400">Role Type</label>
                  <select
                    value={newStaffData.role}
                    onChange={(e) => setNewStaffData({ ...newStaffData, role: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-[#0c1624] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-500"
                  >
                    <option value="Responder">Responder</option>
                    <option value="Clinic Staff">Clinic Staff</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingStaff}
                  className="rounded-lg bg-cyan-600 px-5 py-2 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-50 transition-colors"
                >
                  {submittingStaff ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}