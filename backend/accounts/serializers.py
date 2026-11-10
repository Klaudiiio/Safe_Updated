import logging

from django.contrib.auth.models import User
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import UserProfile
from .supabase_tokens import SupabaseTokenNotConfigured, create_supabase_access_token
from .utils import SupabaseNotConfigured, SupabaseRequestFailed, sync_user_to_supabase

logger = logging.getLogger(__name__)


class MobileAuthTokenSerializer(TokenObtainPairSerializer):
    """
    Serializer used specifically for the Mobile App Login endpoint.
    Restricts access strictly to standard Users/Students and blocks Responders/Staff/Admins.
    """
    def validate(self, attrs):
        data = super().validate(attrs)
        profile, _ = UserProfile.objects.get_or_create(user=self.user)

        # Access restriction: Only allow standard users/students into the mobile app
        user_role = (getattr(profile, 'role', '') or getattr(profile, 'user_type', '')).lower()
        allowed_roles = {'user', 'student'}

        if user_role not in allowed_roles:
            raise AuthenticationFailed(
                "Access denied. Responders and clinic staff are not permitted to log into "
                "the User Mobile Application. Please use the designated Staff Portal."
            )

        try:
            sync_user_to_supabase(self.user, profile)
        except (SupabaseNotConfigured, SupabaseRequestFailed) as exc:
            logger.warning(
                'User %s logged in locally but Supabase sync failed: %s',
                self.user.pk,
                str(exc),
            )
            data['supabase_synced'] = False
            data['sync_warning'] = str(exc)
        else:
            data['supabase_synced'] = True
            data['sync_warning'] = None

        try:
            data['supabase_access_token'] = create_supabase_access_token(self.user, profile)
        except SupabaseTokenNotConfigured:
            data['supabase_access_token'] = None

        data['user'] = {
            'id': self.user.id,
            'username': self.user.username,
            'email': self.user.email,
            'name': profile.name,
            'role': profile.role,
        }
        return data


class AuthTokenSerializer(TokenObtainPairSerializer):
    """
    Standard Auth Serializer used for Web Admin and General API Authentication.
    """
    def validate(self, attrs):
        data = super().validate(attrs)
        profile, _ = UserProfile.objects.get_or_create(user=self.user)
        try:
            sync_user_to_supabase(self.user, profile)
        except (SupabaseNotConfigured, SupabaseRequestFailed) as exc:
            logger.warning(
                'User %s logged in locally but Supabase sync failed: %s',
                self.user.pk,
                str(exc),
            )
            data['supabase_synced'] = False
            data['sync_warning'] = str(exc)
        else:
            data['supabase_synced'] = True
            data['sync_warning'] = None

        try:
            data['supabase_access_token'] = create_supabase_access_token(self.user, profile)
        except SupabaseTokenNotConfigured:
            data['supabase_access_token'] = None

        data['user'] = {
            'id': self.user.id,
            'username': self.user.username,
            'email': self.user.email,
            'name': profile.name,
            'role': profile.role,
        }
        return data


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    name = serializers.CharField(max_length=50)
    student_id = serializers.CharField(max_length=100, required=False, allow_blank=True)
    course = serializers.CharField(max_length=100, required=False, allow_blank=True)
    phone_number = serializers.CharField(max_length=20, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'name', 'student_id', 'course', 'phone_number']

    def create(self, validated_data):
        name = validated_data.pop('name')
        student_id = validated_data.pop('student_id', '')
        course = validated_data.pop('course', '')
        phone_number = validated_data.pop('phone_number', '')
        password = validated_data.pop('password')

        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=password,
        )

        # Use get_or_create to prevent UserProfile matching crashes
        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.name = name
        profile.student_id = student_id
        profile.course = course
        profile.phone_number = phone_number
        profile.role = 'user'  # Default role for newly registered mobile users

        try:
            sync_user_to_supabase(user, profile)
            profile.supabase_synced = True
            profile.supabase_sync_warning = None
        except (SupabaseNotConfigured, SupabaseRequestFailed) as exc:
            logger.warning(
                'User %s was created locally but Supabase sync failed: %s',
                user.pk,
                str(exc),
            )
            profile.supabase_synced = False
            profile.supabase_sync_warning = str(exc)

        profile.save()

        return user