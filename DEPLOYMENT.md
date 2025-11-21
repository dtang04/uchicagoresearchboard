# Deployment Guide

Your code is **already scalable** and ready for deployment! Here's what you need to know:

## What's Already Done ✅

- ✅ Database structure (SQLite, can migrate to PostgreSQL/MySQL)
- ✅ RESTful API architecture
- ✅ Environment-based configuration
- ✅ CORS enabled
- ✅ Analytics tracking
- ✅ Dynamic trending labs

## Quick Deployment Options

### Option 1: Vercel (Easiest - Free)
**Frontend + Backend as Serverless Functions**

1. Install Vercel CLI: `npm i -g vercel`
2. Deploy: `vercel` in project root
3. Set environment variables in Vercel dashboard
4. **Database**: Use Vercel Postgres (free tier) or keep SQLite for small scale

**Pros**: Free, automatic HTTPS, easy setup
**Cons**: Serverless functions have cold starts

### Option 2: Railway (Recommended - $5/month)
**Full-stack deployment with database**

1. Sign up at [railway.app](https://railway.app)
2. Connect your GitHub repo
3. Railway auto-detects Node.js backend
4. Add PostgreSQL database (or keep SQLite)
5. Set environment variables

**Pros**: Easy, includes database, good for production
**Cons**: Costs money after free trial

### Option 3: Render (Free tier available)
**Similar to Railway**

1. Sign up at [render.com](https://render.com)
2. Create Web Service (backend)
3. Create Static Site (frontend)
4. Add PostgreSQL database

**Pros**: Free tier available
**Cons**: Free tier spins down after inactivity

### Option 4: Traditional VPS (DigitalOcean, AWS, etc.)
**Full control**

1. Set up Ubuntu server
2. Install Node.js, PM2, Nginx
3. Deploy backend with PM2
4. Serve frontend with Nginx
5. Use managed database (AWS RDS, etc.)

**Pros**: Full control, scalable
**Cons**: More setup required

## What You Need to Change

### 1. Database (Optional but Recommended)
For production, consider migrating from SQLite to PostgreSQL:

```bash
# Install PostgreSQL adapter
npm install pg

# Update database.js to use PostgreSQL
# Or use a service like Supabase (free PostgreSQL)
```

### 2. Environment Variables

**Yes, you still need environment variables in production!** In fact, it's even more important for security. Each deployment platform has its own way to set them (you don't upload `.env` files directly).

#### Required Environment Variables

```env
# Server Configuration
PORT=3001
NODE_ENV=production
FRONTEND_URL=https://yourdomain.com

# Authentication
JWT_SECRET=your-secret-key-here
SESSION_SECRET=your-session-secret-here

# Google OAuth (optional - if using Google login)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=https://yourdomain.com/api/auth/google/callback

# Email Service (for signup confirmations)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM=noreply@yourdomain.com

# Database (if using PostgreSQL)
DATABASE_URL=postgresql://user:password@host:port/database
```

#### How to Set Environment Variables by Platform

**Vercel:**
1. Go to your project dashboard
2. Click **Settings** → **Environment Variables**
3. Add each variable (key and value)
4. Select environment (Production, Preview, Development)
5. Redeploy your application

**Railway:**
1. Open your project
2. Click on your service
3. Go to **Variables** tab
4. Click **+ New Variable**
5. Add each variable
6. Changes apply automatically (no redeploy needed)

**Render:**
1. Go to your service dashboard
2. Click **Environment** in the sidebar
3. Click **Add Environment Variable**
4. Add each variable
5. Save changes (service will restart automatically)

**DigitalOcean App Platform:**
1. Go to your app settings
2. Click **App-Level Environment Variables**
3. Add each variable
4. Save and redeploy

**Traditional VPS (SSH):**
1. SSH into your server
2. Create `.env` file in your project directory:
   ```bash
   nano /path/to/backend/.env
   ```
3. Add all variables
4. Restart your application (PM2, systemd, etc.)

**Important Notes:**
- ⚠️ **Never commit `.env` files to Git** (they're in `.gitignore`)
- 🔒 Use different credentials for production vs development
- 🔑 Generate strong random strings for secrets (use `openssl rand -base64 32`)
- 📧 For email, use a professional service like SendGrid in production (see `EMAIL_SETUP.md`)

### 3. CORS Configuration
Update `backend/server.js` if frontend/backend are on different domains:

```javascript
app.use(cors({
    origin: process.env.FRONTEND_URL || 'https://yourdomain.com',
    credentials: true
}));
```

### 4. Static File Serving
For production, serve frontend from backend or use a CDN:

```javascript
// In server.js
app.use(express.static(path.join(__dirname, '../')));
```

## Current Configuration

The code now automatically detects:
- **Localhost**: Uses `http://localhost:3001/api`
- **Production**: Uses same origin `/api` (if backend is on same domain)

You can override by setting `window.API_BASE_URL` before loading scripts.

## Deployment Checklist

- [ ] Choose hosting platform
- [ ] Set up database (PostgreSQL recommended for production)
- [ ] **Set all environment variables in platform dashboard** (see above)
- [ ] Configure email service (see `EMAIL_SETUP.md` for details)
- [ ] Update CORS if needed
- [ ] Test API endpoints
- [ ] Test email sending (signup a test account)
- [ ] Set up domain name
- [ ] Enable HTTPS (most platforms do this automatically)
- [ ] Set up monitoring/logging
- [ ] Backup database regularly

## Your Code is Production-Ready! 🚀

The architecture is solid:
- ✅ Separation of concerns (frontend/backend)
- ✅ Database abstraction (easy to swap SQLite → PostgreSQL)
- ✅ API-first design
- ✅ Error handling
- ✅ Analytics built-in

You're good to go!

