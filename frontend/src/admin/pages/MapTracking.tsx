import { AlertCircle, MapPin, Navigation } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { DataNotice } from '../DataNotice';
import { useAdminData } from '../useAdminData';

export function MapTracking() {
  const { incidents, responders, loading, error } = useAdminData();
  const activeIncidents = incidents.filter((incident) => incident.status !== 'resolved');
  const activeResponders = responders.filter(
    (responder) => responder.status === 'assigned' || responder.status === 'responding',
  );

  return (
    <div className="space-y-6">
      <DataNotice loading={loading} error={error} />
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Incident Locations</h1>
        <p className="text-gray-400 text-sm">
          Supabase coordinates are shown when available. A geospatial map is not configured.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-[#0F1825]/80 backdrop-blur-sm border-gray-800 p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="w-5 h-5 text-[#FF3B30]" />
            <h2 className="text-sm font-semibold text-white">Active Incidents</h2>
            <Badge className="ml-auto bg-[#FF3B30]/20 text-[#FF3B30] border-[#FF3B30]/50">
              {activeIncidents.length}
            </Badge>
          </div>
          <div className="space-y-3">
            {activeIncidents.map((incident) => {
              const hasCoordinates = incident.gpsCoords.lat !== 0 || incident.gpsCoords.lng !== 0;
              return (
                <div key={incident.id} className="p-3 bg-[#0B1220]/50 rounded-lg border border-gray-800">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-sm font-medium text-white">{incident.type}</span>
                    <Badge className="bg-[#FACC15]/20 text-[#FACC15] border-[#FACC15]/50">
                      {incident.status}
                    </Badge>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
                    <MapPin className="w-3 h-3" />
                    <span>{incident.building}{incident.location !== '—' ? `, ${incident.location}` : ''}</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {hasCoordinates
                      ? `${incident.gpsCoords.lat}, ${incident.gpsCoords.lng}`
                      : 'Coordinates unavailable'}
                  </p>
                </div>
              );
            })}
            {!loading && !error && activeIncidents.length === 0 && (
              <p className="py-6 text-center text-sm text-gray-400">No active incidents.</p>
            )}
          </div>
        </Card>

        <Card className="bg-[#0F1825]/80 backdrop-blur-sm border-gray-800 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Navigation className="w-5 h-5 text-[#22C55E]" />
            <h2 className="text-sm font-semibold text-white">Responding Team</h2>
            <Badge className="ml-auto bg-[#22C55E]/20 text-[#22C55E] border-[#22C55E]/50">
              {activeResponders.length}
            </Badge>
          </div>
          <div className="space-y-3">
            {activeResponders.map((responder) => (
              <div key={responder.id} className="p-3 bg-[#0B1220]/50 rounded-lg border border-gray-800">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-sm font-medium text-white">{responder.name}</span>
                  <Badge className="bg-[#22C55E]/20 text-[#22C55E] border-[#22C55E]/50">
                    {responder.status}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-gray-400">{responder.assignedIncident ?? responder.role}</p>
              </div>
            ))}
            {!loading && !error && activeResponders.length === 0 && (
              <p className="py-6 text-center text-sm text-gray-400">No responders are currently assigned.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
