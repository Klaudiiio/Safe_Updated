import { useState } from 'react';
import { AlertCircle, Filter } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { IncidentCard } from '../components/IncidentCard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { DataNotice } from '../DataNotice';
import { useAdminData } from '../useAdminData';
import { updateIncidentStatus } from '../api';

export function ActiveIncidents() {
  const { incidents, loading, error } = useAdminData();
  const activeIncidents = incidents.filter((i: any) => i.status?.toLowerCase() !== 'resolved');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [buildingFilter, setBuildingFilter] = useState('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const filteredIncidents = activeIncidents.filter((incident: any) => {
    const sev = (incident.severity || incident.priority || '').toLowerCase();
    const stat = (incident.status || '').toLowerCase();
    const bld = (incident.building || incident.location || '').toLowerCase();

    return (
      (severityFilter === 'all' || sev === severityFilter) &&
      (statusFilter === 'all' || stat === statusFilter) &&
      (buildingFilter === 'all' || bld.includes(buildingFilter))
    );
  });

  const handleStatusChange = async (incidentId: string, newStatus: string) => {
    setUpdatingId(incidentId);
    try {
      await updateIncidentStatus(incidentId, newStatus);
      window.location.reload();
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Active Incidents</h1>
          <p className="text-gray-400 text-sm">Monitor and manage ongoing emergency situations</p>
        </div>
        <Badge className="bg-[#FF3B30]/20 text-[#FF3B30] border-[#FF3B30]/50 text-base px-4 py-2">
          <div className="w-2 h-2 bg-[#FF3B30] rounded-full animate-pulse mr-2"></div>
          {activeIncidents.length} Active
        </Badge>
      </div>

      {/* Filters */}
      <Card className="bg-[#0F1825]/80 backdrop-blur-sm border-gray-800 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-400">Filter by:</span>
          </div>
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="w-40 bg-[#0B1220] border-gray-800 text-white">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent className="bg-[#0F1825] border-gray-800">
              <SelectItem value="all">All Severities</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40 bg-[#0B1220] border-gray-800 text-white">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-[#0F1825] border-gray-800">
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="assigned">Assigned</SelectItem>
              <SelectItem value="responding">Responding</SelectItem>
            </SelectContent>
          </Select>
          <Select value={buildingFilter} onValueChange={setBuildingFilter}>
            <SelectTrigger className="w-48 bg-[#0B1220] border-gray-800 text-white">
              <SelectValue placeholder="Building" />
            </SelectTrigger>
            <SelectContent className="bg-[#0F1825] border-gray-800">
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
        <Card className="bg-[#0F1825]/80 backdrop-blur-sm border-gray-800 p-12 text-center">
          <AlertCircle className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">
            {activeIncidents.length === 0 ? 'No Active Incidents' : 'No Matching Incidents'}
          </h3>
          <p className="text-gray-400 text-sm">
            {activeIncidents.length === 0
              ? 'All emergency situations have been resolved'
              : 'No incidents match the selected filters.'}
          </p>
        </Card>
      )}
    </div>
  );
}