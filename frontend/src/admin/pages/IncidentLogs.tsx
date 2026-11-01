import { useState } from 'react';
import { Download, Search } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { DataNotice } from '../DataNotice';
import { useAdminData } from '../useAdminData';

export function IncidentLogs() {
  const { logs, loading, error } = useAdminData();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const filteredLogs = logs.filter((log) => {
    const matchesSearch = `${log.id} ${log.incidentType} ${log.reporter} ${log.building}`
      .toLowerCase()
      .includes(search.toLowerCase());
    return matchesSearch && (statusFilter === 'all' || log.status === statusFilter);
  });
  const mostCommonIncident = logs.reduce<{ type: string; count: number } | null>((common, log) => {
    const count = logs.filter((item) => item.incidentType === log.incidentType).length;
    return !common || count > common.count ? { type: log.incidentType, count } : common;
  }, null);

  const exportLogs = () => {
    const columns = ['Incident ID', 'Type', 'Reporter', 'Building', 'Date', 'Time', 'Status', 'Responded By', 'Response Time'];
    const values = filteredLogs.map((log) => [
      log.id, log.incidentType, log.reporter, log.building, log.date,
      log.time, log.status, log.respondedBy, log.responseTime,
    ]);
    const csv = [columns, ...values]
      .map((row) => row.map((value) => `"${value.replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'incident-logs.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <DataNotice loading={loading} error={error} />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Incident Logs & Records</h1>
          <p className="text-gray-400 text-sm">Incident activity records synchronized from Supabase</p>
        </div>
        <Button onClick={exportLogs} disabled={loading || Boolean(error)} className="bg-[#3B82F6] hover:bg-[#3B82F6]/80 text-white">
          <Download className="w-4 h-4 mr-2" />
          Export Logs
        </Button>
      </div>

      {/* Filters */}
      <Card className="bg-[#0F1825]/80 backdrop-blur-sm border-gray-800 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by incident ID, reporter, or type..."
              className="pl-10 bg-[#0B1220] border-gray-800 text-white placeholder:text-gray-500"
            />
          </div>
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40 bg-[#0B1220] border-gray-800 text-white">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-[#0F1825] border-gray-800">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
                <SelectItem value="responding">Responding</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Logs Table */}
      <Card className="bg-[#0F1825]/80 backdrop-blur-sm border-gray-800">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-gray-800 hover:bg-transparent">
                <TableHead className="text-gray-400">Incident ID</TableHead>
                <TableHead className="text-gray-400">Type</TableHead>
                <TableHead className="text-gray-400">Reporter</TableHead>
                <TableHead className="text-gray-400">Building</TableHead>
                <TableHead className="text-gray-400">Date</TableHead>
                <TableHead className="text-gray-400">Time</TableHead>
                <TableHead className="text-gray-400">Status</TableHead>
                <TableHead className="text-gray-400">Responded By</TableHead>
                <TableHead className="text-gray-400">Response Time</TableHead>
                <TableHead className="text-gray-400">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.map((log) => (
                <TableRow key={log.id} className="border-gray-800 hover:bg-[#0B1220]/50">
                  <TableCell className="font-medium text-white">{log.id}</TableCell>
                  <TableCell className="text-gray-300">{log.incidentType}</TableCell>
                  <TableCell className="text-gray-300">{log.reporter}</TableCell>
                  <TableCell className="text-gray-300">{log.building}</TableCell>
                  <TableCell className="text-gray-300">{log.date}</TableCell>
                  <TableCell className="text-gray-300">{log.time}</TableCell>
                  <TableCell>
                    <Badge
                      className={
                        log.status === 'resolved'
                          ? 'bg-[#22C55E]/20 text-[#22C55E] border-[#22C55E]/50'
                          : log.status === 'responding'
                          ? 'bg-[#FACC15]/20 text-[#FACC15] border-[#FACC15]/50'
                          : log.status === 'assigned'
                          ? 'bg-[#3B82F6]/20 text-[#3B82F6] border-[#3B82F6]/50'
                          : 'bg-gray-500/20 text-gray-400 border-gray-500/50'
                      }
                    >
                      {log.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-gray-300">{log.respondedBy}</TableCell>
                  <TableCell className="text-gray-300">{log.responseTime}</TableCell>
                  <TableCell className="text-gray-500">Read only</TableCell>
                </TableRow>
              ))}
              {!loading && !error && filteredLogs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="py-8 text-center text-gray-400">
                    No matching incident logs.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-[#0F1825]/80 backdrop-blur-sm border-gray-800 p-5">
          <p className="text-gray-400 text-sm mb-1">Total Incidents</p>
          <p className="text-2xl font-bold text-white">{logs.length}</p>
          <p className="text-xs text-gray-500 mt-1">All time</p>
        </Card>
        <Card className="bg-[#0F1825]/80 backdrop-blur-sm border-gray-800 p-5">
          <p className="text-gray-400 text-sm mb-1">Resolved Incidents</p>
          <p className="text-2xl font-bold text-[#22C55E]">
            {logs.filter((log) => log.status === 'resolved').length}
          </p>
          <p className="text-xs text-gray-500 mt-1">From available activity logs</p>
        </Card>
        <Card className="bg-[#0F1825]/80 backdrop-blur-sm border-gray-800 p-5">
          <p className="text-gray-400 text-sm mb-1">Avg Response Time</p>
          <p className="text-2xl font-bold text-[#3B82F6]">Not tracked</p>
          <p className="text-xs text-gray-500 mt-1">Response duration unavailable</p>
        </Card>
        <Card className="bg-[#0F1825]/80 backdrop-blur-sm border-gray-800 p-5">
          <p className="text-gray-400 text-sm mb-1">Most Common</p>
          <p className="text-2xl font-bold text-[#FACC15]">{mostCommonIncident?.type ?? '—'}</p>
          <p className="text-xs text-gray-500 mt-1">
            {mostCommonIncident ? `${mostCommonIncident.count} logged records` : 'No activity logs'}
          </p>
        </Card>
      </div>
    </div>
  );
}
