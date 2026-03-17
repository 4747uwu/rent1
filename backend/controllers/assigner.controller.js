import DicomStudy from '../models/dicomStudyModel.js';
import User from '../models/userModel.js';
import Doctor from '../models/doctorModel.js';
import Patient from '../models/patientModel.js';
// import { calculateStudyTAT, updateStudyTAT } from '../utils/TATutility.js';
// import cache from '../services/cache.js';
import mongoose from 'mongoose';

// ✅ PRIORITY VALIDATION HELPER
const validatePriority = (priority) => {
    const validPriorities = ['NORMAL', 'URGENT', 'EMERGENCY', 'STAT', 'ROUTINE'];
    
    // Handle common invalid values
    if (!priority || priority === 'SELECT' || priority === 'select') {
        return 'NORMAL';
    }
    
    // Normalize to uppercase
    const normalizedPriority = priority.toString().toUpperCase();
    
    // Return valid priority or default to NORMAL
    return validPriorities.includes(normalizedPriority) ? normalizedPriority : 'NORMAL';
};

// ✅ GET UNASSIGNED STUDIES FOR ASSIGNOR WITH LAB FILTERING
export const getUnassignedStudies = async (req, res) => {
    try {
        // Only assignor can access this
        if (req.user.role !== 'assignor') {
            return res.status(403).json({
                success: false,
                message: 'Access denied: Assignor role required'
            });
        }

        const {
            search = '',
            modality = 'all',
            priority = 'all',
            dateFilter = 'today',
            dateType = 'createdAt',
            customDateFrom,
            customDateTo,
            limit = 50,
            page = 1
        } = req.query;

        // Build base query for organization-specific unassigned studies
        let query = {
            organizationIdentifier: req.user.organizationIdentifier,
            $or: [
                { assignment: { $exists: false } },
                { assignment: { $size: 0 } },
                { 'assignment.status': { $in: ['cancelled', 'rejected'] } }
            ]
        };

        // ✅ NEW: Apply lab filtering based on assignor's configuration
        const assignorLabAccessMode = req.user.roleConfig?.labAccessMode || 'all';
        const assignedLabs = req.user.roleConfig?.assignedLabs || [];

        console.log('🔍 [Assignor Lab Filter]:', {
            userId: req.user._id,
            userName: req.user.fullName,
            labAccessMode: assignorLabAccessMode,
            assignedLabsCount: assignedLabs.length,
            assignedLabs: assignedLabs
        });

        if (assignorLabAccessMode === 'selected' && assignedLabs.length > 0) {
            // Only show studies from assigned labs
            query.sourceLab = { $in: assignedLabs };
            console.log(`✅ Filtering to ${assignedLabs.length} assigned labs`);
        } else if (assignorLabAccessMode === 'none') {
            // No lab access - return empty results
            console.log('⚠️ Assignor has no lab access - returning empty results');
            return res.json({
                success: true,
                data: [],
                pagination: {
                    total: 0,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    pages: 0
                },
                message: 'No lab access configured for this assignor'
            });
        }
        // If 'all' mode, no additional filtering needed

        // Rest of existing filters...
        if (search) {
            query.$and = query.$and || [];
            query.$and.push({
                $or: [
                    { accessionNumber: { $regex: search, $options: 'i' } },
                    { 'patientInfo.patientName': { $regex: search, $options: 'i' } },
                    { 'patientInfo.patientID': { $regex: search, $options: 'i' } },
                    { studyInstanceUID: { $regex: search, $options: 'i' } }
                ]
            });
        }

        if (modality !== 'all') {
            query.modality = modality;
        }

        if (priority !== 'all') {
            query.priority = priority;
        }

        // Date filtering logic...
        // [Keep existing date filter code]

        // Execute query
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [studies, total] = await Promise.all([
            DicomStudy.find(query)
                .populate('sourceLab', 'name identifier')
                .populate('patient', 'fullName patientId')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            DicomStudy.countDocuments(query)
        ]);

        console.log(`✅ Found ${studies.length} unassigned studies for assignor (lab filtered)`);

        res.json({
            success: true,
            data: studies,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            },
            labFilter: {
                mode: assignorLabAccessMode,
                appliedLabs: assignorLabAccessMode === 'selected' ? assignedLabs.length : 'all'
            }
        });

    } catch (error) {
        console.error('❌ Get unassigned studies error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch unassigned studies'
        });
    }
};

// ✅ GET AVAILABLE RADIOLOGISTS AND VERIFIERS FOR ASSIGNMENT
export const getAvailableAssignees = async (req, res) => {
    try {
        // // Only assignor can access this
        // if (req.user.role !== 'assignor') {
        //     return res.status(403).json({
        //         success: false,
        //         message: 'Only assignor can access assignee list'
        //     });
        // }

        // Get radiologists and verifiers in the same organization
        const radiologists = await User.find({
            organizationIdentifier: req.user.organizationIdentifier,
            role: 'radiologist',
            isActive: true
        })
        .select('_id fullName email activityStats')
        .lean();

        const verifiers = await User.find({
            organizationIdentifier: req.user.organizationIdentifier,
            role: 'verifier',
            isActive: true
        })
        .select('_id fullName email activityStats')
        .lean();

        // Get current workload for each user
        const radiologistIds = radiologists.map(r => r._id);
        const verifierIds = verifiers.map(v => v._id);

        // Count assigned studies for each radiologist/verifier
        const workloadAggregation = await DicomStudy.aggregate([
            {
                $match: {
                    organizationIdentifier: req.user.organizationIdentifier,
                    'assignment.assignedTo': { $in: [...radiologistIds, ...verifierIds] },
                    'assignment.status': { $in: ['assigned', 'in_progress'] }
                }
            },
            {
                $unwind: '$assignment'
            },
            {
                $match: {
                    'assignment.status': { $in: ['assigned', 'in_progress'] }
                }
            },
            {
                $group: {
                    _id: '$assignment.assignedTo',
                    currentWorkload: { $sum: 1 },
                    urgentCases: {
                        $sum: {
                            $cond: [{ $eq: ['$priority', 'URGENT'] }, 1, 0]
                        }
                    },
                    statCases: {
                        $sum: {
                            $cond: [{ $eq: ['$priority', 'STAT'] }, 1, 0]
                        }
                    }
                }
            }
        ]);

        // Create workload map
        const workloadMap = {};
        workloadAggregation.forEach(item => {
            workloadMap[item._id.toString()] = {
                currentWorkload: item.currentWorkload,
                urgentCases: item.urgentCases,
                statCases: item.statCases
            };
        });

        // Enhance radiologists and verifiers with workload data
        const enhancedRadiologists = radiologists.map(radiologist => ({
            ...radiologist,
            workload: workloadMap[radiologist._id.toString()] || {
                currentWorkload: 0,
                urgentCases: 0,
                statCases: 0
            }
        }));

        const enhancedVerifiers = verifiers.map(verifier => ({
            ...verifier,
            workload: workloadMap[verifier._id.toString()] || {
                currentWorkload: 0,
                urgentCases: 0,
                statCases: 0
            }
        }));

        console.log(`👥 Assignor fetched ${enhancedRadiologists.length} radiologists and ${enhancedVerifiers.length} verifiers`);

        res.json({
            success: true,
            data: {
                radiologists: enhancedRadiologists,
                verifiers: enhancedVerifiers
            }
        });

    } catch (error) {
        console.error('❌ Get available assignees error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch available assignees'
        });
    }
};

