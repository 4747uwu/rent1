import express from 'express';
import {
    getAvailableRoles,
    getUsers,
    createUser,
    updateUserCredentials,
    updateUserRole,
    toggleUserStatus,
    resetUserPassword,
    deleteUser,
    getStats
} from '../controllers/groupUserManagement.controller.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// ✅ GROUP USER MANAGEMENT ROUTES
router.get('/user-management/available-roles', protect, getAvailableRoles);
router.get('/user-management/users', protect, getUsers);
router.post('/create', protect, createUser);
router.put('/:userId/credentials', protect, updateUserCredentials);
router.put('/:userId/role', protect, updateUserRole);
router.put('/:userId/status', protect, toggleUserStatus);
router.post('/:userId/reset-password', protect, resetUserPassword);
router.delete('/:userId', protect, deleteUser);

// ✅ STATS ROUTE
router.get('/stats', protect, getStats);

export default router;