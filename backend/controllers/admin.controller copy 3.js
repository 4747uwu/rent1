import mongoose from 'mongoose';
import DicomStudy from '../models/dicomStudyModel.js';
import User from '../models/userModel.js';
import Lab from '../models/labModel.js';
import { formatStudiesForWorklist } from '../utils/formatStudies.js';

// 🕐 CENTRALIZED: Date filtering utility function
const buildDateFilter = (req) => {
    const IST_OFFSET = 5.5 * 60 * 60 * 1000;
    let filterStartDate = null;
    let filterEndDate = null;

    if (req.query.quickDatePreset || req.query.dateFilter) {
        const preset = req.query.quickDatePreset || req.query.dateFilter;
        const now = Date.now();

        switch (preset) {
            case 'last24h':
                filterStartDate = new Date(now - 86400000);
                filterEndDate = new Date(now);
                break;

            case 'today':
                const currentTimeIST = new Date(Date.now() + IST_OFFSET);
                const todayStartIST = new Date(
                    currentTimeIST.getFullYear(),
                    currentTimeIST.getMonth(),
                    currentTimeIST.getDate(),
                    0, 0, 0, 0
                );
                const todayEndIST = new Date(
                    currentTimeIST.getFullYear(),
                    currentTimeIST.getMonth(),
                    currentTimeIST.getDate(),
                    23, 59, 59, 999
                );
                filterStartDate = new Date(todayStartIST.getTime() - IST_OFFSET);
                filterEndDate = new Date(todayEndIST.getTime() - IST_OFFSET);
                break;

            case 'yesterday':
                const currentTimeISTYesterday = new Date(Date.now() + IST_OFFSET);
                const yesterdayIST = new Date(currentTimeISTYesterday.getTime() - 86400000);
                const yesterdayStartIST = new Date(
                    yesterdayIST.getFullYear(),
                    yesterdayIST.getMonth(),
                    yesterdayIST.getDate(),
                    0, 0, 0, 0
                );
                const yesterdayEndIST = new Date(
                    yesterdayIST.getFullYear(),
                    yesterdayIST.getMonth(),
                    yesterdayIST.getDate(),
                    23, 59, 59, 999
                );
                filterStartDate = new Date(yesterdayStartIST.getTime() - IST_OFFSET);
                filterEndDate = new Date(yesterdayEndIST.getTime() - IST_OFFSET);
                break;

            case 'thisWeek':
                const currentTimeISTWeek = new Date(Date.now() + IST_OFFSET);
                const dayOfWeek = currentTimeISTWeek.getDay();
                const weekStartIST = new Date(
                    currentTimeISTWeek.getFullYear(),
                    currentTimeISTWeek.getMonth(),
                    currentTimeISTWeek.getDate() - dayOfWeek,
                    0, 0, 0, 0
                );
                const weekEndIST = new Date(currentTimeISTWeek.getTime());
                filterStartDate = new Date(weekStartIST.getTime() - IST_OFFSET);
                filterEndDate = new Date(weekEndIST.getTime() - IST_OFFSET);
                break;

            case 'thisMonth':
                const currentTimeISTMonth = new Date(Date.now() + IST_OFFSET);
                const monthStartIST = new Date(
                    currentTimeISTMonth.getFullYear(),
                    currentTimeISTMonth.getMonth(),
                    1,
                    0, 0, 0, 0
                );
                const monthEndIST = new Date(currentTimeISTMonth.getTime());
                filterStartDate = new Date(monthStartIST.getTime() - IST_OFFSET);
                filterEndDate = new Date(monthEndIST.getTime() - IST_OFFSET);
                break;

            case 'custom':
                if (req.query.customDateFrom || req.query.customDateTo) {
                    if (req.query.customDateFrom) {
                        const customStartIST = new Date(req.query.customDateFrom + 'T00:00:00');
                        filterStartDate = new Date(customStartIST.getTime() - IST_OFFSET);
                    }
                    if (req.query.customDateTo) {
                        const customEndIST = new Date(req.query.customDateTo + 'T23:59:59');
                        filterEndDate = new Date(customEndIST.getTime() - IST_OFFSET);
                    }
                } else {
                    filterStartDate = new Date(now - 86400000);
                    filterEndDate = new Date(now);
                }
                break;

            default:
                filterStartDate = new Date(now - 86400000);
                filterEndDate = new Date(now);
        }
    } else {
        const currentTimeISTDefault = new Date(Date.now() + IST_OFFSET);
        const todayStartISTDefault = new Date(
            currentTimeISTDefault.getFullYear(),
            currentTimeISTDefault.getMonth(),
            currentTimeISTDefault.getDate(),
            0, 0, 0, 0
        );
        const todayEndISTDefault = new Date(
            currentTimeISTDefault.getFullYear(),
            currentTimeISTDefault.getMonth(),
            currentTimeISTDefault.getDate(),
            23, 59, 59, 999
        );
        filterStartDate = new Date(todayStartISTDefault.getTime() - IST_OFFSET);
        filterEndDate = new Date(todayEndISTDefault.getTime() - IST_OFFSET);
    }

    return { filterStartDate, filterEndDate };
};

