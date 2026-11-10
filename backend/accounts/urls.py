from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    LoginView,
    MobileLoginView,
    RegisterView,
    SupabaseTokenView,
    SyncProfileView,
    CreateClinicStaffView,
    CreateUserView,
    IncidentListView,
)

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', LoginView.as_view(), name='login'),
    path('login/mobile/', MobileLoginView.as_view(), name='mobile-login'),
    path('token/refresh/', TokenRefreshView.as_view(), name='refresh'),
    path('token/supabase/', SupabaseTokenView.as_view(), name='supabase-token'),
    path('profile/sync/', SyncProfileView.as_view(), name='profile-sync'),
    path('clinic-staff/create/', CreateClinicStaffView.as_view(), name='clinic-staff-create'),
    path('users/create/', CreateUserView.as_view(), name='user-create'),
    path('incidents/', IncidentListView.as_view(), name='incident-list'),
]