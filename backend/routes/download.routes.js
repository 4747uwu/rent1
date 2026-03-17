import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import jwt from 'jsonwebtoken';
import { 
    getCloudflareZipUrl,
    downloadAnonymizedStudy,
    downloadSeries,
    getStudySeries,
    toggleStudyLock
} from '../controllers/download.controller.js';

const router = express.Router();

// ✅ Middleware: allow token via query param for direct browser downloads
const protectOrQuery = async (req, res, next) => {
    // If token in query string, inject into Authorization header
    if (req.query.token && !req.headers.authorization) {
        req.headers.authorization = `Bearer ${req.query.token}`;
    }
    return protect(req, res, next);
};

// Download routes
router.get('/cloudflare-zip/:studyId', protectOrQuery, getCloudflareZipUrl);
// ✅ NEW: Proxy download routes
router.get('/anonymized/:studyId',     protectOrQuery, downloadAnonymizedStudy);
router.get('/series/:studyId/:seriesId', protectOrQuery, downloadSeries);
// router.delete('/cleanup-anonymized/:anonymizedStudyId', protect, cleanupAnonymizedStudy); // ✅ NEW
router.get('/study-series/:studyId',   protectOrQuery, getStudySeries);

export default router;