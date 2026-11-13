import logging
import random
import time
import requests

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.models import User
from django.core.mail import send_mail
from django.core.cache import cache
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

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