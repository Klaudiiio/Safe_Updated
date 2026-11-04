import { useState } from 'react';
import { Users, UserPlus, X, RefreshCw, AlertCircle } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { ResponderCard } from '../components/ResponderCard';
import { DataNotice } from '../DataNotice';
import { useAdminData } from '../useAdminData';
import { createResponder } from '../api';

export function Responders() {
  const { responders, loading, error } = useAdminData();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state for new responder/staff (including email & password for login)
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [department, setDepartment] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [availabilityStatus, setAvailabilityStatus] = useState('available');
  const [userType, setUserType] = useState('responder');

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

    setSubmitting(true);
    try {
      await createResponder({
        username: email.split('@')[0],
        email,
        password,
        name,
        department,
        contact_number: contactNumber,
        availability_status: availabilityStatus,
        user_type: userType,
        role: userType,
      });
      setIsModalOpen(false);
      setName('');
      setEmail('');
      setPassword('');
      setDepartment('');
      setContactNumber('');
      setAvailabilityStatus('available');
      setUserType('responder');
      window.location.reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create responder or staff member.');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatus = (r: any) => (r.status || r.availability_status || 'available').toLowerCase();

  const availableCount = responders.filter(r => getStatus(r) === 'available').length;
  const assignedCount = responders.filter(r => ['assigned', 'responding', 'busy', 'on_duty'].includes(getStatus(r))).length;
  const offlineCount = responders.filter(r => getStatus(r) === 'offline').length;

  return (
    <div className="space-y-6">
      <DataNotice loading={loading} error={error} />
     
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Medical Responders & Clinic Staff</h1>
          <p className="text-gray-400 text-sm">Manage emergency response team and staff availability</p>
        </div>
        <Button
          onClick={() => setIsModalOpen(true)}
          className="bg-[#3B82F6] hover:bg-blue-600 text-white flex items-center gap-2 w-fit shadow-md shadow-blue-500/10 text-xs"
        >
          <UserPlus className="w-4 h-4" />
          Add Responder / Staff
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-[#0F1825]/80 backdrop-blur-sm border-gray-800 p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Total Team</p>
              <p className="text-3xl font-bold text-white">{responders.length}</p>
            </div>
            <Users className="w-8 h-8 text-gray-400" />
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-[#22C55E]/20 to-[#22C55E]/5 border-[#22C55E]/30 p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Available</p>
              <p className="text-3xl font-bold text-white">{availableCount}</p>
            </div>
            <Users className="w-8 h-8 text-[#22C55E]" />
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-[#FACC15]/20 to-[#FACC15]/5 border-[#FACC15]/30 p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">On Duty / Busy</p>
              <p className="text-3xl font-bold text-white">{assignedCount}</p>
            </div>
            <Users className="w-8 h-8 text-[#FACC15]" />
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-gray-500/20 to-gray-500/5 border-gray-500/30 p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Offline</p>
              <p className="text-3xl font-bold text-white">{offlineCount}</p>
            </div>
            <Users className="w-8 h-8 text-gray-500" />
          </div>
        </Card>
      </div>

      {/* Responders by Status */}
      <div className="space-y-6">
        {/* Available Responders */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <Badge className="bg-[#22C55E]/20 text-[#22C55E] border-[#22C55E]/50">
              <div className="w-2 h-2 bg-[#22C55E] rounded-full animate-pulse mr-2"></div>
              Available
            </Badge>
            <span className="text-sm text-gray-400">{availableCount} responders ready</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {responders
              .filter(r => getStatus(r) === 'available')
              .map((responder: any) => (
                <ResponderCard key={responder.responders_id || responder.id} responder={responder} />
              ))}
          </div>
        </div>

        {/* On Duty Responders */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <Badge className="bg-[#FACC15]/20 text-[#FACC15] border-[#FACC15]/50">
              <div className="w-2 h-2 bg-[#FACC15] rounded-full animate-pulse mr-2"></div>
              On Duty / Busy
            </Badge>
            <span className="text-sm text-gray-400">{assignedCount} responders active</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {responders
              .filter(r => ['assigned', 'responding', 'busy', 'on_duty'].includes(getStatus(r)))
              .map((responder: any) => (
                <ResponderCard key={responder.responders_id || responder.id} responder={responder} />
              ))}
          </div>
        </div>

        {/* Offline Responders */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/50">
              <div className="w-2 h-2 bg-gray-500 rounded-full mr-2"></div>
              Offline
            </Badge>
            <span className="text-sm text-gray-400">{offlineCount} responders offline</span>
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
        <Card className="bg-[#0F1825]/80 backdrop-blur-sm border-gray-800 py-12 text-center text-gray-400">
          <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-600 stroke-1" />
          <p className="text-base font-medium">No medical responders or staff registered yet.</p>
        </Card>
      )}

      {/* Add Responder Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <Card className="bg-[#0F1825] border-gray-800 w-full max-w-lg p-6 space-y-6 relative shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-800 pb-4">
              <h2 className="text-lg font-bold text-white">Add New Responder or Staff</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddResponder} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Nurse Maria Santos"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#0B1220] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#3B82F6]"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="maria@clinic.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#0B1220] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#3B82F6]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Password * (For Login)</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="Min. 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-[#0B1220] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#3B82F6]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Department / Unit *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., University Clinic / Medical Team"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full bg-[#0B1220] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#3B82F6]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Contact Number *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., 09123456789"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  className="w-full bg-[#0B1220] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#3B82F6]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Initial Status</label>
                  <select
                    value={availabilityStatus}
                    onChange={(e) => setAvailabilityStatus(e.target.value)}
                    className="w-full bg-[#0B1220] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#3B82F6]"
                  >
                    <option value="available">Available</option>
                    <option value="busy">Busy / On Duty</option>
                    <option value="offline">Offline</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Role Type</label>
                  <select
                    value={userType}
                    onChange={(e) => setUserType(e.target.value)}
                    className="w-full bg-[#0B1220] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#3B82F6]"
                  >
                    <option value="responder">Responder</option>
                    <option value="clinic_staff">Clinic Staff</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  className="border-gray-700 text-gray-300 hover:bg-gray-800 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-[#3B82F6] hover:bg-blue-600 text-white text-xs flex items-center gap-2"
                >
                  {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  Save Responder
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}