// ✅ ASSIGN STUDY TO RADIOLOGIST OR VERIFIER
export const assignStudy = async (req, res) => {
    const session = await mongoose.startSession();

    try {
        const result = await session.withTransaction(async (currentSession) => {
            const { studyId } = req.params;
            const { assignedTo, assigneeRole, priority, notes, dueDate } = req.body;
            const assignedBy = req.user._id; // User._id of the assignor

            console.log(`🔄 Processing assignment for ${assigneeRole} (ID: ${assignedTo}) to study (ID: ${studyId})`);

            if (!['assignor', 'admin', 'super_admin'].includes(req.user.role)) {
    return res.status(403).json({
        success: false,
        message: 'Only assignor or admin can access unassigned studies'
    });
}


            // Validate required fields
            if (!assignedTo || !assigneeRole) {
                throw new Error('Assigned user and role are required');
            }

            // Validate assignee role
            if (!['radiologist', 'verifier'].includes(assigneeRole)) {
                throw new Error('Can only assign to radiologist or verifier');
            }

            // Fetch study first
            let study = await DicomStudy.findOne({
                _id: studyId,
                organizationIdentifier: req.user.organizationIdentifier
            })
            .populate({
                path: 'patient',
                select: '_id patientID',
                options: { session: currentSession }
            })
            .session(currentSession)
            .read('primary')
            .exec();

            if (!study) {
                throw new Error('Study not found');
            }

            // ✅ CHECK IF STUDY IS LOCKED - PREVENT ASSIGNMENT IF LOCKED
            if (study.studyLock?.isLocked) {
                throw new Error(`Study is locked by ${study.studyLock.lockedByName || 'another user'}. Cannot assign while locked.`);
            }

            // Verify assignee exists and has correct role
            const assignee = await User.findOne({
                _id: assignedTo,
                organizationIdentifier: req.user.organizationIdentifier,
                role: assigneeRole,
                isActive: true
            })
            .session(currentSession)
            .read('primary')
            .exec();

            if (!assignee) {
                throw new Error(`${assigneeRole} not found or inactive`);
            }

            // ✅ VALIDATE AND SANITIZE PRIORITY
            const validatedPriority = validatePriority(priority || study.priority);
            const validatedStudyPriority = validatePriority(study.priority);

            console.log('🔍 PRIORITY VALIDATION:', {
                originalPriority: priority,
                studyPriority: study.priority,
                validatedPriority,
                validatedStudyPriority
            });

            // --- Ensure study.assignment is an array ---
            const needsArrayInitialization = !Array.isArray(study.assignment);

            if (needsArrayInitialization) {
                console.log(`🔧 Initializing assignment array for study ${studyId}`);
                
                await DicomStudy.findByIdAndUpdate(
                    studyId,
                    { $set: { assignment: [] } },
                    { session: currentSession, new: false }
                );
                
                // Re-fetch the study to get the updated document with array
                study = await DicomStudy.findOne({
                    _id: studyId,
                    organizationIdentifier: req.user.organizationIdentifier
                })
                .populate({
                    path: 'patient',
                    select: '_id patientID',
                    options: { session: currentSession }
                })
                .session(currentSession)
                .read('primary')
                .exec();

                if (!study) {
                    throw new Error('Study not found after initializing assignment array');
                }
                console.log(`✅ Assignment array initialized for study ${studyId}`);
            }

            // Check if study is already assigned to someone active
            const activeAssignment = study.assignment?.find(assign => 
                assign.status === 'assigned' || assign.status === 'in_progress'
            );

            if (activeAssignment) {
                throw new Error('Study is already assigned to another user');
            }

            const currentTime = new Date();
            let updatedStudy;

            // Check for existing assignment to same user
            const existingAssignmentIndex = study.assignment.findIndex(
                assign => assign.assignedTo && assign.assignedTo.toString() === assignedTo.toString()
            );

            // Create assignment object
            const newAssignment = {
                assignedTo: assignedTo,
                assignedBy: assignedBy,
                assignedAt: currentTime,
                role: assigneeRole,
                status: 'assigned',
                priority: validatedPriority,
                notes: notes || '',
                dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 24 * 60 * 60 * 1000)
            };

            // ✅ CREATE ACTION LOG ENTRY FOR ASSIGNMENT
            const assignmentActionLog = {
                actionType: 'study_assigned',
                actionCategory: 'assignment',
                performedBy: assignedBy,
                performedByName: req.user.fullName || req.user.email,
                performedByRole: req.user.role,
                performedAt: currentTime,
                targetUser: assignedTo,
                targetUserName: assignee.fullName || assignee.email,
                targetUserRole: assigneeRole,
                assignmentInfo: {
                    assignmentType: existingAssignmentIndex > -1 ? 'reassignment' : 'initial',
                    previousAssignee: existingAssignmentIndex > -1 ? study.assignment[existingAssignmentIndex].assignedTo : null,
                    priority: validatedPriority,
                    dueDate: newAssignment.dueDate
                },
                notes: notes || `Assigned to ${assignee.fullName || assignee.email} (${assigneeRole})`,
                ipAddress: req.ip,
                userAgent: req.get('user-agent'),
                sessionId: req.sessionID
            };

            // ✅ PREPARE CATEGORY TRACKING UPDATE FOR ASSIGNED
            const categoryTrackingAssigned = {
                assignedAt: currentTime,
                assignedTo: assignedTo,
                assignedBy: assignedBy,
                acceptedAt: null,
                assignmentHistory: study.categoryTracking?.assigned?.assignmentHistory || []
            };

            // Add to assignment history
            categoryTrackingAssigned.assignmentHistory.push({
                assignedTo: assignedTo,
                assignedAt: currentTime,
                unassignedAt: null,
                reason: notes || 'Initial assignment'
            });

            if (existingAssignmentIndex > -1) {
                console.log(`ℹ️ User (ID: ${assignedTo}) already has assignment entry for study ${studyId}. Updating existing assignment.`);
                
                const updatePath = `assignment.${existingAssignmentIndex}`;
                updatedStudy = await DicomStudy.findByIdAndUpdate(
                    studyId,
                    {
                        $set: {
                            [`${updatePath}.assignedAt`]: currentTime,
                            [`${updatePath}.assignedBy`]: assignedBy,
                            [`${updatePath}.role`]: assigneeRole,
                            [`${updatePath}.status`]: 'assigned',
                            [`${updatePath}.priority`]: validatedPriority,
                            [`${updatePath}.notes`]: notes || '',
                            [`${updatePath}.dueDate`]: newAssignment.dueDate,
                            status: 'assigned',
                            priority: validatedStudyPriority,
                            workflowStatus: 'assigned_to_doctor',
                            // ✅ UPDATE CATEGORY TO ASSIGNED
                            currentCategory: 'ASSIGNED',
                            'categoryTracking.assigned': categoryTrackingAssigned
                        },
                        $push: {
                            statusHistory: {
                                status: 'assignment_updated',
                                changedAt: currentTime,
                                changedBy: assignedBy,
                                note: notes || `Assignment updated for ${assignee.fullName || assignee.email}`
                            },
                            // ✅ ADD ACTION LOG ENTRY
                            actionLog: assignmentActionLog
                        }
                    },
                    { session: currentSession, new: true, runValidators: false }
                );
            } else {
                console.log(`➕ Adding new assignment for User (ID: ${assignedTo}) to study ${studyId}.`);
                
                updatedStudy = await DicomStudy.findByIdAndUpdate(
                    studyId,
                    {
                        $push: {
                            assignment: newAssignment,
                            statusHistory: {
                                status: 'assigned_to_doctor',
                                changedAt: currentTime,
                                changedBy: assignedBy,
                                note: notes || `Assigned to ${assignee.fullName || assignee.email} (${assigneeRole})`
                            },
                            // ✅ ADD ACTION LOG ENTRY
                            actionLog: assignmentActionLog
                        },
                        $set: {
                            status: 'assigned',
                            priority: validatedStudyPriority,
                            workflowStatus: 'assigned_to_doctor',
                            // ✅ UPDATE CATEGORY TO ASSIGNED
                            currentCategory: 'ASSIGNED',
                            'categoryTracking.assigned': categoryTrackingAssigned
                        }
                    },
                    { session: currentSession, new: true, runValidators: false }
                );
            }

            if (!updatedStudy) {
                throw new Error('Study not found or failed to update during assignment operation');
            }

            console.log('✅ CREATING ASSIGNMENT:', {
                studyId: updatedStudy._id,
                bharatPacsId: updatedStudy.bharatPacsId,
                assignedTo: assignee.fullName || assignee.email,
                priority: validatedPriority,
                studyPriority: validatedStudyPriority,
                category: updatedStudy.currentCategory,
                isLocked: false // ✅ Study NOT locked after assignment
            });

            // Update assignee's activity stats
            await User.findByIdAndUpdate(
                assignedTo,
                {
                    $inc: { 'activityStats.casesAssigned': 1 },
                    $set: { 'activityStats.lastActivityAt': currentTime }
                },
                { session: currentSession }
            );

            // Update assignor's activity stats
            await User.findByIdAndUpdate(
                assignedBy,
                {
                    $inc: { 'activityStats.casesAssigned': 1 },
                    $set: { 'activityStats.lastActivityAt': currentTime }
                },
                { session: currentSession }
            );

            // Update patient status if patient exists
            if (updatedStudy.patient && updatedStudy.patient._id) {
                await Patient.findByIdAndUpdate(
                    updatedStudy.patient._id,
                    {
                        currentWorkflowStatus: 'assigned_to_doctor',
                        $addToSet: { 'activeStudyAssignedDoctors': assignedTo },
                        'computed.lastActivity': currentTime
                    },
                    { session: currentSession }
                );
            }

            // Calculate and update TAT
            try {
                const freshTAT = calculateStudyTAT(updatedStudy.toObject());
                await updateStudyTAT(studyId, freshTAT, currentSession);
                console.log(`✅ TAT recalculated after assignment - Total: ${freshTAT.totalTATFormatted}`);
            } catch (tatError) {
                console.error('⚠️ TAT calculation error (non-blocking):', tatError);
            }

            console.log(`✅ Assignment processed for ${assigneeRole} (ID: ${assignedTo}) to study ${studyId}`);
            console.log(`📊 Study category updated: UNASSIGNED → ASSIGNED`);
            console.log(`🔓 Study NOT locked after assignment (as requested)`);

            return {
                studyId: updatedStudy.studyInstanceUID || updatedStudy._id,
                bharatPacsId: updatedStudy.bharatPacsId,
                assigneeName: assignee.fullName || assignee.email,
                assigneeRole: assigneeRole,
                assignedAt: currentTime,
                priority: validatedPriority,
                category: updatedStudy.currentCategory,
                isLocked: false,
                message: `${assigneeRole} ${assignee.fullName || assignee.email} assigned to study successfully`
            };

        }); // End of session.withTransaction

        res.json({
            success: true,
            message: `Study assigned to ${result.assigneeName} successfully`,
            data: result
        });

    } catch (error) {
        console.error('❌ Assign study error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to assign study',
            error: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    } finally {
        if (session.inTransaction()) {
            console.warn('Transaction was not explicitly committed or aborted before finally block. Ending session.');
        }
        await session.endSession();
    }
};

