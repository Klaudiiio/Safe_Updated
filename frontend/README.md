# SAFE frontend

The React/Vite frontend is the admin-only web dashboard. It includes admin
sign-in through Django and pages for incidents, responders, users,
notifications, and logs. Regular and clinic-staff accounts use the mobile app;
the web portal accepts only accounts with the `admin` role.

## Run locally

1. Start Django from `backend` with
   `.\venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000`.
2. Copy `.env.example` to `.env` and set `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_PUBLISHABLE_KEY`.
3. From this directory, run `npm install` and `npm run dev`.

For complete Windows setup steps for the Django backend, admin web dashboard,
and Expo Go mobile app, see the project [README](../README.md).

Vite proxies `/api` requests to Django at `http://127.0.0.1:8000`. Set
`VITE_API_BASE_URL` if the auth API is hosted at a different URL.

## Supabase dashboard data

The dashboard reads data directly from Supabase using the admin's short-lived
Supabase token issued after Django login. The browser uses only the project URL
and publishable key. Never put a Supabase Secret API key or JWT signing key in
frontend variables or browser code.

For a new Supabase project, apply
`../backend/supabase/migrations/0001_initial_schema.sql` and then
`../backend/supabase/migrations/0002_client_data_access.sql` in the Supabase
SQL Editor. If the initial schema was already applied, apply only
`0002_client_data_access.sql`. It seeds report categories and enables
restricted authenticated reads through RLS. Admin access is determined by the trusted
`app_role` claim in Django-issued tokens. Django continues to handle login and
profile mirroring; the Supabase `user` table contains no passwords.

The dashboard subscribes to new incident rows through Supabase Realtime and
also polls every 15 seconds as a fallback. Dashboard pages are read-only;
reports do not trigger notifications or contact emergency services. Do not
rely on the app for emergency assistance.
