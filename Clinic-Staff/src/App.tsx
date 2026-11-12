import { useState } from 'react';
import { Eye, EyeOff, HeartPulse, LockKeyhole, UserRound, Mail, ArrowLeft, Send } from 'lucide-react';
import ClinicStaffDashboard from './ClinicStaffDashboard';

interface AuthResponse {
  access: string;
  refresh: string;
  supabase_access_token: string | null;
  user: {
    id: number;
    username: string;
    role: string;
  };
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000/api/auth';

export default function App() {
  const [role, setRole] = useState(() => localStorage.getItem('clinic_staff_role'));
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  
  // Login fields
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Recovery field
  const [recoveryEmail, setRecoveryEmail] = useState('');

  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const signIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const response = await fetch(`${API_BASE_URL}/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json() as AuthResponse & { detail?: string };
      if (!response.ok) throw new Error(data.detail ?? 'Invalid username or password.');
      if (data.user.role !== 'clinic_staff') throw new Error('This portal is only for clinic staff accounts.');

      localStorage.setItem('clinic_staff_access_token', data.access);
      localStorage.setItem('clinic_staff_refresh_token', data.refresh);
      localStorage.setItem('clinic_staff_supabase_token', data.supabase_access_token ?? '');
      localStorage.setItem('clinic_staff_role', data.user.role);
      localStorage.setItem('clinic_staff_name', data.user.username);
      setRole(data.user.role);
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : 'Unable to sign in.');
      setPassword(''); // Clears the password field on failure
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
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
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'Unable to send recovery instructions.');
    } finally {
      setLoading(false);
    }
  };

  const signOut = () => {
    ['access_token', 'refresh_token', 'supabase_access_token', 'supabase_token', 'role', 'name']
      .forEach((key) => localStorage.removeItem(`clinic_staff_${key}`));
    setUsername(''); // Clear username on sign out
    setPassword(''); // Clear password on sign out
    setRole(null);
  };

  if (role === 'clinic_staff') {
    return (
      <ClinicStaffDashboard
        displayName={localStorage.getItem('clinic_staff_name') ?? username ?? 'Clinic Staff'}
        onLogout={signOut}
      />
    );
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand"><HeartPulse /></div>
        <h1>Clinic Staff Portal</h1>
        <p>
          {isForgotPassword ? 'Reset your clinic staff password' : 'Sign in to manage your assigned incidents and availability.'}
        </p>

        {error && <div className="login-error" role="alert">{error}</div>}
        {successMsg && (
          <div role="status" style={{ marginBottom: '16px', padding: '10px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', color: '#065f46', fontSize: '13px' }}>
            {successMsg}
          </div>
        )}

        {!isForgotPassword ? (
          /* LOGIN FORM */
          <form onSubmit={signIn}>
            <label htmlFor="username">Username</label>
            <div className="input-wrap">
              <UserRound />
              <input
                id="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
                autoComplete="username"
                placeholder="Enter your username"
              />
            </div>
           
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
              <label htmlFor="password" style={{ margin: 0 }}>Password</label>
              <button
                type="button"
                onClick={() => {
                  setIsForgotPassword(true);
                  setError('');
                  setSuccessMsg('');
                }}
                style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '12px', cursor: 'pointer', padding: 0 }}
              >
                Forgot password?
              </button>
            </div>

            <div
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                width: '100%',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                backgroundColor: '#fff',
                overflow: 'hidden',
                paddingLeft: '38px',
                paddingRight: '38px',
                marginTop: '6px'
              }}
            >
              <LockKeyhole
                size={18}
                style={{
                  position: 'absolute',
                  left: '12px',
                  color: '#94a3b8',
                  pointerEvents: 'none'
                }}
              />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                autoComplete="current-password"
                placeholder="Enter your password"
                style={{
                  width: '100%',
                  border: 'none',
                  outline: 'none',
                  padding: '10px 0',
                  fontSize: '14px',
                  background: 'transparent',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#64748b',
                  padding: '4px',
                }}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <button disabled={loading} type="submit" style={{ marginTop: '16px' }}>
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        ) : (
          /* FORGOT PASSWORD FORM */
          <form onSubmit={handlePasswordReset}>
            <label htmlFor="recovery-email">Email Address</label>
            <div
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                width: '100%',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                backgroundColor: '#fff',
                overflow: 'hidden',
                paddingLeft: '38px',
                marginTop: '6px',
                marginBottom: '12px'
              }}
            >
              <Mail
                size={18}
                style={{
                  position: 'absolute',
                  left: '12px',
                  color: '#94a3b8',
                  pointerEvents: 'none'
                }}
              />
              <input
                id="recovery-email"
                type="email"
                value={recoveryEmail}
                onChange={(event) => setRecoveryEmail(event.target.value)}
                required
                autoComplete="email"
                placeholder="Enter your staff email"
                style={{
                  width: '100%',
                  border: 'none',
                  outline: 'none',
                  padding: '10px 0',
                  fontSize: '14px',
                  background: 'transparent',
                }}
              />
            </div>

            <button disabled={loading} type="submit" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <Send size={16} />
              {loading ? 'Sending Instructions...' : 'Send Reset Link'}
            </button>

            <button
              type="button"
              onClick={() => {
                setIsForgotPassword(false);
                setError('');
                setSuccessMsg('');
              }}
              style={{
                marginTop: '10px',
                width: '100%',
                background: '#f1f5f9',
                color: '#334155',
                border: '1px solid #cbd5e1',
                padding: '10px',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontWeight: 500
              }}
            >
              <ArrowLeft size={16} />
              Back to Sign In
            </button>
          </form>
        )}
      </section>
    </main>
  );
}