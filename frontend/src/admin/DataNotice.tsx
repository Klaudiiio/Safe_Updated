import { isSupabaseRequestError } from './api';

interface DataNoticeProps {
  loading: boolean;
  error: string | null;
}

export function DataNotice({ loading, error }: DataNoticeProps) {
  if (!loading && !error) return null;

  return (
    <div
      role={error ? 'alert' : 'status'}
      className={`mb-5 rounded-xl border p-4 text-sm ${
        error
          ? 'border-amber-500/30 bg-amber-500/10 text-amber-100'
          : 'border-slate-700 bg-slate-800/50 text-slate-300'
      }`}
    >
      {error ?? 'Loading live Supabase data...'}
      {error && (
        <p className="mt-1 text-xs text-amber-200/80">
          {isSupabaseRequestError(error)
            ? 'Check the Supabase project URL, publishable key, applied client data migration, RLS policies, and admin sign-in.'
            : 'The dashboard could not load data. Check your connection and sign in again.'}
        </p>
      )}
    </div>
  );
}
