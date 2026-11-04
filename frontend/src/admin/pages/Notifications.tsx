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
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">System Notifications</h1>
        <p className="text-gray-400 text-sm">Real-time emergency alerts and notification records synchronized from Supabase</p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-[#0F1825]/80 backdrop-blur-sm border-gray-800 p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Total Notifications</p>
              <p className="text-3xl font-bold text-white">{safeNotifications.length}</p>
            </div>
            <Bell className="w-8 h-8 text-gray-400" />
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-[#FF3B30]/20 to-[#FF3B30]/5 border-[#FF3B30]/30 p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Critical Alerts</p>
              <p className="text-3xl font-bold text-white">{criticalCount}</p>
            </div>
            <AlertCircle className="w-8 h-8 text-[#FF3B30]" />
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-[#F59E0B]/20 to-[#F59E0B]/5 border-[#F59E0B]/30 p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Minor Alerts</p>
              <p className="text-3xl font-bold text-white">{minorCount}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-[#F59E0B]" />
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-[#22C55E]/20 to-[#22C55E]/5 border-[#22C55E]/30 p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Delivered</p>
              <p className="text-3xl font-bold text-white">{deliveredCount}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-[#22C55E]" />
          </div>
        </Card>
      </div>

      {/* Notifications List */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-white">Recent Notifications</h2>
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
                className="bg-[#0F1825]/80 backdrop-blur-sm border-gray-800 p-4 transition-colors hover:bg-[#0F1825]"
              >
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 ${
                    isCritical
                      ? 'bg-[#FF3B30]/20 border border-[#FF3B30]/30'
                      : isMinor
                        ? 'bg-[#F59E0B]/20 border border-[#F59E0B]/30'
                        : 'bg-[#3B82F6]/20 border border-[#3B82F6]/30'
                  } rounded-lg flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-6 h-6 ${
                      isCritical
                        ? 'text-[#FF3B30]'
                        : isMinor
                          ? 'text-[#F59E0B]'
                          : 'text-[#3B82F6]'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-semibold text-white text-base">
                        {notification.title || notification.type || 'System Alert'}
                      </h3>
                      <span className="text-xs text-gray-500 font-mono">
                        {notificationTime(sentAt)}
                      </span>
                    </div>
                    
                    <p className="mt-1 text-sm text-gray-300 leading-relaxed">
                      {message}
                    </p>

                    {incidentId && (
                      <p className="mt-1 text-xs text-blue-400 font-mono">
                        Related Incident: #{incidentId}
                      </p>
                    )}

                    <div className="mt-3 flex items-center gap-2">
                      <Badge className="bg-gray-800 text-gray-300 border-gray-700 text-xs">
                        Delivery: {status}
                      </Badge>
                      {notification.priority_level && (
                        <Badge className={`text-xs ${isCritical ? 'bg-red-950 text-red-300 border-red-800' : 'bg-amber-950 text-amber-300 border-amber-800'}`}>
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
            <Card className="bg-[#0F1825]/80 backdrop-blur-sm border-gray-800 py-12 text-center text-gray-400">
              <p className="text-sm">No notifications found.</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}