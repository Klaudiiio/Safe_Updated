# SAFE User mobile app

This is the React Native user-side app for Expo Go. It shares Django's
registration and login API with the browser app and stores its session using
Expo SecureStore. Incident report data is submitted directly to Supabase. The
admin dashboard remains in `../frontend`.

## Run on a phone with Expo Go

1. Install Expo Go on the phone and connect the phone and development computer
   to the same Wi-Fi network.
2. Find the computer's Wi-Fi IPv4 address with `ipconfig` in PowerShell. Use
   the **IPv4 Address** under **Wireless LAN adapter Wi-Fi**, not the Default
   Gateway.
3. From the `mobile` folder, copy `.env.example` to `.env`:

   ```powershell
   if (-not (Test-Path .env)) { Copy-Item .env.example .env }
   notepad .env
   ```

   Set `EXPO_PUBLIC_API_URL` to
   `http://YOUR_WIFI_IPV4:8000/api/auth`. For example:

   ```dotenv
   EXPO_PUBLIC_API_URL=http://192.168.1.25:8000/api/auth
   EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
   ```

   Use the computer's Wi-Fi IPv4 address for Django and use your Supabase
   project's URL and publishable key. Do not use `localhost` or `127.0.0.1`
   for the Django API URL; those refer to the phone itself.
4. In a backend terminal, apply Django migrations and start Django listening
   on the network interface:

   ```powershell
   cd C:\Users\W\Downloads\Safe\backend
   .\venv\Scripts\python.exe manage.py migrate
   $env:DJANGO_ALLOWED_HOSTS="localhost,127.0.0.1,192.168.1.25"
   .\venv\Scripts\python.exe manage.py runserver 0.0.0.0:8000
   ```

   Replace the example address with the same Wi-Fi IPv4 address. Set
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and
   `SUPABASE_JWT_SECRET` in the Django process environment. The values are
   described in the project [README](../README.md).
   If the phone cannot reach Django, check Windows Firewall. On a trusted
   Wi-Fi network, use an elevated PowerShell to set the network to Private and
   add the scoped `SAFE Django API 8000 (Local Subnet)` rule shown in the
   project README.
5. In another terminal, start Expo:

   ```powershell
   cd C:\Users\W\Downloads\Safe\mobile
   npm install
   npx expo start -c
   ```

6. Scan Expo's QR code using Expo Go. If the device cannot connect, ensure both
   devices are on the same Wi-Fi, check the firewall, and restart Expo with
   `npx expo start -c` after changing `.env`.

## Supabase setup

For a new Supabase project, run `backend/supabase/migrations/0001_initial_schema.sql`
and then `backend/supabase/migrations/0002_client_data_access.sql` in the
Supabase SQL Editor. If the initial schema was already applied, run only
`0002_client_data_access.sql`. It adds direct-client RLS policies and seeds
the incident types required by the report form.

Django remains the authentication source and mirrors user profiles to
Supabase. It issues the short-lived access token using the Supabase project's
active legacy HS256 JWT signing secret. The mobile app uses the public
publishable key and that role-scoped token. Report submissions go directly to
Supabase; the app never uses the Secret API key or calls Django to save a
report.

## Current functionality

- Register and sign in using the Django API.
- Persist the access/refresh session locally with Expo SecureStore.
- Submit an incident report directly to Supabase with a selected incident
  type, written description, and manually entered location.
- See the saved report number and status after Supabase confirms the insert.
- Sign out and clear the locally stored session.

No responder notification or emergency-service dispatch is sent. The app does
not collect GPS or capture audio/video. Do not rely on it for emergency
assistance; contact local emergency services or the school clinic directly.
