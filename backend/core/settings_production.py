import os
import dj_database_url
from pathlib import Path
from .settings import *  # Import base settings

# Override debug setting
DEBUG = False

# Configure allowed hosts for Railway
ALLOWED_HOSTS = ['*.railway.app', 'localhost', '127.0.0.1']
RAILWAY_EXTERNAL_HOSTNAME = os.environ.get('RAILWAY_STATIC_URL')
if RAILWAY_EXTERNAL_HOSTNAME:
    # Extract hostname from Railway URL
    import urllib.parse
    parsed = urllib.parse.urlparse(RAILWAY_EXTERNAL_HOSTNAME)
    if parsed.hostname:
        ALLOWED_HOSTS.append(parsed.hostname)

# Add whitenoise for static files
MIDDLEWARE.insert(1, 'whitenoise.middleware.WhiteNoiseMiddleware')

# Configure database using Railway's DATABASE_URL
DATABASE_URL = os.environ.get('DATABASE_URL')
if DATABASE_URL:
    DATABASES = {
        'default': dj_database_url.config(
            default=DATABASE_URL,
            conn_max_age=600,
            ssl_require=True,
        )
    }

# CORS settings for production
CORS_ALLOWED_ORIGINS = [
    "https://*.railway.app",
]

# Add your front-end URLs to CORS allowed origins
FRONTEND_URL = os.environ.get('FRONTEND_URL')
if FRONTEND_URL:
    CORS_ALLOWED_ORIGINS.append(FRONTEND_URL)

# Configure static files for production
STATIC_URL = '/static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')

# Railway-specific settings (less strict than Render)
CSRF_COOKIE_SECURE = True
SESSION_COOKIE_SECURE = True

# HTTPS settings (Railway handles SSL automatically)
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

# Additional security settings
SECURE_CONTENT_TYPE_NOSNIFF = True 