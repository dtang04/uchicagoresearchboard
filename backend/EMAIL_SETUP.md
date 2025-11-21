# Email Service Setup Guide

This guide will help you configure email sending for signup confirmations and other notifications.

## Overview

The email service uses Nodemailer and supports any SMTP provider. By default, it's configured to work with Gmail, but you can use any email service provider.

## Step 1: Choose an Email Provider

### Option 1: Gmail (Easiest for Development)

1. Go to your Google Account settings
2. Enable 2-Step Verification (required for app passwords)
3. Go to **Security** > **2-Step Verification** > **App passwords**
4. Generate an app password for "Mail"
5. Copy the 16-character password (you'll use this as `EMAIL_PASSWORD`)

### Option 2: Other SMTP Providers

You can use any SMTP provider such as:
- **SendGrid** (recommended for production)
- **Mailgun**
- **Amazon SES**
- **Outlook/Hotmail**
- **Custom SMTP server**

## Step 2: Configure Environment Variables

1. Edit your `.env` file in the `backend` directory and add:

```env
# Email Configuration
EMAIL_HOST=smtp.gmail.com          # SMTP host (use smtp.gmail.com for Gmail)
EMAIL_PORT=587                      # SMTP port (587 for TLS, 465 for SSL)
EMAIL_USER=your-email@gmail.com     # Your email address
EMAIL_PASSWORD=your-app-password    # App password or SMTP password
EMAIL_FROM=noreply@uchicago-research-board.com  # From address (optional, defaults to EMAIL_USER)
FRONTEND_URL=http://localhost:3000  # Frontend URL for email links
```

### Gmail Example:
```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=yourname@gmail.com
EMAIL_PASSWORD=abcd efgh ijkl mnop  # 16-char app password from Google
EMAIL_FROM=noreply@uchicago-research-board.com
FRONTEND_URL=http://localhost:3000
```

### SendGrid Example:
```env
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USER=apikey
EMAIL_PASSWORD=your-sendgrid-api-key
EMAIL_FROM=noreply@yourdomain.com
FRONTEND_URL=https://yourdomain.com
```

### Outlook/Hotmail Example:
```env
EMAIL_HOST=smtp-mail.outlook.com
EMAIL_PORT=587
EMAIL_USER=yourname@outlook.com
EMAIL_PASSWORD=your-password
EMAIL_FROM=noreply@uchicago-research-board.com
FRONTEND_URL=http://localhost:3000
```

## Step 3: Test Email Configuration

The email service will automatically verify the configuration when the server starts. Check the console for:

- ✅ `Email service is ready` - Configuration is correct
- ⚠️ `Email credentials not configured` - Email sending is disabled (signup will still work)

## Step 4: Restart the Server

After configuring the environment variables, restart your backend server:

```bash
cd backend
npm start
```

## How It Works

When a user signs up with email/password:

1. User account is created in the database
2. Authentication token is generated
3. **Confirmation email is sent automatically** (non-blocking)
4. User receives response with token

**Note:** If email sending fails, the signup will still succeed. The error will be logged but won't prevent account creation.

## Production Configuration

For production:

1. Use a professional email service (SendGrid, Mailgun, or Amazon SES recommended)
2. Set up SPF, DKIM, and DMARC records for your domain
3. Use a custom domain email address (e.g., `noreply@yourdomain.com`)
4. Monitor email delivery rates
5. Set up email bounce handling (future enhancement)

### Example Production Setup (SendGrid):

```env
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USER=apikey
EMAIL_PASSWORD=SG.your-sendgrid-api-key-here
EMAIL_FROM=noreply@yourdomain.com
FRONTEND_URL=https://yourdomain.com
NODE_ENV=production
```

## Troubleshooting

### "Email service not configured"
- Make sure `EMAIL_USER` and `EMAIL_PASSWORD` are set in your `.env` file
- Restart the server after adding environment variables

### "Authentication failed"
- For Gmail: Make sure you're using an **App Password**, not your regular password
- Check that 2-Step Verification is enabled on your Google account
- Verify your email and password are correct

### "Connection timeout"
- Check your firewall settings
- Verify the SMTP host and port are correct
- Some networks block SMTP ports - try a different network or use a VPN

### Emails not being received
- Check spam/junk folder
- Verify the recipient email address is correct
- Check email service logs for delivery status
- Some email providers have sending limits

## Security Notes

- **Never commit `.env` files** to version control
- Use **App Passwords** for Gmail (not your main password)
- Use **API keys** for services like SendGrid (not account passwords)
- Rotate credentials regularly
- Use different credentials for development and production
- Consider using environment variable management services for production

## Future Enhancements

Potential improvements:
- Email verification (require users to verify email before account activation)
- Password reset emails
- Notification emails for starred professors updates
- Email preferences/unsubscribe functionality
- Email templates customization
- Bounce and complaint handling

