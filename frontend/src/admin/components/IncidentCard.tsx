import { AlertCircle, MapPin, Clock, User, Phone } from 'lucide-react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import type { Incident } from '../data/mockData';

interface IncidentCardProps {
  incident: Incident;
  onAssignResponder?: (incidentId: string) => void;
  onViewDetails?: (incidentId: string) => void;
}

const severityConfig = {
  critical: {
    color: 'bg-[#FF3B30]/20 text-[#FF3B30] border-[#FF3B30]/50',
    dotColor: 'bg-[#FF3B30]',
    label: 'Critical'
  },
  high: {
    color: 'bg-orange-500/20 text-orange-500 border-orange-500/50',
    dotColor: 'bg-orange-500',
    label: 'High'
  },
  medium: {
    color: 'bg-[#FACC15]/20 text-[#FACC15] border-[#FACC15]/50',
    dotColor: 'bg-[#FACC15]',
    label: 'Medium'
  },
  low: {
    color: 'bg-[#22C55E]/20 text-[#22C55E] border-[#22C55E]/50',
    dotColor: 'bg-[#22C55E]',
    label: 'Low'
  }
};

const statusConfig = {
  pending: { color: 'bg-gray-500/20 text-gray-400 border-gray-500/50', label: 'Pending' },
  assigned: { color: 'bg-[#3B82F6]/20 text-[#3B82F6] border-[#3B82F6]/50', label: 'Assigned' },
  responding: { color: 'bg-[#FACC15]/20 text-[#FACC15] border-[#FACC15]/50', label: 'Responding' },
  resolved: { color: 'bg-[#22C55E]/20 text-[#22C55E] border-[#22C55E]/50', label: 'Resolved' }
};

export function IncidentCard({ incident, onAssignResponder, onViewDetails }: IncidentCardProps) {
  const severity = severityConfig[incident.severity];
  const status = statusConfig[incident.status];

  return (
    <Card className="bg-[#0F1825]/50 backdrop-blur-sm border-gray-800 hover:border-[#3B82F6]/50 transition-all p-4">
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1">
            <div className={`w-10 h-10 rounded-lg ${severity.color.split(' ')[0]} border ${severity.color.split('border-')[1]} flex items-center justify-center`}>
              <AlertCircle className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-semibold text-sm truncate">{incident.type}</h3>
              <p className="text-gray-400 text-xs mt-0.5">ID: {incident.id}</p>
            </div>
          </div>
          <div className="flex flex-col gap-1.5 items-end">
            <Badge className={`${severity.color} border text-xs font-medium`}>
              <div className={`w-1.5 h-1.5 rounded-full ${severity.dotColor} animate-pulse mr-1.5`}></div>
              {severity.label}
            </Badge>
            <Badge className={`${status.color} border text-xs font-medium`}>
              {status.label}
            </Badge>
          </div>
        </div>

        {/* Details */}
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-gray-300">
            <User className="w-4 h-4 text-gray-500" />
            <span className="text-xs">Reporter:</span>
            <span className="font-medium">{incident.reporterName}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-300">
            <MapPin className="w-4 h-4 text-gray-500" />
            <span className="text-xs">Location:</span>
            <span className="font-medium">{incident.building} - {incident.location}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-300">
            <Clock className="w-4 h-4 text-gray-500" />
            <span className="text-xs">Reported:</span>
            <span className="font-medium">{incident.timeReported}</span>
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-gray-400 bg-[#0B1220]/50 p-2.5 rounded-lg border border-gray-800">
          {incident.description}
        </p>

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
          {incident.status === 'pending' && onAssignResponder && (
            <Button
              size="sm"
              onClick={() => onAssignResponder(incident.id)}
              className="flex-1 bg-[#3B82F6] hover:bg-[#3B82F6]/80 text-white"
            >
              <User className="w-4 h-4 mr-1.5" />
              Assign Responder
            </Button>
          )}
          {onViewDetails && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onViewDetails(incident.id)}
              className="flex-1 border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800"
            >
              View Details
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
