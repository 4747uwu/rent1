import express from 'express';
import { markStudyFollowUp, resolveStudyFollowUp } from '../controllers/followUp.controller.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/studies/:studyId/follow-up', protect, markStudyFollowUp);
router.delete('/studies/:studyId/follow-up', protect, resolveStudyFollowUp);

export default router;