// 🔧 CENTRALIZED: Build base query with multi-tenant support
const buildBaseQuery = (req, user, workflowStatuses = null) => {
    const queryFilters = {};

    // 🏢 MULTI-TENANT: Organization-based filtering
    if (user.role !== 'super_admin') {
        queryFilters.organizationIdentifier = user.organizationIdentifier;
        console.log(`🏢 Multi-tenant filter applied for organization: ${user.organizationIdentifier}`);
    }

    // 🔧 WORKFLOW STATUS: Apply status filter if provided
    if (workflowStatuses && workflowStatuses.length > 0) {
        queryFilters.workflowStatus = workflowStatuses.length === 1 ? workflowStatuses[0] : { $in: workflowStatuses };
    }

    // 🕐 DATE FILTERING
    const { filterStartDate, filterEndDate } = buildDateFilter(req);
    if (filterStartDate || filterEndDate) {
        const dateField = req.query.dateType === 'StudyDate' ? 'studyDate' : 'createdAt';
        queryFilters[dateField] = {};
        if (filterStartDate) queryFilters[dateField].$gte = filterStartDate;
        if (filterEndDate) queryFilters[dateField].$lte = filterEndDate;
    }

    // 🔍 SEARCH FILTERING
    if (req.query.search) {
        queryFilters.$or = [
            { accessionNumber: { $regex: req.query.search, $options: 'i' } },
            { studyInstanceUID: { $regex: req.query.search, $options: 'i' } },
            { 'patientInfo.patientName': { $regex: req.query.search, $options: 'i' } },
            { 'patientInfo.patientID': { $regex: req.query.search, $options: 'i' } }
        ];
    }

    // 🔬 MODALITY FILTERING
    if (req.query.modality && req.query.modality !== 'all') {
        queryFilters.$or = [
            { modality: req.query.modality },
            { modalitiesInStudy: req.query.modality }
        ];
    }

    // 🏥 LAB FILTERING (within organization)
    if (req.query.labId && req.query.labId !== 'all' && mongoose.Types.ObjectId.isValid(req.query.labId)) {
        queryFilters.sourceLab = new mongoose.Types.ObjectId(req.query.labId);
    }

    // ⚡ PRIORITY FILTERING
    if (req.query.priority && req.query.priority !== 'all') {
        queryFilters['assignment.priority'] = req.query.priority;
    }

    // 🔢 STUDY INSTANCE UIDS
    if (req.query.StudyInstanceUIDs && req.query.StudyInstanceUIDs !== 'undefined') {
        const studyUIDs = req.query.StudyInstanceUIDs.split(',').map(uid => uid.trim()).filter(Boolean);
        if (studyUIDs.length > 0) {
            queryFilters.studyInstanceUID = { $in: studyUIDs };
        }
    }

    return queryFilters;
};


// ✅ UPDATED: Execute study query with population (like doctor controller)
const executeStudyQuery = async (queryFilters, limit) => {
    try {
        const totalStudies = await DicomStudy.countDocuments(queryFilters);
        
        // ✅ SAME POPULATION AS DOCTOR CONTROLLER
        const studies = await DicomStudy.find(queryFilters)
            .populate('assignment.assignedTo', 'fullName email role')
            .populate('assignment.assignedBy', 'fullName email role')
            .populate('reportInfo.verificationInfo.verifiedBy', 'fullName email role')
            .populate('sourceLab', 'name labName identifier location contactPerson')
            .populate('patient', 'patientID patientNameRaw firstName lastName age gender dateOfBirth')
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean(); // ✅ Keep lean for performance

        console.log(`📊 ADMIN QUERY EXECUTED: Found ${studies.length} studies, Total: ${totalStudies}`);

        return { studies, totalStudies };
    } catch (error) {
        console.error('❌ Error in executeStudyQuery:', error);
        throw error;
    }
};


