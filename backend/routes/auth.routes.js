// routes/auth.routes.js
import express from 'express';
import { 
    loginUser, 
    getMe, 
    logoutUser, 
    refreshToken,
    switchOrganization,
    getAvailableOrganizations,
    labConnectorLogin,
    getMyColumns
} from '../controllers/auth.controller.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/login', loginUser);
router.get('/me', protect, getMe); // Get current logged-in user
router.post('/logout', protect, logoutUser); // Logout current user
router.post('/refresh-token', protect, refreshToken); // ✅ NEW
router.get('/my-columns', protect, getMyColumns);


// Super admin specific routes
router.post('/switch-organization', protect, authorize('super_admin'), switchOrganization);
router.get('/organizations', protect, authorize('super_admin'), getAvailableOrganizations);
router.post('/lab-login', labConnectorLogin); // <-- New dedicated endpoint for Electron app
export default router;