from .settings import *
import os

# PythonAnywhere specific settings
ROOT_URLCONF = 'core.urls'
SECRET_KEY = os.environ.get('SECRET_KEY') # Make sure to set this in PythonAnywhere environment
DEBUG = False
ALLOWED_HOSTS = [
    '99moneyexchange.pythonanywhere.com',  # Added your PythonAnywhere domain
]

# CORS settings for Netlify frontend
CORS_ALLOWED_ORIGINS = [
    "https://moonlit-gumption-f64172.netlify.app",
]
CORS_ALLOW_CREDENTIALS = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = '/static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'static')

# Use a more secure database like PostgreSQL or MySQL on PythonAnywhere
# For now, we'll stick with SQLite for simplicity, but it's not recommended for production
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': os.path.join(BASE_DIR, 'db.sqlite3'),
    }
}
