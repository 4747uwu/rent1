// middleware/auth.middleware.js
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import User from '../models/userModel.js';
import Organization from '../models/organisation.js';

dotenv.config();

export const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

     // ✅ ADD: fallback to query param token (for direct browser downloads)
    if (!token && req.query.token) {
        token = req.query.token;
    }

    
    if (!token) {
        return res.status(401).json({ 
            success: false, 
            message: 'Not authorized, no token provided' 
        });
    }

    try {
        if (!process.env.JWT_SECRET) {
            throw new Error('JWT_SECRET is not configured on the server.');
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        let user;
        
        // Handle both old and new token formats
        const userId = decoded.userId || decoded.id;
        
        if (decoded.role === 'super_admin') {
            // Super admin - can access without organization context
            user = await User.findById(userId)
                .select('-password')
                .populate('organization', 'name identifier status displayName');
        } else {
            // Regular users - must match organization context
            const query = { _id: userId };
            
            if (decoded.organizationIdentifier) {
                query.organizationIdentifier = decoded.organizationIdentifier;
            }
            
            user = await User.findOne(query)
                .select('-password')
                .populate('organization', 'name identifier status displayName')
                .populate('lab', 'name identifier isActive fullIdentifier');
        }

        if (!user) {
            return res.status(401).json({ 
                success: false, 
                message: 'Not authorized, user not found or organization context mismatch' 
            });
        }

        if (!user.isActive) {
            return res.status(403).json({ 
                success: false, 
                message: 'User account is deactivated' 
            });
        }

        // Check organization status for non-super admin users
        if (user.role !== 'super_admin' && user.organization) {
            if (user.organization.status !== 'active') {
                return res.status(403).json({
                    success: false,
                    message: 'Organization account is not active'
                });
            }
        }

        // Add token context to user object
        user.tokenContext = {
            organizationId: decoded.organizationId,
            organizationIdentifier: decoded.organizationIdentifier
        };

        req.user = user;
        next();

    } catch (error) {
        console.error('Token verification error:', error.message);

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                success: false, 
                message: 'Token expired',
                code: 'TOKEN_EXPIRED'
            });
        } else if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid token' 
            });
        } else {
            return res.status(500).json({ 
                success: false, 
                message: 'Server error during authentication' 
            });
        }
    }
};

// Multi-tenant authorization with organization context
export const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized to access this route'
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `User role '${req.user.role}' is not authorized to access this route`
            });
        }

        next();
    };
};

// Organization context middleware - ensures user can only access their organization's data
export const ensureOrganizationContext = (req, res, next) => {
    if (req.user.role === 'super_admin') {
        // Super admin can access all organizations
        return next();
    }

    if (!req.user.organizationIdentifier) {
        return res.status(403).json({
            success: false,
            message: 'No organization context available'
        });
    }

    // Add organization filter to request for use in controllers
    req.organizationFilter = {
        organizationIdentifier: req.user.organizationIdentifier,
        organization: req.user.organization?._id
    };

    next();
};