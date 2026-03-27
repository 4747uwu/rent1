import mongoose from 'mongoose';
import DicomStudy from '../models/dicomStudyModel.js';

export const revertStudyToRadiologist = async (req, res) => {
    try {
        const { studyId } = req.params;
        const {
            revertReason,
            verificationNotes = '',
        } = req.body;

        const user = req.user;

        // ✅ DEBUG: Log what roles the user actually has
        console.log('🔄 [Revert] User attempting revert:', {
            userId: user._id,
            fullName: user.fullName,
            role: user.role,
            accountRoles: user.accountRoles,
            roleConfig: user.roleConfig
        });

        // ✅ FIXED: Check BOTH user.role AND user.accountRoles
        const userRoles = [
            ...(Array.isArray(user.accountRoles) ? user.accountRoles : []),
            user.role  // ✅ Always include the primary role
        ].filter(Boolean);

        console.log('🔄 [Revert] Resolved userRoles:', userRoles);

        const canRevert = userRoles.some(r =>
            ['admin', 'assignor', 'super_admin', 'lab_staff'].includes(r)
        );
        //
        if (!canRevert) {
            console.warn(`⛔ [Revert] Access denied for user ${user.fullName} | roles: ${userRoles.join(', ')}`);
            return res.status(403).json({
                success: false,
                message: `Access denied: Only admin or assignor can revert a downloaded report. Your roles: ${userRoles.join(', ')}`
            });
        }

        if (!revertReason?.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Revert reason is required'
            });
        }

        if (!mongoose.Types.ObjectId.isValid(studyId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid study ID'
            });
        }

        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const study = await DicomStudy.findById(studyId).session(session);

            if (!study) {
                await session.abortTransaction();
                return res.status(404).json({ success: false, message: 'Study not found' });
            }

            // ✅ GUARD: Allow revert from both final_report_downloaded AND report_completed
            const revertableStatuses = ['final_report_downloaded', 'report_completed'];
            if (!revertableStatuses.includes(study.workflowStatus)) {
                await session.abortTransaction();
                return res.status(400).json({
                    success: false,
                    message: `Study cannot be reverted from status '${study.workflowStatus}'. Only completed or downloaded studies can be reverted.`
                });
            }

            // ✅ GUARD: Same org
            if (study.organizationIdentifier !== user.organizationIdentifier) {
                await session.abortTransaction();
                return res.status(403).json({
                    success: false,
                    message: 'Access denied: Study not in your organization'
                });
            }

            const now = new Date();

            const revertRecord = {
                revertedAt: now,
                revertedBy: user._id,
                revertedByName: user.fullName,
                revertedByRole: userRoles.join(', '),
                previousStatus: study.workflowStatus,
                reason: revertReason.trim(),
                notes: verificationNotes.trim(),
                resolved: false,
                revertType: 'admin_revert_after_download',
            };

            const updateData = {
                workflowStatus: 'report_rejected',
                currentCategory: 'REVERTED',
                reprintNeeded: true,

                'revertInfo.isReverted': true,
                'revertInfo.currentRevert': revertRecord,
                $inc: { 'revertInfo.revertCount': 1 },
                $push: {
                    'revertInfo.revertHistory': revertRecord,
                    statusHistory: {
                        status: 'report_rejected',
                        changedAt: now,
                        changedBy: user._id,
                        note: `Report reverted by admin ${user.fullName} after download — Reason: ${revertReason.trim()}`
                    }
                }
            };

            await DicomStudy.findByIdAndUpdate(studyId, updateData, { session, new: true });

            // ✅ Update report model
            const Report = mongoose.model('Report');
            const report = await Report.findOne({
                dicomStudy: studyId,
                reportStatus: { $in: ['verified', 'finalized'] }
            })
                .sort({ createdAt: -1 })
                .session(session);

            if (report) {
                if (!report.verificationInfo) report.verificationInfo = {};
                report.verificationInfo.rejectionReason = revertReason.trim();
                report.verificationInfo.verificationNotes = verificationNotes.trim();
                report.verificationInfo.verificationStatus = 'rejected';
                report.reportStatus = 'rejected';

                if (!report.verificationInfo.verificationHistory) {
                    report.verificationInfo.verificationHistory = [];
                }
                report.verificationInfo.verificationHistory.push({
                    action: 'reverted_to_radiologist', // ✅ FIXED: was 'admin_reverted_after_download'
                    performedBy: user._id,
                    performedAt: now,
                    notes: `Admin revert after download — ${revertReason.trim()}`
                });

                await report.save({ session });
                console.log(`✅ [Revert] Report model updated: ${report._id}`);
            } else {
                console.warn(`⚠️ [Revert] No verified/finalized report found for study: ${studyId} — trying any report`);

                // ✅ FALLBACK: Try finding any report for this study
                const anyReport = await Report.findOne({ dicomStudy: studyId })
                    .sort({ createdAt: -1 })
                    .session(session);

                if (anyReport) {
                    anyReport.reportStatus = 'rejected';
                    await anyReport.save({ session });
                    console.log(`✅ [Revert] Fallback report updated: ${anyReport._id} | was: ${anyReport.reportStatus}`);
                }
            }

            await session.commitTransaction();

            console.log(`✅ [Revert] Study ${studyId} reverted by ${user.fullName} | reprintNeeded=true`);

            return res.status(200).json({
                success: true,
                message: 'Study reverted to radiologist successfully',
                data: {
                    studyId,
                    workflowStatus: 'report_rejected',
                    currentCategory: 'REVERTED',
                    reprintNeeded: true,
                    revertedBy: user.fullName,
                    revertedAt: now,
                    reason: revertReason.trim(),
                    nextStep: 'Radiologist must re-finalize — will go to reprint path'
                }
            });

        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }

    } catch (error) {
        console.error('❌ [Revert] Error reverting study:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while reverting study',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};