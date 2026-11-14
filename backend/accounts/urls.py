from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    LoginView,
    MobileLoginView,
    RegisterView,
    SupabaseTokenView,
    SyncProfileView,
    ProfileDetailView,
    UpdateProfileView,
    ChangePasswordView,
    CreateClinicStaffView,
    CreateUserView,
    IncidentListView,
    PasswordResetRequestView,
    VerifyOtpView,
    ConfirmPasswordResetView,
    EarthquakeFeedAPI,
)

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', LoginView.as_view(), name='login'),
    path('login/mobile/', MobileLoginView.as_view(), name='mobile-login'),
    path('token/refresh/', TokenRefreshView.as_view(), name='refresh'),
    path('token/supabase/', SupabaseTokenView.as_view(), name='supabase-token'),
    path('profile/', ProfileDetailView.as_view(), name='profile-detail'),
    path('profile/sync/', SyncProfileView.as_view(), name='profile-sync'),
    path('profile/update/', UpdateProfileView.as_view(), name='profile-update'),
    path('profile/change-password/', ChangePasswordView.as_view(), name='profile-change-password'),
    path('clinic-staff/create/', CreateClinicStaffView.as_view(), name='clinic-staff-create'),
    path('users/create/', CreateUserView.as_view(), name='user-create'),
    path('incidents/', IncidentListView.as_view(), name='incident-list'),
    path('earthquakes/', EarthquakeFeedAPI.as_view(), name='earthquake-feed'),
   
    # Password Reset OTP Endpoints
    path('password-reset/', PasswordResetRequestView.as_view(), name='password_reset_request'),
    path('verify-otp/', VerifyOtpView.as_view(), name='verify_otp'),
    path('confirm-password-reset/', ConfirmPasswordResetView.as_view(), name='confirm_password_reset'),
]