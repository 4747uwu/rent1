import express from 'express';
import verifierController from '../controllers/verifier.controller.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(protect);

// ✅ ANALYTICS & VALUES
router.get('/values', verifierController.getValues);

// ✅ STUDY ENDPOINTS
router.get('/studies', verifierController.getAllStudiesForVerifier);
router.get('/studies/inprogress', verifierController.getInProgressStudies);
router.get('/studies/verified', verifierController.getVerifiedStudies);
router.get('/studies/rejected', verifierController.getRejectedStudies);
router.get('/studies/pending', verifierController.getPendingStudies);

// ✅ NEW: Report verification endpoint
router.get('/studies/:studyId/report', verifierController.getReportForVerification);

// ✅ VERIFICATION ACTIONS
router.post('/studies/:studyId/start-verification', verifierController.startVerification);
router.post('/studies/:studyId/verify', verifierController.verifyReport);

// ✅ NEW: Add verifier update route
router.post('/studies/:studyId/update-report',  verifierController.updateReportDuringVerification);

// ✅ RADIOLOGIST MANAGEMENT
router.get('/radiologists', verifierController.getAssignedRadiologists);

export default router;
