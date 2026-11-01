import React, { useState } from 'react';
import { Lock, ShieldAlert, User } from 'lucide-react';

interface AuthPageProps {
  onLoginSuccess: (userData: AuthResponse) => void;
}

interface AuthResponse {
  access: string;
  refresh: string;
  supabase_access_token: string | null;
  supabase_synced?: boolean;
  sync_warning?: string | null;
  user: {
    id: number;
    username: string;
    email: string;
    role: 'user' | 'clinic_staff' | 'admin';
  };
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/auth';

export default function AuthPage({ onLoginSuccess }: AuthPageProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = (await response.json()) as AuthResponse & { detail?: string };

      if (!response.ok) {
        throw new Error(data.detail || 'Invalid username or password.');
      }
      if (!data.access || !data.refresh || !data.user?.role) {
        throw new Error('The server returned an incomplete login response.');
      }
      if (data.user.role !== 'admin') {
        throw new Error('This web portal is for admin accounts only. Use the mobile app for user access.');
      }

      localStorage.setItem('access_token', data.access);
      localStorage.setItem('refresh_token', data.refresh);
      if (data.supabase_access_token) {
        localStorage.setItem('supabase_access_token', data.supabase_access_token);
      } else {
        localStorage.removeItem('supabase_access_token');
      }
      localStorage.setItem('user_role', data.user.role);
      localStorage.setItem('user_name', data.user.username);

      setSuccessMsg(
        data.supabase_synced === false
          ? `Signed in. ${data.sync_warning || 'Supabase profile sync is pending.'}`
          : 'Admin sign-in successful. Opening dashboard...',
      );
      window.setTimeout(() => onLoginSuccess(data), 700);
    } catch (submitError: unknown) {
      setError(submitError instanceof Error ? submitError.message : 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <section className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8">
        <header className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-red-500/10 text-red-500 mb-3 border border-red-500/20">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">SAFE Admin Portal</h1>
          <p className="text-sm text-slate-400 mt-1">Sign in to manage the safety dashboard</p>
        </header>

        {error && (
          <div role="alert" className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs">
            {error}
          </div>
        )}
        {successMsg && (
          <div role="status" className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 text-xs">
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="admin-username" className="block text-xs font-medium text-slate-300 mb-1">Username</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <User className="w-4 h-4" />
              </div>
              <input
                id="admin-username"
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Enter your admin username"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-red-500 transition"
              />
            </div>
          </div>

          <div>
            <label htmlFor="admin-password" className="block text-xs font-medium text-slate-300 mb-1">Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <Lock className="w-4 h-4" />
              </div>
              <input
                id="admin-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-red-500 transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-semibold rounded-xl text-sm transition shadow-lg shadow-red-600/20 disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign in to Admin Dashboard'}
          </button>
        </form>

        <p className="text-center text-xs text-slate-500 mt-6">
          Admin accounts are created and managed by your system administrator.
        </p>
      </section>
    </main>
  );
}
