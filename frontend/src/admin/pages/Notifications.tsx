import { useState, useMemo } from 'react';
import { AlertCircle, AlertTriangle, Bell, CheckCircle, Clock, Radio, Trash2, CheckCheck } from 'lucide-react';
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

export function Notifications() {
  const { notifications, incidents, loading, error, deleteNotification, clearAllNotifications } = useAdminData() as any;

  // Local state to manage optimistically deleted notification IDs
  const [deletedIds, setDeletedIds] = useState<(string | number)[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filter out notifications whose related incident status is resolved or completed, and any deleted ones
  const safeNotifications = useMemo(() => {
    const rawList = notifications || [];

    return rawList.filter((notification: any) => {
      const id = notification.notification_id || notification.id;
      if (deletedIds.includes(id)) return false;

      const incidentId = notification.incident_id || notification.incidentId;
      if (incidentId) {
        // Find matching incident to check its status
        const matchingIncident = incidents?.find(
          (inc: any) => String(inc.id || inc.incident_id) === String(incidentId)
        );

        if (matchingIncident) {
          const incStatus = String(matchingIncident.status || '').trim().toLowerCase();
          // Hide notification if the related incident is resolved or completed
          if (['resolved', 'completed'].includes(incStatus)) {
            return false;
          }
        }
      }

      return true;
    });
  }, [notifications, incidents, deletedIds]);

  // Handle single notification permanent deletion in Supabase & Website
  const handleDelete = async (id: string | number) => {
    // Optimistic UI update
    setDeletedIds(prev => [...prev, id]);

    try {
      if (typeof deleteNotification === 'function') {
        await deleteNotification(id);
      } else {
        // Fallback direct Supabase REST deletion if deleteNotification is not in useAdminData hook yet
        const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.replace(/\/+$/, '');
        const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const token = localStorage.getItem('clinic_staff_supabase_token') || SUPABASE_KEY;

        if (SUPABASE_URL && SUPABASE_KEY) {
          await fetch(`${SUPABASE_URL}/rest/v1/notifications?or=(id.eq.${id},notification_id.eq.${id})`, {
            method: 'DELETE',
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });
        }
      }
    } catch (err) {
      console.error('Failed to permanently delete notification from Supabase:', err);
    }
  };

  // Handle clear all notifications permanently in Supabase & Website
  const handleClearAll = async () => {
    const allIds = (safeNotifications || []).map((n: any) => n.notification_id || n.id);
    setDeletedIds(prev => [...prev, ...allIds]);
    setIsDeleting(true);

    try {
      if (typeof clearAllNotifications === 'function') {
        await clearAllNotifications();
      } else {
        const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.replace(/\/+$/, '');
        const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const token = localStorage.getItem('clinic_staff_supabase_token') || SUPABASE_KEY;

        if (SUPABASE_URL && SUPABASE_KEY) {
          // Delete all visible notifications matching IDs explicitly typed
          await Promise.all(
            allIds.map(async (id: string | number) => {
              await fetch(`${SUPABASE_URL}/rest/v1/notifications?or=(id.eq.${id},notification_id.eq.${id})`, {
                method: 'DELETE',
                headers: {
                  apikey: SUPABASE_KEY,
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
              });
            })
          );
        }
      }
    } catch (err) {
      console.error('Failed to clear all notifications from Supabase:', err);
    } finally {
      setIsDeleting(false);
    }
  };

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
                className="bg-white border-sky-100/60 shadow-md p-4 transition-all hover:shadow-lg rounded-2xl relative group"
              >
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 ${
                    isCritical
                      ? 'bg-red-100 border border-red-200'
                      : isMinor
                        ? 'bg-sky-100 border border-sky-200'
                        : 'bg-blue-100 border border-blue-200'
                  } rounded-xl flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-6 h-6 ${
                      isCritical
                        ? 'text-red-600'
                        : isMinor
                          ? 'text-sky-700'
                          : 'text-blue-600'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0 pr-8">
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
                        <Badge className={`text-xs font-bold ${isCritical ? 'bg-red-100 text-red-700 border-red-200' : 'bg-sky-100 text-sky-800 border-sky-200'}`}>
                          Priority: {notification.priority_level}
                        </Badge>
                      )}
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