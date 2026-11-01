import * as SecureStore from 'expo-secure-store';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import {
  authenticate,
  submitIncidentReport as submitIncidentReportRequest,
  syncProfile as syncProfileRequest,
  type AuthSession,
  type AuthUser,
  type IncidentReportPayload,
  type IncidentReportResponse,
} from '../lib/api';

const SESSION_KEY = 'safe-user-session';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  storageError: string | null;
  supabaseSynced: boolean | null;
  syncWarning: string | null;
  syncProfile: () => Promise<void>;
  submitIncidentReport: (payload: IncidentReportPayload) => Promise<IncidentReportResponse>;
  signIn: (username: string, password: string) => Promise<void>;
  signUp: (payload: Record<string, string>) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [storageError, setStorageError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    SecureStore.getItemAsync(SESSION_KEY)
      .then((stored) => {
        if (stored && active) setSession(JSON.parse(stored) as AuthSession);
      })
      .catch(() => {
        if (active) setStorageError('Could not restore the saved sign-in. Please sign in again.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const saveSession = useCallback(async (nextSession: AuthSession) => {
    try {
      await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(nextSession));
      setSession(nextSession);
      setStorageError(null);
    } catch {
      throw new Error('Could not securely save your session on this device. Please try again.');
    }
  }, []);

  const signIn = useCallback(async (username: string, password: string) => {
    await saveSession(await authenticate('login', { username, password }));
  }, [saveSession]);

  const signUp = useCallback(async (payload: Record<string, string>) => {
    await saveSession(await authenticate('register', payload));
  }, [saveSession]);

  const syncProfile = useCallback(async () => {
    if (!session) throw new Error('Sign in before syncing your profile.');

    const result = await syncProfileRequest(session.access);
    await saveSession({
      ...session,
      supabase_synced: result.supabase_synced,
      sync_warning: result.sync_warning,
    });
  }, [session, saveSession]);

  const submitIncidentReport = useCallback(async (payload: IncidentReportPayload) => {
    if (!session) throw new Error('Sign in before submitting an incident report.');
    if (session.supabase_synced === false) {
      throw new Error('Your profile has not synced to Supabase, so a report cannot be linked to your account. Fix the Django Supabase profile configuration and sign in again.');
    }
    const result = await submitIncidentReportRequest(session, payload);
    if (result.session !== session) await saveSession(result.session);
    return result.report;
  }, [session, saveSession]);

  const signOut = useCallback(async () => {
    try {
      await SecureStore.deleteItemAsync(SESSION_KEY);
      setSession(null);
      setStorageError(null);
    } catch {
      throw new Error('Could not clear the saved session. Please try signing out again.');
    }
  }, []);

  const value = useMemo(() => ({
    user: session?.user ?? null,
    loading,
    storageError,
    supabaseSynced: typeof session?.supabase_synced === 'boolean' ? session.supabase_synced : null,
    syncWarning: session?.supabase_synced === false
      ? session.sync_warning ?? 'Your account is saved in Django, but its Supabase profile could not be synchronized yet.'
      : null,
    syncProfile,
    submitIncidentReport,
    signIn,
    signUp,
    signOut,
  }), [session, loading, storageError, signIn, signUp, signOut, syncProfile, submitIncidentReport]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}