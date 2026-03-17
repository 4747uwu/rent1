import mongoose from 'mongoose';
import DicomStudy from '../models/dicomStudyModel.js';
import Lab from '../models/labModel.js';


// 🕐 ENHANCED: Date filtering utility function with more options
const buildDateFilter = (req) => {
    const IST_OFFSET = 5.5 * 60 * 60 * 1000;
    let filterStartDate = null;
    let filterEndDate = null;
    let preset = null;

    if (req.query.quickDatePreset || req.query.dateFilter) {
        const preset = req.query.quickDatePreset || req.query.dateFilter;
        const now = Date.now();

        console.log('🗓️ DATE FILTER DEBUG:', {
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

            // ✅ NEW: Tomorrow filter
            case 'tomorrow':
                const currentTimeISTTomorrow = new Date(Date.now() + IST_OFFSET);
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

            // ✅ NEW: Last 2 days
            case 'last2days':
                const currentTimeIST2Days = new Date(Date.now() + IST_OFFSET);
                const twoDaysAgoIST = new Date(currentTimeIST2Days.getTime() - (2 * 86400000));
                const twoDaysStartIST = new Date(
                    twoDaysAgoIST.getFullYear(),
                    twoDaysAgoIST.getMonth(),
                    twoDaysAgoIST.getDate(),
                    0, 0, 0, 0
                );
                const currentEndIST = new Date(currentTimeIST2Days.getTime());
                filterStartDate = new Date(twoDaysStartIST.getTime() - IST_OFFSET);
                filterEndDate = new Date(currentEndIST.getTime() - IST_OFFSET);
                break;

            // ✅ NEW: Last 7 days
            case 'last7days':
                const currentTimeIST7Days = new Date(Date.now() + IST_OFFSET);
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

            // ✅ NEW: Last 30 days
            case 'last30days':
                const currentTimeIST30Days = new Date(Date.now() + IST_OFFSET);
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

            // ✅ NEW: Last week
            case 'lastWeek':
                const currentTimeISTLastWeek = new Date(Date.now() + IST_OFFSET);
                const lastWeekEnd = new Date(currentTimeISTLastWeek.getTime() - (currentTimeISTLastWeek.getDay() * 86400000) - 86400000);
                lastWeekEnd.setHours(23, 59, 59, 999);
                const lastWeekStart = new Date(lastWeekEnd.getTime() - (6 * 86400000));
                lastWeekStart.setHours(0, 0, 0, 0);
                filterStartDate = new Date(lastWeekStart.getTime() - IST_OFFSET);
                filterEndDate = new Date(lastWeekEnd.getTime() - IST_OFFSET);
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

            // ✅ NEW: Last month
            case 'lastMonth':
                const currentTimeISTLastMonth = new Date(Date.now() + IST_OFFSET);
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

            // ✅ NEW: Last 3 months
            case 'last3months':
                const currentTimeIST3Months = new Date(Date.now() + IST_OFFSET);
                const threeMonthsAgoIST = new Date(
                    currentTimeIST3Months.getFullYear(),
                    currentTimeIST3Months.getMonth() - 3,
                    1,
                    0, 0, 0, 0
                );
                filterStartDate = new Date(threeMonthsAgoIST.getTime() - IST_OFFSET);
                filterEndDate = new Date(currentTimeIST3Months.getTime() - IST_OFFSET);
                break;

            // ✅ NEW: Last 6 months
            case 'last6months':
                const currentTimeIST6Months = new Date(Date.now() + IST_OFFSET);
                const sixMonthsAgoIST = new Date(
                    currentTimeIST6Months.getFullYear(),
                    currentTimeIST6Months.getMonth() - 6,
                    1,
                    0, 0, 0, 0
                );
                filterStartDate = new Date(sixMonthsAgoIST.getTime() - IST_OFFSET);
                filterEndDate = new Date(currentTimeIST6Months.getTime() - IST_OFFSET);
                break;

            // ✅ NEW: This year
            case 'thisYear':
                const currentTimeISTYear = new Date(Date.now() + IST_OFFSET);
                const yearStartIST = new Date(
                    currentTimeISTYear.getFullYear(),
                    0,
                    1,
                    0, 0, 0, 0
                );
                filterStartDate = new Date(yearStartIST.getTime() - IST_OFFSET);
                filterEndDate = new Date(currentTimeISTYear.getTime() - IST_OFFSET);
                break;

            // ✅ NEW: Last year
            case 'lastYear':
                const currentTimeISTLastYear = new Date(Date.now() + IST_OFFSET);
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
                // Default to today if no valid preset
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
    } else {
        // Default to today if no filter provided
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

    console.log('🎯 FINAL DATE RANGE (IST):', {
        preset,
        filterStartDate: filterStartDate?.toISOString(),
        filterEndDate: filterEndDate?.toISOString(),
        localStart: filterStartDate ? new Date(filterStartDate.getTime() + IST_OFFSET).toLocaleString() : null,
        localEnd: filterEndDate ? new Date(filterEndDate.getTime() + IST_OFFSET).toLocaleString() : null
    });

    return { filterStartDate, filterEndDate };
};
// ✅ BUILD LAB-SPECIFIC QUERY
const buildLabQuery = (req, user, workflowStatuses = null) => {
    const queryFilters = {};

    // ✅ CRITICAL: Filter by user's lab
    if (!user.lab) {
        throw new Error('User does not belong to any lab');
    }
    queryFilters.sourceLab = user.lab;

    // Multi-tenant: Organization filter
    if (user.organizationIdentifier) {
        queryFilters.organizationIdentifier = user.organizationIdentifier;
    }

    // Workflow status filter
    if (workflowStatuses && workflowStatuses.length > 0) {
        queryFilters.workflowStatus = workflowStatuses.length === 1 ? workflowStatuses[0] : { $in: workflowStatuses };
    }

    // Date filtering (reuse from admin controller)
    const { filterStartDate, filterEndDate } = buildDateFilter(req);
    if (filterStartDate || filterEndDate) {
        const dateField = req.query.dateType === 'StudyDate' ? 'studyDate' : 'createdAt';
        queryFilters[dateField] = {};
        if (filterStartDate) queryFilters[dateField].$gte = filterStartDate;
        if (filterEndDate) queryFilters[dateField].$lte = filterEndDate;
    }

    // Search filtering
    if (req.query.search) {
        queryFilters.$or = [
            { accessionNumber: { $regex: req.query.search, $options: 'i' } },
            { studyInstanceUID: { $regex: req.query.search, $options: 'i' } },
            { 'patientInfo.patientName': { $regex: req.query.search, $options: 'i' } },
            { 'patientInfo.patientID': { $regex: req.query.search, $options: 'i' } }
        ];
    }

    // Modality filtering
    if (req.query.modality && req.query.modality !== 'all') {
        queryFilters.$or = [
            { modality: req.query.modality },
            { modalitiesInStudy: req.query.modality }
        ];
    }

    // Priority filtering
    if (req.query.priority && req.query.priority !== 'all') {
        queryFilters['assignment.priority'] = req.query.priority;
    }

    console.log('🔧 LAB QUERY FILTERS:', JSON.stringify(queryFilters, null, 2));
    return queryFilters;
};

// Execute lab study query
const executeLabStudyQuery = async (queryFilters, limit) => {
    try {
        const totalStudies = await DicomStudy.countDocuments(queryFilters);
        
        const studies = await DicomStudy.find(queryFilters)
            .populate('assignment.assignedTo', 'fullName email role')
            .populate('assignment.assignedBy', 'fullName email role')
            .populate('reportInfo.verificationInfo.verifiedBy', 'fullName email role')
            .populate('sourceLab', 'name labName identifier location contactPerson')
            .populate('patient', 'patientID patientNameRaw firstName lastName age gender dateOfBirth')
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();

        console.log(`📊 LAB QUERY EXECUTED: Found ${studies.length} studies, Total: ${totalStudies}`);
        return { studies, totalStudies };
    } catch (error) {
        console.error('❌ Error in executeLabStudyQuery:', error);
        throw error;
    }
};

// ✅ GET LAB VALUES
export const getLabValues = async (req, res) => {
    try {
        const user = req.user;
        if (!user || !user.lab) {
            return res.status(401).json({ success: false, message: 'User not authenticated or not assigned to lab' });
        }

        const queryFilters = buildLabQuery(req, user);
        
        const statusCategories = {
            pending: ['new_study_received', 'pending_assignment'],
            inprogress: [
                'assigned_to_doctor', 'doctor_opened_report', 'report_in_progress',
                'report_finalized', 'report_drafted', 'report_uploaded', 
                'report_downloaded_radiologist', 'report_downloaded', 'report_verified',
                'report_rejected'
            ],
            completed: ['final_report_downloaded', 'archived']
        };

        const [totalStudies, pendingStudies, inprogressStudies, completedStudies] = await Promise.all([
            DicomStudy.countDocuments(queryFilters),
            DicomStudy.countDocuments({ ...queryFilters, workflowStatus: { $in: statusCategories.pending } }),
            DicomStudy.countDocuments({ ...queryFilters, workflowStatus: { $in: statusCategories.inprogress } }),
            DicomStudy.countDocuments({ ...queryFilters, workflowStatus: { $in: statusCategories.completed } })
        ]);

        res.status(200).json({
            success: true,
            total: totalStudies,
            pending: pendingStudies,
            inprogress: inprogressStudies,
            completed: completedStudies,
            labInfo: {
                labId: user.lab._id,
                labName: user.lab.name,
                organizationIdentifier: user.organizationIdentifier
            }
        });

    } catch (error) {
        console.error('❌ Error fetching lab values:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error fetching lab statistics.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ✅ GET LAB STUDIES ENDPOINTS
export const getLabPendingStudies = async (req, res) => {
    try {
        const user = req.user;
        if (!user || !user.lab) {
            return res.status(401).json({ success: false, message: 'User not authenticated or not assigned to lab' });
        }

        const limit = parseInt(req.query.limit) || 50;
        const pendingStatuses = ['new_study_received', 'pending_assignment'];
        const queryFilters = buildLabQuery(req, user, pendingStatuses);

        const { studies, totalStudies } = await executeLabStudyQuery(queryFilters, limit);

        return res.status(200).json({
            success: true,
            count: studies.length,
            totalRecords: totalStudies,
            data: studies,
            metadata: {
                category: 'pending',
                statusesIncluded: pendingStatuses,
                labId: user.lab._id,
                labName: user.lab.name
            }
        });

    } catch (error) {
        console.error('❌ LAB PENDING: Error fetching pending studies:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error fetching pending studies.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

export const getLabInProgressStudies = async (req, res) => {
    try {
        const user = req.user;
        if (!user || !user.lab) {
            return res.status(401).json({ success: false, message: 'User not authenticated or not assigned to lab' });
        }

        const limit = parseInt(req.query.limit) || 50;
        const inProgressStatuses = [
            'assigned_to_doctor', 'doctor_opened_report', 'report_in_progress',
            'report_finalized', 'report_drafted', 'report_uploaded', 
            'report_downloaded_radiologist', 'report_downloaded', 'report_verified',
            'report_rejected'
        ];
        const queryFilters = buildLabQuery(req, user, inProgressStatuses);

        const { studies, totalStudies } = await executeLabStudyQuery(queryFilters, limit);

        return res.status(200).json({
            success: true,
            count: studies.length,
            totalRecords: totalStudies,
            data: studies,
            metadata: {
                category: 'inprogress',
                statusesIncluded: inProgressStatuses,
                labId: user.lab._id,
                labName: user.lab.name
            }
        });

    } catch (error) {
        console.error('❌ LAB IN-PROGRESS: Error fetching in-progress studies:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error fetching in-progress studies.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

export const getLabCompletedStudies = async (req, res) => {
    try {
        const user = req.user;
        if (!user || !user.lab) {
            return res.status(401).json({ success: false, message: 'User not authenticated or not assigned to lab' });
        }

        const limit = parseInt(req.query.limit) || 50;
        const completedStatuses = ['final_report_downloaded', 'archived'];
        const queryFilters = buildLabQuery(req, user, completedStatuses);

        const { studies, totalStudies } = await executeLabStudyQuery(queryFilters, limit);

        return res.status(200).json({
            success: true,
            count: studies.length,
            totalRecords: totalStudies,
            data: studies,
            metadata: {
                category: 'completed',
                statusesIncluded: completedStatuses,
                labId: user.lab._id,
                labName: user.lab.name
            }
        });

    } catch (error) {
        console.error('❌ LAB COMPLETED: Error fetching completed studies:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error fetching completed studies.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

export const getAllLabStudies = async (req, res) => {
    try {
        const user = req.user;
        if (!user || !user.lab) {
            return res.status(401).json({ success: false, message: 'User not authenticated or not assigned to lab' });
        }

        const limit = parseInt(req.query.limit) || 20;
        const queryFilters = buildLabQuery(req, user, null); // All statuses

        const { studies, totalStudies } = await executeLabStudyQuery(queryFilters, limit);

        return res.status(200).json({
            success: true,
            count: studies.length,
            totalRecords: totalStudies,
            data: studies,
            metadata: {
                category: 'all',
                statusesIncluded: 'all',
                labId: user.lab._id,
                labName: user.lab.name
            }
        });

    } catch (error) {
        console.error('❌ LAB ALL STUDIES: Error fetching studies:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error fetching studies.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};