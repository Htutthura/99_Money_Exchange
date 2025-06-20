# Deployment Guide for Money Exchange App

This guide explains how to deploy the Money Exchange App to Render.com.

## Prerequisites

1. Create a [Render.com](https://render.com) account
2. Push your codebase to a Git repository (GitHub, GitLab, etc.)
3. Have your code structure match this repository layout:
   ```
   money_exchange_app/
   ├── backend/
   │   ├── core/
   │   ├── transactions/
   │   ├── requirements.txt
   │   └── manage.py
   ├── frontend/
   │   ├── public/
   │   ├── src/
   │   ├── package.json
   │   └── ...
   ├── render.yaml
   └── ...
   ```

## Deployment Steps

### 1. Update your code

Ensure your codebase includes all the necessary configuration files:
- `render.yaml` - Defines services and database
- `backend/settings_production.py` - PostgreSQL configuration
- Updated `requirements.txt` with PostgreSQL dependencies

### 2. Deploy using Render Blueprint

1. Log in to your Render.com account
2. Click on the "New" button and select "Blueprint"
3. Connect your Git repository
4. Render will automatically detect the `render.yaml` file
5. Review the proposed services and click "Apply"
6. Render will create:
   - PostgreSQL database
   - Python web service for the backend
   - Static site service for the frontend

### 3. Monitor the deployment

1. Render will show the build logs for each service
2. Wait for all services to complete their builds
3. Once deployed, you can access your application using the provided URLs

### 4. Database Migration

After the services are deployed, you'll need to run the database migrations:

1. Go to your backend service in the Render dashboard
2. Click on "Shell"
3. Run the following commands:
   ```bash
   cd backend
   python manage.py migrate
   ```

### 5. Create a superuser (optional)

To access the Django admin interface:

1. Go to your backend service in the Render dashboard
2. Click on "Shell"
3. Run the following commands:
   ```bash
   cd backend
   python manage.py createsuperuser
   ```
4. Follow the prompts to create an admin user

## Environment Variables

The `render.yaml` file defines several environment variables for your services:

### Backend Service
- `IS_RENDER`: Set to "true" to indicate running on Render
- `DATABASE_URL`: PostgreSQL connection string (set automatically)
- `FRONTEND_URL`: URL to your frontend application

### Frontend Service
- `REACT_APP_API_URL`: URL to your backend API

## Troubleshooting

### Database Connection Issues
- Check the database connection string in the Render dashboard
- Verify that `psycopg2-binary` is installed
- Check the Django logs for database connection errors

### Static Files Not Loading
- Check that the `STATIC_ROOT` setting is configured correctly
- Ensure the build process includes collecting static files
- Verify that Whitenoise is properly configured

### API Requests Failing
- Check CORS settings to ensure your frontend can access the backend
- Verify that the API URL in the frontend is correct
- Check the backend logs for any API request errors 