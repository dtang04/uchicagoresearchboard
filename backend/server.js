// Log immediately - before anything else
console.log('🚀 Server file loaded');
console.log('📦 Node version:', process.version);
console.log('📂 Current directory:', process.cwd());
console.log('📁 __dirname:', __dirname);

require('dotenv').config();
console.log('✅ dotenv loaded');

const express = require('express');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const path = require('path');
console.log('✅ Express and dependencies loaded');

const db = require('./database');
const statsService = require('./stats-service');
const auth = require('./auth-service');
const emailService = require('./email-service');
console.log('✅ All modules loaded');

const app = express();
const PORT = process.env.PORT || 3001;

// Environment variables for OAuth
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const SESSION_SECRET = process.env.SESSION_SECRET || 'your-session-secret-change-in-production';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Middleware
app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? (process.env.FRONTEND_URL || '*') 
        : FRONTEND_URL,
    credentials: true
}));
app.use(express.json());

// Session configuration for OAuth
// Use a simple file-based store in production to avoid MemoryStore warning
// For a single-process deployment, this is sufficient
const sessionConfig = {
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
};

// In production, suppress the MemoryStore warning (it's fine for single-process deployments)
if (process.env.NODE_ENV === 'production') {
    // MemoryStore is fine for single-process Railway deployments
    // The warning is for multi-process scenarios
    console.log('ℹ️  Using MemoryStore for sessions (fine for single-process deployment)');
}

app.use(session(sessionConfig));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Passport serialization
passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await db.getUserById(id);
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});

// Google OAuth Strategy
if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
    // For OAuth, the callback URL should point to the backend, not frontend
    const callbackURL = process.env.GOOGLE_CALLBACK_URL || `http://localhost:3001/api/auth/google/callback`;
    
    passport.use(new GoogleStrategy({
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: callbackURL
    },
    async (accessToken, refreshToken, profile, done) => {
        try {
            const email = profile.emails[0].value;
            const name = profile.displayName;
            const googleId = profile.id;
            
            // Check if user exists by Google ID
            let user = await db.getUserByGoogleId(googleId);
            
            if (!user) {
                // Check if user exists by email
                user = await db.getUserByEmail(email);
                if (user) {
                    // Update existing user with Google ID (optional - you might want to handle this differently)
                    // For now, we'll create a new user or return error
                    return done(null, false, { message: 'Email already registered. Please login with email/password.' });
                }
                
                // Create new user
                const userId = await db.createUser(email, null, name, googleId);
                user = await db.getUserById(userId);
            }
            
            return done(null, user);
        } catch (error) {
            return done(error, null);
        }
    }));
} else {
    console.warn('⚠️  Google OAuth credentials not set. Google login will not work.');
    console.warn('   Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.');
}

// Helper to get client IP and user agent
function getClientInfo(req) {
    return {
        ipAddress: req.ip || req.connection.remoteAddress || null,
        userAgent: req.get('user-agent') || null
    };
}

// API Routes

