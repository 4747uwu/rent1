// routes/compression.routes.js
import express from 'express';
import {
    toggleSingleLabCompression,
    toggleBatchLabsCompression,
    getCompressionStatus,
    getAllLabsCompressionStatus
} from '../controllers/compression.controller.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// 🔒 All routes are protected by authentication
// 🔑 All routes require API key in request body/query

// Toggle compression for single lab
router.post('/toggle-single', protect, toggleSingleLabCompression);

// Toggle compression for multiple labs (batch)
router.post('/toggle-batch', protect, toggleBatchLabsCompression);

// Get compression status for single or multiple labs
router.get('/status/:labId', protect, getCompressionStatus);
router.get('/status', protect, getCompressionStatus);

// Get compression status for all labs
router.get('/status-all', protect, getAllLabsCompressionStatus);

export default router;