import { Users } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { ResponderCard } from '../components/ResponderCard';
import { DataNotice } from '../DataNotice';
import { useAdminData } from '../useAdminData';

export function Responders() {
  const { responders, loading, error } = useAdminData();
  const availableCount = responders.filter(r => r.status === 'available').length;
  const assignedCount = responders.filter(r => r.status === 'assigned' || r.status === 'responding').length;
  const offlineCount = responders.filter(r => r.status === 'offline').length;

  return (
    <div className="space-y-6">
      <DataNotice loading={loading} error={error} />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Medical Responders</h1>
          <p className="text-gray-400 text-sm">Manage emergency response team and availability</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-[#0F1825]/80 backdrop-blur-sm border-gray-800 p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Total Team</p>
              <p className="text-3xl font-bold text-white">{responders.length}</p>
            </div>
            <Users className="w-8 h-8 text-gray-400" />
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-[#22C55E]/20 to-[#22C55E]/5 border-[#22C55E]/30 p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Available</p>
              <p className="text-3xl font-bold text-white">{availableCount}</p>
            </div>
            <Users className="w-8 h-8 text-[#22C55E]" />
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-[#FACC15]/20 to-[#FACC15]/5 border-[#FACC15]/30 p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">On Duty</p>
              <p className="text-3xl font-bold text-white">{assignedCount}</p>
            </div>
            <Users className="w-8 h-8 text-[#FACC15]" />
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-gray-500/20 to-gray-500/5 border-gray-500/30 p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Offline</p>
              <p className="text-3xl font-bold text-white">{offlineCount}</p>
            </div>
            <Users className="w-8 h-8 text-gray-500" />
          </div>
        </Card>
      </div>

      {/* Responders by Status */}
      <div className="space-y-6">
        {/* Available Responders */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <Badge className="bg-[#22C55E]/20 text-[#22C55E] border-[#22C55E]/50">
              <div className="w-2 h-2 bg-[#22C55E] rounded-full animate-pulse mr-2"></div>
              Available
            </Badge>
            <span className="text-sm text-gray-400">{availableCount} responders ready</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {responders
              .filter(r => r.status === 'available')
              .map((responder) => (
                <ResponderCard
                  key={responder.id}
                  responder={responder}
                />
              ))}
          </div>
        </div>

        {/* On Duty Responders */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <Badge className="bg-[#FACC15]/20 text-[#FACC15] border-[#FACC15]/50">
              <div className="w-2 h-2 bg-[#FACC15] rounded-full animate-pulse mr-2"></div>
              On Duty
            </Badge>
            <span className="text-sm text-gray-400">{assignedCount} responders active</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {responders
              .filter(r => r.status === 'assigned' || r.status === 'responding')
              .map((responder) => (
                <ResponderCard
                  key={responder.id}
                  responder={responder}
                />
              ))}
          </div>
        </div>

        {/* Offline Responders */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/50">
              <div className="w-2 h-2 bg-gray-500 rounded-full mr-2"></div>
              Offline
            </Badge>
            <span className="text-sm text-gray-400">{offlineCount} responders offline</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {responders
              .filter(r => r.status === 'offline')
              .map((responder) => (
                <ResponderCard
                  key={responder.id}
                  responder={responder}
                />
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
