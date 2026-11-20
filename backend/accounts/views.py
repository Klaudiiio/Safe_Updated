from datetime import timezone
import logging
import os
import random
import requests

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.models import User
from django.core.cache import cache
from django.core.mail import send_mail
from django.http import JsonResponse
from django.utils import timezone as dj_timezone
from rest_framework import generics, permissions, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from .earthquake_service import (
    build_hardware_alarm_state,
    create_and_sync_simulation_earthquake,
    create_earthquake_notifications_in_supabase,
    fetch_earthquakes_from_supabase,
    filter_events_for_feed,
    get_evaluated_earthquakes,
    get_min_feed_magnitude,
    get_ustp_cdo_coords,
    is_alert_currently_active,
    is_simulation_event,
    parse_event_timestamp,
    sync_alert_hardware_state,
    sync_earthquakes_to_supabase,
)
from .models import UserProfile
from .serializers import (
    AuthTokenSerializer,
    MobileAuthTokenSerializer,
    RegisterSerializer,
)
from .supabase_tokens import SupabaseTokenNotConfigured, create_supabase_access_token
from .utils import SupabaseNotConfigured, SupabaseRequestFailed, sync_user_to_supabase

logger = logging.getLogger(__name__)

# Cache-backed secure OTP constants (10 mins expiration, max 5 attempts)
OTP_EXPIRY_SECONDS = 600
MAX_ATTEMPTS = 5
SUPABASE_SYNC_ERROR_COOLDOWN_SECONDS = 60


def _event_dedup_key(event: dict) -> str:
    ext_id = event.get("external_event_id") or event.get("id")
    if ext_id:
        return str(ext_id).strip()
    occurred = event.get("event_occurred_at") or event.get("time") or ""
    place = str(event.get("place") or "").strip().lower()
    mag = event.get("magnitude")
    return f"fallback|{occurred}|{place}|{mag}"


def _event_sort_tuple(event: dict) -> tuple[float, float]:
    eval_dt = parse_event_timestamp(event.get("evaluated_at"))
    occ_dt = parse_event_timestamp(event.get("event_occurred_at") or event.get("time"))
    eval_ts = eval_dt.timestamp() if eval_dt else 0.0
    occ_ts = occ_dt.timestamp() if occ_dt else 0.0
    return (eval_ts, occ_ts)


def _merge_and_deduplicate_events(*event_lists: list[dict]) -> list[dict]:
    merged: dict[str, dict] = {}
    for event_list in event_lists:
        if not event_list:
            continue
        for ev in event_list:
            if not isinstance(ev, dict):
                continue
            key = _event_dedup_key(ev)
            existing = merged.get(key)
            if existing is None or _event_sort_tuple(ev) >= _event_sort_tuple(existing):
                merged[key] = ev

    result = list(merged.values())
    result.sort(
        key=lambda e: parse_event_timestamp(e.get("event_occurred_at") or e.get("time"))
        or parse_event_timestamp("1970-01-01T00:00:00Z"),
        reverse=True,
    )
    return result


def _enrich_event_alert_state(event: dict, now_utc=None) -> dict:
    current_utc = now_utc or dj_timezone.now().astimezone(timezone.utc)
    enriched = dict(event)
    detected_dt = parse_event_timestamp(enriched.get("alert_detected_at"))
    expires_dt = parse_event_timestamp(enriched.get("alert_expires_at"))
    acknowledged_dt = parse_event_timestamp(
        enriched.get("alert_acknowledged_at") or enriched.get("acknowledged_at")
    )

    enriched["alert_detected_at"] = (
        detected_dt.isoformat() if detected_dt else enriched.get("alert_detected_at")
    )
    enriched["alert_expires_at"] = (
        expires_dt.isoformat() if expires_dt else enriched.get("alert_expires_at")
    )
    enriched["acknowledged"] = bool(
        enriched.get("acknowledged", False) or acknowledged_dt is not None
    )
    if acknowledged_dt:
        enriched["alert_acknowledged_at"] = acknowledged_dt.isoformat()
    enriched["alert_active"] = is_alert_currently_active(enriched, now_utc=current_utc)
    return enriched


