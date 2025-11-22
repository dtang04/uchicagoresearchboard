# Environment Variables for Render

Here are the environment variables you need to set in Render:

## Required Environment Variables

### 1. Basic Configuration

```
NODE_ENV=production
PORT=10000
```

**Note:** `PORT` is automatically set by Render to `10000`, but you can set it explicitly if needed.

### 2. Frontend URL

```
FRONTEND_URL=https://your-app-name.onrender.com
```

**Important:** Replace `your-app-name.onrender.com` with your actual Render URL. You'll get this after deploying.

### 3. Security Secrets

#### SESSION_SECRET
Used for encrypting session cookies. **Generate a new random secret:**
```bash
openssl rand -base64 32
```

#### JWT_SECRET  
Used for signing JWT tokens for authentication. **Generate a new random secret:**
```bash
openssl rand -base64 32
```

**Example values (DO NOT USE THESE - GENERATE YOUR OWN):**
```
SESSION_SECRET=tN4yOnb/hVNbhN3bQUMabEUhsXzkxYmJcfdavl1G/2o=
JWT_SECRET=onij6IwPu0UiODblUxxJiBMTOENA8/n+jgwhQnxU6WY=
```

## Optional Environment Variables

### Google OAuth (Optional)
If you want Google login to work:

```
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=https://your-app-name.onrender.com/api/auth/google/callback
```

### Email Service (Optional)
If you want email functionality (signup confirmations, etc.):

```
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-specific-password
EMAIL_FROM=noreply@uchicago-research-board.com
```

**Note:** For Gmail, you'll need to create an [App Password](https://support.google.com/accounts/answer/185833) if 2FA is enabled.

## How to Set in Render

1. Go to your Render dashboard
2. Click on your service
3. Go to **Environment** tab
4. Click **Add Environment Variable**
5. Add each variable with its value
6. Click **Save Changes**
7. Render will automatically redeploy

## Quick Setup Script

Run these commands to generate secrets:

```bash
# Generate SESSION_SECRET
echo "SESSION_SECRET=$(openssl rand -base64 32)"

# Generate JWT_SECRET
echo "JWT_SECRET=$(openssl rand -base64 32)"
```

Copy the output and paste into Render's environment variables.

