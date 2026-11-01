import { useState } from 'react';
import { Activity, AlertCircle, Users, Clock, TrendingUp, MapPin, Camera, Radio } from 'lucide-react';
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
  const activeIncidents = incidents.filter(i => i.status !== 'resolved');
  const availableResponders = responders.filter(r => r.status === 'available');
  const pendingReports = incidents.filter(i => i.status === 'pending').length;
  const dailyIncidents = buildDailyIncidentCounts(incidents, currentDate);
  const incidentTypeCounts = incidents.reduce<{ type: string; count: number }[]>((counts, incident) => {
    const existing = counts.find((item) => item.type === incident.type);
    if (existing) existing.count += 1;
    else counts.push({ type: incident.type, count: 1 });
    return counts;
  }, []);

  return (
    <div className="space-y-6">
      <DataNotice loading={loading} error={error} />
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">SAFE Medical Emergency Monitoring Center</h1>
        <p className="text-gray-400 text-sm">University of Science and Technology of Southern Philippines</p>
      </div>

      {/* Hero Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-[#FF3B30]/20 to-[#FF3B30]/5 border-[#FF3B30]/30 p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Active Incidents</p>
              <p className="text-3xl font-bold text-white">{activeIncidents.length}</p>
              <p className="text-[#FF3B30] text-xs mt-2 font-medium">Requires Attention</p>
            </div>
            <div className="w-12 h-12 bg-[#FF3B30]/20 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-[#FF3B30]" />
            </div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-[#22C55E]/20 to-[#22C55E]/5 border-[#22C55E]/30 p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Available Responders</p>
              <p className="text-3xl font-bold text-white">{availableResponders.length}</p>
              <p className="text-[#22C55E] text-xs mt-2 font-medium">Ready to Respond</p>
            </div>
            <div className="w-12 h-12 bg-[#22C55E]/20 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-[#22C55E]" />
            </div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-[#3B82F6]/20 to-[#3B82F6]/5 border-[#3B82F6]/30 p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Response Time Data</p>
              <p className="text-3xl font-bold text-white">Not tracked</p>
              <p className="text-[#3B82F6] text-xs mt-2 font-medium">No response timestamps</p>
            </div>
            <div className="w-12 h-12 bg-[#3B82F6]/20 rounded-lg flex items-center justify-center">
              <Clock className="w-6 h-6 text-[#3B82F6]" />
            </div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-[#FACC15]/20 to-[#FACC15]/5 border-[#FACC15]/30 p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Pending Reports</p>
              <p className="text-3xl font-bold text-white">{pendingReports}</p>
              <p className="text-[#FACC15] text-xs mt-2 font-medium">Awaiting Assignment</p>
            </div>
            <div className="w-12 h-12 bg-[#FACC15]/20 rounded-lg flex items-center justify-center">
              <Activity className="w-6 h-6 text-[#FACC15]" />
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Live Incident Feed */}
          <Card className="bg-[#0F1825]/80 backdrop-blur-sm border-gray-800 p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#FF3B30]/20 rounded-lg flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-[#FF3B30]" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Incident Feed</h2>
                  <p className="text-xs text-gray-400">Supabase incident reports</p>
                </div>
              </div>
              <Badge className="bg-[#FF3B30]/20 text-[#FF3B30] border-[#FF3B30]/50">
                <div className="w-2 h-2 bg-[#FF3B30] rounded-full animate-pulse mr-2"></div>
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
                <p className="py-6 text-center text-sm text-gray-400">No active incidents.</p>
              )}
            </div>
          </Card>

          {/* Incident locations */}
          <Card className="bg-[#0F1825]/80 backdrop-blur-sm border-gray-800 p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 bg-[#3B82F6]/20 rounded-lg flex items-center justify-center">
                <MapPin className="w-5 h-5 text-[#3B82F6]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Incident Locations</h2>
                <p className="text-xs text-gray-400">Location details from incident reports</p>
              </div>
            </div>
            <div className="space-y-3">
              {activeIncidents.slice(0, 5).map((incident) => (
                <div key={incident.id} className="flex items-start gap-3 rounded-lg border border-gray-800 bg-[#0B1220]/50 p-3">
                  <MapPin className="mt-0.5 h-4 w-4 text-[#3B82F6]" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white">{incident.type}</p>
                    <p className="text-xs text-gray-400">
                      {incident.building}{incident.location !== '—' ? `, ${incident.location}` : ''}
                    </p>
                  </div>
                  <span className="text-right text-xs text-gray-500">
                    {incident.gpsCoords.lat || incident.gpsCoords.lng
                      ? `${incident.gpsCoords.lat}, ${incident.gpsCoords.lng}`
                      : 'Coordinates unavailable'}
                  </span>
                </div>
              ))}
              {!loading && !error && activeIncidents.length === 0 && (
                <p className="py-6 text-center text-sm text-gray-400">No active incidents to locate.</p>
              )}
            </div>
          </Card>

          {/* System Analytics */}
          <Card className="bg-[#0F1825]/80 backdrop-blur-sm border-gray-800 p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 bg-[#3B82F6]/20 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-[#3B82F6]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">System Analytics</h2>
                <p className="text-xs text-gray-400">Incident trends and statistics</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Daily Incidents */}
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-3">Daily Incident Count</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={dailyIncidents}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis dataKey="day" stroke="#6b7280" style={{ fontSize: '12px' }} />
                    <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0F1825',
                        border: '1px solid #374151',
                        borderRadius: '8px'
                      }}
                      labelStyle={{ color: '#fff' }}
                    />
                    <Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Response time unavailable */}
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-3">Average Response Time</h3>
                <div className="flex h-[200px] items-center justify-center rounded-lg border border-gray-800 bg-[#0B1220]/50 text-sm text-gray-500">
                  Response timestamps are not available.
                </div>
              </div>
            </div>

            {/* Common Incidents */}
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-400 mb-3">Common Medical Incidents</h3>
              <div className="space-y-2">
                {incidentTypeCounts.map((item) => (
                  <div key={item.type} className="flex items-center gap-3">
                    <div className="flex-1 flex items-center gap-3">
                      <span className="text-sm text-gray-300 w-32">{item.type}</span>
                      <div className="flex-1 bg-gray-800 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-[#3B82F6] to-[#FF3B30] h-2 rounded-full transition-all"
                          style={{ width: `${Math.min((item.count / Math.max(incidents.length, 1)) * 100, 100)}%` }}
                        ></div>
                      </div>
                      {!loading && !error && incidentTypeCounts.length === 0 && (
                        <p className="text-sm text-gray-500">No incident statistics available.</p>
                      )}
                    </div>
                    <span className="text-sm font-semibold text-white w-8 text-right">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Responder Management */}
          <Card className="bg-[#0F1825]/80 backdrop-blur-sm border-gray-800 p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#22C55E]/20 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-[#22C55E]" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Responders</h2>
                  <p className="text-xs text-gray-400">Medical response team</p>
                </div>
              </div>
              <Badge className="bg-[#22C55E]/20 text-[#22C55E] border-[#22C55E]/50">
                {availableResponders.length} Available
              </Badge>
            </div>
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {responders.map((responder) => (
                <ResponderCard
                  key={responder.id}
                  responder={responder}
                />
              ))}
              {!loading && !error && responders.length === 0 && (
                <p className="py-4 text-center text-sm text-gray-400">No responders found.</p>
              )}
            </div>
          </Card>

          {/* Emergency Communication */}
          <Card className="bg-[#0F1825]/80 backdrop-blur-sm border-gray-800 p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 bg-[#3B82F6]/20 rounded-lg flex items-center justify-center">
                <Radio className="w-5 h-5 text-[#3B82F6]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Communication</h2>
                <p className="text-xs text-gray-400">Broadcast integration is not configured</p>
              </div>
            </div>
            <div className="rounded-lg border border-gray-800 bg-[#0B1220]/50 p-4 text-sm text-gray-400">
              Emergency broadcasts are unavailable until a delivery service is connected.
            </div>
          </Card>

          {/* Camera Identification */}
          <Card className="bg-[#0F1825]/80 backdrop-blur-sm border-gray-800 p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 bg-[#FACC15]/20 rounded-lg flex items-center justify-center">
                <Camera className="w-5 h-5 text-[#FACC15]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Camera Feed</h2>
                <p className="text-xs text-gray-400">Camera integration is not configured</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="aspect-video bg-[#0B1220] rounded-lg border border-gray-800 flex items-center justify-center">
                <Camera className="w-12 h-12 text-gray-700" />
              </div>
              <p className="text-xs text-gray-500">No camera feed is connected.</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
