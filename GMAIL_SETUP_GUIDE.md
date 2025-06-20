# Gmail Setup Guide for Password Reset Functionality

## Current Configuration ✅

- **Admin Email**: `htutthuraaung21@gmail.com`
- **Gmail SMTP**: Already configured in `backend/.env`
- **Admin Username**: `admin`
- **Admin Password**: `admin123`

## Next Steps to Enable Email Sending

### 1. Generate Gmail App Password

1. **Enable 2-Factor Authentication** (if not already enabled):
   - Go to [Google Account Security](https://myaccount.google.com/security)
   - Turn on 2-Step Verification

2. **Generate App Password**:
   - Go to [Google Account Security](https://myaccount.google.com/security)
   - Click "2-Step Verification"
   - Scroll down to "App passwords"
   - Click "Generate app password"
   - Select "Mail" or "Other" and name it "99 Money Exchange"
   - Copy the 16-character password (e.g., `abcd efgh ijkl mnop`)

### 2. Update Environment File

Open `backend/.env` and replace `your_app_password_here` with your generated app password:

```env
EMAIL_HOST_PASSWORD=abcd efgh ijkl mnop
```

**Important**: Use the app password (16 characters with spaces), NOT your regular Gmail password!

### 3. Restart Django Server

After updating the `.env` file:
1. Stop the Django server (Ctrl+C)
2. Restart it: `cd backend; python manage.py runserver`

## Testing the Setup

1. **Login** to the app with `admin` / `admin123`
2. **Test Change Password**: Click your avatar → "Change Password"
3. **Test Forgot Password**: 
   - Logout
   - Click "Forgot Password?" on login screen
   - Enter: `htutthuraaung21@gmail.com`
   - Check your Gmail inbox for the reset email

## Security Features

✅ **App Password Benefits**:
- Separate from your main Gmail password
- Can be revoked anytime without affecting your main account
- Limited to mail access only
- More secure than using your regular password

✅ **Email Security**:
- Password reset tokens expire in 30 minutes
- Secure token generation using Django's built-in system
- Professional email templates

## Troubleshooting

### If emails aren't being sent:

1. **Check Django Console**: Look for error messages
2. **Verify App Password**: Make sure it's exactly as generated (with spaces)
3. **Check Gmail Settings**: Ensure 2FA is enabled
4. **Test SMTP Connection**: The app will show errors in the console

### Common Issues:

- **"Username and password not accepted"**: Wrong app password
- **"SMTP Authentication Error"**: 2FA not enabled or wrong credentials
- **"Connection refused"**: Check internet connection and Gmail settings

## Environment File Location

The configuration file is located at:
```
backend/.env
```

Make sure this file is never committed to version control for security!

## Production Deployment

For production deployment:
- Keep the same Gmail configuration
- Ensure the `.env` file is properly secured on your server
- Consider using environment variables instead of the `.env` file on production servers

---

**Need Help?** If you encounter any issues, check the Django server console for detailed error messages. 