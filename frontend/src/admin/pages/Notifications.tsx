import { useState, useMemo } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Bell,
  CheckCircle,
  Radio,
  Trash2,
  CheckCheck,
  UserCheck,
  MapPin,
} from 'lucide-react';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { DataNotice } from '../DataNotice';
import { useAdminData } from '../useAdminData';

function notificationTime(value?: string): string {
  if (!value) return 'Time unavailable';
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) return 'Time unavailable';
  return timestamp.toLocaleString();
}

function isEarthquakeNotification(notification: any): boolean {
  if (!notification || typeof notification !== 'object') return false;
  const typeVal = String(notification.type || '').trim().toLowerCase();
  const classVal = String(notification.classification || '').trim().toLowerCase();
  return (
    typeVal === 'earthquake_alert' ||
    classVal === 'earthquake_alert' ||
    Boolean(notification.earthquake_event_id)
  );
}

function formatMagnitude(mag: any): string | null {
  if (mag === null || mag === undefined || mag === '') return null;
  const num = typeof mag === 'number' ? mag : Number(mag);
  if (!Number.isFinite(num)) return null;
  return `M ${num.toFixed(1)}`;
}

function formatAffectedArea(notification: any): string | null {
  const parts: string[] = [];
  if (notification?.distance_from_cdo_km !== null && notification?.distance_from_cdo_km !== undefined && notification?.distance_from_cdo_km !== '') {
    const dist = typeof notification.distance_from_cdo_km === 'number'
      ? notification.distance_from_cdo_km
      : Number(notification.distance_from_cdo_km);
    if (Number.isFinite(dist)) {
      parts.push(`${dist.toFixed(1)} km from USTP CDO`);
    }
  }
  if (notification?.reported_intensity) {
    parts.push(`Intensity ${String(notification.reported_intensity)}`);
  }
  if (parts.length === 0 && (notification?.type === 'earthquake_alert' || notification?.classification === 'earthquake_alert')) {
    parts.push('Regional Seismic Zone (USTP CDO)');
  }
  return parts.length > 0 ? parts.join(' • ') : null;
}

