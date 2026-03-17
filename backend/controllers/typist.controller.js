import mongoose from 'mongoose';
import DicomStudy from '../models/dicomStudyModel.js';
import Report from '../models/reportModel.js';
import User from '../models/userModel.js';
// import { formatStudiesForWorklist } from '../utils/studyFormatter.js';

// ✅ REUSE: Date filtering utility (matching doctor.controller)
const buildDateFilter = (req) => {
    const IST_OFFSET = 5.5 * 60 * 60 * 1000;
    let filterStartDate = null;
    let filterEndDate = null;

    if (req.query.quickDatePreset || req.query.dateFilter) {
        const preset = req.query.quickDatePreset || req.query.dateFilter;
        const now = Date.now();

        console.log('🗓️ TYPIST DATE FILTER:', {
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

    console.log('🎯 TYPIST FINAL DATE RANGE (IST):', {
        preset: req.query.dateFilter || req.query.quickDatePreset,
        filterStartDate: filterStartDate?.toISOString(),
        filterEndDate: filterEndDate?.toISOString(),
        localStart: filterStartDate ? new Date(filterStartDate.getTime() + IST_OFFSET).toLocaleString() : null,
        localEnd: filterEndDate ? new Date(filterEndDate.getTime() + IST_OFFSET).toLocaleString() : null
    });

    return { filterStartDate, filterEndDate };
};

// ✅ TYPIST-SPECIFIC: Build base query scoped to linked radiologist's studies
const buildTypistBaseQuery = (req, reportExists = null) => {
    const user = req.user;
    
    // ✅ VALIDATE TYPIST HAS LINKED RADIOLOGIST
    if (!user.roleConfig?.linkedRadiologist) {
        throw new Error('Typist must be linked to a radiologist');
    }

    const queryFilters = {
        organizationIdentifier: user.organizationIdentifier,
        'assignment.assignedTo': new mongoose.Types.ObjectId(user.roleConfig.linkedRadiologist)
    };

    // ✅ DATE FILTERING
    const { filterStartDate, filterEndDate } = buildDateFilter(req);
    if (filterStartDate || filterEndDate) {
        const dateField = req.query.dateType === 'studyDate' ? 'studyDate' : 'createdAt';
        queryFilters[dateField] = {};
        if (filterStartDate) queryFilters[dateField].$gte = filterStartDate;
        if (filterEndDate) queryFilters[dateField].$lte = filterEndDate;
    }

    // ✅ SEARCH FILTERING
    if (req.query.search) {
        queryFilters.$or = [
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

    return queryFilters;
};

// ✅ EXECUTE STUDY QUERY WITH PAGINATION
const executeStudyQuery = async (queryFilters, limit = 50, page = 1) => {
    try {
        const skip = (page - 1) * limit;
        const totalStudies = await DicomStudy.countDocuments(queryFilters);
        
        const studies = await DicomStudy.find(queryFilters)
            .populate('assignment.assignedTo', 'fullName email role')
            .populate('assignment.assignedBy', 'fullName email role')
            .populate('sourceLab', 'name identifier location contactPerson')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        return {
            studies,
            totalStudies,
            totalPages: Math.ceil(totalStudies / limit),
            currentPage: page,
            hasNextPage: skip + limit < totalStudies,
            hasPrevPage: page > 1
        };
    } catch (error) {
        console.error('❌ Error in executeStudyQuery:', error);
        throw error;
    }
};

// ✅ 1. GET DASHBOARD VALUES - Two categories: Pending (no report) & Typed (report exists)
export const getValues = async (req, res) => {
    console.log(`🔍 Typist dashboard: Fetching values with filters: ${JSON.stringify(req.query)}`);
    try {
        const user = req.user;
        
        if (!user) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }

        // ✅ VALIDATE TYPIST ROLE
        if (user.role !== 'typist') {
            return res.status(403).json({ success: false, message: 'Access denied: Typist role required' });
        }

        // Build base query for linked radiologist's studies
        const queryFilters = buildTypistBaseQuery(req);
        
        console.log(`🔍 Typist dashboard query filters:`, JSON.stringify(queryFilters, null, 2));

        // Get total studies
        const totalStudies = await DicomStudy.countDocuments(queryFilters);

        // ✅ NEW: Count studies WITH reports (typed) and WITHOUT reports (pending)
        // A study is "typed" if there's a report for it
        const studiesWithReports = await DicomStudy.aggregate([
            { $match: queryFilters },
            {
                $lookup: {
                    from: 'reports',
                    localField: '_id',
                    foreignField: 'dicomStudy',
                    as: 'reportExists'
                }
            },
            {
                $group: {
                    _id: null,
                    withReports: {
                        $sum: {
                            $cond: [{ $gt: [{ $size: '$reportExists' }, 0] }, 1, 0]
                        }
                    },
                    withoutReports: {
                        $sum: {
                            $cond: [{ $eq: [{ $size: '$reportExists' }, 0] }, 1, 0]
                        }
                    }
                }
            }
        ]);

        const pending = studiesWithReports.length > 0 ? studiesWithReports[0].withoutReports : totalStudies;
        const typed = studiesWithReports.length > 0 ? studiesWithReports[0].withReports : 0;

        console.log(`📊 Typist values:`, { total: totalStudies, pending, typed });

        res.status(200).json({
            success: true,
            total: totalStudies,
            pending,
            typed,
            debug: {
                linkedRadiologist: user.roleConfig?.linkedRadiologist,
                organization: user.organizationIdentifier
            }
        });

    } catch (error) {
        console.error('❌ Error fetching typist dashboard values:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error fetching typist dashboard statistics.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ✅ 2. GET PENDING STUDIES (no report yet) WITH PAGINATION
export const getPendingStudies = async (req, res) => {
    try {
        const user = req.user;
        const limit = parseInt(req.query.limit) || 50;
        const page = parseInt(req.query.page) || 1;
        
        if (user.role !== 'typist') {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        // Build base query
        const queryFilters = buildTypistBaseQuery(req);
        
        console.log('🟡 TYPIST PENDING: Fetching studies without reports');
        
        // ✅ Find all studies matching filters
        const allStudies = await DicomStudy.find(queryFilters)
            .populate('organization', 'name identifier')
            .populate('patient', 'patientID patientNameRaw firstName lastName age gender')
            .populate('sourceLab', 'name labName identifier location contactPerson')
            .populate('assignment.assignedTo', 'fullName email role')
            .populate('assignment.assignedBy', 'fullName email role')
            .sort({ createdAt: -1 })
            .lean();

        // Get report IDs for these studies
        const reportDicomStudyIds = await Report.find({
            dicomStudy: { $in: allStudies.map(s => s._id) }
        }).select('dicomStudy').lean();

        const reportedStudyIds = new Set(reportDicomStudyIds.map(r => r.dicomStudy.toString()));

        // Filter out studies that have reports (pending = no reports)
        const pendingStudies = allStudies.filter(
            s => !reportedStudyIds.has(s._id.toString())
        );

        const totalPending = pendingStudies.length;
        const skip = (page - 1) * limit;
        const paginatedStudies = pendingStudies.slice(skip, skip + limit);

        res.status(200).json({
            success: true,
            data: paginatedStudies,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalPending / limit),
                totalRecords: totalPending,
                limit,
                hasNextPage: skip + limit < totalPending,
                hasPrevPage: page > 1
            }
        });

    } catch (error) {
        console.error('❌ Error fetching pending studies for typist:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch pending studies',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ✅ 3. GET TYPED STUDIES (with report) WITH PAGINATION
export const getTypedStudies = async (req, res) => {
    try {
        const user = req.user;
        const limit = parseInt(req.query.limit) || 50;
        const page = parseInt(req.query.page) || 1;
        
        if (user.role !== 'typist') {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        // Build base query
        const queryFilters = buildTypistBaseQuery(req);
        
        console.log('🟢 TYPIST TYPED: Fetching studies with reports');
        
        // ✅ Find all studies matching filters
        const allStudies = await DicomStudy.find(queryFilters)
            .populate('organization', 'name identifier')
            .populate('patient', 'patientID patientNameRaw firstName lastName age gender')
            .populate('sourceLab', 'name labName identifier location contactPerson')
            .populate('assignment.assignedTo', 'fullName email role')
            .populate('assignment.assignedBy', 'fullName email role')
            .sort({ createdAt: -1 })
            .lean();

        // Get report IDs for these studies
        const reportDicomStudyIds = await Report.find({
            dicomStudy: { $in: allStudies.map(s => s._id) }
        }).select('dicomStudy').lean();

        const reportedStudyIds = new Set(reportDicomStudyIds.map(r => r.dicomStudy.toString()));

        // Filter to only studies that have reports (typed = has reports)
        const typedStudies = allStudies.filter(
            s => reportedStudyIds.has(s._id.toString())
        );

        const totalTyped = typedStudies.length;
        const skip = (page - 1) * limit;
        const paginatedStudies = typedStudies.slice(skip, skip + limit);

        res.status(200).json({
            success: true,
            data: paginatedStudies,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalTyped / limit),
                totalRecords: totalTyped,
                limit,
                hasNextPage: skip + limit < totalTyped,
                hasPrevPage: page > 1
            }
        });

    } catch (error) {
        console.error('❌ Error fetching typed studies for typist:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch typed studies',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ✅ 4. GET ALL STUDIES (no filter) WITH PAGINATION
export const getAllStudiesForTypist = async (req, res) => {
    try {
        const user = req.user;
        const limit = parseInt(req.query.limit) || 50;
        const page = parseInt(req.query.page) || 1;
        
        if (user.role !== 'typist') {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const queryFilters = buildTypistBaseQuery(req);
        
        console.log('🔵 TYPIST ALL: Fetching all studies');
        
        const skip = (page - 1) * limit;
        const totalStudies = await DicomStudy.countDocuments(queryFilters);
        
        const studies = await DicomStudy.find(queryFilters)
            .populate('organization', 'name identifier')
            .populate('patient', 'patientID patientNameRaw firstName lastName age gender')
            .populate('sourceLab', 'name labName identifier location contactPerson')
            .populate('assignment.assignedTo', 'fullName email role')
            .populate('assignment.assignedBy', 'fullName email role')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        res.status(200).json({
            success: true,
            data: studies,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalStudies / limit),
                totalRecords: totalStudies,
                limit,
                hasNextPage: skip + limit < totalStudies,
                hasPrevPage: page > 1
            }
        });

    } catch (error) {
        console.error('❌ Error fetching all studies for typist:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch studies',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};



// ✅ 5. GET LINKED RADIOLOGIST INFO
export const getLinkedRadiologist = async (req, res) => {
    try {
        const user = req.user;

        if (user.role !== 'typist') {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const linkedRadiologistId = user.roleConfig?.linkedRadiologist;
        if (!linkedRadiologistId) {
            return res.status(404).json({ success: false, message: 'No linked radiologist found' });
        }

        const radiologist = await User.findById(linkedRadiologistId)
            .select('fullName email role')
            .lean();

        if (!radiologist) {
            return res.status(404).json({ success: false, message: 'Linked radiologist not found' });
        }

        res.json({
            success: true,
            data: radiologist
        });

    } catch (error) {
        console.error('❌ Error fetching linked radiologist:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch radiologist info'
        });
    }
};

export default {
    getValues,
    getPendingStudies,
    getTypedStudies,
    getAllStudiesForTypist,
    getLinkedRadiologist
};