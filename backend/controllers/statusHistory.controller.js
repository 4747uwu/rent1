import mongoose from 'mongoose';
import DicomStudy from '../models/dicomStudyModel.js';

export const getStudyStatusHistory = async (req, res) => {
    try {
        const { studyId } = req.params;
        const organizationId = req.user?.organization;

        if (!mongoose.Types.ObjectId.isValid(studyId)) {
            return res.status(400).json({ success: false, message: 'Invalid study ID' });
        }

        const study = await DicomStudy.findOne({
            _id: studyId,
            organization: organizationId
        })
        .select('statusHistory reportInfo organizationName')
        .populate({
            path: 'statusHistory.changedBy',
            select: 'fullName username role'
        })
        .lean();

        if (!study) {
            return res.status(404).json({ success: false, message: 'Study not found' });
        }

        // ✅ Send ALL raw entries — frontend will group
        const timeline = (study.statusHistory || []).map(item => ({
            _id: item._id,
            status: item.status,
            changedAt: item.changedAt,
            changedByName: item.changedBy?.fullName || 'System',
            changedByUsername: item.changedBy?.username || '',
            changedByRole: item.changedBy?.role || '',
            note: item.note || ''
        }));

        // Sort newest first
        timeline.sort((a, b) => new Date(b.changedAt) - new Date(a.changedAt));

        res.status(200).json({
            success: true,
            timeline,
            reportInfo: study.reportInfo,
            organizationName: study.organizationName,
            totalOccurrences: timeline.length
        });

    } catch (error) {
        console.error('❌ Error fetching status history:', error);
        res.status(500).json({ success: false, message: 'Error fetching status history', error: error.message });
    }
};