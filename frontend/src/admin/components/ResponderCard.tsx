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
    ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
    : isOffline
    ? 'bg-slate-100 text-slate-600 border-slate-200'
    : 'bg-amber-100 text-amber-800 border-amber-200';

  return (
    <Card className="bg-white border-amber-200/60 shadow-sm p-5 space-y-4 hover:shadow-md transition-all rounded-2xl">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center flex-shrink-0 text-emerald-600">
            <User className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-slate-900 font-bold text-sm truncate">{responder.name || 'Unnamed Staff'}</h3>
            <p className="text-xs text-emerald-600 font-mono mt-0.5 truncate">{responder.department || 'Clinic Staff'}</p>
          </div>
        </div>
        <Badge className={`${badgeColor} text-[10px] font-bold uppercase flex-shrink-0`}>
          {statusStr}
        </Badge>
      </div>

      <div className="space-y-2 text-xs text-slate-600 pt-3 border-t border-slate-100">
        <div className="flex items-center gap-2">
          <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <span className="truncate">{responder.contact_number || responder.phone || 'No contact provided'}</span>
        </div>
        <div className="flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <span className="text-slate-500">Role: <strong className="text-slate-900 font-bold">{responder.user_type || 'Responder'}</strong></span>
        </div>
      </div>
    </Card>
  );
}