// ✅ SIMPLIFIED: SINGLE ASSIGNMENT FUNCTION - CLEAR & REASSIGN
export const updateStudyAssignments = async (req, res) => {
    const session = await mongoose.startSession();

    try {
        const result = await session.withTransaction(async (currentSession) => {
            const { studyId } = req.params;
            const { assignedToIds = [], assigneeRole = 'radiologist', priority, notes, dueDate } = req.body;
            const assignedBy = req.user._id;

            console.log(`🔄 CLEARING & REASSIGNING study ${studyId}:`, {
                newAssignees: assignedToIds,
                role: assigneeRole,
                assignedBy: assignedBy
            });

         if (!['assignor', 'admin', 'super_admin'].includes(req.user.role)) {
    return res.status(403).json({
        success: false,
        message: 'Only assignor or admin can access unassigned studies'
    });
}


            // Validate assignee role
            if (!['radiologist', 'verifier'].includes(assigneeRole)) {
                throw new Error('Can only assign to radiologist or verifier');
            }

            // Find study
            let study = await DicomStudy.findOne({
                _id: studyId,
                organizationIdentifier: req.user.organizationIdentifier
            })
            .session(currentSession)
            .read('primary')
            .exec();

            if (!study) {
                throw new Error('Study not found');
            }

            // ✅ CHECK IF STUDY IS LOCKED - PREVENT ASSIGNMENT IF LOCKED
            if (study.studyLock?.isLocked) {
                throw new Error(`Study is locked by ${study.studyLock.lockedByName || 'another user'}. Cannot assign while locked.`);
            }

            const currentTime = new Date();
            const validatedPriority = validatePriority(priority || study.priority);
            const validatedStudyPriority = validatePriority(study.priority);

            // ✅ DETERMINE NEW CATEGORY BASED ON ASSIGNMENT
            const newCategory = assignedToIds.length > 0 ? 'ASSIGNED' : 'UNASSIGNED';
            const newWorkflowStatus = assignedToIds.length > 0 ? 'assigned_to_doctor' : 'pending_assignment';

            // ✅ STEP 1: COMPLETELY CLEAR ASSIGNMENT ARRAYS
            console.log('🧹 CLEARING ALL ASSIGNMENTS AND LASTASSIGNEDDOCTOR...');
            
            // Clear both assignment and lastAssignedDoctor arrays
            await DicomStudy.findByIdAndUpdate(
                studyId,
                {
                    $set: {
                        assignment: [], // ✅ Clear assignment array
                        lastAssignedDoctor: [], // ✅ Clear lastAssignedDoctor array
                        workflowStatus: newWorkflowStatus,
                        status: assignedToIds.length > 0 ? 'assigned' : 'unassigned',
                        priority: validatedStudyPriority,
                        currentCategory: newCategory // ✅ Update category
                    },
                    $push: {
                        statusHistory: {
                            status: 'assignments_cleared',
                            changedAt: currentTime,
                            changedBy: assignedBy,
                            note: 'All assignments cleared before reassignment'
                        },
                        // ✅ RECORD ACTION - CLEAR ASSIGNMENTS
                        actionLog: {
                            actionType: 'study_reassigned',
                            actionCategory: 'assignment',
                            performedBy: assignedBy,
                            performedByName: req.user.fullName || req.user.email,
                            performedByRole: req.user.role,
                            performedAt: currentTime,
                            assignmentInfo: {
                                assignmentType: 'clear_all',
                                previousAssignee: null,
                                priority: validatedPriority,
                                dueDate: null
                            },
                            notes: 'Cleared all assignments before reassignment',
                            ipAddress: req.ip,
                            userAgent: req.get('user-agent'),
                            sessionId: req.sessionID
                        }
                    }
                },
                { session: currentSession }
            );

            console.log(`✅ Cleared all existing assignments and lastAssignedDoctor`);

            // ✅ STEP 2: ADD NEW ASSIGNMENTS (if any)
            const newAssignments = [];

            if (assignedToIds.length > 0) {
                console.log(`➕ Adding ${assignedToIds.length} new assignments...`);
                
                // Verify all assignees exist and are valid
                const assignees = await User.find({
                    _id: { $in: assignedToIds },
                    organizationIdentifier: req.user.organizationIdentifier,
                    role: assigneeRole,
                    isActive: true
                })
                .session(currentSession)
                .read('primary')
                .exec();

                if (assignees.length !== assignedToIds.length) {
                    const foundIds = assignees.map(a => a._id.toString());
                    const missingIds = assignedToIds.filter(id => !foundIds.includes(id));
                    throw new Error(`Invalid or inactive ${assigneeRole}(s): ${missingIds.join(', ')}`);
                }

                // Create new assignment and lastAssignedDoctor objects
                const newAssignmentArray = [];
                const newLastAssignedDoctorArray = [];

                for (const assigneeId of assignedToIds) {
                    const assignee = assignees.find(a => a._id.toString() === assigneeId);
                    
                    // ✅ NEW ASSIGNMENT
                    const newAssignment = {
                        assignedTo: assigneeId,
                        assignedBy: assignedBy,
                        assignedAt: currentTime,
                        role: assigneeRole,
                        status: 'assigned',
                        priority: validatedPriority,
                        notes: notes || `Assigned via assignment update`,
                        dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 24 * 60 * 60 * 1000)
                    };

                    // ✅ NEW LASTASSIGNEDDOCTOR
                    const newLastAssignedDoctor = {
                        doctorId: assigneeId,
                        assignedAt: currentTime
                    };

                    newAssignmentArray.push(newAssignment);
                    newLastAssignedDoctorArray.push(newLastAssignedDoctor);
                    
                    newAssignments.push({
                        id: assigneeId,
                        name: assignee.fullName || assignee.email,
                        email: assignee.email
                    });
                }

                // ✅ PREPARE CATEGORY TRACKING FOR ASSIGNED
                const categoryTrackingAssigned = {
                    assignedAt: currentTime,
                    assignedTo: assignedToIds[0], // Primary assignee
                    assignedBy: assignedBy,
                    acceptedAt: null,
                    assignmentHistory: study.categoryTracking?.assigned?.assignmentHistory || []
                };

                // Add to assignment history
                categoryTrackingAssigned.assignmentHistory.push({
                    assignedTo: assignedToIds,
                    assignedAt: currentTime,
                    unassignedAt: null,
                    reason: notes || 'Bulk assignment update'
                });

                // ✅ ADD ALL NEW ASSIGNMENTS
                await DicomStudy.findByIdAndUpdate(
                    studyId,
                    {
                        $set: {
                            assignment: newAssignmentArray, // ✅ Set fresh assignment array
                            lastAssignedDoctor: newLastAssignedDoctorArray, // ✅ Set fresh lastAssignedDoctor array
                            currentCategory: 'ASSIGNED', // ✅ Update category
                            'categoryTracking.assigned': categoryTrackingAssigned
                        },
                        $push: {
                            statusHistory: {
                                status: 'assigned_to_doctor',
                                changedAt: currentTime,
                                changedBy: assignedBy,
                                note: `Assigned to ${newAssignments.length} ${assigneeRole}(s): ${newAssignments.map(a => a.name).join(', ')}`
                            },
                            // ✅ RECORD ACTION - NEW ASSIGNMENT
                            actionLog: {
                                actionType: 'study_assigned',
                                actionCategory: 'assignment',
                                performedBy: assignedBy,
                                performedByName: req.user.fullName || req.user.email,
                                performedByRole: req.user.role,
                                performedAt: currentTime,
                                targetUser: assignedToIds.length === 1 ? assignedToIds[0] : null,
                                targetUserName: newAssignments.map(a => a.name).join(', '),
                                targetUserRole: assigneeRole,
                                assignmentInfo: {
                                    assignmentType: 'bulk_assignment',
                                    previousAssignee: null,
                                    priority: validatedPriority,
                                    dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 24 * 60 * 60 * 1000)
                                },
                                notes: notes || `Assigned to ${newAssignments.length} ${assigneeRole}(s)`,
                                ipAddress: req.ip,
                                userAgent: req.get('user-agent'),
                                sessionId: req.sessionID
                            }
                        }
                    },
                    { session: currentSession }
                );

                console.log(`✅ Added ${newAssignments.length} new assignments`);
                console.log(`📊 Study category updated to: ASSIGNED`);

                // ✅ UPDATE USER ACTIVITY STATS
                await User.updateMany(
                    { _id: { $in: assignedToIds } },
                    {
                        $inc: { 'activityStats.casesAssigned': 1 },
                        $set: { 'activityStats.lastActivityAt': currentTime }
                    },
                    { session: currentSession }
                );

                await User.findByIdAndUpdate(
                    assignedBy,
                    {
                        $inc: { 'activityStats.casesAssigned': newAssignments.length },
                        $set: { 'activityStats.lastActivityAt': currentTime }
                    },
                    { session: currentSession }
                );
            } else {
                console.log(`📊 Study category updated to: UNASSIGNED (no assignments)`);
                
                // ✅ RECORD ACTION - UNASSIGNMENT
                await DicomStudy.findByIdAndUpdate(
                    studyId,
                    {
                        $push: {
                            actionLog: {
                                actionType: 'study_reassigned',
                                actionCategory: 'assignment',
                                performedBy: assignedBy,
                                performedByName: req.user.fullName || req.user.email,
                                performedByRole: req.user.role,
                                performedAt: currentTime,
                                assignmentInfo: {
                                    assignmentType: 'unassignment',
                                    previousAssignee: null,
                                    priority: null,
                                    dueDate: null
                                },
                                notes: 'Study unassigned - all assignments removed',
                                ipAddress: req.ip,
                                userAgent: req.get('user-agent'),
                                sessionId: req.sessionID
                            }
                        }
                    },
                    { session: currentSession }
                );
            }

            console.log(`✅ Assignment update completed for study ${studyId}:`, {
                cleared: 'all',
                added: newAssignments.length,
                newCategory: newCategory,
                newStatus: newWorkflowStatus,
                isLocked: false // ✅ Study NOT locked after assignment
            });

            return {
                studyId: studyId,
                clearedCount: 'all',
                assignedCount: newAssignments.length,
                newAssignments: newAssignments,
                category: newCategory,
                workflowStatus: newWorkflowStatus,
                isLocked: false,
                message: assignedToIds.length === 0 
                    ? 'Study unassigned - all assignments cleared'
                    : `Study assigned to ${newAssignments.length} ${assigneeRole}(s)`
            };

        }); // End of session.withTransaction

        res.json({
            success: true,
            message: result.message,
            data: result
        });

    } catch (error) {
        console.error('❌ Update study assignments error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to update study assignments',
            error: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    } finally {
        if (session.inTransaction()) {
            console.warn('Transaction was not explicitly committed or aborted before finally block. Ending session.');
        }
        await session.endSession();
    }
};

