import logging
from typing import Any
from django.conf import settings
import requests


logger = logging.getLogger(__name__)


class SupabaseNotConfigured(Exception):
    pass


class SupabaseRequestFailed(Exception):
    def __init__(self, detail):
        self.detail = detail
        super().__init__(detail)


def _supabase_headers(
    service_role_key: str | None = None,
    *,
    prefer: str = "resolution=merge-duplicates",
    content_type: str = "application/json",
) -> dict[str, str]:
    key = (service_role_key if service_role_key is not None else getattr(settings, "SUPABASE_SERVICE_ROLE_KEY", "")).strip()
    headers: dict[str, str] = {
        "apikey": key,
    }
    # New `sb_secret_` / `sb_publishable_` keys are sent via `apikey`; JWT keys also use `Bearer`
    if key and not key.startswith("sb_"):
        headers["Authorization"] = f"Bearer {key}"
    if content_type:
        headers["Content-Type"] = content_type
    if prefer:
        headers["Prefer"] = prefer
    return headers


def supabase_request(
    method: str,
    table_or_path: str,
    *,
    params: dict[str, Any] | None = None,
    payload: Any = None,
    prefer: str = "resolution=merge-duplicates",
    timeout: float = 10.0,
) -> requests.Response:
    supabase_url = getattr(settings, "SUPABASE_URL", "").strip().rstrip("/")
    service_role_key = getattr(settings, "SUPABASE_SERVICE_ROLE_KEY", "").strip()

    if not supabase_url or not service_role_key:
        raise SupabaseNotConfigured("Supabase URL or Service Role Key is not configured in Django settings.")

    clean_path = table_or_path.lstrip("/")
    if clean_path.startswith("rest/v1/"):
        url = f"{supabase_url}/{clean_path}"
    else:
        url = f"{supabase_url}/rest/v1/{clean_path}"

    headers = _supabase_headers(service_role_key, prefer=prefer)

    try:
        response = requests.request(
            method=method.upper(),
            url=url,
            params=params,
            json=payload,
            headers=headers,
            timeout=timeout,
        )
    except requests.exceptions.RequestException as e:
        logger.error("Network error during Supabase %s %s: %s", method.upper(), clean_path, str(e))
        raise SupabaseRequestFailed(f"Network error: {str(e)}")

    return response


def sync_user_to_supabase(user, profile):
    supabase_url = getattr(settings, "SUPABASE_URL", "").strip().rstrip("/")
    service_role_key = getattr(settings, "SUPABASE_SERVICE_ROLE_KEY", "").strip()
    table_name = getattr(settings, "SUPABASE_USERS_TABLE", "user")

    if not supabase_url or not service_role_key:
        raise SupabaseNotConfigured("Supabase URL or Service Role Key is not configured in Django settings.")

    endpoint = f"{supabase_url}/rest/v1/{table_name}?on_conflict=user_id"
    headers = _supabase_headers(service_role_key, prefer="resolution=merge-duplicates")

    # Map Django user and profile data to your Supabase table columns including email
    payload = {
        "user_id": user.id,
        "username": user.username,
        "email": user.email,
        "name": getattr(profile, "name", ""),
        "student_id": getattr(profile, "student_id", ""),
        "course": getattr(profile, "course", ""),
        "phone_number": getattr(profile, "phone_number", ""),
        "user_type": getattr(profile, "role", "USER"),
    }

    try:
        # 1. Attempt UPSERT via POST
        response = requests.post(endpoint, json=payload, headers=headers, timeout=10)

        # 2. If POST fails or hits a primary/unique key constraint mismatch, fallback to PATCH by username
        if response.status_code not in [200, 201, 204]:
            logger.warning(
                "Upsert returned status %s (%s). Attempting fallback PATCH by username...",
                response.status_code,
                response.text,
            )

            patch_endpoint = f"{supabase_url}/rest/v1/{table_name}?username=eq.{user.username}"
            patch_headers = _supabase_headers(service_role_key, prefer="return=representation")
            response = requests.patch(patch_endpoint, json=payload, headers=patch_headers, timeout=10)

        if response.status_code not in [200, 201, 204]:
            logger.error("Supabase sync completely failed with status %s: %s", response.status_code, response.text)
            raise SupabaseRequestFailed(f"Supabase returned status {response.status_code}: {response.text}")

    except requests.exceptions.RequestException as e:
        logger.error("Network error while syncing user to Supabase: %s", str(e))
        raise SupabaseRequestFailed(f"Network error: {str(e)}")