// ✅ SIMPLIFIED: Build lookup maps for users and labs  
const buildLookupMaps = async (studies) => {
    try {
        // Extract unique user IDs and lab IDs from studies
        const userIds = new Set();
        const labIds = new Set();

        studies.forEach(study => {
            // Extract user IDs from assignments
            if (study.assignment && Array.isArray(study.assignment)) {
                study.assignment.forEach(assign => {
                    if (assign.assignedTo) userIds.add(assign.assignedTo.toString());
                    if (assign.assignedBy) userIds.add(assign.assignedBy.toString());
                });
            }
            
            // Extract user IDs from reportInfo
            if (study.reportInfo) {
                if (study.reportInfo.reportedBy) userIds.add(study.reportInfo.reportedBy.toString());
                if (study.reportInfo.verifiedBy) userIds.add(study.reportInfo.verifiedBy.toString());
            }

            // Extract lab IDs
            if (study.sourceLab) labIds.add(study.sourceLab.toString());
        });

        // Fetch users and labs in parallel
        const [users, labs] = await Promise.all([
            userIds.size > 0 ? User.find({ _id: { $in: Array.from(userIds) } })
                .select('firstName lastName email role organizationIdentifier')
                .lean() : [],
            labIds.size > 0 ? Lab.find({ _id: { $in: Array.from(labIds) } })
                .select('labName location organizationIdentifier')
                .lean() : []
        ]);

        // Create lookup maps
        const userMap = new Map();
        const labMap = new Map();

        users.forEach(user => {
            userMap.set(user._id.toString(), user);
        });

        labs.forEach(lab => {
            labMap.set(lab._id.toString(), lab);
        });

        return { userMap, labMap };
    } catch (error) {
        console.error('❌ Error building lookup maps:', error);
        return { userMap: new Map(), labMap: new Map() };
    }
};

