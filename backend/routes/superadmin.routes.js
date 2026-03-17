import express from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import {
    getAllOrganizations,
    getOrganizationById,
    createOrganization,
    updateOrganization,
    deleteOrganization,
    getOrganizationStats
} from '../controllers/superadmin.controller.js';

const router = express.Router();

// All routes require super admin authorization
router.use(protect);
router.use(authorize('super_admin'));

// Organization CRUD routes
router.get('/organizations/stats', getOrganizationStats);
router.get('/organizations', getAllOrganizations);
router.get('/organizations/:id', getOrganizationById);
router.post('/organizations', createOrganization);
router.put('/organizations/:id', updateOrganization);
router.delete('/organizations/:id', deleteOrganization);

export default router;