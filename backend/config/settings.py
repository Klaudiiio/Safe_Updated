from pathlib import Path
import os
from datetime import timedelta
from dotenv import load_dotenv




# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent




# Load environment variables from the .env file in the backend root directory
load_dotenv(os.path.join(BASE_DIR, '.env'))




def _env_float(name: str, default: float) -> float:
    raw = os.environ.get(name, '').strip()
    if not raw:
        return default
    try:
        return float(raw)
    except ValueError:
        return default




def _env_bool(name: str, default: bool) -> bool:
    raw = os.environ.get(name, '').strip().lower()
    if not raw:
        return default
    return raw in ('1', 'true', 'yes', 'on')




# Quick-start development settings - unsuitable for production
SECRET_KEY = 'django-insecure-safe-project-secret-key-change-me-later'




SUPABASE_JWT_SECRET = os.environ.get('SUPABASE_JWT_SECRET', '').strip()




SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(days=1),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': False,
    'BLACKLIST_AFTER_ROTATION': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
    'ALGORITHM': 'HS256',
}




DEBUG = True




# Allowed to accept connections from any local device/network IP
ALLOWED_HOSTS = ['*']




# CORS settings for React/Vite frontends and local mobile clients
CORS_ALLOW_ALL_ORIGINS = True  # Makes local testing from mobile devices seamless




CORS_ALLOWED_ORIGINS = [
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:5175",
    "http://127.0.0.1:5175",
]




# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # Third party apps
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    # Local apps
    'accounts',
]




MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',  # <-- Must be as high as possible
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]




ROOT_URLCONF = 'config.urls'




TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]




WSGI_APPLICATION = 'config.wsgi.application'




# Database
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}




# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]




# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True




# Static files (CSS, JavaScript, Images)
STATIC_URL = 'static/'




# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'




# REST Framework Configuration
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
}




# Supabase server credentials properly pulled from environment variables (server-side only)
SUPABASE_URL = os.environ.get('SUPABASE_URL', '').strip().rstrip('/')
SUPABASE_SERVICE_ROLE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '').strip()
SUPABASE_USERS_TABLE = 'user'




# PHIVOLCS earthquake monitoring & USTP Cagayan de Oro configuration (server-side only)
EARTHQUAKE_DISPLAY_HISTORY_DAYS = _env_float(
    'EARTHQUAKE_DISPLAY_HISTORY_DAYS', 30.0)
PHIVOLCS_EARTHQUAKE_FEED_URL = os.environ.get('PHIVOLCS_EARTHQUAKE_FEED_URL', '').strip()
USTP_CDO_LAT = _env_float('USTP_CDO_LAT', 8.481207)
USTP_CDO_LON = _env_float('USTP_CDO_LON', 124.669641)
EARTHQUAKE_MAX_AGE_HOURS = _env_float('EARTHQUAKE_MAX_AGE_HOURS', 24.0)
EARTHQUAKE_BLIND_ZONE_RADIUS_KM = _env_float('EARTHQUAKE_BLIND_ZONE_RADIUS_KM', 15.0)
EARTHQUAKE_REGIONAL_RADIUS_KM = _env_float('EARTHQUAKE_REGIONAL_RADIUS_KM', 200.0)
EARTHQUAKE_MONITORING_MAX_DISTANCE_KM = _env_float('EARTHQUAKE_MONITORING_MAX_DISTANCE_KM', 200.0)
EARTHQUAKE_STRICT_REGIONAL_RADIUS = _env_bool('EARTHQUAKE_STRICT_REGIONAL_RADIUS', True)
EARTHQUAKE_MIN_FEED_MAGNITUDE = _env_float('EARTHQUAKE_MIN_FEED_MAGNITUDE', 4.0)
EARTHQUAKE_ADVISORY_MIN_MAGNITUDE = _env_float('EARTHQUAKE_ADVISORY_MIN_MAGNITUDE', 3.0)
EARTHQUAKE_ADVISORY_MIN_INTENSITY = os.environ.get('EARTHQUAKE_ADVISORY_MIN_INTENSITY', 'III').strip() or 'III'
EARTHQUAKE_THRESHOLD_BANDS = [
    {"min_km": 15.0, "max_km": 40.0, "min_mag": 4.5, "min_intensity": "IV"},
    {"min_km": 40.0, "max_km": 100.0, "min_mag": 5.5, "min_intensity": "V"},
    {"min_km": 100.0, "max_km": 200.0, "min_mag": 6.5, "min_intensity": "VI"},
]




# Email Configuration for Password Reset OTP (SMTP)
EMAIL_BACKEND = os.environ.get('EMAIL_BACKEND', 'django.core.mail.backends.smtp.EmailBackend')
EMAIL_HOST = os.environ.get('EMAIL_HOST', 'smtp.gmail.com')
EMAIL_PORT = int(os.environ.get('EMAIL_PORT', 587))
EMAIL_USE_TLS = os.environ.get('EMAIL_USE_TLS', 'True') == 'True'
EMAIL_HOST_USER = os.environ.get('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD', '')
DEFAULT_FROM_EMAIL = os.environ.get('DEFAULT_FROM_EMAIL', 'SAFE:MEAS Support <no-reply@safe-meas.local>')