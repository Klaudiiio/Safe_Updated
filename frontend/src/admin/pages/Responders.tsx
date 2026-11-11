import { useState, useEffect } from 'react';
import { Users, UserPlus, X, RefreshCw, AlertCircle } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { ResponderCard } from '../components/ResponderCard';
import { DataNotice } from '../DataNotice';
import { createResponder } from '../api';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = (SUPABASE_URL && SUPABASE_KEY) ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

export function Responders() {
  const [responders, setResponders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state for new clinic staff member
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [department, setDepartment] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [availabilityStatus, setAvailabilityStatus] = useState('available');

  // Fetch responders/staff directly from Supabase
  const fetchRespondersDirectly = async () => {
    if (!supabase) return;
    try {
      setLoading(true);
      const { data, error } = await supabase.from('responder').select('*');
      if (error) throw error;
      setResponders(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load clinic staff');
    } finally {
      setLoading(false);
    }
  };

  // Real-time listener: instantly fetches live data when any row changes in Supabase
  useEffect(() => {
    void fetchRespondersDirectly();

    if (!supabase) return;

    const channel = supabase
      .channel('admin-responders-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'responder' },
        () => {
          void fetchRespondersDirectly();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleAddResponder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password || !department || !contactNumber) {
      alert('Please fill in all required fields including email and password.');
      return;
    }

    if (password.length < 6) {
      alert('Password must be at least 6 characters long.');
      return;
    }

    // Automatically generate clean username from full name input
    const generatedUsername = name.trim().toLowerCase().replace(/[^a-z0-9]/g, '') || email.split('@')[0];

    setSubmitting(true);
    try {
      await createResponder({
        username: generatedUsername,
        email,
        password,
        name,
        department,
        contact_number: contactNumber,
        availability_status: availabilityStatus,
        user_type: 'clinic_staff', // Hardcoded strictly to clinic_staff
        role: 'clinic_staff',       // Hardcoded strictly to clinic_staff
      });
      setIsModalOpen(false);
      setName('');
      setEmail('');
      setPassword('');
      setDepartment('');
      setContactNumber('');
      setAvailabilityStatus('available');
      void fetchRespondersDirectly();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create clinic staff member.');
    } finally {
      setSubmitting(false);
    }
  };

  // Bulletproof status normalizer
  const getStatus = (r: any) => {
    const raw = r.status || r.availability_status || 'available';
    const val = String(raw).trim().toLowerCase();
   
    if (['busy', 'on_duty', 'assigned', 'responding', 'on-call'].includes(val)) {
      return 'busy';
    }
    return val;
  };

  const availableCount = responders.filter(r => getStatus(r) === 'available').length;
  const assignedCount = responders.filter(r => getStatus(r) === 'busy').length;
  const offlineCount = responders.filter(r => getStatus(r) === 'offline').length;

  return (
    <div className="space-y-6">
      <DataNotice loading={loading} error={error} />
     
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white/40 backdrop-blur-sm p-5 rounded-2xl border border-amber-200/50 shadow-sm">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 mb-1">Clinic Staff Directory</h1>
          <p className="text-slate-700 text-sm font-semibold">Manage clinic personnel and staff availability</p>
        </div>
        <Button
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 w-fit shadow-md text-xs font-bold rounded-xl"
        >
          <UserPlus className="w-4 h-4" />
          Add Clinic Staff
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white border-amber-200/60 shadow-md p-5 rounded-2xl">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Total Team</p>
              <p className="text-3xl font-extrabold text-slate-900">{responders.length}</p>
            </div>
            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-slate-600" />
            </div>
          </div>
        </Card>

        <Card className="bg-white border-emerald-200 shadow-md p-5 rounded-2xl">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-emerald-700 text-xs font-semibold uppercase tracking-wider mb-1">Available</p>
              <p className="text-3xl font-extrabold text-slate-900">{availableCount}</p>
            </div>
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
        </Card>

        <Card className="bg-white border-amber-300 shadow-md p-5 rounded-2xl">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-amber-800 text-xs font-semibold uppercase tracking-wider mb-1">Busy</p>
              <p className="text-3xl font-extrabold text-slate-900">{assignedCount}</p>
            </div>
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-amber-700" />
            </div>
          </div>
        </Card>

        <Card className="bg-white border-slate-200 shadow-md p-5 rounded-2xl">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Offline</p>
              <p className="text-3xl font-extrabold text-slate-900">{offlineCount}</p>
            </div>
            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-slate-500" />
            </div>
          </div>
        </Card>
      </div>

      {/* Staff by Status */}
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-3 mb-4">
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 font-bold px-3 py-1">
              <div className="w-2 h-2 bg-emerald-600 rounded-full animate-pulse mr-2"></div>
              Available
            </Badge>
            <span className="text-sm font-semibold text-slate-700">{availableCount} staff ready</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {responders
              .filter(r => getStatus(r) === 'available')
              .map((responder: any) => (
                <ResponderCard key={responder.responders_id || responder.id} responder={responder} />
              ))}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-3 mb-4">
            <Badge className="bg-amber-100 text-amber-800 border-amber-200 font-bold px-3 py-1">
              <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse mr-2"></div>
              Busy
            </Badge>
            <span className="text-sm font-semibold text-slate-700">{assignedCount} staff active</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {responders
              .filter(r => getStatus(r) === 'busy')
              .map((responder: any) => (
                <ResponderCard key={responder.responders_id || responder.id} responder={responder} />
              ))}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-3 mb-4">
            <Badge className="bg-slate-100 text-slate-700 border-slate-200 font-bold px-3 py-1">
              <div className="w-2 h-2 bg-slate-400 rounded-full mr-2"></div>
              Offline
            </Badge>
            <span className="text-sm font-semibold text-slate-700">{offlineCount} staff offline</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {responders
              .filter(r => getStatus(r) === 'offline')
              .map((responder: any) => (
                <ResponderCard key={responder.responders_id || responder.id} responder={responder} />
              ))}
          </div>
        </div>
      </div>

      {!loading && responders.length === 0 && (
        <Card className="bg-white border-amber-200/60 shadow-md py-12 text-center text-slate-500 rounded-2xl">
          <AlertCircle className="w-12 h-12 mx-auto mb-3 text-slate-400 stroke-1" />
          <p className="text-base font-bold text-slate-900">No clinic staff registered yet.</p>
        </Card>
      )}

      {/* Add Clinic Staff Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <Card className="bg-white border-amber-200 text-slate-900 w-full max-w-lg p-6 space-y-6 relative shadow-2xl rounded-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h2 className="text-lg font-bold text-slate-900">Add New Clinic Staff</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddResponder} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Nurse Maria Santos"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 font-medium focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="maria@clinic.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 font-medium focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Password * (For Login)</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="Min. 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 font-medium focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Department / Unit *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., University Clinic / Medical Team"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 font-medium focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Contact Number *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., 09123456789"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 font-medium focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Initial Status</label>
                <select
                  value={availabilityStatus}
                  onChange={(e) => setAvailabilityStatus(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 font-medium focus:outline-none focus:border-blue-600 cursor-pointer"
                >
                  <option value="available">Available</option>
                  <option value="busy">Busy</option>
                  <option value="offline">Offline</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  className="border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-2 rounded-xl shadow-sm"
                >
                  {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  Save Clinic Staff
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}