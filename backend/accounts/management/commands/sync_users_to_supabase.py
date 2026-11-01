from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from accounts.models import UserProfile
from accounts.utils import SupabaseNotConfigured, SupabaseRequestFailed, sync_user_to_supabase


class Command(BaseCommand):
    help = 'Sync all local Django user profiles to the Supabase user and admin tables.'

    def handle(self, *args, **options):
        if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
            raise CommandError(
                'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the Django process environment first.'
            )

        user_model = get_user_model()
        users = user_model.objects.order_by('pk')
        synced = 0
        failed = 0

        for user in users.iterator():
            profile, _ = UserProfile.objects.get_or_create(user=user)
            try:
                sync_user_to_supabase(user, profile)
            except (SupabaseNotConfigured, SupabaseRequestFailed) as exc:
                failed += 1
                self.stderr.write(
                    self.style.WARNING(f'User {user.pk} was not synchronized: {exc.detail}')
                )
            else:
                synced += 1
                self.stdout.write(f'Synchronized local user {user.pk}.')

        self.stdout.write(f'Sync complete: {synced} synchronized, {failed} failed.')
        if failed:
            raise CommandError(f'{failed} user profile(s) could not be synchronized.')
