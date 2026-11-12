import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Lock, ShieldAlert, User, Mail, ArrowLeft, Send } from 'lucide-react';

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
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  // Login fields
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Forgot password field
  const [recoveryEmail, setRecoveryEmail] = useState('');

  // Clear username and password fields if tokens are wiped out (Sign Out detection)
  useEffect(() => {
    const checkAuthStatus = () => {
      const token = localStorage.getItem('access_token');
      if (!token) {
        setUsername('');
        setPassword('');
      }
    };

    checkAuthStatus();
    window.addEventListener('storage', checkAuthStatus);
    return () => window.removeEventListener('storage', checkAuthStatus);
  }, []);

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
        throw new Error('This web portal is for admin accounts only. Use the clinic staff portal for clinic access.');
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
      setPassword(''); // Clear password field immediately on failure
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      // Example endpoint request for password recovery
      const response = await fetch(`${API_BASE_URL}/password-reset/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: recoveryEmail }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error((data as any).detail || 'Failed to send password reset instructions.');
      }

      setSuccessMsg('Password reset instructions have been sent to your email address.');
      setRecoveryEmail('');
    } catch (resetError: unknown) {
      setError(resetError instanceof Error ? resetError.message : 'An unexpected error occurred.');
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
          <h1 className="text-2xl font-bold tracking-tight text-white">SAFE Portal</h1>
          <p className="text-sm text-slate-400 mt-1">
            {isForgotPassword ? 'Reset your admin password' : 'Admin and clinic staff sign in'}
          </p>
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

        {!isForgotPassword ? (
          /* LOGIN FORM */
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
                  placeholder="Enter your username"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-red-500 transition"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="admin-password" className="block text-xs font-medium text-slate-300">Password</label>
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotPassword(true);
                    setError('');
                    setSuccessMsg('');
                  }}
                  className="text-xs text-red-400 hover:text-red-300 transition font-medium focus:outline-none cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-red-500 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 focus:outline-none cursor-pointer"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-semibold rounded-xl text-sm transition shadow-lg shadow-red-600/20 disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Signing in...' : 'Sign in to Dashboard'}
            </button>
          </form>
        ) : (
          /* FORGOT PASSWORD FORM */
          <form onSubmit={handlePasswordReset} className="space-y-4">
            <div>
              <label htmlFor="recovery-email" className="block text-xs font-medium text-slate-300 mb-1">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="recovery-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={recoveryEmail}
                  onChange={(event) => setRecoveryEmail(event.target.value)}
                  placeholder="Enter your admin email"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-red-500 transition"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">
                We will email you instructions to reset your password.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-semibold rounded-xl text-sm transition shadow-lg shadow-red-600/20 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              {loading ? 'Sending Instructions...' : 'Send Reset Link'}
            </button>

            <button
              type="button"
              onClick={() => {
                setIsForgotPassword(false);
                setError('');
                setSuccessMsg('');
              }}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-sm transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Sign In
            </button>
          </form>
        )}

        <p className="text-center text-xs text-slate-500 mt-6">
          Admin accounts are created and managed by your system administrator.
        </p>
      </section>
    </main>
  );
}