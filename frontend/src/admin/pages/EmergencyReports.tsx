import { useState } from 'react';
import { FileText } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { DataNotice } from '../DataNotice';
import { useAdminData } from '../useAdminData';

export function EmergencyReports() {
  const { incidents, loading, error } = useAdminData();
  const [today] = useState(() => new Date().toDateString());
  const todayReports = incidents.filter((incident) => (
    incident.reportedAt ? new Date(incident.reportedAt).toDateString() === today : false
  )).length;
  const resolvedReports = incidents.filter((incident) => incident.status === 'resolved').length;

  return (
    <div className="space-y-6">
      <DataNotice loading={loading} error={error} />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Emergency Reports</h1>
          <p className="text-gray-400 text-sm">Incident reports synchronized from Supabase</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-[#3B82F6]/20 to-[#3B82F6]/5 border-[#3B82F6]/30 p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Today's Reports</p>
              <p className="text-3xl font-bold text-white">{todayReports}</p>
            </div>
            <FileText className="w-8 h-8 text-[#3B82F6]" />
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-[#22C55E]/20 to-[#22C55E]/5 border-[#22C55E]/30 p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Resolved Reports</p>
              <p className="text-3xl font-bold text-white">{resolvedReports}</p>
            </div>
            <FileText className="w-8 h-8 text-[#22C55E]" />
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-[#FACC15]/20 to-[#FACC15]/5 border-[#FACC15]/30 p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Avg Response</p>
              <p className="text-3xl font-bold text-white">Not tracked</p>
            </div>
            <FileText className="w-8 h-8 text-[#FACC15]" />
          </div>
        </Card>
      </div>

      {/* Reports List */}
      <Card className="bg-[#0F1825]/80 backdrop-blur-sm border-gray-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-5">Recent Reports</h2>
        <div className="space-y-3">
          {incidents.map((incident) => (
            <div
              key={incident.id}
              className="flex items-center justify-between p-4 bg-[#0B1220]/50 rounded-lg border border-gray-800 hover:border-[#3B82F6]/50 transition-all"
            >
              <div className="flex items-center gap-4 flex-1">
                <div className="w-12 h-12 bg-[#3B82F6]/20 rounded-lg flex items-center justify-center">
                  <FileText className="w-6 h-6 text-[#3B82F6]" />
                </div>
                <div className="flex-1">
                  <h3 className="text-white font-medium text-sm">{incident.type}</h3>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-gray-400">{incident.id}</span>
                    <span className="text-xs text-gray-500">•</span>
                    <span className="text-xs text-gray-400">{incident.building}</span>
                    <span className="text-xs text-gray-500">•</span>
                    <span className="text-xs text-gray-400">{incident.timeReported}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge
                  className={
                    incident.status === 'resolved'
                      ? 'bg-[#22C55E]/20 text-[#22C55E] border-[#22C55E]/50'
                      : 'bg-[#FACC15]/20 text-[#FACC15] border-[#FACC15]/50'
                  }
                >
                  {incident.status}
                </Badge>
                <span className="text-xs text-gray-500">Read only</span>
              </div>
            </div>
          ))}
          {!loading && !error && incidents.length === 0 && (
            <p className="text-center text-sm text-gray-400">No reports found.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
