from io import StringIO
from unittest.mock import patch

import jwt
from django.contrib.auth.models import User
from django.core.management import call_command, CommandError
from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from .models import UserProfile
from .supabase_tokens import SupabaseTokenNotConfigured, create_supabase_access_token
from .utils import SupabaseRequestFailed, _supabase_headers, sync_user_to_supabase


class LoginResponseTests(TestCase):
    @patch('accounts.serializers.sync_user_to_supabase')
    def test_login_returns_authenticated_user_role_and_syncs_profile(self, sync_user):
        user = User.objects.create_user(username='safe-admin', password='test-password')
        user.profile.role = 'admin'
        user.profile.save()

        response = APIClient().post(
            '/api/auth/login/',
            {'username': 'safe-admin', 'password': 'test-password'},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['user']['id'], user.id)
        self.assertEqual(response.data['user']['role'], 'admin')
        self.assertTrue(response.data['supabase_synced'])
        self.assertIsNone(response.data['sync_warning'])
        sync_user.assert_called_once_with(user, user.profile)

    @patch(
        'accounts.serializers.sync_user_to_supabase',
        side_effect=SupabaseRequestFailed("Supabase failure"),
    )
    def test_login_succeeds_and_reports_when_supabase_sync_fails(self, _sync_user):
        User.objects.create_user(username='local-only', password='test-password')

        response = APIClient().post(
            '/api/auth/login/',
            {'username': 'local-only', 'password': 'test-password'},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data['supabase_synced'])
        self.assertEqual(response.data['sync_warning'], "Supabase failure")


class MobileLoginRestrictionTests(TestCase):
    @patch('accounts.serializers.sync_user_to_supabase')
    def test_mobile_login_restriction(self, _sync_user):
        # 1. Test student success
        student_user = User.objects.create_user(username='student1', password='test-password')
        student_user.profile.role = 'student'
        student_user.profile.save()

        response = APIClient().post(
            '/api/auth/mobile/login/',
            {'username': 'student1', 'password': 'test-password'},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['user']['role'], 'student')

        # 2. Test standard user success
        standard_user = User.objects.create_user(username='user1', password='test-password')
        standard_user.profile.role = 'user'
        standard_user.profile.save()

        response = APIClient().post(
            '/api/auth/mobile/login/',
            {'username': 'user1', 'password': 'test-password'},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['user']['role'], 'user')

        # 3. Test admin block returns generic error message
        admin_user = User.objects.create_user(username='admin1', password='test-password')
        admin_user.profile.role = 'admin'
        admin_user.profile.save()

        response = APIClient().post(
            '/api/auth/mobile/login/',
            {'username': 'admin1', 'password': 'test-password'},
            format='json',
        )
        self.assertEqual(response.status_code, 401)
        self.assertIn('No active account found', str(response.data))

        # 4. Test clinic staff / responder block returns generic error message
        staff_user = User.objects.create_user(username='staff1', password='test-password')
        staff_user.profile.role = 'clinic_staff'
        staff_user.profile.save()

        response = APIClient().post(
            '/api/auth/mobile/login/',
            {'username': 'staff1', 'password': 'test-password'},
            format='json',
        )
        self.assertEqual(response.status_code, 401)
        self.assertIn('No active account found', str(response.data))