// 🎯 GET DASHBOARD VALUES - Multi-tenant with assignment analytics for assignor
export const getValues = async (req, res) => {
    console.log(`🔍 Fetching dashboard values with filters: ${JSON.stringify(req.query)}`);
    try {
        const startTime = Date.now();
        const user = req.user;
        if (!user) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }

        // Build query filters with multi-tenant support
        const queryFilters = buildBaseQuery(req, user);
        
        console.log(`🔍 Dashboard query filters:`, JSON.stringify(queryFilters, null, 2));

        // Status mapping
        const statusCategories = {
            pending: ['new_study_received', 'pending_assignment', 'assigned_to_doctor', 'doctor_opened_report', 'report_in_progress',
                    'report_downloaded_radiologist', 'report_downloaded'],
            inprogress: ['report_finalized', 'report_drafted', 'report_uploaded', 'report_verified'],
            completed: ['final_report_downloaded']
        };

        // 🔥 STEP 2: Optimized aggregation pipeline with filters
        const pipeline = [
            { $match: queryFilters },
            {
                $group: {
                    _id: '$workflowStatus',
                    count: { $sum: 1 }
                }
            }
        ];

        // Execute queries with same filters
        const [statusCountsResult, totalFilteredResult] = await Promise.allSettled([
            DicomStudy.aggregate(pipeline).allowDiskUse(false),
            DicomStudy.countDocuments(queryFilters)
        ]);

        if (statusCountsResult.status === 'rejected') {
            throw new Error(`Status counts query failed: ${statusCountsResult.reason.message}`);
        }

        const statusCounts = statusCountsResult.value;
        const totalFiltered = totalFilteredResult.status === 'fulfilled' ? totalFilteredResult.value : 0;

        // Calculate category totals with filtered data
        let pending = 0;
        let inprogress = 0;
        let completed = 0;

        statusCounts.forEach(({ _id: status, count }) => {
            if (statusCategories.pending.includes(status)) {
                pending += count;
            } else if (statusCategories.inprogress.includes(status)) {
                inprogress += count;
            } else if (statusCategories.completed.includes(status)) {
                completed += count;
            }
        });

        const processingTime = Date.now() - startTime;
        console.log(`🎯 Dashboard values fetched in ${processingTime}ms with filters applied`);

        // Base response
        const response = {
            success: true,
            total: totalFiltered,
            pending: pending,
            inprogress: inprogress,
            completed: completed,
            performance: {
                queryTime: processingTime,
                fromCache: false,
                filtersApplied: Object.keys(queryFilters).length > 0
            }
        };

        // ✅ ADD ASSIGNMENT ANALYTICS FOR ASSIGNOR
        if (user.role === 'assignor') {
            // Get unassigned studies count
            const unassignedQuery = {
                ...queryFilters,
                $or: [
                    { assignment: { $exists: false } },
                    { assignment: { $size: 0 } },
                    { 
                        assignment: {
                            $not: {
                                $elemMatch: {
                                    status: { $in: ['assigned', 'in_progress'] }
                                }
                            }
                        }
                    }
                ]
            };

            const [unassignedResult, overdueResult] = await Promise.allSettled([
                DicomStudy.countDocuments(unassignedQuery),
                // Overdue studies (assigned but not completed within expected time)
                DicomStudy.countDocuments({
                    ...queryFilters,
                    'assignment.status': 'assigned',
                    'assignment.assignedAt': { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Older than 24 hours
                })
            ]);

            const totalUnassigned = unassignedResult.status === 'fulfilled' ? unassignedResult.value : 0;
            const overdueStudies = overdueResult.status === 'fulfilled' ? overdueResult.value : 0;

            response.overview = {
                totalUnassigned,
                totalAssigned: totalFiltered - totalUnassigned,
                overdueStudies
            };

            console.log(`📊 ASSIGNOR ANALYTICS: Unassigned: ${totalUnassigned}, Assigned: ${response.overview.totalAssigned}, Overdue: ${overdueStudies}`);
        }

        // Add filter summary for debugging/transparency
        if (process.env.NODE_ENV === 'development') {
            response.debug = {
                filtersApplied: queryFilters,
                rawStatusCounts: statusCounts,
                userRole: user.role,
                organization: user.organizationIdentifier
            };
        }

        res.status(200).json(response);

    } catch (error) {
        console.error('❌ Error fetching dashboard values:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error fetching dashboard statistics.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ✅ FIX: Use populated queries like doctor controller instead of manual lookups

// ✅ REMOVE: buildLookupMaps function since we're using populated data

// 🟡 GET PENDING STUDIES - Updated to use populated data
export const getPendingStudies = async (req, res) => {
    try {
        const startTime = Date.now();
        const limit = parseInt(req.query.limit) || 50;
        
        console.log('🟡 PENDING: Fetching pending studies for multi-tenant system');
        
        const user = req.user;
        if (!user) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }

        const pendingStatuses = ['new_study_received', 'pending_assignment'];
        const queryFilters = buildBaseQuery(req, user, pendingStatuses);
        
        console.log(`🔍 PENDING query filters:`, JSON.stringify(queryFilters, null, 2));

        // ✅ USE POPULATED QUERY - NO MANUAL LOOKUPS
        const { studies, totalStudies } = await executeStudyQuery(queryFilters, limit);

        // ✅ RETURN RAW STUDIES - Let frontend format them (like doctor controller)
        const processingTime = Date.now() - startTime;
        console.log(`✅ PENDING: Completed in ${processingTime}ms`);

        return res.status(200).json({
            success: true,
            count: studies.length,
            totalRecords: totalStudies,
            data: studies, // ✅ Raw populated studies (like doctor controller)
            pagination: {
                currentPage: 1,
                totalPages: Math.ceil(totalStudies / limit),
                totalRecords: totalStudies,
                limit: limit,
                hasNextPage: totalStudies > limit,
                hasPrevPage: false
            },
            metadata: {
                category: 'pending',
                statusesIncluded: pendingStatuses,
                organizationFilter: user.role !== 'super_admin' ? user.organizationIdentifier : 'all',
                userRole: user.role,
                processingTime: processingTime
            }
        });

    } catch (error) {
        console.error('❌ PENDING: Error fetching pending studies:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error fetching pending studies.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ✅ SAME PATTERN FOR OTHER ENDPOINTS
export const getInProgressStudies = async (req, res) => {
    try {
        const startTime = Date.now();
        const limit = parseInt(req.query.limit) || 50;
        
        const user = req.user;
        if (!user) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }

        const inProgressStatuses = [
            'assigned_to_doctor', 'doctor_opened_report', 'report_in_progress',
            'report_finalized', 'report_drafted', 'report_uploaded', 
            'report_downloaded_radiologist', 'report_downloaded', 'report_verified',
            'report_rejected'
        ];
        const queryFilters = buildBaseQuery(req, user, inProgressStatuses);

        // ✅ USE POPULATED QUERY
        const { studies, totalStudies } = await executeStudyQuery(queryFilters, limit);

        const processingTime = Date.now() - startTime;

        return res.status(200).json({
            success: true,
            count: studies.length,
            totalRecords: totalStudies,
            data: studies, // ✅ Raw populated studies
            pagination: {
                currentPage: 1,
                totalPages: Math.ceil(totalStudies / limit),
                totalRecords: totalStudies,
                limit: limit,
                hasNextPage: totalStudies > limit,
                hasPrevPage: false
            },
            metadata: {
                category: 'inprogress',
                statusesIncluded: inProgressStatuses,
                organizationFilter: user.role !== 'super_admin' ? user.organizationIdentifier : 'all',
                userRole: user.role,
                processingTime: processingTime
            }
        });

    } catch (error) {
        console.error('❌ IN-PROGRESS: Error fetching in-progress studies:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error fetching in-progress studies.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

export const getCompletedStudies = async (req, res) => {
    try {
        const startTime = Date.now();
        const limit = parseInt(req.query.limit) || 50;
        
        const user = req.user;
        if (!user) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }

        const completedStatuses = ['final_report_downloaded', 'archived'];
        const queryFilters = buildBaseQuery(req, user, completedStatuses);

        // ✅ USE POPULATED QUERY
        const { studies, totalStudies } = await executeStudyQuery(queryFilters, limit);

        const processingTime = Date.now() - startTime;

        return res.status(200).json({
            success: true,
            count: studies.length,
            totalRecords: totalStudies,
            data: studies, // ✅ Raw populated studies
            pagination: {
                currentPage: 1,
                totalPages: Math.ceil(totalStudies / limit),
                totalRecords: totalStudies,
                limit: limit,
                hasNextPage: totalStudies > limit,
                hasPrevPage: false
            },
            metadata: {
                category: 'completed',
                statusesIncluded: completedStatuses,
                organizationFilter: user.role !== 'super_admin' ? user.organizationIdentifier : 'all',
                userRole: user.role,
                processingTime: processingTime
            }
        });

    } catch (error) {
        console.error('❌ COMPLETED: Error fetching completed studies:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error fetching completed studies.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

export const getAllStudiesForAdmin = async (req, res) => {
    try {
        const startTime = Date.now();
        const limit = parseInt(req.query.limit) || 20;
        
        const user = req.user;
        if (!user) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }

        // Determine workflow statuses based on category
        let workflowStatuses = null;
        if (req.query.category && req.query.category !== 'all') {
            const statusMap = {
                'pending': ['new_study_received', 'pending_assignment'],
                'inprogress': [
                    'assigned_to_doctor', 'doctor_opened_report', 'report_in_progress',
                    'report_finalized', 'report_drafted', 'report_uploaded', 
                    'report_downloaded_radiologist', 'report_downloaded', 'report_verified',
                    'report_rejected'
                ],
                'completed': ['final_report_downloaded', 'archived']
            };
            workflowStatuses = statusMap[req.query.category];
        }

        const queryFilters = buildBaseQuery(req, user, workflowStatuses);

        // ✅ USE POPULATED QUERY
        const { studies, totalStudies } = await executeStudyQuery(queryFilters, limit);

        const processingTime = Date.now() - startTime;

        return res.status(200).json({
            success: true,
            count: studies.length,
            totalRecords: totalStudies,
            data: studies, // ✅ Raw populated studies
            pagination: {
                currentPage: 1,
                totalPages: Math.ceil(totalStudies / limit),
                totalRecords: totalStudies,
                limit: limit,
                hasNextPage: totalStudies > limit,
                hasPrevPage: false
            },
            metadata: {
                category: req.query.category || 'all',
                statusesIncluded: workflowStatuses || 'all',
                organizationFilter: user.role !== 'super_admin' ? user.organizationIdentifier : 'all',
                userRole: user.role,
                processingTime: processingTime,
                appliedFilters: {
                    modality: req.query.modality || 'all',
                    labId: req.query.labId || 'all',
                    priority: req.query.priority || 'all',
                    search: req.query.search || null,
                    dateType: req.query.dateType || 'createdAt'
                }
            }
        });

    } catch (error) {
        console.error('❌ ALL STUDIES: Error fetching studies:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error fetching studies.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

export default {
    getValues,
    getPendingStudies,
    getInProgressStudies,
    getCompletedStudies,
    getAllStudiesForAdmin
};