// ✅ BULK ASSIGN MULTIPLE STUDIES
export const bulkAssignStudies = async (req, res) => {
    const session = await mongoose.startSession();

    try {
        const result = await session.withTransaction(async (currentSession) => {
            const { studyIds, assignedTo, assigneeRole, priority, notes, dueDate } = req.body;
            const assignedBy = req.user._id;

            console.log(`🔄 Processing bulk assignment for ${assigneeRole} (ID: ${assignedTo}) to ${studyIds.length} studies`);

            // Only assignor can assign studies
            if (req.user.role !== 'assignor') {
                throw new Error('Only assignor can assign studies');
            }

            // Validate required fields
            if (!studyIds || !Array.isArray(studyIds) || studyIds.length === 0) {
                throw new Error('Study IDs array is required');
            }

            if (!assignedTo || !assigneeRole) {
                throw new Error('Assigned user and role are required');
            }

            // Verify assignee exists
            const assignee = await User.findOne({
                _id: assignedTo,
                organizationIdentifier: req.user.organizationIdentifier,
                role: assigneeRole,
                isActive: true
            })
            .session(currentSession)
            .read('primary')
            .exec();

            if (!assignee) {
                throw new Error(`${assigneeRole} not found or inactive`);
            }

            // ✅ VALIDATE PRIORITY FOR BULK ASSIGNMENT
            const validatedPriority = validatePriority(priority);
            const currentTime = new Date();

            const results = [];
            let successCount = 0;
            let failureCount = 0;

            for (const studyId of studyIds) {
                try {
                    // Find the study
                    let study = await DicomStudy.findOne({
                        _id: studyId,
                        organizationIdentifier: req.user.organizationIdentifier
                    })
                    .populate({
                        path: 'patient',
                        select: '_id patientID',
                        options: { session: currentSession }
                    })
                    .session(currentSession)
                    .read('primary')
                    .exec();

                    if (!study) {
                        results.push({
                            studyId,
                            success: false,
                            message: 'Study not found'
                        });
                        failureCount++;
                        continue;
                    }

                    // Ensure assignment array exists
                    if (!Array.isArray(study.assignment)) {
                        await DicomStudy.findByIdAndUpdate(
                            studyId,
                            { $set: { assignment: [] } },
                            { session: currentSession }
                        );
                        
                        // Re-fetch study
                        study = await DicomStudy.findOne({
                            _id: studyId,
                            organizationIdentifier: req.user.organizationIdentifier
                        })
                        .session(currentSession)
                        .read('primary')
                        .exec();
                    }

                    // Check if already assigned
                    const activeAssignment = study.assignment?.find(assign => 
                        assign.status === 'assigned' || assign.status === 'in_progress'
                    );

                    if (activeAssignment) {
                        results.push({
                            studyId,
                            success: false,
                            message: 'Already assigned'
                        });
                        failureCount++;
                        continue;
                    }

                    // ✅ VALIDATE STUDY PRIORITY
                    const validatedStudyPriority = validatePriority(study.priority);

                    // Create assignment
                    const newAssignment = {
                        assignedTo: assignedTo,
                        assignedBy: assignedBy,
                        assignedAt: currentTime,
                        role: assigneeRole,
                        status: 'assigned',
                        priority: validatedPriority,
                        notes: notes || '',
                        dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 24 * 60 * 60 * 1000)
                    };

                    const updatedStudy = await DicomStudy.findByIdAndUpdate(
                        studyId,
                        {
                            $push: {
                                assignment: newAssignment,
                                statusHistory: {
                                    status: 'assigned_to_doctor',
                                    changedAt: currentTime,
                                    changedBy: assignedBy,
                                    note: notes || `Bulk assigned to ${assignee.fullName || assignee.email} (${assigneeRole})`
                                }
                            },
                            $set: {
                                status: 'assigned',
                                priority: validatedStudyPriority,
                                workflowStatus: 'assigned_to_doctor'
                            }
                        },
                        { session: currentSession, new: true, runValidators: false }
                    );

                    // Update patient status if exists
                    if (updatedStudy.patient && updatedStudy.patient._id) {
                        await Patient.findByIdAndUpdate(
                            updatedStudy.patient._id,
                            {
                                currentWorkflowStatus: 'assigned_to_doctor',
                                $addToSet: { 'activeStudyAssignedDoctors': assignedTo },
                                'computed.lastActivity': currentTime
                            },
                            { session: currentSession }
                        );
                    }

                    results.push({
                        studyId,
                        success: true,
                        message: 'Assigned successfully'
                    });
                    successCount++;

                } catch (studyError) {
                    console.error(`❌ Error assigning study ${studyId}:`, studyError);
                    results.push({
                        studyId,
                        success: false,
                        message: studyError.message
                    });
                    failureCount++;
                }
            }

            // Update activity stats
            if (successCount > 0) {
                await User.findByIdAndUpdate(
                    assignedTo,
                    {
                        $inc: { 'activityStats.casesAssigned': successCount },
                        $set: { 'activityStats.lastActivityAt': currentTime }
                    },
                    { session: currentSession }
                );

                await User.findByIdAndUpdate(
                    assignedBy,
                    {
                        $inc: { 'activityStats.casesAssigned': successCount },
                        $set: { 'activityStats.lastActivityAt': currentTime }
                    },
                    { session: currentSession }
                );
            }

            // Clear caches
            cache.del(`assignor_workload_${assignedBy}`);
            cache.del(`${assigneeRole}_workload_${assignedTo}`);

            console.log(`✅ Bulk assignment completed: ${successCount} success, ${failureCount} failures`);

            return {
                assigneeName: assignee.fullName || assignee.email,
                assigneeRole: assigneeRole,
                successCount,
                failureCount,
                results
            };

        }); // End of session.withTransaction

        res.json({
            success: true,
            message: `Bulk assignment completed: ${result.successCount} assigned, ${result.failureCount} failed`,
            data: result
        });

    } catch (error) {
        console.error('❌ Bulk assign studies error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to bulk assign studies',
            error: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    } finally {
        if (session.inTransaction()) {
            console.warn('Transaction was not explicitly committed or aborted before finally block. Ending session.');
        }
        await session.endSession();
    }
};

