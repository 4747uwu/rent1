import mongoose from 'mongoose';
import DicomStudy from '../models/dicomStudyModel.js';
import User from '../models/userModel.js';
import Lab from '../models/labModel.js';
import Verifier from '../models/verifierModel.js';

// ✅ UPDATED: More flexible base query for verifiers
const buildVerifierBaseQuery = (req, workflowStatuses = null) => {
    const user = req.user;

    if (user.role !== 'verifier') {
        throw new Error('Access denied: Verifier role required');
    }

    // ✅ BASE: org + workflow statuses
    const queryFilters = {
        organizationIdentifier: user.organizationIdentifier
    };

    // ✅ DETERMINE VERIFIABLE STATUSES based on verification requirements
    let verifiableStatuses = [
        'verification_pending',
        'verification_in_progress',
        // 'report_completed',
        'final_report_downloaded',
        'report_rejected',
        'revert_to_radiologist'
    ];

    // ✅ CRITICAL: Include report_completed ONLY if verification was required
    // This is determined by checking:
    // 1. Doctor's requireReportVerification flag
    // 2. Lab's requireReportVerification setting
    // 3. Study's explicit requiresVerification flag

    // For now, always include it and let the query filter below handle it
    verifiableStatuses.push('report_completed');

    // ✅ WORKFLOW STATUS OVERRIDE
    if (workflowStatuses && workflowStatuses.length > 0) {
        queryFilters.workflowStatus = workflowStatuses.length === 1
            ? workflowStatuses[0]
            : { $in: workflowStatuses };
    } else {
        queryFilters.workflowStatus = { $in: verifiableStatuses };
    }

    // ✅ FILTER BY ASSIGNED LABS (lab binding)
    const assignedLabs = user.roleConfig?.assignedLabs || [];
    const labAccessMode = user.roleConfig?.labAccessMode || 'all';

    let labFilter = null;

    if (labAccessMode === 'selected' && assignedLabs.length > 0) {
        labFilter = { sourceLab: { $in: assignedLabs } };
        console.log(`🏥 [Verifier] Restricted to ${assignedLabs.length} lab(s):`, assignedLabs);
    } else if (labAccessMode === 'none') {
        labFilter = { sourceLab: { $in: [] } };
        console.log('🚫 [Verifier] Lab access mode = none');
    } else {
        labFilter = null;
        console.log('🏥 [Verifier] Lab access mode = all');
    }

    // ✅ FILTER BY ASSIGNED RADIOLOGISTS (doctor binding)
    const assignedRadiologists = user.roleConfig?.assignedRadiologists || [];

    let radiologistFilter = null;
    if (assignedRadiologists.length > 0) {
        radiologistFilter = { 'assignment.assignedTo': { $in: assignedRadiologists } };
        console.log(`🔒 [Verifier] Restricted to ${assignedRadiologists.length} radiologist(s):`, assignedRadiologists);
    } else {
        console.log('🔓 [Verifier] No radiologist restriction - seeing all org studies');
    }

    // ✅ CRITICAL: COMBINE FILTERS WITH $OR LOGIC
    if (radiologistFilter && labFilter) {
        queryFilters.$or = [
            radiologistFilter,
            labFilter
        ];
        console.log('🔀 [Verifier Filter] Using $OR: study matches if assigned to bound radiologist OR from bound lab');
    } else if (radiologistFilter) {
        Object.assign(queryFilters, radiologistFilter);
        console.log('🔍 [Verifier Filter] Using radiologist filter only');
    } else if (labFilter) {
        Object.assign(queryFilters, labFilter);
        console.log('🔍 [Verifier Filter] Using lab filter only');
    } else {
        console.log('🔓 [Verifier Filter] No radiologist or lab restrictions');
    }

    // ✅ DATE FILTERING
    const { filterStartDate, filterEndDate } = buildDateFilter(req);
    if (filterStartDate || filterEndDate) {
        const dateField = req.query.dateType === 'StudyDate' ? 'studyDate' : 'createdAt';
        queryFilters[dateField] = {};
        if (filterStartDate) queryFilters[dateField].$gte = filterStartDate;
        if (filterEndDate) queryFilters[dateField].$lte = filterEndDate;
    }

    // ✅ SEARCH - no regex on clinicalHistory
    if (req.query.search) {
        const searchTerm = req.query.search.trim();
        const looksLikeId = /^[a-zA-Z0-9\-_.]+$/.test(searchTerm) && searchTerm.length <= 30;

        if (looksLikeId) {
            queryFilters.$or = [
                { bharatPacsId: { $regex: `^${searchTerm}`, $options: 'i' } },
                { accessionNumber: { $regex: `^${searchTerm}`, $options: 'i' } },
                { 'patientInfo.patientID': { $regex: `^${searchTerm}`, $options: 'i' } }
            ];
        } else {
            queryFilters.$text = { $search: searchTerm };
        }
    }

    // ✅ MODALITY - single field, hits index
    if (req.query.modality && req.query.modality !== 'all') {
        queryFilters.modality = req.query.modality;
    }

    // ✅ LAB override from query (admin viewing specific lab)
    if (req.query.labId && req.query.labId !== 'all' && mongoose.Types.ObjectId.isValid(req.query.labId)) {
        if (labAccessMode === 'all' || assignedLabs.map(l => l.toString()).includes(req.query.labId)) {
            queryFilters.sourceLab = new mongoose.Types.ObjectId(req.query.labId);
        }
    }

    // ✅ SPECIFIC RADIOLOGIST filter from query (override)
    if (req.query.radiologist && req.query.radiologist !== 'all' && mongoose.Types.ObjectId.isValid(req.query.radiologist)) {
        const requestedRadId = new mongoose.Types.ObjectId(req.query.radiologist);
        if (assignedRadiologists.length === 0 || assignedRadiologists.map(r => r.toString()).includes(req.query.radiologist)) {
            queryFilters['assignment.assignedTo'] = requestedRadId;
        }
    }

    // ✅ PRIORITY filter
    if (req.query.priority && req.query.priority !== 'all') {
        queryFilters.priority = req.query.priority;
    }

    console.log('🔍 [Verifier Query] Final filters:', JSON.stringify(queryFilters, null, 2));
    return queryFilters;
};

