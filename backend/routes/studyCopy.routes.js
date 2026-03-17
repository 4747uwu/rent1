// backend/routes/studyCopy.routes.js

import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import studyCopyController from '../controllers/studyCopy.controller.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// ✅ ADD: Verify study endpoint
router.get('/verify/:bharatPacsId', studyCopyController.verifyStudy);

// Copy study to another organization
router.post('/copy/:bharatPacsId', studyCopyController.copyStudyToOrganization);

// Get study copy history
router.get('/history/:bharatPacsId', studyCopyController.getStudyCopyHistory);

export default router;