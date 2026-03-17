import mongoose from 'mongoose';
import DicomStudy from '../models/dicomStudyModel.js';
import User from '../models/userModel.js';
import Lab from '../models/labModel.js';
import Organization from '../models/organisation.js';
import { formatStudiesForWorklist } from '../utils/formatStudies.js';

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

// 🔧 CENTRALIZED: Build base query with multi-tenant support
const buildBaseQuery = (req, user, workflowStatuses = null) => {
    const queryFilters = {};

    // 🏢 MULTI-TENANT: Organization-based filtering
    // ✅ FIX: Check for organizationContext from token (when super admin switches org)
    if (user.role === 'super_admin' && user.tokenContext?.organizationIdentifier) {
        // Super admin viewing a specific organization
        queryFilters.organizationIdentifier = user.tokenContext.organizationIdentifier;
        console.log(`🏢 [Super Admin Context] Filtering for organization: ${user.tokenContext.organizationIdentifier}`);
    } else if (user.role !== 'super_admin') {
        // Regular users - always filter by their organization
        queryFilters.organizationIdentifier = user.organizationIdentifier;
        console.log(`🏢 [Multi-tenant] Filter applied for organization: ${user.organizationIdentifier}`);
    } else {
        // Super admin without organization context - see all organizations
        console.log(`🏢 [Super Admin] No organization filter - viewing all orgs`);
    }

    // ✅ NEW: ASSIGNOR LAB FILTERING - Apply before other filters
    if (user.role === 'assignor' || user.primaryRole === 'assignor') {
        const assignorLabAccessMode = user.roleConfig?.labAccessMode || 'all';
        const assignedLabs = user.roleConfig?.assignedLabs || [];

        console.log('🔍 [Assignor Lab Filter in Admin Controller]:', {
            userId: user._id,
            userName: user.fullName,
            labAccessMode: assignorLabAccessMode,
            assignedLabsCount: assignedLabs.length,
            assignedLabs: assignedLabs
        });

        if (assignorLabAccessMode === 'selected' && assignedLabs.length > 0) {
            queryFilters.sourceLab = { $in: assignedLabs.map(id => new mongoose.Types.ObjectId(id)) };
        } else if (assignorLabAccessMode === 'none') {
            queryFilters.sourceLab = null;
        }
        // If 'all' mode, no additional filtering needed
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
            { bharatPacsId: { $regex: req.query.search, $options: 'i' } },
            { accessionNumber: { $regex: req.query.search, $options: 'i' } },
            { studyInstanceUID: { $regex: req.query.search, $options: 'i' } },
            { 'patientInfo.patientName': { $regex: req.query.search, $options: 'i' } },
            { 'patientInfo.patientID': { $regex: req.query.search, $options: 'i' } },
            { 'clinicalHistory.clinicalHistory': { $regex: req.query.search, $options: 'i' } }
        ];
    }

    // 🔬 MODALITY FILTERING - Single or Multiple
    if (req.query.modalities) {
        let modalityList = [];
        
        // Handle both array and comma-separated string formats
        if (Array.isArray(req.query.modalities)) {
            modalityList = req.query.modalities;
        } else if (typeof req.query.modalities === 'string') {
            // Single value or comma-separated
            modalityList = req.query.modalities.includes(',') 
                ? req.query.modalities.split(',').map(m => m.trim()).filter(Boolean)
                : [req.query.modalities];
        }
        
        console.log('🔬 [Modality Filter - Raw]:', {
            rawParam: req.query.modalities,
            isArray: Array.isArray(req.query.modalities),
            parsedModalities: modalityList
        });
        
        if (modalityList.length > 0) {
            // Query studies where modality OR modalitiesInStudy matches any of the selected modalities
            queryFilters.$or = [
                { modality: { $in: modalityList } },
                { modalitiesInStudy: { $in: modalityList } }
            ];
            
            console.log('✅ [Modality Filter Applied]:', {
                modalityCount: modalityList.length,
                modalities: modalityList,
                filter: queryFilters.$or
            });
        }
    } else if (req.query.modality && req.query.modality !== 'all') {
        // Fallback to single modality filter for backward compatibility
        queryFilters.$or = [
            { modality: req.query.modality },
            { modalitiesInStudy: req.query.modality }
        ];
    }

    // 🏥 LAB FILTERING (within organization) - Old single select
    if (req.query.labId && req.query.labId !== 'all' && mongoose.Types.ObjectId.isValid(req.query.labId)) {
        queryFilters.sourceLab = new mongoose.Types.ObjectId(req.query.labId);
    }

    // ⚡ PRIORITY FILTERING
       // ⚡ PRIORITY FILTERING - Single or Multiple
    // AFTER:
    if (req.query.priorities) {
        let priorityList = [];
        if (Array.isArray(req.query.priorities)) {
            priorityList = req.query.priorities.filter(Boolean);
        } else if (typeof req.query.priorities === 'string') {
            priorityList = req.query.priorities.split(',').map(p => p.trim()).filter(Boolean);
        }
        console.log('⚡ [Priority Multi-Filter]:', priorityList);
        if (priorityList.length === 1) {
            const p = priorityList[0];
            queryFilters.$or = [
                ...(queryFilters.$or || []),
                { priority: p },
                { 'assignment.priority': p }
            ];
        } else if (priorityList.length > 1) {
            queryFilters.$or = [
                ...(queryFilters.$or || []),
                { priority: { $in: priorityList } },
                { 'assignment.priority': { $in: priorityList } }
            ];
        }
    } else if (req.query.priority && req.query.priority !== 'all') {
        const p = req.query.priority;
        queryFilters.$or = [
            ...(queryFilters.$or || []),
            { priority: p },
            { 'assignment.priority': p }
        ];
    }

    // 🔢 STUDY INSTANCE UIDS
    if (req.query.StudyInstanceUIDs && req.query.StudyInstanceUIDs !== 'undefined') {
        const studyUIDs = req.query.StudyInstanceUIDs.split(',').map(uid => uid.trim()).filter(Boolean);
        if (studyUIDs.length > 0) {
            queryFilters.studyInstanceUID = { $in: studyUIDs };
        }
    }

    // ✅ NEW: RADIOLOGIST MULTI-SELECT FILTER
    if (req.query.radiologists) {
        let radiologistIds = [];
        
        // Handle both array and comma-separated string formats
        if (Array.isArray(req.query.radiologists)) {
            radiologistIds = req.query.radiologists;
        } else if (typeof req.query.radiologists === 'string') {
            // Single value or comma-separated
            radiologistIds = req.query.radiologists.includes(',') 
                ? req.query.radiologists.split(',').map(id => id.trim()).filter(Boolean)
                : [req.query.radiologists];
        }
        
        console.log('🔍 [Radiologist Filter - Raw]:', {
            rawParam: req.query.radiologists,
            isArray: Array.isArray(req.query.radiologists),
            parsedIds: radiologistIds
        });
        
        if (radiologistIds.length > 0) {
            // Convert to ObjectIds and validate
            const validObjectIds = radiologistIds
                .filter(id => mongoose.Types.ObjectId.isValid(id))
                .map(id => new mongoose.Types.ObjectId(id));
            
            if (validObjectIds.length > 0) {
                // Query the assignment array to find studies assigned to these radiologists
                queryFilters['assignment.assignedTo'] = { $in: validObjectIds };
                
                console.log('✅ [Radiologist Filter Applied]:', {
                    radiologistCount: validObjectIds.length,
                    radiologistIds: validObjectIds.map(id => id.toString()),
                    filter: queryFilters['assignment.assignedTo']
                });
            } else {
                console.warn('⚠️ [Radiologist Filter] No valid ObjectIds found');
            }
        }
    }

    // ✅ NEW: LAB/CENTER MULTI-SELECT FILTER
    if (req.query.labs) {
        let labIds = [];
        
        // Handle both array and comma-separated string formats
        if (Array.isArray(req.query.labs)) {
            labIds = req.query.labs;
        } else if (typeof req.query.labs === 'string') {
            // Single value or comma-separated
            labIds = req.query.labs.includes(',')
                ? req.query.labs.split(',').map(id => id.trim()).filter(Boolean)
                : [req.query.labs];
        }
        
        console.log('🔍 [Lab Filter - Raw]:', {
            rawParam: req.query.labs,
            isArray: Array.isArray(req.query.labs),
            parsedIds: labIds
        });
        
        if (labIds.length > 0) {
            // Convert to ObjectIds and validate
            const validObjectIds = labIds
                .filter(id => mongoose.Types.ObjectId.isValid(id))
                .map(id => new mongoose.Types.ObjectId(id));
            
            if (validObjectIds.length > 0) {
                // Check if there's already a sourceLab filter from assignor restrictions
                if (queryFilters.sourceLab && queryFilters.sourceLab.$in) {
                    // Find intersection of assignor's labs and selected labs
                    const assignorLabIds = queryFilters.sourceLab.$in.map(id => id.toString());
                    const selectedLabIds = validObjectIds.map(id => id.toString());
                    const intersection = assignorLabIds.filter(id => selectedLabIds.includes(id));
                    
                    console.log('🔍 [Lab Filter - Intersection with Assignor]:', {
                        assignorLabs: assignorLabIds,
                        selectedLabs: selectedLabIds,
                        intersection: intersection
                    });
                    
                    if (intersection.length > 0) {
                        queryFilters.sourceLab = { $in: intersection.map(id => new mongoose.Types.ObjectId(id)) };
                    } else {
                        // No intersection, return empty results
                        console.warn('⚠️ [Lab Filter] No intersection between assignor labs and selected labs');
                        queryFilters.sourceLab = null; // This will return no results
                    }
                } else {
                    // No assignor restriction, apply selected labs directly
                    queryFilters.sourceLab = { $in: validObjectIds };
                }
                
                console.log('✅ [Lab Filter Applied]:', {
                    labCount: validObjectIds.length,
                    labIds: validObjectIds.map(id => id.toString()),
                    finalFilter: queryFilters.sourceLab
                });
            } else {
                console.warn('⚠️ [Lab Filter] No valid ObjectIds found');
            }
        }
    }

    console.log('🎯 [Final Query Filters]:', JSON.stringify(queryFilters, null, 2));

    return queryFilters;
};

