// Middleware to protect dashboard pages
const jwt = require('jsonwebtoken');

// Protect dashboard routes
const protectDashboard = (req, res, next) => {
    // Get token from cookie or Authorization header
    const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        // For HTML requests, redirect to login
        if (req.accepts('html')) {
            return res.redirect('/login.html');
        }
        // For API requests, return 401
        return res.status(401).json({
            success: false,
            message: 'Access denied. No token provided.'
        });
    }

    try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        // For HTML requests, redirect to login
        if (req.accepts('html')) {
            return res.redirect('/login.html');
        }
        // For API requests, return 401
        return res.status(401).json({
            success: false,
            message: 'Invalid token.'
        });
    }
};

// Role-based access control for dashboards
const authorizeDashboard = (role) => {
    return (req, res, next) => {
        if (req.user.role !== role) {
            // For HTML requests, redirect to login with message
            if (req.accepts('html')) {
                return res.redirect('/login.html?error=unauthorized');
            }
            // For API requests, return 403
            return res.status(403).json({
                success: false,
                message: 'Access denied. Insufficient permissions.'
            });
        }
        next();
    };
};

module.exports = {
    protectDashboard,
    authorizeDashboard
};
