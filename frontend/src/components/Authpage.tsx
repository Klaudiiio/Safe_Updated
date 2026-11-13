import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Lock, ShieldAlert, User, Mail, ArrowLeft, Send, CheckCircle2 } from 'lucide-react';

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
  const [viewState, setViewState] = useState<'signin' | 'request-reset' | 'verify-otp' | 'new-password'>('signin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
 
  // Login fields
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Forgot password flow fields
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

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
        throw new Error('Access denied. This portal is restricted to system administrators only.');
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

  // Stage 1: Request OTP
  const handleRequestReset = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/password-reset/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'email', target: recoveryEmail, admin_flow: true }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((data as any).detail || 'Failed to send verification code.');
      }

      setSuccessMsg('Verification code sent to your email.');
      setViewState('verify-otp');
    } catch (resetError: unknown) {
      setError(resetError instanceof Error ? resetError.message : 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  // Stage 2: Verify OTP
  const handleVerifyOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/verify-otp/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: recoveryEmail, otp: otpCode }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((data as any).detail || 'Invalid or expired OTP code.');
      }

      setSuccessMsg('OTP verified successfully. Please enter your new password.');
      setViewState('new-password');
    } catch (verifyError: unknown) {
      setError(verifyError instanceof Error ? verifyError.message : 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  // Stage 3: Confirm New Password
  const handleConfirmReset = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccessMsg('');

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    if (newPassword.trim().length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/confirm-password-reset/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: recoveryEmail, otp: otpCode, new_password: newPassword }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((data as any).detail || 'Failed to reset password.');
      }

      setSuccessMsg('Password reset successfully! Please sign in with your new password.');
      setViewState('signin');
      setRecoveryEmail('');
      setOtpCode('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (confirmError: unknown) {
      setError(confirmError instanceof Error ? confirmError.message : 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const getSubtitleText = () => {
    switch (viewState) {
      case 'request-reset': return 'Enter your email to receive a verification code';
      case 'verify-otp': return 'Enter the 6-digit verification code sent to your email';
      case 'new-password': return 'Choose a secure new password';
      default: return 'System Administrator Sign In';
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#0F0C29] via-[#24243E] to-[#302B63] flex items-center justify-center p-4 font-sans text-slate-100">
      <section className="w-full max-w-md bg-[#161230]/90 border border-indigo-950/80 rounded-3xl shadow-2xl p-8 backdrop-blur-xl">
        <header className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-500/10 text-indigo-400 mb-3 border border-indigo-500/20 shadow-inner">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">SAFE Admin Portal</h1>
          <p className="text-xs text-indigo-300/80 mt-1 font-medium">
            {getSubtitleText()}
          </p>
        </header>

        {error && (
          <div role="alert" className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs font-medium">
            {error}
          </div>
        )}
        {successMsg && (
          <div role="status" className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {viewState === 'signin' && (
          /* LOGIN FORM */
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="admin-username" className="block text-xs font-bold text-indigo-200 uppercase tracking-wider mb-1">Admin Username</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-indigo-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="admin-username"
                  type="text"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="Enter admin username"
                  className="w-full pl-10 pr-4 py-3 bg-[#0d0a20] border border-indigo-950 rounded-2xl text-white placeholder-indigo-400/50 text-sm focus:outline-none focus:bg-[#0d0a20] focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition shadow-inner font-medium"
                />
              </div>
            </div>

            <div>
              <label htmlFor="admin-password" className="block text-xs font-bold text-indigo-200 uppercase tracking-wider mb-1">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-indigo-400">
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
                  className="w-full pl-10 pr-10 py-3 bg-[#0d0a20] border border-indigo-950 rounded-2xl text-white placeholder-indigo-400/50 text-sm focus:outline-none focus:bg-[#0d0a20] focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition shadow-inner font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-indigo-400 hover:text-indigo-200 focus:outline-none cursor-pointer"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex justify-end mt-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setViewState('request-reset');
                    setError('');
                    setSuccessMsg('');
                  }}
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition font-bold focus:outline-none cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-extrabold rounded-2xl text-sm transition shadow-lg shadow-indigo-600/30 disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Signing in...' : 'Sign in to Admin Dashboard'}
            </button>
          </form>
        )}

        {viewState === 'request-reset' && (
          /* STAGE 1: REQUEST EMAIL OTP */
          <form onSubmit={handleRequestReset} className="space-y-4">
            <div>
              <label htmlFor="recovery-email" className="block text-xs font-bold text-indigo-200 uppercase tracking-wider mb-1">Admin Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-indigo-400">
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
                  className="w-full pl-10 pr-4 py-3 bg-[#0d0a20] border border-indigo-950 rounded-2xl text-white placeholder-indigo-400/50 text-sm focus:outline-none focus:bg-[#0d0a20] focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition shadow-inner font-medium"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-extrabold rounded-2xl text-sm transition shadow-lg shadow-indigo-600/30 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              {loading ? 'Sending Code...' : 'Send Verification Code'}
            </button>

            <button
              type="button"
              onClick={() => {
                setViewState('signin');
                setError('');
                setSuccessMsg('');
              }}
              className="w-full py-3 bg-[#1e1940] hover:bg-[#282156] text-indigo-200 font-bold rounded-2xl text-sm transition flex items-center justify-center gap-2 cursor-pointer border border-indigo-950"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Sign In
            </button>
          </form>
        )}

        {viewState === 'verify-otp' && (
          /* STAGE 2: VERIFY OTP CODE */
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <label htmlFor="otp-code" className="block text-xs font-bold text-indigo-200 uppercase tracking-wider mb-1">Verification Code (OTP)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-indigo-400">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <input
                  id="otp-code"
                  type="text"
                  maxLength={6}
                  required
                  value={otpCode}
                  onChange={(event) => setOtpCode(event.target.value)}
                  placeholder="Enter 6-digit code"
                  className="w-full pl-10 pr-4 py-3 bg-[#0d0a20] border border-indigo-950 rounded-2xl text-white placeholder-indigo-400/50 text-sm tracking-widest focus:outline-none focus:bg-[#0d0a20] focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition shadow-inner font-bold"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-extrabold rounded-2xl text-sm transition shadow-lg shadow-indigo-600/30 disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Verifying...' : 'Verify Code'}
            </button>

            <button
              type="button"
              onClick={() => {
                setViewState('request-reset');
                setError('');
                setSuccessMsg('');
              }}
              className="w-full py-3 bg-[#1e1940] hover:bg-[#282156] text-indigo-200 font-bold rounded-2xl text-sm transition flex items-center justify-center gap-2 cursor-pointer border border-indigo-950"
            >
              <ArrowLeft className="w-4 h-4" />
              Resend Code / Change Email
            </button>
          </form>
        )}

        {viewState === 'new-password' && (
          /* STAGE 3: ENTER & CONFIRM NEW PASSWORD */
          <form onSubmit={handleConfirmReset} className="space-y-4">
            <div>
              <label htmlFor="new-password" className="block text-xs font-bold text-indigo-200 uppercase tracking-wider mb-1">New Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-indigo-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="new-password"
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full pl-10 pr-10 py-3 bg-[#0d0a20] border border-indigo-950 rounded-2xl text-white placeholder-indigo-400/50 text-sm focus:outline-none focus:bg-[#0d0a20] focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition shadow-inner font-medium"
                />
              </div>
            </div>

            <div>
              <label htmlFor="confirm-password" className="block text-xs font-bold text-indigo-200 uppercase tracking-wider mb-1">Confirm New Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-indigo-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="confirm-password"
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full pl-10 pr-10 py-3 bg-[#0d0a20] border border-indigo-950 rounded-2xl text-white placeholder-indigo-400/50 text-sm focus:outline-none focus:bg-[#0d0a20] focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition shadow-inner font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-indigo-400 hover:text-indigo-200 focus:outline-none cursor-pointer"
                  aria-label={showNewPassword ? "Hide password" : "Show password"}
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-extrabold rounded-2xl text-sm transition shadow-lg shadow-indigo-600/30 disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Resetting Password...' : 'Reset Password'}
            </button>
          </form>
        )}

        <p className="text-center text-xs text-indigo-300/60 mt-6 font-medium">
          Restricted access. Authorized administrators only.
        </p>
      </section>
    </main>
  );
}