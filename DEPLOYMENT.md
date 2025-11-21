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
Create `.env` file in backend:

```env
PORT=3001
NODE_ENV=production
DATABASE_URL=postgresql://... (if using PostgreSQL)
```

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
- [ ] Configure environment variables
- [ ] Update CORS if needed
- [ ] Test API endpoints
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

