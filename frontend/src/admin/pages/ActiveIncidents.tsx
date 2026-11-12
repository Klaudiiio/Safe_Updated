import { useState } from 'react';
import { AlertCircle, Filter } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { IncidentCard } from '../components/IncidentCard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { DataNotice } from '../DataNotice';
import { useAdminData } from '../useAdminData';
import { updateIncidentStatus } from '../api';
import { mapDbStatusToUi } from '../data/liveData';

export function ActiveIncidents() {
  const adminData = useAdminData() as any;
  const { incidents, loading, error } = adminData;
 
  // Active incidents are non-resolved incidents
  const activeIncidents = incidents.filter((i: any) => mapDbStatusToUi(i.status) !== 'resolved');
 
  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [buildingFilter, setBuildingFilter] = useState('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const filteredIncidents = incidents.filter((incident: any) => {
    const sev = (incident.severity || incident.priority || '').toLowerCase();
    const normalizedStat = mapDbStatusToUi(incident.status);
    const bld = (incident.building || incident.location || '').toLowerCase();

    return (
      (severityFilter === 'all' || sev === severityFilter) &&
      (statusFilter === 'all' || normalizedStat === statusFilter) &&
      (buildingFilter === 'all' || bld.includes(buildingFilter))
    );
  });

  const handleStatusChange = async (incidentId: string, newStatus: string) => {
    setUpdatingId(incidentId);
    try {
      await updateIncidentStatus(incidentId, newStatus);
      // Trigger a clean data refresh or fallback to reload
      if (typeof adminData.refetch === 'function') {
        await adminData.refetch();
      } else {
        window.location.reload();
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update incident status.');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <DataNotice loading={loading} error={error} />
     
      {/* Header */}
      <div className="flex items-center justify-between bg-white/40 backdrop-blur-sm p-5 rounded-2xl border border-sky-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 mb-1">Active Incidents</h1>
          <p className="text-slate-700 text-sm font-semibold">Monitor and manage ongoing emergency situations</p>
        </div>
        <Badge className="bg-red-100 text-red-700 border-red-200 font-bold text-base px-4 py-2">
          <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse mr-2"></div>
          {activeIncidents.length} Active
        </Badge>
      </div>

      {/* Filters */}
      <Card className="bg-white border-sky-100/60 shadow-md p-4 rounded-2xl">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-semibold text-slate-700">Filter by:</span>
          </div>
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="w-40 bg-slate-50 border-slate-200 text-slate-800 font-medium rounded-xl">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent className="bg-white border-slate-200 text-slate-800 shadow-xl rounded-xl">
              <SelectItem value="all">All Severities</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40 bg-slate-50 border-slate-200 text-slate-800 font-medium rounded-xl">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-white border-slate-200 text-slate-800 shadow-xl rounded-xl">
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="assigned">Assigned</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
          <Select value={buildingFilter} onValueChange={setBuildingFilter}>
            <SelectTrigger className="w-48 bg-slate-50 border-slate-200 text-slate-800 font-medium rounded-xl">
              <SelectValue placeholder="Building" />
            </SelectTrigger>
            <SelectContent className="bg-white border-slate-200 text-slate-800 shadow-xl rounded-xl">
              <SelectItem value="all">All Buildings</SelectItem>
              <SelectItem value="engineering">Engineering Building</SelectItem>
              <SelectItem value="science">Science Building</SelectItem>
              <SelectItem value="main">Main Building</SelectItem>
              <SelectItem value="cafeteria">Cafeteria</SelectItem>
              <SelectItem value="gym">Gymnasium</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Incidents Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredIncidents.map((incident: any) => (
          <IncidentCard
            key={incident.id}
            incident={incident}
            onStatusChange={handleStatusChange}
            isUpdating={updatingId === incident.id}
          />
        ))}
      </div>

      {!loading && !error && filteredIncidents.length === 0 && (
        <Card className="bg-white border-sky-100/60 shadow-md p-12 text-center rounded-2xl">
          <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-900 mb-2">
            {activeIncidents.length === 0 ? 'No Active Incidents' : 'No Matching Incidents'}
          </h3>
          <p className="text-slate-500 text-sm font-medium">
            {activeIncidents.length === 0
              ? 'All emergency situations have been resolved'
              : 'No incidents match the selected filters.'}
          </p>
        </Card>
      )}
    </div>
  );
}