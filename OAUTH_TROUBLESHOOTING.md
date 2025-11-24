# Google OAuth Troubleshooting Guide for Render

## Quick Checklist

### ✅ Environment Variables in Render (ALL REQUIRED)

1. **GOOGLE_CLIENT_ID** ✓ (you have this)
2. **GOOGLE_CLIENT_SECRET** ✓ (you have this)
3. **GOOGLE_CALLBACK_URL** ⚠️ **MOST COMMON ISSUE!**
   - Format: `https://your-app-name.onrender.com/api/auth/google/callback`
   - Must match EXACTLY what's in Google Console
4. **FRONTEND_URL** ⚠️
   - Format: `https://your-app-name.onrender.com`
   - Must match your actual Render URL
5. **SESSION_SECRET** ⚠️
   - Generate with: `openssl rand -base64 32`
   - Required for session management
6. **JWT_SECRET** ⚠️
   - Generate with: `openssl rand -base64 32`
   - Required for token generation
7. **NODE_ENV=production**

### ✅ Google Cloud Console Configuration

1. **Authorized JavaScript origins:**
   - `https://your-app-name.onrender.com`
   - NO trailing slash!

2. **Authorized redirect URIs:**
   - `https://your-app-name.onrender.com/api/auth/google/callback`
   - Must match `GOOGLE_CALLBACK_URL` exactly
   - NO trailing slash!

3. **OAuth consent screen:**
   - Must be configured (External type)
   - Scopes: `email`, `profile`
   - If in "Testing" mode, add test users
   - If in "Production" mode, app must be verified (for external users)

## Common Issues & Solutions

### Issue 1: "Redirect URI mismatch"
**Error:** `redirect_uri_mismatch`

**Solution:**
- Check that `GOOGLE_CALLBACK_URL` in Render matches exactly what's in Google Console
- Both should be: `https://your-app-name.onrender.com/api/auth/google/callback`
- Check for trailing slashes, http vs https, etc.

### Issue 2: "OAuth not configured" message
**Error:** Frontend shows "Google OAuth is not configured"

**Solution:**
- Check Render logs to see if server is reading env vars
- Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set
- Make sure there are no extra spaces or quotes in the values
- Restart the service after adding env vars

### Issue 3: "Invalid client" error
**Error:** `invalid_client`

**Solution:**
- Double-check `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are correct
- Make sure you copied the full values (no truncation)
- Regenerate credentials if needed

### Issue 4: Session/cookie issues
**Error:** Login works but session doesn't persist

**Solution:**
- Make sure `SESSION_SECRET` is set
- Check that `NODE_ENV=production` is set
- Verify cookies are enabled in browser

### Issue 5: CORS errors
**Error:** CORS policy blocking requests

**Solution:**
- Make sure `FRONTEND_URL` matches your Render URL exactly
- Format: `https://your-app-name.onrender.com` (no trailing slash)

## Testing Steps

1. **Check server logs in Render:**
   - Look for: `⚠️  Google OAuth not configured` warning
   - If you see this, env vars aren't being read

2. **Test the OAuth endpoint:**
   - Visit: `https://your-app-name.onrender.com/api/auth/google`
   - Should redirect to Google (not show error)

3. **Check Google Console:**
   - Go to APIs & Services > Credentials
   - Click on your OAuth 2.0 Client ID
   - Verify redirect URIs match exactly

4. **Check Render environment variables:**
   - Go to Environment tab
   - Verify all variables are set
   - Check for typos or extra spaces

## Debugging Commands

To check what the server sees:
```javascript
// Add this temporarily to server.js to debug:
console.log('OAuth Config:', {
    hasClientId: !!process.env.GOOGLE_CLIENT_ID,
    hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL,
    frontendURL: process.env.FRONTEND_URL
});
```

## Still Not Working?

1. Check Render logs for specific error messages
2. Verify all environment variables are set (no empty values)
3. Make sure you saved changes in Render (auto-redeploys)
4. Wait for deployment to complete before testing
5. Clear browser cache and cookies
6. Try incognito/private browsing mode

