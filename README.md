# Money Exchange Admin Application

A web application for managing currency exchange transactions, rates, and analyzing profits. The application allows administrators to import data from Google Sheets and provides a dashboard with reports and analytics.

## Project Structure

This project is divided into two main parts:

1. **Backend (Django)**: REST API for data management
2. **Frontend (React)**: User interface for the application

## Features

- Admin authentication and authorization
- Currency management
- Exchange rate management
- Transaction tracking and management
- Google Sheets integration for data import
- Dashboard with key metrics
- Reports and analytics with charts
- Mobile-responsive design

## Backend Setup (Django)

1. Navigate to the backend directory:
   ```
   cd money_exchange_app/backend
   ```

2. Create a virtual environment:
   ```
   python -m venv venv
   ```

3. Activate the virtual environment:
   - Windows: `venv\Scripts\activate`
   - Mac/Linux: `source venv/bin/activate`

4. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

5. Run migrations:
   ```
   python manage.py migrate
   ```

6. Create a superuser:
   ```
   python manage.py createsuperuser
   ```

7. Start the development server:
   ```
   python manage.py runserver
   ```

## Frontend Setup (React)

1. Install Node.js and npm if not already installed

2. Navigate to the frontend directory:
   ```
   cd money_exchange_app/frontend
   ```

3. Install dependencies:
   ```
   npm install
   ```

4. Start the development server:
   ```
   npm start
   ```

## Deployment to Python Anywhere

### Backend Deployment

1. Sign up for a Python Anywhere account if you don't have one

2. Go to the "Web" tab and click "Add a new web app"

3. Choose "Manual configuration" and select the latest Python version

4. In the "Console" tab, create a new Bash console and run:
   ```bash
   git clone https://github.com/yourusername/money_exchange_app.git
   cd money_exchange_app/backend
   pip install -r requirements.txt
   ```

5. Configure your WSGI file (`/var/www/yourusername_pythonanywhere_com_wsgi.py`):
   ```python
   import os
   import sys

   # Add your project directory to the sys.path
   path = '/home/yourusername/money_exchange_app/backend'
   if path not in sys.path:
       sys.path.insert(0, path)

   # Set environment variables
   os.environ['DJANGO_SETTINGS_MODULE'] = 'core.settings'

   # Import Django and start the WSGI application
   from django.core.wsgi import get_wsgi_application
   application = get_wsgi_application()
   ```

6. Configure static files in the Web tab:
   - URL: `/static/`
   - Directory: `/home/yourusername/money_exchange_app/backend/static/`

7. Update your Django settings for production in `core/settings.py`:
   ```python
   DEBUG = False
   ALLOWED_HOSTS = ['yourusername.pythonanywhere.com']
   
   # Add static root
   STATIC_ROOT = os.path.join(BASE_DIR, 'static')
   ```

8. Run migrations and create superuser:
   ```bash
   cd /home/yourusername/money_exchange_app/backend
   python manage.py migrate
   python manage.py createsuperuser
   python manage.py collectstatic
   ```

9. Reload your web app from the Web tab

### Frontend Deployment

1. In your local environment, build the React app:
   ```bash
   cd money_exchange_app/frontend
   npm run build
   ```

2. Upload the contents of the `build` directory to Python Anywhere using the Files tab

3. Configure your web app to serve static files:
   - URL: `/`
   - Directory: `/home/yourusername/money_exchange_app/frontend/build/`

4. Update your web app configuration in the Web tab to serve your React app

5. Reload your web app

## Using the Application

1. Access the admin interface at `/admin`
2. Login with your admin credentials
3. Import data from Google Sheets
4. Manage currencies, exchange rates, and transactions
5. View dashboard and reports

## License

MIT License 