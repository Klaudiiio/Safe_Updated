import logging
import random
import time
import requests

from django.conf import settings
from django.contrib.auth.models import User
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
                        print("❌ SUPABASE RESPONDER SYNC ERROR:", sync_warning)
                except Exception as sub_exc:
                    supabase_synced = False
                    sync_warning = str(sub_exc)
                    print("❌ SUPABASE EXCEPTION:", sync_warning)

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
            print("❌ SUPABASE INCIDENT FETCH ERROR:", str(e))
            return Response({"error": str(e)}, status=500)