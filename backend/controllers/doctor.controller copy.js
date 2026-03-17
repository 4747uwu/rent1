import mongoose from 'mongoose';
import DicomStudy from '../models/dicomStudyModel.js';
import User from '../models/userModel.js';
import Lab from '../models/labModel.js';

// ✅ ENHANCED: Date filtering utility (same as admin controller)
const buildDateFilter = (req) => {
    const IST_OFFSET = 5.5 * 60 * 60 * 1000;
    let filterStartDate = null;
    let filterEndDate = null;

    if (req.query.quickDatePreset || req.query.dateFilter) {
        const preset = req.query.quickDatePreset || req.query.dateFilter;
        const now = Date.now();

        console.log('🗓️ DOCTOR DATE FILTER:', {
            preset,
            currentTime: new Date(now).toISOString(),
            timezone: 'IST (+5:30)'
        });

        switch (preset) {
            case 'last24h':
                filterStartDate = new Date(now - 86400000);
                filterEndDate = new Date(now);
                break;

            case 'today':
                const currentTimeIST = new Date(now + IST_OFFSET);
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
                const currentTimeISTYesterday = new Date(now + IST_OFFSET);
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

            case 'tomorrow':
                const currentTimeISTTomorrow = new Date(now + IST_OFFSET);
                const tomorrowIST = new Date(currentTimeISTTomorrow.getTime() + 86400000);
                const tomorrowStartIST = new Date(
                    tomorrowIST.getFullYear(),
                    tomorrowIST.getMonth(),
                    tomorrowIST.getDate(),
                    0, 0, 0, 0
                );
                const tomorrowEndIST = new Date(
                    tomorrowIST.getFullYear(),
                    tomorrowIST.getMonth(),
                    tomorrowIST.getDate(),
                    23, 59, 59, 999
                );
                filterStartDate = new Date(tomorrowStartIST.getTime() - IST_OFFSET);
                filterEndDate = new Date(tomorrowEndIST.getTime() - IST_OFFSET);
                break;

            case 'last2days':
                const currentTimeIST2Days = new Date(now + IST_OFFSET);
                const twoDaysAgoIST = new Date(currentTimeIST2Days.getTime() - (2 * 86400000));
                const twoDaysStartIST = new Date(
                    twoDaysAgoIST.getFullYear(),
                    twoDaysAgoIST.getMonth(),
                    twoDaysAgoIST.getDate(),
                    0, 0, 0, 0
                );
                filterStartDate = new Date(twoDaysStartIST.getTime() - IST_OFFSET);
                filterEndDate = new Date(currentTimeIST2Days.getTime() - IST_OFFSET);
                break;

            case 'last7days':
                const currentTimeIST7Days = new Date(now + IST_OFFSET);
                const sevenDaysAgoIST = new Date(currentTimeIST7Days.getTime() - (7 * 86400000));
                const sevenDaysStartIST = new Date(
                    sevenDaysAgoIST.getFullYear(),
                    sevenDaysAgoIST.getMonth(),
                    sevenDaysAgoIST.getDate(),
                    0, 0, 0, 0
                );
                filterStartDate = new Date(sevenDaysStartIST.getTime() - IST_OFFSET);
                filterEndDate = new Date(currentTimeIST7Days.getTime() - IST_OFFSET);
                break;

            case 'last30days':
                const currentTimeIST30Days = new Date(now + IST_OFFSET);
                const thirtyDaysAgoIST = new Date(currentTimeIST30Days.getTime() - (30 * 86400000));
                const thirtyDaysStartIST = new Date(
                    thirtyDaysAgoIST.getFullYear(),
                    thirtyDaysAgoIST.getMonth(),
                    thirtyDaysAgoIST.getDate(),
                    0, 0, 0, 0
                );
                filterStartDate = new Date(thirtyDaysStartIST.getTime() - IST_OFFSET);
                filterEndDate = new Date(currentTimeIST30Days.getTime() - IST_OFFSET);
                break;

            case 'thisWeek':
                const currentTimeISTWeek = new Date(now + IST_OFFSET);
                const dayOfWeek = currentTimeISTWeek.getDay();
                const weekStartIST = new Date(
                    currentTimeISTWeek.getFullYear(),
                    currentTimeISTWeek.getMonth(),
                    currentTimeISTWeek.getDate() - dayOfWeek,
                    0, 0, 0, 0
                );
                filterStartDate = new Date(weekStartIST.getTime() - IST_OFFSET);
                filterEndDate = new Date(now);
                break;

            case 'lastWeek':
                const currentTimeISTLastWeek = new Date(now + IST_OFFSET);
                const lastWeekEnd = new Date(currentTimeISTLastWeek.getTime() - (currentTimeISTLastWeek.getDay() * 86400000) - 86400000);
                lastWeekEnd.setHours(23, 59, 59, 999);
                const lastWeekStart = new Date(lastWeekEnd.getTime() - (6 * 86400000));
                lastWeekStart.setHours(0, 0, 0, 0);
                filterStartDate = new Date(lastWeekStart.getTime() - IST_OFFSET);
                filterEndDate = new Date(lastWeekEnd.getTime() - IST_OFFSET);
                break;

            case 'thisMonth':
                const currentTimeISTMonth = new Date(now + IST_OFFSET);
                const monthStartIST = new Date(
                    currentTimeISTMonth.getFullYear(),
                    currentTimeISTMonth.getMonth(),
                    1,
                    0, 0, 0, 0
                );
                filterStartDate = new Date(monthStartIST.getTime() - IST_OFFSET);
                filterEndDate = new Date(now);
                break;

            case 'lastMonth':
                const currentTimeISTLastMonth = new Date(now + IST_OFFSET);
                const lastMonthStartIST = new Date(
                    currentTimeISTLastMonth.getFullYear(),
                    currentTimeISTLastMonth.getMonth() - 1,
                    1,
                    0, 0, 0, 0
                );
                const lastMonthEndIST = new Date(
                    currentTimeISTLastMonth.getFullYear(),
                    currentTimeISTLastMonth.getMonth(),
                    0,
                    23, 59, 59, 999
                );
                filterStartDate = new Date(lastMonthStartIST.getTime() - IST_OFFSET);
                filterEndDate = new Date(lastMonthEndIST.getTime() - IST_OFFSET);
                break;

            case 'last3months':
                const currentTimeIST3Months = new Date(now + IST_OFFSET);
                const threeMonthsAgoIST = new Date(
                    currentTimeIST3Months.getFullYear(),
                    currentTimeIST3Months.getMonth() - 3,
                    1,
                    0, 0, 0, 0
                );
                filterStartDate = new Date(threeMonthsAgoIST.getTime() - IST_OFFSET);
                filterEndDate = new Date(currentTimeIST3Months.getTime() - IST_OFFSET);
                break;

            case 'last6months':
                const currentTimeIST6Months = new Date(now + IST_OFFSET);
                const sixMonthsAgoIST = new Date(
                    currentTimeIST6Months.getFullYear(),
                    currentTimeIST6Months.getMonth() - 6,
                    1,
                    0, 0, 0, 0
                );
                filterStartDate = new Date(sixMonthsAgoIST.getTime() - IST_OFFSET);
                filterEndDate = new Date(currentTimeIST6Months.getTime() - IST_OFFSET);
                break;

            case 'thisYear':
                const currentTimeISTYear = new Date(now + IST_OFFSET);
                const yearStartIST = new Date(
                    currentTimeISTYear.getFullYear(),
                    0,
                    1,
                    0, 0, 0, 0
                );
                filterStartDate = new Date(yearStartIST.getTime() - IST_OFFSET);
                filterEndDate = new Date(now);
                break;

            case 'lastYear':
                const currentTimeISTLastYear = new Date(now + IST_OFFSET);
                const lastYearStartIST = new Date(
                    currentTimeISTLastYear.getFullYear() - 1,
                    0,
                    1,
                    0, 0, 0, 0
                );
                const lastYearEndIST = new Date(
                    currentTimeISTLastYear.getFullYear() - 1,
                    11,
                    31,
                    23, 59, 59, 999
                );
                filterStartDate = new Date(lastYearStartIST.getTime() - IST_OFFSET);
                filterEndDate = new Date(lastYearEndIST.getTime() - IST_OFFSET);
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
                // ✅ Default to today if unknown preset
                const currentTimeISTDefault = new Date(now + IST_OFFSET);
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
    } else {
        // ✅ Default to today if no filter provided
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

    console.log('🎯 DOCTOR FINAL DATE RANGE (IST):', {
        preset: req.query.dateFilter || req.query.quickDatePreset,
        filterStartDate: filterStartDate?.toISOString(),
        filterEndDate: filterEndDate?.toISOString(),
        localStart: filterStartDate ? new Date(filterStartDate.getTime() + IST_OFFSET).toLocaleString() : null,
        localEnd: filterEndDate ? new Date(filterEndDate.getTime() + IST_OFFSET).toLocaleString() : null
    });

    return { filterStartDate, filterEndDate };
};

// ✅ DOCTOR-SPECIFIC: Build base query scoped to assigned studies (same pattern as admin)
const buildDoctorBaseQuery = (req, user, workflowStatuses = null) => {
    const queryFilters = {
        organizationIdentifier: user.organizationIdentifier,
        'assignment.assignedTo': new mongoose.Types.ObjectId(user._id)
    };

    // ✅ WORKFLOW STATUS
    if (workflowStatuses && workflowStatuses.length > 0) {
        queryFilters.workflowStatus = workflowStatuses.length === 1 ? workflowStatuses[0] : { $in: workflowStatuses };
    }

    // ✅ DATE FILTERING
    const { filterStartDate, filterEndDate } = buildDateFilter(req);
    if (filterStartDate || filterEndDate) {
        const dateField = req.query.dateType === 'StudyDate' ? 'studyDate' : 'createdAt';
        queryFilters[dateField] = {};
        if (filterStartDate) queryFilters[dateField].$gte = filterStartDate;
        if (filterEndDate) queryFilters[dateField].$lte = filterEndDate;
    }

    // ✅ SEARCH FILTERING
    if (req.query.search) {
        queryFilters.$or = [
            { bharatPacsId: { $regex: req.query.search, $options: 'i' } },
            { accessionNumber: { $regex: req.query.search, $options: 'i' } },
            { studyInstanceUID: { $regex: req.query.search, $options: 'i' } },
            { 'patientInfo.patientName': { $regex: req.query.search, $options: 'i' } },
            { 'patientInfo.patientID': { $regex: req.query.search, $options: 'i' } }
        ];
    }

    // ✅ MODALITY FILTERING
    if (req.query.modality && req.query.modality !== 'all') {
        queryFilters.$or = [
            { modality: req.query.modality },
            { modalitiesInStudy: req.query.modality }
        ];
    }

    // ✅ PRIORITY FILTERING
    if (req.query.priority && req.query.priority !== 'all') {
        queryFilters['assignment.priority'] = req.query.priority;
    }

    // ✅ STUDY INSTANCE UIDS
    if (req.query.StudyInstanceUIDs && req.query.StudyInstanceUIDs !== 'undefined') {
        const studyUIDs = req.query.StudyInstanceUIDs.split(',').map(uid => uid.trim()).filter(Boolean);
        if (studyUIDs.length > 0) {
            queryFilters.studyInstanceUID = { $in: studyUIDs };
        }
    }

    return queryFilters;
};

// ✅ EXECUTE STUDY QUERY WITH PAGINATION (same as admin)
const executeStudyQuery = async (queryFilters, limit, page = 1) => {
    try {
        const skip = (page - 1) * limit;
        const totalStudies = await DicomStudy.countDocuments(queryFilters);
        
        const studies = await DicomStudy.find(queryFilters)
            // Core references
            .populate('organization', 'name identifier contactEmail contactPhone address')
            .populate('patient', 'patientID patientNameRaw firstName lastName age gender dateOfBirth contactNumber')
            .populate('sourceLab', 'name labName identifier location contactPerson contactNumber')
            
            // Assignment references
            .populate('assignment.assignedTo', 'fullName firstName lastName email role organizationIdentifier')
            .populate('assignment.assignedBy', 'fullName firstName lastName email role')
            
            // Report and verification references
            .populate('reportInfo.verificationInfo.verifiedBy', 'fullName firstName lastName email role')
            .populate('currentReportStatus.lastReportedBy', 'fullName firstName lastName email role')
            
            // Category tracking references (for future use)
            .populate('categoryTracking.created.uploadedBy', 'fullName firstName lastName email role')
            .populate('categoryTracking.assigned.assignedTo', 'fullName firstName lastName email role')
            .populate('categoryTracking.assigned.assignedBy', 'fullName firstName lastName email role')
            
            // Lock references
            .populate('studyLock.lockedBy', 'fullName firstName lastName email role')
            
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        console.log(`📊 DOCTOR QUERY EXECUTED: Found ${studies.length} studies (page ${page}), Total: ${totalStudies}`);

        return { studies, totalStudies, currentPage: page };
    } catch (error) {
        console.error('❌ Error in executeStudyQuery:', error);
        throw error;
    }
};

// ✅ 1. GET DASHBOARD VALUES
// ✅ UPDATED: GET DASHBOARD VALUES - 5 categories
export const getValues = async (req, res) => {
    console.log(`🔍 Doctor dashboard: Fetching values with filters: ${JSON.stringify(req.query)}`);
    try {
        const startTime = Date.now();
        const user = req.user;
        
        if (!user) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const queryFilters = buildDoctorBaseQuery(req, user);
        
        console.log(`🔍 Doctor dashboard query filters:`, JSON.stringify(queryFilters, null, 2));

        // ✅ UPDATED: 4 status categories (pending, completed, accepted, rejected)
        const statusCategories = {
            pending: ['new_study_received', 'pending_assignment', 'assigned_to_doctor'],
            completed: ['doctor_opened_report', 'report_in_progress', 'report_drafted', 'report_finalized', 'final_report_downloaded', 'archived'],
            accepted: ['report_verified'],
            rejected: ['report_rejected']
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
            console.error('❌ Status counts query failed');
        }

        const statusCounts = statusCountsResult.value || [];
        const totalFiltered = totalFilteredResult.status === 'fulfilled' ? totalFilteredResult.value : 0;

        // ✅ UPDATED: Calculate all 4 categories
        let pending = 0;
        let completed = 0;
        let accepted = 0;
        let rejected = 0;

        statusCounts.forEach(({ _id: status, count }) => {
            if (statusCategories.pending.includes(status)) pending += count;
            if (statusCategories.completed.includes(status)) completed += count;
            if (statusCategories.accepted.includes(status)) accepted += count;
            if (statusCategories.rejected.includes(status)) rejected += count;
        });

        const processingTime = Date.now() - startTime;
        console.log(`🎯 Doctor dashboard values fetched in ${processingTime}ms`);

        const response = {
            success: true,
            total: totalFiltered,
            pending,
            completed,
            accepted,
            rejected,
            performance: {
                queryTime: processingTime,
                fromCache: false,
                filtersApplied: Object.keys(queryFilters).length > 0
            }
        };

        if (process.env.NODE_ENV === 'development') {
            response._debug = {
                statusCounts,
                queryFilters,
                statusCategories
            };
        }

        res.status(200).json(response);

    } catch (error) {
        console.error('❌ Error fetching doctor dashboard values:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error fetching doctor dashboard statistics.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ✅ 2. GET PENDING STUDIES WITH PAGINATION
export const getPendingStudies = async (req, res) => {
    try {
        const startTime = Date.now();
        const limit = parseInt(req.query.limit) || 50;
        const page = parseInt(req.query.page) || 1;
        
        console.log(`🟡 DOCTOR PENDING: Fetching - Page: ${page}, Limit: ${limit}`);
        
        const user = req.user;
        if (!user) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }

        const pendingStatuses = ['new_study_received', 'pending_assignment', 'assigned_to_doctor', 'history_created'];
        const queryFilters = buildDoctorBaseQuery(req, user, pendingStatuses);
        
        console.log(`🔍 DOCTOR PENDING query filters:`, JSON.stringify(queryFilters, null, 2));

        const { studies, totalStudies, currentPage } = await executeStudyQuery(queryFilters, limit, page);

        const processingTime = Date.now() - startTime;
        console.log(`✅ DOCTOR PENDING: Page ${currentPage} - ${studies.length} studies (Total: ${totalStudies})`);

        return res.status(200).json({
            success: true,
            count: studies.length,
            totalRecords: totalStudies,
            data: studies,
            pagination: {
                currentPage: currentPage,
                totalPages: Math.ceil(totalStudies / limit),
                totalRecords: totalStudies,
                limit: limit,
                hasNextPage: currentPage < Math.ceil(totalStudies / limit),
                hasPrevPage: currentPage > 1
            },
            metadata: {
                category: 'pending',
                statusesIncluded: pendingStatuses,
                organizationFilter: user.organizationIdentifier,
                userRole: user.role,
                processingTime: processingTime
            }
        });

    } catch (error) {
        console.error('❌ DOCTOR PENDING: Error fetching pending studies:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error fetching pending studies.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ✅ 3. GET IN-PROGRESS STUDIES WITH PAGINATION
export const getInProgressStudies = async (req, res) => {
    try {
        const startTime = Date.now();
        const limit = parseInt(req.query.limit) || 50;
        const page = parseInt(req.query.page) || 1;
        
        console.log(`🔵 DOCTOR IN-PROGRESS: Fetching - Page: ${page}, Limit: ${limit}`);
        
        const user = req.user;
        if (!user) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }

        const inProgressStatuses = [
            'doctor_opened_report', 'report_in_progress', 'report_drafted'
        ];
        const queryFilters = buildDoctorBaseQuery(req, user, inProgressStatuses);

        const { studies, totalStudies, currentPage } = await executeStudyQuery(queryFilters, limit, page);

        const processingTime = Date.now() - startTime;
        console.log(`✅ DOCTOR IN-PROGRESS: Page ${currentPage} - ${studies.length} studies (Total: ${totalStudies})`);

        return res.status(200).json({
            success: true,
            count: studies.length,
            totalRecords: totalStudies,
            data: studies,
            pagination: {
                currentPage: currentPage,
                totalPages: Math.ceil(totalStudies / limit),
                totalRecords: totalStudies,
                limit: limit,
                hasNextPage: currentPage < Math.ceil(totalStudies / limit),
                hasPrevPage: currentPage > 1
            },
            metadata: {
                category: 'inprogress',
                statusesIncluded: inProgressStatuses,
                organizationFilter: user.organizationIdentifier,
                userRole: user.role,
                processingTime: processingTime
            }
        });

    } catch (error) {
        console.error('❌ DOCTOR IN-PROGRESS: Error fetching in-progress studies:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error fetching in-progress studies.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ✅ 4. GET COMPLETED STUDIES WITH PAGINATION
// ✅ UPDATED: GET COMPLETED STUDIES - Now includes all completed statuses
export const getCompletedStudies = async (req, res) => {
    try {
        const startTime = Date.now();
        const limit = parseInt(req.query.limit) || 50;
        const page = parseInt(req.query.page) || 1;
        
        console.log(`🟢 DOCTOR COMPLETED: Fetching - Page: ${page}, Limit: ${limit}`);
        
        const user = req.user;
        if (!user) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        // ✅ UPDATED: Expanded completed statuses to include all report stages
        const completedStatuses = [
            'doctor_opened_report',      // Started reporting
            'report_in_progress',        // Actively reporting  
            'report_drafted',            // Draft saved
            'report_finalized',          // Report finalized
            'report_verified',           // Verified by verifier
            'report_rejected',           // Rejected by verifier
            'final_report_downloaded',   // Downloaded
            'archived'                   // Archived
        ];
        const queryFilters = buildDoctorBaseQuery(req, user, completedStatuses);

        const { studies, totalStudies, currentPage } = await executeStudyQuery(queryFilters, limit, page);

        const processingTime = Date.now() - startTime;
        console.log(`✅ DOCTOR COMPLETED: Page ${currentPage} - ${studies.length} studies (Total: ${totalStudies})`);

        return res.status(200).json({
            success: true,
            count: studies.length,
            totalRecords: totalStudies,
            data: studies,
            pagination: {
                currentPage: currentPage,
                totalPages: Math.ceil(totalStudies / limit),
                totalRecords: totalStudies,
                limit: limit,
                hasNextPage: currentPage < Math.ceil(totalStudies / limit),
                hasPrevPage: currentPage > 1
            },
            metadata: {
                category: 'completed',
                statusesIncluded: completedStatuses,
                organizationFilter: user.organizationIdentifier,
                userRole: user.role,
                processingTime: processingTime
            }
        });

    } catch (error) {
        console.error('❌ DOCTOR COMPLETED: Error fetching completed studies:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error fetching completed studies.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ✅ 5. GET ALL STUDIES WITH PAGINATION
export const getAllStudiesForDoctor = async (req, res) => {
    try {
        const startTime = Date.now();
        const limit = parseInt(req.query.limit) || 50;
        const page = parseInt(req.query.page) || 1;
        
        console.log(`🔍 [DOCTOR ALL STUDIES] Fetching - Page: ${page}, Limit: ${limit}`);
        
        const user = req.user;
        if (!user) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }

        // ✅ Determine workflow statuses based on category
        let workflowStatuses = null;
        if (req.query.category && req.query.category !== 'all') {
            const statusMap = {
                'pending': ['new_study_received', 'pending_assignment', 'assigned_to_doctor'],
                'inprogress': ['doctor_opened_report', 'report_in_progress', 'report_drafted'],
                'completed': ['report_finalized', 'final_report_downloaded', 'archived']
            };
            workflowStatuses = statusMap[req.query.category];
        }

        const queryFilters = buildDoctorBaseQuery(req, user, workflowStatuses);

        const { studies, totalStudies, currentPage } = await executeStudyQuery(queryFilters, limit, page);

        const processingTime = Date.now() - startTime;
        console.log(`✅ [DOCTOR ALL STUDIES]: Page ${currentPage} - ${studies.length} studies (Total: ${totalStudies})`);

        return res.status(200).json({
            success: true,
            count: studies.length,
            totalRecords: totalStudies,
            data: studies,
            pagination: {
                currentPage: currentPage,
                totalPages: Math.ceil(totalStudies / limit),
                totalRecords: totalStudies,
                limit: limit,
                hasNextPage: currentPage < Math.ceil(totalStudies / limit),
                hasPrevPage: currentPage > 1
            },
            metadata: {
                category: req.query.category || 'all',
                statusesIncluded: workflowStatuses || 'all',
                organizationFilter: user.organizationIdentifier,
                userRole: user.role,
                processingTime: processingTime,
                appliedFilters: {
                    modality: req.query.modality || 'all',
                    priority: req.query.priority || 'all',
                    search: req.query.search || null,
                    dateType: req.query.dateType || 'createdAt'
                }
            }
        });

    } catch (error) {
        console.error('❌ DOCTOR ALL: Error fetching all studies:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error fetching studies.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ✅ 6. CREATE TYPIST (unchanged)
export const createTypist = async (req, res) => {
    try {
        const doctor = req.user;
        
        if (!['radiologist', 'doctor_account'].includes(doctor.role)) {
            return res.status(403).json({
                success: false,
                message: 'Only doctors can create typists'
            });
        }

        const { fullName, email, password, roleConfig } = req.body;

        if (!fullName || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Full name, email, and password are required'
            });
        }

        const existingUser = await User.findOne({ 
            email: email.toLowerCase(),
            organizationIdentifier: doctor.organizationIdentifier 
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: 'Email already exists in this organization'
            });
        }

        const username = email.split('@')[0].toLowerCase();

        const typist = new User({
            fullName: fullName.trim(),
            email: email.toLowerCase(),
            username: username,
            password: password,
            role: 'typist',
            organization: doctor.organization,
            organizationIdentifier: doctor.organizationIdentifier,
            hierarchy: {
                createdBy: doctor._id,
                parentUser: doctor._id,
                organizationType: doctor.hierarchy?.organizationType || 'teleradiology_company'
            },
            roleConfig: {
                linkedRadiologist: doctor._id,
                ...roleConfig
            },
            createdBy: doctor._id,
            isActive: true
        });

        await typist.save();

        await User.findByIdAndUpdate(doctor._id, {
            $push: { 'hierarchy.childUsers': typist._id }
        });

        const typistResponse = typist.toObject();
        delete typistResponse.password;

        console.log(`✅ TYPIST CREATED: ${typist.fullName} (${typist.email}) by doctor ${doctor.fullName}`);

        return res.status(201).json({
            success: true,
            message: 'Typist created successfully',
            typist: typistResponse
        });

    } catch (error) {
        console.error('❌ Error creating typist:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to create typist',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ✅ NEW: GET ACCEPTED STUDIES (report_verified)
export const getAcceptedStudies = async (req, res) => {
    try {
        const startTime = Date.now();
        const limit = parseInt(req.query.limit) || 50;
        const page = parseInt(req.query.page) || 1;
        
        console.log(`✅ DOCTOR ACCEPTED: Fetching - Page: ${page}, Limit: ${limit}`);
        
        const user = req.user;
        if (!user) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const acceptedStatuses = ['report_verified'];
        const queryFilters = buildDoctorBaseQuery(req, user, acceptedStatuses);

        const { studies, totalStudies, currentPage } = await executeStudyQuery(queryFilters, limit, page);

        const processingTime = Date.now() - startTime;
        console.log(`✅ DOCTOR ACCEPTED: Page ${currentPage} - ${studies.length} studies (Total: ${totalStudies})`);

        return res.status(200).json({
            success: true,
            count: studies.length,
            totalRecords: totalStudies,
            data: studies,
            pagination: {
                currentPage: currentPage,
                totalPages: Math.ceil(totalStudies / limit),
                totalRecords: totalStudies,
                limit: limit,
                hasNextPage: currentPage < Math.ceil(totalStudies / limit),
                hasPrevPage: currentPage > 1
            },
            metadata: {
                category: 'accepted',
                statusesIncluded: acceptedStatuses,
                organizationFilter: user.organizationIdentifier,
                userRole: user.role,
                processingTime: processingTime
            }
        });

    } catch (error) {
        console.error('❌ DOCTOR ACCEPTED: Error fetching accepted studies:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error fetching accepted studies.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ✅ NEW: GET REJECTED STUDIES (report_rejected)
export const getRejectedStudies = async (req, res) => {
    try {
        const startTime = Date.now();
        const limit = parseInt(req.query.limit) || 50;
        const page = parseInt(req.query.page) || 1;
        
        console.log(`❌ DOCTOR REJECTED: Fetching - Page: ${page}, Limit: ${limit}`);
        
        const user = req.user;
        if (!user) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const rejectedStatuses = ['report_rejected'];
        const queryFilters = buildDoctorBaseQuery(req, user, rejectedStatuses);

        const { studies, totalStudies, currentPage } = await executeStudyQuery(queryFilters, limit, page);

        const processingTime = Date.now() - startTime;
        console.log(`✅ DOCTOR REJECTED: Page ${currentPage} - ${studies.length} studies (Total: ${totalStudies})`);

        return res.status(200).json({
            success: true,
            count: studies.length,
            totalRecords: totalStudies,
            data: studies,
            pagination: {
                currentPage: currentPage,
                totalPages: Math.ceil(totalStudies / limit),
                totalRecords: totalStudies,
                limit: limit,
                hasNextPage: currentPage < Math.ceil(totalStudies / limit),
                hasPrevPage: currentPage > 1
            },
            metadata: {
                category: 'rejected',
                statusesIncluded: rejectedStatuses,
                organizationFilter: user.organizationIdentifier,
                userRole: user.role,
                processingTime: processingTime
            }
        });

    } catch (error) {
        console.error('❌ DOCTOR REJECTED: Error fetching rejected studies:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error fetching rejected studies.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

export default {
    getValues,
    getPendingStudies,
    getInProgressStudies,
    getCompletedStudies,
    getAcceptedStudies,     // ✅ NEW
    getRejectedStudies,     // ✅ NEW
    getAllStudiesForDoctor,
    createTypist
};