import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
    createShareLink,
    accessSharedStudy,
    revokeShareLink,
    getStudyShares,
} from '../controllers/studyShare.controller.js';

const router = express.Router();

// ── PROTECTED (requires login) ─────────────────────────────────────────────
router.post('/studies/:studyId/share',           protect, createShareLink);
router.get('/studies/:studyId/shares',           protect, getStudyShares);
router.delete('/shares/:shareId/revoke',         protect, revokeShareLink);

// ── PUBLIC (no auth — token is the credential) ─────────────────────────────
router.post('/share/access/:token',  accessSharedStudy);  // POST for password support
router.get('/share/access/:token',   accessSharedStudy);  // GET for password-less links

export default router;