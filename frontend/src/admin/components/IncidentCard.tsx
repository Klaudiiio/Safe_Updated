import { AlertCircle, MapPin, Clock, User, Phone, RefreshCw } from 'lucide-react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import type { Incident } from '../data/mockData';
import { mapDbStatusToUi } from '../data/liveData';

interface IncidentCardProps {
  incident: Incident | any;
  onAssignResponder?: (incidentId: string) => void;
  onViewDetails?: (incidentId: string) => void;
  onStatusChange?: (incidentId: string, newStatus: string) => void;
  isUpdating?: boolean;
}

const severityConfig: Record<string, { color: string; iconBg: string; dotColor: string; label: string }> = {
  critical: {
    color: 'bg-red-50 text-red-700 border-red-200',
    iconBg: 'bg-red-600 text-white shadow-xs',
    dotColor: 'bg-red-600',
    label: 'Critical',
  },
  urgent: {
    color: 'bg-red-50 text-red-700 border-red-200',
    iconBg: 'bg-red-600 text-white shadow-xs',
    dotColor: 'bg-red-600',
    label: 'Urgent',
  },
  high: {
    color: 'bg-orange-50 text-orange-700 border-orange-200',
    iconBg: 'bg-orange-600 text-white shadow-xs',
    dotColor: 'bg-orange-600',
    label: 'High',
  },
  medium: {
    color: 'bg-amber-50 text-amber-800 border-amber-200',
    iconBg: 'bg-amber-500 text-white shadow-xs',
    dotColor: 'bg-amber-500',
    label: 'Medium',
  },
  low: {
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    iconBg: 'bg-emerald-600 text-white shadow-xs',
    dotColor: 'bg-emerald-600',
    label: 'Low',
  },
  minor: {
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    iconBg: 'bg-emerald-600 text-white shadow-xs',
    dotColor: 'bg-emerald-600',
    label: 'Minor',
  },
};

const DEFAULT_SEVERITY = {
  color: 'bg-red-50 text-red-700 border-red-200',
  iconBg: 'bg-red-600 text-white shadow-xs',
  dotColor: 'bg-red-600',
  label: 'Urgent',
};

export function IncidentCard({
  incident,
  onAssignResponder,
  onViewDetails,
  onStatusChange,
  isUpdating = false
}: IncidentCardProps) {
  const sevKey = (incident.severity || incident.priority || 'urgent').toLowerCase();
  const severity = severityConfig[sevKey] || DEFAULT_SEVERITY;

  const reporterName = incident.reporterName || incident.reporter || 'Anonymous';
  const timeReported = incident.timeReported || incident.time || incident.date || 'Today';
  const buildingText = incident.building || incident.location || 'Main Campus';

  // Normalize current status using the centralized mapper
  const currentUiStatus = mapDbStatusToUi(incident.status);

  return (
    <Card className="bg-white border-[#E2E8F0] shadow-xs hover:shadow-sm transition-all p-4 rounded-xl">
      <div className="space-y-3">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className={`w-9 h-9 rounded-lg ${severity.iconBg} flex items-center justify-center flex-shrink-0`}>
              <AlertCircle className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-slate-900 font-bold text-xs truncate">{incident.type || 'Emergency Report'}</h3>
              <p className="text-slate-400 text-[11px] mt-0.5 font-mono">ID: #{incident.id}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
            <Badge className={`${severity.color} border text-[11px] font-semibold rounded-md px-2 py-0.5`}>
              <div className={`w-1.5 h-1.5 rounded-full ${severity.dotColor} animate-pulse mr-1.5`}></div>
              {severity.label}
            </Badge>

            {/* Integrated Status Dropdown */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-[#E2E8F0] px-2 py-1 rounded-lg">
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Status:</span>
              {isUpdating && <RefreshCw className="w-3 h-3 text-blue-600 animate-spin" />}
              <select
                disabled={isUpdating}
                value={currentUiStatus}
                onChange={(e) => onStatusChange?.(incident.id, e.target.value)}
                className="bg-transparent text-xs text-slate-800 font-semibold focus:outline-none cursor-pointer disabled:opacity-50"
              >
                <option value="pending" className="bg-white text-slate-800">Pending</option>
                <option value="active" className="bg-white text-slate-800">Active</option>
                <option value="assigned" className="bg-white text-slate-800">Assigned</option>
                <option value="resolved" className="bg-white text-slate-800">Resolved</option>
              </select>
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="space-y-1.5 text-xs pt-1 text-slate-600">
          <div className="flex items-center gap-2">
            <User className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <span className="text-slate-500">Reporter:</span>
            <span className="font-semibold text-slate-900 truncate">{reporterName}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <span className="text-slate-500">Location:</span>
            <span className="font-semibold text-slate-900 truncate">{buildingText}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <span className="text-slate-500">Reported:</span>
            <span className="font-semibold text-slate-900">{timeReported}</span>
          </div>
        </div>

        {/* Description */}
        {incident.description && (
          <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-[#E2E8F0] line-clamp-2">
            {incident.description}
          </p>
        )}

        {/* Assigned Responder */}
        {incident.assignedResponder && (
          <div className="flex items-center gap-2 p-2 bg-blue-50/60 rounded-lg border border-blue-100">
            <Phone className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-xs text-slate-500">Assigned to:</span>
            <span className="text-xs text-slate-900 font-bold">{incident.assignedResponder}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          {currentUiStatus === 'pending' && onAssignResponder && (
            <Button
              size="sm"
              onClick={() => onAssignResponder(incident.id)}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg h-8 shadow-xs cursor-pointer"
            >
              <User className="w-3.5 h-3.5 mr-1" />
              Assign Responder
            </Button>
          )}
          {onViewDetails && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onViewDetails(incident.id)}
              className="flex-1 border-[#E2E8F0] bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-50 text-xs font-medium rounded-lg h-8 shadow-xs cursor-pointer"
            >
              View Details
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}