-- Migration: 0003_earthquake_monitoring.sql
-- Place at: backend/supabase/migrations/0003_earthquake_monitoring.sql
-- Creates public.earthquake_monitoring for synced PHIVOLCS seismic events,
-- backend classification/intensity metadata, and hardware alert / acknowledgment state.

create table if not exists public.earthquake_monitoring (
    id bigint generated always as identity primary key,
    external_event_id text not null unique,
    magnitude numeric(4, 1) not null,
    place text not null,
    depth_km numeric(8, 2),
    distance_from_cdo_km numeric(8, 2) not null,
    reported_intensity text,
    classification text not null default 'monitoring',
    source text not null default 'PHIVOLCS',
    event_occurred_at timestamptz not null,
    evaluated_at timestamptz not null default now(),
    alert_active boolean not null default false,
    alert_detected_at timestamptz,
    alert_expires_at timestamptz,
    buzzer_enabled boolean not null default false,
    led_enabled boolean not null default false,
    led_color text not null default 'amber',
    alert_pattern text not null default 'pulse',
    acknowledged boolean not null default false,
    acknowledged_by integer,
    acknowledged_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint earthquake_monitoring_magnitude_check check (magnitude >= 0 and magnitude <= 12),
    constraint earthquake_monitoring_distance_check check (distance_from_cdo_km >= 0),
    constraint earthquake_monitoring_depth_check check (depth_km is null or depth_km >= -10),
    constraint earthquake_monitoring_classification_check check (
        classification in ('monitoring', 'advisory', 'earthquake_alert')
    ),
    constraint earthquake_monitoring_led_color_check check (
        led_color in ('off', 'green', 'amber', 'red', 'blue', 'white')
    ),
    constraint earthquake_monitoring_alert_pattern_check check (
        alert_pattern in ('none', 'steady', 'pulse', 'strobe')
    ),
    constraint earthquake_monitoring_ack_timestamp_check check (
        (not acknowledged) or (acknowledged_at is not null)
    ),
    constraint earthquake_monitoring_alert_expiry_check check (
        alert_expires_at is null
        or alert_detected_at is null
        or alert_expires_at >= alert_detected_at
    )
);

-- Ensure columns and constraints exist even if the table was already created earlier
alter table public.earthquake_monitoring
    add column if not exists reported_intensity text,
    add column if not exists classification text not null default 'monitoring',
    add column if not exists source text not null default 'PHIVOLCS',
    add column if not exists evaluated_at timestamptz not null default now(),
    add column if not exists alert_active boolean not null default false,
    add column if not exists alert_detected_at timestamptz,
    add column if not exists alert_expires_at timestamptz,
    add column if not exists buzzer_enabled boolean not null default false,
    add column if not exists led_enabled boolean not null default false,
    add column if not exists led_color text not null default 'amber',
    add column if not exists alert_pattern text not null default 'pulse',
    add column if not exists acknowledged boolean not null default false,
    add column if not exists acknowledged_by integer,
    add column if not exists acknowledged_at timestamptz,
    add column if not exists created_at timestamptz not null default now(),
    add column if not exists updated_at timestamptz not null default now();

alter table public.earthquake_monitoring
    drop constraint if exists earthquake_monitoring_classification_check;

alter table public.earthquake_monitoring
    add constraint earthquake_monitoring_classification_check
    check (classification in ('monitoring', 'advisory', 'earthquake_alert'));

alter table public.earthquake_monitoring
    drop constraint if exists earthquake_monitoring_alert_expiry_check;

alter table public.earthquake_monitoring
    add constraint earthquake_monitoring_alert_expiry_check
    check (
        alert_expires_at is null
        or alert_detected_at is null
        or alert_expires_at >= alert_detected_at
    );

create index if not exists idx_earthquake_monitoring_occurred_at
    on public.earthquake_monitoring (event_occurred_at desc);

create index if not exists idx_earthquake_monitoring_classification
    on public.earthquake_monitoring (classification, event_occurred_at desc);

create index if not exists idx_earthquake_monitoring_alert_active
    on public.earthquake_monitoring (alert_active, acknowledged)
    where alert_active = true;

create index if not exists idx_earthquake_monitoring_alert_expires_at
    on public.earthquake_monitoring (alert_expires_at)
    where alert_expires_at is not null;

create or replace function public.set_earthquake_monitoring_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    if new.evaluated_at is null then
        new.evaluated_at = now();
    end if;
    if new.acknowledged and new.acknowledged_at is null then
        new.acknowledged_at = now();
    elsif not new.acknowledged then
        new.acknowledged_by = null;
        new.acknowledged_at = null;
    end if;
    return new;
end;
$$;

drop trigger if exists trg_earthquake_monitoring_updated_at on public.earthquake_monitoring;
create trigger trg_earthquake_monitoring_updated_at
    before insert or update on public.earthquake_monitoring
    for each row
    execute function public.set_earthquake_monitoring_updated_at();

alter table public.earthquake_monitoring enable row level security;

-- Revoke broad public privileges and grant scoped access to authenticated users.
-- Django backend sync uses the service role key / database owner connection.
revoke all on table public.earthquake_monitoring from anon, authenticated;
grant select on table public.earthquake_monitoring to authenticated;
grant update (
    alert_active,
    alert_detected_at,
    alert_expires_at,
    buzzer_enabled,
    led_enabled,
    led_color,
    alert_pattern,
    acknowledged,
    acknowledged_by,
    acknowledged_at
) on table public.earthquake_monitoring to authenticated;

drop policy if exists earthquake_monitoring_select_authenticated on public.earthquake_monitoring;
create policy earthquake_monitoring_select_authenticated
    on public.earthquake_monitoring
    for select
    to authenticated
    using (true);

drop policy if exists earthquake_monitoring_update_authenticated on public.earthquake_monitoring;
create policy earthquake_monitoring_update_authenticated
    on public.earthquake_monitoring
    for update
    to authenticated
    using (true)
    with check (true);

-- Enable Supabase Realtime broadcasts for live dashboard and hardware updates
do $$
begin
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
        if not exists (
            select 1
            from pg_publication_tables
            where pubname = 'supabase_realtime'
              and schemaname = 'public'
              and tablename = 'earthquake_monitoring'
        ) then
            alter publication supabase_realtime add table public.earthquake_monitoring;
        end if;
    end if;
end
$$;

-- Reload PostgREST schema cache so new columns/indexes are immediately available
notify pgrst, 'reload schema';