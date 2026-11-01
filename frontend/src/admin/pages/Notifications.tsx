import { AlertCircle, Bell, CheckCircle, Clock, Radio } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { DataNotice } from '../DataNotice';
import { useAdminData } from '../useAdminData';

function notificationTime(value: string): string {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) return 'Time unavailable';
  return timestamp.toLocaleString();
}

export function Notifications() {
  const { notifications, loading, error } = useAdminData();
  const criticalCount = notifications.filter((notification) => (
    notification.type.toLowerCase().includes('critical')
      || notification.type.toLowerCase().includes('urgent')
  )).length;
  const deliveredCount = notifications.filter((notification) => (
    notification.status.toLowerCase() === 'sent'
      || notification.status.toLowerCase() === 'delivered'
  )).length;

  return (
    <div className="space-y-6">
      <DataNotice loading={loading} error={error} />
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">System Notifications</h1>
        <p className="text-gray-400 text-sm">Read-only delivery records synchronized from Supabase</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-[#0F1825]/80 backdrop-blur-sm border-gray-800 p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Total Notifications</p>
              <p className="text-3xl font-bold text-white">{notifications.length}</p>
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

      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-white">Recent Notifications</h2>
        <div className="space-y-3">
          {notifications.map((notification) => {
            const type = notification.type.toLowerCase();
            const Icon = type.includes('critical') || type.includes('urgent')
              ? AlertCircle
              : type.includes('success') || type.includes('resolved')
                ? CheckCircle
                : type.includes('warning')
                  ? Clock
                  : Radio;
            const critical = Icon === AlertCircle;
            return (
              <Card
                key={notification.id}
                className="bg-[#0F1825]/80 backdrop-blur-sm border-gray-800 p-4"
              >
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 ${critical ? 'bg-[#FF3B30]/20' : 'bg-[#3B82F6]/20'} rounded-lg flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-6 h-6 ${critical ? 'text-[#FF3B30]' : 'text-[#3B82F6]'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-semibold text-white">{notification.type || 'Notification'}</h3>
                      <span className="text-xs text-gray-500">{notificationTime(notification.sentAt)}</span>
                    </div>
                    <p className="mt-1 text-sm text-gray-400">Incident {notification.incidentId}</p>
                    <Badge className="mt-3 bg-gray-500/20 text-gray-300 border-gray-500/50">
                      Delivery: {notification.status}
                    </Badge>
                  </div>
                </div>
              </Card>
            );
          })}
          {!loading && !error && notifications.length === 0 && (
            <p className="py-8 text-center text-sm text-gray-400">No notifications found.</p>
          )}
        </div>
      </div>
    </div>
  );
}
