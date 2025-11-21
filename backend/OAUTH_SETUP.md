# Google OAuth Setup Guide

This guide will help you set up Google OAuth for production use.

## Step 1: Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to **APIs & Services** > **Credentials**
4. Click **Create Credentials** > **OAuth client ID**
5. If prompted, configure the OAuth consent screen:
   - Choose **External** (unless you have a Google Workspace)
   - Fill in the required information (App name, User support email, Developer contact)
   - Add scopes: `email` and `profile`
   - Add test users if in testing mode
6. Create OAuth client ID:
   - Application type: **Web application**
   - Name: UChicago Research Board (or your preferred name)
   - Authorized JavaScript origins:
     - `http://localhost:3001` (for development)
     - `https://yourdomain.com` (for production)
   - Authorized redirect URIs:
     - `http://localhost:3001/api/auth/google/callback` (for development)
     - `https://yourdomain.com/api/auth/google/callback` (for production)
7. Copy the **Client ID** and **Client Secret**

## Step 2: Configure Environment Variables

1. Copy `.env.example` to `.env` in the `backend` directory:
   ```bash
   cd backend
   cp .env.example .env
   ```

2. Edit `.env` and add your credentials:
   ```env
   GOOGLE_CLIENT_ID=your-google-client-id-here
   GOOGLE_CLIENT_SECRET=your-google-client-secret-here
   SESSION_SECRET=generate-a-random-string-here
   FRONTEND_URL=http://localhost:3000
   GOOGLE_CALLBACK_URL=http://localhost:3001/api/auth/google/callback
   JWT_SECRET=generate-another-random-string-here
   NODE_ENV=development
   ```

3. Generate secure random strings for `SESSION_SECRET` and `JWT_SECRET`:
   ```bash
   # On macOS/Linux:
   openssl rand -base64 32
   
   # Or use an online generator
   ```

## Step 3: Production Configuration

For production, update your `.env` file:

```env
GOOGLE_CLIENT_ID=your-production-client-id
GOOGLE_CLIENT_SECRET=your-production-client-secret
SESSION_SECRET=your-production-session-secret
FRONTEND_URL=https://yourdomain.com
GOOGLE_CALLBACK_URL=https://yourdomain.com/api/auth/google/callback
JWT_SECRET=your-production-jwt-secret
NODE_ENV=production
```

**Important:** Make sure to:
- Add your production domain to Google OAuth authorized origins and redirect URIs
- Use HTTPS in production
- Keep your `.env` file secure and never commit it to version control

## Step 4: Restart the Server

After configuring the environment variables, restart your backend server:

```bash
cd backend
npm start
```

## Troubleshooting

- **"Redirect URI mismatch"**: Make sure the callback URL in your `.env` matches exactly what you configured in Google Cloud Console
- **"Invalid client"**: Verify your Client ID and Secret are correct
- **CORS errors**: Ensure `FRONTEND_URL` in `.env` matches your frontend URL
- **Session not working**: Check that `SESSION_SECRET` is set and cookies are enabled

## Security Notes

- Never commit `.env` files to version control
- Use different credentials for development and production
- Rotate secrets regularly
- Use HTTPS in production
- Consider using environment variable management services (e.g., AWS Secrets Manager, Azure Key Vault) for production

