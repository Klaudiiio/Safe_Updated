import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import AuthPage from './components/Authpage';

const AdminDashboard = lazy(() => import('./admin/AdminDashboard'));
const SESSION_EXPIRED_EVENT = 'safe:admin-session-expired';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => {
      const isAdminSession = Boolean(
        localStorage.getItem('access_token')
        && localStorage.getItem('user_role') === 'admin',
      );
      if (!isAdminSession) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('supabase_access_token');
        localStorage.removeItem('user_role');
        localStorage.removeItem('user_name');
      }
      return isAdminSession;
    },
  );

  const handleLogout = useCallback(() => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('supabase_access_token');
    localStorage.removeItem('user_role');
    localStorage.removeItem('user_name');
    setIsAuthenticated(false);
  }, []);

  useEffect(() => {
    window.addEventListener(SESSION_EXPIRED_EVENT, handleLogout);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleLogout);
  }, [handleLogout]);

  if (!isAuthenticated) {
    return (
      <AuthPage
        onLoginSuccess={(data) => {
          if (data.user.role === 'admin') setIsAuthenticated(true);
        }}
      />
    );
  }

  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0B1220]" />}>
      <AdminDashboard
        displayName={localStorage.getItem('user_name') ?? 'Admin'}
        onLogout={handleLogout}
      />
    </Suspense>
  );
}