class RegistrationTests(TestCase):
    @patch('accounts.serializers.sync_user_to_supabase')
    def test_registration_creates_user_and_syncs_profile_without_password(self, sync_user):
        response = APIClient().post(
            '/api/auth/register/',
            {
                'username': 'safe-user',
                'email': 'safe@example.com',
                'password': 'safe-user-password',
                'name': 'Safe User',
                'student_id': 'STU-1',
                'course': 'Computer Science',
                'phone_number': '555-0100',
                'role': 'admin',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['user']['role'], 'user')
        self.assertTrue(response.data['supabase_synced'])
        user = User.objects.get(username='safe-user')
        self.assertTrue(user.check_password('safe-user-password'))
        self.assertEqual(user.profile.name, 'Safe User')
        self.assertEqual(user.profile.student_id, 'STU-1')
        sync_user.assert_called_once_with(user, user.profile)

    @patch(
        'accounts.serializers.sync_user_to_supabase',
        side_effect=SupabaseRequestFailed("Supabase failure"),
    )
    def test_registration_reports_unavailable_supabase_sync(self, _sync_user):
        response = APIClient().post(
            '/api/auth/register/',
            {
                'username': 'failed-sync',
                'email': 'failed@example.com',
                'password': 'safe-user-password',
                'name': 'Failed Sync',
            },
            format='json',
        )
        self.assertEqual(response.status_code, 201)
        self.assertFalse(response.data['supabase_synced'])
        self.assertIn('sync_warning', response.data)


class ProfileSyncEndpointTests(TestCase):
    @patch('accounts.views.sync_user_to_supabase')
    def test_authenticated_user_can_retry_profile_sync(self, sync_user):
        user = User.objects.create_user(username='sync-owner', password='test-password')
        client = APIClient()
        client.force_authenticate(user=user)

        response = client.post('/api/auth/profile/sync/')

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['supabase_synced'])
        self.assertIsNone(response.data['sync_warning'])
        sync_user.assert_called_once_with(user, user.profile)

    @patch(
        'accounts.views.sync_user_to_supabase',
        side_effect=SupabaseRequestFailed("Supabase failure"),
    )
    def test_sync_endpoint_reports_supabase_failure(self, _sync_user):
        user = User.objects.create_user(username='sync-failure', password='test-password')
        client = APIClient()
        client.force_authenticate(user=user)

        response = client.post('/api/auth/profile/sync/')

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data['supabase_synced'])
        self.assertEqual(response.data['sync_warning'], "Supabase failure")

    def test_sync_endpoint_requires_authentication(self):
        response = APIClient().post('/api/auth/profile/sync/')

        self.assertEqual(response.status_code, 401)


