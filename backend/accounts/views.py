import logging
import random
import requests

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.models import User
from django.core.mail import send_mail
from django.core.cache import cache
from django.http import JsonResponse
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from .earthquake_service import (
    create_and_sync_simulation_earthquake,
    fetch_earthquakes_from_supabase,
    filter_events_for_feed,
    get_evaluated_earthquakes,
    get_min_feed_magnitude,
    get_ustp_cdo_coords,
    parse_event_timestamp,
    sync_earthquakes_to_supabase,
)
from .serializers import (
    AuthTokenSerializer,
    MobileAuthTokenSerializer,
    RegisterSerializer,
)
from .models import UserProfile
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


class EarthquakeFeedAPI(APIView):
    """
    Endpoint to return normalized, backend-classified PHIVOLCS earthquake events
    relative to USTP Cagayan de Oro, backed by and merged with persisted Supabase records.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
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
            merged_events = _merge_and_deduplicate_events(persisted_events, cached_events)
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
            merged_events = _merge_and_deduplicate_events(persisted_events, evaluated_events)
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
                filtered_persisted = filter_events_for_feed(
                    persisted_events,
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
        except Exception as exc:
            logger.error(f"Earthquake simulation sync error: {str(exc)}")
            return Response(
                {"detail": f"Failed to persist simulation to Supabase: {str(exc)}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        cache.delete("phivolcs_ustp_cdo_earthquakes")

        return Response(
            {
                "detail": "Simulation earthquake created and synced.",
                "event": event,
            },
            status=status.HTTP_201_CREATED,
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
                profile = user.profile

                sync_user_to_supabase(user, profile)
                response.data["supabase_synced"] = True
                response.data["sync_warning"] = None
            except User.DoesNotExist:
                pass
            except (SupabaseNotConfigured, SupabaseRequestFailed) as exc:
                err_str = getattr(exc, 'detail', str(exc))
                if '409' in str(err_str) or 'already exists' in str(err_str) or 'duplicate key value' in str(err_str) or 'violates unique constraint' in str(err_str):
                    response.data["supabase_synced"] = True
                    response.data["sync_warning"] = None
                else:
                    response.data["supabase_synced"] = False
                    response.data["sync_warning"] = err_str
            except Exception as exc:
                err_str = str(exc)
                if '409' in err_str or 'already exists' in err_str or 'duplicate key value' in err_str or 'violates unique constraint' in err_str:
                    response.data["supabase_synced"] = True
                    response.data["sync_warning"] = None
                else:
                    response.data["supabase_synced"] = False
                    response.data["sync_warning"] = err_str

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
                profile = user.profile

                sync_user_to_supabase(user, profile)
                response.data["supabase_synced"] = True
                response.data["sync_warning"] = None
            except User.DoesNotExist:
                pass
            except (SupabaseNotConfigured, SupabaseRequestFailed) as exc:
                err_str = getattr(exc, 'detail', str(exc))
                if '409' in str(err_str) or 'already exists' in str(err_str) or 'duplicate key value' in str(err_str) or 'violates unique constraint' in str(err_str):
                    response.data["supabase_synced"] = True
                    response.data["sync_warning"] = None
                else:
                    response.data["supabase_synced"] = False
                    response.data["sync_warning"] = err_str
            except Exception as exc:
                err_str = str(exc)
                if '409' in err_str or 'already exists' in err_str or 'duplicate key value' in err_str or 'violates unique constraint' in err_str:
                    response.data["supabase_synced"] = True
                    response.data["sync_warning"] = None
                else:
                    response.data["supabase_synced"] = False
                    response.data["sync_warning"] = err_str

        return response


class SyncProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        profile = request.user.profile
        try:
            sync_user_to_supabase(request.user, profile)
        except (SupabaseNotConfigured, SupabaseRequestFailed) as exc:
            warning_msg = getattr(exc, 'detail', str(exc))
            if '409' in str(warning_msg) or 'already exists' in str(warning_msg) or 'duplicate key value' in str(warning_msg) or 'violates unique constraint' in str(warning_msg):
                return Response({
                    'supabase_synced': True,
                    'sync_warning': None,
                })
            return Response({
                'supabase_synced': False,
                'sync_warning': str(warning_msg),
            })

        return Response({
            'supabase_synced': True,
            'sync_warning': None,
        })


class ProfileDetailView(APIView):
    """
    Retrieves current user account details and profile information.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        profile, _ = UserProfile.objects.get_or_create(user=user)
        return Response({
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "name": profile.name,
            "student_id": profile.student_id,
            "course": profile.course,
            "phone_number": profile.phone_number,
            "role": profile.role,
        }, status=status.HTTP_200_OK)


class UpdateProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def put(self, request):
        user = request.user
        profile, _ = UserProfile.objects.get_or_create(user=user)

        data = request.data
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

        supabase_synced = True
        sync_warning = None

        try:
            sync_user_to_supabase(user, profile)
        except (SupabaseNotConfigured, SupabaseRequestFailed) as exc:
            err_str = getattr(exc, 'detail', str(exc))
            if '409' in str(err_str) or 'already exists' in str(err_str) or 'duplicate key value' in str(err_str) or 'violates unique constraint' in str(err_str):
                supabase_synced = True
                sync_warning = None
            else:
                supabase_synced = False
                sync_warning = err_str
        except Exception as exc:
            err_str = str(exc)
            if '409' in err_str or 'already exists' in err_str or 'duplicate key value' in err_str or 'violates unique constraint' in err_str:
                supabase_synced = True
                sync_warning = None
            else:
                supabase_synced = False
                sync_warning = err_str

        return Response({
            "message": "Profile updated successfully.",
            "supabase_synced": supabase_synced,
            "sync_warning": sync_warning,
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "name": profile.name,
                "student_id": profile.student_id,
                "course": profile.course,
                "phone_number": profile.phone_number,
                "role": profile.role,
            }
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

        if len(new_password.strip()) < 6:
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

        supabase_synced = True
        sync_warning = None
        try:
            sync_user_to_supabase(user, user.profile)
        except (SupabaseNotConfigured, SupabaseRequestFailed) as exc:
            err_str = getattr(exc, 'detail', str(exc))
            if '409' in str(err_str) or 'already exists' in str(err_str) or 'duplicate key value' in str(err_str) or 'violates unique constraint' in str(err_str):
                supabase_synced = True
                sync_warning = None
            else:
                supabase_synced = False
                sync_warning = err_str
        except Exception as exc:
            err_str = str(exc)
            if '409' in err_str or 'already exists' in err_str or 'duplicate key value' in err_str or 'violates unique constraint' in err_str:
                supabase_synced = True
                sync_warning = None
            else:
                supabase_synced = False
                sync_warning = err_str

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
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "name": user.profile.name,
                "student_id": user.profile.student_id,
                "course": user.profile.course,
                "phone_number": user.profile.phone_number,
                "role": user.profile.role
            }
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
                message=f'Your verification code is: {otp_code}. It expires in 10 minutes.',
                from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'no-reply@safe-meas.local'),
                recipient_list=[email],
            )

            return Response({'detail': 'OTP code sent successfully.'}, status=200)
        except Exception as e:
            logger.error(f"Password reset request error: {str(e)}")
            return Response({'detail': 'An error occurred processing your request.'}, status=500)


class VerifyOtpView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get('target')
        otp = request.data.get('otp')

        if not email or not otp:
            return Response({'detail': 'Target email and OTP are required.'}, status=400)

        cache_key_otp = f"otp_{email}"
        cache_key_attempts = f"otp_attempts_{email}"

        stored_otp = cache.get(cache_key_otp)
        attempts = cache.get(cache_key_attempts, 0)

        if attempts >= MAX_ATTEMPTS:
            cache.delete(cache_key_otp)
            return Response({'detail': 'Maximum verification attempts exceeded. Please request a new code.'}, status=400)

        if not stored_otp or stored_otp != otp:
            cache.set(cache_key_attempts, attempts + 1, timeout=OTP_EXPIRY_SECONDS)
            return Response({'detail': 'Invalid or expired OTP code.'}, status=400)

        return Response({'detail': 'OTP verified successfully.'}, status=200)


class ConfirmPasswordResetView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get('target')
        otp = request.data.get('otp')
        new_password = request.data.get('new_password')

        if not email or not otp or not new_password:
            return Response({'detail': 'All fields are required.'}, status=400)

        if len(new_password.strip()) < 6:
            return Response({'detail': 'Password must be at least 6 characters long.'}, status=400)

        cache_key_otp = f"otp_{email}"
        stored_otp = cache.get(cache_key_otp)

        if not stored_otp or stored_otp != otp:
            return Response({'detail': 'Invalid or expired OTP session.'}, status=400)

        UserModel = get_user_model()
        try:
            user = UserModel.objects.filter(email=email).first()
            if not user:
                return Response({'detail': 'User not found.'}, status=404)

            user.set_password(new_password)
            user.save()

            # Enforce one-time use by removing OTP from cache immediately
            cache.delete(cache_key_otp)
            cache.delete(f"otp_attempts_{email}")

            return Response({'detail': 'Password updated successfully.'}, status=200)
        except Exception as e:
            return Response({'detail': str(e)}, status=500)


