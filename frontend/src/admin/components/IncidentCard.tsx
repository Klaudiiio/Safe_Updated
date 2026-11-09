import { AlertCircle, MapPin, Clock, User, Phone, RefreshCw } from 'lucide-react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import type { Incident } from '../data/mockData';

interface IncidentCardProps {
  incident: Incident | any;
  onAssignResponder?: (incidentId: string) => void;
  onViewDetails?: (incidentId: string) => void;
  onStatusChange?: (incidentId: string, newStatus: string) => void;
  isUpdating?: boolean;
}

const severityConfig: Record<string, { color: string; dotColor: string; label: string }> = {
  critical: {
    color: 'bg-[#FF3B30]/20 text-[#FF3B30] border-[#FF3B30]/50',
    dotColor: 'bg-[#FF3B30]',
    label: 'Critical',
  },
  urgent: {
    color: 'bg-[#FF3B30]/20 text-[#FF3B30] border-[#FF3B30]/50',
    dotColor: 'bg-[#FF3B30]',
    label: 'Urgent',
  },
  high: {
    color: 'bg-orange-500/20 text-orange-500 border-orange-500/50',
    dotColor: 'bg-orange-500',
    label: 'High',
  },
  medium: {
    color: 'bg-[#FACC15]/20 text-[#FACC15] border-[#FACC15]/50',
    dotColor: 'bg-[#FACC15]',
    label: 'Medium',
  },
  low: {
    color: 'bg-[#22C55E]/20 text-[#22C55E] border-[#22C55E]/50',
    dotColor: 'bg-[#22C55E]',
    label: 'Low',
  },
  minor: {
    color: 'bg-[#22C55E]/20 text-[#22C55E] border-[#22C55E]/50',
    dotColor: 'bg-[#22C55E]',
    label: 'Minor',
  },
};

const DEFAULT_SEVERITY = {
  color: 'bg-[#FF3B30]/20 text-[#FF3B30] border-[#FF3B30]/50',
  dotColor: 'bg-[#FF3B30]',
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

  return (
    <Card className="bg-[#0F1825]/50 backdrop-blur-sm border-gray-800 hover:border-[#3B82F6]/50 transition-all p-4">
      <div className="space-y-3">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className={`w-10 h-10 rounded-lg ${severity.color.split(' ')[0]} border flex items-center justify-center flex-shrink-0`}>
              <AlertCircle className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-semibold text-sm truncate">{incident.type || 'Emergency Report'}</h3>
              <p className="text-gray-400 text-xs mt-0.5 font-mono">ID: #{incident.id}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
            <Badge className={`${severity.color} border text-xs font-medium`}>
              <div className={`w-1.5 h-1.5 rounded-full ${severity.dotColor} animate-pulse mr-1.5`}></div>
              {severity.label}
            </Badge>

            {/* Integrated Status Dropdown */}
            <div className="flex items-center gap-1.5 bg-[#0B1220] border border-gray-700 px-2 py-1 rounded-lg">
              <span className="text-[10px] text-gray-400 uppercase font-medium">Status:</span>
              {isUpdating && <RefreshCw className="w-3 h-3 text-blue-400 animate-spin" />}
              <select
                disabled={isUpdating}
                value={(incident.status || 'pending').toLowerCase() === 'responding' ? 'assigned' : (incident.status || 'pending').toLowerCase()}
                onChange={(e) => onStatusChange?.(incident.id, e.target.value)}
                className="bg-transparent text-xs text-white focus:outline-none cursor-pointer disabled:opacity-50"
              >
                <option value="pending" className="bg-[#0B1220]">Pending</option>
                <option value="active" className="bg-[#0B1220]">Active</option>
                <option value="assigned" className="bg-[#0B1220]">Assigned</option>
                <option value="resolved" className="bg-[#0B1220]">Resolved</option>
              </select>
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="space-y-2 text-sm pt-1">
          <div className="flex items-center gap-2 text-gray-300">
            <User className="w-4 h-4 text-gray-500 flex-shrink-0" />
            <span className="text-xs">Reporter:</span>
            <span className="font-medium truncate">{reporterName}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-300">
            <MapPin className="w-4 h-4 text-gray-500 flex-shrink-0" />
            <span className="text-xs">Location:</span>
            <span className="font-medium truncate">{buildingText}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-300">
            <Clock className="w-4 h-4 text-gray-500 flex-shrink-0" />
            <span className="text-xs">Reported:</span>
            <span className="font-medium">{timeReported}</span>
          </div>
        </div>

        {/* Description */}
        {incident.description && (
          <p className="text-sm text-gray-400 bg-[#0B1220]/50 p-2.5 rounded-lg border border-gray-800 line-clamp-2">
            {incident.description}
          </p>
        )}

        {/* Assigned Responder */}
        {incident.assignedResponder && (
          <div className="flex items-center gap-2 p-2.5 bg-[#3B82F6]/10 rounded-lg border border-[#3B82F6]/30">
            <Phone className="w-4 h-4 text-[#3B82F6]" />
            <span className="text-xs text-gray-400">Assigned to:</span>
            <span className="text-sm text-white font-medium">{incident.assignedResponder}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          {((incident.status || '').toLowerCase() === 'pending') && onAssignResponder && (
            <Button
              size="sm"
              onClick={() => onAssignResponder(incident.id)}
              className="flex-1 bg-[#3B82F6] hover:bg-[#3B82F6]/80 text-white text-xs"
            >
              <User className="w-3.5 h-3.5 mr-1.5" />
              Assign Responder
            </Button>
          )}
          {onViewDetails && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onViewDetails(incident.id)}
              className="flex-1 border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800 text-xs"
            >
              View Details
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}