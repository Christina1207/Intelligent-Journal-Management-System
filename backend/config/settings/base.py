from pathlib import Path
from decouple import config, Csv
from datetime import timedelta
from celery.schedules import crontab

BASE_DIR = Path(__file__).resolve().parent.parent.parent

SECRET_KEY = config("SECRET_KEY")
DEBUG = config("DEBUG", default=False, cast=bool)
ALLOWED_HOSTS = config("ALLOWED_HOSTS", default="localhost", cast=Csv())

DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "corsheaders",
    "django_celery_beat",
    "django_celery_results",
]

LOCAL_APPS = [
    "apps.accounts",
    "apps.journals",
    "apps.submissions",
    "apps.workflow",
    "apps.reviews",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "mediafiles"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    
    "EXCEPTION_HANDLER": "config.exception_handler.custom_exception_handler",
}



SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": False,
    "ALGORITHM": "HS256",
    "SIGNING_KEY": SECRET_KEY,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
}

# ------------------------------------------------------------------
# Celery
# ------------------------------------------------------------------
CELERY_BROKER_URL = config('CELERY_BROKER_URL')
CELERY_RESULT_BACKEND = config('CELERY_RESULT_BACKEND')
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = TIME_ZONE
CELERY_BEAT_SCHEDULER = 'django_celery_beat.schedulers:DatabaseScheduler'
CELERY_BEAT_SCHEDULE = {
    "refresh-reviewer-orcid-profiles": {
        "task": "apps.accounts.tasks.refresh_all_reviewer_orcid_profiles",
        "schedule": crontab(hour=2, minute=0),  # Daily at 2am
    },
}

# ------------------------------------------------------------------
# MinIO
# ------------------------------------------------------------------
MINIO_ENDPOINT    = config('MINIO_ENDPOINT')
MINIO_ACCESS_KEY  = config('MINIO_ACCESS_KEY')
MINIO_SECRET_KEY  = config('MINIO_SECRET_KEY')
MINIO_BUCKET_NAME = config('MINIO_BUCKET_NAME')
MINIO_USE_SSL     = config('MINIO_USE_SSL', default=False, cast=bool)

# ------------------------------------------------------------------
# AI / Embeddings
# ------------------------------------------------------------------
EMBEDDING_MODEL_NAME = config('EMBEDDING_MODEL_NAME', default='all-MiniLM-L6-v2')
EMBEDDING_DIMENSIONS = config('EMBEDDING_DIMENSIONS', default=384, cast=int)