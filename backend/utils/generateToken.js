// utils/generateToken.js
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const generateToken = (payload) => {
    // Handle both old format (just user ID) and new format (object with user context)
    let tokenPayload;
    
    if (typeof payload === 'object' && payload.userId) {
        // New multi-tenant format
        tokenPayload = {
            id: payload.userId, // Keep 'id' for backward compatibility
            userId: payload.userId,
            role: payload.role,
            organizationId: payload.organizationId,
            organizationIdentifier: payload.organizationIdentifier,
            iat: Math.floor(Date.now() / 1000)
        };
    } else {
        // Legacy format - assume it's just user ID
        tokenPayload = {
            id: payload,
            iat: Math.floor(Date.now() / 1000)
        };
    }

    return jwt.sign(
        tokenPayload,
        process.env.JWT_SECRET,
        {
            expiresIn: process.env.JWT_EXPIRES_IN || '1h',
        }
    );
};

export default generateToken;