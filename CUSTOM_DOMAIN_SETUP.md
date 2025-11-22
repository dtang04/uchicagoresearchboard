# Custom Domain Setup for Render

This guide shows how to connect your custom domain `uchicagoresearchboard.org` to your Render service.

## Step 1: Add Custom Domain in Render

1. Go to your Render dashboard
2. Click on your service: `UChicagoResearcBoard` (or whatever you named it)
3. Go to **Settings** tab
4. Scroll down to **Custom Domains** section
5. Click **Add Custom Domain**
6. Enter: `uchicagoresearchboard.org`
7. Click **Add**

## Step 2: Get DNS Records from Render

After adding the domain, Render will show you DNS records to add. You'll see something like:

**For root domain (uchicagoresearchboard.org):**
- **Type:** CNAME
- **Name:** @ (or root)
- **Value:** `your-service-name.onrender.com`

**For www subdomain (www.uchicagoresearchboard.org):**
- **Type:** CNAME  
- **Name:** www
- **Value:** `your-service-name.onrender.com`

**OR if your DNS provider doesn't support CNAME at root:**

- **Type:** A
- **Name:** @ (or root)
- **Value:** `76.76.21.21` (Render's IP - Render will show the actual IP)

## Step 3: Configure DNS at Your Domain Provider

Go to your domain registrar (where you bought `uchicagoresearchboard.org`) and add the DNS records:

### Example: Cloudflare, GoDaddy, Namecheap, etc.

1. Log in to your domain registrar
2. Find **DNS Management** or **DNS Settings**
3. Add the records Render provided:

**For root domain:**
```
Type: CNAME (or A if CNAME not supported)
Name: @ (or leave empty, or use root domain)
Value: your-service-name.onrender.com (or Render's IP)
TTL: 3600 (or Auto)
```

**For www subdomain (optional but recommended):**
```
Type: CNAME
Name: www
Value: your-service-name.onrender.com
TTL: 3600 (or Auto)
```

### Common Providers:

**Cloudflare:**
- Go to DNS → Records
- Add CNAME record for root domain (or A record if needed)
- Add CNAME for www subdomain

**GoDaddy:**
- Go to DNS Management
- Add CNAME or A record

**Namecheap:**
- Go to Advanced DNS
- Add CNAME or A record

## Step 4: Wait for DNS Propagation

- DNS changes can take **15 minutes to 48 hours** to propagate
- Usually takes **15-30 minutes** for most providers
- Render will show the status of your domain (checking... then active)

## Step 5: Update Environment Variable

Once your domain is active on Render:

1. Go to your Render service → **Environment** tab
2. Find `FRONTEND_URL`
3. Update it to: `https://uchicagoresearchboard.org`
4. Click **Save Changes**
5. Render will automatically redeploy

**Important:** Wait until Render shows your domain as "Active" before updating `FRONTEND_URL`

## Step 6: SSL Certificate (Automatic)

- Render **automatically provisions SSL certificates** via Let's Encrypt
- Your domain will have HTTPS automatically
- No additional setup needed!
- Just wait for DNS to propagate and SSL will be ready

## Step 7: Verify Everything Works

1. Wait for DNS propagation (check with: `nslookup uchicagoresearchboard.org`)
2. Visit `https://uchicagoresearchboard.org`
3. Your app should load!

## Troubleshooting

**Domain not resolving:**
- Wait longer (DNS can take up to 48 hours)
- Check DNS records are correct
- Use `nslookup` or `dig` to verify DNS propagation

**SSL certificate pending:**
- Wait for DNS to fully propagate
- SSL auto-provisions once DNS is active
- Check Render dashboard for SSL status

**HTTPS not working:**
- Make sure you're using `https://` (not `http://`)
- Wait for SSL certificate to provision (can take 5-10 minutes after DNS is active)

## Notes

- You can use both `uchicagoresearchboard.org` AND `www.uchicagoresearchboard.org`
- Render will handle both automatically if you set up DNS for both
- The default Render URL (`your-service.onrender.com`) will still work
- Consider setting up www redirect if desired (can be done in DNS or in your app)

