from datetime import datetime, timedelta, timezone
from io import StringIO
from unittest.mock import MagicMock, patch


import jwt
from django.contrib.auth.models import User
from django.core.cache import cache
from django.core.management import call_command, CommandError
from django.test import TestCase, override_settings
from rest_framework.test import APIClient


from .earthquake_service import (
    classify_event,
    create_and_sync_simulation_earthquake,
    fetch_earthquakes_from_supabase,
    fetch_phivolcs_raw_events,
    filter_events_for_feed,
    filter_events_for_hardware_alarm_sync,
    get_evaluated_earthquakes,
    sync_earthquakes_to_supabase,
    validate_and_normalize_event,
)
from .models import UserProfile
from .supabase_tokens import SupabaseTokenNotConfigured, create_supabase_access_token
from .utils import SupabaseRequestFailed, sync_user_to_supabase
from .views import _merge_and_deduplicate_events


def _make_normalized_event(
    ext_id: str = "phivolcs:eq-101",
    magnitude: float = 4.8,
    place: str = "28 km SE of Cagayan de Oro City, Misamis Oriental",
    distance_from_cdo_km: float = 28.0,
    classification: str = "earthquake_alert",
    source: str = "PHIVOLCS",
    minutes_ago: int = 10,
    evaluated_minutes_ago: int = 5,
    reported_intensity: str | None = "IV",
) -> dict:
    now = datetime.now(timezone.utc)
    occurred_at = (now - timedelta(minutes=minutes_ago)).isoformat()
    evaluated_at = (now - timedelta(minutes=evaluated_minutes_ago)).isoformat()
    occ_dt = datetime.fromisoformat(occurred_at)

    return {
        "id": ext_id,
        "external_event_id": ext_id,
        "magnitude": magnitude,
        "place": place,
        "latitude": 8.28,
        "longitude": 124.85,
        "depth_km": 12.0,
        "distance_from_cdo_km": distance_from_cdo_km,
        "reported_intensity": reported_intensity,
        "classification": classification,
        "source": source,
        "url": "https://earthquake.phivolcs.dost.gov.ph/",
        "event_occurred_at": occurred_at,
        "time": int(occ_dt.timestamp() * 1000),
        "evaluated_at": evaluated_at,
    }


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
            '/api/auth/login/mobile/',
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
            '/api/auth/login/mobile/',
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
            '/api/auth/login/mobile/',
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
            '/api/auth/login/mobile/',
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
    @patch('accounts.utils.requests.post')
    def test_user_email_included_in_supabase_sync_payload(self, mock_post):
        mock_post.return_value = MagicMock(status_code=201, text='')
        user = User.objects.create_user(
            username='email-sync-user',
            email='syncme@campus.edu',
            password='test-password'
        )
        user.profile.name = 'Email Sync'
        user.profile.save()


        sync_user_to_supabase(user, user.profile)


        self.assertTrue(mock_post.called)
        payload = mock_post.call_args.kwargs.get('json', {})
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
        response = APIClient().post(
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
    @patch('accounts.utils.requests.post')
    def test_new_supabase_secret_key_is_not_sent_as_bearer_token(self, mock_post):
        mock_post.return_value = MagicMock(status_code=201, text='')
        user = User.objects.create_user(username='secret-key-user', password='local-password')


        sync_user_to_supabase(user, user.profile)


        headers = mock_post.call_args.kwargs.get('headers', {})
        self.assertEqual(headers.get('apikey'), 'sb_secret_test-key')
        self.assertNotIn('Authorization', headers)


    @override_settings(
        SUPABASE_URL='https://project.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY='legacy-service-role-jwt',
    )
    @patch('accounts.utils.requests.post')
    def test_legacy_service_role_key_is_sent_as_bearer_token(self, mock_post):
        mock_post.return_value = MagicMock(status_code=201, text='')
        user = User.objects.create_user(username='legacy-key-user', password='local-password')


        sync_user_to_supabase(user, user.profile)


        headers = mock_post.call_args.kwargs.get('headers', {})
        self.assertEqual(headers.get('apikey'), 'legacy-service-role-jwt')
        self.assertEqual(headers.get('Authorization'), 'Bearer legacy-service-role-jwt')


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


class EarthquakeMonitoringSyncTests(TestCase):
    @override_settings(
        SUPABASE_URL='https://project.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY='test-service-role-key',
    )
    @patch('accounts.earthquake_service.requests.post')
    def test_sync_payload_columns_merge_duplicates_and_omits_ack_hardware_fields(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.ok = True
        mock_post.return_value = mock_resp

        ev1 = _make_normalized_event(
            ext_id='phivolcs:eq-dup-1',
            magnitude=4.6,
            place='25 km SE of Cagayan de Oro, Philippines',
            distance_from_cdo_km=25.0,
            classification='earthquake_alert',
            minutes_ago=20,
            evaluated_minutes_ago=15,
        )
        ev1_updated = _make_normalized_event(
            ext_id='phivolcs:eq-dup-1',
            magnitude=4.9,
            place='25 km SE of Cagayan de Oro, Philippines',
            distance_from_cdo_km=25.0,
            classification='earthquake_alert',
            minutes_ago=20,
            evaluated_minutes_ago=2,
        )

        sync_earthquakes_to_supabase([ev1, ev1_updated])

        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args
        self.assertEqual(
            args[0],
            'https://project.supabase.co/rest/v1/earthquake_monitoring?on_conflict=external_event_id',
        )
        self.assertEqual(kwargs['headers']['Prefer'], 'resolution=merge-duplicates,return=minimal')
        self.assertEqual(len(kwargs['json']), 1)

        row = kwargs['json'][0]
        self.assertEqual(row['external_event_id'], 'phivolcs:eq-dup-1')
        self.assertEqual(row['magnitude'], 4.9)
        self.assertEqual(row['distance_from_cdo_km'], 25.0)
        self.assertEqual(row['classification'], 'earthquake_alert')
        self.assertEqual(row['source'], 'PHIVOLCS')
        self.assertIn('event_occurred_at', row)
        self.assertIn('evaluated_at', row)

        forbidden_fields = {
            'alert_active',
            'buzzer_enabled',
            'led_enabled',
            'led_color',
            'alert_pattern',
            'acknowledged',
            'acknowledged_by',
            'acknowledged_at',
        }
        self.assertTrue(forbidden_fields.isdisjoint(set(row.keys())))

    @override_settings(
        SUPABASE_URL='https://project.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY='test-service-role-key',
    )
    @patch('accounts.earthquake_service.requests.get')
    def test_fetch_earthquakes_from_supabase_maps_api_shape(self, mock_get):
        ev = _make_normalized_event(
            ext_id='phivolcs:eq-m18-db',
            magnitude=1.8,
            place='15 km SE of Cagayan de Oro, Misamis Oriental',
            distance_from_cdo_km=15.0,
            classification='monitoring',
            reported_intensity=None,
            minutes_ago=12,
            evaluated_minutes_ago=8,
        )

        mock_resp = MagicMock()
        mock_resp.ok = True
        mock_resp.json.return_value = [
            {
                'id': 99,
                'external_event_id': ev['external_event_id'],
                'magnitude': ev['magnitude'],
                'place': ev['place'],
                'depth_km': ev['depth_km'],
                'distance_from_cdo_km': ev['distance_from_cdo_km'],
                'reported_intensity': ev['reported_intensity'],
                'classification': ev['classification'],
                'source': ev['source'],
                'event_occurred_at': ev['event_occurred_at'],
                'evaluated_at': ev['evaluated_at'],
            }
        ]
        mock_get.return_value = mock_resp

        rows = fetch_earthquakes_from_supabase(limit=25)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['id'], 'phivolcs:eq-m18-db')
        self.assertEqual(rows[0]['external_event_id'], 'phivolcs:eq-m18-db')
        self.assertEqual(rows[0]['magnitude'], 1.8)
        self.assertEqual(rows[0]['classification'], 'monitoring')
        self.assertEqual(rows[0]['event_occurred_at'], ev['event_occurred_at'])
        self.assertIsInstance(rows[0]['time'], int)

    @override_settings(
        SUPABASE_URL='https://project.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY='test-service-role-key',
        EARTHQUAKE_HISTORY_MAX_AGE_DAYS=30.0,
        EARTHQUAKE_REGIONAL_RADIUS_KM=200.0,
        EARTHQUAKE_STRICT_REGIONAL_RADIUS=True,
    )
    @patch('accounts.earthquake_service.requests.get')
    def test_supabase_history_includes_29d_excludes_31d_and_enforces_200km_radius(self, mock_get):
        now = datetime.now(timezone.utc)
        ev_29d = _make_normalized_event(
            ext_id='phivolcs:eq-29d',
            magnitude=3.2,
            place='22 km SE of Cagayan de Oro',
            distance_from_cdo_km=22.0,
            classification='advisory',
            minutes_ago=29 * 24 * 60,
        )
        ev_31d = _make_normalized_event(
            ext_id='phivolcs:eq-31d',
            magnitude=4.8,
            place='25 km SE of Cagayan de Oro',
            distance_from_cdo_km=25.0,
            classification='earthquake_alert',
            minutes_ago=31 * 24 * 60,
        )
        ev_far = _make_normalized_event(
            ext_id='phivolcs:eq-260km',
            magnitude=5.2,
            place='Distant Fault Zone',
            distance_from_cdo_km=260.0,
            classification='monitoring',
            minutes_ago=2 * 24 * 60,
        )

        mock_resp = MagicMock()
        mock_resp.ok = True
        mock_resp.json.return_value = [
            {
                'id': 1,
                'external_event_id': ev_29d['external_event_id'],
                'magnitude': ev_29d['magnitude'],
                'place': ev_29d['place'],
                'depth_km': ev_29d['depth_km'],
                'distance_from_cdo_km': ev_29d['distance_from_cdo_km'],
                'reported_intensity': ev_29d['reported_intensity'],
                'classification': ev_29d['classification'],
                'source': 'PHIVOLCS',
                'event_occurred_at': ev_29d['event_occurred_at'],
                'evaluated_at': ev_29d['evaluated_at'],
            },
            {
                'id': 2,
                'external_event_id': ev_31d['external_event_id'],
                'magnitude': ev_31d['magnitude'],
                'place': ev_31d['place'],
                'depth_km': ev_31d['depth_km'],
                'distance_from_cdo_km': ev_31d['distance_from_cdo_km'],
                'reported_intensity': ev_31d['reported_intensity'],
                'classification': ev_31d['classification'],
                'source': 'PHIVOLCS',
                'event_occurred_at': ev_31d['event_occurred_at'],
                'evaluated_at': ev_31d['evaluated_at'],
            },
            {
                'id': 3,
                'external_event_id': ev_far['external_event_id'],
                'magnitude': ev_far['magnitude'],
                'place': ev_far['place'],
                'depth_km': ev_far['depth_km'],
                'distance_from_cdo_km': ev_far['distance_from_cdo_km'],
                'reported_intensity': ev_far['reported_intensity'],
                'classification': ev_far['classification'],
                'source': 'PHIVOLCS',
                'event_occurred_at': ev_far['event_occurred_at'],
                'evaluated_at': ev_far['evaluated_at'],
            },
        ]
        mock_get.return_value = mock_resp

        rows = fetch_earthquakes_from_supabase()
        self.assertEqual([r['external_event_id'] for r in rows], ['phivolcs:eq-29d'])

        params = mock_get.call_args.kwargs['params']
        cutoff_str = params['event_occurred_at'].removeprefix('gte.')
        cutoff_dt = datetime.fromisoformat(cutoff_str)
        expected_30d = now - timedelta(days=30)
        self.assertLess(abs((cutoff_dt - expected_30d).total_seconds()), 10)

    @override_settings(
        SUPABASE_URL='https://project.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY='test-service-role-key',
        EARTHQUAKE_HISTORY_PAGE_SIZE=2,
        EARTHQUAKE_HISTORY_MAX_ROWS=10,
    )
    @patch('accounts.earthquake_service.requests.get')
    def test_supabase_history_paginates_across_multiple_batches(self, mock_get):
        page_1_rows = [
            {
                'id': 1,
                'external_event_id': 'phivolcs:p1-a',
                'magnitude': 2.5,
                'place': 'Page 1 A',
                'depth_km': 10.0,
                'distance_from_cdo_km': 20.0,
                'classification': 'monitoring',
                'source': 'PHIVOLCS',
                'event_occurred_at': (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat(),
            },
            {
                'id': 2,
                'external_event_id': 'phivolcs:p1-b',
                'magnitude': 2.7,
                'place': 'Page 1 B',
                'depth_km': 12.0,
                'distance_from_cdo_km': 25.0,
                'classification': 'monitoring',
                'source': 'PHIVOLCS',
                'event_occurred_at': (datetime.now(timezone.utc) - timedelta(hours=3)).isoformat(),
            },
        ]
        page_2_rows = [
            {
                'id': 3,
                'external_event_id': 'phivolcs:p2-c',
                'magnitude': 3.1,
                'place': 'Page 2 C',
                'depth_km': 14.0,
                'distance_from_cdo_km': 30.0,
                'classification': 'advisory',
                'source': 'PHIVOLCS',
                'event_occurred_at': (datetime.now(timezone.utc) - timedelta(hours=4)).isoformat(),
            }
        ]

        r1 = MagicMock(ok=True)
        r1.json.return_value = page_1_rows
        r2 = MagicMock(ok=True)
        r2.json.return_value = page_2_rows
        mock_get.side_effect = [r1, r2]

        rows = fetch_earthquakes_from_supabase()
        self.assertEqual(mock_get.call_count, 2)
        self.assertEqual(
            [r['external_event_id'] for r in rows],
            ['phivolcs:p1-a', 'phivolcs:p1-b', 'phivolcs:p2-c'],
        )

    def test_merge_and_deduplicate_removes_duplicates_and_keeps_newest(self):
        db_older = _make_normalized_event(
            ext_id='phivolcs:eq-merge-1',
            magnitude=4.4,
            evaluated_minutes_ago=25,
        )
        live_newer = _make_normalized_event(
            ext_id='phivolcs:eq-merge-1',
            magnitude=4.7,
            evaluated_minutes_ago=1,
        )
        m1_8_recorded = _make_normalized_event(
            ext_id='phivolcs:eq-m18',
            magnitude=1.8,
            classification='monitoring',
            evaluated_minutes_ago=6,
        )

        merged = _merge_and_deduplicate_events([db_older, m1_8_recorded], [live_newer])
        by_id = {item['external_event_id']: item for item in merged}

        self.assertEqual(len(merged), 2)
        self.assertEqual(by_id['phivolcs:eq-merge-1']['magnitude'], 4.7)
        self.assertEqual(by_id['phivolcs:eq-m18']['magnitude'], 1.8)

    @override_settings(EARTHQUAKE_MIN_FEED_MAGNITUDE=4.0)
    @patch('accounts.views.cache')
    @patch('accounts.views._try_sync_earthquakes_throttled')
    @patch('accounts.views.get_evaluated_earthquakes')
    @patch('accounts.views._safe_fetch_persisted_earthquakes')
    def test_feed_cutoff_filters_m1_8_by_default_and_includes_when_min_magnitude_zero(
        self,
        mock_db_fetch,
        mock_eval_fetch,
        _mock_sync,
        mock_cache,
    ):
        mock_cache.get.return_value = None
        m1_8 = _make_normalized_event(
            ext_id='phivolcs:eq-m18',
            magnitude=1.8,
            classification='monitoring',
            minutes_ago=8,
        )
        m4_6 = _make_normalized_event(
            ext_id='phivolcs:eq-m46',
            magnitude=4.6,
            classification='earthquake_alert',
            minutes_ago=4,
        )
        mock_db_fetch.return_value = [m1_8]
        mock_eval_fetch.return_value = [m4_6]

        client = APIClient()
        client.force_authenticate(user=MagicMock(is_authenticated=True))

        resp_default = client.get('/api/auth/earthquakes/')
        self.assertEqual(resp_default.status_code, 200)
        self.assertEqual([e['id'] for e in resp_default.json()['events']], ['phivolcs:eq-m46'])

        resp_all = client.get('/api/auth/earthquakes/?min_magnitude=0')
        self.assertEqual(resp_all.status_code, 200)
        self.assertCountEqual([e['id'] for e in resp_all.json()['events']], ['phivolcs:eq-m18', 'phivolcs:eq-m46'])


class EarthquakeSimulationEndpointTests(TestCase):
    def setUp(self):
        cache.clear()
        self.student_user = User.objects.create_user(username='sim-student', password='test-password')
        self.student_user.profile.role = 'student'
        self.student_user.profile.save()

        self.staff_user = User.objects.create_user(
            username='sim-clinic-staff',
            password='test-password',
            is_staff=True,
        )
        self.staff_user.profile.role = 'clinic_staff'
        self.staff_user.profile.save()

        self.admin_user = User.objects.create_user(
            username='sim-admin',
            password='test-password',
            is_staff=True,
            is_superuser=True,
        )
        self.admin_user.profile.role = 'admin'
        self.admin_user.profile.save()

    def test_unauthenticated_request_is_rejected_with_401(self):
        response = APIClient().post(
            '/api/auth/earthquakes/simulate/',
            {'magnitude': 6.0, 'classification': 'earthquake_alert'},
            format='json',
        )
        self.assertEqual(response.status_code, 401)

    def test_non_staff_student_request_is_rejected_with_403(self):
        client = APIClient()
        client.force_authenticate(user=self.student_user)

        response = client.post(
            '/api/auth/earthquakes/simulate/',
            {'magnitude': 6.0, 'classification': 'earthquake_alert'},
            format='json',
        )
        self.assertEqual(response.status_code, 403)

    @patch('accounts.views.create_and_sync_simulation_earthquake')
    def test_clinic_staff_can_trigger_simulation_with_simulation_test_source(self, mock_create_sim):
        sim_event = _make_normalized_event(
            ext_id='sim:eq-test-001',
            magnitude=6.2,
            place='Simulated Seismic Zone, Cagayan de Oro',
            distance_from_cdo_km=20.0,
            classification='earthquake_alert',
            source='Simulation Test',
            reported_intensity='VI',
        )
        mock_create_sim.return_value = sim_event

        client = APIClient()
        client.force_authenticate(user=self.staff_user)

        response = client.post(
            '/api/auth/earthquakes/simulate/',
            {
                'magnitude': 6.2,
                'place': 'Simulated Seismic Zone, Cagayan de Oro',
                'classification': 'earthquake_alert',
                'depth_km': 15.0,
                'distance_from_cdo_km': 20.0,
                'reported_intensity': 'VI',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['event']['source'], 'Simulation Test')
        self.assertEqual(response.data['event']['external_event_id'], 'sim:eq-test-001')
        mock_create_sim.assert_called_once()

    @override_settings(
        SUPABASE_URL='https://project.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY='test-service-role-key',
    )
    @patch('accounts.earthquake_service.requests.post')
    def test_simulation_persists_with_simulation_test_source_and_is_excluded_from_hardware_alarm_sync(
        self,
        mock_post,
    ):
        mock_resp = MagicMock()
        mock_resp.ok = True
        mock_post.return_value = mock_resp

        sim_event = create_and_sync_simulation_earthquake(
            magnitude=6.4,
            place='Simulated Fault Drill, Misamis Oriental',
            classification='earthquake_alert',
            depth_km=12.0,
            distance_from_cdo_km=18.0,
            reported_intensity='VI',
            created_by=self.admin_user.username,
        )

        self.assertEqual(sim_event['source'], 'Simulation Test')
        self.assertTrue(mock_post.called)
        synced_rows = mock_post.call_args.kwargs['json']
        self.assertEqual(len(synced_rows), 1)
        self.assertEqual(synced_rows[0]['source'], 'Simulation Test')

        live_event = _make_normalized_event(
            ext_id='phivolcs:eq-live-001',
            magnitude=5.8,
            classification='earthquake_alert',
            source='PHIVOLCS',
        )
        hardware_events = filter_events_for_hardware_alarm_sync([sim_event, live_event])
        self.assertEqual([ev['external_event_id'] for ev in hardware_events], ['phivolcs:eq-live-001'])


class PhivolcsEarthquakeServiceTests(TestCase):
    @override_settings(
        PHIVOLCS_EARTHQUAKE_FEED_URL='https://earthquake.phivolcs.dost.gov.ph/feed.json',
        USTP_CDO_LAT=8.481207,
        USTP_CDO_LON=124.669641,
        EARTHQUAKE_MAX_AGE_HOURS=24.0,
        EARTHQUAKE_BLIND_ZONE_RADIUS_KM=15.0,
        EARTHQUAKE_REGIONAL_RADIUS_KM=200.0,
        EARTHQUAKE_STRICT_REGIONAL_RADIUS=True,
    )
    @patch('accounts.earthquake_service.requests.get')
    def test_maps_wrapped_phivolcs_json_response_and_calculates_distance(self, mock_get):
        now_utc = datetime.now(timezone.utc)
        recent_iso = (now_utc - timedelta(minutes=15)).isoformat()


        mock_resp = MagicMock()
        mock_resp.raise_for_status.return_value = None
        mock_resp.json.return_value = {
            'events': [
                {
                    'bulletin_id': '2026-1119-01',
                    'date_time': recent_iso,
                    'lat': '8.481207',
                    'lon': '124.669641',
                    'depth': '12.4 km',
                    'mag': '5.3',
                    'location': 'Cagayan de Oro City, Misamis Oriental',
                    'intensity': 'V',
                    'link': 'https://earthquake.phivolcs.dost.gov.ph/2026/1119-01.html',
                }
            ]
        }
        mock_get.return_value = mock_resp


        events = get_evaluated_earthquakes()


        self.assertEqual(len(events), 1)
        event = events[0]
        self.assertEqual(event['external_event_id'], 'phivolcs:2026-1119-01')
        self.assertEqual(event['source'], 'PHIVOLCS')
        self.assertEqual(event['magnitude'], 5.3)
        self.assertEqual(event['depth_km'], 12.4)
        self.assertEqual(event['distance_from_cdo_km'], 0.0)
        self.assertEqual(event['reported_intensity'], 'V')
        self.assertEqual(event['classification'], 'advisory')
        self.assertEqual(
            event['url'],
            'https://earthquake.phivolcs.dost.gov.ph/2026/1119-01.html',
        )


    @override_settings(
        PHIVOLCS_EARTHQUAKE_FEED_URL='https://earthquake.phivolcs.dost.gov.ph/table.html',
        EARTHQUAKE_BLIND_ZONE_RADIUS_KM=15.0,
        EARTHQUAKE_REGIONAL_RADIUS_KM=200.0,
        EARTHQUAKE_STRICT_REGIONAL_RADIUS=True,
    )
    @patch('accounts.earthquake_service.requests.get')
    def test_parses_html_table_fallback_when_endpoint_returns_html(self, mock_get):
        now_utc = datetime.now(timezone.utc)
        recent_str = (now_utc - timedelta(minutes=20)).strftime('%Y/%m/%d %H:%M:%S')


        mock_resp = MagicMock()
        mock_resp.raise_for_status.return_value = None
        mock_resp.json.side_effect = ValueError('Not JSON')
        mock_resp.text = f"""
        <table>
          <tr>
            <td>{recent_str}</td>
            <td>8.5000</td>
            <td>124.6500</td>
            <td>15</td>
            <td>4.2</td>
            <td>Near Cagayan de Oro</td>
            <td>II</td>
          </tr>
        </table>
        """
        mock_get.return_value = mock_resp


        raw_items = fetch_phivolcs_raw_events()
        self.assertEqual(len(raw_items), 1)
        self.assertEqual(raw_items[0]['location'], 'Near Cagayan de Oro')
        self.assertEqual(raw_items[0]['reported_intensity'], 'II')


        normalized = get_evaluated_earthquakes(raw_items)
        self.assertEqual(len(normalized), 1)
        self.assertEqual(normalized[0]['classification'], 'advisory')


    @override_settings(EARTHQUAKE_MAX_AGE_HOURS=24.0)
    def test_rejects_stale_future_missing_timestamp_and_invalid_values(self):
        now_utc = datetime(2026, 11, 19, 12, 0, 0, tzinfo=timezone.utc)


        stale_event = {
            'id': 'stale-1',
            'occurred_at': (now_utc - timedelta(hours=25)).isoformat(),
            'latitude': 8.48,
            'longitude': 124.67,
            'magnitude': 4.0,
        }
        future_event = {
            'id': 'future-1',
            'occurred_at': (now_utc + timedelta(hours=1)).isoformat(),
            'latitude': 8.48,
            'longitude': 124.67,
            'magnitude': 4.0,
        }
        missing_ts_event = {
            'id': 'no-ts-1',
            'latitude': 8.48,
            'longitude': 124.67,
            'magnitude': 4.0,
        }
        bad_coords_event = {
            'id': 'bad-lat-1',
            'occurred_at': (now_utc - timedelta(minutes=5)).isoformat(),
            'latitude': 145.0,
            'longitude': 124.67,
            'magnitude': 4.0,
        }


        self.assertIsNone(validate_and_normalize_event(stale_event, now_utc=now_utc))
        self.assertIsNone(validate_and_normalize_event(future_event, now_utc=now_utc))
        self.assertIsNone(validate_and_normalize_event(missing_ts_event, now_utc=now_utc))
        self.assertIsNone(validate_and_normalize_event(bad_coords_event, now_utc=now_utc))


    @override_settings(
        EARTHQUAKE_BLIND_ZONE_RADIUS_KM=15.0,
        EARTHQUAKE_REGIONAL_RADIUS_KM=200.0,
        EARTHQUAKE_STRICT_REGIONAL_RADIUS=True,
    )
    def test_strict_200km_mode_excludes_distant_events_and_downgrades_classification(self):
        now_utc = datetime.now(timezone.utc)
        distant_raw = {
            'id': 'far-250km',
            'occurred_at': (now_utc - timedelta(minutes=10)).isoformat(),
            'latitude': 6.3000,
            'longitude': 124.6700,
            'magnitude': 5.8,
            'reported_intensity': 'VI',
        }
        self.assertIsNone(validate_and_normalize_event(distant_raw, now_utc=now_utc))
        self.assertEqual(
            classify_event(magnitude=5.8, distance_from_cdo_km=250.0, reported_intensity='VI'),
            'monitoring',
        )


    @override_settings(
        EARTHQUAKE_BLIND_ZONE_RADIUS_KM=15.0,
        EARTHQUAKE_REGIONAL_RADIUS_KM=200.0,
        EARTHQUAKE_STRICT_REGIONAL_RADIUS=True,
    )
    def test_distance_band_thresholds_and_boundaries(self):
        # 0-15 km regional blind zone: advisory or monitoring (never earthquake_alert from regional feed)
        self.assertEqual(classify_event(5.5, 0.0, 'VI'), 'advisory')
        self.assertEqual(classify_event(2.5, 15.0, 'III'), 'advisory')
        self.assertEqual(classify_event(2.0, 10.0, 'II'), 'monitoring')

        # 15-40 km band: min mag 4.0, min intensity IV
        self.assertEqual(classify_event(4.0, 15.1, 'IV'), 'earthquake_alert')
        self.assertEqual(classify_event(5.0, 40.0, 'V'), 'earthquake_alert')
        self.assertEqual(classify_event(3.9, 30.0, 'IV'), 'advisory')
        self.assertEqual(classify_event(4.8, 30.0, 'III'), 'advisory')

        # 40-100 km band: min mag 5.5, min intensity V
        self.assertEqual(classify_event(5.5, 40.1, 'V'), 'earthquake_alert')
        self.assertEqual(classify_event(6.0, 100.0, 'VI'), 'earthquake_alert')
        self.assertEqual(classify_event(5.4, 75.0, 'V'), 'advisory')
        self.assertEqual(classify_event(5.8, 75.0, 'IV'), 'advisory')

        # 100-200 km band: min mag 6.5, min intensity VI
        self.assertEqual(classify_event(6.5, 100.1, 'VI'), 'earthquake_alert')
        self.assertEqual(classify_event(7.0, 200.0, 'VII'), 'earthquake_alert')
        self.assertEqual(classify_event(6.4, 150.0, 'VI'), 'advisory')
        self.assertEqual(classify_event(6.8, 150.0, 'V'), 'advisory')

        # Beyond 200 km -> monitoring
        self.assertEqual(classify_event(7.2, 250.0, 'VII'), 'monitoring')


    def test_feed_magnitude_filter_does_not_alter_event_classification(self):
        sample_events = [
            {
                'id': 'phivolcs:eq-small-near',
                'magnitude': 2.8,
                'distance_from_cdo_km': 10.0,
                'reported_intensity': 'II',
                'classification': 'monitoring',
            },
            {
                'id': 'phivolcs:eq-m45-far',
                'magnitude': 4.0,
                'distance_from_cdo_km': 180.0,
                'reported_intensity': 'III',
                'classification': 'monitoring',
            },
        ]

        filtered = filter_events_for_feed(sample_events, min_magnitude=4.0)
        self.assertEqual(len(filtered), 1)
        self.assertEqual(filtered[0]['id'], 'phivolcs:eq-m45-far')
        self.assertEqual(filtered[0]['classification'], 'monitoring')
        self.assertEqual(len(sample_events), 2)