// ✅ GET ASSIGNED STUDIES (for tracking)
export const getAssignedStudies = async (req, res) => {
    try {
        // Only assignor can access this
        if (req.user.role !== 'assignor') {
            return res.status(403).json({
                success: false,
                message: 'Only assignor can access assigned studies'
            });
        }

        const {
            assigneeRole = 'all',
            status = 'all',
            priority = 'all',
            limit = 50,
            page = 1
        } = req.query;

        // Build query
        let query = {
            organizationIdentifier: req.user.organizationIdentifier,
            assignment: { $exists: true, $not: { $size: 0 } }
        };

        // Filter by assignee role
        if (assigneeRole !== 'all') {
            query['assignment.role'] = assigneeRole;
        }

        // Filter by assignment status
        if (status !== 'all') {
            query['assignment.status'] = status;
        }

        // Filter by priority
        if (priority !== 'all') {
            query.priority = priority;
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const studies = await DicomStudy.find(query)
            .populate('assignment.assignedTo', 'fullName email role')
            .populate('assignment.assignedBy', 'fullName email')
            .populate('sourceLab', 'name identifier fullIdentifier contactPerson') // ✅ FIXED
            .sort({ 'assignment.assignedAt': -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        const totalStudies = await DicomStudy.countDocuments(query);

        res.json({
            success: true,
            data: studies,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalStudies / parseInt(limit)),
                totalStudies,
                studiesPerPage: parseInt(limit)
            }
        });

    } catch (error) {
        console.error('❌ Get assigned studies error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch assigned studies'
        });
    }
};

