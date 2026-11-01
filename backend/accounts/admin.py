from django.contrib import admin
from django.contrib import messages
from .utils import SupabaseNotConfigured, SupabaseRequestFailed, sync_user_to_supabase
from .models import UserProfile


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'name', 'role', 'student_id', 'course', 'phone_number')
    list_filter = ('role',)
    search_fields = ('user__username', 'name', 'student_id', 'course')

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        try:
            sync_user_to_supabase(obj.user, obj)
        except (SupabaseNotConfigured, SupabaseRequestFailed) as exc:
            self.message_user(
                request,
                f'Profile saved locally, but Supabase sync failed: {exc.detail}',
                level=messages.ERROR,
            )
        else:
            self.message_user(request, 'Profile synchronized to Supabase.', level=messages.SUCCESS)
