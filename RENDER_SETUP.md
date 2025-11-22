# Render Deployment Guide

Simple deployment guide for UChicago Research Board on Render.

## 🚀 Quick Start

### Step 1: Sign up for Render
1. Go to [render.com](https://render.com)
2. Sign up with GitHub (recommended - easiest)

### Step 2: Deploy from GitHub
1. Click "New +" → "Web Service"
2. Connect your GitHub repository: `dtang04/uchicagoresearchboard`
3. Render will auto-detect Node.js

### Step 3: Configure Service Settings

**Name:** `uchicago-research-board` (or your preferred name)

**Settings:**
- **Root Directory:** Leave empty (Render auto-detects)
- **Environment:** `Docker`
- **Dockerfile Path:** `./Dockerfile` (or leave empty - Render will auto-detect)
- **Build Command:** (Leave empty - Render runs `docker build` automatically)
- **Start Command:** (Leave empty - Dockerfile CMD handles this)

### Step 4: Set Environment Variables

Go to **Environment** tab → Add these variables:

```
NODE_ENV=production
PORT=10000
FRONTEND_URL=https://your-app-name.onrender.com
SESSION_SECRET=your-random-secret-here
JWT_SECRET=your-random-jwt-secret-here
```

**To generate secrets:**
```bash
# Generate SESSION_SECRET
openssl rand -base64 32

# Generate JWT_SECRET  
openssl rand -base64 32
```

**Important:** Replace `your-app-name.onrender.com` with your actual Render URL (you'll see it after deployment).

### Step 5: Deploy

1. Click "Create Web Service"
2. Render will start building and deploying
3. Wait for deployment to complete (~2-5 minutes)

### Step 6: Get Your URL

After deployment completes:
1. Render will give you a URL like: `https://uchicago-research-board.onrender.com`
2. Update the `FRONTEND_URL` environment variable with your actual URL
3. Render will automatically redeploy

## ✅ Verify Deployment

1. Visit your Render URL
2. The app should load!
3. Try searching for a department

## 🔧 Troubleshooting

**If deployment fails:**
- Check the **Logs** tab for build errors
- Verify `backend/package.json` exists
- Make sure Node.js version is 18+

**If the app doesn't load:**
- Check **Logs** tab for runtime errors
- Verify environment variables are set correctly
- Check that `FRONTEND_URL` matches your Render URL

**If health checks fail:**
- Check that `/health` endpoint returns 200 OK
- Verify server starts correctly (check logs)

## 📝 Notes

- **Free tier:** Services spin down after 15 minutes of inactivity (cold starts)
- **Database:** Currently using SQLite (file-based). For production, consider PostgreSQL
- **Auto-deploy:** Push to GitHub main branch to auto-deploy

## 🎉 Done!

Your app is now live on Render! Any pushes to GitHub will automatically redeploy.

