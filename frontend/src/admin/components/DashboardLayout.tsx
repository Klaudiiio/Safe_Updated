import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  AlertCircle,
  Users,
  UsersRound,
  ScrollText,
  Bell,
  Settings,
  Search,
  Shield,
  Clock,
  Calendar,
  CheckCheck,
  User,
  LogOut,
  X,
  Lock,
  Mail,
  Phone,
  Edit3,
  Save,
  ArrowLeft,
  Activity,
  MapPin,
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Badge } from './ui/badge';
import { Card } from './ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  useAdminData,
  getAlertExpiresAtMs,
  isEarthquakeAlertActive,
  type EarthquakeAlertRecord,
} from '../useAdminData';
import { fetchAdminProfile, updateAdminProfile, changeAdminPassword } from '../api';

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: AlertCircle, label: 'Active Incidents', path: '/active-incidents' },
  { icon: Users, label: 'Responders', path: '/responders' },
  { icon: UsersRound, label: 'Users', path: '/users' },
  { icon: ScrollText, label: 'Incident Logs', path: '/incident-logs' },
  { icon: Bell, label: 'Notifications', path: '/notifications' },
  { icon: Settings, label: 'Settings', path: '/settings' },
];

interface DashboardLayoutProps {
  displayName: string;
  onLogout: () => void;
}

const triggerBrowserEarthquakeNotification = (alert: EarthquakeAlertRecord) => {
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    const title =
      alert.title ||
      `Earthquake Alert: ${alert.magnitude != null ? `M${alert.magnitude.toFixed(1)}` : 'Alert'} — ${alert.place}`;
    const body =
      alert.message ||
      `${alert.place}${
        alert.distance_from_cdo_km != null ? ` (${alert.distance_from_cdo_km.toFixed(1)} km from USTP CDO)` : ''
      }`;

    if (Notification.permission === 'granted') {
      new Notification(title, { body, tag: `eq-alert-${alert.external_event_id}` });
    } else if (Notification.permission !== 'denied') {
      void Notification.requestPermission().then((perm) => {
        if (perm === 'granted') {
          new Notification(title, { body, tag: `eq-alert-${alert.external_event_id}` });
        }
      });
    }
  } catch {
    // Ignore browser notification errors in restricted contexts
  }
};