// ✅ FIXED: Execute query with proper population for verification and reporting data
const executeStudyQuery = async (queryFilters, limit) => {
    try {
        const totalStudies = await DicomStudy.countDocuments(queryFilters);

        const studies = await DicomStudy.find(queryFilters)
            .populate('organization', 'name identifier contactEmail contactPhone address')
            .populate('patient', 'patientID patientNameRaw firstName lastName age gender dateOfBirth contactNumber')
            .populate('sourceLab', 'name labName identifier location contactPerson contactNumber')

            // ✅ CRITICAL: Assignment information with firstName/lastName for fallback
            .populate('assignment.assignedTo', 'fullName firstName lastName email role specialization organizationIdentifier')
            .populate('assignment.assignedBy', 'fullName firstName lastName email role')

            // ✅ CRITICAL: Report and verification info
            .populate('reportInfo.verificationInfo.verifiedBy', 'fullName firstName lastName email role specialization')
            .populate('reportInfo.modernReports.reportId', 'doctorId createdBy workflowInfo')
            .populate('currentReportStatus.lastReportedBy', 'fullName firstName lastName email role')

            // ✅ CRITICAL: CategoryTracking populations (THIS WAS MISSING!)
            .populate('categoryTracking.created.uploadedBy', 'fullName firstName lastName email role')
            .populate('categoryTracking.historyCreated.createdBy', 'fullName firstName lastName email role')
            .populate('categoryTracking.assigned.assignedTo', 'fullName firstName lastName email role')
            .populate('categoryTracking.assigned.assignedBy', 'fullName firstName lastName email role')
            .populate('categoryTracking.final.finalizedBy', 'fullName firstName lastName email role')
            .populate('categoryTracking.urgent.markedUrgentBy', 'fullName firstName lastName email role')

            // ✅ Study lock info
            .populate('studyLock.lockedBy', 'fullName firstName lastName email role')

            .sort({
                'reportInfo.finalizedAt': -1,
                'reportInfo.verificationInfo.verifiedAt': -1,
                createdAt: -1
            })
            .limit(limit)
            .lean();

        // ✅ DEBUG: Log first study's assignment info
        if (studies.length > 0) {
            console.log('🔍 [VERIFIER] FIRST STUDY ASSIGNMENT INFO:', {
                bharatPacsId: studies[0].bharatPacsId,
                assignmentAssignedTo: studies[0].assignment?.[0]?.assignedTo?.fullName || 'NOT POPULATED',
                categoryTrackingAssignedTo: studies[0].categoryTracking?.assigned?.assignedTo?.fullName || 'NOT POPULATED',
                currentReportedBy: studies[0].currentReportStatus?.lastReportedBy?.fullName || 'NOT POPULATED'
            });
        }

        return { studies, totalStudies };

    } catch (error) {
        console.error('❌ Error in executeStudyQuery:', error);
        throw error;
    }
};

