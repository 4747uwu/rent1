import express from 'express';
import { 
    getStudyDetailedView, 
    updateStudyClinicalHistory,
    updateStudyPatientInfo,
    updateStudyDetails
} from '../controllers/dataExtraction.controller.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// ✅ STUDY DETAILED VIEW ROUTES
router.get('/study-detailed-view/:studyId', protect, getStudyDetailedView);
router.put('/study-clinical-history/:studyId', protect, updateStudyClinicalHistory);
router.put('/study-patient-info/:studyId', protect, updateStudyPatientInfo);
router.put('/study-details/:studyId', protect, updateStudyDetails);

export default router;