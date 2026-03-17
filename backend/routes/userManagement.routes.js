import express from 'express';
import {
    createUserWithRole,
    getUsersByRole,
    updateUserRoleConfig,
    getAvailableRoles,
    getUserHierarchy
} from '../controllers/userManagement.controller.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// ✅ USER CREATION ROUTES
router.post('/create', protect, createUserWithRole);

// ✅ USER LISTING AND MANAGEMENT ROUTES
router.get('/users', protect, getUsersByRole);
router.get('/hierarchy', protect, getUserHierarchy);

// ✅ ROLE MANAGEMENT ROUTES
router.get('/available-roles', protect, getAvailableRoles);
router.put('/:userId/role-config', protect, updateUserRoleConfig);

// ✅ ADDITIONAL UTILITY ROUTES
router.get('/users/by-role/:role', protect, getUsersByRole);

export default router;