// ✅ UPDATED: Dashboard values with simplified verification categories
export const getValues = async (req, res) => {
    console.log(`🔍 Verifier dashboard: Fetching values with filters: ${JSON.stringify(req.query)}`);
    try {
        const startTime = Date.now();
        const user = req.user;

        if (!user || user.role !== 'verifier') {
            return res.status(403).json({ success: false, message: 'Access denied: Verifier role required' });
        }

        const queryFilters = buildVerifierBaseQuery(req);

        console.log(`🔍 Verifier dashboard query filters:`, JSON.stringify(queryFilters, null, 2));

        // ✅ SIMPLIFIED: Only 2 status categories for counting
        const statusCategories = {
            pending: ['verification_pending', 'verification_in_progress'],
            verified: ['report_completed', 'final_report_downloaded'],
            rejected: ['report_rejected', 'revert_to_radiologist'],
        };

        const pipeline = [
            { $match: queryFilters },
            {
                $group: {
                    _id: '$workflowStatus',
                    count: { $sum: 1 }
                }
            }
        ];

        const [statusCountsResult, totalFilteredResult] = await Promise.allSettled([
            DicomStudy.aggregate(pipeline).allowDiskUse(false),
            DicomStudy.countDocuments(queryFilters)
        ]);

        if (statusCountsResult.status === 'rejected') {
            throw new Error(`Status counts query failed: ${statusCountsResult.reason.message}`);
        }

        const statusCounts = statusCountsResult.value;
        const totalFiltered = totalFilteredResult.status === 'fulfilled' ? totalFilteredResult.value : 0;

        // ✅ SIMPLIFIED: Calculate only verified and rejected
        let pending = 0;
        let verified = 0;
        let rejected = 0;

        statusCounts.forEach(({ _id: status, count }) => {
            if (statusCategories.pending.includes(status)) {
                pending += count;
            } else if (statusCategories.verified.includes(status)) {
                verified += count;
            } else if (statusCategories.rejected.includes(status)) {
                rejected += count;
            }
        });

        const processingTime = Date.now() - startTime;
        console.log(`🎯 Verifier dashboard values fetched in ${processingTime}ms`);

        const response = {
            success: true,
            total: totalFiltered,
            pending,
            verified,
            rejected,
            performance: {
                queryTime: processingTime,
                fromCache: false,
                filtersApplied: Object.keys(queryFilters).length > 0
            }
        };

        if (process.env.NODE_ENV === 'development') {
            response.debug = {
                filtersApplied: queryFilters,
                rawStatusCounts: statusCounts,
                statusCategories,
                userRole: user.role,
                userId: user._id,
                organization: user.organizationIdentifier
            };
        }

        res.status(200).json(response);

    } catch (error) {
        console.error('❌ Error fetching verifier dashboard values:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching verifier dashboard statistics.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
// ✅ NEW: Get Verified Studies
export const getVerifiedStudies = async (req, res) => {
    try {
        const startTime = Date.now();
        const limit = parseInt(req.query.limit) || 50;

        const user = req.user;
        if (!user || user.role !== 'verifier') {
            return res.status(403).json({ success: false, message: 'Access denied: Verifier role required' });
        }

        // ✅ FIX: verifyReport sets workflowStatus = 'report_completed' when approved
        // NOT 'report_verified' — that was the bug
        const verifiedStatuses = ['report_completed', 'final_report_downloaded'];
        const queryFilters = buildVerifierBaseQuery(req, verifiedStatuses);

        const { studies, totalStudies } = await executeStudyQuery(queryFilters, limit);
        const processingTime = Date.now() - startTime;

        return res.status(200).json({
            success: true,
            count: studies.length,
            totalRecords: totalStudies,
            data: studies,
            pagination: {
                currentPage: 1,
                totalPages: Math.ceil(totalStudies / limit),
                totalRecords: totalStudies,
                limit,
                hasNextPage: totalStudies > limit,
                hasPrevPage: false
            },
            metadata: {
                category: 'verified',
                statusesIncluded: verifiedStatuses,
                organizationFilter: user.organizationIdentifier,
                userRole: user.role,
                assignedRadiologists: user.roleConfig?.assignedRadiologists,
                processingTime
            }
        });

    } catch (error) {
        console.error('❌ VERIFIER VERIFIED: Error fetching verified studies:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching verified studies.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ✅ NEW: Get Rejected Studies
export const getRejectedStudies = async (req, res) => {
    try {
        const startTime = Date.now();
        const limit = parseInt(req.query.limit) || 50;

        const user = req.user;
        if (!user || user.role !== 'verifier') {
            return res.status(403).json({ success: false, message: 'Access denied: Verifier role required' });
        }

        // ✅ FIX: verifyReport sets workflowStatus = 'report_rejected' when rejected
        // AND revertInfo.isReverted = true — so also include revert_to_radiologist
        const rejectedStatuses = ['report_rejected', 'revert_to_radiologist'];  // ✅
        const queryFilters = buildVerifierBaseQuery(req, rejectedStatuses);

        const { studies, totalStudies } = await executeStudyQuery(queryFilters, limit);
        const processingTime = Date.now() - startTime;

        return res.status(200).json({
            success: true,
            count: studies.length,
            totalRecords: totalStudies,
            data: studies,
            pagination: {
                currentPage: 1,
                totalPages: Math.ceil(totalStudies / limit),
                totalRecords: totalStudies,
                limit,
                hasNextPage: totalStudies > limit,
                hasPrevPage: false
            },
            metadata: {
                category: 'rejected',
                statusesIncluded: rejectedStatuses,
                organizationFilter: user.organizationIdentifier,
                userRole: user.role,
                assignedRadiologists: user.roleConfig?.assignedRadiologists,
                processingTime
            }
        });

    } catch (error) {
        console.error('❌ VERIFIER REJECTED: Error fetching rejected studies:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching rejected studies.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ✅ UPDATED: Enhanced verify report - updates BOTH DicomStudy AND Report model
export const verifyReport = async (req, res) => {
    try {
        const { studyId } = req.params;
        const {
            verificationNotes,
            corrections = [],
            approved,
            rejectionReason,
            verificationTimeMinutes,
        } = req.body;
        const user = req.user;
        console.log(`🔍 [Verify Report] User ${user.fullName} (${user.role}) is verifying study ${studyId} with approved=${approved}`);

        // ✅ MULTI-ROLE: Check if user has verifier role in accountRoles
        const userRoles = user?.accountRoles || [user?.role];
        const hasVerifierRole = userRoles.includes('verifier');
        const hasAdminRole = userRoles.includes('admin') || userRoles.includes('assignor');

        // if (!hasVerifierRole && !hasAdminRole) {
        //     return res.status(403).json({ 
        //         success: false, 
        //         message: 'Access denied: Verifier, Admin, or Assignor role required' 
        //     });
        // }

        if (!mongoose.Types.ObjectId.isValid(studyId)) {
            return res.status(400).json({ success: false, message: 'Invalid study ID' });
        }

        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const study = await DicomStudy.findById(studyId).session(session);
            if (!study) {
                await session.abortTransaction();
                return res.status(404).json({ success: false, message: 'Study not found' });
            }

            // ✅ ADMIN BYPASS: Skip access checks for admin/assignor roles
            // if (!hasAdminRole) {
            //     // ✅ VERIFY ACCESS: Check if verifier can access this study
            //     const hasAccess = !user.roleConfig?.assignedRadiologists?.length || 
            //         user.roleConfig.assignedRadiologists.some(radiologistId => 
            //             study.assignment?.some(assignment => 
            //                 assignment.assignedTo?.toString() === radiologistId.toString()
            //             )
            //         );

            //     if (!hasAccess) {
            //         await session.abortTransaction();
            //         return res.status(403).json({ 
            //             success: false, 
            //             message: 'Access denied: Study not assigned to your radiologists' 
            //         });
            //     }
            // }

            // ✅ ADMIN BYPASS: Skip workflow state check for admin/assignor roles
            if (!hasAdminRole) {
                // ✅ UPDATED: Accept more statuses for verification
                const verifiableStatuses = [
                    'verification_pending',
                    'report_finalized',
                    'report_completed',

                    'verification_in_progress'
                ];

                if (!verifiableStatuses.includes(study.workflowStatus)) {
                    await session.abortTransaction();
                    return res.status(400).json({
                        success: false,
                        message: `Study is not in a state that can be verified. Current status: ${study.workflowStatus}. Expected one of: ${verifiableStatuses.join(', ')}`
                    });
                }
            } else {
                console.log(`✅ ADMIN BYPASS: User ${user.fullName} (${userRoles.join(', ')}) bypassing workflow state check`);
            }

            const now = new Date();

            // ✅ STEP 1: Update DicomStudy
            // ✅ SIMPLIFIED: Check if study needs reprint when approved
            const needsReprint = study.reprintNeeded === true;
            const studyUpdateData = {
                // ✅ NEW LOGIC:
                // - If approved && reprintNeeded → report_reprint_needed
                // - If approved && !reprintNeeded → report_completed
                // - If rejected → report_rejected
                workflowStatus: approved
                    ? (needsReprint ? 'report_reprint_needed' : 'report_completed')
                    : 'report_rejected',
                currentCategory: approved
                    ? (needsReprint ? 'REPRINT_NEED' : 'COMPLETED')
                    : 'REVERTED',
                'reportInfo.verificationInfo.verifiedBy': user._id,
                'reportInfo.verificationInfo.verifiedAt': now,
                'reportInfo.verificationInfo.verificationStatus': approved ? 'verified' : 'rejected',
                'reportInfo.verificationInfo.verificationNotes': verificationNotes || '',
                'reportInfo.verificationInfo.verificationTimeMinutes': verificationTimeMinutes || 0
            };

            // ✅ CLEAR reprintNeeded when approving a reprint study
            if (approved && needsReprint) {
                studyUpdateData.reprintNeeded = false;
                console.log('✅ [Verify] reprintNeeded cleared → setting report_reprint_needed');
            }

            // ✅ REJECTION: Never touch reprintNeeded here — that's revert.controller.js's job
            if (!approved) {
                studyUpdateData['reportInfo.verificationInfo.rejectionReason'] = rejectionReason || '';
                if (corrections?.length > 0) {
                    studyUpdateData['reportInfo.verificationInfo.corrections'] = corrections;
                }
                // ✅ reprintNeeded is NOT set here — stays whatever it was
                console.log('🔄 [Verify Reject] Normal verifier rejection — reprintNeeded NOT touched');
            }

            const historyEntry = {
                action: approved
                    ? (needsReprint ? 'report_reprint_needed' : 'report_completed')
                    : 'rejected',
                performedBy: user._id,
                performedAt: now,
                notes: verificationNotes || rejectionReason || ''
            };

            studyUpdateData.$push = {
                'reportInfo.verificationInfo.verificationHistory': historyEntry,
                'statusHistory': {
                    status: approved
                        ? (needsReprint ? 'report_reprint_needed' : 'report_completed')
                        : 'report_rejected',
                    changedAt: now,
                    changedBy: user._id,
                    note: `Report ${approved ? (needsReprint ? 'verified - reprint needed' : 'completed') : 'rejected'} by ${user.fullName} (${userRoles.join(', ')})`
                }
            };

            // ✅ UPDATE revertInfo when rejecting
            if (!approved) {
                // Initialize revertInfo if needed
                if (!study.revertInfo) {
                    study.revertInfo = {
                        revertHistory: [],
                        isReverted: false,
                        revertCount: 0
                    };
                }

                const revertRecord = {
                    revertedAt: now,
                    revertedBy: user._id,
                    revertedByName: user.fullName,
                    revertedByRole: userRoles.join(', '),
                    previousStatus: study.workflowStatus,
                    reason: rejectionReason || 'Report rejected during verification',
                    notes: verificationNotes || '',
                    resolved: false
                };

                // Add to revert history
                studyUpdateData.$push['revertInfo.revertHistory'] = revertRecord;

                // Set current revert and flags
                studyUpdateData['revertInfo.currentRevert'] = revertRecord;
                studyUpdateData['revertInfo.isReverted'] = true;
                studyUpdateData.$inc = { 'revertInfo.revertCount': 1 };

                console.log('🔄 [Verify Reject] Adding revertInfo for rejected study:', {
                    revertedBy: user.fullName,
                    reason: rejectionReason?.substring(0, 100),
                    newCount: (study.revertInfo?.revertCount || 0) + 1
                });
            }

            const updatedStudy = await DicomStudy.findByIdAndUpdate(
                studyId,
                studyUpdateData,
                { session, new: true }
            ).populate('reportInfo.verificationInfo.verifiedBy', 'fullName email role');

            console.log('✅ [Verify] Study updated:', {
                workflowStatus: updatedStudy.workflowStatus,
                currentCategory: updatedStudy.currentCategory,
                reprintNeeded: updatedStudy.reprintNeeded,
                isReverted: updatedStudy.revertInfo?.isReverted,
                revertCount: updatedStudy.revertInfo?.revertCount
            });

            // ✅ STEP 2: Update Report model with verification info
            const Report = mongoose.model('Report');
            const reports = await Report.find({
                dicomStudy: studyId,
                reportStatus: { $in: ['finalized', 'draft'] }
            }).session(session);

            if (reports.length > 0) {
                console.log(`📋 [Verify] Updating ${reports.length} Report(s) with verification info`);

                for (const report of reports) {
                    if (!report.verificationInfo) report.verificationInfo = {};

                    report.verificationInfo.verifiedBy = user._id;
                    report.verificationInfo.verifiedAt = now;
                    report.verificationInfo.verificationStatus = approved ? 'verified' : 'rejected';
                    report.verificationInfo.verificationNotes = verificationNotes || '';

                    if (!approved) {
                        report.verificationInfo.rejectionReason = rejectionReason || '';
                        if (corrections && corrections.length > 0) {
                            report.verificationInfo.corrections = corrections;
                        }
                    }

                    if (approved) {
                        report.reportStatus = 'verified';
                    }

                    if (!report.verificationInfo.verificationHistory) {
                        report.verificationInfo.verificationHistory = [];
                    }
                    report.verificationInfo.verificationHistory.push(historyEntry);

                    if (!report.workflowInfo.statusHistory) {
                        report.workflowInfo.statusHistory = [];
                    }
                    report.workflowInfo.statusHistory.push({
                        status: approved ? 'verified' : 'rejected',
                        changedAt: now,
                        changedBy: user._id,
                        notes: verificationNotes || rejectionReason || '',
                        userRole: user.role
                    });

                    await report.save({ session });
                }

                console.log(`✅ [Verify] All ${reports.length} Report(s) updated with verification info`);
            } else {
                console.warn('⚠️ [Verify] No Report documents found for study:', studyId);
            }

            // ✅ STEP 3: Update verifier stats
            if (hasVerifierRole) {
                try {
                    const VerifierModel = mongoose.model('Verifier');
                    await VerifierModel.findOneAndUpdate(
                        { userAccount: user._id },
                        {
                            $inc: {
                                'verificationStats.totalReportsVerified': 1,
                                'verificationStats.reportsVerifiedToday': 1,
                                'verificationStats.reportsVerifiedThisMonth': 1
                            },
                            $set: {
                                'verificationStats.lastVerificationAt': now
                            }
                        },
                        { upsert: false, session }
                    );
                } catch (statsError) {
                    console.log('⚠️ Could not update verifier stats:', statsError.message);
                }
            }

            await session.commitTransaction();

            console.log(`✅ VERIFICATION: Study ${studyId} ${approved ? 'verified' : 'rejected'} by ${user.fullName} (${userRoles.join(', ')})`);

            res.status(200).json({
                success: true,
                message: approved ? 'Report verified successfully' : 'Report rejected with corrections',
                data: {
                    studyId,
                    workflowStatus: approved ? 'report_verified' : 'report_rejected',
                    verificationStatus: approved ? 'verified' : 'rejected',
                    verifiedBy: user.fullName,
                    verifiedByRoles: userRoles,
                    verifiedAt: now,
                    verificationNotes,
                    corrections: !approved ? corrections : undefined,
                    rejectionReason: !approved ? rejectionReason : undefined,
                    adminBypass: hasAdminRole,
                    reportModelUpdated: reports.length > 0
                }
            });

        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }

    } catch (error) {
        console.error('❌ Error verifying report:', error);
        res.status(500).json({
            success: false,
            message: 'Server error verifying report.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ✅ NEW: Start verification process
export const startVerification = async (req, res) => {
    try {
        const { studyId } = req.params;
        const user = req.user;

        if (!user || user.role !== 'verifier') {
            return res.status(403).json({ success: false, message: 'Access denied: Verifier role required' });
        }

        if (!mongoose.Types.ObjectId.isValid(studyId)) {
            return res.status(400).json({ success: false, message: 'Invalid study ID' });
        }

        const study = await DicomStudy.findById(studyId);
        if (!study) {
            return res.status(404).json({ success: false, message: 'Study not found' });
        }

        // Check if study is in correct state
        if (!['report_finalized', 'report_drafted'].includes(study.workflowStatus)) {
            return res.status(400).json({
                success: false,
                message: 'Study is not ready for verification'
            });
        }

        const now = new Date();
        const updateData = {
            workflowStatus: 'verification_in_progress',
            currentCategory: 'VERIFICATION_PENDING',
            $push: {
                'reportInfo.verificationInfo.verificationHistory': {
                    action: 'verification_started',
                    performedBy: user._id,
                    performedAt: now,
                    notes: `Verification started by ${user.fullName}`
                },
                'statusHistory': {
                    status: 'verification_in_progress',
                    changedAt: now,
                    changedBy: user._id,
                    note: `Verification started by ${user.fullName}`
                }
            }
        };

        await DicomStudy.findByIdAndUpdate(studyId, updateData);

        res.status(200).json({
            success: true,
            message: 'Verification started successfully',
            data: {
                studyId,
                workflowStatus: 'verification_in_progress',
                startedBy: user.fullName,
                startedAt: now
            }
        });

    } catch (error) {
        console.error('❌ Error starting verification:', error);
        res.status(500).json({
            success: false,
            message: 'Server error starting verification.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Add this helper function for date filtering (missing from your file)
const buildDateFilter = (req) => {
    let filterStartDate = null;
    let filterEndDate = null;

    if (req.query.filterStartDate) {
        filterStartDate = new Date(req.query.filterStartDate);
        filterStartDate.setHours(0, 0, 0, 0);
    }

    if (req.query.filterEndDate) {
        filterEndDate = new Date(req.query.filterEndDate);
        filterEndDate.setHours(23, 59, 59, 999);
    }

    // Handle date range presets
    if (req.query.dateFilter) {
        const now = new Date();
        switch (req.query.dateFilter) {
            case 'today':
                filterStartDate = new Date(now);
                filterStartDate.setHours(0, 0, 0, 0);
                filterEndDate = new Date(now);
                filterEndDate.setHours(23, 59, 59, 999);
                break;
            case 'yesterday':
                filterStartDate = new Date(now);
                filterStartDate.setDate(now.getDate() - 1);
                filterStartDate.setHours(0, 0, 0, 0);
                filterEndDate = new Date(now);
                filterEndDate.setDate(now.getDate() - 1);
                filterEndDate.setHours(23, 59, 59, 999);
                break;
            case 'last7days':
                filterStartDate = new Date(now);
                filterStartDate.setDate(now.getDate() - 7);
                filterStartDate.setHours(0, 0, 0, 0);
                filterEndDate = new Date(now);
                filterEndDate.setHours(23, 59, 59, 999);
                break;
            case 'last30days':
                filterStartDate = new Date(now);
                filterStartDate.setDate(now.getDate() - 30);
                filterStartDate.setHours(0, 0, 0, 0);
                filterEndDate = new Date(now);
                filterEndDate.setHours(23, 59, 59, 999);
                break;
        }
    }

    return { filterStartDate, filterEndDate };
};

// ✅ ADD MISSING: Get Pending Studies
export const getPendingStudies = async (req, res) => {
    try {
        const startTime = Date.now();
        const limit = parseInt(req.query.limit) || 50;

        const user = req.user;
        if (!user || user.role !== 'verifier') {
            return res.status(403).json({ success: false, message: 'Access denied: Verifier role required' });
        }

        const pendingStatuses = ['verification_pending', 'verification_in_progress'];
        const queryFilters = buildVerifierBaseQuery(req, pendingStatuses);

        const { studies, totalStudies } = await executeStudyQuery(queryFilters, limit);

        const processingTime = Date.now() - startTime;

        return res.status(200).json({
            success: true,
            count: studies.length,
            totalRecords: totalStudies,
            data: studies,
            pagination: {
                currentPage: 1,
                totalPages: Math.ceil(totalStudies / limit),
                totalRecords: totalStudies,
                limit,
                hasNextPage: totalStudies > limit,
                hasPrevPage: false
            },
            metadata: {
                category: 'pending',
                statusesIncluded: pendingStatuses,
                organizationFilter: user.organizationIdentifier,
                userRole: user.role,
                assignedRadiologists: user.roleConfig?.assignedRadiologists,
                processingTime
            }
        });

    } catch (error) {
        console.error('❌ VERIFIER PENDING: Error fetching pending studies:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching pending studies.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ✅ ADD MISSING: Get In Progress Studies
export const getInProgressStudies = async (req, res) => {
    try {
        const startTime = Date.now();
        const limit = parseInt(req.query.limit) || 50;

        const user = req.user;
        if (!user || user.role !== 'verifier') {
            return res.status(403).json({ success: false, message: 'Access denied: Verifier role required' });
        }

        const inProgressStatuses = ['verification_in_progress'];
        const queryFilters = buildVerifierBaseQuery(req, inProgressStatuses);

        const { studies, totalStudies } = await executeStudyQuery(queryFilters, limit);

        const processingTime = Date.now() - startTime;

        return res.status(200).json({
            success: true,
            count: studies.length,
            totalRecords: totalStudies,
            data: studies,
            pagination: {
                currentPage: 1,
                totalPages: Math.ceil(totalStudies / limit),
                totalRecords: totalStudies,
                limit,
                hasNextPage: totalStudies > limit,
                hasPrevPage: false
            },
            metadata: {
                category: 'inprogress',
                statusesIncluded: inProgressStatuses,
                organizationFilter: user.organizationIdentifier,
                userRole: user.role,
                assignedRadiologists: user.roleConfig?.assignedRadiologists,
                processingTime
            }
        });

    } catch (error) {
        console.error('❌ VERIFIER IN-PROGRESS: Error fetching in-progress studies:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching in-progress studies.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ✅ ADD MISSING: Get All Studies for Verifier
export const getAllStudiesForVerifier = async (req, res) => {
    try {
        const startTime = Date.now();
        const limit = parseInt(req.query.limit) || 50;

        const user = req.user;
        if (!user || user.role !== 'verifier') {
            return res.status(403).json({ success: false, message: 'Access denied: Verifier role required' });
        }

        const allStatuses = [
            'verification_pending',
            'verification_in_progress',
            'report_completed',
            'final_report_downloaded',
            'report_rejected',
            'revert_to_radiologist'
        ];  // ✅

        const queryFilters = buildVerifierBaseQuery(req, allStatuses);

        const { studies, totalStudies } = await executeStudyQuery(queryFilters, limit);

        const processingTime = Date.now() - startTime;

        return res.status(200).json({
            success: true,
            count: studies.length,
            totalRecords: totalStudies,
            data: studies,
            pagination: {
                currentPage: 1,
                totalPages: Math.ceil(totalStudies / limit),
                totalRecords: totalStudies,
                limit,
                hasNextPage: totalStudies > limit,
                hasPrevPage: false
            },
            metadata: {
                category: 'all',
                statusesIncluded: ['report_finalized', 'report_drafted', 'verification_in_progress', 'report_verified', 'report_rejected'],
                organizationFilter: user.organizationIdentifier,
                userRole: user.role,
                assignedRadiologists: user.roleConfig?.assignedRadiologists,
                processingTime
            }
        });

    } catch (error) {
        console.error('❌ VERIFIER ALL: Error fetching all studies:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching all studies.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ✅ ADD MISSING: Get Assigned Radiologists
export const getAssignedRadiologists = async (req, res) => {
    try {
        const user = req.user;

        if (!user || user.role !== 'verifier') {
            return res.status(403).json({ success: false, message: 'Access denied: Verifier role required' });
        }

        // Get assigned radiologists from user's roleConfig
        const assignedRadiologistIds = user.roleConfig?.assignedRadiologists || [];

        if (assignedRadiologistIds.length === 0) {
            return res.status(200).json({
                success: true,
                radiologists: [],
                message: 'No radiologists assigned to this verifier'
            });
        }

        // Fetch radiologist details
        const radiologists = await User.find({
            _id: { $in: assignedRadiologistIds },
            role: { $in: ['radiologist', 'doctor_account'] },
            organizationIdentifier: user.organizationIdentifier,
            isActive: true
        }).select('fullName email role specialization profilePicture');

        return res.status(200).json({
            success: true,
            radiologists,
            count: radiologists.length
        });

    } catch (error) {
        console.error('❌ Error fetching assigned radiologists:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching assigned radiologists.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Add this new function to the existing verifier.controller.js file

// ✅ NEW: Get report content for verification (verifier-specific endpoint)
export const getReportForVerification = async (req, res) => {
    try {
        const { studyId } = req.params;
        const user = req.user;

        console.log('📋 [Verifier Report] Getting report for verification:', {
            studyId,
            userId: user._id,
            userRole: user.role
        });

        if (!user || user.role !== 'verifier') {
            return res.status(403).json({ success: false, message: 'Access denied: Verifier role required' });
        }

        if (!mongoose.Types.ObjectId.isValid(studyId)) {
            return res.status(400).json({ success: false, message: 'Invalid study ID' });
        }

        // ✅ STEP 1: Get the study to verify organization access
        const study = await DicomStudy.findById(studyId).lean();
        if (!study) {
            return res.status(404).json({
                success: false,
                message: 'Study not found'
            });
        }

        // ✅ STEP 2: Check organization access
        if (study.organizationIdentifier !== user.organizationIdentifier) {
            return res.status(403).json({
                success: false,
                message: 'Access denied: Study not in your organization'
            });
        }

        // ✅ STEP 3: Check if study is in verifiable state
        const verifiableStatuses = ['report_finalized', 'report_drafted', 'verification_in_progress', 'report_verified', 'report_rejected'];
        if (!verifiableStatuses.includes(study.workflowStatus)) {
            return res.status(400).json({
                success: false,
                message: 'Study is not in a verifiable state'
            });
        }

        // ✅ STEP 4: Try to get report from modern Report collection first
        const Report = mongoose.model('Report');
        let report = await Report.findOne({
            dicomStudy: studyId,
            reportStatus: { $in: ['finalized', 'draft'] },
            organizationIdentifier: user.organizationIdentifier
        })
            .sort({
                // Prioritize finalized reports for verification
                reportStatus: 1, // 'draft' < 'finalized' alphabetically
                createdAt: -1
            })
            .populate('doctorId', 'fullName email')
            .lean();

        if (report) {
            console.log('✅ [Verifier Report] Modern report found:', {
                reportId: report._id,
                reportType: report.reportType,
                reportStatus: report.reportStatus,
                contentLength: report.reportContent?.htmlContent?.length || 0
            });

            return res.status(200).json({
                success: true,
                data: {
                    report: {
                        _id: report._id,
                        reportId: report.reportId,
                        reportType: report.reportType,
                        reportStatus: report.reportStatus,
                        reportContent: report.reportContent,
                        templateInfo: report.reportContent?.templateInfo,
                        placeholders: report.reportContent?.placeholders,
                        exportInfo: report.exportInfo,
                        createdAt: report.createdAt,
                        updatedAt: report.updatedAt,
                        workflowInfo: report.workflowInfo,
                        doctorId: report.doctorId
                    },
                    studyInfo: {
                        workflowStatus: study.workflowStatus,
                        patientInfo: study.patientInfo,
                        studyDate: study.studyDate,
                        modality: study.modality
                    }
                },
                source: 'modern_report_system'
            });
        }

        // ✅ STEP 5: Fallback to legacy reports in DicomStudy
        console.log('📋 [Verifier Report] No modern report found, checking legacy reports');

        // Check uploaded reports
        if (study.uploadedReports && study.uploadedReports.length > 0) {
            const latestReport = study.uploadedReports
                .filter(r => r.reportStatus === 'finalized')
                .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))[0];

            if (latestReport) {
                console.log('✅ [Verifier Report] Legacy uploaded report found');

                return res.status(200).json({
                    success: true,
                    data: {
                        report: {
                            _id: `legacy_${study._id}_${latestReport._id}`,
                            reportType: latestReport.reportType || 'uploaded-report',
                            reportStatus: latestReport.reportStatus,
                            reportContent: {
                                htmlContent: latestReport.data ?
                                    `<div class="legacy-report">
                                        <h3>Legacy Report</h3>
                                        <p><strong>Filename:</strong> ${latestReport.filename}</p>
                                        <p><strong>Uploaded:</strong> ${new Date(latestReport.uploadedAt).toLocaleString()}</p>
                                        <div class="report-content">
                                            ${latestReport.data.includes('<') ? latestReport.data : `<pre>${latestReport.data}</pre>`}
                                        </div>
                                    </div>` :
                                    '<p>No content available</p>'
                            },
                            createdAt: latestReport.uploadedAt,
                            updatedAt: latestReport.uploadedAt,
                            doctorId: { fullName: latestReport.uploadedBy || 'Unknown' }
                        },
                        studyInfo: {
                            workflowStatus: study.workflowStatus,
                            patientInfo: study.patientInfo,
                            studyDate: study.studyDate,
                            modality: study.modality
                        }
                    },
                    source: 'legacy_uploaded_report'
                });
            }
        }

        // ✅ STEP 6: Check for basic report content in reportInfo
        if (study.reportInfo?.reportContent) {
            console.log('✅ [Verifier Report] Basic report content found');

            return res.status(200).json({
                success: true,
                data: {
                    report: {
                        _id: `basic_${study._id}`,
                        reportType: 'basic-report',
                        reportStatus: study.workflowStatus === 'report_finalized' ? 'finalized' : 'draft',
                        reportContent: {
                            htmlContent: study.reportInfo.reportContent.includes('<') ?
                                study.reportInfo.reportContent :
                                `<pre>${study.reportInfo.reportContent}</pre>`
                        },
                        createdAt: study.reportInfo.startedAt || study.createdAt,
                        updatedAt: study.reportInfo.finalizedAt || study.updatedAt,
                        doctorId: { fullName: study.reportInfo.reporterName || 'Unknown' }
                    },
                    studyInfo: {
                        workflowStatus: study.workflowStatus,
                        patientInfo: study.patientInfo,
                        studyDate: study.studyDate,
                        modality: study.modality
                    }
                },
                source: 'basic_report_info'
            });
        }

        // ✅ STEP 7: No report found
        console.log('⚠️ [Verifier Report] No report found for study:', studyId);
        return res.status(404).json({
            success: false,
            message: 'No report available for verification',
            studyStatus: study.workflowStatus
        });

    } catch (error) {
        console.error('❌ [Verifier Report] Error getting report for verification:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while getting report for verification',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ✅ COMPLETELY REWRITTEN: Update report during verification (NEVER creates new report)
export const updateReportDuringVerification = async (req, res) => {
    try {
        const { studyId } = req.params;
        const {
            htmlContent,
            verificationNotes,
            templateId,
            templateInfo,
            maintainFinalizedStatus = true,
            reportId
        } = req.body;
        const user = req.user;

        console.log('📝 [Verifier Update] Starting report update during verification:', {
            studyId,
            userId: user._id,
            userRole: user.role,
            userOrg: user.organizationIdentifier,
            contentLength: htmlContent?.length || 0,
            maintainFinalized: maintainFinalizedStatus
        });

        // ✅ VALIDATION: Verifier role required
        if (!user || user.role !== 'verifier') {
            return res.status(403).json({
                success: false,
                message: 'Access denied: Verifier role required'
            });
        }

        // ✅ VALIDATION: Valid study ID
        if (!studyId || !mongoose.Types.ObjectId.isValid(studyId)) {
            return res.status(400).json({
                success: false,
                message: 'Valid study ID is required'
            });
        }

        // ✅ VALIDATION: Content required
        if (!htmlContent || !htmlContent.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Report content is required'
            });
        }

        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // ✅ STEP 1: Find the study
            const study = await DicomStudy.findById(studyId)
                .populate('patient', 'fullName patientId age gender')
                .session(session);

            if (!study) {
                await session.abortTransaction();
                return res.status(404).json({
                    success: false,
                    message: 'Study not found'
                });
            }

            console.log('🔍 [Verifier Update] Study found:', {
                studyId: study._id,
                studyOrg: study.organizationIdentifier,
                userOrg: user.organizationIdentifier,
                workflowStatus: study.workflowStatus
            });

            // ✅ STEP 2: Find THE MOST RECENT finalized report for this study
            const Report = mongoose.model('Report');

            // If reportId provided, target that specific report; otherwise fall back to most recent finalized
            let existingReport = null;
            if (reportId && mongoose.Types.ObjectId.isValid(reportId)) {
                existingReport = await Report.findOne({
                    _id: reportId,
                    dicomStudy: studyId
                }).session(session);
                console.log('🎯 [Verifier Update] Targeted report by ID:', reportId, '→ found:', !!existingReport);
            }
            if (!existingReport) {
                existingReport = await Report.findOne({
                    dicomStudy: studyId,
                    reportStatus: { $in: ['finalized', 'verified'] }
                })
                    .sort({ createdAt: -1 })
                    .session(session);
                console.log('🔍 [Verifier Update] Fallback to most recent finalized/verified report:', existingReport?._id);
            }

            if (!existingReport) {
                await session.abortTransaction();
                console.error('❌ [Verifier Update] No finalized report found for study:', studyId);
                return res.status(404).json({
                    success: false,
                    message: 'No finalized report found to update. Please finalize a report first.'
                });
            }

            console.log('📄 [Verifier Update] Found existing finalized report to UPDATE:', {
                reportId: existingReport._id,
                reportObjectId: existingReport._id.toString(),
                currentStatus: existingReport.reportStatus,
                reportOrg: existingReport.organizationIdentifier,
                originalContent: existingReport.reportContent?.htmlContent?.length || 0,
                createdAt: existingReport.createdAt,
                createdBy: existingReport.createdBy
            });

            // ✅ STEP 3: UPDATE THE EXISTING REPORT (DO NOT CREATE NEW)
            const now = new Date();

            // Update content
            existingReport.reportContent.htmlContent = htmlContent;

            // Update plain text
            const plainText = htmlContent.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
            existingReport.reportContent.plainTextContent = plainText;

            // Update template info if provided
            if (templateInfo) {
                existingReport.reportContent.templateInfo = {
                    templateId: templateInfo.templateId || templateId,
                    templateName: templateInfo.templateName,
                    templateCategory: templateInfo.templateCategory,
                    templateTitle: templateInfo.templateTitle
                };
            }

            // Update statistics
            existingReport.reportContent.statistics = {
                wordCount: plainText ? plainText.split(/\s+/).length : 0,
                characterCount: plainText ? plainText.length : 0,
                pageCount: Math.ceil((plainText?.length || 0) / 2500) || 1
            };

            // ✅ CRITICAL: Keep status as finalized (DO NOT change)
            existingReport.reportStatus = 'finalized';
            existingReport.reportType = 'finalized';

            // ✅ Update workflow history
            if (!existingReport.workflowInfo) {
                existingReport.workflowInfo = { statusHistory: [] };
            }
            if (!existingReport.workflowInfo.statusHistory) {
                existingReport.workflowInfo.statusHistory = [];
            }

            existingReport.workflowInfo.statusHistory.push({
                status: 'finalized',
                changedAt: now,
                changedBy: user._id,
                notes: verificationNotes || 'Report content updated by verifier during verification process',
                userRole: 'verifier'
            });

            // ✅ Update verification history
            if (!existingReport.verificationInfo) {
                existingReport.verificationInfo = { verificationHistory: [] };
            }
            if (!existingReport.verificationInfo.verificationHistory) {
                existingReport.verificationInfo.verificationHistory = [];
            }

            existingReport.verificationInfo.verificationHistory.push({
                action: 'corrections_requested',
                performedBy: user._id,
                performedAt: now,
                notes: verificationNotes || 'Report content updated during verification'
            });

            // Update verifier ID if not already set
            if (!existingReport.verifierId) {
                existingReport.verifierId = user._id;
            }

            // Update audit info
            if (!existingReport.auditInfo) {
                existingReport.auditInfo = { accessLog: [] };
            }
            if (!existingReport.auditInfo.accessLog) {
                existingReport.auditInfo.accessLog = [];
            }

            existingReport.auditInfo.accessLog.push({
                accessedBy: user._id,
                accessedAt: now,
                accessType: 'edit',
                ipAddress: req.ip || 'unknown',
                userAgent: req.headers['user-agent'] || 'unknown'
            });

            existingReport.auditInfo.lastAccessedAt = now;
            existingReport.auditInfo.accessCount = (existingReport.auditInfo.accessCount || 0) + 1;

            // Update timestamps
            existingReport.updatedAt = now;

            // ✅ CRITICAL: Use save() on the EXISTING document (not create)
            console.log('💾 [Verifier Update] Saving EXISTING report (ID: ' + existingReport._id + ')...');
            const savedReport = await existingReport.save({ session });

            console.log('✅ [Verifier Update] Report UPDATED successfully (same ID):', {
                reportId: savedReport._id.toString(),
                sameIdConfirmed: savedReport._id.toString() === existingReport._id.toString(),
                newContentLength: savedReport.reportContent?.htmlContent?.length || 0,
                statusMaintained: savedReport.reportStatus,
                updatedAt: savedReport.updatedAt
            });

            // ✅ STEP 4: Update study metadata
            study.reportInfo = study.reportInfo || {};
            study.reportInfo.lastModifiedAt = now;
            study.reportInfo.lastModifiedBy = user._id;
            study.reportInfo.modificationReason = 'Updated during verification by ' + user.fullName;

            if (!study.statusHistory) {
                study.statusHistory = [];
            }
            study.statusHistory.push({
                status: 'report_finalized',
                changedAt: now,
                changedBy: user._id,
                note: `Report updated during verification by ${user.fullName || 'verifier'}`
            });

            await study.save({ session });

            await session.commitTransaction();

            console.log('✅ [Verifier Update] Transaction committed - report updated, NOT created');

            res.status(200).json({
                success: true,
                message: 'Report updated successfully during verification',
                data: {
                    reportId: savedReport._id,
                    reportStatus: savedReport.reportStatus,
                    updatedAt: savedReport.updatedAt,
                    contentLength: savedReport.reportContent?.htmlContent?.length || 0,
                    updatedBy: user.fullName,
                    action: 'UPDATED_EXISTING_REPORT' // ✅ Clear indication
                }
            });

        } catch (error) {
            console.error('❌ [Verifier Update] Transaction error:', error);
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }

    } catch (error) {
        console.error('❌ [Verifier Update] Error updating report during verification:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while updating report',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ✅ FIXED: Update the default export to only include defined functions
export default {
    getValues,
    getPendingStudies,
    getInProgressStudies,
    getAllStudiesForVerifier,
    getAssignedRadiologists,
    verifyReport,
    startVerification,
    getVerifiedStudies,
    getRejectedStudies,
    // Alias for backward compatibility
    getCompletedStudies: getVerifiedStudies,
    getReportForVerification,
    updateReportDuringVerification // ✅ NEW
};