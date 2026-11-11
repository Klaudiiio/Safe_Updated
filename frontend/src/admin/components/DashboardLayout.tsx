import { useEffect, useState } from 'react';
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
  CheckCheck
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Badge } from './ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { useAdminData } from '../useAdminData';

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

export function DashboardLayout({ displayName, onLogout }: DashboardLayoutProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [isRinging, setIsRinging] = useState(false);
 
  // Safe location fallback in case router context is momentarily absent during hot reloads
  const location = useLocation();
  const currentPath = location?.pathname || '/';

  const initials = (displayName || 'Admin').slice(0, 2).toUpperCase();

  // Fetch live notifications directly from Supabase via useAdminData
  const { notifications: rawNotifications } = useAdminData();

  // Local state to manage read/unread states instantly in the UI dropdown
  const [readMap, setReadMap] = useState<Record<string, boolean>>({});

  const notifications = (rawNotifications || []).map((n: Record<string, any>) => {
    const id = String(n.notification_id || n.id);
    const isRead = readMap[id] ?? Boolean(n.is_read || n.read || false);
    return {
      id,
      title: n.title || 'System Alert',
      message: n.message || n.content || '',
      time: n.sent_at || n.time
        ? new Date(n.sent_at || n.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : 'Recent',
      path: '/notifications',
      isRead,
    };
  });

  const unreadCount = notifications.filter((n: { isRead: boolean }) => !n.isRead).length;

  const markAsRead = (id: string) => {
    setReadMap((prev) => ({ ...prev, [id]: true }));
  };

  const markAllAsRead = () => {
    const newMap: Record<string, boolean> = {};
    notifications.forEach((n: { id: string }) => {
      newMap[n.id] = true;
    });
    setReadMap(newMap);
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
    <div className="min-h-screen bg-gradient-to-br from-[#FFF8E7] via-[#FFF3D6] to-[#FFE4B5]">
      {/* Sidebar - Hover Collapsible (w-16 collapsed, w-64 expanded) */}
      <aside
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`fixed left-0 top-0 z-40 h-screen transition-all duration-300 ease-in-out ${
          isHovered ? 'w-64' : 'w-16'
        } bg-gradient-to-r from-[#151130] via-[#1a153b] to-[#231e4d] border-r border-indigo-950/60 flex flex-col justify-between shadow-2xl shadow-slate-950/40 overflow-hidden`}
      >
        <div>
          {/* Logo / Header Brand - Clickable to return to Dashboard */}
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

          {/* Navigation */}
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

        {/* System Status / Footer badge */}
        <div className="p-3 border-t border-indigo-950/50 bg-[#110d26]">
          <div className="flex items-center gap-2 px-2.5 py-2 bg-white/10 rounded-lg border border-white/20 text-white overflow-hidden">
            <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse shrink-0"></div>
            <span className={`text-[11px] font-semibold tracking-wide whitespace-nowrap transition-opacity duration-200 ${isHovered ? 'opacity-100' : 'opacity-0 hidden'}`}>
              Demo Preview System
            </span>
          </div>
        </div>
      </aside>

      {/* Main Content (Dynamically adjusts margin based on hover state) */}
      <div className={`transition-all duration-300 ease-in-out ${isHovered ? 'ml-64' : 'ml-16'}`}>
        {/* Top Navigation */}
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
              {/* Date & Time */}
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

              {/* Notifications Dropdown (Bell Icon) */}
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
                <DropdownMenuContent align="end" className="w-80 bg-white border-indigo-100 text-slate-800 shadow-xl rounded-2xl">
                  <DropdownMenuLabel className="flex justify-between items-center py-3 px-4 border-b border-slate-100">
                    <span className="font-bold text-sm text-slate-900">Notifications</span>
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
                 
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                    {notifications.length > 0 ? (
                      notifications.map((item: { id: string; path: string; isRead: boolean; title: string; time: string; message: string }) => (
                        <DropdownMenuItem key={item.id} asChild>
                          <Link
                            to={item.path}
                            onClick={() => markAsRead(item.id)}
                            className={`flex flex-col items-start gap-1 p-3.5 transition-colors cursor-pointer ${
                              item.isRead
                                ? 'opacity-60 bg-transparent hover:bg-slate-50 text-slate-500'
                                : 'bg-indigo-50/60 hover:bg-indigo-50 text-slate-800 font-medium'
                            }`}
                          >
                            <div className="flex items-center justify-between w-full">
                              <div className="flex items-center gap-2">
                                {!item.isRead && (
                                  <span className="w-2 h-2 rounded-full bg-indigo-600" />
                                )}
                                <span className={`text-sm ${item.isRead ? 'text-slate-600' : 'text-slate-900 font-bold'}`}>
                                  {item.title}
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-400">{item.time}</span>
                            </div>
                            <p className="text-xs text-slate-500 line-clamp-2 pl-4">
                              {item.message}
                            </p>
                          </Link>
                        </DropdownMenuItem>
                      ))
                    ) : (
                      <div className="p-6 text-center text-xs text-slate-400">
                        No notifications found.
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

              {/* Profile */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2 cursor-pointer hover:bg-white/10 text-white rounded-xl">
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
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-white border-slate-100 shadow-xl rounded-2xl">
                  <DropdownMenuLabel className="text-slate-900 font-bold">My Account</DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-slate-100" />
                  <DropdownMenuItem className="text-slate-700 focus:text-slate-900 focus:bg-indigo-50 cursor-pointer font-medium">
                    Profile Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-slate-700 focus:text-slate-900 focus:bg-indigo-50 cursor-pointer font-medium">
                    Preferences
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-slate-100" />
                  <DropdownMenuItem
                    onClick={onLogout}
                    className="text-red-600 focus:text-red-700 focus:bg-red-50 cursor-pointer font-semibold"
                  >
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="min-h-[calc(100vh-4rem)] p-8 shadow-inner shadow-indigo-950/5">
          <Outlet />
        </main>
      </div>
    </div>
  );
}