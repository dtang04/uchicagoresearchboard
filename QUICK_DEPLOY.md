# Quick Deployment Guide

This guide will help you deploy your UChicago Research Board to a domain quickly.

## 🚀 Recommended: Railway (Easiest & Fastest)

Railway is the easiest option - it handles everything automatically.

### Steps:

1. **Sign up at [railway.app](https://railway.app)** (free trial, then ~$5/month)

2. **Connect your GitHub repo:**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository

3. **Railway will auto-detect your Node.js backend:**
   - It will find `backend/package.json`
   - It will automatically start the server

4. **Set Environment Variables:**
   - Go to your service → **Variables** tab
   - Add these variables:
     ```
     NODE_ENV=production
     PORT=3000
     FRONTEND_URL=https://your-app-name.railway.app
     JWT_SECRET=<generate-random-string>
     SESSION_SECRET=<generate-random-string>
     ```
   - Generate secrets: `openssl rand -base64 32` (run in terminal)

5. **Add a Custom Domain (Optional):**
   - Go to **Settings** → **Networking**
   - Click **Generate Domain** (free subdomain)
   - Or add your own custom domain

6. **Deploy!**
   - Railway will automatically deploy on every git push
   - Your app will be live at: `https://your-app-name.railway.app`

### Database:
- **Important**: Your `database.db` file is in `.gitignore`
- **Option 1**: Temporarily remove `backend/database.db` from `.gitignore`, commit it, then add it back
- **Option 2**: The database will be created fresh on first run (empty database)
- **Option 3**: Upload database.db manually after first deployment
- For production scale, consider upgrading to PostgreSQL later

---

## 🌐 Alternative: Render (Free Tier)

1. **Sign up at [render.com](https://render.com)**

2. **Create Web Service:**
   - Connect GitHub repo
   - Root Directory: `backend`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Environment: `Node`

3. **Set Environment Variables:**
   - Same as Railway above

4. **Add Custom Domain:**
   - Settings → Custom Domain
   - Add your domain

---

## 🖥️ Traditional VPS (DigitalOcean, AWS, etc.)

If you want full control:

### 1. Set up server (Ubuntu 20.04+)
```bash
# SSH into your server
ssh root@your-server-ip
```

### 2. Install Node.js
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 3. Install PM2 (process manager)
```bash
sudo npm install -g pm2
```

### 4. Clone your repo
```bash
cd /var/www
git clone your-repo-url uchicago-research-board
cd uchicago-research-board/backend
npm install
```

### 5. Create .env file
```bash
nano .env
```
Add:
```
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://yourdomain.com
JWT_SECRET=<your-secret>
SESSION_SECRET=<your-secret>
```

### 6. Start with PM2
```bash
pm2 start server.js --name research-board
pm2 save
pm2 startup
```

### 7. Set up Nginx (reverse proxy)
```bash
sudo apt install nginx
sudo nano /etc/nginx/sites-available/research-board
```

Add:
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/research-board /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 8. Set up SSL (Let's Encrypt)
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

---

## ✅ Pre-Deployment Checklist

- [ ] Set `NODE_ENV=production` in environment variables
- [ ] Set `FRONTEND_URL` to your production domain
- [ ] Generate and set `JWT_SECRET` (random string)
- [ ] Generate and set `SESSION_SECRET` (random string)
- [ ] Test locally with `NODE_ENV=production npm start` in backend folder
- [ ] Verify database file (`backend/database.db`) is included
- [ ] Set up email service (optional - see `backend/EMAIL_SETUP.md`)
- [ ] Configure Google OAuth (optional - see `backend/OAUTH_SETUP.md`)

---

## 🔧 Testing Production Locally

Before deploying, test production mode locally:

```bash
cd backend
NODE_ENV=production PORT=3000 npm start
```

Then visit: `http://localhost:3000`

The backend will serve both API and frontend files.

---

## 📝 Notes

- **Database**: SQLite file is included. For high traffic, consider PostgreSQL
- **Email**: Optional but recommended for signup confirmations
- **OAuth**: Optional - Google login can be added later
- **HTTPS**: Most platforms (Railway, Render) provide HTTPS automatically
- **Domain**: You can use the free subdomain or add your own custom domain

---

## 🆘 Troubleshooting

**App not loading?**
- Check environment variables are set correctly
- Verify `NODE_ENV=production` is set
- Check server logs in Railway/Render dashboard

**API errors?**
- Verify `FRONTEND_URL` matches your actual domain
- Check CORS settings in `server.js`

**Database issues?**
- Ensure `database.db` file is in the repo (or use PostgreSQL)
- Check file permissions on server

---

## 🎉 You're Done!

Once deployed, your app will be live at your domain. The backend automatically serves the frontend in production mode, so everything works from a single URL!

