import React from 'react';
import { AlertTriangle, ExternalLink, X } from 'lucide-react';
import { EarthquakeClassification, EarthquakeEvent } from '../lib/api';

interface Props {
  earthquakes: EarthquakeEvent[];
  onDismiss: () => void;
}

function formatClassificationLabel(classification?: EarthquakeClassification): string {
  switch (classification) {
    case 'earthquake_alert':
      return 'Earthquake Alert';
    case 'advisory':
      return 'Advisory';
    default:
      return 'Monitoring';
  }
}

export default function EarthquakeAlertBanner({ earthquakes, onDismiss }: Props) {
  const highlightedQuakes = earthquakes.filter(
    (eq) => eq.classification === 'earthquake_alert' || eq.classification === 'advisory'
  );

  if (highlightedQuakes.length === 0) return null;

  const latest =
    highlightedQuakes.find((eq) => eq.classification === 'earthquake_alert') ??
    highlightedQuakes[0];

  const isAlert = latest.classification === 'earthquake_alert';
  const reportUrl = latest.url || latest.detail_url;

  return (
    <div
      className={`${
        isAlert
          ? 'bg-rose-50 border-l-4 border-rose-600'
          : 'bg-amber-50 border-l-4 border-amber-500'
      } p-4 rounded-xl shadow-sm mb-4 flex items-start justify-between gap-3`}
    >
      <div className="flex items-start space-x-3">
        <div
          className={`p-2 ${
            isAlert ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
          } rounded-lg shrink-0 mt-0.5`}
        >
          <AlertTriangle className="w-5 h-5 animate-pulse" />
        </div>
        <div>
          <span
            className={`inline-block text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full mb-1 ${
              isAlert ? 'bg-rose-200/80 text-rose-900' : 'bg-amber-200/80 text-amber-900'
            }`}
          >
            {formatClassificationLabel(latest.classification)}
          </span>
          <h4
            className={`text-xs font-extrabold uppercase tracking-wider ${
              isAlert ? 'text-rose-900' : 'text-amber-900'
            }`}
          >
            {latest.magnitude !== null ? `Mag ${latest.magnitude.toFixed(1)} — ` : ''}
            {latest.place}
          </h4>
          <p
            className={`text-xs mt-1 ${
              isAlert ? 'text-rose-800' : 'text-amber-800'
            }`}
          >
            {latest.distance_from_cdo_km !== null
              ? `${latest.distance_from_cdo_km} km from USTP CDO`
              : 'PHIVOLCS Bulletin'}
            {latest.depth_km !== null ? ` • Depth: ${latest.depth_km} km` : ''}
            {latest.reported_intensity ? ` • Intensity ${latest.reported_intensity}` : ''}
          </p>
          {reportUrl && (
            <a
              href={reportUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-bold text-indigo-700 hover:underline mt-2"
            >
              <span>View PHIVOLCS Report</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={onDismiss}
        className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
        aria-label="Dismiss earthquake banner"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}