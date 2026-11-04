import { Phone, Shield, User } from 'lucide-react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';

interface ResponderCardProps {
  responder: any;
}

export function ResponderCard({ responder }: ResponderCardProps) {
  const statusStr = (responder.status || responder.availability_status || 'available').toLowerCase();
  const isAvailable = statusStr === 'available';
  const isOffline = statusStr === 'offline';

  const badgeColor = isAvailable
    ? 'bg-green-500/20 text-green-400 border-green-500/30'
    : isOffline
    ? 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';

  return (
    <Card className="bg-[#0F1825]/80 backdrop-blur-sm border-gray-800 p-5 space-y-4 hover:border-gray-700 transition-all">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center flex-shrink-0 text-blue-400">
            <User className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-white font-semibold text-sm truncate">{responder.name || 'Unnamed Staff'}</h3>
            <p className="text-xs text-blue-400 font-mono mt-0.5 truncate">{responder.department || 'Clinic Staff'}</p>
          </div>
        </div>
        <Badge className={`${badgeColor} text-[10px] font-medium uppercase flex-shrink-0`}>
          {statusStr}
        </Badge>
      </div>

      <div className="space-y-2 text-xs text-gray-300 pt-2 border-t border-gray-800/80">
        <div className="flex items-center gap-2">
          <Phone className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
          <span className="truncate">{responder.contact_number || responder.phone || 'No contact provided'}</span>
        </div>
        <div className="flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
          <span className="capitalize text-gray-400">Role: <strong className="text-white">{responder.user_type || 'Responder'}</strong></span>
        </div>
      </div>
    </Card>
  );
}