// ✅ REASSIGN STUDY
export const reassignStudy = async (req, res) => {
    try {
        const { studyId } = req.params;
        const { newAssignedTo, newAssigneeRole, reason } = req.body;

        // Only assignor can reassign studies
        if (req.user.role !== 'assignor') {
            return res.status(403).json({
                success: false,
                message: 'Only assignor can reassign studies'
            });
        }

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

        // Verify new assignee
        const newAssignee = await User.findOne({
            _id: newAssignedTo,
            organizationIdentifier: req.user.organizationIdentifier,
            role: newAssigneeRole,
            isActive: true
        });

        if (!newAssignee) {
            return res.status(404).json({
                success: false,
                message: `${newAssigneeRole} not found or inactive`
            });
        }

        // Mark current assignment as reassigned
        currentAssignment.status = 'reassigned';
        currentAssignment.reassignedAt = new Date();
        currentAssignment.reassignedBy = req.user._id;
        currentAssignment.reassignReason = reason || 'Reassigned by assignor';

        // Create new assignment
        const newAssignment = {
            assignedTo: newAssignedTo,
            assignedBy: req.user._id,
            assignedAt: new Date(),
            role: newAssigneeRole,
            status: 'assigned',
            priority: currentAssignment.priority,
            notes: `Reassigned from ${currentAssignment.role}`,
            dueDate: currentAssignment.dueDate
        };

        study.assignment.push(newAssignment);
        await study.save();

        console.log(`🔄 Study ${studyId} reassigned from ${currentAssignment.assignedTo} to ${newAssignedTo}`);

        res.json({
            success: true,
            message: 'Study reassigned successfully',
            data: study
        });

    } catch (error) {
        console.error('❌ Reassign study error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to reassign study'
        });
    }
};

// ✅ GET ASSIGNMENT ANALYTICS
export const getAssignmentAnalytics = async (req, res) => {
    try {
        // Only assignor can access analytics
        if (req.user.role !== 'assignor') {
            return res.status(403).json({
                success: false,
                message: 'Only assignor can access assignment analytics'
            });
        }

        const today = new Date();
        const startOfDay = new Date(today.setHours(0, 0, 0, 0));
        const endOfDay = new Date(today.setHours(23, 59, 59, 999));

        // Get overall statistics
        const [
            totalUnassigned,
            totalAssigned,
            todayAssigned,
            overdueStudies,
            workloadStats
        ] = await Promise.all([
            // Total unassigned studies
            DicomStudy.countDocuments({
                organizationIdentifier: req.user.organizationIdentifier,
                $or: [
                    { assignment: { $exists: false } },
                    { assignment: { $size: 0 } },
                    { 'assignment.status': { $in: ['cancelled', 'rejected'] } }
                ]
            }),

            // Total assigned studies
            DicomStudy.countDocuments({
                organizationIdentifier: req.user.organizationIdentifier,
                'assignment.status': { $in: ['assigned', 'in_progress'] }
            }),

            // Today's assignments
            DicomStudy.countDocuments({
                organizationIdentifier: req.user.organizationIdentifier,
                'assignment.assignedAt': { $gte: startOfDay, $lte: endOfDay },
                'assignment.assignedBy': req.user._id
            }),

            // Overdue studies
            DicomStudy.countDocuments({
                organizationIdentifier: req.user.organizationIdentifier,
                'assignment.status': { $in: ['assigned', 'in_progress'] },
                'assignment.dueDate': { $lt: new Date() }
            }),

            // Workload distribution
            DicomStudy.aggregate([
                {
                    $match: {
                        organizationIdentifier: req.user.organizationIdentifier,
                        'assignment.status': { $in: ['assigned', 'in_progress'] }
                    }
                },
                {
                    $unwind: '$assignment'
                },
                {
                    $match: {
                        'assignment.status': { $in: ['assigned', 'in_progress'] }
                    }
                },
                {
                    $lookup: {
                        from: 'users',
                        localField: 'assignment.assignedTo',
                        foreignField: '_id',
                        as: 'assignee'
                    }
                },
                {
                    $unwind: '$assignee'
                },
                {
                    $group: {
                        _id: {
                            userId: '$assignment.assignedTo',
                            role: '$assignment.role'
                        },
                        name: { $first: '$assignee.fullName' },
                        email: { $first: '$assignee.email' },
                        workload: { $sum: 1 },
                        urgentCases: {
                            $sum: {
                                $cond: [{ $eq: ['$priority', 'URGENT'] }, 1, 0]
                            }
                        },
                        statCases: {
                            $sum: {
                                $cond: [{ $eq: ['$priority', 'STAT'] }, 1, 0]
                            }
                        }
                    }
                },
                {
                    $sort: { workload: -1 }
                }
            ])
        ]);

        res.json({
            success: true,
            data: {
                overview: {
                    totalUnassigned,
                    totalAssigned,
                    todayAssigned,
                    overdueStudies
                },
                workloadDistribution: workloadStats
            }
        });

    } catch (error) {
        console.error('❌ Get assignment analytics error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch assignment analytics'
        });
    }
};