export function DashboardLayout({ displayName: initialDisplayName, onLogout }: DashboardLayoutProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [isRinging, setIsRinging] = useState(false);
  const [isEarthquakeRinging, setIsEarthquakeRinging] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Selected earthquake event for inspecting history or active modal
  const [selectedEarthquakeModal, setSelectedEarthquakeModal] = useState<EarthquakeAlertRecord | null>(null);
  const [dismissedEarthquakeIds, setDismissedEarthquakeIds] = useState<Set<string>>(() => new Set());
  const seenEarthquakeModalIdsRef = useRef<Set<string>>(new Set());

  // Modal navigation view state: 'view' | 'edit-profile' | 'edit-password'
  const [modalView, setModalView] = useState<'view' | 'edit-profile' | 'edit-password'>('view');

  // Profile data state loaded from Django
  const [displayName, setDisplayName] = useState(initialDisplayName || 'admin');
  const [username, setUsername] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactNumber, setContactNumber] = useState('');

  // Password update state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Load real profile data when modal opens or component mounts
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      fetchAdminProfile(token)
        .then((data: any) => {
          setDisplayName(data.name || data.username || initialDisplayName);
          setUsername(data.username || '');
          setContactEmail(data.email || '');
          setContactNumber(data.phone_number || '');
        })
        .catch((err: any) => {
          console.warn('Could not load admin profile from backend:', err);
        });
    }
  }, [isProfileModalOpen, initialDisplayName]);

  // Safe location fallback in case router context is momentarily absent during hot reloads
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location?.pathname || '/';

  const initials = (displayName || 'Admin').slice(0, 2).toUpperCase();

  // Fetch live notifications, earthquake alerts, and incidents directly from Supabase via useAdminData
  const {
    notifications: rawNotifications,
    earthquakeAlerts: rawEarthquakeAlerts,
    incidents,
    markNotificationAsRead,
    dismissEarthquakeAlert: hookDismissEarthquakeAlert,
    acknowledgeEarthquakeAlert,
    stopEarthquakeAlertAudio,
  } = useAdminData() as any;

  // Full history feed of earthquake alerts
  const earthquakeAlerts: EarthquakeAlertRecord[] = useMemo(() => {
    const list: EarthquakeAlertRecord[] = Array.isArray(rawEarthquakeAlerts) ? rawEarthquakeAlerts : [];
    const seen = new Set<string>();
    return list
      .filter((item) => {
        if (!item) return false;
        const key = String(item.external_event_id || item.id);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((item) => ({
        ...item,
        external_event_id: String(item.external_event_id || item.id),
      }));
  }, [rawEarthquakeAlerts]);

  // 1-second tick while any unacknowledged, undismissed alert has a future alert_expires_at
  const nowMs = now.getTime();

  useEffect(() => {
    const hasPendingExpiration = earthquakeAlerts.some((eq) => {
      if (String(eq.classification ?? '').trim().toLowerCase() !== 'earthquake_alert') {
        return false;
      }
      if (Boolean(eq.acknowledged) || eq.alert_active === false) return false;
      const key = String(eq.external_event_id || eq.id || '').trim();
      if (key && dismissedEarthquakeIds.has(key)) return false;
      const expiresAtMs = getAlertExpiresAtMs(eq);
      return expiresAtMs !== null && Date.now() < expiresAtMs;
    });

    const intervalMs = hasPendingExpiration ? 1000 : 60_000;
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [earthquakeAlerts, dismissedEarthquakeIds]);

  // Active alerts computed dynamically against nowMs and alert_expires_at
  const activeEarthquakeAlerts: EarthquakeAlertRecord[] = useMemo(() => {
    return earthquakeAlerts.filter((eq) =>
      isEarthquakeAlertActive(eq, nowMs, dismissedEarthquakeIds)
    );
  }, [earthquakeAlerts, nowMs, dismissedEarthquakeIds]);

  const latestActiveEarthquakeAlert: EarthquakeAlertRecord | null =
    activeEarthquakeAlerts.length > 0 ? activeEarthquakeAlerts[0] : null;

  const isEarthquakeAlertModalOpen = Boolean(latestActiveEarthquakeAlert);
  const displayedEarthquakeModal: EarthquakeAlertRecord | null = useMemo(() => {
    if (latestActiveEarthquakeAlert) {
      return latestActiveEarthquakeAlert;
    }
    if (
      selectedEarthquakeModal &&
      isEarthquakeAlertActive(selectedEarthquakeModal, nowMs, dismissedEarthquakeIds)
    ) {
      return selectedEarthquakeModal;
    }
    return null;
  }, [
    latestActiveEarthquakeAlert,
    selectedEarthquakeModal,
    nowMs,
    dismissedEarthquakeIds,
  ]);

  // Clear stale modal selection and stop audio as soon as active alert expires, is dismissed, or is acknowledged
  useEffect(() => {
    if (!displayedEarthquakeModal) {
      setSelectedEarthquakeModal(null);
      setIsEarthquakeRinging(false);
      if (typeof stopEarthquakeAlertAudio === 'function') {
        stopEarthquakeAlertAudio();
      }
    }
  }, [displayedEarthquakeModal, stopEarthquakeAlertAudio]);

  const unreadEarthquakeCount = activeEarthquakeAlerts.length;

  // Local state to manage read/unread states instantly in the UI dropdown
  const [readMap, setReadMap] = useState<Record<string, boolean>>({});

  // Filter out notifications whose related incident status is resolved or completed
  const notifications = useMemo(() => {
    const rawList = rawNotifications || [];

    return rawList.filter((notification: any) => {
      const incidentId = notification.incident_id || notification.incidentId;
      if (incidentId && incidents) {
        const matchingIncident = incidents.find(
          (inc: any) => String(inc.id || inc.incident_id) === String(incidentId)
        );
        if (matchingIncident) {
          const incStatus = String(matchingIncident.status || '').trim().toLowerCase();
          if (['resolved', 'completed'].includes(incStatus)) {
            return false;
          }
        }
      }
      return true;
    }).map((n: Record<string, any>, index: number) => {
      const id = String(n.notification_id || n.id || index + 1);
      const isRead = readMap[id] ?? (String(n.status || '').toLowerCase() === 'read' || Boolean(n.is_read || n.read));

      const isEarthquakeNotif =
        String(n.type || '').toLowerCase() === 'earthquake_alert' ||
        String(n.classification || '').toLowerCase() === 'earthquake_alert' ||
        Boolean(n.earthquake_event_id);

      const incidentId = n.incident_id || n.incidentId;
      const matchingIncident = incidents?.find(
        (inc: any) => String(inc.id || inc.incident_id) === String(incidentId)
      );

      // 1. Build notification title from matchingIncident.type with fallback to notification/incident-type field
      const title =
        n.title ||
        matchingIncident?.type ||
        matchingIncident?.incident_types?.incident_name ||
        matchingIncident?.incident_name ||
        (isEarthquakeNotif ? 'Earthquake Alert' : 'Incident');

      if (isEarthquakeNotif) {
        const magText = n.magnitude != null ? `M${Number(n.magnitude).toFixed(1)} ` : '';
        const placeText = n.place || 'Regional Zone';
        const distText =
          n.distance_from_cdo_km != null
            ? ` (${Number(n.distance_from_cdo_km).toFixed(1)} km from USTP CDO)`
            : '';
        const message =
          n.message || `${magText}earthquake near ${placeText}${distText}`;
        const timeValue = n.sent_at || n.sentAt || n.created_at;
        const time = timeValue
          ? new Date(timeValue).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : 'Recent';

        return {
          id,
          title,
          message,
          time,
          path: '/notifications',
          isRead,
          severity: 'critical',
        };
      }

      // 2. Show reporter username using matchingIncident.reporterUsername (supplied by liveData.ts)
      const rawReporter =
        matchingIncident?.reporterUsername ||
        matchingIncident?.reporter_username ||
        matchingIncident?.reporter_name ||
        matchingIncident?.reporterName ||
        matchingIncident?.username ||
        matchingIncident?.user?.username ||
        matchingIncident?.users?.username ||
        n.reporter_username ||
        n.username;

      const cleanReporter = typeof rawReporter === 'string' ? rawReporter.trim() : '';
      const lowerReporter = cleanReporter.toLowerCase();
      const isAnonymous =
        !cleanReporter ||
        lowerReporter === 'anonymous' ||
        lowerReporter === 'none' ||
        lowerReporter === 'admin' ||
        /^user\s*\d*$/i.test(lowerReporter);

      const reporterDisplay = isAnonymous ? 'Anonymous' : cleanReporter;

      // 3. Include incident location, description, and reporter in the text
      const description = matchingIncident?.description || n.message || n.content || 'Emergency alert reported';
      const locationText = matchingIncident?.building || matchingIncident?.location;

      const message = locationText
        ? `${description} at ${locationText} — Submitted by ${reporterDisplay}`
        : `${description} — Submitted by ${reporterDisplay}`;

      const timeValue = n.sent_at || n.sentAt || n.created_at || matchingIncident?.reported_at;
      const time = timeValue
        ? new Date(timeValue).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : 'Recent';

      const priority = (matchingIncident?.status === 'Active' ? 'critical' : (n.priority || n.priority_level || 'urgent')).toLowerCase();

      // Link directly to Active Incidents with incident parameter query for auto-scrolling
      const notificationPath = incidentId ? `/active-incidents?incident=${incidentId}` : '/notifications';

      return {
        id,
        title,
        message,
        time,
        path: notificationPath,
        isRead,
        severity: priority,
      };
    });
  }, [rawNotifications, incidents, readMap]);

  const unreadCount = notifications.filter((n: { isRead: boolean }) => !n.isRead).length;

  const markAsRead = async (id: string) => {
    setReadMap((prev) => ({ ...prev, [id]: true }));
    try {
      if (typeof markNotificationAsRead === 'function') {
        await markNotificationAsRead(id);
      }
    } catch (err) {
      console.error('Failed to mark notification as read in Supabase:', err);
    }
  };

  const markAllAsRead = () => {
    const newMap: Record<string, boolean> = {};
    notifications.forEach((n: { id: string }) => {
      newMap[n.id] = true;
      if (typeof markNotificationAsRead === 'function') {
        void markNotificationAsRead(n.id);
      }
    });
    setReadMap(newMap);
  };

  const dismissEarthquakeAlert = (eventId: string) => {
    const cleanId = String(eventId || '').trim();
    if (typeof stopEarthquakeAlertAudio === 'function') {
      stopEarthquakeAlertAudio();
    }
    setIsEarthquakeRinging(false);
    setDismissedEarthquakeIds((prev) => {
      const next = new Set(prev);
      next.add(cleanId);
      return next;
    });
    if (typeof hookDismissEarthquakeAlert === 'function') {
      hookDismissEarthquakeAlert(cleanId);
    }
    if (
      selectedEarthquakeModal &&
      String(selectedEarthquakeModal.external_event_id || selectedEarthquakeModal.id) === cleanId
    ) {
      setSelectedEarthquakeModal(null);
    }
  };

  const handleAcknowledgeEarthquake = async (eq: EarthquakeAlertRecord) => {
    const eventId = String(eq.external_event_id || eq.id || '').trim();
    if (typeof stopEarthquakeAlertAudio === 'function') {
      stopEarthquakeAlertAudio();
    }
    setIsEarthquakeRinging(false);
    setDismissedEarthquakeIds((prev) => {
      const next = new Set(prev);
      next.add(eventId);
      return next;
    });
    if (
      selectedEarthquakeModal &&
      String(selectedEarthquakeModal.external_event_id || selectedEarthquakeModal.id) === eventId
    ) {
      setSelectedEarthquakeModal(null);
    }
    if (typeof acknowledgeEarthquakeAlert === 'function') {
      await acknowledgeEarthquakeAlert(eventId);
    }
  };

  const dismissAllEarthquakeAlerts = async () => {
    if (typeof stopEarthquakeAlertAudio === 'function') {
      stopEarthquakeAlertAudio();
    }
    setIsEarthquakeRinging(false);
    const nextDismissed = new Set(dismissedEarthquakeIds);
    for (const eq of activeEarthquakeAlerts) {
      const eqId = String(eq.external_event_id || eq.id || '').trim();
      if (eqId) {
        nextDismissed.add(eqId);
        if (typeof acknowledgeEarthquakeAlert === 'function') {
          await acknowledgeEarthquakeAlert(eqId);
        }
      }
    }
    setDismissedEarthquakeIds(nextDismissed);
    setSelectedEarthquakeModal(null);
  };

  // Handle saving profile changes through Django backend & Supabase sync
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('access_token');
    if (!token) {
      setFeedbackMessage('Authentication token missing. Please log in again.');
      return;
    }

    setIsSaving(true);
    setFeedbackMessage('');

    try {
      const result = await updateAdminProfile(token, {
        name: displayName,
        username: username,
        email: contactEmail,
        phone_number: contactNumber,
      });

      if (result.user) {
        setDisplayName(result.user.name || result.user.username);
        setUsername(result.user.username);
        setContactEmail(result.user.email);
        setContactNumber(result.user.phone_number);
      }

      if (result.supabase_synced === false) {
        setFeedbackMessage(`Profile updated in Django, but Supabase sync warning: ${result.sync_warning}`);
      } else {
        setFeedbackMessage('Profile details updated and synchronized successfully!');
      }

      setTimeout(() => {
        setFeedbackMessage('');
        setModalView('view');
      }, 1500);
    } catch (err: any) {
      setFeedbackMessage(err.message || 'Failed to update profile.');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle updating password securely via backend
  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setFeedbackMessage('New passwords do not match.');
      return;
    }

    const token = localStorage.getItem('access_token');
    if (!token) {
      setFeedbackMessage('Authentication token missing. Please log in again.');
      return;
    }

    setIsSaving(true);
    setFeedbackMessage('');

    try {
      await changeAdminPassword(token, {
        current_password: currentPassword,
        new_password: newPassword,
      });

      setFeedbackMessage('Password updated successfully!');
      setTimeout(() => {
        setFeedbackMessage('');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setModalView('view');
      }, 1500);
    } catch (err: any) {
      setFeedbackMessage(err.message || 'Failed to update password.');
    } finally {
      setIsSaving(false);
    }
  };

  // Listen for real-time alert events from useAdminData to animate bell ringing & open earthquake alert modal
  useEffect(() => {
    let ringTimer: ReturnType<typeof setTimeout> | undefined;
    let eqRingTimer: ReturnType<typeof setTimeout> | undefined;

    const handleNewAlert = () => {
      setIsRinging(true);
      if (ringTimer) clearTimeout(ringTimer);
      ringTimer = setTimeout(() => setIsRinging(false), 2500);
    };

    const handleNewEarthquakeAlert = (event: Event) => {
      const customEvent = event as CustomEvent<any>;
      const raw = customEvent?.detail;
      if (!raw) return;

      const eventId = String(raw.earthquake_event_id || raw.external_event_id || raw.id || '').trim();
      const parsedMag =
        typeof raw.magnitude === 'number'
          ? raw.magnitude
          : raw.magnitude != null && raw.magnitude !== ''
          ? Number(raw.magnitude)
          : null;
      const parsedDist =
        typeof raw.distance_from_cdo_km === 'number'
          ? raw.distance_from_cdo_km
          : raw.distance_from_cdo_km != null && raw.distance_from_cdo_km !== ''
          ? Number(raw.distance_from_cdo_km)
          : null;

      const normalized: EarthquakeAlertRecord = {
        id: String(raw.notification_id ?? raw.id ?? eventId ?? Date.now()),
        external_event_id: eventId || String(Date.now()),
        title:
          raw.title ||
          `Earthquake Alert: ${
            parsedMag != null && Number.isFinite(parsedMag) ? `M${parsedMag.toFixed(1)}` : 'Alert'
          } — ${raw.place || 'Unknown Location'}`,
        message: raw.message || '',
        magnitude: parsedMag != null && Number.isFinite(parsedMag) ? parsedMag : null,
        place: String(raw.place || 'Unknown Location'),
        distance_from_cdo_km:
          parsedDist != null && Number.isFinite(parsedDist) ? parsedDist : null,
        reported_intensity: raw.reported_intensity ?? null,
        classification: String(raw.classification || 'earthquake_alert'),
        source: String(raw.source || 'PHIVOLCS'),
        event_occurred_at: raw.event_occurred_at || raw.created_at,
        evaluated_at: raw.evaluated_at || raw.created_at,
        alert_detected_at: raw.alert_detected_at ?? null,
        alert_expires_at: raw.alert_expires_at ?? null,
        alert_active: typeof raw.alert_active === 'boolean' ? raw.alert_active : undefined,
        acknowledged: Boolean(raw.acknowledged),
      };

      if (!isEarthquakeAlertActive(normalized, Date.now(), dismissedEarthquakeIds)) {
        return;
      }

      setIsEarthquakeRinging(true);
      if (eqRingTimer) clearTimeout(eqRingTimer);
      eqRingTimer = setTimeout(() => setIsEarthquakeRinging(false), 3500);

      if (!seenEarthquakeModalIdsRef.current.has(normalized.external_event_id)) {
        seenEarthquakeModalIdsRef.current.add(normalized.external_event_id);
        setSelectedEarthquakeModal(normalized);
        triggerBrowserEarthquakeNotification(normalized);
      }
    };

    window.addEventListener('safe:new-incident-alert', handleNewAlert);
    window.addEventListener('safe:new-earthquake-alert', handleNewEarthquakeAlert);
    return () => {
      if (ringTimer) clearTimeout(ringTimer);
      if (eqRingTimer) clearTimeout(eqRingTimer);
      window.removeEventListener('safe:new-incident-alert', handleNewAlert);
      window.removeEventListener('safe:new-earthquake-alert', handleNewEarthquakeAlert);
    };
  }, [dismissedEarthquakeIds]);

  const currentDate = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const currentTime = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F0F6FF] via-[#E0F2FE] to-[#BAE6FD]">
      {/* Sidebar - Hover Collapsible */}
      <aside
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`fixed left-0 top-0 z-40 h-screen transition-all duration-300 ease-in-out ${
          isHovered ? 'w-64' : 'w-16'
        } bg-gradient-to-r from-[#151130] via-[#1a153b] to-[#231e4d] border-r border-indigo-950/60 flex flex-col justify-between shadow-2xl shadow-slate-950/40 overflow-hidden`}
      >
        <div>
          <Link
            to="/"
            title="Go to Dashboard"
            className="flex flex-col items-center justify-center p-4 border-b border-indigo-950/50 text-center hover:bg-white/5 transition-colors cursor-pointer group"
          >
            <div className="w-10 h-10 bg-white/10 rounded-2xl flex items-center justify-center mb-1 shadow-inner border border-white/20 shrink-0 group-hover:border-indigo-300 transition-colors">
              <Shield className="w-5 h-5 text-indigo-300 stroke-[2.5]" />
            </div>
            {isHovered && (
              <>
                <h1 className="font-extrabold text-white text-base tracking-wider mt-1 group-hover:text-indigo-200 transition-colors">SAFE</h1>
                <p className="text-[10px] text-indigo-300 font-medium">Emergency Monitor</p>
              </>
            )}
          </Link>

          <nav className="max-h-[calc(100vh-200px)] overflow-y-auto p-2 space-y-1.5">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPath === item.path;

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  title={!isHovered ? item.label : undefined}
                  className={`flex items-center gap-3 px-3.5 py-3 rounded-xl transition-all font-semibold outline-none ${
                    isActive
                      ? 'bg-white text-[#201b50] shadow-lg shadow-slate-950/50 ring-2 ring-indigo-300'
                      : 'bg-white/5 text-white/90 shadow-sm shadow-slate-950/20 hover:bg-white hover:text-[#201b50] hover:shadow-md'
                  }`}
                >
                  <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-indigo-600' : 'text-indigo-300 group-hover:text-indigo-600'}`} />
                  <span className={`text-sm font-semibold whitespace-nowrap transition-opacity duration-200 ${isHovered ? 'opacity-100' : 'opacity-0 hidden'}`}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="p-3 border-t border-indigo-950/50 bg-[#110d26]"></div>
      </aside>

      {/* Main Content */}
      <div className={`transition-all duration-300 ease-in-out ${isHovered ? 'ml-64' : 'ml-16'}`}>
        <header className="sticky top-0 z-30 bg-[#201b50] backdrop-blur-sm border-b border-indigo-950/40 shadow-xl shadow-slate-950/20">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-4 flex-1">
              <div className="relative w-full max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/70" />
                <Input
                  type="search"
                  placeholder="Search incidents, responders, locations..."
                  className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/70 focus:bg-white focus:text-slate-900 focus:placeholder:text-slate-400 focus:border-white transition-all rounded-xl"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 sm:gap-4">
              <div className="hidden lg:flex items-center gap-4 text-sm text-white/90 font-medium">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-indigo-300" />
                  <span>{currentDate}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-300" />
                  <span>{currentTime}</span>
                </div>
              </div>

              {/* Earthquake Alerts Dropdown (History + Active Count) */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    title="Earthquake Alerts"
                    className="relative text-amber-200 hover:bg-white/10 hover:text-white focus:outline-none cursor-pointer rounded-xl px-2.5"
                  >
                    <Activity
                      className={`w-5 h-5 transition-transform ${
                        isEarthquakeRinging ? 'animate-bounce text-rose-300 scale-125' : ''
                      }`}
                    />
                    <span className="hidden xl:inline text-xs font-bold ml-1.5">EQ Alerts</span>
                    {unreadEarthquakeCount > 0 && (
                      <Badge className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center p-0 bg-rose-600 text-white text-xs border-2 border-[#201b50] animate-pulse rounded-full">
                        {unreadEarthquakeCount}
                      </Badge>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-80 sm:w-96 bg-white border-rose-100 text-slate-800 shadow-xl rounded-2xl"
                >
                  <DropdownMenuLabel className="flex justify-between items-center py-3 px-4 border-b border-slate-100">
                    <span className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                      <Activity className="w-4 h-4 text-rose-600" />
                      Earthquake Alerts
                    </span>
                    {unreadEarthquakeCount > 0 ? (
                      <button
                        type="button"
                        onClick={() => void dismissAllEarthquakeAlerts()}
                        className="flex items-center gap-1 text-xs text-rose-600 hover:underline cursor-pointer font-semibold"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        Acknowledge all
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">No active alerts</span>
                    )}
                  </DropdownMenuLabel>

                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {earthquakeAlerts.length > 0 ? (
                      earthquakeAlerts.map((eq) => {
                        const eqId = String(eq.external_event_id || eq.id);
                        const isActive = isEarthquakeAlertActive(eq, nowMs, dismissedEarthquakeIds);
                        const isAcknowledgedOrExpired = !isActive;
                        const magLabel =
                          eq.magnitude != null ? `M${Number(eq.magnitude).toFixed(1)}` : 'Alert';
                        const distLabel =
                          eq.distance_from_cdo_km != null
                            ? `${Number(eq.distance_from_cdo_km).toFixed(1)} km from USTP CDO`
                            : 'Regional zone';

                        return (
                          <div
                            key={eqId}
                            onClick={() => {
                              if (isActive) {
                                setSelectedEarthquakeModal(eq);
                              } else {
                                navigate('/notifications');
                              }
                            }}
                            className={`flex flex-col items-start gap-1 p-3.5 transition-colors cursor-pointer ${
                              isAcknowledgedOrExpired
                                ? 'opacity-65 bg-transparent hover:bg-slate-50 text-slate-500'
                                : 'bg-rose-50/60 hover:bg-rose-50 text-slate-800'
                            }`}
                          >
                            <div className="flex items-center justify-between w-full gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                {isActive && (
                                  <span className="w-2 h-2 rounded-full bg-rose-600 shrink-0 animate-ping" />
                                )}
                                <span className="text-xs font-extrabold text-slate-900 truncate">
                                  {eq.title || `Earthquake Alert: ${magLabel} — ${eq.place}`}
                                </span>
                              </div>
                              <Badge className="text-[10px] font-bold px-2 py-0.2 bg-rose-100 text-rose-700 border-rose-200 shrink-0">
                                {magLabel}
                              </Badge>
                            </div>
                            <p className="text-xs text-slate-600 pl-4 line-clamp-1">
                              {eq.place} • {distLabel}
                            </p>
                            <div className="pl-4 mt-1 flex items-center justify-between w-full text-[11px] text-slate-400">
                              <span>{eq.source || 'PHIVOLCS'}</span>
                              {isActive ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void handleAcknowledgeEarthquake(eq);
                                  }}
                                  className="text-rose-600 hover:underline font-semibold cursor-pointer"
                                >
                                  Acknowledge
                                </button>
                              ) : (
                                <span className="text-slate-400 font-medium">
                                  {eq.acknowledged ? 'Acknowledged' : 'Expired'}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-6 text-center text-xs text-slate-400">
                        No earthquake alerts recorded.
                      </div>
                    )}
                  </div>

                  <DropdownMenuSeparator className="bg-slate-100" />
                  <DropdownMenuItem asChild>
                    <Link
                      to="/notifications"
                      className="w-full text-center text-xs font-bold text-rose-600 hover:underline justify-center py-2.5 focus:bg-rose-50 focus:text-rose-700 cursor-pointer"
                    >
                      Open Notifications Center
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Notifications Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="relative text-white hover:bg-white/10 focus:outline-none cursor-pointer rounded-xl"
                  >
                    <Bell className={`w-5 h-5 transition-transform ${isRinging ? 'animate-bounce text-indigo-200 scale-125' : ''}`} />
                    {unreadCount > 0 && (
                      <Badge className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center p-0 bg-red-600 text-white text-xs border-2 border-[#201b50] animate-pulse rounded-full">
                        {unreadCount}
                      </Badge>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80 sm:w-96 bg-white border-indigo-100 text-slate-800 shadow-xl rounded-2xl">
                  <DropdownMenuLabel className="flex justify-between items-center py-3 px-4 border-b border-slate-100">
                    <span className="font-bold text-sm text-slate-900">Incident Notifications</span>
                    {unreadCount > 0 ? (
                      <button
                        onClick={markAllAsRead}
                        className="flex items-center gap-1 text-xs text-indigo-600 hover:underline cursor-pointer font-semibold"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        Mark all as read
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">All read</span>
                    )}
                  </DropdownMenuLabel>

                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {notifications.length > 0 ? (
                      notifications.map((item: any) => {
                        const isCritical = item.severity === 'critical' || item.severity === 'urgent';
                        return (
                          <DropdownMenuItem key={item.id} asChild>
                            <Link
                              to={item.path}
                              onClick={() => markAsRead(item.id)}
                              className={`flex flex-col items-start gap-1 p-3.5 transition-colors cursor-pointer ${
                                item.isRead
                                  ? 'opacity-70 bg-transparent hover:bg-slate-50 text-slate-500'
                                  : 'bg-indigo-50/60 hover:bg-indigo-50 text-slate-800 font-medium'
                              }`}
                            >
                              <div className="flex items-center justify-between w-full">
                                <div className="flex items-center gap-2 min-w-0">
                                  {!item.isRead && (
                                    <span className="w-2 h-2 rounded-full bg-rose-600 shrink-0" />
                                  )}
                                  <span className={`text-xs font-bold truncate ${isCritical && !item.isRead ? 'text-rose-700' : 'text-slate-900'}`}>
                                    {item.title}
                                  </span>
                                </div>
                                <span className="text-[11px] text-slate-400 shrink-0 ml-2">{item.time}</span>
                              </div>
                              <p className="text-xs text-slate-600 pl-4 line-clamp-2">{item.message}</p>
                            </Link>
                          </DropdownMenuItem>
                        );
                      })
                    ) : (
                      <div className="p-6 text-center text-xs text-slate-400">
                        No notifications available
                      </div>
                    )}
                  </div>

                  <DropdownMenuSeparator className="bg-slate-100" />
                  <DropdownMenuItem asChild>
                    <Link
                      to="/notifications"
                      className="w-full text-center text-xs font-bold text-indigo-600 hover:underline justify-center py-2.5 focus:bg-indigo-50 focus:text-indigo-700 cursor-pointer"
                    >
                      View All Notifications
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Profile Avatar Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2.5 p-1 rounded-full hover:bg-white/10 transition-colors cursor-pointer focus:outline-none">
                    <Avatar className="w-9 h-9 border-2 border-indigo-300 shadow-sm">
                      <AvatarFallback className="bg-indigo-600 text-white font-bold text-xs">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-white border-indigo-100 text-slate-800 shadow-xl rounded-2xl p-2">
                  <DropdownMenuLabel className="font-bold text-slate-900 pb-2">
                    {displayName}
                    <p className="text-xs text-slate-400 font-normal truncate">{contactEmail || 'Administrator'}</p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-slate-100" />
                  <DropdownMenuItem
                    onClick={() => {
                      setModalView('view');
                      setFeedbackMessage('');
                      setIsProfileModalOpen(true);
                    }}
                    className="flex items-center gap-2 text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-xl cursor-pointer py-2.5 px-3"
                  >
                    <User className="w-4 h-4 text-indigo-600" />
                    Profile & Account
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={onLogout}
                    className="flex items-center gap-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:text-rose-700 rounded-xl cursor-pointer py-2.5 px-3"
                  >
                    <LogOut className="w-4 h-4 text-rose-600" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6">
          <Outlet />
        </main>
      </div>

      {/* Active Earthquake Alert Modal (closes automatically when expired or acknowledged) */}
      {isEarthquakeAlertModalOpen && displayedEarthquakeModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4"
          onClick={() => dismissEarthquakeAlert(String(displayedEarthquakeModal.external_event_id || displayedEarthquakeModal.id))}
        >
          <Card
            className="w-full max-w-lg bg-white border-2 border-rose-500 shadow-2xl rounded-3xl overflow-hidden text-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-rose-700 via-rose-600 to-amber-600 px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Activity className="w-5 h-5 animate-pulse" />
                <div>
                  <span className="text-[11px] font-extrabold uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full">
                    {displayedEarthquakeModal.source || 'PHIVOLCS'} • Active Alert
                  </span>
                  <h2 className="text-lg font-black tracking-tight mt-0.5">
                    {displayedEarthquakeModal.title || 'Earthquake Alert'}
                  </h2>
                </div>
              </div>
              <button
                type="button"
                onClick={() => dismissEarthquakeAlert(String(displayedEarthquakeModal.external_event_id || displayedEarthquakeModal.id))}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-rose-50 border border-rose-200 rounded-2xl p-4">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <MapPin className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{displayedEarthquakeModal.place}</span>
                </div>
                <Badge className="bg-rose-600 text-white font-black text-xs px-2.5 py-0.5">
                  {displayedEarthquakeModal.magnitude != null
                    ? `M${Number(displayedEarthquakeModal.magnitude).toFixed(1)}`
                    : 'Alert'}
                </Badge>
              </div>

              {displayedEarthquakeModal.message && (
                <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3.5 rounded-2xl border border-slate-200/70">
                  {displayedEarthquakeModal.message}
                </p>
              )}

              <div className="grid grid-cols-2 gap-3 text-xs text-slate-600">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/60">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Distance from USTP CDO</span>
                  <span className="font-bold text-slate-900">
                    {displayedEarthquakeModal.distance_from_cdo_km != null
                      ? `${Number(displayedEarthquakeModal.distance_from_cdo_km).toFixed(1)} km`
                      : 'N/A'}
                  </span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/60">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Reported Intensity</span>
                  <span className="font-bold text-slate-900">
                    {displayedEarthquakeModal.reported_intensity || 'None reported'}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => dismissEarthquakeAlert(String(displayedEarthquakeModal.external_event_id || displayedEarthquakeModal.id))}
                  className="rounded-xl text-xs font-bold cursor-pointer"
                >
                  Dismiss
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleAcknowledgeEarthquake(displayedEarthquakeModal)}
                  className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-extrabold cursor-pointer"
                >
                  Acknowledge Alert
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Profile & Account Modal */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md bg-white border-indigo-100 shadow-2xl rounded-3xl overflow-hidden text-slate-800">
            <div className="bg-[#201b50] px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                {modalView !== 'view' && (
                  <button
                    type="button"
                    onClick={() => {
                      setFeedbackMessage('');
                      setModalView('view');
                    }}
                    className="p-1 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                )}
                <h2 className="text-base font-extrabold tracking-tight">
                  {modalView === 'view'
                    ? 'Profile & Account'
                    : modalView === 'edit-profile'
                    ? 'Edit Profile'
                    : 'Change Password'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFeedbackMessage('');
                  setIsProfileModalOpen(false);
                }}
                className="p-1.5 rounded-xl hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6">
              {feedbackMessage && (
                <div className="mb-4 p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-xs font-semibold text-indigo-800">
                  {feedbackMessage}
                </div>
              )}

              {modalView === 'view' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3.5 bg-slate-50 p-4 rounded-2xl border border-slate-200/70">
                    <Avatar className="w-12 h-12 border-2 border-indigo-200">
                      <AvatarFallback className="bg-indigo-600 text-white font-bold text-sm">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <h3 className="text-sm font-black text-slate-900 truncate">{displayName}</h3>
                      <p className="text-xs text-slate-500 truncate">@{username || 'admin'}</p>
                    </div>
                  </div>

                  <div className="space-y-2.5 text-xs text-slate-700 bg-slate-50 p-4 rounded-2xl border border-slate-200/70">
                    <div className="flex items-center gap-2.5">
                      <Mail className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span className="truncate">{contactEmail || 'No email set'}</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <Phone className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span className="truncate">{contactNumber || 'No phone number set'}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setFeedbackMessage('');
                        setModalView('edit-profile');
                      }}
                      className="rounded-xl text-xs font-bold gap-1.5 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Edit Profile
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setFeedbackMessage('');
                        setModalView('edit-password');
                      }}
                      className="rounded-xl text-xs font-bold gap-1.5 cursor-pointer"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      Password
                    </Button>
                  </div>
                </div>
              )}

              {modalView === 'edit-profile' && (
                <form onSubmit={handleSaveProfile} className="space-y-3.5">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Display Name</label>
                    <Input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="rounded-xl text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Username</label>
                    <Input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="rounded-xl text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Email</label>
                    <Input
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      className="rounded-xl text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Phone Number</label>
                    <Input
                      type="text"
                      value={contactNumber}
                      onChange={(e) => setContactNumber(e.target.value)}
                      className="rounded-xl text-xs"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      type="submit"
                      disabled={isSaving}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold gap-1.5 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      {isSaving ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </div>
                </form>
              )}

              {modalView === 'edit-password' && (
                <form onSubmit={handleSavePassword} className="space-y-3.5">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Current Password</label>
                    <Input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="rounded-xl text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">New Password</label>
                    <Input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="rounded-xl text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Confirm New Password</label>
                    <Input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="rounded-xl text-xs"
                      required
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      type="submit"
                      disabled={isSaving}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold gap-1.5 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      {isSaving ? 'Updating...' : 'Update Password'}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}