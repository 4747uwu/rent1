import express from 'express';
import {
    getUnassignedStudies,
    getAvailableAssignees,
    assignStudy,
    bulkAssignStudies,
    getAssignedStudies,
    bulkMultiStudyAssign,
    reassignStudy,
    getAssignmentAnalytics,
    updateStudyAssignments
} from '../controllers/assigner.controller.js';

// ✅ IMPORT ADMIN CONTROLLER FOR DATA FETCHING
import {
    getPendingStudies,
    getInProgressStudies,
    getCompletedStudies,
    getAllStudiesForAdmin
} from '../controllers/admin.controller.js';

import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// ✅ REUSE ADMIN ENDPOINTS FOR DATA FETCHING
router.get('/studies/pending', protect, getPendingStudies);
router.get('/studies/inprogress', protect, getInProgressStudies);
router.get('/studies/completed', protect, getCompletedStudies);
router.get('/studies', protect, getAllStudiesForAdmin);

// ✅ ASSIGNMENT-SPECIFIC ENDPOINTS
router.get('/studies/unassigned', protect, getUnassignedStudies);
router.get('/studies/assigned', protect, getAssignedStudies);
router.get('/available-assignees', protect, getAvailableAssignees);
router.post('/assign-study/:studyId', protect, assignStudy);
router.post('/bulk-assign', protect, bulkAssignStudies);
router.put('/reassign-study/:studyId', protect, reassignStudy);
router.get('/analytics', protect, getAssignmentAnalytics);
router.post('/update-study-assignments/:studyId', protect, updateStudyAssignments);

router.post('/bulk-multi-assign', protect, bulkMultiStudyAssign);

// ✅ UNASSIGN STUDY ENDPOINT
router.post('/unassign-study/:studyId', protect, async (req, res) => {
    try {
        const { studyId } = req.params;
        const { reason } = req.body;

        // Only assignor can unassign studies
        if (req.user.role !== 'assignor') {
            return res.status(403).json({
                success: false,
                message: 'Only assignor can unassign studies'
            });
        }

        const DicomStudy = (await import('../models/dicomStudyModel.js')).default;
        const User = (await import('../models/userModel.js')).default;

        const study = await DicomStudy.findOne({
            _id: studyId,
            organizationIdentifier: req.user.organizationIdentifier
        });

        if (!study) {
            return res.status(404).json({
                success: false,
                message: 'Study not found'
            });
        }

        // Find current active assignment
        const currentAssignment = study.assignment?.find(assign => 
            assign.status === 'assigned' || assign.status === 'in_progress'
        );

        if (!currentAssignment) {
            return res.status(400).json({
                success: false,
                message: 'No active assignment found'
            });
        }

        // Mark assignment as unassigned
        currentAssignment.status = 'unassigned';
        currentAssignment.unassignedAt = new Date();
        currentAssignment.unassignedBy = req.user._id;
        currentAssignment.unassignReason = reason || 'Unassigned by assignor';

        // Update study status
        study.status = 'unassigned';
        await study.save();

        console.log(`🔄 Study ${studyId} unassigned by assignor ${req.user.email}`);

        res.json({
            success: true,
            message: 'Study unassigned successfully',
            data: study
        });

    } catch (error) {
        console.error('❌ Unassign study error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to unassign study'
        });
    }
});

export default router;