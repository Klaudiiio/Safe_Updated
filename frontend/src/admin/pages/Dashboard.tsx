import { useState } from 'react';
import { Activity, AlertCircle, Users, TrendingUp, MapPin, Camera, ClipboardList } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { IncidentCard } from '../components/IncidentCard';
import { ResponderCard } from '../components/ResponderCard';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DataNotice } from '../DataNotice';
import { useAdminData } from '../useAdminData';
import type { Incident } from '../data/mockData';

function buildDailyIncidentCounts(incidents: Incident[], currentDate: Date) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(currentDate.getTime());
    date.setDate(date.getDate() - (6 - index));
    const dateLabel = date.toLocaleDateString(undefined, { weekday: 'short' });
    const count = incidents.filter((incident) => (
      incident.reportedAt && new Date(incident.reportedAt).toDateString() === date.toDateString()
    )).length;
    return { day: dateLabel, count };
  });
}

export function Dashboard() {
  const { incidents, responders, loading, error } = useAdminData();
  const [currentDate] = useState(() => new Date());

  // Map any legacy 'responding' status to 'assigned'
  const normalizedIncidents = incidents.map(i => ({
    ...i,
    status: i.status?.toLowerCase() === 'responding' ? 'assigned' : i.status
  }));

  // Exclude resolved/completed/cancelled from active incidents
  const activeIncidents = normalizedIncidents.filter(i => {
    const status = i.status?.toLowerCase() || '';
    return !['resolved', 'completed', 'cancelled'].includes(status);
  });

  // Synced with Responders tab availability criteria checking both properties safely
  const availableResponders = responders.filter(r => {
    const statusStr = ((r as any).status || (r as any).availability_status || '').toLowerCase();
    return statusStr === 'available';
  });
 
  const pendingReports = normalizedIncidents.filter(i => (i.status?.toLowerCase() || '') === 'pending').length;
  const assignedReports = normalizedIncidents.filter(i => ['assigned', 'accepted'].includes(i.status?.toLowerCase() || '')).length;
 
  const dailyIncidents = buildDailyIncidentCounts(normalizedIncidents, currentDate);
  const incidentTypeCounts = normalizedIncidents.reduce<{ type: string; count: number }[]>((counts, incident) => {
    const existing = counts.find((item) => item.type === incident.type);
    if (existing) existing.count += 1;
    else counts.push({ type: incident.type, count: 1 });
    return counts;
  }, []);

  return (
    <div className="space-y-6">
      <DataNotice loading={loading} error={error} />
     
      {/* Page Header */}
      <div className="mb-4 bg-white/40 backdrop-blur-sm p-5 rounded-2xl border border-amber-200/50 shadow-sm">
        <h1 className="text-2xl font-extrabold text-slate-900 mb-1">SAFE Medical Emergency Monitoring Center</h1>
        <p className="text-slate-700 text-sm font-semibold">University of Science and Technology of Southern Philippines</p>
      </div>

      {/* Hero Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white border-amber-200/60 shadow-md p-5 rounded-2xl hover:shadow-lg transition-all">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Active Incidents</p>
              <p className="text-3xl font-extrabold text-slate-900">{activeIncidents.length}</p>
              <p className="text-rose-600 text-xs mt-2 font-bold">Requires Attention</p>
            </div>
            <div className="w-12 h-12 bg-rose-100 rounded-xl flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-rose-600" />
            </div>
          </div>
        </Card>

        <Card className="bg-white border-amber-200/60 shadow-md p-5 rounded-2xl hover:shadow-lg transition-all">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Available Responders</p>
              <p className="text-3xl font-extrabold text-slate-900">{availableResponders.length}</p>
              <p className="text-emerald-600 text-xs mt-2 font-bold">Ready to Respond</p>
            </div>
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
        </Card>

        <Card className="bg-white border-amber-200/60 shadow-md p-5 rounded-2xl hover:shadow-lg transition-all">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Assigned Cases</p>
              <p className="text-3xl font-extrabold text-slate-900">{assignedReports}</p>
              <p className="text-blue-600 text-xs mt-2 font-bold">Under Management</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <ClipboardList className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </Card>

        <Card className="bg-white border-amber-200/60 shadow-md p-5 rounded-2xl hover:shadow-lg transition-all">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Pending Reports</p>
              <p className="text-3xl font-extrabold text-slate-900">{pendingReports}</p>
              <p className="text-amber-600 text-xs mt-2 font-bold">Awaiting Assignment</p>
            </div>
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
              <Activity className="w-6 h-6 text-amber-600" />
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Live Incident Feed */}
          <Card className="bg-white border-amber-200/60 shadow-md p-6 rounded-2xl">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Incident Feed</h2>
                  <p className="text-xs text-slate-500">Supabase incident reports</p>
                </div>
              </div>
              <Badge className="bg-rose-100 text-rose-700 border-rose-200 font-bold px-3 py-1">
                <div className="w-2 h-2 bg-rose-600 rounded-full animate-pulse mr-1.5"></div>
                {activeIncidents.length} Active
              </Badge>
            </div>
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
              {activeIncidents.map((incident) => (
                <IncidentCard
                  key={incident.id}
                  incident={incident}
                />
              ))}
              {!loading && !error && activeIncidents.length === 0 && (
                <p className="py-6 text-center text-sm text-slate-400">No active incidents.</p>
              )}
            </div>
          </Card>

          {/* Incident locations */}
          <Card className="bg-white border-amber-200/60 shadow-md p-6 rounded-2xl">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                <MapPin className="w-5 h-5 text-amber-700" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Incident Locations</h2>
                <p className="text-xs text-slate-500">Location details from incident reports</p>
              </div>
            </div>
            <div className="space-y-3">
              {activeIncidents.slice(0, 5).map((incident) => (
                <div key={incident.id} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-amber-50/30 p-3.5">
                  <MapPin className="mt-0.5 h-4 w-4 text-amber-600 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-900">{incident.type}</p>
                    <p className="text-xs text-slate-600">
                      {incident.building}{incident.location !== '—' ? `, ${incident.location}` : ''}
                    </p>
                  </div>
                  {(incident.gpsCoords?.lat || incident.gpsCoords?.lng) && (
                    <span className="text-right text-xs text-slate-400 font-mono">
                      {`${incident.gpsCoords.lat}, ${incident.gpsCoords.lng}`}
                    </span>
                  )}
                </div>
              ))}
              {!loading && !error && activeIncidents.length === 0 && (
                <p className="py-6 text-center text-sm text-slate-400">No active incidents to locate.</p>
              )}
            </div>
          </Card>

          {/* System Analytics */}
          <Card className="bg-white border-amber-200/60 shadow-md p-6 rounded-2xl">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-amber-700" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">System Analytics</h2>
                <p className="text-xs text-slate-500">Incident trends and statistics</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Daily Incidents */}
              <div>
                <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">Daily Incident Count</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={dailyIncidents}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="day" stroke="#94a3b8" style={{ fontSize: '12px' }} />
                    <YAxis stroke="#94a3b8" style={{ fontSize: '12px' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                      }}
                      labelStyle={{ color: '#0f172a', fontWeight: 'bold' }}
                    />
                    <Bar dataKey="count" fill="#F59E0B" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Response time unavailable */}
              <div>
                <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">Average Response Time</h3>
                <div className="flex h-[200px] items-center justify-center rounded-xl border border-slate-100 bg-amber-50/20 text-xs text-slate-400 font-medium p-4 text-center">
                  Response timestamps are not available.
                </div>
              </div>
            </div>

            {/* Common Incidents */}
            <div className="mt-6 pt-6 border-t border-slate-100">
              <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">Common Medical Incidents</h3>
              <div className="space-y-3">
                {incidentTypeCounts.map((item) => (
                  <div key={item.type} className="flex items-center gap-3">
                    <div className="flex-1 flex items-center gap-3">
                      <span className="text-sm font-medium text-slate-700 w-32 truncate">{item.type}</span>
                      <div className="flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden">
                        <div
                          className="bg-amber-500 h-2.5 rounded-full transition-all"
                          style={{ width: `${Math.min((item.count / Math.max(incidents.length, 1)) * 100, 100)}%` }}
                        ></div>
                      </div>
                      {!loading && !error && incidentTypeCounts.length === 0 && (
                        <p className="text-xs text-slate-400">No incident statistics available.</p>
                      )}
                    </div>
                    <span className="text-sm font-bold text-slate-900 w-8 text-right">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Responder Management - Filtered to Available Only */}
          <Card className="bg-white border-amber-200/60 shadow-md p-6 rounded-2xl">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                  <Users className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Available Responders</h2>
                  <p className="text-xs text-slate-500">Medical response team ready</p>
                </div>
              </div>
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 font-bold px-2.5 py-0.5">
                {availableResponders.length} Available
              </Badge>
            </div>
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {availableResponders.map((responder) => (
                <ResponderCard
                  key={responder.id}
                  responder={responder}
                />
              ))}
              {!loading && !error && availableResponders.length === 0 && (
                <p className="py-4 text-center text-xs text-slate-400">No available responders found.</p>
              )}
            </div>
          </Card>

          {/* Camera Identification */}
          <Card className="bg-white border-amber-200/60 shadow-md p-6 rounded-2xl">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                <Camera className="w-5 h-5 text-amber-700" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Camera Feed</h2>
                <p className="text-xs text-slate-500">Camera integration is not configured</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="aspect-video bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-center">
                <Card className="w-12 h-12 text-slate-700 flex items-center justify-center border-0 bg-transparent shadow-none">
                  <Camera className="w-10 h-10 text-slate-600" />
                </Card>
              </div>
              <p className="text-xs text-slate-400 text-center">No camera feed is connected.</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}