/**
 * Email Service
 * Handles sending emails (confirmation, notifications, etc.)
 */

const nodemailer = require('nodemailer');

require('dotenv').config();

// Email configuration from environment variables
const EMAIL_HOST = process.env.EMAIL_HOST || 'smtp.gmail.com';
const EMAIL_PORT = process.env.EMAIL_PORT || 587;
const EMAIL_USER = process.env.EMAIL_USER || '';
const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD || '';
const EMAIL_FROM = process.env.EMAIL_FROM || EMAIL_USER || 'noreply@uchicago-research-board.com';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Create transporter (reused for all emails)
let transporter = null;

function getTransporter() {
    if (transporter) {
        return transporter;
    }

    // Only create transporter if email credentials are configured
    if (!EMAIL_USER || !EMAIL_PASSWORD) {
        console.warn('⚠️  Email credentials not configured. Email sending will be disabled.');
        console.warn('   Set EMAIL_USER and EMAIL_PASSWORD environment variables to enable email.');
        return null;
    }

    transporter = nodemailer.createTransport({
        host: EMAIL_HOST,
        port: EMAIL_PORT,
        secure: EMAIL_PORT === 465, // true for 465, false for other ports
        auth: {
            user: EMAIL_USER,
            pass: EMAIL_PASSWORD
        }
    });

    return transporter;
}

/**
 * Send signup confirmation email
 */
async function sendSignupConfirmation(email, name) {
    const emailTransporter = getTransporter();
    
    if (!emailTransporter) {
        console.warn('Email transporter not available. Skipping confirmation email.');
        return { success: false, error: 'Email service not configured' };
    }

    const userName = name || email.split('@')[0];
    
    const mailOptions = {
        from: `"UChicago Research Board" <${EMAIL_FROM}>`,
        to: email,
        subject: 'Welcome to UChicago Research Board!',
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        line-height: 1.6;
                        color: #333;
                        max-width: 600px;
                        margin: 0 auto;
                        padding: 20px;
                    }
                    .header {
                        background-color: #800020;
                        color: white;
                        padding: 20px;
                        text-align: center;
                        border-radius: 5px 5px 0 0;
                    }
                    .content {
                        background-color: #f9f9f9;
                        padding: 30px;
                        border-radius: 0 0 5px 5px;
                    }
                    .button {
                        display: inline-block;
                        padding: 12px 24px;
                        background-color: #800020;
                        color: white;
                        text-decoration: none;
                        border-radius: 5px;
                        margin: 20px 0;
                    }
                    .footer {
                        margin-top: 30px;
                        padding-top: 20px;
                        border-top: 1px solid #ddd;
                        font-size: 12px;
                        color: #666;
                        text-align: center;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Welcome to UChicago Research Board!</h1>
                </div>
                <div class="content">
                    <p>Hi ${userName},</p>
                    
                    <p>Hello and thank you for signing up for the UChicago Research Board! Your account has been successfully created.</p>
                    
                    <p>You can now:</p>
                    <ul>
                        <li>Browse research labs and professors across departments</li>
                        <li>Star your favorite professors for easy access</li>
                        <li>Explore trending labs in your department of interest</li>
                        <li>View detailed analytics and research information</li>
                    </ul>
                    
                    <p style="text-align: center;">
                        <a href="${FRONTEND_URL}" class="button">Get Started</a>
                    </p>
                    
                    <p>If you have any questions or need assistance, please don't hesitate to reach out.</p>
                    
                    <p>Best regards,<br>The UChicago Research Board Team</p>
                </div>
                <div class="footer">
                    <p>This is an automated message. Please do not reply to this email.</p>
                    <p>&copy; ${new Date().getFullYear()} UChicago Research Board</p>
                </div>
            </body>
            </html>
        `,
        text: `
Welcome to UChicago Research Board!

Hi ${userName},

Thank you for signing up for the UChicago Research Board! Your account has been successfully created.

You can now:
- Browse research labs and professors across departments
- Star your favorite professors for easy access
- Explore trending labs in your department of interest
- View detailed analytics and research information

Get started: ${FRONTEND_URL}

If you have any questions or need assistance, please don't hesitate to reach out.

Best regards,
The UChicago Research Board Team

---
This is an automated message. Please do not reply to this email.
© ${new Date().getFullYear()} UChicago Research Board
        `
    };

    try {
        const info = await emailTransporter.sendMail(mailOptions);
        console.log('✅ Signup confirmation email sent:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('❌ Error sending signup confirmation email:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Verify email transporter configuration
 */
async function verifyEmailConfig() {
    const emailTransporter = getTransporter();
    
    if (!emailTransporter) {
        return { configured: false, message: 'Email service not configured' };
    }

    try {
        await emailTransporter.verify();
        return { configured: true, message: 'Email service is ready' };
    } catch (error) {
        return { configured: false, message: `Email service verification failed: ${error.message}` };
    }
}

module.exports = {
    sendSignupConfirmation,
    verifyEmailConfig
};

