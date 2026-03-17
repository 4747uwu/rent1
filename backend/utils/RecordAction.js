import DicomStudy, { ACTION_TYPES } from '../models/dicomStudyModel.js';

/**
 * Record an action in the study's action log
 * @param {Object} params - Action parameters
 * @returns {Promise<Object>} Updated study document
 */
export const recordStudyAction = async ({
    studyId,
    actionType,
    actionCategory,
    performedBy,
    performedByName,
    performedByRole = 'system',
    targetUser = null,
    targetUserName = null,
    targetUserRole = null,
    actionDetails = {},
    printInfo = null,
    historyInfo = null,
    assignmentInfo = null,
    notes = '',
    ipAddress = null,
    userAgent = null,
    sessionId = null
}) => {
    try {
        const actionEntry = {
            actionType,
            actionCategory,
            performedBy,
            performedByName,
            performedByRole,
            performedAt: new Date(),
            targetUser,
            targetUserName,
            targetUserRole,
            actionDetails,
            printInfo,
            historyInfo,
            assignmentInfo,
            notes,
            ipAddress,
            userAgent,
            sessionId
        };

        const study = await DicomStudy.findByIdAndUpdate(
            studyId,
            {
                $push: { actionLog: actionEntry }
            },
            { new: true, runValidators: true }
        );

        if (!study) {
            throw new Error(`Study not found: ${studyId}`);
        }

        console.log(`✅ Action recorded: ${actionType} by ${performedByName} on study ${study.bharatPacsId || studyId}`);
        return study;

    } catch (error) {
        console.error(`❌ Error recording action:`, error);
        throw error;
    }
};

/**
 * Lock a study
 */
export const lockStudy = async ({
    studyId,
    lockedBy,
    lockedByName,
    lockedByRole,
    lockReason = 'reporting',
    lockDurationMinutes = 120, // Default 2 hours
    performedBy,
    performedByName,
    performedByRole
}) => {
    try {
        const lockExpiry = new Date(Date.now() + lockDurationMinutes * 60 * 1000);

        const study = await DicomStudy.findById(studyId);
        
        if (!study) {
            throw new Error(`Study not found: ${studyId}`);
        }

        // Check if already locked
        if (study.studyLock?.isLocked && study.studyLock.lockedBy.toString() !== lockedBy.toString()) {
            throw new Error(`Study is already locked by ${study.studyLock.lockedByName}`);
        }

        study.studyLock = {
            isLocked: true,
            lockedBy,
            lockedByName,
            lockedByRole,
            lockedAt: new Date(),
            lockReason,
            lockExpiry,
            previousLocks: study.studyLock?.previousLocks || []
        };

        // Record action
        study.actionLog.push({
            actionType: ACTION_TYPES.STUDY_LOCKED,
            actionCategory: 'lock',
            performedBy,
            performedByName,
            performedByRole,
            performedAt: new Date(),
            actionDetails: {
                lockReason,
                lockDurationMinutes,
                lockExpiry
            },
            notes: `Study locked for ${lockReason} until ${lockExpiry.toLocaleString()}`
        });

        await study.save();

        console.log(`🔒 Study locked: ${study.bharatPacsId || studyId} by ${lockedByName}`);
        return study;

    } catch (error) {
        console.error(`❌ Error locking study:`, error);
        throw error;
    }
};

/**
 * Unlock a study
 */
export const unlockStudy = async ({
    studyId,
    unlockedBy,
    unlockedByName,
    unlockedByRole,
    performedBy,
    performedByName,
    performedByRole
}) => {
    try {
        const study = await DicomStudy.findById(studyId);
        
        if (!study) {
            throw new Error(`Study not found: ${studyId}`);
        }

        if (!study.studyLock?.isLocked) {
            throw new Error(`Study is not locked`);
        }

        // Store lock history
        const lockDuration = Math.round((new Date() - study.studyLock.lockedAt) / 60000); // in minutes
        
        if (!study.studyLock.previousLocks) {
            study.studyLock.previousLocks = [];
        }

        study.studyLock.previousLocks.push({
            lockedBy: study.studyLock.lockedBy,
            lockedByName: study.studyLock.lockedByName,
            lockedAt: study.studyLock.lockedAt,
            unlockedAt: new Date(),
            lockDuration,
            lockReason: study.studyLock.lockReason
        });

        study.studyLock.isLocked = false;
        study.studyLock.lockedBy = null;
        study.studyLock.lockedByName = null;
        study.studyLock.lockedByRole = null;
        study.studyLock.lockedAt = null;
        study.studyLock.lockReason = null;
        study.studyLock.lockExpiry = null;

        // Record action
        study.actionLog.push({
            actionType: ACTION_TYPES.STUDY_UNLOCKED,
            actionCategory: 'lock',
            performedBy: unlockedBy,
            performedByName: unlockedByName,
            performedByRole: unlockedByRole,
            performedAt: new Date(),
            actionDetails: {
                lockDuration
            },
            notes: `Study unlocked after ${lockDuration} minutes`
        });

        await study.save();

        console.log(`🔓 Study unlocked: ${study.bharatPacsId || studyId} by ${unlockedByName}`);
        return study;

    } catch (error) {
        console.error(`❌ Error unlocking study:`, error);
        throw error;
    }
};

