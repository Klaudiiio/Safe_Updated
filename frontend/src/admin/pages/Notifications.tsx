import { AlertCircle, AlertTriangle, Bell, CheckCircle, Clock, Radio } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { DataNotice } from '../DataNotice';
import { useAdminData } from '../useAdminData';

function notificationTime(value?: string): string {
  if (!value) return 'Time unavailable';
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) return 'Time unavailable';
  return timestamp.toLocaleString();
}

export function Notifications() {
  const { notifications, loading, error } = useAdminData();

  const safeNotifications = notifications || [];

  const criticalCount = safeNotifications.filter((notification: any) => {
    const priority = (notification.priority || notification.priority_level || '').toLowerCase();
    const typeStr = (notification.type || notification.title || '').toLowerCase();
    return priority === 'urgent' || priority === 'critical' || typeStr.includes('urgent') || typeStr.includes('critical');
  }).length;

  const minorCount = safeNotifications.filter((notification: any) => {
    const priority = (notification.priority || notification.priority_level || '').toLowerCase();
    const typeStr = (notification.type || notification.title || '').toLowerCase();
    return priority === 'minor' || typeStr.includes('minor') || typeStr.includes('warning');
  }).length;

  const deliveredCount = safeNotifications.filter((notification: any) => {
    const status = (notification.status || notification.delivery_status || 'sent').toLowerCase();
    return status === 'sent' || status === 'delivered' || status === 'active';
  }).length;

  return (
    <div className="space-y-6">
      <DataNotice loading={loading} error={error} />
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white/40 backdrop-blur-sm p-5 rounded-2xl border border-amber-200/50 shadow-sm">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 mb-1">System Notifications</h1>
          <p className="text-slate-700 text-sm font-semibold">Real-time emergency alerts and notification records synchronized from Supabase</p>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white border-amber-200/60 shadow-md p-5 rounded-2xl">
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

        <Card className="bg-white border-amber-300 shadow-md p-5 rounded-2xl">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-amber-800 text-xs font-semibold uppercase tracking-wider mb-1">Minor Alerts</p>
              <p className="text-3xl font-extrabold text-slate-900">{minorCount}</p>
            </div>
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-amber-700" />
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
            const message = notification.message || notification.content || (notification.incident_id ? `Incident #${notification.incident_id}` : 'System alert broadcast');
            const sentAt = notification.sent_at || notification.sentAt || notification.created_at;
            const status = notification.status || notification.delivery_status || 'Sent';
            const incidentId = notification.incident_id || notification.incidentId;

            const priority = (notification.priority || notification.priority_level || '').toLowerCase();
            const typeStr = (notification.type || notification.title || '').toLowerCase();

            const isCritical = priority === 'urgent' || priority === 'critical' || typeStr.includes('urgent') || typeStr.includes('critical');
            const isMinor = priority === 'minor' || typeStr.includes('minor') || typeStr.includes('warning');

            const Icon = isCritical
              ? AlertCircle
              : isMinor
                ? AlertTriangle
                : typeStr.includes('success') || typeStr.includes('resolved')
                  ? CheckCircle
                  : typeStr.includes('clock')
                    ? Clock
                    : Radio;

            return (
              <Card
                key={id}
                className="bg-white border-amber-200/60 shadow-md p-4 transition-all hover:shadow-lg rounded-2xl"
              >
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 ${
                    isCritical
                      ? 'bg-red-100 border border-red-200'
                      : isMinor
                        ? 'bg-amber-100 border border-amber-200'
                        : 'bg-blue-100 border border-blue-200'
                  } rounded-xl flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-6 h-6 ${
                      isCritical
                        ? 'text-red-600'
                        : isMinor
                          ? 'text-amber-700'
                          : 'text-blue-600'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-bold text-slate-900 text-base">
                        {notification.title || notification.type || 'System Alert'}
                      </h3>
                      <span className="text-xs text-slate-500 font-mono font-medium">
                        {notificationTime(sentAt)}
                      </span>
                    </div>
                   
                    <p className="mt-1 text-sm text-slate-700 font-medium leading-relaxed">
                      {message}
                    </p>

                    {incidentId && (
                      <p className="mt-1 text-xs text-blue-600 font-mono font-bold">
                        Related Incident: #{incidentId}
                      </p>
                    )}

                    <div className="mt-3 flex items-center gap-2">
                      <Badge className="bg-slate-100 text-slate-700 border-slate-200 text-xs font-semibold">
                        Delivery: {status}
                      </Badge>
                      {notification.priority_level && (
                        <Badge className={`text-xs font-bold ${isCritical ? 'bg-red-100 text-red-700 border-red-200' : 'bg-amber-100 text-amber-800 border-amber-200'}`}>
                          Priority: {notification.priority_level}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
          {!loading && !error && safeNotifications.length === 0 && (
            <Card className="bg-white border-amber-200/60 shadow-md py-12 text-center text-slate-500 rounded-2xl">
              <p className="text-sm font-bold text-slate-900">No notifications found.</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}