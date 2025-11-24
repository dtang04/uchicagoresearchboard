/**
 * Authentication Service
 * Handles password hashing and JWT token generation
 */

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

require('dotenv').config();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d'; // Token expires in 7 days

/**
 * Hash a password
 */
async function hashPassword(password) {
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
}

/**
 * Compare password with hash
 */
async function comparePassword(password, hash) {
    return await bcrypt.compare(password, hash);
}

/**
 * Generate JWT token for user
 */
function generateToken(userId, email) {
    return jwt.sign(
        { userId, email },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
}

/**
 * Verify JWT token
 */
function verifyToken(token) {
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        console.log('Token verified successfully:', { userId: decoded.userId, email: decoded.email });
        return decoded;
    } catch (error) {
        console.error('Token verification failed:', error.message);
        return null;
    }
}

/**
 * Middleware to authenticate requests
 */
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    console.log('Auth middleware: Request to', req.path, '- Token received:', token ? 'Yes' : 'No');
    
    if (!token) {
        console.log('Auth middleware: No token provided');
        return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
        console.log('Auth middleware: Token verification failed');
        return res.status(403).json({ error: 'Invalid or expired token' });
    }

    console.log('Auth middleware: Token verified, userId:', decoded.userId);
    req.user = decoded;
    next();
}

module.exports = {
    hashPassword,
    comparePassword,
    generateToken,
    verifyToken,
    authenticateToken
};