const executeStudyQuery = async (queryFilters, limit, page = 1) => {
    try {
        const skip = (page - 1) * limit;
        const totalStudies = await DicomStudy.countDocuments(queryFilters);
        
        const studies = await DicomStudy.find(queryFilters)
            // Core references
            .populate('organization', 'name identifier contactEmail contactPhone address')
            .populate('patient', 'patientID patientNameRaw firstName lastName age gender dateOfBirth contactNumber')
            .populate('sourceLab', 'name labName identifier location contactPerson contactNumber')
            
            // ✅ ADD ATTACHMENTS POPULATION
    .populate('attachments.documentId', 'fileName fileSize contentType uploadedAt')
    .populate('attachments.uploadedBy', 'fullName email role')

    
            // Assignment references
            .populate('assignment.assignedTo', 'fullName firstName lastName email role organizationIdentifier')
            .populate('assignment.assignedBy', 'fullName firstName lastName email role')
            
            // Report and verification references
            .populate('reportInfo.verificationInfo.verifiedBy', 'fullName firstName lastName email role')
            .populate('currentReportStatus.lastReportedBy', 'fullName firstName lastName email role')
            
            // Category tracking references
            .populate('categoryTracking.created.uploadedBy', 'fullName firstName lastName email role')
            .populate('categoryTracking.historyCreated.createdBy', 'fullName firstName lastName email role')
            .populate('categoryTracking.assigned.assignedTo', 'fullName firstName lastName email role')
            .populate('categoryTracking.assigned.assignedBy', 'fullName firstName lastName email role')
            .populate('categoryTracking.final.finalizedBy', 'fullName firstName lastName email role')
            .populate('categoryTracking.urgent.markedUrgentBy', 'fullName firstName lastName email role')
            
            // Lock references
            .populate('studyLock.lockedBy', 'fullName firstName lastName email role')
            
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        console.log(`📊 ADMIN QUERY EXECUTED: Found ${studies.length} studies (page ${page}), Total: ${totalStudies}`);

        return { studies, totalStudies, currentPage: page };
    } catch (error) {
        console.error('❌ Error in executeStudyQuery:', error);
        throw error;
    }
};

