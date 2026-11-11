import { useState, useMemo } from 'react';
import { Search, Filter, Download, FileText } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { DataNotice } from '../DataNotice';
import { useAdminData } from '../useAdminData';

export function IncidentLogs() {
  const { incidents, logs, loading, error } = useAdminData();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Build and synchronize logs matching live incidents and assigning granular attributes safely
  const dataSource = useMemo(() => {
    const rawSource = logs && logs.length > 0 ? logs : incidents;

    return rawSource.map((item: any, index: number) => {
      const logIncId = String(item.incidentId || item.id || item.incident_id || '');
      const matchingIncident = incidents.find((inc: any) =>
        String(inc.id) === logIncId ||
        String((inc as any).incident_id) === logIncId ||
        String(inc.id) === String(index + 1)
      ) as any;

      const rawStatus = String(matchingIncident?.status || item.status || 'PENDING').toLowerCase();
     
      let normalizedStatus = 'PENDING';
      if (['resolved', 'completed'].includes(rawStatus)) {
        normalizedStatus = 'RESOLVED';
      } else if (['assigned', 'accepted', 'responding'].includes(rawStatus)) {
        normalizedStatus = 'ASSIGNED';
      } else if (rawStatus === 'active') {
        normalizedStatus = 'ACTIVE';
      } else if (rawStatus === 'pending') {
        normalizedStatus = 'PENDING';
      }

      // Extract specific attributes safely, directly prioritizing the reporting user's username
      const incidentType = matchingIncident?.type || item.type || 'Medical Emergency';
      const reporter =
        matchingIncident?.reporterUsername ||
        matchingIncident?.users?.username ||
        matchingIncident?.username ||
        matchingIncident?.user_name ||
        item.reporterUsername ||
        item.username ||
        item.reporter ||
        'anonymous';
       
      const timestamp = item.timestamp || item.time || matchingIncident?.reportedAt || item.date || 'Today';
      const building = matchingIncident?.building || item.building || 'Main Campus';
      const floor = matchingIncident?.floor || item.floor || matchingIncident?.location || 'Floor 1';
      const responders = matchingIncident?.assignedResponders || matchingIncident?.assignedResponder || item.responders || item.assignedResponders || 'Unassigned';

      return {
        id: item.id || index + 1,
        incidentId: logIncId || matchingIncident?.id || index + 1,
        type: incidentType,
        action: item.action || `Reported ${incidentType}`,
        reporter,
        timestamp,
        building,
        floor,
        responders: Array.isArray(responders) ? responders.join(', ') : String(responders),
        status: normalizedStatus,
      };
    });
  }, [incidents, logs]);

  // Filter logs based on search query and status option
  const filteredLogs = useMemo(() => {
    return dataSource.filter((item: any) => {
      const idStr = String(item.incidentId || '');
      const typeStr = String(item.type || '');
      const reporterStr = String(item.reporter || '');
      const buildingStr = String(item.building || '');
      const respondersStr = String(item.responders || '');
      const statusStr = String(item.status || '');

      const matchesSearch =
        idStr.toLowerCase().includes(searchTerm.toLowerCase()) ||
        typeStr.toLowerCase().includes(searchTerm.toLowerCase()) ||
        reporterStr.toLowerCase().includes(searchTerm.toLowerCase()) ||
        buildingStr.toLowerCase().includes(searchTerm.toLowerCase()) ||
        respondersStr.toLowerCase().includes(searchTerm.toLowerCase()) ||
        statusStr.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        statusFilter === 'ALL' ||
        statusStr.toUpperCase() === statusFilter.toUpperCase();

      return matchesSearch && matchesStatus;
    });
  }, [dataSource, searchTerm, statusFilter]);

  // Statistics summaries
  const totalIncidents = incidents.length;
  const resolvedIncidents = incidents.filter(
    (i: any) => ['resolved', 'completed'].includes(i.status?.toLowerCase())
  ).length;

  const mostCommonType = useMemo(() => {
    if (!incidents.length) return 'None';
    const counts: Record<string, number> = {};
    incidents.forEach((inc: any) => {
      const typeName = inc.type || 'Emergency Report';
      counts[typeName] = (counts[typeName] || 0) + 1;
    });
    return Object.keys(counts).reduce((a, b) => (counts[a] > counts[b] ? a : b), 'None');
  }, [incidents]);

  // Handle Export Logs to CSV with expanded granular headers
  const handleExportCSV = () => {
    if (!filteredLogs.length) return;

    const headers = ['Incident ID', 'Incident Type', 'Reporter', 'Timestamp', 'Building & Floor', 'Responders', 'Status'];
    const csvRows = [
      headers.join(','),
      ...filteredLogs.map((item: any) => {
        return [
          `"${item.incidentId}"`,
          `"${item.type}"`,
          `"${item.reporter}"`,
          `"${item.timestamp}"`,
          `"${item.building} ${item.floor}"`,
          `"${item.responders}"`,
          `"${item.status}"`,
        ].join(',');
      }),
    ];

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `incident_logs_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <DataNotice loading={loading} error={error} />

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white/40 backdrop-blur-sm p-5 rounded-2xl border border-amber-200/50 shadow-sm">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 mb-1">Incident Logs & Records</h1>
          <p className="text-slate-700 text-sm font-semibold">
            Detailed tracking of reporters, occurrence times, assigned responders, and location logs
          </p>
        </div>
        <button
          onClick={handleExportCSV}
          disabled={!filteredLogs.length}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs transition-all shadow-md w-fit cursor-pointer"
        >
          <Download className="w-4 h-4" />
          Export Logs
        </button>
      </div>

      {/* Filter and Search Bar */}
      <Card className="bg-white border-amber-200/60 shadow-md p-4 rounded-2xl">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by ID, type, reporter, building, or responder..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-900 font-medium placeholder-slate-400 focus:outline-none focus:border-blue-600 transition-all"
            />
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Filter className="w-4 h-4 text-slate-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 font-medium focus:outline-none focus:border-blue-600 w-full md:w-auto cursor-pointer"
            >
              <option value="ALL">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="ACTIVE">Active</option>
              <option value="ASSIGNED">Assigned</option>
              <option value="RESOLVED">Resolved</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Analytics Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white border-amber-200/60 shadow-md p-5 rounded-2xl">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Total Incidents</p>
          <p className="text-2xl font-extrabold text-slate-900">{totalIncidents}</p>
          <p className="text-xs text-slate-400 mt-2 font-medium">All time logs</p>
        </Card>

        <Card className="bg-white border-emerald-200 shadow-md p-5 rounded-2xl">
          <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-1">Resolved Incidents</p>
          <p className="text-2xl font-extrabold text-emerald-600">{resolvedIncidents}</p>
          <p className="text-xs text-slate-400 mt-2 font-medium">Successfully closed</p>
        </Card>

        <Card className="bg-white border-blue-200 shadow-md p-5 rounded-2xl">
          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-1">Avg Response Time</p>
          <p className="text-2xl font-extrabold text-blue-600">Not tracked</p>
          <p className="text-xs text-slate-400 mt-2 font-medium">Duration unavailable</p>
        </Card>

        <Card className="bg-white border-amber-300 shadow-md p-5 rounded-2xl">
          <p className="text-xs font-semibold text-amber-800 uppercase tracking-wider mb-1">Most Common Type</p>
          <p className="text-lg font-extrabold text-slate-900 truncate">{mostCommonType}</p>
          <p className="text-xs text-slate-400 mt-2 font-medium">Based on active logs</p>
        </Card>
      </div>

      {/* Logs Table */}
      <Card className="bg-white border-amber-200/60 shadow-md rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-xs font-bold text-slate-700 uppercase tracking-wider">
                <th className="px-6 py-4">Incident ID</th>
                <th className="px-6 py-4">Incident Type</th>
                <th className="px-6 py-4">Reporter</th>
                <th className="px-6 py-4">When It Happened</th>
                <th className="px-6 py-4">Building & Floor</th>
                <th className="px-6 py-4">Responders</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
              {filteredLogs.map((item: any, index: number) => {
                const statusStr = (item.status || 'PENDING').toUpperCase();
                const isResolved = statusStr === 'RESOLVED';
                const isPending = statusStr === 'PENDING';
                const isAssigned = statusStr === 'ASSIGNED';

                return (
                  <tr key={`${item.incidentId}-${index}`} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs text-blue-600 font-bold">
                      #{item.incidentId}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-900">
                      {item.type}
                    </td>
                    <td className="px-6 py-4 text-blue-700 font-mono text-xs font-semibold">{item.reporter}</td>
                    <td className="px-6 py-4 text-slate-500 text-xs whitespace-nowrap font-medium">
                      {item.timestamp}
                    </td>
                    <td className="px-6 py-4 text-slate-600 text-xs font-medium">
                      <div className="font-bold text-slate-900">{item.building}</div>
                      <div className="text-slate-500">{item.floor}</div>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-600 font-medium">
                      {item.responders && item.responders !== 'Unassigned' ? (
                        <span className="text-emerald-700 font-bold">{item.responders}</span>
                      ) : (
                        <span className="text-slate-400 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <Badge
                        className={
                          isResolved
                            ? 'bg-emerald-100 text-emerald-700 border-emerald-200 font-bold'
                            : isAssigned
                            ? 'bg-blue-100 text-blue-700 border-blue-200 font-bold'
                            : isPending
                            ? 'bg-amber-100 text-amber-800 border-amber-200 font-bold'
                            : 'bg-red-100 text-red-700 border-red-200 font-bold'
                        }
                      >
                        {statusStr}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
              {!loading && filteredLogs.length === 0 && (
                <tr className="hover:bg-transparent">
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <FileText className="w-12 h-12 mx-auto mb-3 text-slate-400 stroke-1" />
                    <p className="text-base font-bold text-slate-900">No matching incident logs.</p>
                    <p className="text-xs text-slate-500 mt-1 font-medium">
                      New activity records will populate here automatically.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}