export function Notifications() {
  const { notifications, loading, error, deleteNotification, clearAllNotifications } = useAdminData() as any;

  // Local state to manage optimistically deleted notification IDs
  const [deletedIds, setDeletedIds] = useState<(string | number)[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Display all notifications from Supabase except locally deleted ones
  const safeNotifications = useMemo(() => {
    const rawList = notifications || [];

    return rawList.filter((notification: any) => {
      const id = notification.notification_id || notification.id;
      if (deletedIds.includes(id)) return false;
      return true;
    });
  }, [notifications, deletedIds]);

  // Handle single notification permanent deletion with rollback on failure
  const handleDelete = async (id: string | number) => {
    setActionError(null);
    // Optimistic UI update
    setDeletedIds(prev => [...prev, id]);

    const success = await deleteNotification(id);
    if (!success) {
      // Rollback optimistic hide if Supabase rejected it (e.g. RLS policy violation)
      setDeletedIds(prev => prev.filter(item => item !== id));
      setActionError('Failed to delete notification. Check Supabase RLS delete permissions.');
    }
  };

  // Handle clear all notifications permanently with rollback on failure
  const handleClearAll = async () => {
    setActionError(null);
    const allIds = (safeNotifications || []).map((n: any) => n.notification_id || n.id);
    setDeletedIds(prev => [...prev, ...allIds]);
    setIsDeleting(true);

    const success = await clearAllNotifications();
    if (!success) {
      // Rollback all
      setDeletedIds(prev => prev.filter(id => !allIds.includes(id)));
      setActionError('Failed to clear notifications. Check Supabase RLS delete permissions.');
    }
    setIsDeleting(false);
  };

  const criticalCount = safeNotifications.filter((notification: any) => {
    const priority = (notification.severity || notification.priority || notification.priority_level || '').toLowerCase();
    const typeStr = (notification.type || notification.classification || notification.title || '').toLowerCase();
    return (
      priority === 'urgent' ||
      priority === 'critical' ||
      typeStr.includes('urgent') ||
      typeStr.includes('critical') ||
      typeStr.includes('earthquake_alert')
    );
  }).length;

  const minorCount = safeNotifications.filter((notification: any) => {
    const priority = (notification.severity || notification.priority || notification.priority_level || '').toLowerCase();
    const typeStr = (notification.type || notification.title || '').toLowerCase();
    return priority === 'minor' || typeStr.includes('minor') || typeStr.includes('warning') || typeStr.includes('registration');
  }).length;

  const deliveredCount = safeNotifications.filter((notification: any) => {
    const status = (notification.status || notification.delivery_status || 'sent').toLowerCase();
    return status === 'sent' || status === 'delivered' || status === 'active' || status === 'pending';
  }).length;

  return (
    <div className="space-y-6">
      <DataNotice loading={loading} error={error || actionError} />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white/40 backdrop-blur-sm p-5 rounded-2xl border border-sky-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 mb-1">System Notifications</h1>
          <p className="text-slate-700 text-sm font-semibold">Real-time emergency alerts and notification records synchronized from Supabase</p>
        </div>
        {safeNotifications.length > 0 && (
          <Button
            onClick={() => void handleClearAll()}
            disabled={isDeleting}
            variant="outline"
            className="bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-sm text-xs font-bold flex items-center gap-2 rounded-xl transition-all cursor-pointer"
          >
            <Trash2 className="w-4 h-4 text-slate-500" />
            {isDeleting ? 'Clearing...' : 'Clear All Notifications'}
          </Button>
        )}
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white border-sky-100/60 shadow-md p-5 rounded-2xl">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Total Notifications</p>
              <p className="text-3xl font-extrabold text-slate-900">{safeNotifications.length}</p>
            </div>
            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
              <Bell className="w-6 h-6 text-slate-600" />
            </div>
          </div>
        </Card>

        <Card className="bg-white border-red-200 shadow-md p-5 rounded-2xl">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-red-700 text-xs font-semibold uppercase tracking-wider mb-1">Critical Alerts</p>
              <p className="text-3xl font-extrabold text-slate-900">{criticalCount}</p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </Card>

        <Card className="bg-white border-sky-200 shadow-md p-5 rounded-2xl">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sky-800 text-xs font-semibold uppercase tracking-wider mb-1">Minor Alerts</p>
              <p className="text-3xl font-extrabold text-slate-900">{minorCount}</p>
            </div>
            <div className="w-12 h-12 bg-sky-100 rounded-xl flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-sky-700" />
            </div>
          </div>
        </Card>

        <Card className="bg-white border-emerald-200 shadow-md p-5 rounded-2xl">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-emerald-700 text-xs font-semibold uppercase tracking-wider mb-1">Delivered</p>
              <p className="text-3xl font-extrabold text-slate-900">{deliveredCount}</p>
            </div>
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Notifications List */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-900">Recent Notifications</h2>
        <div className="space-y-3">
          {safeNotifications.map((notification: any) => {
            const id = notification.notification_id || notification.id || Math.random();
            const isEarthquake = isEarthquakeNotification(notification);
            const message =
              notification.message ||
              notification.content ||
              (notification.incident_id ? `Incident #${notification.incident_id}` : 'System alert broadcast');
            const sentAt = notification.sent_at || notification.sentAt || notification.created_at;
            const status = notification.status || notification.delivery_status || 'Sent';
            const incidentId = notification.incident_id || notification.incidentId;
            const isReg = String(notification.type || '').toLowerCase().includes('registration');

            const severityLabel = String(
              notification.severity ||
                notification.priority ||
                notification.priority_level ||
                (isEarthquake ? 'critical' : 'normal')
            ).trim();

            const magnitudeLabel = isEarthquake ? formatMagnitude(notification.magnitude) : null;
            const locationLabel = isEarthquake
              ? String(notification.place || notification.location || 'Unknown Epicenter').trim()
              : null;
            const affectedAreaLabel = isEarthquake ? formatAffectedArea(notification) : null;

            const Icon = isEarthquake
              ? Activity
              : isReg
                ? UserCheck
                : (notification.isCritical || severityLabel.toLowerCase() === 'critical'
                  ? AlertCircle
                  : Radio);

            return (
              <Card
                key={id}
                className={`bg-white shadow-md p-4 transition-all hover:shadow-lg rounded-2xl relative group ${
                  isEarthquake ? 'border-2 border-rose-200' : 'border-sky-100/60'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`w-12 h-12 ${
                      isEarthquake
                        ? 'bg-rose-100 border border-rose-200'
                        : isReg
                          ? 'bg-purple-100 border border-purple-200'
                          : notification.isCritical || severityLabel.toLowerCase() === 'critical'
                            ? 'bg-red-100 border border-red-200'
                            : 'bg-blue-100 border border-blue-200'
                    } rounded-xl flex items-center justify-center flex-shrink-0`}
                  >
                    <Icon
                      className={`w-6 h-6 ${
                        isEarthquake
                          ? 'text-rose-600'
                          : isReg
                            ? 'text-purple-600'
                            : notification.isCritical || severityLabel.toLowerCase() === 'critical'
                              ? 'text-red-600'
                              : 'text-blue-600'
                      }`}
                    />
                  </div>

                  <div className="flex-1 min-w-0 pr-8">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-slate-900 text-base">
                          {notification.title ||
                            (isEarthquake
                              ? `Earthquake Alert${magnitudeLabel ? `: ${magnitudeLabel}` : ''}`
                              : notification.notification_type || notification.type || 'System Alert')}
                        </h3>
                        {isEarthquake && (
                          <Badge className="bg-rose-600 text-white border-rose-700 text-[10px] font-extrabold uppercase tracking-wider">
                            Earthquake Alert
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-slate-500 font-mono font-medium shrink-0">
                        {notificationTime(sentAt)}
                      </span>
                    </div>

                    <p className="mt-1 text-sm text-slate-700 font-medium leading-relaxed">
                      {message}
                    </p>

                    {isEarthquake && (
                      <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-3 gap-2 bg-rose-50/70 border border-rose-100 rounded-xl p-3 text-xs">
                        <div>
                          <span className="text-slate-500 font-semibold block text-[10px] uppercase">Severity</span>
                          <span className="font-extrabold text-rose-700 uppercase">{severityLabel}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 font-semibold block text-[10px] uppercase">Magnitude</span>
                          <span className="font-extrabold text-slate-900">{magnitudeLabel || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 font-semibold block text-[10px] uppercase">Location & Affected Area</span>
                          <span className="font-bold text-slate-800 inline-flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                            <span>
                              {locationLabel}
                              {affectedAreaLabel ? ` (${affectedAreaLabel})` : ''}
                            </span>
                          </span>
                        </div>
                      </div>
                    )}

                    {incidentId && incidentId !== 'null' && incidentId !== '—' && (
                      <p className="mt-1.5 text-xs text-blue-600 font-mono font-bold">
                        Related Incident: #{incidentId}
                      </p>
                    )}

                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      <Badge
                        className={`text-xs font-bold capitalize ${
                          severityLabel.toLowerCase() === 'critical' || severityLabel.toLowerCase() === 'urgent'
                            ? 'bg-rose-100 text-rose-700 border-rose-200'
                            : 'bg-amber-100 text-amber-700 border-amber-200'
                        }`}
                      >
                        Severity: {severityLabel}
                      </Badge>
                      <Badge className="bg-slate-100 text-slate-700 border-slate-200 text-xs font-semibold capitalize">
                        Delivery: {status}
                      </Badge>
                      <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-xs font-bold capitalize">
                        Type: {notification.type || 'System'}
                      </Badge>
                    </div>
                  </div>

                  {/* Delete Single Notification Button */}
                  <button
                    onClick={() => void handleDelete(id)}
                    className="absolute top-4 right-4 p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                    title="Delete Notification"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </Card>
            );
          })}
          {!loading && !error && safeNotifications.length === 0 && (
            <Card className="bg-white border-sky-100/60 shadow-md py-12 text-center text-slate-500 rounded-2xl space-y-2">
              <CheckCheck className="w-12 h-12 mx-auto text-emerald-500 stroke-1" />
              <p className="text-base font-bold text-slate-900">All caught up!</p>
              <p className="text-xs text-slate-500 font-medium">No active or unresolved notifications found.</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}