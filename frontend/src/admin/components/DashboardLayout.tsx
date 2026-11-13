import React, { useState, useEffect, useMemo } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
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
  ArrowLeft
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
import { useAdminData } from '../useAdminData';
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

export function DashboardLayout({ displayName: initialDisplayName, onLogout }: DashboardLayoutProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [isRinging, setIsRinging] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

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
  const currentPath = location?.pathname || '/';

  const initials = (displayName || 'Admin').slice(0, 2).toUpperCase();

  // Fetch live notifications and incidents directly from Supabase via useAdminData
  const { notifications: rawNotifications, incidents, markNotificationAsRead } = useAdminData() as any;

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
     
      const title = n.title || n.notification_type || 'System Alert';
      const message = n.message || n.content || '';

      const timeValue = n.sent_at || n.sentAt || n.created_at;
      const time = timeValue
        ? new Date(timeValue).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : 'Recent';

      const priority = (n.priority || n.priority_level || 'urgent').toLowerCase();

      return {
        id,
        title,
        message,
        time,
        path: '/notifications',
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

  // Listen for real-time alert events from useAdminData to animate bell ringing
  useEffect(() => {
    const handleNewAlert = () => {
      setIsRinging(true);
      const timer = setTimeout(() => setIsRinging(false), 2500);
      return () => clearTimeout(timer);
    };

    window.addEventListener('safe:new-incident-alert', handleNewAlert);
    return () => {
      window.removeEventListener('safe:new-incident-alert', handleNewAlert);
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

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

            <div className="flex items-center gap-4">
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
                                  <span className={`text-xs truncate ${item.isRead ? 'text-slate-700 font-semibold' : 'text-slate-900 font-extrabold'}`}>
                                    {item.title}
                                  </span>
                                </div>
                                <span className="text-[10px] text-slate-400 whitespace-nowrap ml-2">{item.time}</span>
                              </div>
                              <p className="text-xs text-slate-600 line-clamp-2 pl-4">
                                {item.message}
                              </p>
                              <div className="pl-4 mt-1 flex items-center gap-2">
                                <Badge className={`text-[10px] font-bold px-2 py-0.2 capitalize ${
                                  isCritical ? 'bg-rose-100 text-rose-700 border-rose-200' : 'bg-amber-100 text-amber-700 border-amber-200'
                                }`}>
                                  {item.severity}
                                </Badge>
                              </div>
                            </Link>
                          </DropdownMenuItem>
                        );
                      })
                    ) : (
                      <div className="p-6 text-center text-xs text-slate-400">
                        No incident notifications found.
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

              {/* Admin Profile Button triggering the Profile Card Modal */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setModalView('view');
                  setIsProfileModalOpen(true);
                }}
                className="gap-2 cursor-pointer hover:bg-white/10 text-white rounded-xl"
              >
                <Avatar className="w-8 h-8 border border-white/40">
                  <AvatarFallback className="bg-indigo-700 text-white text-sm font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden md:block text-left">
                  <p className="text-sm font-semibold text-white leading-tight">{displayName}</p>
                  <p className="text-[11px] text-indigo-200">Administrator</p>
                </div>
              </Button>
            </div>
          </div>
        </header>

        <main className="min-h-[calc(100vh-4rem)] p-8 shadow-inner shadow-indigo-950/5">
          <Outlet />
        </main>
      </div>

      {/* Profile Modal Card */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-md bg-white border border-slate-200 shadow-2xl rounded-2xl p-6 relative overflow-hidden space-y-5">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                {modalView !== 'view' && (
                  <button
                    onClick={() => {
                      setModalView('view');
                      setFeedbackMessage('');
                    }}
                    className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors mr-1 cursor-pointer"
                    title="Back to Profile Details"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                )}
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900">
                    {modalView === 'view' && 'Administrator Profile'}
                    {modalView === 'edit-profile' && 'Update Profile Details'}
                    {modalView === 'edit-password' && 'Update Password'}
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    {modalView === 'view' && 'View your profile details and account actions'}
                    {modalView === 'edit-profile' && 'Modify your name and contact information'}
                    {modalView === 'edit-password' && 'Secure your account with a new password'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsProfileModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {feedbackMessage && (
              <div className={`p-3 text-xs font-bold rounded-xl text-center ${
                feedbackMessage.includes('match') || feedbackMessage.includes('Failed') || feedbackMessage.includes('incorrect')
                  ? 'bg-rose-50 border border-rose-200 text-rose-700'
                  : 'bg-emerald-50 border border-emerald-200 text-emerald-700'
              }`}>
                {feedbackMessage}
              </div>
            )}

            {/* VIEW MODE: Display Profile Details & Action Buttons */}
            {modalView === 'view' && (
              <div className="space-y-5">
                {/* Avatar and Info Card */}
                <div className="flex items-center gap-4 bg-slate-50 border border-slate-100 p-4 rounded-xl">
                  <Avatar className="w-14 h-14 border border-slate-200 shadow-sm">
                    <AvatarFallback className="bg-indigo-600 text-white text-lg font-bold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-base font-extrabold text-slate-900 truncate">{displayName}</p>
                    <p className="text-xs font-semibold text-blue-600">@{username || 'admin'}</p>
                  </div>
                </div>

                {/* Contact Details Section */}
                <div className="space-y-3 bg-slate-50/60 border border-slate-100 p-4 rounded-xl">
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Contact Details</p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 text-xs text-slate-700 font-medium">
                      <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="truncate">{contactEmail || 'Not specified'}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-700 font-medium">
                      <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>{contactNumber || 'Not specified'}</span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2.5 pt-2">
                  <button
                    onClick={() => setModalView('edit-profile')}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/20 text-slate-800 font-bold text-xs transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                        <Edit3 className="w-4 h-4" />
                      </div>
                      <span>Update Profile Details</span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-medium">Edit</span>
                  </button>

                  <button
                    onClick={() => setModalView('edit-password')}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/20 text-slate-800 font-bold text-xs transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
                        <Lock className="w-4 h-4" />
                      </div>
                      <span>Update Password</span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-medium">Secure</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsProfileModalOpen(false);
                      onLogout();
                    }}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-rose-200 hover:bg-rose-50 text-rose-600 font-bold text-xs transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center">
                        <LogOut className="w-4 h-4" />
                      </div>
                      <span>Sign Out</span>
                    </div>
                    <span className="text-[11px] text-rose-400 font-medium">Exit</span>
                  </button>
                </div>
              </div>
            )}

            {/* EDIT PROFILE VIEW */}
            {modalView === 'edit-profile' && (
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-900 font-medium focus:outline-none focus:border-blue-600 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Username</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      autoCapitalize="none"
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-900 font-medium focus:outline-none focus:border-blue-600 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Contact Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-900 font-medium focus:outline-none focus:border-blue-600 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Contact Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={contactNumber}
                      onChange={(e) => setContactNumber(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-900 font-medium focus:outline-none focus:border-blue-600 transition-all"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setModalView('view')}
                    disabled={isSaving}
                    className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-xs transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs transition-all shadow-md cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {isSaving ? 'Saving...' : 'Save Details'}
                  </button>
                </div>
              </form>
            )}

            {/* EDIT PASSWORD VIEW */}
            {modalView === 'edit-password' && (
              <form onSubmit={handleSavePassword} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Current Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-900 font-medium focus:outline-none focus:border-indigo-600 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={6}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-900 font-medium focus:outline-none focus:border-indigo-600 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Confirm New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={6}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-900 font-medium focus:outline-none focus:border-indigo-600 transition-all"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setModalView('view')}
                    disabled={isSaving}
                    className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-xs transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition-all shadow-md cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {isSaving ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </form>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}