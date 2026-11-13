import logging
import requests
from django.conf import settings

logger = logging.getLogger(__name__)

class SupabaseNotConfigured(Exception):
    pass

class SupabaseRequestFailed(Exception):
    def __init__(self, detail):
        self.detail = detail
        super().__init__(detail)


def sync_user_to_supabase(user, profile):
    supabase_url = getattr(settings, 'SUPABASE_URL', '')
    service_role_key = getattr(settings, 'SUPABASE_SERVICE_ROLE_KEY', '')
    table_name = getattr(settings, 'SUPABASE_USERS_TABLE', 'user')

    if not supabase_url or not service_role_key:
        raise SupabaseNotConfigured("Supabase URL or Service Role Key is not configured in Django settings.")

    endpoint = f"{supabase_url.rstrip('/')}/rest/v1/{table_name}?on_conflict=user_id"
   
    headers = {
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",  # Upsert matching records
    }

    # Map Django user and profile data to your Supabase table columns including email
    payload = {
        "user_id": user.id,
        "username": user.username,
        "email": user.email,
        "name": getattr(profile, 'name', ''),
        "student_id": getattr(profile, 'student_id', ''),
        "course": getattr(profile, 'course', ''),
        "phone_number": getattr(profile, 'phone_number', ''),
        "user_type": getattr(profile, 'role', 'USER'),
    }

    try:
        # 1. Attempt UPSERT via POST
        response = requests.post(endpoint, json=payload, headers=headers, timeout=10)
       
        # 2. If POST fails or hits a primary/unique key constraint mismatch, fallback to PATCH by username
        if response.status_code not in [200, 201, 204]:
            logger.warning("Upsert returned status %s (%s). Attempting fallback PATCH by username...", response.status_code, response.text)
           
            patch_endpoint = f"{supabase_url.rstrip('/')}/rest/v1/{table_name}?username=eq.{user.username}"
            patch_headers = {
                "apikey": service_role_key,
                "Authorization": f"Bearer {service_role_key}",
                "Content-Type": "application/json",
                "Prefer": "return=representation"
            }
            response = requests.patch(patch_endpoint, json=payload, headers=patch_headers, timeout=10)

        if response.status_code not in [200, 201, 204]:
            logger.error("Supabase sync completely failed with status %s: %s", response.status_code, response.text)
            raise SupabaseRequestFailed(f"Supabase returned status {response.status_code}: {response.text}")
           
    except requests.exceptions.RequestException as e:
        logger.error("Network error while syncing user to Supabase: %s", str(e))
        raise SupabaseRequestFailed(f"Network error: {str(e)}")