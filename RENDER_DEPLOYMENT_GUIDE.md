# 🚀 Render Free Deployment Guide

## ✅ Prerequisites Completed
- [x] Code committed to git
- [x] `.gitignore` updated to exclude node_modules
- [x] `render.yaml` configured for free deployment
- [x] Authentication system implemented

## 🆓 Free Render Plan (What You Get)
- **Backend**: Free Web Service (750 hours/month)
- **Frontend**: Free Static Site (unlimited)
- **Database**: Free PostgreSQL (30 days trial, then $7/month)

## 📋 Step-by-Step Deployment

### Step 1: Push to GitHub
```bash
# Create repository on GitHub first, then:
git remote add origin https://github.com/yourusername/money_exchange_app.git
git branch -M main
git push -u origin main
```

### Step 2: Deploy to Render
1. Go to [render.com](https://render.com)
2. Sign up/Login with GitHub
3. Click "New" → "Blueprint"
4. Connect your GitHub repository
5. Render will detect your `render.yaml` automatically

### Step 3: Environment Variables (Set in Render Dashboard)
**Backend Service Environment Variables:**
```
SECRET_KEY=your-generated-secret-key
DEBUG=False
EMAIL_HOST_USER=your-gmail@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
FRONTEND_URL=https://money-exchange-app.onrender.com
```

**Frontend Environment Variables:**
```
REACT_APP_API_URL=https://money-exchange-api.onrender.com
```

### Step 4: Database Setup
- Render automatically creates PostgreSQL database
- DATABASE_URL is auto-injected to backend service
- Migration runs automatically during build

## 🔒 Security Setup

### Generate SECRET_KEY
```python
from django.core.management.utils import get_random_secret_key
print(get_random_secret_key())
```

### Gmail App Password Setup
1. Enable 2FA on Gmail
2. Generate App Password
3. Use App Password (not regular password)

## 🚀 Deployment Process
1. **Database**: Creates first (~2 minutes)
2. **Backend**: Builds and deploys (~5 minutes)
3. **Frontend**: Builds and deploys (~3 minutes)

## 💰 Cost Breakdown (Free Tier)
- Backend: **FREE** (750 hours/month)
- Frontend: **FREE** (unlimited)
- Database: **FREE** for 30 days, then $7/month

## ⚠️ Important Notes
- Free services sleep after 15 mins of inactivity
- First request after sleep takes ~30 seconds to wake up
- Database is the only paid component after trial

## 🔄 **Database Renewal Strategy**

### **Can I Manually Renew Free Database?**
**YES! Here's how:**

**Option 1: Create New Free Database (Recommended)**
```bash
# After your free database expires (30 days):
1. Export your data before expiration
2. Create a NEW free database (you get another 30 days)
3. Import your data back
4. Repeat every 30 days
```

**Option 2: Upgrade During Grace Period**
```bash
# You have 14 days after expiration to upgrade:
1. Database expires but data remains for 14 days
2. Upgrade to paid plan ($7/month)
3. Your data is preserved
```

### **Render Database Policies (2024)**
- **Free Database Limit**: Only 1 per workspace
- **Trial Period**: 30 days (changed from 90 days in May 2024)
- **Grace Period**: 14 days to upgrade after expiration
- **Storage Limit**: 1GB for free tier
- **Renewal**: Can create new free database after old one expires

### **Continuous Free Strategy**
For truly free operation:
1. **Before Day 30**: Export all data
2. **Day 30**: Database expires
3. **Day 31**: Create new free database 
4. **Day 32**: Import data back
5. **Repeat every 30 days**

## 🎯 Alternative for 100% Free
If you want completely free hosting without manual renewal:
1. Use **Vercel** for frontend (free forever)
2. Use **Railway** for backend (free tier)
3. Use **PlanetScale** for database (free tier)
4. Use **Neon** for PostgreSQL (free tier, no expiration)

## 🔄 After Deployment
1. Visit your frontend URL
2. Create admin user: `python manage.py createsuperuser`
3. Test all functionality
4. Monitor in Render dashboard
5. **Set calendar reminder for Day 25** to backup data

## 📞 Support
- Render has excellent docs and support
- Discord community very helpful
- Email support available

## 🚨 **Pro Tips for Free Tier**
1. **Backup Strategy**: Set up automated weekly backups
2. **Monitoring**: Use Render dashboard to track database usage
3. **Calendar Alert**: Set reminder for Day 25 to prepare for renewal
4. **Data Export**: Use `pg_dump` to export data before expiration 