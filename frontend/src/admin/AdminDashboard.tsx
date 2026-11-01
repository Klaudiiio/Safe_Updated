import { lazy, Suspense, useMemo } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { DashboardLayout } from './components/DashboardLayout';
import { ActiveIncidents } from './pages/ActiveIncidents';
import { EmergencyReports } from './pages/EmergencyReports';
import { IncidentLogs } from './pages/IncidentLogs';
import { MapTracking } from './pages/MapTracking';
import { Notifications } from './pages/Notifications';
import { Responders } from './pages/Responders';
import { Settings } from './pages/Settings';
import { Users } from './pages/Users';

const Dashboard = lazy(() =>
  import('./pages/Dashboard').then(({ Dashboard: component }) => ({ default: component })),
);

interface AdminDashboardProps {
  displayName: string;
  onLogout: () => void;
}

export default function AdminDashboard({ displayName, onLogout }: AdminDashboardProps) {
  const router = useMemo(
    () =>
      createBrowserRouter([
        {
          path: '/',
          element: <DashboardLayout displayName={displayName} onLogout={onLogout} />,
          children: [
            {
              index: true,
              element: (
                <Suspense fallback={<div className="text-sm text-gray-400">Loading dashboard...</div>}>
                  <Dashboard />
                </Suspense>
              ),
            },
            { path: 'active-incidents', element: <ActiveIncidents /> },
            { path: 'emergency-reports', element: <EmergencyReports /> },
            { path: 'map-tracking', element: <MapTracking /> },
            { path: 'responders', element: <Responders /> },
            { path: 'users', element: <Users /> },
            { path: 'incident-logs', element: <IncidentLogs /> },
            { path: 'notifications', element: <Notifications /> },
            { path: 'settings', element: <Settings /> },
          ],
        },
      ]),
    [displayName, onLogout],
  );

  return <RouterProvider router={router} />;
}