def _try_sync_earthquakes_throttled(events: list[dict], context_label: str) -> None:
    if not events:
        return
    error_cache_key = "earthquake_supabase_sync_error_cooldown"
    if cache.get(error_cache_key):
        return
    try:
        sync_earthquakes_to_supabase(events)
        cache.delete(error_cache_key)
    except Exception as sync_err:
        cache.set(error_cache_key, str(sync_err), timeout=SUPABASE_SYNC_ERROR_COOLDOWN_SECONDS)
        logger.warning(f"Earthquake Supabase sync failed ({context_label}): {str(sync_err)}")


def _safe_fetch_persisted_earthquakes() -> list[dict]:
    try:
        return fetch_earthquakes_from_supabase()
    except Exception as db_err:
        logger.warning(f"Failed to read persisted earthquakes from Supabase: {str(db_err)}")
        return []


def _is_clinic_staff_or_admin(user) -> bool:
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if getattr(user, "is_superuser", False) or getattr(user, "is_staff", False):
        return True
    profile = getattr(user, "profile", None)
    role = (getattr(profile, "role", "") or "").strip().lower()
    return role in {"clinic_staff", "admin"}


def _is_admin_user(user) -> bool:
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if getattr(user, "is_superuser", False) or getattr(user, "is_staff", False):
        return True
    profile = getattr(user, "profile", None)
    role = (getattr(profile, "role", "") or "").strip().lower()
    return role == "admin"


def _sync_user_profile_with_supabase(user, profile) -> tuple[bool, str | None]:
    try:
        sync_user_to_supabase(user, profile)
        return True, None
    except (SupabaseNotConfigured, SupabaseRequestFailed) as exc:
        err_str = getattr(exc, "detail", str(exc))
        lower_err = str(err_str).lower()
        if (
            "409" in lower_err
            or "already exists" in lower_err
            or "duplicate key value" in lower_err
            or "violates unique constraint" in lower_err
        ):
            return True, None
        return False, str(err_str)
    except Exception as exc:
        err_str = str(exc)
        lower_err = err_str.lower()
        if (
            "409" in lower_err
            or "already exists" in lower_err
            or "duplicate key value" in lower_err
            or "violates unique constraint" in lower_err
        ):
            return True, None
        return False, err_str


def _serialize_user_payload(user, profile) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "name": profile.name,
        "student_id": profile.student_id,
        "course": profile.course,
        "phone_number": profile.phone_number,
        "role": profile.role,
    }


