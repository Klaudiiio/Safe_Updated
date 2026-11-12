import logging
import random
import time
import requests

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.models import User
from django.core.mail import send_mail
from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from .serializers import (
    AuthTokenSerializer,
    MobileAuthTokenSerializer,
    RegisterSerializer,
)
from .supabase_tokens import SupabaseTokenNotConfigured, create_supabase_access_token
from .utils import SupabaseNotConfigured, SupabaseRequestFailed, sync_user_to_supabase

logger = logging.getLogger(__name__)

# Temporary storage for password reset OTPs (In production, replace with django.core.cache / Redis)
OTP_STORAGE = {}


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
                if '409' in str(err_str) or 'already exists' in str(err_str):
                    response.data["supabase_synced"] = True
                    response.data["sync_warning"] = None
                else:
                    response.data["supabase_synced"] = False
                    response.data["sync_warning"] = err_str
            except Exception as exc:
                err_str = str(exc)
                if '409' in err_str or 'already exists' in err_str:
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
                if '409' in str(err_str) or 'already exists' in str(err_str):
                    response.data["supabase_synced"] = True
                    response.data["sync_warning"] = None
                else:
                    response.data["supabase_synced"] = False
                    response.data["sync_warning"] = err_str
            except Exception as exc:
                err_str = str(exc)
                if '409' in err_str or 'already exists' in err_str:
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
            if '409' in str(warning_msg) or 'already exists' in str(warning_msg):
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
            if '409' in str(err_str) or 'already exists' in str(err_str):
                supabase_synced = True
                sync_warning = None
            else:
                supabase_synced = False
                sync_warning = err_str
        except Exception as exc:
            err_str = str(exc)
            if '409' in err_str or 'already exists' in err_str:
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
                "role": user.profile.role
            }
        }, status=201)


class PasswordResetRequestView(APIView):
    """
    Step 1: Generates and dispatches a 6-digit OTP code to the user's target (Email/Gmail or Phone).
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        method = request.data.get('method') # 'email' or 'phone'
        target = request.data.get('target') # gmail address or phone number

        if not target:
            return Response({'detail': 'Target field is required.'}, status=400)

        UserModel = get_user_model()
        try:
            if method == 'email':
                user = UserModel.objects.filter(email=target).first()
            else:
                user = UserModel.objects.filter(profile__phone_number=target).first()

            if not user:
                # Return 404 or generic success message to prevent user enumeration
                return Response({'detail': 'No account associated with this target found.'}, status=404)

            otp_code = str(random.randint(100000, 999999))
            OTP_STORAGE[target] = otp_code

            if method == 'email':
                send_mail(
                    subject='SAFE:MEAS Password Reset Verification Code',
                    message=f'Your verification code is: {otp_code}',
                    from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'no-reply@safe-meas.local'),
                    recipient_list=[target],
                )
            else:
                # Log or integrate SMS gateway here
                logger.info(f"SMS OTP for {target}: {otp_code}")

            return Response({'detail': 'OTP code sent successfully.'}, status=200)
        except Exception as e:
            return Response({'detail': str(e)}, status=500)


class VerifyOtpView(APIView):
    """
    Step 2: Validates the 6-digit OTP code entered by the user.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        target = request.data.get('target')
        otp = request.data.get('otp')

        if not target or not otp:
            return Response({'detail': 'Target and OTP are required.'}, status=400)

        stored_otp = OTP_STORAGE.get(target)
        if not stored_otp or stored_otp != otp:
            return Response({'detail': 'Invalid or expired OTP code.'}, status=400)

        return Response({'detail': 'OTP verified successfully.'}, status=200)


class ConfirmPasswordResetView(APIView):
    """
    Step 3: Confirms OTP and updates the user's password securely.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        target = request.data.get('target')
        otp = request.data.get('otp')
        new_password = request.data.get('new_password')

        if not target or not otp or not new_password:
            return Response({'detail': 'All fields are required.'}, status=400)

        if len(new_password.strip()) < 6:
            return Response({'detail': 'Password must be at least 6 characters long.'}, status=400)

        stored_otp = OTP_STORAGE.get(target)
        if not stored_otp or stored_otp != otp:
            return Response({'detail': 'Invalid or expired OTP session.'}, status=400)

        UserModel = get_user_model()
        try:
            user = UserModel.objects.filter(email=target).first() or UserModel.objects.filter(profile__phone_number=target).first()
            if not user:
                return Response({'detail': 'User not found.'}, status=404)

            user.set_password(new_password)
            user.save()

            # Clear stored OTP session
            OTP_STORAGE.pop(target, None)

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
                    headers = {
                        "apikey": service_key,
                        "Authorization": f"Bearer {service_key}",
                        "Content-Type": "application/json",
                        "Prefer": "return=representation"
                    }
                    random_suffix = random.randint(1000, 9999)
                    payload = {
                        "user_id": int(time.time()),
                        "name": name,
                        "username": username,
                        "course": course or "General",
                        "phone_number": phone_number or "",
                        "user_type": user_type.lower(),
                        "student_id": student_id or f"ID-{random_suffix}"
                    }

                    res = requests.post(
                        f"{supabase_url.rstrip('/')}/rest/v1/user",
                        json=payload,
                        headers=headers,
                        timeout=10
                    )

                    if res.status_code >= 400:
                        res = requests.post(
                            f"{supabase_url.rstrip('/')}/rest/v1/users",
                            json=payload,
                            headers=headers,
                            timeout=10
                        )

                    if res.status_code >= 400:
                        supabase_synced = False
                        sync_warning = f"Supabase User Table Error [{res.status_code}]: {res.text}"
                except Exception as sub_exc:
                    supabase_synced = False
                    sync_warning = str(sub_exc)

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

                    headers = {
                        "apikey": service_key,
                        "Authorization": f"Bearer {service_key}",
                        "Content-Type": "application/json",
                        "Prefer": "return=representation"
                    }
                    payload = {
                        "name": name,
                        "department": department,
                        "contact_number": contact_number,
                        "availability_status": availability_status.lower(),
                        "user_type": role.lower().replace(' ', '_')
                    }
                   
                    res = requests.post(
                        f"{supabase_url.rstrip('/')}/rest/v1/responder",
                        json=payload,
                        headers=headers,
                        timeout=10
                    )
                   
                    if res.status_code >= 400:
                        res = requests.post(
                            f"{supabase_url.rstrip('/')}/rest/v1/responders",
                            json=payload,
                            headers=headers,
                            timeout=10
                        )

                    if res.status_code >= 400:
                        supabase_synced = False
                        sync_warning = f"Responder Table Error [{res.status_code}]: {res.text}"
                except Exception as sub_exc:
                    supabase_synced = False
                    sync_warning = str(sub_exc)

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