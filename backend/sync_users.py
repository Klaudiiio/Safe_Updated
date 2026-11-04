import os
import django

from dotenv import load_dotenv
load_dotenv() # This loads variables from your .env file into os.environ

def sync_missing_users():
    # 1. Initialize Django environment using your project's settings
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
    django.setup()

    from django.contrib.auth import get_user_model
    from supabase import create_client, Client

    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        print("Error: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set in your environment variables.")
        return

    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    User = get_user_model()

    print("Fetching local Django users...")
    local_users = User.objects.all()
    
    for u in local_users:
        # Check if user already exists in Supabase by username
        response = supabase.table('user').select('user_id').eq('username', u.username).execute()
        
        if response.data and len(response.data) > 0:
            print(f"User '{u.username}' already exists in Supabase. Skipping.")
            continue
            
        # Payload matching your Supabase table schema
        payload = {
            "user_id": u.id,
            "name": getattr(u, 'name', u.username),
            "username": u.username,
            "course": getattr(u, 'course', 'General'),
            "phone_number": getattr(u, 'phone_number', ''),
            "user_type": getattr(u, 'user_type', 'user'),
            "student_id": getattr(u, 'student_id', f"ID-{u.id}")
        }
        
        # Insert into Supabase
        supabase.table('user').insert(payload).execute()
        print(f"Successfully synced missing user: {u.username}")

if __name__ == "__main__":
    sync_missing_users()