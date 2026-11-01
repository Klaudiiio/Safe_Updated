import jwt
from django.conf import settings

class SupabaseTokenNotConfigured(Exception):
    pass


def create_supabase_access_token(user, profile):
    jwt_secret = getattr(settings, 'SUPABASE_JWT_SECRET', None)
    if not jwt_secret:
        raise SupabaseTokenNotConfigured("SUPABASE_JWT_SECRET is not configured in Django settings.")

    # Mandatory claims required by Supabase RLS and GoTrue
    payload = {
        "sub": str(user.id),
        "aud": "authenticated",
        "role": "authenticated",
        "email": user.email,
        "user_metadata": {
            "username": user.username,
            "name": getattr(profile, 'name', ''),
            "role": getattr(profile, 'role', 'USER'),
        }
    }

    token = jwt.encode(payload, jwt_secret, algorithm="HS256")
    return token