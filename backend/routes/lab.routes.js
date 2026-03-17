import express from 'express';
import {
    getLabValues,
    getLabPendingStudies,
    // getLabInProgressStudies,
    getLabCompletedStudies,
    getAllLabStudies
} from '../controllers/lab.controller.js';

import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// ✅ VALUES ENDPOINT FOR LAB DASHBOARD COUNTS
router.get('/values', protect, getLabValues);

// ✅ LAB STUDIES ENDPOINTS
router.get('/studies/pending', protect, getLabPendingStudies);
// router.get('/studies/inprogress', protect, getLabInProgressStudies);
router.get('/studies/completed', protect, getLabCompletedStudies);
router.get('/studies', protect, getAllLabStudies);

export default router;