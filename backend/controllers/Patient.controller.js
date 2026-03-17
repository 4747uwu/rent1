import mongoose from 'mongoose';
import DicomStudy from '../models/dicomStudyModel.js';
import User from '../models/userModel.js';
import { ACTION_TYPES } from '../models/dicomStudyModel.js';

import { formatStudiesForWorklist } from '../utils/formatStudies.js';



export const updateStudyDetails = async (req, res) => {
    try {
        const { studyId } = req.params;
        const {
            patientName,
            patientAge,
            patientGender,
            studyName,
            referringPhysician,
            accessionNumber,
            clinicalHistory,
            priority
        } = req.body;

        const user = req.user;
        if (!user) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }

        console.log(`📝 Updating study details for ${studyId}:`, {
            patientName,
            patientAge,
            patientGender,
            studyName,
            referringPhysician,
            clinicalHistory: clinicalHistory?.substring(0, 50) + '...',
            priority
        });

        // Find study
        const study = await DicomStudy.findOne({
            _id: studyId,
            organizationIdentifier: user.organizationIdentifier
        });

        if (!study) {
            return res.status(404).json({ success: false, message: 'Study not found' });
        }

        // ✅ CHECK IF STUDY IS LOCKED
        if (study.studyLock?.isLocked) {
            return res.status(423).json({
                success: false,
                message: `Study is locked by ${study.studyLock.lockedByName}. Cannot edit while locked.`,
                lockedBy: study.studyLock.lockedByName,
                lockedAt: study.studyLock.lockedAt
            });
        }

        // Build update object
        const updateData = {};
        const changes = {};

        if (patientName) {
            updateData['patientInfo.patientName'] = patientName;
            changes.patientName = patientName;
        }
        
        if (patientAge) {
            updateData.age = patientAge;
            updateData['patientInfo.age'] = patientAge;
            changes.patientAge = patientAge;
        }
        
        if (patientGender) {
            updateData.gender = patientGender;
            updateData['patientInfo.gender'] = patientGender;
            changes.patientGender = patientGender;
        }
        
        if (studyName) {
            updateData.examDescription = studyName;
            changes.studyName = studyName;
        }
        
        if (referringPhysician) {
            updateData.referringPhysicianName = referringPhysician;
            updateData['physicians.referring.name'] = referringPhysician;
            changes.referringPhysician = referringPhysician;
        }
        
        if (accessionNumber) {
            updateData.accessionNumber = accessionNumber;
            changes.accessionNumber = accessionNumber;
        }

        // ✅ Handle priority update — NO workflow status change
        if (priority !== undefined) {
            const validPriorities = ['NORMAL', 'EMERGENCY', 'PRIORITY', 'MLC', 'STAT'];
            const newPriority = (priority || '').toUpperCase().trim();
            if (validPriorities.includes(newPriority)) {
                updateData.priority = newPriority;
                changes.priority = { from: study.priority, to: newPriority };
                console.log(`✅ priority updated: ${study.priority} → ${newPriority}`);
            }
        }
        
        // ✅ Only touch workflow if clinical history string actually changed
        if (clinicalHistory !== undefined) {
            const DEFAULT_PLACEHOLDERS = ['no history provided', 'no history provided...', ''];
            const existingHistory = study.clinicalHistory?.clinicalHistory || '';
            const incomingHistory = clinicalHistory || '';
            const existingNormalized = existingHistory.trim().toLowerCase();
            const incomingNormalized = incomingHistory.trim().toLowerCase();

            // Treat both being "empty/placeholder" as no change
            const bothAreEmpty = DEFAULT_PLACEHOLDERS.includes(existingNormalized) && DEFAULT_PLACEHOLDERS.includes(incomingNormalized);
            const isHistoryChanging = !bothAreEmpty && existingNormalized !== incomingNormalized;

            updateData['clinicalHistory.clinicalHistory'] = incomingHistory;
            updateData['clinicalHistory.lastModifiedBy'] = user._id;
            updateData['clinicalHistory.lastModifiedAt'] = new Date();
            updateData['clinicalHistory.lastModifiedFrom'] = 'admin_panel';

            if (isHistoryChanging) {
                console.log(`📝 Clinical history is being updated - changing workflow to history_created`);
                updateData.currentCategory = 'HISTORY_CREATED';
                updateData.workflowStatus = 'history_created';
                updateData['categoryTracking.historyCreated.lastUpdatedAt'] = new Date();
                updateData['categoryTracking.historyCreated.lastUpdatedBy'] = user._id;
                updateData['categoryTracking.historyCreated.isComplete'] = true;
                changes.clinicalHistoryUpdated = true;
            }
        }

        // ✅ Build descriptive note for priority changes
        const priorityChanges = [];
        if (changes.priority) priorityChanges.push(`Priority: ${changes.priority.from || 'NORMAL'} → ${changes.priority.to}`);

        const actionNote = priorityChanges.length > 0 
            ? `Study details updated via patient edit modal. Priority changes: ${priorityChanges.join(', ')}`
            : 'Study details updated via patient edit modal';

        // Update study
        const updatedStudy = await DicomStudy.findByIdAndUpdate(
            studyId,
            {
                $set: updateData,
                $push: {
                    statusHistory: {
                        status: changes.clinicalHistoryUpdated ? 'history_created' : 'study_details_updated',
                        changedAt: new Date(),
                        changedBy: user._id,
                        note: `Study details updated by ${user.fullName || user.email}${priorityChanges.length > 0 ? ` (${priorityChanges.join(', ')})` : ''}${changes.clinicalHistoryUpdated ? ' - Clinical history updated' : ''}`
                    },
                    actionLog: {
                        actionType: changes.clinicalHistoryUpdated
                            ? ACTION_TYPES.HISTORY_CREATED
                            : changes.priority
                                ? ACTION_TYPES.PRIORITY_CHANGED
                                : ACTION_TYPES.STATUS_CHANGED,
                        actionCategory: 'administrative',
                        performedBy: user._id,
                        performedByName: user.fullName || user.email,
                        performedByRole: user.role,
                        performedAt: new Date(),
                        actionDetails: {
                            changes: changes
                        },
                        notes: actionNote
                    }
                }
            },
            { new: true, runValidators: true }
        )
        .populate('organization', 'name identifier')
        .populate('patient', 'patientID patientNameRaw')
        .populate('sourceLab', 'name identifier');

        console.log(`✅ Study details updated successfully for ${studyId}`);
        if (priorityChanges.length > 0) {
            console.log(`📊 Priority updates: ${priorityChanges.join(', ')}`);
        }
        if (changes.clinicalHistoryUpdated) {
            console.log(`📝 Clinical history updated - workflow changed to history_created`);
        }

        res.json({
            success: true,
            message: 'Study details updated successfully',
            data: updatedStudy
        });

    } catch (error) {
        console.error('❌ Error updating study details:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update study details',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ✅ GET STUDY ACTION LOGS FOR TIMELINE
export const getStudyActionLogs = async (req, res) => {
    try {
        const { studyId } = req.params;
        const user = req.user;

        if (!user) {
            return res.status(401).json({ 
                success: false, 
                message: 'User not authenticated' 
            });
        }

        console.log(`📊 Fetching action logs for study ${studyId} by ${user.email}`);

        // Find study with action logs and populate organization/lab
        const study = await DicomStudy.findOne({
            _id: studyId,
            organizationIdentifier: user.organizationIdentifier
        })
        .select('_id bharatPacsId patientInfo patientId modality studyDate studyTime createdAt workflowStatus currentCategory actionLog seriesCount instanceCount organization sourceLab')
        .populate('organization', 'name identifier')
        .populate('sourceLab', 'name identifier')
        .lean();

        if (!study) {
            return res.status(404).json({
                success: false,
                message: 'Study not found'
            });
        }
        console.log(study.actionLog)

        // ✅ ADD FORMATTED FIELDS
        study.patientName = study.patientInfo?.patientName || 'Unknown Patient';
        study.centerName = study.sourceLab?.name || '-';
        study.organizationName = study.organization?.name || '-';
        study.uploadedByName = 'System'; // Default

        // Sort action logs by performedAt descending (most recent first)
        if (study.actionLog && Array.isArray(study.actionLog)) {
            study.actionLog.sort((a, b) => {
                const timeA = a.performedAt ? new Date(a.performedAt).getTime() : 0;
                const timeB = b.performedAt ? new Date(b.performedAt).getTime() : 0;
                return timeB - timeA;
            });
        }

        console.log(`✅ Found ${study.actionLog?.length || 0} action logs for study ${studyId}`);

        res.json({
            success: true,
            message: 'Action logs fetched successfully',
            data: study
        });

    } catch (error) {
        console.error('❌ Error fetching study action logs:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch action logs',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ✅ LOCK STUDY FOR REPORTING
export const lockStudyForReporting = async (req, res) => {
    try {
        const { studyId } = req.params;
        const user = req.user;

        if (!user) {
            return res.status(401).json({ 
                success: false, 
                message: 'User not authenticated' 
            });
        }

        console.log(`🔒 Attempting to lock study ${studyId} for user ${user.email} (role: ${user.role})`);

        // Find the study
        const study = await DicomStudy.findOne({
            _id: studyId,
            organizationIdentifier: user.organizationIdentifier
        });

        if (!study) {
            return res.status(404).json({
                success: false,
                message: 'Study not found'
            });
        }

        // ✅ CHECK IF USER CAN BYPASS LOCKS (admins skip assignment check too)
        const canBypassLock = ['admin', 'super_admin'].includes(user.role) ||
                             user.accountRoles?.some(role => ['admin', 'super_admin'].includes(role));

        const isRadiologist = user.role === 'radiologist' || 
                              user.accountRoles?.includes('radiologist');

        const isVerifier = user.role === 'verifier' || 
                           user.accountRoles?.includes('verifier');

        const isTypist = user.role === 'typist' || 
                         user.accountRoles?.includes('typist');

        // ✅ CHECK ASSIGNMENT - radiologists and verifiers must be assigned
        if (!canBypassLock && (isRadiologist || isVerifier || isTypist)) {
            // ✅ FIX: Check the correct assignment array field
            const isAssignedToUser = study.assignment?.some(
                a => a.assignedTo?.toString() === user._id.toString()
            );

            if (!isAssignedToUser) {
                console.log(`❌ Study ${studyId} not assigned to user ${user.email}`);
                console.log(`   assignment array:`, study.assignment?.map(a => a.assignedTo?.toString()));
                return res.status(403).json({
                    success: false,
                    message: 'You cannot open this study. It is not assigned to you.',
                    notAssigned: true
                });
            }

            console.log(`✅ Assignment verified for user ${user.email}`);
        }

        // ✅ CHECK IF ALREADY LOCKED
        if (study.studyLock?.isLocked) {
            // Check if locked by current user
            if (study.studyLock.lockedBy?.toString() === user._id.toString()) {
                console.log(`✅ Study already locked by current user ${user.email}`);
                return res.json({
                    success: true,
                    message: 'Study already locked by you',
                    alreadyLocked: true,
                    data: {
                        studyId: study._id,
                        bharatPacsId: study.bharatPacsId,
                        isLocked: true,
                        lockedBy: user._id,
                        lockedByName: user.fullName || user.email,
                        lockedAt: study.studyLock.lockedAt,
                        lockReason: study.studyLock.lockReason
                    }
                });
            } 
            
            // ✅ ALLOW BYPASS FOR RADIOLOGIST, TYPIST, ADMIN
            if (canBypassLock) {
                console.log(`⚠️ Study locked by ${study.studyLock.lockedByName}, but ${user.role} can bypass`);
                
                // Lock for current user (takeover)
                const lockExpiry = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours

                const updatedStudy = await DicomStudy.findByIdAndUpdate(
                    studyId,
                    {
                        $set: {
                            'studyLock.isLocked': true,
                            'studyLock.lockedBy': user._id,
                            'studyLock.lockedByName': user.fullName || user.email,
                            'studyLock.lockedByRole': user.role,
                            'studyLock.lockedAt': new Date(),
                            'studyLock.lockReason': 'reporting',
                            'studyLock.lockExpiry': lockExpiry,
                            
                            workflowStatus: user.role === 'radiologist' ? 'doctor_opened_report' : 'report_in_progress',
                            currentCategory: 'PENDING'
                        },
                        $push: {
                            actionLog: {
                                actionType: ACTION_TYPES.STUDY_LOCKED,
                                actionCategory: 'lock',
                                performedBy: user._id,
                                performedByName: user.fullName || user.email,
                                performedByRole: user.role,
                                performedAt: new Date(),
                                actionDetails: {
                                    metadata: {
                                        lockReason: 'reporting',
                                        lockExpiry: lockExpiry,
                                        sessionStart: new Date(),
                                        bypassedPreviousLock: true,
                                        previousLockedBy: study.studyLock.lockedByName
                                    }
                                },
                                notes: `Study lock bypassed by ${user.fullName || user.email} (${user.role}) - previously locked by ${study.studyLock.lockedByName}`,
                                ipAddress: req.ip,
                                userAgent: req.get('user-agent')
                            },
                            statusHistory: {
                                status: 'study_lock_bypassed',
                                changedAt: new Date(),
                                changedBy: user._id,
                                note: `Lock bypassed by ${user.fullName || user.email} (${user.role})`
                            }
                        }
                    },
                    { new: true, runValidators: true }
                )
                .select('_id bharatPacsId studyLock workflowStatus currentCategory patientInfo')
                .lean();

                console.log(`✅ Study ${studyId} lock bypassed and re-locked by ${user.email}`);

                return res.json({
                    success: true,
                    message: 'Study lock bypassed - locked for you',
                    bypassed: true,
                    previousLockedBy: study.studyLock.lockedByName,
                    data: {
                        studyId: updatedStudy._id,
                        bharatPacsId: updatedStudy.bharatPacsId,
                        isLocked: true,
                        lockedBy: user._id,
                        lockedByName: user.fullName || user.email,
                        lockedAt: new Date(),
                        lockExpiry: lockExpiry,
                        lockReason: 'reporting',
                        workflowStatus: updatedStudy.workflowStatus,
                        currentCategory: updatedStudy.currentCategory
                    }
                });
            } else {
                // Regular user - cannot bypass
                console.log(`❌ Study locked by ${study.studyLock.lockedByName} - no bypass permission`);
                return res.status(423).json({
                    success: false,
                    message: `Study is currently locked by ${study.studyLock.lockedByName}`,
                    locked: true,
                    lockedBy: study.studyLock.lockedByName,
                    lockedAt: study.studyLock.lockedAt
                });
            }
        }

        // ✅ LOCK THE STUDY (not previously locked)
        const lockExpiry = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours

        const updatedStudy = await DicomStudy.findByIdAndUpdate(
            studyId,
            {
                $set: {
                    'studyLock.isLocked': true,
                    'studyLock.lockedBy': user._id,
                    'studyLock.lockedByName': user.fullName || user.email,
                    'studyLock.lockedByRole': user.role,
                    'studyLock.lockedAt': new Date(),
                    'studyLock.lockReason': 'reporting',
                    'studyLock.lockExpiry': lockExpiry,
                    
                    // ✅ UPDATE WORKFLOW STATUS
                    workflowStatus: user.role === 'radiologist' ? 'doctor_opened_report' : 'report_in_progress',
                    currentCategory: 'PENDING'
                },
                $push: {
                    // ✅ ADD TO ACTION LOG
                    actionLog: {
                        actionType: ACTION_TYPES.STUDY_LOCKED,
                        actionCategory: 'lock',
                        performedBy: user._id,
                        performedByName: user.fullName || user.email,
                        performedByRole: user.role,
                        performedAt: new Date(),
                        actionDetails: {
                            metadata: {
                                lockReason: 'reporting',
                                lockExpiry: lockExpiry,
                                sessionStart: new Date()
                            }
                        },
                        notes: `Study locked for reporting by ${user.fullName || user.email}`,
                        ipAddress: req.ip,
                        userAgent: req.get('user-agent')
                    },
                    
                    // ✅ ADD TO STATUS HISTORY
                    statusHistory: {
                        status: 'study_locked_for_reporting',
                        changedAt: new Date(),
                        changedBy: user._id,
                        note: `Locked for reporting by ${user.fullName || user.email}`
                    }
                }
            },
            { new: true, runValidators: true }
        )
        .select('_id bharatPacsId studyLock workflowStatus currentCategory patientInfo')
        .lean();

        console.log(`✅ Study ${studyId} locked successfully by ${user.email}`);

        res.json({
            success: true,
            message: 'Study locked successfully for reporting',
            data: {
                studyId: updatedStudy._id,
                bharatPacsId: updatedStudy.bharatPacsId,
                isLocked: true,
                lockedBy: user._id,
                lockedByName: user.fullName || user.email,
                lockedAt: new Date(),
                lockExpiry: lockExpiry,
                lockReason: 'reporting',
                workflowStatus: updatedStudy.workflowStatus,
                currentCategory: updatedStudy.currentCategory
            }
        });

    } catch (error) {
        console.error('❌ Error locking study:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to lock study',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ✅ UNLOCK STUDY (when user leaves reporting or session ends)
export const unlockStudy = async (req, res) => {
    try {
        const { studyId } = req.params;
        const user = req.user;

        if (!user) {
            return res.status(401).json({ 
                success: false, 
                message: 'User not authenticated' 
            });
        }

        console.log(`🔓 Attempting to unlock study ${studyId} by user ${user.email}`);

        const study = await DicomStudy.findOne({
            _id: studyId,
            organizationIdentifier: user.organizationIdentifier
        });

        if (!study) {
            return res.status(404).json({
                success: false,
                message: 'Study not found'
            });
        }

        // ✅ CHECK IF STUDY IS LOCKED BY CURRENT USER
        if (!study.studyLock?.isLocked) {
            return res.json({
                success: true,
                message: 'Study is not locked',
                alreadyUnlocked: true
            });
        }

        if (study.studyLock.lockedBy?.toString() !== user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: `Cannot unlock study locked by ${study.studyLock.lockedByName}`
            });
        }

        // ✅ CALCULATE LOCK DURATION
        const lockDuration = Math.floor(
            (new Date() - new Date(study.studyLock.lockedAt)) / 1000 / 60
        ); // in minutes

        // ✅ UNLOCK THE STUDY
        const updatedStudy = await DicomStudy.findByIdAndUpdate(
            studyId,
            {
                $set: {
                    'studyLock.isLocked': false
                },
                $push: {
                    // ✅ ARCHIVE LOCK INFO
                    'studyLock.previousLocks': {
                        lockedBy: user._id,
                        lockedByName: user.fullName || user.email,
                        lockedAt: study.studyLock.lockedAt,
                        unlockedAt: new Date(),
                        lockDuration: lockDuration,
                        lockReason: study.studyLock.lockReason
                    },
                    
                    // ✅ ADD TO ACTION LOG
                    actionLog: {
                        actionType: ACTION_TYPES.STUDY_UNLOCKED,
                        actionCategory: 'lock',
                        performedBy: user._id,
                        performedByName: user.fullName || user.email,
                        performedByRole: user.role,
                        performedAt: new Date(),
                        actionDetails: {
                            metadata: {
                                lockDuration: lockDuration,
                                lockReason: study.studyLock.lockReason,
                                sessionEnd: new Date()
                            }
                        },
                        notes: `Study unlocked after ${lockDuration} minutes`,
                        ipAddress: req.ip,
                        userAgent: req.get('user-agent')
                    },
                    
                    statusHistory: {
                        status: 'study_unlocked',
                        changedAt: new Date(),
                        changedBy: user._id,
                        note: `Unlocked after ${lockDuration} minutes`
                    }
                },
                $unset: {
                    'studyLock.lockedBy': '',
                    'studyLock.lockedByName': '',
                    'studyLock.lockedByRole': '',
                    'studyLock.lockedAt': '',
                    'studyLock.lockReason': '',
                    'studyLock.lockExpiry': ''
                }
            },
            { new: true }
        )
        .select('_id bharatPacsId studyLock')
        .lean();

        console.log(`✅ Study ${studyId} unlocked successfully by ${user.email} (Duration: ${lockDuration}m)`);

        res.json({
            success: true,
            message: `Study unlocked successfully (Session: ${lockDuration} minutes)`,
            data: {
                studyId: updatedStudy._id,
                bharatPacsId: updatedStudy.bharatPacsId,
                isLocked: false,
                lockDuration: lockDuration
            }
        });

    } catch (error) {
        console.error('❌ Error unlocking study:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to unlock study',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ✅ CHECK LOCK STATUS
export const checkStudyLockStatus = async (req, res) => {
    try {
        const { studyId } = req.params;
        const user = req.user;

        if (!user) {
            return res.status(401).json({ 
                success: false, 
                message: 'User not authenticated' 
            });
        }

        const study = await DicomStudy.findOne({
            _id: studyId,
            organizationIdentifier: user.organizationIdentifier
        })
        .select('_id bharatPacsId studyLock')
        .lean();

        if (!study) {
            return res.status(404).json({
                success: false,
                message: 'Study not found'
            });
        }

        res.json({
            success: true,
            data: {
                studyId: study._id,
                bharatPacsId: study.bharatPacsId,
                isLocked: study.studyLock?.isLocked || false,
                lockedBy: study.studyLock?.lockedBy || null,
                lockedByName: study.studyLock?.lockedByName || null,
                lockedAt: study.studyLock?.lockedAt || null,
                lockExpiry: study.studyLock?.lockExpiry || null,
                lockReason: study.studyLock?.lockReason || null,
                canEdit: !study.studyLock?.isLocked || 
                        study.studyLock?.lockedBy?.toString() === user._id.toString()
            }
        });

    } catch (error) {
        console.error('❌ Error checking lock status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to check lock status',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
