from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView
from django.contrib.auth.models import User
from rest_framework.views import APIView
from django.conf import settings
import requests

from .serializers import AuthTokenSerializer, RegisterSerializer
from .supabase_tokens import SupabaseTokenNotConfigured, create_supabase_access_token
from .utils import SupabaseNotConfigured, SupabaseRequestFailed, sync_user_to_supabase


class LoginView(TokenObtainPairView):
    serializer_class = AuthTokenSerializer

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
       
        # If login was successful, grab the user and sync to Supabase
        if response.status_code == 200:
            username = request.data.get("username")
            try:
                user = User.objects.get(username=username)
                profile = user.profile
               
                # Attempt to sync profile to Supabase
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

        # Explicitly sync user to Supabase upon registration
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
            # 1. Create Django user and profile locally
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

            # 2. Sync to Supabase
            supabase_synced = True
            sync_warning = None
            supabase_url = getattr(settings, 'SUPABASE_URL', None)
            service_key = getattr(settings, 'SUPABASE_SERVICE_ROLE_KEY', None)
           
            if supabase_url and service_key:
                try:
                    # Step A: Sync to base user table
                    sync_user_to_supabase(user, user.profile)

                    # Step B: Insert into responder table using correct schema columns (user_type instead of user_id)
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