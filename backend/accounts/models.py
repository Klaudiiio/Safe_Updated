from django.contrib.auth.models import User
from django.db import models

class UserProfile(models.Model):
    ROLE_CHOICES = (
        ('user', 'User'),
        ('clinic_staff', 'Clinic Staff'),
        ('admin', 'Admin'),
    )
    
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='profile',
        db_column='user_id',
        primary_key=True,
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='user', db_column='user_type')
    name = models.CharField(max_length=50, blank=True)
    student_id = models.CharField(max_length=100, blank=True)
    course = models.CharField(max_length=100, blank=True)
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'user'

    def __str__(self):
        return f"{self.user.username} ({self.role})"