// Get all departments data
app.get('/api/departments', async (req, res) => {
    try {
        const allDepts = await db.getAllDepartments();
        const departments = {};
        
        for (const dept of allDepts) {
            departments[dept.name] = await db.getProfessorsByDepartment(dept.name);
        }
        
        res.json({
            departments: departments,
            lastUpdated: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error fetching departments:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get department data by name
app.post('/api/departments', async (req, res) => {
    try {
        const { department } = req.body;
        
        if (!department) {
            return res.status(400).json({ error: 'Department name is required' });
        }
        
        const departmentData = await db.getProfessorsByDepartment(department);
        
        // Track department view
        const clientInfo = getClientInfo(req);
        await db.trackDepartmentView(department, clientInfo.ipAddress, clientInfo.userAgent);
        
        console.log(`[API] Returning data for ${department}: ${departmentData.length} professors/labs`);
        
        res.json({
            department: department,
            data: departmentData,
            count: departmentData.length,
            lastUpdated: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error fetching department data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get all available department names
app.get('/api/departments/list', async (req, res) => {
    try {
        const allDepts = await db.getAllDepartments();
        const departmentNames = allDepts.map(dept => dept.name);
        
        res.json({
            departments: departmentNames,
            count: departmentNames.length
        });
    } catch (error) {
        console.error('Error fetching department list:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get trending labs for a department
app.post('/api/trending-labs', async (req, res) => {
    try {
        const { department } = req.body;
        
        if (!department) {
            return res.status(400).json({ error: 'Department name is required' });
        }
        
        const trendingLabs = await db.getTrendingLabs(department);
        
        console.log(`[API] Returning trending labs for ${department}:`, trendingLabs);
        
        res.json({
            trendingLabs: trendingLabs,
            department: department,
            lastUpdated: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error fetching trending labs:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update trending labs for a department
app.put('/api/trending-labs', async (req, res) => {
    try {
        const { department, trendingLabs } = req.body;
        
        if (!department || !Array.isArray(trendingLabs)) {
            return res.status(400).json({ error: 'Department and trendingLabs array are required' });
        }
        
        await db.setTrendingLabs(department, trendingLabs);
        
        res.json({
            success: true,
            message: `Trending labs updated for ${department}`,
            trendingLabs: trendingLabs
        });
    } catch (error) {
        console.error('Error updating trending labs:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Track professor view
app.post('/api/analytics/view', async (req, res) => {
    try {
        const { professorName, departmentName } = req.body;
        
        if (!professorName || !departmentName) {
            return res.status(400).json({ error: 'Professor name and department name are required' });
        }
        
        const professor = await db.getProfessorByNameAndDepartment(professorName, departmentName);
        if (!professor) {
            return res.status(404).json({ error: 'Professor not found' });
        }
        
        const clientInfo = getClientInfo(req);
        await db.trackProfessorView(professor.id, clientInfo.ipAddress, clientInfo.userAgent);
        
        res.json({ success: true, message: 'View tracked' });
    } catch (error) {
        console.error('Error tracking view:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Track professor click
app.post('/api/analytics/click', async (req, res) => {
    try {
        const { professorName, departmentName, clickType } = req.body;
        
        if (!professorName || !departmentName || !clickType) {
            return res.status(400).json({ error: 'Professor name, department name, and click type are required' });
        }
        
        const professor = await db.getProfessorByNameAndDepartment(professorName, departmentName);
        if (!professor) {
            return res.status(404).json({ error: 'Professor not found' });
        }
        
        const clientInfo = getClientInfo(req);
        await db.trackProfessorClick(professor.id, clickType, clientInfo.ipAddress, clientInfo.userAgent);
        
        res.json({ success: true, message: 'Click tracked' });
    } catch (error) {
        console.error('Error tracking click:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get professor analytics
app.get('/api/analytics/professor/:professorName/:departmentName', async (req, res) => {
    try {
        const { professorName, departmentName } = req.params;
        
        const professor = await db.getProfessorByNameAndDepartment(professorName, departmentName);
        if (!professor) {
            return res.status(404).json({ error: 'Professor not found' });
        }
        
        const analytics = await db.getProfessorAnalytics(professor.id);
        
        res.json({
            professor: {
                name: professor.name,
                department: departmentName
            },
            analytics: analytics
        });
    } catch (error) {
        console.error('Error fetching analytics:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get all analytics (admin endpoint)
app.get('/api/analytics/all', async (req, res) => {
    try {
        const analytics = await db.getAllAnalytics();
        res.json(analytics);
    } catch (error) {
        console.error('Error fetching analytics:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Authentication endpoints

// Sign up with email
app.post('/api/auth/signup', async (req, res) => {
    try {
        const { email, password, name } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }
        
        // Check if user already exists
        const existingUser = await db.getUserByEmail(email);
        if (existingUser) {
            return res.status(400).json({ error: 'User with this email already exists' });
        }
        
        // Hash password and create user
        const passwordHash = await auth.hashPassword(password);
        const userId = await db.createUser(email, passwordHash, name || null);
        
        // Generate token
        const token = auth.generateToken(userId, email);
        const user = await db.getUserById(userId);
        
        // Send confirmation email (non-blocking - don't fail signup if email fails)
        emailService.sendSignupConfirmation(email, name).catch(err => {
            console.error('Failed to send signup confirmation email:', err);
            // Don't throw - signup should succeed even if email fails
        });
        
        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name
            }
        });
    } catch (error) {
        console.error('Error in signup:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Login with email
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }
        
        // Get user
        const user = await db.getUserByEmail(email);
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        
        // Check password
        const validPassword = await auth.comparePassword(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        
        // Generate token
        const token = auth.generateToken(user.id, user.email);
        
        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name
            }
        });
    } catch (error) {
        console.error('Error in login:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Google OAuth routes

// Initiate Google OAuth
if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
    app.get('/api/auth/google', passport.authenticate('google', {
        scope: ['profile', 'email']
    }));

    // Google OAuth callback
    app.get('/api/auth/google/callback',
        passport.authenticate('google', { session: false, failureRedirect: `${FRONTEND_URL}?auth_error=google_failed` }),
        async (req, res) => {
            try {
                const user = req.user;
                
                // Generate JWT token
                const token = auth.generateToken(user.id, user.email);
                
                // Redirect to frontend with token
                res.redirect(`${FRONTEND_URL}?auth_token=${token}&user_id=${user.id}&email=${encodeURIComponent(user.email)}&name=${encodeURIComponent(user.name || '')}`);
            } catch (error) {
                console.error('Error in Google OAuth callback:', error);
                res.redirect(`${FRONTEND_URL}?auth_error=token_generation_failed`);
            }
        }
    );
} else {
    // Fallback routes when OAuth is not configured
    app.get('/api/auth/google', (req, res) => {
        res.status(503).json({ 
            error: 'Google OAuth is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.',
            configured: false
        });
    });
    
    app.get('/api/auth/google/callback', (req, res) => {
        res.redirect(`${FRONTEND_URL}?auth_error=oauth_not_configured`);
    });
}

// Get current user (verify token)
app.get('/api/auth/me', auth.authenticateToken, async (req, res) => {
    try {
        const user = await db.getUserById(req.user.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json({
            user: {
                id: user.id,
                email: user.email,
                name: user.name
            }
        });
    } catch (error) {
        console.error('Error getting user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Starred professors endpoints

// Get starred professors for current user
app.get('/api/starred', auth.authenticateToken, async (req, res) => {
    try {
        const starred = await db.getStarredProfessors(req.user.userId);
        res.json({ starred });
    } catch (error) {
        console.error('Error getting starred professors:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get starred professor IDs (for checking which are starred)
app.get('/api/starred/ids', auth.authenticateToken, async (req, res) => {
    try {
        const starredMap = await db.getStarredProfessorIds(req.user.userId);
        res.json({ starred: starredMap });
    } catch (error) {
        console.error('Error getting starred IDs:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Star a professor
app.post('/api/starred', auth.authenticateToken, async (req, res) => {
    try {
        const { professorName, departmentName } = req.body;
        
        if (!professorName || !departmentName) {
            return res.status(400).json({ error: 'Professor name and department name are required' });
        }
        
        await db.starProfessor(req.user.userId, professorName, departmentName);
        res.json({ success: true, message: 'Professor starred' });
    } catch (error) {
        console.error('Error starring professor:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});

// Unstar a professor
app.delete('/api/starred', auth.authenticateToken, async (req, res) => {
    try {
        const { professorName, departmentName } = req.body;
        
        if (!professorName || !departmentName) {
            return res.status(400).json({ error: 'Professor name and department name are required' });
        }
        
        await db.unstarProfessor(req.user.userId, professorName, departmentName);
        res.json({ success: true, message: 'Professor unstarred' });
    } catch (error) {
        console.error('Error unstarring professor:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});

// Get professor stats
app.post('/api/professor/stats', async (req, res) => {
    try {
        const { professorName, departmentName } = req.body;
        
        if (!professorName || !departmentName) {
            return res.status(400).json({ error: 'Professor name and department name are required' });
        }
        
        const professor = await db.getProfessorByNameAndDepartment(professorName, departmentName);
        if (!professor) {
            return res.status(404).json({ error: 'Professor not found' });
        }
        
        // Get stats (will estimate if not available)
        const stats = await statsService.getProfessorStats({
            name: professorName,
            departmentName: departmentName,
            title: professor.title,
            lab: professor.lab,
            labWebsite: professor.lab_website
        }, db);
        
        res.json({
            professor: {
                name: professorName,
                department: departmentName
            },
            stats: stats
        });
    } catch (error) {
        console.error('Error fetching professor stats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Health check endpoints (Railway checks these) - MUST be before static file serving
// These need to respond immediately, even before database is ready
// Railway will kill the container if health checks don't return 200 OK quickly
let serverReady = false;
let databaseReady = false;

app.get('/api/health', (req, res) => {
    // Always return 200 OK - Railway needs this to keep the container alive
    res.status(200).json({ 
        status: 'ok',
        timestamp: new Date().toISOString(),
        ready: serverReady,
        database: databaseReady ? 'ready' : 'initializing'
    });
});

app.get('/health', (req, res) => {
    // Always return 200 OK - Railway needs this to keep the container alive
    res.status(200).json({ 
        status: 'ok',
        timestamp: new Date().toISOString(),
        ready: serverReady,
        database: databaseReady ? 'ready' : 'initializing'
    });
});

// Root health check (some platforms check this)
// Only return JSON if explicitly requested with Accept: application/json header
// Otherwise, let static file middleware serve index.html
app.get('/', (req, res, next) => {
    const acceptHeader = req.get('Accept') || '';
    // Only return JSON if it's a pure API request (no text/html in Accept header)
    // Browsers send text/html, so they'll fall through to static file serving
    if (acceptHeader.includes('application/json') && 
        !acceptHeader.includes('text/html') && 
        !acceptHeader.includes('*/*') &&
        acceptHeader.split(',').length === 1) {
        // Pure JSON request - return API status
        return res.json({ status: 'ok', service: 'uchicago-research-board-api' });
    }
    // For all other requests (browsers), let static file middleware handle it
    next();
});

// Serve static files (must be after all API routes)
// Always serve in production, or if RAILWAY environment is set (Railway deployment)
// Railway automatically sets RAILWAY environment variable, and we also check RAILWAY_ENVIRONMENT
// Default to serving static files unless explicitly in development mode
// Also check if PORT is set (Railway always sets this) as a fallback
console.log('🔍 Checking static file serving configuration...');
const isDevelopment = process.env.NODE_ENV === 'development' && !process.env.RAILWAY && !process.env.RAILWAY_ENVIRONMENT;
// Railway always sets PORT, so if PORT is set and NODE_ENV is not explicitly 'development', serve static files
const isRailway = process.env.RAILWAY || process.env.RAILWAY_ENVIRONMENT || (process.env.PORT && process.env.NODE_ENV !== 'development');
const shouldServeStatic = !isDevelopment || process.env.NODE_ENV === 'production' || isRailway;

console.log(`🔍 Static file serving check:`);
console.log(`   isDevelopment: ${isDevelopment}`);
console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
console.log(`   PORT: ${process.env.PORT || 'not set'}`);
console.log(`   RAILWAY: ${process.env.RAILWAY || 'not set'}`);
console.log(`   RAILWAY_ENVIRONMENT: ${process.env.RAILWAY_ENVIRONMENT || 'not set'}`);
console.log(`   isRailway (detected): ${isRailway}`);
console.log(`   shouldServeStatic: ${shouldServeStatic}`);

if (shouldServeStatic) {
    try {
        const staticPath = path.join(__dirname, '..');
        console.log(`📁 Serving static files from: ${staticPath}`);
        
        // Verify the path exists and index.html is accessible
        const fs = require('fs');
        const indexPath = path.join(staticPath, 'index.html');
        const absoluteIndexPath = path.resolve(indexPath);
        
        console.log(`🔍 Checking for index.html:`);
        console.log(`   Relative path: ${indexPath}`);
        console.log(`   Absolute path: ${absoluteIndexPath}`);
        console.log(`   __dirname: ${__dirname}`);
        console.log(`   staticPath: ${staticPath}`);
        
        if (fs.existsSync(absoluteIndexPath)) {
            console.log(`✅ Found index.html at: ${absoluteIndexPath}`);
            // List files in the static directory to help debug
            try {
                const files = fs.readdirSync(staticPath);
                console.log(`📋 Files in static directory (${staticPath}):`, files.slice(0, 10).join(', '), files.length > 10 ? `... (${files.length} total)` : '');
            } catch (err) {
                console.warn(`⚠️  Could not list files in static directory: ${err.message}`);
            }
        } else {
            console.error(`❌ index.html NOT FOUND at: ${absoluteIndexPath}`);
            console.error(`   This is why the frontend isn't loading!`);
            // Try to find where index.html actually is
            try {
                const files = fs.readdirSync(staticPath);
                console.log(`📋 Files in static directory:`, files.join(', '));
            } catch (err) {
                console.error(`   Cannot read directory ${staticPath}: ${err.message}`);
            }
        }
        
        // Serve static files from parent directory (frontend), but exclude /api routes
        // Use absolute path to ensure it works correctly
        const absoluteStaticPath = path.resolve(staticPath);
        console.log(`📂 Absolute static path: ${absoluteStaticPath}`);
        
        // Register static file middleware properly
        // Skip /api routes from static file serving
        app.use((req, res, next) => {
            if (req.path.startsWith('/api')) {
                return next(); // Skip static files for API routes
            }
            next(); // Continue to static middleware
        });
        
        // Serve static files (CSS, JS, images, etc.)
        app.use(express.static(absoluteStaticPath));
        
        // Serve index.html for all non-API routes (SPA routing)
        // This must be after the static middleware
        app.get('*', (req, res, next) => {
            // Skip API routes
            if (req.path.startsWith('/api')) {
                return next();
            }
            const indexPath = path.resolve(staticPath, 'index.html');
            console.log(`📄 Attempting to serve index.html for: ${req.path}`);
            res.sendFile(indexPath, (err) => {
                if (err) {
                    console.error(`❌ Error serving index.html for ${req.path}: ${err.message}`);
                    console.error(`   Attempted path: ${indexPath}`);
                    // Send a proper error response
                    res.status(404).send(`File not found: ${req.path}`);
                } else {
                    console.log(`✅ Successfully served index.html for: ${req.path}`);
                }
            });
        });
        console.log('✅ Static file serving configured');
    } catch (error) {
        console.error('❌ Error configuring static file serving:', error);
        // Don't throw - let server start anyway
    }
} else {
    console.log('⚠️  Static file serving disabled (development mode)');
}

// Start server
async function startServer() {
    try {
        console.log('🔧 Starting server...');
        console.log(`📦 PORT: ${PORT}`);
        console.log(`🌍 NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
        console.log(`📂 __dirname: ${__dirname}`);
        
        // Listen on 0.0.0.0 to accept connections from Railway
        // Start listening IMMEDIATELY so Railway health checks pass
        const HOST = process.env.HOST || '0.0.0.0';
        const server = app.listen(PORT, HOST, () => {
            serverReady = true; // Mark server as ready for health checks
            const env = process.env.NODE_ENV || 'development';
            console.log(`🚀 Backend server running on http://${HOST}:${PORT} (${env})`);
            console.log(`✅ Server is ready and listening!`);
            console.log(`🏥 Health check available at: http://${HOST}:${PORT}/health`);
            if (process.env.NODE_ENV === 'production') {
                console.log(`📁 Serving static files from: ${path.join(__dirname, '..')}`);
            }
            console.log(`📊 API endpoints:`);
            console.log(`   GET  /api/departments - Get all departments data`);
            console.log(`   POST /api/departments - Get department data by name`);
            console.log(`   GET  /api/departments/list - Get list of all departments`);
            console.log(`   POST /api/trending-labs - Get trending labs`);
            console.log(`   PUT  /api/trending-labs - Update trending labs`);
            console.log(`   POST /api/analytics/view - Track professor view`);
            console.log(`   POST /api/analytics/click - Track professor click`);
            console.log(`   GET  /api/analytics/professor/:name/:dept - Get professor analytics`);
            console.log(`   GET  /api/analytics/all - Get all analytics (admin)`);
            console.log(`   POST /api/professor/stats - Get professor stats`);
            console.log(`   POST /api/auth/signup - Sign up with email`);
            console.log(`   POST /api/auth/login - Login with email`);
            console.log(`   GET  /api/auth/google - Initiate Google OAuth`);
            console.log(`   GET  /api/auth/google/callback - Google OAuth callback`);
            console.log(`   GET  /api/auth/me - Get current user`);
            if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
                console.log(`   ✅ Google OAuth configured`);
            } else {
                console.log(`   ⚠️  Google OAuth not configured (set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET)`);
            }
            console.log(`   GET  /api/starred - Get starred professors`);
            console.log(`   GET  /api/starred/ids - Get starred professor IDs`);
            console.log(`   POST /api/starred - Star a professor`);
            console.log(`   DELETE /api/starred - Unstar a professor`);
            console.log(`   GET  /api/health - Health check`);
        });
        
        // Initialize database AFTER server starts listening (non-blocking)
        // This allows Railway health checks to pass immediately
        console.log('💾 Initializing database...');
        db.initDatabase().then(() => {
            databaseReady = true;
            console.log('✅ Database initialized successfully');
            console.log('🎉 Server fully ready - all systems operational!');
        }).catch((err) => {
            console.error('❌ Database initialization failed:', err);
            console.error('Error details:', err.message);
            console.error('Stack:', err.stack);
            // Don't exit - server can still serve some endpoints
            // Database will be retried on first use
            console.log('⚠️  Server running without database (some features may not work)');
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        console.error('Error stack:', error.stack);
        process.exit(1);
    }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    console.error('Error stack:', error.stack);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Handle SIGTERM gracefully (Railway sends this to stop containers)
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down gracefully...');
    // Get database instance and close it if available
    try {
        if (db && db.getDatabase) {
            const database = db.getDatabase();
            if (database && typeof database.close === 'function') {
                database.close((err) => {
                    if (err) {
                        console.error('Error closing database:', err);
                    } else {
                        console.log('✅ Database closed');
                    }
                    process.exit(0);
                });
                return; // Exit early, close callback will handle process.exit
            }
        }
    } catch (error) {
        // Database not initialized or getDatabase() threw an error
        console.log('⚠️  Database not available for graceful shutdown:', error.message);
    }
    // If we get here, database wasn't available or already closed
    console.log('✅ Shutting down (no database connection to close)');
    process.exit(0);
});

// Start the server
console.log('🎬 Starting server initialization...');
startServer().catch((err) => {
    console.error('❌ Fatal error starting server:', err);
    process.exit(1);
});