class CreateUserView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        name = request.data.get('name')
        username = request.data.get('username')
        password = request.data.get('password')
        course = request.data.get('course')
        phone_number = request.data.get('phone_number')
        user_type = request.data.get('user_type', 'user')
        student_id = request.data.get('student_id')
        email = request.data.get('email') or f"{username.lower().replace(' ', '')}@campus.edu"

        if not username or not password or not name:
            return Response({"error": "Name, username, and password are required fields."}, status=400)

        if len(password.strip()) < 6:
            return Response({"error": "Password must be at least 6 characters long."}, status=400)

        if User.objects.filter(username=username).exists() or User.objects.filter(email=email).exists():
            return Response({"error": "Username or email already exists."}, status=400)

        try:
            user = User.objects.create(
                username=username,
                email=email,
            )
            user.set_password(password)

            if hasattr(user, 'profile'):
                user.profile.name = name
                user.profile.phone_number = phone_number
                user.profile.role = user_type.lower()
                user.profile.save()
            user.save()

            supabase_synced = True
            sync_warning = None
            supabase_url = getattr(settings, 'SUPABASE_URL', None)
            service_key = getattr(settings, 'SUPABASE_SERVICE_ROLE_KEY', None)

            if supabase_url and service_key:
                try:
                    sync_user_to_supabase(user, user.profile)
                except Exception as sub_exc:
                    err_str = str(sub_exc)
                    if '409' in err_str or 'already exists' in err_str or 'duplicate key value' in err_str or 'violates unique constraint' in err_str:
                        supabase_synced = True
                        sync_warning = None
                    else:
                        supabase_synced = False
                        sync_warning = err_str

            return Response({
                "message": f"User '{username}' created successfully.",
                "user_id": user.id,
                "supabase_synced": supabase_synced,
                "sync_warning": sync_warning
            }, status=201)

        except Exception as exc:
            return Response({"error": str(exc)}, status=500)


class CreateClinicStaffView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        email = request.data.get('email')
        username = request.data.get('username') or (email.split('@')[0] if email else None)
        password = request.data.get('password')
        name = request.data.get('name') or username
        department = request.data.get('department')
        contact_number = request.data.get('contact_number')
        availability_status = request.data.get('availability_status', 'available')
        role = request.data.get('role', 'Responder')

        if not password or len(password.strip()) < 6:
            return Response(
                {"error": "Password is required and must be at least 6 characters long."},
                status=400
            )

        if not email:
            return Response({"error": "Email address is required."}, status=400)

        if User.objects.filter(username=username).exists() or User.objects.filter(email=email).exists():
            return Response({"error": "Username or email already exists."}, status=400)

        try:
            user = User.objects.create(
                username=username,
                email=email,
                is_staff=True
            )
            user.set_password(password)

            if hasattr(user, 'profile'):
                user.profile.name = name
                user.profile.phone_number = contact_number
                user.profile.role = role.lower().replace(' ', '_')
                user.profile.save()
            user.save()

            supabase_synced = True
            sync_warning = None
            supabase_url = getattr(settings, 'SUPABASE_URL', None)
            service_key = getattr(settings, 'SUPABASE_SERVICE_ROLE_KEY', None)

            if supabase_url and service_key:
                try:
                    sync_user_to_supabase(user, user.profile)
                except Exception as sub_exc:
                    err_str = str(sub_exc)
                    if '409' in err_str or 'already exists' in err_str or 'duplicate key value' in err_str or 'violates unique constraint' in err_str:
                        supabase_synced = True
                        sync_warning = None
                    else:
                        supabase_synced = False
                        sync_warning = err_str

            return Response({
                "message": f"Staff member '{username}' created successfully.",
                "user_id": user.id,
                "supabase_synced": supabase_synced,
                "sync_warning": sync_warning
            }, status=201)

        except Exception as exc:
            return Response({"error": str(exc)}, status=500)


class IncidentListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        supabase_url = getattr(settings, 'SUPABASE_URL', None)
        service_key = getattr(settings, 'SUPABASE_SERVICE_ROLE_KEY', None)

        if not supabase_url or not service_key:
            return Response({"error": "Supabase configuration missing on server."}, status=500)

        headers = {
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
        }

        user_id = request.user.id

        try:
            res = requests.get(
                f"{supabase_url.rstrip('/')}/rest/v1/incident?select=*,incident_types(incident_name)&user_id=eq.{user_id}&order=reported_at.desc",
                headers=headers,
                timeout=10
            )
            if res.status_code >= 400:
                res = requests.get(
                    f"{supabase_url.rstrip('/')}/rest/v1/incidents?select=*&user_id=eq.{user_id}&order=reported_at.desc",
                    headers=headers,
                    timeout=10
                )

            if res.status_code >= 400:
                res = requests.get(
                    f"{supabase_url.rstrip('/')}/rest/v1/incident?select=*&user_id=eq.{user_id}",
                    headers=headers,
                    timeout=10
                )

            if res.status_code >= 400:
                return Response({"error": f"Supabase error: {res.text}"}, status=res.status_code)

            raw_data = res.json()

            formatted_results = []
            for item in raw_data:
                incident_type_name = "Incident"
                if isinstance(item.get('incident_types'), dict):
                    incident_type_name = item['incident_types'].get('incident_name', 'Incident')
                elif item.get('incident_type'):
                    incident_type_name = item.get('incident_type')

                formatted_results.append({
                    "id": item.get('incident_id') or item.get('id'),
                    "incident_type": incident_type_name,
                    "description": item.get('description', ''),
                    "location": item.get('location_description') or item.get('location') or 'Campus Area',
                    "status": item.get('status', 'Pending'),
                    "reported_at": item.get('reported_at') or item.get('created_at'),
                })

            return Response(formatted_results)
        except Exception as e:
            return Response({"error": str(e)}, status=500)