class CreateClinicStaffView(APIView):
    """
    Allows admin users to create a clinic_staff account and sync its profile to Supabase.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if not _is_admin_user(request.user):
            return Response(
                {"detail": "Only admin users can create clinic staff accounts."},
                status=status.HTTP_403_FORBIDDEN,
            )

        data = request.data if isinstance(request.data, dict) else {}
        username = str(data.get("username") or "").strip()
        password = str(data.get("password") or "")
        email = str(data.get("email") or "").strip()

        if not username or not password:
            return Response(
                {"error": "Username and password are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(password.strip()) < 6:
            return Response(
                {"error": "Password must be at least 6 characters long."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if User.objects.filter(username=username).exists():
            return Response(
                {"error": "Username already taken."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if email and User.objects.filter(email=email).exists():
            return Response(
                {"error": "Email already registered."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        staff_user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            is_staff=True,
        )
        staff_profile, _ = UserProfile.objects.get_or_create(user=staff_user)
        staff_profile.name = str(data.get("name") or username).strip()
        staff_profile.student_id = str(data.get("student_id") or "").strip()
        staff_profile.course = str(data.get("course") or "").strip()
        staff_profile.phone_number = str(data.get("phone_number") or "").strip()
        staff_profile.role = "clinic_staff"
        staff_profile.save()

        supabase_synced, sync_warning = _sync_user_profile_with_supabase(staff_user, staff_profile)

        return Response(
            {
                "message": "Clinic staff account created successfully.",
                "supabase_synced": supabase_synced,
                "sync_warning": sync_warning,
                "user": _serialize_user_payload(staff_user, staff_profile),
            },
            status=status.HTTP_201_CREATED,
        )


class CreateUserView(APIView):
    """
    Allows admin users to create a standard/student user account and sync its profile to Supabase.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if not _is_admin_user(request.user):
            return Response(
                {"detail": "Only admin users can create user accounts."},
                status=status.HTTP_403_FORBIDDEN,
            )

        data = request.data if isinstance(request.data, dict) else {}
        username = str(data.get("username") or "").strip()
        password = str(data.get("password") or "")
        email = str(data.get("email") or "").strip()

        if not username or not password:
            return Response(
                {"error": "Username and password are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(password.strip()) < 6:
            return Response(
                {"error": "Password must be at least 6 characters long."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if User.objects.filter(username=username).exists():
            return Response(
                {"error": "Username already taken."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if email and User.objects.filter(email=email).exists():
            return Response(
                {"error": "Email already registered."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        requested_role = str(data.get("role") or "user").strip().lower()
        role = requested_role if requested_role in {"user", "student"} else "user"

        new_user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
        )
        new_profile, _ = UserProfile.objects.get_or_create(user=new_user)
        new_profile.name = str(data.get("name") or username).strip()
        new_profile.student_id = str(data.get("student_id") or "").strip()
        new_profile.course = str(data.get("course") or "").strip()
        new_profile.phone_number = str(data.get("phone_number") or "").strip()
        new_profile.role = role
        new_profile.save()

        supabase_synced, sync_warning = _sync_user_profile_with_supabase(new_user, new_profile)

        return Response(
            {
                "message": "User account created successfully.",
                "supabase_synced": supabase_synced,
                "sync_warning": sync_warning,
                "user": _serialize_user_payload(new_user, new_profile),
            },
            status=status.HTTP_201_CREATED,
        )


class EarthquakeFeedAPI(APIView):
    """
    Endpoint to return normalized, backend-classified PHIVOLCS earthquake events
    relative to USTP Cagayan de Oro, backed by and merged with persisted Supabase records.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        now_utc = dj_timezone.now().astimezone(timezone.utc)
        cdo_lat, cdo_lon = get_ustp_cdo_coords()
        radius_km = float(getattr(settings, 'EARTHQUAKE_REGIONAL_RADIUS_KM', 200.0))
        blind_zone_km = float(getattr(settings, 'EARTHQUAKE_BLIND_ZONE_RADIUS_KM', 15.0))
        cache_key = 'phivolcs_ustp_cdo_earthquakes'

        requested_min_mag_raw = request.query_params.get('min_magnitude')
        try:
            requested_min_mag = (
                float(requested_min_mag_raw)
                if requested_min_mag_raw is not None and str(requested_min_mag_raw).strip() != ''
                else get_min_feed_magnitude()
            )
        except ValueError:
            return Response(
                {'error': 'Invalid min_magnitude query parameter.'},
                status=400,
            )

        persisted_events = _safe_fetch_persisted_earthquakes()
        cached_data = cache.get(cache_key)

        if isinstance(cached_data, dict):
            cached_events = cached_data.get('events') or []
            merged_events = [
                _enrich_event_alert_state(ev, now_utc=now_utc)
                for ev in _merge_and_deduplicate_events(persisted_events, cached_events)
            ]
            _try_sync_earthquakes_throttled(merged_events, context_label='cached_feed')

            # Defaults to EARTHQUAKE_MIN_FEED_MAGNITUDE (M4.0) unless ?min_magnitude= is passed
            filtered_cached = filter_events_for_feed(
                merged_events,
                min_magnitude=requested_min_mag,
            )
            return JsonResponse(
                {
                    **cached_data,
                    'events': filtered_cached,
                    'min_magnitude_filter': requested_min_mag,
                },
                safe=False,
            )

        try:
            evaluated_events = get_evaluated_earthquakes()
            merged_events = [
                _enrich_event_alert_state(ev, now_utc=now_utc)
                for ev in _merge_and_deduplicate_events(persisted_events, evaluated_events)
            ]
            _try_sync_earthquakes_throttled(merged_events, context_label='live_feed')

            payload = {
                'center': {'latitude': cdo_lat, 'longitude': cdo_lon},
                'radius_km': radius_km,
                'blind_zone_km': blind_zone_km,
                'source': 'PHIVOLCS',
                'events': merged_events,
                'phivolcs_reference_url': 'https://www.phivolcs.dost.gov.ph/',
            }

            cache.set(cache_key, payload, 300)  # Cache full merged feed for 5 minutes
            filtered_events = filter_events_for_feed(merged_events, min_magnitude=requested_min_mag)
            return JsonResponse(
                {
                    **payload,
                    'events': filtered_events,
                    'min_magnitude_filter': requested_min_mag,
                }
            )

        except requests.RequestException as e:
            if persisted_events:
                logger.warning(f"PHIVOLCS live fetch failed, returning persisted events: {str(e)}")
                enriched_persisted = [
                    _enrich_event_alert_state(ev, now_utc=now_utc)
                    for ev in persisted_events
                ]
                filtered_persisted = filter_events_for_feed(
                    enriched_persisted,
                    min_magnitude=requested_min_mag,
                )
                return JsonResponse(
                    {
                        'center': {'latitude': cdo_lat, 'longitude': cdo_lon},
                        'radius_km': radius_km,
                        'blind_zone_km': blind_zone_km,
                        'source': 'PHIVOLCS',
                        'events': filtered_persisted,
                        'min_magnitude_filter': requested_min_mag,
                        'phivolcs_reference_url': 'https://www.phivolcs.dost.gov.ph/',
                    }
                )
            logger.error(f"PHIVOLCS Earthquake feed fetch error: {str(e)}")
            return Response(
                {'error': 'Failed to fetch earthquake data from PHIVOLCS.', 'details': str(e)},
                status=502,
            )
        except Exception as e:
            logger.error(f"PHIVOLCS Earthquake feed error: {str(e)}")
            return Response(
                {'error': 'Failed to process earthquake monitoring data.', 'details': str(e)},
                status=500,
            )


class IncidentListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        supabase_url = getattr(settings, "SUPABASE_URL", "").rstrip("/")
        service_key = getattr(settings, "SUPABASE_SERVICE_ROLE_KEY", "")

        if not supabase_url or not service_key:
            return Response({"incidents": []}, status=status.HTTP_200_OK)

        headers = {
            "apikey": service_key,
            "Content-Type": "application/json",
        }
        if not service_key.startswith("sb_secret_"):
            headers["Authorization"] = f"Bearer {service_key}"

        try:
            resp = requests.get(
                f"{supabase_url}/rest/v1/incident",
                headers=headers,
                params={"select": "*", "order": "reported_at.desc"},
                timeout=10,
            )
            if resp.ok:
                return Response({"incidents": resp.json()}, status=status.HTTP_200_OK)
        except requests.RequestException:
            pass

        return Response({"incidents": []}, status=status.HTTP_200_OK)


class SimulateEarthquakeView(APIView):
    """
    Protected endpoint allowing Clinic Staff or Admin users to create and persist
    a marked Simulation Test earthquake event (source='Simulation Test') to Supabase.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if not _is_clinic_staff_or_admin(request.user):
            return Response(
                {"detail": "Only clinic staff or admin users can trigger earthquake simulations."},
                status=status.HTTP_403_FORBIDDEN,
            )

        data = request.data if isinstance(request.data, dict) else {}

        classification = str(data.get("classification") or "earthquake_alert").strip()
        if classification not in {"monitoring", "advisory", "earthquake_alert"}:
            return Response(
                {"detail": "Invalid classification value."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            magnitude = float(data.get("magnitude", 6.2))
            depth_km = float(data.get("depth_km", 15.0))
            distance_km = float(data.get("distance_from_cdo_km", 20.0))
        except (TypeError, ValueError):
            return Response(
                {"detail": "Numeric fields (magnitude, depth_km, distance_from_cdo_km) must be valid numbers."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        place = str(data.get("place") or "Simulated Seismic Zone, Cagayan de Oro").strip()
        raw_intensity = data.get("reported_intensity", "VI")
        reported_intensity = (
            str(raw_intensity).strip() or None
            if raw_intensity is not None
            else None
        )

        try:
            event = create_and_sync_simulation_earthquake(
                magnitude=magnitude,
                place=place,
                classification=classification,
                depth_km=depth_km,
                distance_from_cdo_km=distance_km,
                reported_intensity=reported_intensity,
                created_by=request.user.username,
            )
            if classification == "earthquake_alert":
                try:
                    create_earthquake_notifications_in_supabase([event])
                except Exception as notif_exc:
                    logger.warning(f"Simulation earthquake notification sync warning: {str(notif_exc)}")
        except Exception as exc:
            logger.error(f"Earthquake simulation sync error: {str(exc)}")
            return Response(
                {"detail": f"Failed to persist simulation to Supabase: {str(exc)}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        cache.delete("phivolcs_ustp_cdo_earthquakes")
        enriched_event = _enrich_event_alert_state(event)

        return Response(
            {
                "detail": "Simulation earthquake created and synced.",
                "event": enriched_event,
            },
            status=status.HTTP_201_CREATED,
        )


class AcknowledgeEarthquakeAlertView(APIView):
    """
    Allows clinic staff or admin users to acknowledge an earthquake alert early,
    stopping active client alerting and silencing physical hardware alarms.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, event_id: str):
        if not _is_clinic_staff_or_admin(request.user):
            return Response(
                {"detail": "Only clinic staff or admin users can acknowledge earthquake alerts."},
                status=status.HTTP_403_FORBIDDEN,
            )

        clean_event_id = str(event_id or "").strip()
        if not clean_event_id:
            return Response(
                {"detail": "Earthquake event ID is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        supabase_url = (
            getattr(settings, "SUPABASE_URL", None) or os.environ.get("SUPABASE_URL", "")
        ).strip().rstrip("/")
        service_key = (
            getattr(settings, "SUPABASE_SERVICE_ROLE_KEY", None)
            or os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
        ).strip()
        if not supabase_url or not service_key:
            return Response(
                {"detail": "Supabase configuration is missing."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        now_utc = dj_timezone.now().astimezone(timezone.utc)
        now_iso = now_utc.isoformat()

        headers = {
            "apikey": service_key,
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }
        if not service_key.startswith("sb_secret_"):
            headers["Authorization"] = f"Bearer {service_key}"

        patch_payload = {
            "acknowledged": True,
            "acknowledged_by": request.user.id,
            "acknowledged_at": now_iso,
            "alert_active": False,
            "buzzer_enabled": False,
            "led_enabled": False,
            "alert_pattern": "none",
        }

        try:
            resp = requests.patch(
                f"{supabase_url}/rest/v1/earthquake_monitoring",
                params={"external_event_id": f"eq.{clean_event_id}"},
                headers=headers,
                json=patch_payload,
                timeout=10,
            )
            if not resp.ok:
                logger.error(
                    "Failed to acknowledge earthquake %s in Supabase (%s): %s",
                    clean_event_id,
                    resp.status_code,
                    resp.text,
                )
                return Response(
                    {"detail": f"Failed to update alert acknowledgment in Supabase: {resp.text}"},
                    status=status.HTTP_502_BAD_GATEWAY,
                )
        except Exception as exc:
            logger.exception("Error acknowledging earthquake %s: %s", clean_event_id, exc)
            return Response(
                {"detail": f"Error acknowledging earthquake alert: {exc}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        updated_rows = resp.json() if resp.text else []
        row = (
            updated_rows[0]
            if isinstance(updated_rows, list) and updated_rows
            else {"external_event_id": clean_event_id, **patch_payload}
        )

        if getattr(settings, "ENABLE_EARTHQUAKE_HARDWARE_SYNC", False) and not is_simulation_event(row):
            try:
                silenced_event = {
                    **row,
                    "classification": "earthquake_alert",
                    "acknowledged": True,
                    "alert_active": False,
                    **build_hardware_alarm_state(None, now_utc=now_utc),
                }
                sync_alert_hardware_state([silenced_event])
            except Exception as hw_exc:
                logger.warning("Hardware alarm silence sync warning for %s: %s", clean_event_id, hw_exc)

        cache.delete("phivolcs_ustp_cdo_earthquakes")

        expires_dt = parse_event_timestamp(row.get("alert_expires_at"))
        return Response(
            {
                "detail": "Earthquake alert acknowledged.",
                "event_id": clean_event_id,
                "classification": row.get("classification", "earthquake_alert"),
                "alert_active": False,
                "acknowledged": True,
                "acknowledged_by": request.user.id,
                "alert_acknowledged_at": now_iso,
                "alert_expires_at": (
                    expires_dt.isoformat() if expires_dt else row.get("alert_expires_at")
                ),
            },
            status=status.HTTP_200_OK,
        )


class LoginView(TokenObtainPairView):
    """
    Standard Login View for Web Admin and General API Access.
    """
    serializer_class = AuthTokenSerializer

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)

        if response.status_code == 200:
            username = request.data.get("username")
            try:
                user = User.objects.get(username=username)
                synced, warning = _sync_user_profile_with_supabase(user, user.profile)
                response.data["supabase_synced"] = synced
                response.data["sync_warning"] = warning
            except User.DoesNotExist:
                pass

        return response


class MobileLoginView(TokenObtainPairView):
    """
    Mobile User Login View:
    Exclusively permits standard users/students while rejecting Responders, Staff, and Admins.
    """
    serializer_class = MobileAuthTokenSerializer

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)

        if response.status_code == 200:
            username = request.data.get("username")
            try:
                user = User.objects.get(username=username)
                synced, warning = _sync_user_profile_with_supabase(user, user.profile)
                response.data["supabase_synced"] = synced
                response.data["sync_warning"] = warning
            except User.DoesNotExist:
                pass

        return response


class SyncProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        synced, warning = _sync_user_profile_with_supabase(request.user, request.user.profile)
        return Response({
            "supabase_synced": synced,
            "sync_warning": warning,
        })


class ProfileDetailView(APIView):
    """
    Retrieves current user account details and profile information.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        profile, _ = UserProfile.objects.get_or_create(user=user)
        return Response(_serialize_user_payload(user, profile), status=status.HTTP_200_OK)


class UpdateProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def put(self, request):
        user = request.user
        profile, _ = UserProfile.objects.get_or_create(user=user)

        data = request.data if isinstance(request.data, dict) else {}
        new_username = data.get('username')
        new_email = data.get('email')

        # Validate unique username if changed
        if new_username and new_username != user.username:
            if User.objects.filter(username=new_username).exclude(pk=user.pk).exists():
                return Response({"error": "Username already taken."}, status=status.HTTP_400_BAD_REQUEST)
            user.username = new_username

        # Validate unique email if changed
        if new_email and new_email != user.email:
            if User.objects.filter(email=new_email).exclude(pk=user.pk).exists():
                return Response({"error": "Email already registered."}, status=status.HTTP_400_BAD_REQUEST)
            user.email = new_email

        user.save()

        # Update profile fields
        profile.name = data.get('name', profile.name)
        profile.student_id = data.get('student_id', profile.student_id)
        profile.course = data.get('course', profile.course)
        profile.phone_number = data.get('phone_number', profile.phone_number)
        profile.save()

        supabase_synced, sync_warning = _sync_user_profile_with_supabase(user, profile)

        return Response({
            "message": "Profile updated successfully.",
            "supabase_synced": supabase_synced,
            "sync_warning": sync_warning,
            "user": _serialize_user_payload(user, profile),
        }, status=status.HTTP_200_OK)


class ChangePasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        current_password = request.data.get('current_password')
        new_password = request.data.get('new_password')

        if not current_password or not new_password:
            return Response({"error": "Current and new passwords are required."}, status=status.HTTP_400_BAD_REQUEST)

        if not user.check_password(current_password):
            return Response({"error": "Current password is incorrect."}, status=status.HTTP_400_BAD_REQUEST)

        if len(str(new_password).strip()) < 6:
            return Response({"error": "New password must be at least 6 characters long."}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.save()

        return Response({"message": "Password updated successfully."}, status=status.HTTP_200_OK)


class SupabaseTokenView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        return Response({
            'supabase_access_token': create_supabase_access_token(
                request.user,
                request.user.profile,
            ),
        })


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = [permissions.AllowAny]
    serializer_class = RegisterSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        supabase_synced, sync_warning = _sync_user_profile_with_supabase(user, user.profile)

        refresh = RefreshToken.for_user(user)
        try:
            supabase_access_token = create_supabase_access_token(user, user.profile)
        except SupabaseTokenNotConfigured:
            supabase_access_token = None

        return Response({
            "message": "User registered successfully.",
            "supabase_synced": supabase_synced,
            "sync_warning": sync_warning,
            "refresh": str(refresh),
            "access": str(refresh.access_token),
            "supabase_access_token": supabase_access_token,
            "user": _serialize_user_payload(user, user.profile),
        }, status=201)


class PasswordResetRequestView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get('target')
        admin_flow = request.data.get('admin_flow', False)

        if not email:
            return Response({'detail': 'Email target field is required.'}, status=400)

        UserModel = get_user_model()
        try:
            user = UserModel.objects.filter(email=email).first()

            # Restrict admin portal password resets to admin accounts only
            if admin_flow and (not user or not (user.is_staff or user.is_superuser or getattr(user.profile, 'role', '') == 'admin')):
                return Response({'detail': 'If an associated admin account exists, verification instructions have been sent.'}, status=200)

            if not user:
                return Response({'detail': 'If an associated account exists, verification instructions have been sent.'}, status=200)

            otp_code = str(random.randint(100000, 999999))

            # Cache-backed secure storage with attempt counter and 10-minute expiry
            cache.set(f"otp_{email}", otp_code, timeout=OTP_EXPIRY_SECONDS)
            cache.set(f"otp_attempts_{email}", 0, timeout=OTP_EXPIRY_SECONDS)

            send_mail(
                subject='SAFE:MEAS Password Reset Verification Code',
                message=(
                    f"Your SAFE:MEAS verification code is {otp_code}. "
                    f"It expires in {OTP_EXPIRY_SECONDS // 60} minutes."
                ),
                from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@safe-meas.local'),
                recipient_list=[email],
                fail_silently=False,
            )

            return Response({'detail': 'OTP code sent successfully.'}, status=200)
        except Exception as exc:
            logger.error(f"Password reset OTP request error: {str(exc)}")
            return Response({'detail': 'Failed to process password reset request.'}, status=500)


class VerifyOtpView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get('target')
        otp_submitted = str(request.data.get('otp', '')).strip()

        if not email or not otp_submitted:
            return Response({'detail': 'Email target and OTP code are required.'}, status=400)

        attempts_key = f"otp_attempts_{email}"
        otp_key = f"otp_{email}"

        attempts = cache.get(attempts_key, 0)
        if attempts >= MAX_ATTEMPTS:
            return Response({'detail': 'Maximum verification attempts exceeded.'}, status=400)

        cached_otp = cache.get(otp_key)
        if not cached_otp or str(cached_otp) != otp_submitted:
            cache.set(attempts_key, attempts + 1, timeout=OTP_EXPIRY_SECONDS)
            return Response({'detail': 'Invalid or expired OTP code.'}, status=400)

        return Response({'detail': 'OTP verified successfully.'}, status=200)


class ConfirmPasswordResetView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get('target')
        otp_submitted = str(request.data.get('otp', '')).strip()
        new_password = request.data.get('new_password', '')

        if not email or not otp_submitted or not new_password:
            return Response(
                {'detail': 'Email target, OTP code, and new password are required.'},
                status=400,
            )

        if len(str(new_password).strip()) < 6:
            return Response(
                {'detail': 'Password must be at least 6 characters long.'},
                status=400,
            )

        otp_key = f"otp_{email}"
        attempts_key = f"otp_attempts_{email}"
        cached_otp = cache.get(otp_key)

        if not cached_otp or str(cached_otp) != otp_submitted:
            return Response({'detail': 'Invalid or expired OTP code.'}, status=400)

        UserModel = get_user_model()
        user = UserModel.objects.filter(email=email).first()
        if not user:
            return Response({'detail': 'Account not found.'}, status=404)

        user.set_password(new_password)
        user.save()

        cache.delete(otp_key)
        cache.delete(attempts_key)

        return Response({'detail': 'Password updated successfully.'}, status=200)