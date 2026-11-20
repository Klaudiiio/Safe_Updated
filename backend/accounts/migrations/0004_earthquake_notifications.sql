-- 0004_earthquake_notifications.sql
-- Adds earthquake alert metadata, audience targeting, and deduplication support
-- to the existing `notification` table, and ensures `notification` is part of
-- the `supabase_realtime` publication.

ALTER TABLE public.notification
  ALTER COLUMN incident_id DROP NOT NULL;

ALTER TABLE public.notification
  ADD COLUMN IF NOT EXISTS sent_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS earthquake_event_id text,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS audience text,
  ADD COLUMN IF NOT EXISTS magnitude double precision,
  ADD COLUMN IF NOT EXISTS place text,
  ADD COLUMN IF NOT EXISTS distance_from_cdo_km double precision,
  ADD COLUMN IF NOT EXISTS dedup_key text;

-- Enforce valid target audiences when set (NULL allowed for non-earthquake/legacy notifications)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'notification_audience_check'
      AND conrelid = 'public.notification'::regclass
  ) THEN
    ALTER TABLE public.notification
      ADD CONSTRAINT notification_audience_check
      CHECK (audience IS NULL OR audience IN ('admin', 'clinic_staff'));
  END IF;
END
$$;

-- Unique index on dedup_key (e.g. "eq_alert:<external_event_id>:<audience>")
-- to prevent duplicate alert rows during feed refreshes or concurrent syncs.
CREATE UNIQUE INDEX IF NOT EXISTS notification_dedup_key_unique_idx
  ON public.notification (dedup_key)
  WHERE dedup_key IS NOT NULL;

-- Helpful indexes for filtering feed/inbox queries by audience and event
DROP INDEX IF EXISTS public.notification_audience_created_idx;

CREATE INDEX IF NOT EXISTS notification_audience_sent_idx
  ON public.notification (audience, sent_at DESC)
  WHERE audience IS NOT NULL;

CREATE INDEX IF NOT EXISTS notification_earthquake_event_id_idx
  ON public.notification (earthquake_event_id)
  WHERE earthquake_event_id IS NOT NULL;

-- Ensure `notification` is included in `supabase_realtime` publication for live updates
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notification'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notification;
  END IF;
END
$$;

-- Reload PostgREST schema cache so new columns/constraints are immediately visible
NOTIFY pgrst, 'reload schema';