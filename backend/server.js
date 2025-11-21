const express = require('express');
const cors = require('cors');
const db = require('./database');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

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

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
async function startServer() {
    try {
        await db.initDatabase();
        
        app.listen(PORT, () => {
            console.log(`🚀 Backend server running on http://localhost:${PORT}`);
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
            console.log(`   GET  /api/health - Health check`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();
