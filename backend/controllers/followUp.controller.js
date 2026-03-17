import mongoose from 'mongoose';
import DicomStudy from '../models/dicomStudyModel.js';

// ✅ Mark study as follow-up
export const markStudyFollowUp = async (req, res) => {
    try {
        const { studyId } = req.params;
        const { reason, followUpDate } = req.body;
        const currentUser = req.user;

        if (!studyId || !mongoose.Types.ObjectId.isValid(studyId)) {
            return res.status(400).json({ success: false, message: 'Valid study ID is required' });
        }

        const study = await DicomStudy.findById(studyId);
        if (!study) {
            return res.status(404).json({ success: false, message: 'Study not found' });
        }

        if (study.organizationIdentifier !== currentUser.organizationIdentifier) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        // ✅ Check study has been completed (final_report_downloaded in statusHistory)
        const hasBeenCompleted = study.statusHistory?.some(
            s => s.status === 'final_report_downloaded' || s.status === 'report_completed'
        );

        if (!hasBeenCompleted) {
            return res.status(400).json({
                success: false,
                message: 'Follow-up can only be marked for completed studies'
            });
        }

        // ✅ Update follow-up info
        study.followUp = {
            isFollowUp: true,
            markedAt: new Date(),
            markedBy: currentUser._id,
            markedByName: currentUser.fullName,
            reason: reason || '',
            followUpDate: followUpDate ? new Date(followUpDate) : null,
            history: [
                ...(study.followUp?.history || []),
                {
                    action: 'marked',
                    performedBy: currentUser._id,
                    performedByName: currentUser.fullName,
                    performedAt: new Date(),
                    reason: reason || ''
                }
            ]
        };

        // ✅ Add to status history
        study.statusHistory.push({
            status: 'follow_up_marked',
            changedAt: new Date(),
            changedBy: currentUser._id,
            note: `Follow-up marked by ${currentUser.fullName}${reason ? `: ${reason}` : ''}`
        });

     

        await study.save();

        console.log(`✅ [FollowUp] Study ${study.bharatPacsId} marked as follow-up by ${currentUser.fullName}`);

        res.status(200).json({
            success: true,
            message: 'Study marked as follow-up successfully',
            data: {
                studyId: study._id,
                bharatPacsId: study.bharatPacsId,
                followUp: study.followUp
            }
        });

    } catch (error) {
        console.error('❌ [FollowUp] Error marking follow-up:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while marking follow-up',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ✅ Resolve follow-up
export const resolveStudyFollowUp = async (req, res) => {
    try {
        const { studyId } = req.params;
        const { notes } = req.body;
        const currentUser = req.user;

        if (!studyId || !mongoose.Types.ObjectId.isValid(studyId)) {
            return res.status(400).json({ success: false, message: 'Valid study ID is required' });
        }

        const study = await DicomStudy.findById(studyId);
        if (!study) return res.status(404).json({ success: false, message: 'Study not found' });

        if (!study.followUp?.isFollowUp) {
            return res.status(400).json({ success: false, message: 'Study is not marked as follow-up' });
        }

        study.followUp.isFollowUp = false;
        study.followUp.resolvedAt = new Date();
        study.followUp.resolvedBy = currentUser._id;
        study.followUp.history.push({
            action: 'resolved',
            performedBy: currentUser._id,
            performedByName: currentUser.fullName,
            performedAt: new Date(),
            reason: notes || ''
        });

        study.statusHistory.push({
            status: 'follow_up_resolved',
            changedAt: new Date(),
            changedBy: currentUser._id,
            note: `Follow-up resolved by ${currentUser.fullName}${notes ? `: ${notes}` : ''}`
        });

        await study.save();

        res.status(200).json({
            success: true,
            message: 'Follow-up resolved successfully',
            data: { studyId: study._id, followUp: study.followUp }
        });

    } catch (error) {
        console.error('❌ [FollowUp] Error resolving follow-up:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

export default { markStudyFollowUp, resolveStudyFollowUp };