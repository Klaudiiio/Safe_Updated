import { User, Phone, MessageSquare, MapPin } from 'lucide-react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Avatar, AvatarFallback } from './ui/avatar';
import type { Responder } from '../data/mockData';

interface ResponderCardProps {
  responder: Responder;
  onContact?: (responderId: string) => void;
  onViewLocation?: (responderId: string) => void;
}

const statusConfig = {
  available: {
    color: 'bg-[#22C55E]/20 text-[#22C55E] border-[#22C55E]/50',
    dotColor: 'bg-[#22C55E]',
    label: 'Available'
  },
  assigned: {
    color: 'bg-[#3B82F6]/20 text-[#3B82F6] border-[#3B82F6]/50',
    dotColor: 'bg-[#3B82F6]',
    label: 'Assigned'
  },
  responding: {
    color: 'bg-[#FACC15]/20 text-[#FACC15] border-[#FACC15]/50',
    dotColor: 'bg-[#FACC15]',
    label: 'Responding'
  },
  offline: {
    color: 'bg-gray-500/20 text-gray-400 border-gray-500/50',
    dotColor: 'bg-gray-500',
    label: 'Offline'
  }
};

export function ResponderCard({ responder, onContact, onViewLocation }: ResponderCardProps) {
  const status = statusConfig[responder.status];
  const initials = responder.name.split(' ').map(n => n[0]).join('').toUpperCase();

  return (
    <Card className="bg-[#0F1825]/50 backdrop-blur-sm border-gray-800 hover:border-[#3B82F6]/50 transition-all p-4">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <Avatar className="w-12 h-12 border-2 border-gray-700">
            <AvatarFallback className="bg-gradient-to-br from-[#3B82F6] to-[#FF3B30] text-white font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-semibold text-sm truncate">{responder.name}</h3>
            <p className="text-gray-400 text-xs mt-0.5">{responder.role}</p>
            <Badge className={`${status.color} border text-xs font-medium mt-2`}>
              <div className={`w-1.5 h-1.5 rounded-full ${status.dotColor} ${responder.status !== 'offline' ? 'animate-pulse' : ''} mr-1.5`}></div>
              {status.label}
            </Badge>
          </div>
        </div>

        {/* Assignment Info */}
        {responder.assignedIncident && (
          <div className="space-y-2">
            <div className="p-2.5 bg-[#3B82F6]/10 rounded-lg border border-[#3B82F6]/30">
              <div className="flex items-center gap-2 mb-1">
                <User className="w-3.5 h-3.5 text-[#3B82F6]" />
                <span className="text-xs text-gray-400">Assigned Incident:</span>
              </div>
              <p className="text-sm text-white font-medium">{responder.assignedIncident}</p>
            </div>
            {responder.eta && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">Estimated Time:</span>
                <span className="text-[#FACC15] font-semibold">{responder.eta}</span>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        {(onContact || onViewLocation) && (
          <div className="flex gap-2">
            {onContact && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onContact(responder.id)}
                  disabled={responder.status === 'offline'}
                  className="flex-1 border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800 disabled:opacity-50"
                >
                  <Phone className="w-3.5 h-3.5 mr-1.5" />
                  Call
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onContact(responder.id)}
                  disabled={responder.status === 'offline'}
                  className="flex-1 border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800 disabled:opacity-50"
                >
                  <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
                  Message
                </Button>
              </>
            )}
            {onViewLocation && responder.status !== 'offline' && responder.status !== 'available' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onViewLocation?.(responder.id)}
              className="border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800"
            >
              <MapPin className="w-3.5 h-3.5" />
            </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
