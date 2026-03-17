import express from 'express';
import { revertStudyToRadiologist } from '../controllers/revert.controller.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// ✅ POST /api/revert/studies/:studyId
// Admin-only: revert a final_report_downloaded study back to radiologist
router.post('/studies/:studyId', protect, revertStudyToRadiologist);

export default router;