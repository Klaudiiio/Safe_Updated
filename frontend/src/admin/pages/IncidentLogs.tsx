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

  // Use incidents as the primary record source if logs array is empty
  const dataSource = logs.length > 0 ? logs : incidents;

  // Filter logs or incidents based on search and status
  const filteredLogs = useMemo(() => {
    return dataSource.filter((item: any) => {
      const idStr = String(item.incidentId || item.id || '');
      const actionStr = String(item.action || item.type || '');
      const reporterStr = String(item.responder || item.reporter || '');
      const statusStr = String(item.status || '');

      const matchesSearch =
        idStr.toLowerCase().includes(searchTerm.toLowerCase()) ||
        actionStr.toLowerCase().includes(searchTerm.toLowerCase()) ||
        reporterStr.toLowerCase().includes(searchTerm.toLowerCase()) ||
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
    (i: any) => i.status?.toUpperCase() === 'RESOLVED'
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

  // Handle Export Logs to CSV
  const handleExportCSV = () => {
    if (!filteredLogs.length) return;

    const headers = ['Log ID', 'Incident ID', 'Action / Type', 'Timestamp', 'Responder / Reporter', 'Status'];
    const csvRows = [
      headers.join(','),
      ...filteredLogs.map((item: any) => {
        const logId = item.id || '';
        const incId = item.incidentId || item.id || '';
        const action = item.action || item.type || '';
        const timestamp = item.timestamp || `${item.date || ''} ${item.time || ''}`.trim();
        const responder = item.responder || item.reporter || '';
        const status = item.status || '';

        return [
          `"${logId}"`,
          `"${incId}"`,
          `"${action}"`,
          `"${timestamp}"`,
          `"${responder}"`,
          `"${status}"`,
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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Incident Logs & Records</h1>
          <p className="text-gray-400 text-sm">
            Incident activity records synchronized from Supabase
          </p>
        </div>
        <button
          onClick={handleExportCSV}
          disabled={!filteredLogs.length}
          className="flex items-center gap-2 px-4 py-2 bg-[#3B82F6] hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg font-medium text-sm transition-all shadow-md shadow-blue-500/10 w-fit"
        >
          <Download className="w-4 h-4" />
          Export Logs
        </button>
      </div>

      {/* Filter and Search Bar */}
      <Card className="bg-[#0F1825]/80 backdrop-blur-sm border-gray-800 p-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search by incident ID, reporter, or action..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#0B1220] border border-gray-800 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#3B82F6] transition-all"
            />
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#0B1220] border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#3B82F6] w-full md:w-auto"
            >
              <option value="ALL">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="ACTIVE">Active</option>
              <option value="RESOLVED">Resolved</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Logs Table */}
      <Card className="bg-[#0F1825]/80 backdrop-blur-sm border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-800 bg-[#0B1220]/60 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                <th className="px-6 py-4">Incident ID</th>
                <th className="px-6 py-4">Action / Description</th>
                <th className="px-6 py-4">Reporter / Responder</th>
                <th className="px-6 py-4">Timestamp</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60 text-sm text-gray-300">
              {filteredLogs.map((item: any, index: number) => {
                const statusStr = (item.status || 'PENDING').toUpperCase();
                const isResolved = statusStr === 'RESOLVED';
                const isPending = statusStr === 'PENDING';
                const logId = item.incidentId || item.id || index;
                const actionText = item.action || `Incident reported: ${item.type}`;
                const reporterText = item.responder || item.reporter || 'System';
                const timestampText = item.timestamp || `${item.date || 'Today'} ${item.time || ''}`.trim();

                return (
                  <tr key={`${logId}-${index}`} className="hover:bg-[#0B1220]/40 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs text-blue-400 font-medium">
                      #{logId}
                    </td>
                    <td className="px-6 py-4 font-medium text-white max-w-xs truncate">
                      {actionText}
                    </td>
                    <td className="px-6 py-4 text-gray-400">{reporterText}</td>
                    <td className="px-6 py-4 text-gray-400 text-xs whitespace-nowrap">
                      {timestampText}
                    </td>
                    <td className="px-6 py-4">
                      <Badge
                        className={
                          isResolved
                            ? 'bg-green-500/20 text-green-400 border-green-500/30'
                            : isPending
                            ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                            : 'bg-red-500/20 text-red-400 border-red-500/30'
                        }
                      >
                        {statusStr}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {!loading && filteredLogs.length === 0 && (
            <div className="py-12 text-center text-gray-400">
              <FileText className="w-12 h-12 mx-auto mb-3 text-gray-600 stroke-1" />
              <p className="text-base font-medium">No matching incident logs.</p>
              <p className="text-xs text-gray-500 mt-1">
                New mobile submissions will populate here automatically.
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Analytics Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-[#0F1825]/80 backdrop-blur-sm border-gray-800 p-5">
          <p className="text-xs font-medium text-gray-400 mb-1">Total Incidents</p>
          <p className="text-2xl font-bold text-white">{totalIncidents}</p>
          <p className="text-xs text-gray-500 mt-2">All time</p>
        </Card>

        <Card className="bg-[#0F1825]/80 backdrop-blur-sm border-gray-800 p-5">
          <p className="text-xs font-medium text-gray-400 mb-1">Resolved Incidents</p>
          <p className="text-2xl font-bold text-green-400">{resolvedIncidents}</p>
          <p className="text-xs text-gray-500 mt-2">From available activity logs</p>
        </Card>

        <Card className="bg-[#0F1825]/80 backdrop-blur-sm border-gray-800 p-5">
          <p className="text-xs font-medium text-gray-400 mb-1">Avg Response Time</p>
          <p className="text-2xl font-bold text-blue-400">Not tracked</p>
          <p className="text-xs text-gray-500 mt-2">Response duration unavailable</p>
        </Card>

        <Card className="bg-[#0F1825]/80 backdrop-blur-sm border-gray-800 p-5">
          <p className="text-xs font-medium text-gray-400 mb-1">Most Common Type</p>
          <p className="text-lg font-semibold text-white truncate">{mostCommonType}</p>
          <p className="text-xs text-gray-500 mt-2">Based on active logs</p>
        </Card>
      </div>
    </div>
  );
}