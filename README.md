# SAFE project

SAFE has three parts to run during development:

- **Django backend** for registration, login, and mirroring user profiles.
- **Admin web dashboard** in `frontend`.
- **User mobile app** in `mobile`, run with Expo Go.

Incident reports are submitted directly from the mobile app to Supabase, and
the admin dashboard reads Supabase directly. Django issues short-lived,
role-scoped Supabase access tokens after authentication. The Supabase Secret
API key and JWT signing key remain on the Django server. Reports include an
incident type, written description, and manually entered location; no responder
alert or emergency-service dispatch is sent.

Use separate PowerShell terminals. Run commands from the project root
`C:\Users\W\Downloads\Safe`; adjust the path if you put the project elsewhere.

## Find your computer's Wi-Fi IP address

For Expo Go on a physical phone, run this in PowerShell:

```powershell
ipconfig
```

Find **IPv4 Address** under **Wireless LAN adapter Wi-Fi** (for example,
`192.168.1.25`). Use this address in two places:

1. In Terminal 1, set `DJANGO_ALLOWED_HOSTS` to include it before starting
   Django.
2. In `C:\Users\W\Downloads\Safe\mobile\.env`, set
   `EXPO_PUBLIC_API_URL=http://YOUR_IP:8000/api/auth`.

Replace `YOUR_IP` with the IPv4 address you found. Do not use the Default
Gateway, `localhost`, or `127.0.0.1` for the phone's Django API URL.

## Configure Supabase

For a new Supabase project, run these SQL files in order in the Supabase SQL
Editor:

1. `backend\supabase\migrations\0001_initial_schema.sql`
2. `backend\supabase\migrations\0002_client_data_access.sql`

The second migration seeds the app's incident types and adds role-scoped RLS
policies for direct mobile and admin-web data access. It is safe to apply more
than once. If you already ran the initial schema migration, run only
`0002_client_data_access.sql`; do not re-run the table-creating `0001` file.

Before starting Django, set the project URL, server-only API Secret key, and
the project's active legacy HS256 JWT signing secret in the same PowerShell
terminal. The `SUPABASE_SERVICE_ROLE_KEY` mirrors Django user profiles; it is
not the JWT signing key.

```powershell
$env:SUPABASE_URL="https://YOUR_PROJECT_REF.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVER_ONLY_SUPABASE_SECRET_KEY"
$env:SUPABASE_JWT_SECRET="YOUR_LEGACY_SUPABASE_JWT_SIGNING_SECRET"
```

The Supabase project must still accept tokens signed with this legacy HS256 JWT
secret. If the key has been revoked or the project no longer accepts it, token
issuance must be adapted to a signing key trusted by the project before direct
client access can work. Store all secrets only in the Django process
environment or a secret manager. Do not use an `sb_secret_...` API key as the
JWT signing secret. Django does not automatically load
`backend\.env.example`.

## 1. Start Django

In Terminal 1:

```powershell
cd C:\Users\W\Downloads\Safe\backend
.\venv\Scripts\python.exe manage.py migrate
$env:DJANGO_ALLOWED_HOSTS="localhost,127.0.0.1,192.168.1.14"
.\venv\Scripts\python.exe manage.py runserver 0.0.0.0:8000
```

Replace `192.168.1.25` with your actual Wi-Fi IPv4 address. The server is
available on this computer at `http://127.0.0.1:8000`; binding to `0.0.0.0`
lets a phone on the same Wi-Fi reach the API. If Windows Firewall prompts,
allow the backend virtual-environment Python on the private network. If the
phone still cannot connect, and this is a trusted Wi-Fi network, open
PowerShell as Administrator and run:

```powershell
Set-NetConnectionProfile -InterfaceAlias "Wi-Fi" -NetworkCategory Private
New-NetFirewallRule -DisplayName "SAFE Django API 8000 (Local Subnet)" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8000 -Program "C:\Users\W\Downloads\Safe\backend\venv\Scripts\python.exe" -RemoteAddress LocalSubnet -Profile Private
```

This allows only the backend Python executable, TCP port 8000, and devices on
the local subnet. Do not mark an untrusted public hotspot as Private. You do
not need to edit `backend\config\settings.py`.

The built-in Django administration site is at
`http://127.0.0.1:8000/admin/`. Sign in with a Django superuser.

## 2. Start the admin web dashboard

In Terminal 2:

```powershell
cd C:\Users\W\Downloads\Safe\frontend
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
notepad .env
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env` to your
Supabase project URL and client-safe publishable key. Never use the Secret API
key or JWT signing key in this file. Then run:

```powershell
npm install
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`, and sign
in with an account whose SAFE profile role is `admin`. The web portal is for
admins only; regular users should use the mobile app.

## 3. Start the user mobile app in Expo Go

In Terminal 3, create and edit the local environment file:

```powershell
cd C:\Users\W\Downloads\Safe\mobile
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
notepad .env
```

Set `EXPO_PUBLIC_API_URL` to your computer's Wi-Fi IPv4 address. For example:

```dotenv
EXPO_PUBLIC_API_URL=http://192.168.1.25:8000/api/auth
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
```

Use the same Supabase project URL and publishable key as in the frontend
configuration. The publishable key is intended for clients. Never add the
Supabase Secret API key or JWT signing key to mobile `.env`.

Then start Expo:

```powershell
npm install
npx expo start -c
```

Install Expo Go on the phone, connect the phone and computer to the same Wi-Fi,
and scan the QR code. Restart Expo with `npx expo start -c` after changing
`.env`. Use the same IPv4
address in `DJANGO_ALLOWED_HOSTS` and the mobile API URL.

## Admin account

Create a Django superuser if you do not already have an admin account:

```powershell
cd C:\Users\W\Downloads\Safe\backend
.\venv\Scripts\python.exe manage.py createsuperuser
```

The web dashboard checks the SAFE profile role, which must be `admin`. Assign
that role in Django admin under the user profile. Do not use a simple or shared
password outside local testing.

If a Supabase credential has been shared in chat or another public channel,
rotate it before configuring the backend.

To mirror existing Django accounts after configuring Supabase:

```powershell
cd C:\Users\W\Downloads\Safe\backend
.\venv\Scripts\python.exe manage.py sync_users_to_supabase
```
