import { useEffect, useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router';
import {
  LayoutDashboard,
  AlertCircle,
  FileText,
  MapPin,
  Users,
  UsersRound,
  ScrollText,
  Bell,
  Settings,
  Search,
  Shield,
  Menu,
  X,
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

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: AlertCircle, label: 'Active Incidents', path: '/active-incidents' },
  { icon: FileText, label: 'Emergency Reports', path: '/emergency-reports' },
  { icon: MapPin, label: 'Map Tracking', path: '/map-tracking' },
  { icon: Users, label: 'Responders', path: '/responders' },
  { icon: UsersRound, label: 'Users', path: '/users' },
  { icon: ScrollText, label: 'Incident Logs', path: '/incident-logs' },
  { icon: Bell, label: 'Notifications', path: '/notifications' },
  { icon: Settings, label: 'Settings', path: '/settings' },
];

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  path: string;
  isRead: boolean;
}

interface DashboardLayoutProps {
  displayName: string;
  onLogout: () => void;
}

export function DashboardLayout({ displayName, onLogout }: DashboardLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const location = useLocation();
  const initials = displayName.slice(0, 2).toUpperCase();

  // Notification State
  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: '1',
      title: 'New Incident Reported',
      message: 'A medical emergency report was submitted near Campus Main Gate.',
      time: '2m ago',
      path: '/active-incidents',
      isRead: false,
    },
    {
      id: '2',
      title: 'Responder Dispatched',
      message: 'Unit 4 responded to medical alert #1042.',
      time: '15m ago',
      path: '/responders',
      isRead: false,
    },
    {
      id: '3',
      title: 'System Status Normal',
      message: 'Django and Supabase synchronization status verified.',
      time: '1h ago',
      path: '/emergency-reports',
      isRead: false,
    },
  ]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

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
    <div className="min-h-screen bg-[#0B1220]">
      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 z-40 h-screen transition-transform ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } w-64 bg-[#0F1825] border-r border-gray-800`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 p-6 border-b border-gray-800">
          <div className="w-10 h-10 bg-gradient-to-br from-[#FF3B30] to-[#3B82F6] rounded-lg flex items-center justify-center">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-white text-lg">SAFE</h1>
            <p className="text-xs text-gray-400">Emergency Monitor</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="max-h-[calc(100vh-220px)] overflow-y-auto p-4 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
           
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-[#FF3B30]/20 to-[#3B82F6]/20 text-white border border-[#FF3B30]/30'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* System Status */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-800 bg-[#0F1825]">
          <div className="flex items-center gap-2 px-3 py-2 bg-[#22C55E]/10 rounded-lg border border-[#22C55E]/30">
            <div className="w-2 h-2 bg-[#22C55E] rounded-full animate-pulse"></div>
            <span className="text-sm text-[#FACC15] font-medium">Demo Preview</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className={`transition-all ${isSidebarOpen ? 'ml-64' : 'ml-0'}`}>
        {/* Top Navigation */}
        <header className="sticky top-0 z-30 bg-[#0F1825]/95 backdrop-blur-sm border-b border-gray-800">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-4 flex-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="text-gray-400 hover:text-white"
              >
                {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </Button>

              <div className="relative w-full max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  type="search"
                  placeholder="Search incidents, responders, locations..."
                  className="pl-10 bg-[#0B1220] border-gray-800 text-white placeholder:text-gray-500 focus:border-[#3B82F6]"
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Date & Time */}
              <div className="hidden lg:flex items-center gap-4 text-sm text-gray-400">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>{currentDate}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span>{currentTime}</span>
                </div>
              </div>

              {/* Notifications Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="relative text-gray-400 hover:text-white focus:outline-none"
                  >
                    <Bell className="w-5 h-5" />
                    {unreadCount > 0 && (
                      <Badge className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center p-0 bg-[#FF3B30] text-white text-xs border-2 border-[#0F1825]">
                        {unreadCount}
                      </Badge>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80 bg-[#0F1825] border-gray-800 text-white">
                  <DropdownMenuLabel className="flex justify-between items-center py-3">
                    <span className="font-semibold text-sm">Notifications</span>
                    {unreadCount > 0 ? (
                      <button
                        onClick={markAllAsRead}
                        className="flex items-center gap-1 text-xs text-[#3B82F6] hover:underline cursor-pointer"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        Mark all as read
                      </button>
                    ) : (
                      <span className="text-xs text-gray-500">All read</span>
                    )}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-gray-800" />
                  
                  <div className="max-h-72 overflow-y-auto divide-y divide-gray-800/50">
                    {notifications.map((item) => (
                      <DropdownMenuItem key={item.id} asChild>
                        <Link
                          to={item.path}
                          onClick={() => markAsRead(item.id)}
                          className={`flex flex-col items-start gap-1 p-3 transition-colors cursor-pointer ${
                            item.isRead
                              ? 'opacity-60 bg-transparent hover:bg-gray-800/40 text-gray-400'
                              : 'bg-gray-800/20 hover:bg-gray-800 text-gray-200 font-medium'
                          }`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-2">
                              {!item.isRead && (
                                <span className="w-2 h-2 rounded-full bg-[#FF3B30]" />
                              )}
                              <span className={`text-sm ${item.isRead ? 'text-gray-300' : 'text-white font-semibold'}`}>
                                {item.title}
                              </span>
                            </div>
                            <span className="text-[10px] text-gray-400">{item.time}</span>
                          </div>
                          <p className="text-xs text-gray-400 line-clamp-2 pl-4">
                            {item.message}
                          </p>
                        </Link>
                      </DropdownMenuItem>
                    ))}
                  </div>

                  <DropdownMenuSeparator className="bg-gray-800" />
                  <DropdownMenuItem asChild>
                    <Link 
                      to="/notifications" 
                      className="w-full text-center text-xs font-semibold text-[#3B82F6] hover:underline justify-center py-2 focus:bg-gray-800 focus:text-[#3B82F6]"
                    >
                      View All Notifications
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Profile */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="bg-gradient-to-br from-[#FF3B30] to-[#3B82F6] text-white text-sm">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="hidden md:block text-left">
                      <p className="text-sm font-medium text-white">{displayName}</p>
                      <p className="text-xs text-gray-400">Administrator</p>
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-[#0F1825] border-gray-800">
                  <DropdownMenuLabel className="text-white">My Account</DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-gray-800" />
                  <DropdownMenuItem className="text-gray-300 focus:text-white focus:bg-gray-800">
                    Profile Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-gray-300 focus:text-white focus:bg-gray-800">
                    Preferences
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-gray-800" />
                  <DropdownMenuItem
                    onClick={onLogout}
                    className="text-[#FF3B30] focus:text-[#FF3B30] focus:bg-gray-800"
                  >
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
    </div>
  );
}