/**
 * Record print action
 */
export const recordPrintAction = async ({
    studyId,
    printedBy,
    printedByName,
    printedByRole,
    printType = 'original',
    printMethod = 'pdf_download',
    reportVersion = 1,
    reportStatus = 'finalized',
    copies = 1,
    printerName = null,
    recipientEmail = null,
    faxNumber = null,
    printReason = '',
    reprintReason = null,
    watermark = 'ORIGINAL',
    ipAddress = null,
    userAgent = null
}) => {
    try {
        const study = await DicomStudy.findById(studyId);
        
        if (!study) {
            throw new Error(`Study not found: ${studyId}`);
        }

        const printEntry = {
            printedAt: new Date(),
            printedBy,
            printedByName,
            printType,
            printMethod,
            reportVersion,
            reportStatus,
            copies,
            printerName,
            recipientEmail,
            faxNumber,
            printReason,
            reprintReason,
            bharatPacsId: study.bharatPacsId,
            watermark,
            ipAddress,
            userAgent
        };

        study.printHistory.push(printEntry);

        // Record action
        const actionType = printType === 'reprint' ? ACTION_TYPES.REPORT_REPRINTED : ACTION_TYPES.REPORT_PRINTED;
        
        study.actionLog.push({
            actionType,
            actionCategory: 'print',
            performedBy: printedBy,
            performedByName: printedByName,
            performedByRole: printedByRole,
            performedAt: new Date(),
            printInfo: {
                printCount: study.printHistory.length,
                isPrintOriginal: printType === 'original',
                printMethod,
                printerName,
                copies
            },
            notes: reprintReason || printReason || `Report ${printType} printed`,
            ipAddress,
            userAgent
        });

        // Update reprint tracking if applicable
        if (printType === 'reprint' && study.categoryTracking?.reprint) {
            study.categoryTracking.reprint.reprintCount = (study.categoryTracking.reprint.reprintCount || 0) + 1;
            study.categoryTracking.reprint.reprintHistory.push({
                reprintedAt: new Date(),
                reprintedBy: printedBy,
                reason: reprintReason,
                changes: ''
            });
        }

        await study.save();

        console.log(`🖨️ Print recorded: ${study.bharatPacsId || studyId} - ${printType} by ${printedByName}`);
        return study;

    } catch (error) {
        console.error(`❌ Error recording print action:`, error);
        throw error;
    }
};

/**
 * Update category tracking
 */
export const updateCategoryTracking = async ({
    studyId,
    category,
    trackingData,
    performedBy,
    performedByName,
    performedByRole
}) => {
    try {
        const updatePath = `categoryTracking.${category}`;
        
        const study = await DicomStudy.findByIdAndUpdate(
            studyId,
            {
                $set: { [updatePath]: trackingData }
            },
            { new: true, runValidators: true }
        );

        if (!study) {
            throw new Error(`Study not found: ${studyId}`);
        }

        console.log(`✅ Category tracking updated: ${category} for study ${study.bharatPacsId || studyId}`);
        return study;

    } catch (error) {
        console.error(`❌ Error updating category tracking:`, error);
        throw error;
    }
};

// ✅ Re-export ACTION_TYPES
export { ACTION_TYPES };

export default {
    recordStudyAction,
    lockStudy,
    unlockStudy,
    recordPrintAction,
    updateCategoryTracking,
    ACTION_TYPES
};