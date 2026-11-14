import React from 'react';
import { AlertTriangle, ExternalLink, X } from 'lucide-react';
import { EarthquakeEvent } from '../lib/api';

interface Props {
  earthquakes: EarthquakeEvent[];
  onDismiss: () => void;
}

export default function EarthquakeAlertBanner({ earthquakes, onDismiss }: Props) {
  // Filter for alert-worthy events (e.g., Magnitude >= 4.0 or within 300 km)
  const significantQuakes = earthquakes.filter(
    (eq) => eq.magnitude >= 4.0 || eq.distance_from_cdo_km <= 300
  );

  if (significantQuakes.length === 0) return null;

  // Take the most recent alert-worthy quake
  const latest = significantQuakes[0];

  return (
    <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-xl shadow-sm mb-4 flex items-start justify-between gap-3">
      <div className="flex items-start space-x-3">
        <div className="p-2 bg-amber-100 text-amber-700 rounded-lg shrink-0 mt-0.5">
          <AlertTriangle className="w-5 h-5 animate-pulse" />
        </div>
        <div>
          <h4 className="text-xs font-extrabold text-amber-900 uppercase tracking-wider">
            Seismic Activity Alert (Magnitude {latest.magnitude.toFixed(1)})
          </h4>
          <p className="text-xs text-amber-800 mt-0.5 font-medium">
            {latest.place} — <strong>{latest.distance_from_cdo_km} km</strong> from CDO (Depth: {latest.depth_km} km)
          </p>
          <a
            href={latest.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-bold text-amber-900 hover:text-amber-950 underline inline-flex items-center space-x-1 mt-1"
          >
            <span>View USGS / PHIVOLCS Report</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
      <button
        onClick={onDismiss}
        className="text-amber-500 hover:text-amber-700 p-1 rounded-lg transition"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}