// // ✅ SIMPLIFIED: SINGLE ASSIGNMENT FUNCTION - CLEAR & REASSIGN
// export const updateStudyAssignments = async (req, res) => {
//     const session = await mongoose.startSession();

//     try {
//         const result = await session.withTransaction(async (currentSession) => {
//             const { studyId } = req.params;
//             const { assignedToIds = [], assigneeRole = 'radiologist', priority, notes, dueDate } = req.body;
//             const assignedBy = req.user._id;

//             console.log(`🔄 CLEARING & REASSIGNING study ${studyId}:`, {
//                 newAssignees: assignedToIds,
//                 role: assigneeRole,
//                 assignedBy: assignedBy
//             });

//             // Only assignor can manage assignments
//             if (req.user.role !== 'assignor') {
//                 throw new Error('Only assignor can manage study assignments');
//             }

//             // Validate assignee role
//             if (!['radiologist', 'verifier'].includes(assigneeRole)) {
//                 throw new Error('Can only assign to radiologist or verifier');
//             }

//             // Find study
//             let study = await DicomStudy.findOne({
//                 _id: studyId,
//                 organizationIdentifier: req.user.organizationIdentifier
//             })
//             .session(currentSession)
//             .read('primary')
//             .exec();

//             if (!study) {
//                 throw new Error('Study not found');
//             }

//             const currentTime = new Date();
//             const validatedPriority = validatePriority(priority || study.priority);
//             const validatedStudyPriority = validatePriority(study.priority);

//             // ✅ STEP 1: COMPLETELY CLEAR ASSIGNMENT ARRAYS
//             console.log('🧹 CLEARING ALL ASSIGNMENTS AND LASTASSIGNEDDOCTOR...');
            
//             // Clear both assignment and lastAssignedDoctor arrays
//             await DicomStudy.findByIdAndUpdate(
//                 studyId,
//                 {
//                     $set: {
//                         assignment: [], // ✅ Clear assignment array
//                         lastAssignedDoctor: [], // ✅ Clear lastAssignedDoctor array
//                         workflowStatus: assignedToIds.length > 0 ? 'assigned_to_doctor' : 'pending_assignment',
//                         status: assignedToIds.length > 0 ? 'assigned' : 'unassigned',
//                         priority: validatedStudyPriority
//                     },
//                     $push: {
//                         statusHistory: {
//                             status: 'assignments_cleared',
//                             changedAt: currentTime,
//                             changedBy: assignedBy,
//                             note: 'All assignments cleared before reassignment'
//                         }
//                     }
//                 },
//                 { session: currentSession }
//             );

//             console.log(`✅ Cleared all existing assignments and lastAssignedDoctor`);

//             // ✅ STEP 2: ADD NEW ASSIGNMENTS (if any)
//             const newAssignments = [];

//             if (assignedToIds.length > 0) {
//                 console.log(`➕ Adding ${assignedToIds.length} new assignments...`);
                
//                 // Verify all assignees exist and are valid
//                 const assignees = await User.find({
//                     _id: { $in: assignedToIds },
//                     organizationIdentifier: req.user.organizationIdentifier,
//                     role: assigneeRole,
//                     isActive: true
//                 })
//                 .session(currentSession)
//                 .read('primary')
//                 .exec();

//                 if (assignees.length !== assignedToIds.length) {
//                     const foundIds = assignees.map(a => a._id.toString());
//                     const missingIds = assignedToIds.filter(id => !foundIds.includes(id));
//                     throw new Error(`Invalid or inactive ${assigneeRole}(s): ${missingIds.join(', ')}`);
//                 }

//                 // Create new assignment and lastAssignedDoctor objects
//                 const newAssignmentArray = [];
//                 const newLastAssignedDoctorArray = [];

//                 for (const assigneeId of assignedToIds) {
//                     const assignee = assignees.find(a => a._id.toString() === assigneeId);
                    
//                     // ✅ NEW ASSIGNMENT
//                     const newAssignment = {
//                         assignedTo: assigneeId,
//                         assignedBy: assignedBy,
//                         assignedAt: currentTime,
//                         role: assigneeRole,
//                         status: 'assigned',
//                         priority: validatedPriority,
//                         notes: notes || `Assigned via assignment update`,
//                         dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 24 * 60 * 60 * 1000)
//                     };

//                     // ✅ NEW LASTASSIGNEDDOCTOR
//                     const newLastAssignedDoctor = {
//                         doctorId: assigneeId,
//                         assignedAt: currentTime
//                     };

//                     newAssignmentArray.push(newAssignment);
//                     newLastAssignedDoctorArray.push(newLastAssignedDoctor);
                    
//                     newAssignments.push({
//                         id: assigneeId,
//                         name: assignee.fullName || assignee.email,
//                         email: assignee.email
//                     });
//                 }

//                 // ✅ ADD ALL NEW ASSIGNMENTS
//                 await DicomStudy.findByIdAndUpdate(
//                     studyId,
//                     {
//                         $set: {
//                             assignment: newAssignmentArray, // ✅ Set fresh assignment array
//                             lastAssignedDoctor: newLastAssignedDoctorArray // ✅ Set fresh lastAssignedDoctor array
//                         },
//                         $push: {
//                             statusHistory: {
//                                 status: 'assigned_to_doctor',
//                                 changedAt: currentTime,
//                                 changedBy: assignedBy,
//                                 note: `Assigned to ${newAssignments.length} ${assigneeRole}(s): ${newAssignments.map(a => a.name).join(', ')}`
//                             }
//                         }
//                     },
//                     { session: currentSession }
//                 );

//                 console.log(`✅ Added ${newAssignments.length} new assignments`);

//                 // ✅ UPDATE USER ACTIVITY STATS
//                 await User.updateMany(
//                     { _id: { $in: assignedToIds } },
//                     {
//                         $inc: { 'activityStats.casesAssigned': 1 },
//                         $set: { 'activityStats.lastActivityAt': currentTime }
//                     },
//                     { session: currentSession }
//                 );

//                 await User.findByIdAndUpdate(
//                     assignedBy,
//                     {
//                         $inc: { 'activityStats.casesAssigned': newAssignments.length },
//                         $set: { 'activityStats.lastActivityAt': currentTime }
//                     },
//                     { session: currentSession }
//                 );
//             }

//             console.log(`✅ Assignment update completed for study ${studyId}:`, {
//                 cleared: 'all',
//                 added: newAssignments.length,
//                 newStatus: assignedToIds.length > 0 ? 'assigned_to_doctor' : 'pending_assignment'
//             });

//             return {
//                 studyId: studyId,
//                 clearedCount: 'all',
//                 assignedCount: newAssignments.length,
//                 newAssignments: newAssignments,
//                 workflowStatus: assignedToIds.length > 0 ? 'assigned_to_doctor' : 'pending_assignment',
//                 message: assignedToIds.length === 0 
//                     ? 'Study unassigned - all assignments cleared'
//                     : `Study assigned to ${newAssignments.length} ${assigneeRole}(s)`
//             };