// 🎯 GET DASHBOARD VALUES - Multi-tenant with assignment analytics
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
                DicomStudy.countDocuments({
                    ...queryFilters,
                    'assignment.status': 'assigned',
                    'assignment.assignedAt': { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) }
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

// 🟡 GET PENDING STUDIES
export const getPendingStudies = async (req, res) => {
    try {
        const startTime = Date.now();
        const limit = parseInt(req.query.limit) || 50;
        const page = parseInt(req.query.page) || 1; // ✅ GET PAGE FROM QUERY
        
        console.log(`🟡 PENDING: Fetching - Page: ${page}, Limit: ${limit}`);
        
        const user = req.user;
        if (!user) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }

        const pendingStatuses = ['new_study_received', 'pending_assignment'];
        const queryFilters = buildBaseQuery(req, user, pendingStatuses);
        
        console.log(`🔍 PENDING query filters:`, JSON.stringify(queryFilters, null, 2));

        // ✅ CRITICAL: Pass PAGE to executeStudyQuery
        const { studies, totalStudies, currentPage } = await executeStudyQuery(queryFilters, limit, page);

        const processingTime = Date.now() - startTime;
        console.log(`✅ PENDING: Page ${currentPage} - ${studies.length} studies (Total: ${totalStudies})`);

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

export const getInProgressStudies = async (req, res) => {
    try {
        const startTime = Date.now();
        const limit = parseInt(req.query.limit) || 50;
        const page = parseInt(req.query.page) || 1; // ✅ GET PAGE FROM QUERY
        
        console.log(`🔵 IN-PROGRESS: Fetching - Page: ${page}, Limit: ${limit}`);
        
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

        // ✅ CRITICAL: Pass PAGE to executeStudyQuery
        const { studies, totalStudies, currentPage } = await executeStudyQuery(queryFilters, limit, page);

        const processingTime = Date.now() - startTime;
        console.log(`✅ IN-PROGRESS: Page ${currentPage} - ${studies.length} studies (Total: ${totalStudies})`);

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
        const page = parseInt(req.query.page) || 1; // ✅ GET PAGE FROM QUERY
        
        console.log(`🟢 COMPLETED: Fetching - Page: ${page}, Limit: ${limit}`);
        
        const user = req.user;
        if (!user) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }

        const completedStatuses = ['final_report_downloaded', 'archived'];
        const queryFilters = buildBaseQuery(req, user, completedStatuses);

        // ✅ CRITICAL: Pass PAGE to executeStudyQuery
        const { studies, totalStudies, currentPage } = await executeStudyQuery(queryFilters, limit, page);

        const processingTime = Date.now() - startTime;
        console.log(`✅ COMPLETED: Page ${currentPage} - ${studies.length} studies (Total: ${totalStudies})`);

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

// ✅ NEW: Get category values for all categories - COUNT BY WORKFLOW STATUS
export const getCategoryValues = async (req, res) => {
    console.log(`🔍 Fetching category values with filters: ${JSON.stringify(req.query)}`);
    try {
        const startTime = Date.now();
        const user = req.user;
        if (!user) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }

        const queryFilters = buildBaseQuery(req, user);
        
        console.log(`🔍 Category query filters:`, JSON.stringify(queryFilters, null, 2));

        // Execute parallel queries for all categories
        const [
            allCount,
            createdCount,
            historyCreatedCount,
            unassignedCount,
            assignedCount,
            pendingCount,
            draftCount,
            verificationPendingCount,
            finalCount,
            urgentCount,
            reprintNeedCount,
            revertedCount  // ✅ NEW: Add reverted count
        ] = await Promise.all([
            // ALL
            DicomStudy.countDocuments(queryFilters),
            
            // CREATED
            DicomStudy.countDocuments({
                ...queryFilters,
                workflowStatus: { $in: ['new_study_received', 'metadata_extracted', 'no_active_study'] }
            }),
            
            // HISTORY CREATED
            DicomStudy.countDocuments({
                ...queryFilters,
                workflowStatus: { $in: ['history_pending', 'history_created', 'history_verified'] }
            }),
            
            // UNASSIGNED
            DicomStudy.countDocuments({
                ...queryFilters,
                $or: [
                    { workflowStatus: { $in: ['pending_assignment', 'awaiting_radiologist'] } },
                    { assignment: { $exists: false } },
                    { assignment: { $size: 0 } },
                    { assignment: null },
                    { 
                        assignment: { 
                            $not: { 
                                $elemMatch: { 
                                    assignedTo: { $exists: true, $ne: null }
                                } 
                            } 
                        }
                    }
                ]
            }),
            
            // ASSIGNED
            DicomStudy.countDocuments({
                ...queryFilters,
                workflowStatus: { $in: ['assigned_to_doctor', 'assignment_accepted'] }
            }),
            
            // PENDING
            DicomStudy.countDocuments({
                ...queryFilters,
                workflowStatus: { $in: ['doctor_opened_report', 'report_in_progress', 'pending_completion'] }
            }),
            
            // DRAFT
            DicomStudy.countDocuments({
                ...queryFilters,
                workflowStatus: { $in: ['report_drafted', 'draft_saved'] }
            }),
            
            // VERIFICATION PENDING
            DicomStudy.countDocuments({
                ...queryFilters,
                workflowStatus: { $in: ['verification_pending', 'verification_in_progress'] }
            }),
            
            // FINAL - Remove revert_to_radiologist from here
            DicomStudy.countDocuments({
                ...queryFilters,
                workflowStatus: { 
                    $in: [
                        'report_finalized', 
                        'final_approved', 
                        'report_completed',
                        'report_uploaded',
                        'report_downloaded_radiologist',
                        'report_downloaded',
                        'final_report_downloaded',
                        'report_verified',
                        // 'report_rejected',
                        'archived'
                    ] 
                }
            }),
            
            // URGENT - Based on studyPriority = 'Emergency Case'
            DicomStudy.countDocuments({
                ...queryFilters,
                studyPriority: 'Emergency Case'
            }),
            
            // REPRINT NEED
            DicomStudy.countDocuments({
                ...queryFilters,
                workflowStatus: { $in: ['reprint_requested', 'correction_needed', 'report_reprint_needed'] }
            }),
            
            // ✅ NEW: REVERTED - Studies reverted back to radiologist
            DicomStudy.countDocuments({
                ...queryFilters,
                workflowStatus: { 
                    $in: ['revert_to_radiologist',  'report_rejected']

                }
            })
        ]);

        const processingTime = Date.now() - startTime;
        console.log(`🎯 Category values fetched in ${processingTime}ms`);
        console.log(`🚨 URGENT (Emergency Case) count: ${urgentCount}`);

        const response = {
            success: true,
            all: allCount,
            created: createdCount,
            history_created: historyCreatedCount,
            unassigned: unassignedCount,
            assigned: assignedCount,
            pending: pendingCount,
            draft: draftCount,
            verification_pending: verificationPendingCount,
            final: finalCount,
            urgent: urgentCount,
            reprint_need: reprintNeedCount,
            reverted: revertedCount,  // ✅ NEW: Add reverted count
            performance: {
                queryTime: processingTime,
                fromCache: false,
                filtersApplied: Object.keys(queryFilters).length > 0
            }
        };

        if (process.env.NODE_ENV === 'development') {
            response.debug = {
                filtersApplied: queryFilters,
                userRole: user.role,
                organization: user.organizationIdentifier
            };
        }

        res.status(200).json(response);

    } catch (error) {
        console.error('❌ Error fetching category values:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error fetching category statistics.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ✅ FIX: Get studies by category WITH PAGINATION AND PROPER WORKFLOW STATUS MAPPING
export const getStudiesByCategory = async (req, res) => {
    try {
        const startTime = Date.now();
        const limit = parseInt(req.query.limit) || 50;
        const page = parseInt(req.query.page) || 1;
        const { category } = req.params;
        
        const user = req.user;
        if (!user) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }

        console.log(`🔍 [${category.toUpperCase()}] Fetching studies - Page: ${page}, Limit: ${limit}`);

        const queryFilters = buildBaseQuery(req, user);
        
        // ✅ COMPREHENSIVE WORKFLOW STATUS MAPPING BY CATEGORY
        switch (category) {
            case 'created':
                // CREATED: New studies that just arrived
                queryFilters.workflowStatus = { 
                    $in: ['new_study_received', 'metadata_extracted', 'no_active_study'] 
                };
                break;
                
            case 'history-created':
                // HISTORY CREATED: Studies with history being created
                queryFilters.workflowStatus = { 
                    $in: ['history_pending', 'history_created', 'history_verified'] 
                };
                break;
                
            case 'unassigned':
                // UNASSIGNED: Studies awaiting assignment OR with no valid assignments
                queryFilters.$or = [
                    { workflowStatus: { $in: ['pending_assignment', 'awaiting_radiologist'] } },
                    { assignment: { $exists: false } },
                    { assignment: { $size: 0 } },
                    { assignment: null },
                    { 
                        assignment: { 
                            $not: { 
                                $elemMatch: { 
                                    assignedTo: { $exists: true, $ne: null }
                                } 
                            } 
                        }
                    }
                ];
                console.log(`📋 [UNASSIGNED] Filtering by workflow status OR empty/invalid assignments`);
                break;
                
            case 'assigned':
                // ASSIGNED: Studies assigned to radiologist
                queryFilters.workflowStatus = { 
                    $in: ['assigned_to_doctor', 'assignment_accepted'] 
                };
                break;
                
            case 'pending':
                // PENDING: Report work in progress
                queryFilters.workflowStatus = { 
                    $in: ['doctor_opened_report', 'report_in_progress', 'pending_completion'] 
                };
                break;
                
            case 'draft':
                // DRAFT: Draft reports saved
                queryFilters.workflowStatus = { 
                    $in: ['report_drafted', 'draft_saved'] 
                };
                break;
                
            case 'verification-pending':
                // VERIFICATION PENDING: Reports awaiting verification
                queryFilters.workflowStatus = { 
                    $in: ['verification_pending', 'verification_in_progress'] 
                };
                break;
                
            case 'final':
                // FINAL: Finalized reports (removed revert_to_radiologist from here)
                queryFilters.workflowStatus = { 
                    $in: [
                        'report_finalized', 
                        'final_approved', 
                        'report_completed',
                        'report_uploaded',
                        'report_downloaded_radiologist',
                        'report_downloaded',
                        'final_report_downloaded',
                        'report_verified',
                        'archived'
                    ] 
                };
                break;
                
            case 'urgent':
                // URGENT: Filter by studyPriority = 'Emergency Case'
                queryFilters.studyPriority = 'Emergency Case';
                console.log(`🚨 [URGENT] Filtering by studyPriority: 'Emergency Case'`);
                break;
                
            case 'reprint-need':
                // REPRINT NEED: Studies needing reprint/correction
                queryFilters.workflowStatus = { 
                    $in: ['reprint_requested', 'correction_needed', 'report_reprint_needed'] 
                };
                break;
                
            // ✅ NEW: REVERTED category
            case 'reverted':
                // REVERTED: Studies reverted back to radiologist
//                 queryFilters.workflowStatus = {'revert_to_radiologist',  'report_rejected',
// };
            queryFilters.workflowStatus = { 
                    $in: ['revert_to_radiologist',  'report_rejected']

                };
                console.log(`🔄 [REVERTED] Filtering reverted studies`);
                break;
            
            default:
                // 'all' - no workflow status filter
                break;
        }

        console.log(`🔍 [${category.toUpperCase()}] Query filter:`, 
            category === 'urgent' 
                ? `studyPriority: ${queryFilters.studyPriority}` 
                : `workflowStatus: ${JSON.stringify(queryFilters.workflowStatus)}`
        );

        const { studies, totalStudies, currentPage } = await executeStudyQuery(queryFilters, limit, page);

        const processingTime = Date.now() - startTime;
        console.log(`✅ [${category.toUpperCase()}]: Page ${currentPage} - ${studies.length} studies (Total: ${totalStudies})`);

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
                category: category,
                // ✅ Show correct filter type in metadata
                filterType: category === 'urgent' ? 'studyPriority' : 'workflowStatus',
                filterValue: category === 'urgent' 
                    ? queryFilters.studyPriority 
                    : (queryFilters.workflowStatus?.$in || 'all'),
                organizationFilter: user.role !== 'super_admin' ? user.organizationIdentifier : 'all',
                userRole: user.role,
                processingTime: processingTime
            }
        });

    } catch (error) {
        console.error(`❌ [${req.params.category?.toUpperCase()}]: Error fetching studies:`, error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error fetching studies.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ✅ FIX: Get all studies WITH PAGINATION
export const getAllStudiesForAdmin = async (req, res) => {
    try {
        const startTime = Date.now();
        const limit = parseInt(req.query.limit) || 50;
        const page = parseInt(req.query.page) || 1; // ✅ GET PAGE FROM QUERY
        
        const user = req.user;
        if (!user) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }

        console.log(`🔍 [ALL STUDIES] Fetching - Page: ${page}, Limit: ${limit}`);

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

        // ✅ CRITICAL: Pass PAGE to executeStudyQuery
        const { studies, totalStudies, currentPage } = await executeStudyQuery(queryFilters, limit, page);

        const processingTime = Date.now() - startTime;
        console.log(`✅ [ALL STUDIES]: Page ${currentPage} - ${studies.length} studies (Total: ${totalStudies})`);

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



// ✅ GET ALL LABS IN ORGANIZATION
export const getOrganizationLabs = async (req, res) => {
    try {
        const userRole = req.user.role;
        const orgIdentifier = req.user.organizationIdentifier;

        // Build query based on role
        let query = { isActive: true };
        
        if (userRole !== 'super_admin') {
            query.organizationIdentifier = orgIdentifier;
        }

        const labs = await Lab.find(query)
            .populate('organization', 'name displayName identifier')
            .select('name identifier contactPerson contactEmail settings isActive')
            .sort({ name: 1 })
            .lean();

        console.log(`✅ Found ${labs.length} labs for organization ${orgIdentifier || 'all'}`);

        res.json({
            success: true,
            data: labs,
            count: labs.length
        });

    } catch (error) {
        console.error('❌ Get organization labs error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch labs'
        });
    }
};

export default {
    getValues,
    getCategoryValues, // ✅ NEW
    getStudiesByCategory, // ✅ NEW
    getPendingStudies,
    getInProgressStudies,
    getCompletedStudies,
    getAllStudiesForAdmin,
    getOrganizationLabs
};