class ProfileUpdateTests(TestCase):
    @patch('accounts.views.sync_user_to_supabase')
    def test_authenticated_user_can_update_profile_and_sync_to_supabase(self, sync_user):
        user = User.objects.create_user(username='update-user', password='test-password')
        client = APIClient()
        client.force_authenticate(user=user)

        response = client.put(
            '/api/auth/profile/update/',
            {
                'name': 'Updated Name',
                'username': 'new-username-val',
                'email': 'updated@campus.edu',
                'student_id': 'STU-999',
                'course': 'Information Technology',
                'phone_number': '555-9999',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['user']['name'], 'Updated Name')
        self.assertEqual(response.data['user']['username'], 'new-username-val')
        self.assertEqual(response.data['user']['email'], 'updated@campus.edu')
        self.assertEqual(response.data['user']['student_id'], 'STU-999')
        self.assertTrue(response.data['supabase_synced'])
        sync_user.assert_called_once()

    @patch('accounts.views.sync_user_to_supabase', side_effect=SupabaseRequestFailed("Supabase timeout"))
    def test_profile_update_handles_username_change_and_sync_failure(self, sync_user):
        user = User.objects.create_user(username='old-username', password='test-password')
        client = APIClient()
        client.force_authenticate(user=user)

        response = client.put(
            '/api/auth/profile/update/',
            {
                'name': 'Clyde Olana',
                'username': 'new-username',
                'email': 'olanaclyde0@gmail.com',
                'student_id': '2028303202',
                'course': 'Information Technology',
                'phone_number': '81645161',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data['supabase_synced'])
        self.assertEqual(response.data['sync_warning'], "Supabase timeout")
       
        user.refresh_from_db()
        self.assertEqual(user.username, 'new-username')
        self.assertEqual(user.email, 'olanaclyde0@gmail.com')
        self.assertEqual(user.profile.name, 'Clyde Olana')
        self.assertEqual(user.profile.student_id, '2028303202')


class UserEmailSyncTests(TestCase):
    @patch('accounts.utils.supabase_request')
    def test_user_email_included_in_supabase_sync_payload(self, mock_supabase_request):
        mock_supabase_request.return_value.status_code = 200
        user = User.objects.create_user(
            username='email-sync-user',
            email='syncme@campus.edu',
            password='test-password'
        )
        user.profile.name = 'Email Sync'
        user.profile.save()

        sync_user_to_supabase(user, user.profile)

        self.assertTrue(mock_supabase_request.called)
        user_call = mock_supabase_request.call_args_list[0]
        self.assertEqual(user_call.args[0], 'POST')
        self.assertEqual(user_call.args[1], 'user')
        payload = user_call.kwargs.get('payload', {})
        self.assertEqual(payload.get('email'), 'syncme@campus.edu')


class PasswordChangeTests(TestCase):
    def test_authenticated_user_can_change_password(self):
        user = User.objects.create_user(username='pwd-user', password='old-password')
        client = APIClient()
        client.force_authenticate(user=user)

        response = client.post(
            '/api/auth/profile/change-password/',
            {
                'current_password': 'old-password',
                'new_password': 'new-secure-password',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['message'], 'Password updated successfully.')
        user.refresh_from_db()
        self.assertTrue(user.check_password('new-secure-password'))

    def test_password_change_requires_correct_current_password(self):
        user = User.objects.create_user(username='pwd-user2', password='old-password')
        client = APIClient()
        client.force_authenticate(user=user)

        response = client.post(
            '/api/auth/profile/change-password/',
            {
                'current_password': 'wrong-password',
                'new_password': 'new-secure-password',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('Current password is incorrect', response.data['error'])

    def test_password_change_enforces_minimum_length(self):
        user = User.objects.create_user(username='pwd-user3', password='old-password')
        client = APIClient()
        client.force_authenticate(user=user)

        response = client.post(
            '/api/auth/profile/change-password/',
            {
                'current_password': 'old-password',
                'new_password': 'short',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('at least 6 characters', response.data['error'])

    def test_password_change_requires_authentication(self):
        response = client = APIClient().post(
            '/api/auth/profile/change-password/',
            {
                'current_password': 'old-password',
                'new_password': 'new-secure-password',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 401)


class SupabaseAccessTokenTests(TestCase):
    @override_settings(
        SUPABASE_URL='https://project.supabase.co',
        SUPABASE_JWT_SECRET='test-signing-secret-with-at-least-32-bytes',
    )
    def test_custom_token_contains_only_server_authorized_user_claims(self):
        user = User.objects.create_user(username='supabase-admin', password='test-password')
        user.profile.role = 'admin'
        user.profile.save()

        token = create_supabase_access_token(user, user.profile)
        claims = jwt.decode(
            token,
            'test-signing-secret-with-at-least-32-bytes',
            algorithms=['HS256'],
            audience='authenticated',
            issuer='https://project.supabase.co/auth/v1',
        )

        self.assertEqual(claims['sub'], str(user.pk))
        self.assertEqual(claims['role'], 'authenticated')
        self.assertEqual(claims['app_role'], 'admin')
        self.assertNotIn('password', claims)

    @override_settings(SUPABASE_URL='', SUPABASE_JWT_SECRET='')
    def test_token_generation_requires_server_supabase_configuration(self):
        user = User.objects.create_user(username='no-supabase-token', password='test-password')

        with self.assertRaises(SupabaseTokenNotConfigured):
            create_supabase_access_token(user, user.profile)

    @override_settings(
        SUPABASE_URL='https://project.supabase.co',
        SUPABASE_JWT_SECRET='test-signing-secret-with-at-least-32-bytes',
    )
    def test_authenticated_user_can_request_a_fresh_supabase_token(self):
        user = User.objects.create_user(username='token-refresh', password='test-password')
        client = APIClient()
        client.force_authenticate(user=user)

        response = client.post('/api/auth/token/supabase/')

        self.assertEqual(response.status_code, 200)
        self.assertIn('supabase_access_token', response.data)

    @override_settings(
        SUPABASE_URL='https://project.supabase.co',
        SUPABASE_JWT_SECRET='test-signing-secret-with-at-least-32-bytes',
    )
    @patch('accounts.serializers.sync_user_to_supabase')
    def test_login_includes_supabase_access_token(self, _sync_user):
        User.objects.create_user(username='login-token', password='test-password')

        response = APIClient().post(
            '/api/auth/login/',
            {'username': 'login-token', 'password': 'test-password'},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertIsInstance(response.data['supabase_access_token'], str)


class UserTableMappingTests(TestCase):
    def test_profile_uses_exact_user_table_and_column_names(self):
        self.assertEqual(UserProfile._meta.db_table, 'user')
        self.assertEqual(UserProfile._meta.get_field('user').column, 'user_id')
        self.assertEqual(UserProfile._meta.get_field('role').column, 'user_type')

    @override_settings(
        SUPABASE_URL='https://project.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY='sb_secret_test-key',
    )
    def test_new_supabase_secret_key_is_not_sent_as_bearer_token(self):
        headers = _supabase_headers()

        self.assertEqual(headers['apikey'], 'sb_secret_test-key')
        self.assertNotIn('Authorization', headers)

    @override_settings(
        SUPABASE_URL='https://project.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY='legacy-service-role-jwt',
    )
    def test_legacy_service_role_key_is_sent_as_bearer_token(self):
        headers = _supabase_headers()

        self.assertEqual(headers['apikey'], 'legacy-service-role-jwt')
        self.assertEqual(headers['Authorization'], 'Bearer legacy-service-role-jwt')

    @patch('accounts.utils.supabase_request')
    def test_admin_sync_uses_supabase_table_names_without_password(self, supabase_request):
        user = User.objects.create_user(username='mirrored-admin', password='local-password')
        user.profile.role = 'admin'
        user.profile.name = 'Mirrored Admin'
        user.profile.save()

        sync_user_to_supabase(user, user.profile)

        self.assertEqual(supabase_request.call_count, 2)
        user_call, admin_call = supabase_request.call_args_list
        self.assertEqual(user_call.args[:2], ('POST', 'user'))
        self.assertEqual(user_call.kwargs['payload']['user_id'], user.pk)
        self.assertEqual(user_call.kwargs['payload']['user_type'], 'ADMIN')
        self.assertNotIn('password', user_call.kwargs['payload'])
        self.assertEqual(admin_call.args[:2], ('POST', 'admin'))
        self.assertEqual(admin_call.kwargs['payload'], {'user_id': user.pk})

    @patch('accounts.utils.supabase_request')
    def test_non_admin_sync_removes_supabase_admin_record(self, supabase_request):
        user = User.objects.create_user(username='mirrored-user', password='local-password')

        sync_user_to_supabase(user, user.profile)

        self.assertEqual(supabase_request.call_count, 2)
        self.assertEqual(supabase_request.call_args_list[1].args[:2], ('DELETE', 'admin'))
        self.assertEqual(
            supabase_request.call_args_list[1].kwargs['params'],
            {'user_id': f'eq.{user.pk}'},
        )


class SupabaseBackfillCommandTests(TestCase):
    @override_settings(
        SUPABASE_URL='https://project.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY='test-server-key',
    )
    @patch('accounts.management.commands.sync_users_to_supabase.sync_user_to_supabase')
    def test_command_syncs_existing_profiles(self, sync_user):
        first_user = User.objects.create_user(username='backfill-one', password='test-password')
        second_user = User.objects.create_user(username='backfill-two', password='test-password')
        output = StringIO()

        call_command('sync_users_to_supabase', stdout=output)

        self.assertEqual(sync_user.call_count, 2)
        self.assertIn(f'Synchronized local user {first_user.pk}.', output.getvalue())
        self.assertIn(f'Synchronized local user {second_user.pk}.', output.getvalue())
        self.assertIn('2 synchronized, 0 failed', output.getvalue())

    @override_settings(SUPABASE_URL='', SUPABASE_SERVICE_ROLE_KEY='')
    def test_command_requires_supabase_credentials(self):
        with self.assertRaisesMessage(CommandError, 'Set SUPABASE_URL'):
            call_command('sync_users_to_supabase', stdout=StringIO(), stderr=StringIO())


class PasswordResetOtpTests(TestCase):
    def setUp(self):
        cache.clear()
        self.admin_user = User.objects.create_user(
            username='admin-reset',
            email='admin@campus.edu',
            password='old-secure-password'
        )
        self.admin_user.profile.role = 'admin'
        self.admin_user.profile.save()

    def test_password_reset_request_generates_and_sends_otp(self):
        response = APIClient().post(
            '/api/auth/password-reset/',
            {'target': 'admin@campus.edu', 'admin_flow': True},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn('OTP code sent successfully', response.data['detail'])
        self.assertIsNotNone(cache.get('otp_admin@campus.edu'))

    def test_password_reset_request_restricts_non_admin_in_admin_flow(self):
        User.objects.create_user(
            username='student-reset',
            email='student@campus.edu',
            password='old-password'
        )
        response = APIClient().post(
            '/api/auth/password-reset/',
            {'target': 'student@campus.edu', 'admin_flow': True},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn('If an associated admin account exists', response.data['detail'])
        self.assertIsNone(cache.get('otp_student@campus.edu'))

    def test_verify_otp_success_and_failure(self):
        cache.set('otp_admin@campus.edu', '654321', timeout=600)
        cache.set('otp_attempts_admin@campus.edu', 0, timeout=600)

        client = APIClient()

        res_fail = client.post(
            '/api/auth/verify-otp/',
            {'target': 'admin@campus.edu', 'otp': '000000'},
            format='json',
        )
        self.assertEqual(res_fail.status_code, 400)
        self.assertIn('Invalid or expired OTP code', res_fail.data['detail'])

        res_success = client.post(
            '/api/auth/verify-otp/',
            {'target': 'admin@campus.edu', 'otp': '654321'},
            format='json',
        )
        self.assertEqual(res_success.status_code, 200)
        self.assertIn('OTP verified successfully', res_success.data['detail'])

    def test_verify_otp_locks_out_after_max_attempts(self):
        cache.set('otp_admin@campus.edu', '654321', timeout=600)
        cache.set('otp_attempts_admin@campus.edu', 5, timeout=600)

        response = APIClient().post(
            '/api/auth/verify-otp/',
            {'target': 'admin@campus.edu', 'otp': '654321'},
            format='json',
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('Maximum verification attempts exceeded', response.data['detail'])

    def test_confirm_password_reset_updates_password_and_clears_cache(self):
        cache.set('otp_admin@campus.edu', '654321', timeout=600)

        response = APIClient().post(
            '/api/auth/confirm-password-reset/',
            {
                'target': 'admin@campus.edu',
                'otp': '654321',
                'new_password': 'brand-new-secure-password',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn('Password updated successfully', response.data['detail'])

        self.admin_user.refresh_from_db()
        self.assertTrue(self.admin_user.check_password('brand-new-secure-password'))
        self.assertIsNone(cache.get('otp_admin@campus.edu'))

    def test_confirm_password_reset_rejects_short_passwords(self):
        cache.set('otp_admin@campus.edu', '654321', timeout=600)

        response = APIClient().post(
            '/api/auth/confirm-password-reset/',
            {
                'target': 'admin@campus.edu',
                'otp': '654321',
                'new_password': 'short',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('Password must be at least 6 characters', response.data['detail'])