//         }); // End of session.withTransaction

//         res.json({
//             success: true,
//             message: result.message,
//             data: result
//         });

//     } catch (error) {
//         console.error('❌ Update study assignments error:', error);
//         res.status(500).json({
//             success: false,
//             message: error.message || 'Failed to update study assignments',
//             error: process.env.NODE_ENV === 'development' ? error.stack : undefined
//         });
//     } finally {
//         if (session.inTransaction()) {
//             console.warn('Transaction was not explicitly committed or aborted before finally block. Ending session.');
//         }
//         await session.endSession();
//     }
// };



// ...existing code...

// ✅ NEW: BULK MULTI-STUDY ASSIGN - assign multiple studies to ONE doctor at once
export const bulkMultiStudyAssign = async (req, res) => {
    const session = await mongoose.startSession();
    try {
        const result = await session.withTransaction(async (currentSession) => {
            const { studyIds, assignedToId, assigneeRole = 'radiologist', priority, notes } = req.body;
            const assignedBy = req.user._id;

            if (!['assignor', 'admin', 'super_admin'].includes(req.user.role)) {
                throw new Error('Only assignor or admin can bulk assign studies');
            }
            if (!studyIds || !Array.isArray(studyIds) || studyIds.length === 0) {
                throw new Error('studyIds array is required');
            }
            if (!assignedToId) throw new Error('assignedToId is required');
            if (!['radiologist', 'verifier'].includes(assigneeRole)) {
                throw new Error('Can only assign to radiologist or verifier');
            }

            // Verify assignee
            const assignee = await User.findOne({
                _id: assignedToId,
                organizationIdentifier: req.user.organizationIdentifier,
                role: assigneeRole,
                isActive: true
            }).session(currentSession).read('primary');

            if (!assignee) throw new Error(`${assigneeRole} not found or inactive`);

            const currentTime = new Date();
            const validatedPriority = validatePriority(priority || 'NORMAL');

            // ✅ Fetch all studies in ONE query
            const studies = await DicomStudy.find({
                _id: { $in: studyIds },
                organizationIdentifier: req.user.organizationIdentifier
            }).session(currentSession).read('primary');

            const results = { success: [], failed: [], skipped: [] };

            // ✅ Process each study
            for (const study of studies) {
                try {
                    // Skip locked studies
                    if (study.studyLock?.isLocked) {
                        results.skipped.push({
                            studyId: study._id,
                            bharatPacsId: study.bharatPacsId,
                            reason: `Locked by ${study.studyLock.lockedByName}`
                        });
                        continue;
                    }

                    const validatedStudyPriority = validatePriority(study.priority);
                    const newAssignment = {
                        assignedTo: assignedToId,
                        assignedBy: assignedBy,
                        assignedAt: currentTime,
                        role: assigneeRole,
                        status: 'assigned',
                        priority: validatedPriority,
                        notes: notes || `Bulk assigned to ${assignee.fullName}`,
                        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000)
                    };

                    const categoryTrackingAssigned = {
                        assignedAt: currentTime,
                        assignedTo: assignedToId,
                        assignedBy: assignedBy,
                        acceptedAt: null,
                        assignmentHistory: [
                            ...(study.categoryTracking?.assigned?.assignmentHistory || []),
                            { assignedTo: assignedToId, assignedAt: currentTime, reason: 'Bulk assignment' }
                        ]
                    };

                    const actionLog = {
                        actionType: 'study_assigned',
                        actionCategory: 'assignment',
                        performedBy: assignedBy,
                        performedByName: req.user.fullName || req.user.email,
                        performedByRole: req.user.role,
                        performedAt: currentTime,
                        targetUser: assignedToId,
                        targetUserName: assignee.fullName || assignee.email,
                        targetUserRole: assigneeRole,
                        assignmentInfo: {
                            assignmentType: 'bulk_multi_study',
                            priority: validatedPriority
                        },
                        notes: notes || `Bulk assigned`,
                        ipAddress: req.ip,
                        userAgent: req.get('user-agent')
                    };

                    // ✅ Clear existing assignments + set new one atomically
                    await DicomStudy.findByIdAndUpdate(
                        study._id,
                        {
                            $set: {
                                assignment: [newAssignment],
                                lastAssignedDoctor: [{ doctorId: assignedToId, assignedAt: currentTime }],
                                workflowStatus: 'assigned_to_doctor',
                                currentCategory: 'ASSIGNED',
                                priority: validatedStudyPriority,
                                'categoryTracking.assigned': categoryTrackingAssigned
                            },
                            $push: {
                                statusHistory: {
                                    status: 'assigned_to_doctor',
                                    changedAt: currentTime,
                                    changedBy: assignedBy,
                                    note: `Bulk assigned to ${assignee.fullName}`
                                },
                                actionLog
                            }
                        },
                        { session: currentSession, runValidators: false }
                    );

                    results.success.push({
                        studyId: study._id,
                        bharatPacsId: study.bharatPacsId,
                        patientName: study.patientInfo?.patientName
                    });
                } catch (err) {
                    results.failed.push({
                        studyId: study._id,
                        bharatPacsId: study.bharatPacsId,
                        reason: err.message
                    });
                }
            }

            // ✅ Update assignee activity stats once
            if (results.success.length > 0) {
                await User.findByIdAndUpdate(
                    assignedToId,
                    {
                        $inc: { 'activityStats.casesAssigned': results.success.length },
                        $set: { 'activityStats.lastActivityAt': currentTime }
                    },
                    { session: currentSession }
                );
                await User.findByIdAndUpdate(
                    assignedBy,
                    {
                        $inc: { 'activityStats.casesAssigned': results.success.length },
                        $set: { 'activityStats.lastActivityAt': currentTime }
                    },
                    { session: currentSession }
                );
            }

            return {
                assigneeName: assignee.fullName || assignee.email,
                assigneeRole,
                totalRequested: studyIds.length,
                successCount: results.success.length,
                failedCount: results.failed.length,
                skippedCount: results.skipped.length,
                results
            };
        });

        res.json({
            success: true,
            message: `Bulk assigned ${result.successCount}/${result.totalRequested} studies to ${result.assigneeName}`,
            data: result
        });
    } catch (error) {
        console.error('❌ Bulk multi-study assign error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to bulk assign studies'
        });
    } finally {
        await session.endSession();
    }
};

// ...existing code...
// export default {
//     getUnassignedStudies,
//     getAvailableAssignees,
//     assignStudy,
//     bulkAssignStudies,
//     bulkMultiStudyAssign,   // ✅ NEW
//     getAssignedStudies,
//     reassignStudy,
//     getAssignmentAnalytics,
//     updateStudyAssignments
// };

export default {
    getUnassignedStudies,
    getAvailableAssignees,
    assignStudy,
    bulkAssignStudies,
    bulkMultiStudyAssign,
    getAssignedStudies,
    reassignStudy,
    getAssignmentAnalytics,
    updateStudyAssignments
};