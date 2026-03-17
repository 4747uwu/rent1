import mongoose from 'mongoose';
import DicomStudy from '../models/dicomStudyModel.js';
import User from '../models/userModel.js';
import Lab from '../models/labModel.js';
import Organization from '../models/organisation.js';
import StudyNotes from '../models/studyNotesModel.js';
import Document from '../models/documentModal.js';
// import { formatStudiesForWorklist } from '../utils/formatStudies.js';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

const WORKFLOW_STATUS_MAP = {
    pending: ['new_study_received', 'pending_assignment'],
    inprogress: [
        'assigned_to_doctor', 'doctor_opened_report', 'report_in_progress',
        'report_finalized', 'report_drafted', 'report_uploaded',
        'report_downloaded_radiologist', 'report_downloaded', 'report_verified',
        'report_rejected',
        'verification_pending', // ✅ ADD THIS
    ],
    completed: ['final_report_downloaded', 'archived'],
};

// ─── DATE FILTER ──────────────────────────────────────────────────────────────

const buildDateFilter = (req) => {
    const preset = req.query.quickDatePreset || req.query.dateFilter;
    const nowUTC  = Date.now();

    const istToUTC = (y, m, d, h = 0, min = 0, s = 0, ms = 0) =>
        new Date(Date.UTC(y, m, d, h, min, s, ms) - IST_OFFSET_MS);

    const nowIST = new Date(nowUTC + IST_OFFSET_MS);
    const Y = nowIST.getFullYear(), M = nowIST.getMonth(), D = nowIST.getDate();

    const todayRange = () => ({
        filterStartDate: istToUTC(Y, M, D, 0, 0, 0, 0),
        filterEndDate:   istToUTC(Y, M, D, 23, 59, 59, 999),
    });

    if (!preset) return todayRange();

    console.log('🗓️ DATE FILTER DEBUG:', { preset, currentTime: new Date(nowUTC).toISOString(), timezone: 'IST (+5:30)' });

    let filterStartDate, filterEndDate;

    switch (preset) {
        case 'last24h':
            filterStartDate = new Date(nowUTC - 86_400_000);
            filterEndDate   = new Date(nowUTC);
            break;
        case 'today':
            return todayRange();
        case 'yesterday': {
            const d = new Date(nowIST.getTime() - 86_400_000);
            filterStartDate = istToUTC(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
            filterEndDate   = istToUTC(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
            break;
        }
        case 'tomorrow': {
            const d = new Date(nowIST.getTime() + 86_400_000);
            filterStartDate = istToUTC(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
            filterEndDate   = istToUTC(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
            break;
        }
        case 'last2days': {
            const d = new Date(nowIST.getTime() - 2 * 86_400_000);
            filterStartDate = istToUTC(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
            filterEndDate   = new Date(nowUTC);
            break;
        }
        case 'last7days': {
            const d = new Date(nowIST.getTime() - 7 * 86_400_000);
            filterStartDate = istToUTC(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
            filterEndDate   = new Date(nowUTC);
            break;
        }
        case 'last30days': {
            const d = new Date(nowIST.getTime() - 30 * 86_400_000);
            filterStartDate = istToUTC(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
            filterEndDate   = new Date(nowUTC);
            break;
        }
        case 'thisWeek': {
            const dow = nowIST.getDay();
            filterStartDate = istToUTC(Y, M, D - dow, 0, 0, 0, 0);
            filterEndDate   = new Date(nowUTC);
            break;
        }
        case 'lastWeek': {
            const lastSun = new Date(nowIST.getTime() - nowIST.getDay() * 86_400_000);
            lastSun.setHours(23, 59, 59, 999);
            const lastMon = new Date(lastSun.getTime() - 6 * 86_400_000);
            lastMon.setHours(0, 0, 0, 0);
            filterStartDate = new Date(lastMon.getTime() - IST_OFFSET_MS);
            filterEndDate   = new Date(lastSun.getTime() - IST_OFFSET_MS);
            break;
        }
        case 'thisMonth':
            filterStartDate = istToUTC(Y, M, 1, 0, 0, 0, 0);
            filterEndDate   = new Date(nowUTC);
            break;
        case 'lastMonth':
            filterStartDate = istToUTC(Y, M - 1, 1, 0, 0, 0, 0);
            filterEndDate   = istToUTC(Y, M, 0, 23, 59, 59, 999);
            break;
        case 'last3months':
            filterStartDate = istToUTC(Y, M - 3, 1, 0, 0, 0, 0);
            filterEndDate   = new Date(nowUTC);
            break;
        case 'last6months':
            filterStartDate = istToUTC(Y, M - 6, 1, 0, 0, 0, 0);
            filterEndDate   = new Date(nowUTC);
            break;
        case 'thisYear':
            filterStartDate = istToUTC(Y, 0, 1, 0, 0, 0, 0);
            filterEndDate   = new Date(nowUTC);
            break;
        case 'lastYear':
            filterStartDate = istToUTC(Y - 1, 0, 1, 0, 0, 0, 0);
            filterEndDate   = istToUTC(Y - 1, 11, 31, 23, 59, 59, 999);
            break;
        case 'custom':
            filterStartDate = req.query.customDateFrom
                ? new Date(new Date(req.query.customDateFrom + 'T00:00:00').getTime() - IST_OFFSET_MS)
                : null;
            filterEndDate = req.query.customDateTo
                ? new Date(new Date(req.query.customDateTo + 'T23:59:59').getTime() - IST_OFFSET_MS)
                : null;
            if (!filterStartDate && !filterEndDate) {
                filterStartDate = new Date(nowUTC - 86_400_000);
                filterEndDate   = new Date(nowUTC);
            }
            break;
        default:
            return todayRange();
    }

    console.log('🎯 FINAL DATE RANGE (IST):', {
        preset,
        filterStartDate: filterStartDate?.toISOString(),
        filterEndDate:   filterEndDate?.toISOString(),
        localStart: filterStartDate ? new Date(filterStartDate.getTime() + IST_OFFSET_MS).toLocaleString() : null,
        localEnd:   filterEndDate   ? new Date(filterEndDate.getTime()   + IST_OFFSET_MS).toLocaleString() : null,
    });

    return { filterStartDate, filterEndDate };
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const parseListParam = (param) => {
    if (!param) return [];
    if (Array.isArray(param)) return param.filter(Boolean);
    return param.includes(',')
        ? param.split(',').map(s => s.trim()).filter(Boolean)
        : [param];
};

const parseObjectIdList = (param) =>
    parseListParam(param)
        .filter(id => mongoose.Types.ObjectId.isValid(id))
        .map(id => new mongoose.Types.ObjectId(id));

// ─── QUERY BUILDER ────────────────────────────────────────────────────────────

const buildBaseQuery = (req, user, workflowStatuses = null) => {
    const queryFilters = {};
    const orGroups = [];

    // ── MULTI-TENANT ──────────────────────────────────────────────────────────
    if (user.role === 'super_admin' && user.tokenContext?.organizationIdentifier) {
        queryFilters.organizationIdentifier = user.tokenContext.organizationIdentifier;
        console.log(`🏢 [Super Admin Context] Filtering for organization: ${user.tokenContext.organizationIdentifier}`);
    } else if (user.role !== 'super_admin') {
        queryFilters.organizationIdentifier = user.organizationIdentifier;
        console.log(`🏢 [Multi-tenant] Filter applied for organization: ${user.organizationIdentifier}`);
    } else {
        console.log('🏢 [Super Admin] No organization filter - viewing all orgs');
    }

    // ── ASSIGNOR LAB RESTRICTIONS ─────────────────────────────────────────────
    if (user.role === 'assignor' || user.primaryRole === 'assignor') {
        const assignorLabAccessMode = user.roleConfig?.labAccessMode || 'all';
        const assignedLabs          = user.roleConfig?.assignedLabs  || [];
        console.log('🔍 [Assignor Lab Filter in Admin Controller]:', {
            userId: user._id, userName: user.fullName,
            labAccessMode: assignorLabAccessMode,
            assignedLabsCount: assignedLabs.length, assignedLabs,
        });
        if (assignorLabAccessMode === 'selected' && assignedLabs.length > 0) {
            queryFilters.sourceLab = { $in: assignedLabs.map(id => new mongoose.Types.ObjectId(id)) };
        } else if (assignorLabAccessMode === 'none') {
            queryFilters.sourceLab = null;
        }
    }

    // ── WORKFLOW STATUS ───────────────────────────────────────────────────────
    if (workflowStatuses?.length) {
        queryFilters.workflowStatus = workflowStatuses.length === 1
            ? workflowStatuses[0]
            : { $in: workflowStatuses };
    }

    // ── DATE ──────────────────────────────────────────────────────────────────
    const { filterStartDate, filterEndDate } = buildDateFilter(req);
    if (filterStartDate || filterEndDate) {
        const dateField = req.query.dateType === 'StudyDate' ? 'studyDate' : 'createdAt';
        queryFilters[dateField] = {};
        if (filterStartDate) queryFilters[dateField].$gte = filterStartDate;
        if (filterEndDate)   queryFilters[dateField].$lte = filterEndDate;
    }

    // ── SEARCH ────────────────────────────────────────────────────────────────
    if (req.query.search) {
        orGroups.push([
            { bharatPacsId:                      { $regex: req.query.search, $options: 'i' } },
            { accessionNumber:                   { $regex: req.query.search, $options: 'i' } },
            { studyInstanceUID:                  { $regex: req.query.search, $options: 'i' } },
            { 'patientInfo.patientName':         { $regex: req.query.search, $options: 'i' } },
            { 'patientInfo.patientID':           { $regex: req.query.search, $options: 'i' } },
            { 'clinicalHistory.clinicalHistory': { $regex: req.query.search, $options: 'i' } },
        ]);
    }

    // ── MODALITY ─────────────────────────────────────────────────────────────
     const modalities = parseListParam(req.query.modalities);
    if (modalities.length > 0) {
        console.log('🔬 [Modality Filter]:', { parsedModalities: modalities });
        // ✅ FIX: Only filter on modalitiesInStudy (modality field has bad defaults)
        queryFilters.modalitiesInStudy = { $in: modalities };
    } else if (req.query.modality && req.query.modality !== 'all') {
        queryFilters.modalitiesInStudy = req.query.modality;
    }

    // ── LAB (single legacy) ───────────────────────────────────────────────────
    if (req.query.labId && req.query.labId !== 'all' && mongoose.Types.ObjectId.isValid(req.query.labId)) {
        queryFilters.sourceLab = new mongoose.Types.ObjectId(req.query.labId);
    }

    // ── PRIORITY ─────────────────────────────────────────────────────────────
    const priorities = parseListParam(req.query.priorities);
    if (priorities.length > 0) {
        console.log('⚡ [Priority Multi-Filter]:', priorities);
        orGroups.push(
            priorities.length === 1
                ? [{ priority: priorities[0] }, { 'assignment.priority': priorities[0] }]
                : [{ priority: { $in: priorities } }, { 'assignment.priority': { $in: priorities } }]
        );
    } else if (req.query.priority && req.query.priority !== 'all') {
        const p = req.query.priority;
        orGroups.push([{ priority: p }, { 'assignment.priority': p }]);
    }

    // ── STUDY INSTANCE UIDs ───────────────────────────────────────────────────
    if (req.query.StudyInstanceUIDs && req.query.StudyInstanceUIDs !== 'undefined') {
        const uids = req.query.StudyInstanceUIDs.split(',').map(s => s.trim()).filter(Boolean);
        if (uids.length) queryFilters.studyInstanceUID = { $in: uids };
    }

    // ── RADIOLOGIST ───────────────────────────────────────────────────────────
    const radiologistIds = parseObjectIdList(req.query.radiologists);
    if (radiologistIds.length > 0) {
        queryFilters['assignment.assignedTo'] = { $in: radiologistIds };
        console.log('✅ [Radiologist Filter Applied]:', { count: radiologistIds.length });
    }

    // ── LAB (multi-select) ────────────────────────────────────────────────────
    const labIds = parseObjectIdList(req.query.labs);
    if (labIds.length > 0) {
        if (queryFilters.sourceLab?.$in) {
            const assignorSet  = new Set(queryFilters.sourceLab.$in.map(String));
            const intersection = labIds.filter(id => assignorSet.has(String(id)));
            queryFilters.sourceLab = intersection.length ? { $in: intersection } : null;
        } else {
            queryFilters.sourceLab = { $in: labIds };
        }
        console.log('✅ [Lab Filter Applied]:', { count: labIds.length, finalFilter: queryFilters.sourceLab });
    }

    // ── MERGE $or GROUPS (fix clobber bug) ────────────────────────────────────
    if (orGroups.length === 1) {
        queryFilters.$or = orGroups[0];
    } else if (orGroups.length > 1) {
        queryFilters.$and = orGroups.map(group => ({ $or: group }));
    }

    console.log('🎯 [Final Query Filters]:', JSON.stringify(queryFilters, null, 2));
    return queryFilters;
};

// ─── AGGREGATION PIPELINE BUILDER ────────────────────────────────────────────
/**
 * THE CORE OPTIMIZATION
 *
 * Original: 14 separate .populate() calls
 *   → Mongoose fires N additional queries per populate (one per unique foreign ID).
 *   → With 29 docs and 14 populates that's potentially hundreds of round-trips.
 *
 * Optimized: Single aggregation pipeline with targeted $lookup stages
 *   → MongoDB resolves all joins server-side in ONE network round-trip.
 *   → $lookup with pipeline + $in is the fastest join pattern in MongoDB 5+.
 *
 * Additional tricks:
 *   - $project at the START narrows the working set before any $lookup runs
 *   - Each $lookup uses $in (index scan) not $eq on array (collection scan)
 *   - $addFields with $arrayElemAt is used to flatten 1-to-1 lookups
 *   - No $unwind (expensive) — we use $first / $arrayElemAt instead
 */
const buildStudyAggregationPipeline = (queryFilters, skip, limit) => {
    // User fields we need from referenced collections
    const USER_FIELDS = {
        fullName: 1, firstName: 1, lastName: 1,
        email: 1, role: 1, organizationIdentifier: 1,
    };

    return [
        // ── STAGE 1: Filter (uses indexes) ────────────────────────────────────
        { $match: queryFilters },

        // ── STAGE 2: Sort before pagination ──────────────────────────────────
        { $sort: { createdAt: -1 } },

        // ── STAGE 3: $facet for parallel count + paginated slice ──────────────
        // This replaces the separate countDocuments call — both happen in one pass.
        {
            $facet: {
                metadata: [{ $count: 'total' }],
                data: [
                    { $skip: skip },
                    { $limit: limit },

                    // ── PROJECT: Only carry fields we actually need ───────────
                    // Dropping heavy unused fields before $lookup saves memory.
                    {
                        $project: {
                            _id: 1, bharatPacsId: 1, studyInstanceUID: 1,
                            orthancStudyID: 1, accessionNumber: 1,
                            organizationIdentifier: 1, organization: 1,
                            patientInfo: 1, patientId: 1, patient: 1,
                            age: 1, gender: 1,
                            modality: 1, modalitiesInStudy: 1,
                            studyDate: 1, studyTime: 1,
                            examDescription: 1, seriesCount: 1,
                            instanceCount: 1, seriesImages: 1,
                            workflowStatus: 1, currentCategory: 1,
                            priority: 1, caseType: 1, studyPriority: 1,
                            ReportAvailable: 1, reprintNeeded: 1,
                            hasStudyNotes: 1, hasAttachments: 1,
                            assignment: 1,
                            sourceLab: 1, labLocation: 1,
                            studyLock: 1,
                            currentReportStatus: 1,
                            reportInfo: 1,
                            revertInfo: 1,
                            calculatedTAT: 1,
                            categoryTracking: 1,
                            attachments: 1,
                            createdAt: 1, updatedAt: 1, reportDate: 1,
                            referringPhysicianName: 1, notesCount: 1,
                            clinicalHistory: 1, statusHistory: 1, printHistory: 1, followUp: 1, lastDownload: 1
                        },
                    },

                    // ── LOOKUP 1: sourceLab ───────────────────────────────────
                    {
                        $lookup: {
                            from: 'labs',
                            localField: 'sourceLab',
                            foreignField: '_id',
                            pipeline: [
                                { $project: { name: 1, labName: 1, identifier: 1, location: 1, contactPerson: 1, contactNumber: 1 } },
                            ],
                            as: '_sourceLab',
                        },
                    },
                    { $addFields: { sourceLab: { $arrayElemAt: ['$_sourceLab', 0] } } },
                    { $unset: '_sourceLab' },

                    // ── LOOKUP 2: organization ────────────────────────────────
                    {
                        $lookup: {
                            from: 'organizations',
                            localField: 'organization',
                            foreignField: '_id',
                            pipeline: [
                                { $project: { name: 1, identifier: 1, contactEmail: 1, contactPhone: 1, address: 1 } },
                            ],
                            as: '_org',
                        },
                    },
                    { $addFields: { organization: { $arrayElemAt: ['$_org', 0] } } },
                    { $unset: '_org' },

                    // ── LOOKUP 3: patient ─────────────────────────────────────
                    {
                        $lookup: {
                            from: 'patients',
                            localField: 'patient',
                            foreignField: '_id',
                            pipeline: [
                                { $project: { patientID: 1, patientNameRaw: 1, firstName: 1, lastName: 1, age: 1, gender: 1, dateOfBirth: 1, contactNumber: 1 } },
                            ],
                            as: '_patient',
                        },
                    },
                    { $addFields: { patient: { $arrayElemAt: ['$_patient', 0] } } },
                    { $unset: '_patient' },

                    // ── LOOKUP 4: studyLock.lockedBy ──────────────────────────
                    {
                        $lookup: {
                            from: 'users',
                            localField: 'studyLock.lockedBy',
                            foreignField: '_id',
                            pipeline: [{ $project: USER_FIELDS }],
                            as: '_lockedBy',
                        },
                    },
                    {
                        $addFields: {
                            'studyLock.lockedBy': { $arrayElemAt: ['$_lockedBy', 0] },
                        },
                    },
                    { $unset: '_lockedBy' },

                    // ── LOOKUP 5: assignment.assignedTo (array) ───────────────
                    // Collect all unique assignedTo IDs from the assignment array first,
                    // then do a single $lookup with $in — far cheaper than per-element lookups.
                    {
                        $lookup: {
                            from: 'users',
                            let: { ids: '$assignment.assignedTo' },
                            pipeline: [
                                { $match: { $expr: { $in: ['$_id', { $ifNull: ['$$ids', []] }] } } },
                                { $project: { ...USER_FIELDS } },
                            ],
                            as: '_assignedToUsers',
                        },
                    },
                    // ── LOOKUP 6: assignment.assignedBy (array) ───────────────
                    {
                        $lookup: {
                            from: 'users',
                            let: { ids: '$assignment.assignedBy' },
                            pipeline: [
                                { $match: { $expr: { $in: ['$_id', { $ifNull: ['$$ids', []] }] } } },
                                { $project: { ...USER_FIELDS } },
                            ],
                            as: '_assignedByUsers',
                        },
                    },
                    // Merge user docs back into assignment array elements
                    {
                        $addFields: {
                            assignment: {
                                $map: {
                                    input: { $ifNull: ['$assignment', []] },
                                    as: 'a',
                                    in: {
                                        $mergeObjects: [
                                            '$$a',
                                            {
                                                assignedTo: {
                                                    $arrayElemAt: [
                                                        {
                                                            $filter: {
                                                                input: '$_assignedToUsers',
                                                                cond: { $eq: ['$$this._id', '$$a.assignedTo'] },
                                                            },
                                                        },
                                                        0,
                                                    ],
                                                },
                                                assignedBy: {
                                                    $arrayElemAt: [
                                                        {
                                                            $filter: {
                                                                input: '$_assignedByUsers',
                                                                cond: { $eq: ['$$this._id', '$$a.assignedBy'] },
                                                            },
                                                        },
                                                        0,
                                                    ],
                                                },
                                            },
                                        ],
                                    },
                                },
                            },
                        },
                    },
                    { $unset: ['_assignedToUsers', '_assignedByUsers'] },

                    // ── LOOKUP 7: reportInfo.verificationInfo.verifiedBy ──────
                    {
                        $lookup: {
                            from: 'users',
                            localField: 'reportInfo.verificationInfo.verifiedBy',
                            foreignField: '_id',
                            pipeline: [{ $project: USER_FIELDS }],
                            as: '_verifiedBy',
                        },
                    },
                    {
                        $addFields: {
                            'reportInfo.verificationInfo.verifiedBy': { $arrayElemAt: ['$_verifiedBy', 0] },
                        },
                    },
                    { $unset: '_verifiedBy' },

                    // ── LOOKUP 8: currentReportStatus.lastReportedBy ──────────
                    {
                        $lookup: {
                            from: 'users',
                            localField: 'currentReportStatus.lastReportedBy',
                            foreignField: '_id',
                            pipeline: [{ $project: USER_FIELDS }],
                            as: '_lastReportedBy',
                        },
                    },
                    {
                        $addFields: {
                            'currentReportStatus.lastReportedBy': { $arrayElemAt: ['$_lastReportedBy', 0] },
                        },
                    },
                    { $unset: '_lastReportedBy' },

                    // ── LOOKUP 9-14: categoryTracking user refs ───────────────
                    // Batch all 6 categoryTracking user refs into a SINGLE $lookup each.
                    {
                        $lookup: {
                            from: 'users',
                            localField: 'categoryTracking.created.uploadedBy',
                            foreignField: '_id',
                            pipeline: [{ $project: USER_FIELDS }],
                            as: '_ctCreatedBy',
                        },
                    },
                    {
                        $addFields: {
                            'categoryTracking.created.uploadedBy': { $arrayElemAt: ['$_ctCreatedBy', 0] },
                        },
                    },
                    { $unset: '_ctCreatedBy' },

                    {
                        $lookup: {
                            from: 'users',
                            localField: 'categoryTracking.historyCreated.createdBy',
                            foreignField: '_id',
                            pipeline: [{ $project: USER_FIELDS }],
                            as: '_ctHistCreatedBy',
                        },
                    },
                    {
                        $addFields: {
                            'categoryTracking.historyCreated.createdBy': { $arrayElemAt: ['$_ctHistCreatedBy', 0] },
                        },
                    },
                    { $unset: '_ctHistCreatedBy' },

                    {
                        $lookup: {
                            from: 'users',
                            localField: 'categoryTracking.assigned.assignedTo',
                            foreignField: '_id',
                            pipeline: [{ $project: USER_FIELDS }],
                            as: '_ctAssignedTo',
                        },
                    },
                    {
                        $addFields: {
                            'categoryTracking.assigned.assignedTo': { $arrayElemAt: ['$_ctAssignedTo', 0] },
                        },
                    },
                    { $unset: '_ctAssignedTo' },

                    {
                        $lookup: {
                            from: 'users',
                            localField: 'categoryTracking.assigned.assignedBy',
                            foreignField: '_id',
                            pipeline: [{ $project: USER_FIELDS }],
                            as: '_ctAssignedBy',
                        },
                    },
                    {
                        $addFields: {
                            'categoryTracking.assigned.assignedBy': { $arrayElemAt: ['$_ctAssignedBy', 0] },
                        },
                    },
                    { $unset: '_ctAssignedBy' },

                    {
                        $lookup: {
                            from: 'users',
                            localField: 'categoryTracking.final.finalizedBy',
                            foreignField: '_id',
                            pipeline: [{ $project: USER_FIELDS }],
                            as: '_ctFinalizedBy',
                        },
                    },
                    {
                        $addFields: {
                            'categoryTracking.final.finalizedBy': { $arrayElemAt: ['$_ctFinalizedBy', 0] },
                        },
                    },
                    { $unset: '_ctFinalizedBy' },

                    {
                        $lookup: {
                            from: 'users',
                            localField: 'categoryTracking.urgent.markedUrgentBy',
                            foreignField: '_id',
                            pipeline: [{ $project: USER_FIELDS }],
                            as: '_ctUrgentBy',
                        },
                    },
                    {
                        $addFields: {
                            'categoryTracking.urgent.markedUrgentBy': { $arrayElemAt: ['$_ctUrgentBy', 0] },
                        },
                    },
                    { $unset: '_ctUrgentBy' },

                    // ── LOOKUP: attachments ───────────────────────────────────
                    // Resolve documentId refs within attachments array
                    {
                        $lookup: {
                            from: 'documents',
                            let: { ids: '$attachments.documentId' },
                            pipeline: [
                                { $match: { $expr: { $in: ['$_id', { $ifNull: ['$$ids', []] }] } } },
                                { $project: { fileName: 1, fileSize: 1, contentType: 1, uploadedAt: 1 } },
                            ],
                            as: '_attachmentDocs',
                        },
                    },
                    {
                        $lookup: {
                            from: 'users',
                            let: { ids: '$attachments.uploadedBy' },
                            pipeline: [
                                { $match: { $expr: { $in: ['$_id', { $ifNull: ['$$ids', []] }] } } },
                                { $project: { fullName: 1, email: 1, role: 1 } },
                            ],
                            as: '_attachmentUsers',
                        },
                    },
                    {
                        $addFields: {
                            attachments: {
                                $map: {
                                    input: { $ifNull: ['$attachments', []] },
                                    as: 'att',
                                    in: {
                                        $mergeObjects: [
                                            '$$att',
                                            {
                                                documentId: {
                                                    $arrayElemAt: [
                                                        {
                                                            $filter: {
                                                                input: '$_attachmentDocs',
                                                                cond: { $eq: ['$$this._id', '$$att.documentId'] },
                                                            },
                                                        },
                                                        0,
                                                    ],
                                                },
                                                uploadedBy: {
                                                    $arrayElemAt: [
                                                        {
                                                            $filter: {
                                                                input: '$_attachmentUsers',
                                                                cond: { $eq: ['$$this._id', '$$att.uploadedBy'] },
                                                            },
                                                        },
                                                        0,
                                                    ],
                                                },
                                            },
                                        ],
                                    },
                                },
                            },
                        },
                    },
                    { $unset: ['_attachmentDocs', '_attachmentUsers'] },
                ],
            },
        },
    ];
};

// ─── STUDY QUERY EXECUTOR ─────────────────────────────────────────────────────
/**
 * Uses a single aggregation pipeline instead of .find() + 14 .populate() calls.
 * Count and paginated data are fetched in ONE MongoDB round-trip via $facet.
 */
const executeStudyQuery = async (queryFilters, limit, page = 1) => {
    try {
        const skip = (page - 1) * limit;

        const pipeline = buildStudyAggregationPipeline(queryFilters, skip, limit);

        const [result] = await DicomStudy.aggregate(pipeline).allowDiskUse(false);

        const totalStudies = result.metadata[0]?.total ?? 0;
        const studies      = result.data ?? [];

        console.log(`📊 ADMIN QUERY EXECUTED: Found ${studies.length} studies (page ${page}/${Math.ceil(totalStudies / limit)}), Total: ${totalStudies}`);
        return { studies, totalStudies, currentPage: page };
    } catch (error) {
        console.error('❌ Error in executeStudyQuery:', error);
        throw error;
    }
};

// ─── CONTROLLERS ──────────────────────────────────────────────────────────────

// 🎯 GET DASHBOARD VALUES
export const getValues = async (req, res) => {
    console.log(`🔍 Fetching dashboard values with filters: ${JSON.stringify(req.query)}`);
    try {
        const startTime = Date.now();
        const user = req.user;
        if (!user) return res.status(401).json({ success: false, message: 'User not authenticated' });

        const queryFilters = buildBaseQuery(req, user);
        console.log('🔍 Dashboard query filters:', JSON.stringify(queryFilters, null, 2));

        const statusCategories = {
            pending: [
                'new_study_received', 'pending_assignment', 'assigned_to_doctor',
                'doctor_opened_report', 'report_in_progress',
                'report_downloaded_radiologist', 'report_downloaded', 'verification_pending',
            ],
            inprogress: ['report_finalized', 'report_drafted', 'report_uploaded', 'report_verified'],
            completed:  ['final_report_downloaded'],
        };

        const [facetResult] = await DicomStudy.aggregate([
            { $match: queryFilters },
            {
                $facet: {
                    statusGroups: [{ $group: { _id: '$workflowStatus', count: { $sum: 1 } } }],
                    total:        [{ $count: 'n' }],
                },
            },
        ]).allowDiskUse(false);

        const totalFiltered = facetResult.total[0]?.n ?? 0;
        let pending = 0, inprogress = 0, completed = 0;

        for (const { _id: status, count } of facetResult.statusGroups) {
            if      (statusCategories.pending.includes(status))    pending    += count;
            else if (statusCategories.inprogress.includes(status)) inprogress += count;
            else if (statusCategories.completed.includes(status))  completed  += count;
        }

        const processingTime = Date.now() - startTime;
        console.log(`🎯 Dashboard values fetched in ${processingTime}ms with filters applied`);

        const response = {
            success: true,
            total: totalFiltered,
            pending,
            inprogress,
            completed,
            performance: {
                queryTime: processingTime,
                fromCache: false,
                filtersApplied: Object.keys(queryFilters).length > 0,
            },
        };

        if (user.role === 'assignor') {
            const unassignedCondition = {
                $or: [
                    { workflowStatus: { $in: ['pending_assignment', 'awaiting_radiologist'] } },
                    { assignment: { $exists: false } },
                    { assignment: { $size: 0 } },
                    { assignment: null },
                    { assignment: { $not: { $elemMatch: { assignedTo: { $exists: true, $ne: null } } } } },
                ],
            };

            // ✅ FIX: Merge $or safely using $and so search filters are preserved
            const unassignedQuery = queryFilters.$or
                ? { ...queryFilters, $and: [...(queryFilters.$and || []), { $or: queryFilters.$or }, unassignedCondition] }
                : { ...queryFilters, ...unassignedCondition };
            delete unassignedQuery.$or; // prevent clobbering

            const [unassignedResult, overdueResult] = await Promise.allSettled([
                DicomStudy.countDocuments(unassignedQuery),
                DicomStudy.countDocuments({
                    ...queryFilters,
                    'assignment.status':     'assigned',
                    'assignment.assignedAt': { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
                }),
            ]);
            const totalUnassigned = unassignedResult.status === 'fulfilled' ? unassignedResult.value : 0;
            const overdueStudies  = overdueResult.status  === 'fulfilled' ? overdueResult.value  : 0;
            response.overview = { totalUnassigned, totalAssigned: totalFiltered - totalUnassigned, overdueStudies };
            console.log(`📊 ASSIGNOR ANALYTICS: Unassigned: ${totalUnassigned}, Assigned: ${response.overview.totalAssigned}, Overdue: ${overdueStudies}`);
        }

        if (process.env.NODE_ENV === 'development') {
            response.debug = {
                filtersApplied: queryFilters,
                rawStatusCounts: facetResult.statusGroups,
                userRole: user.role,
                organization: user.organizationIdentifier,
            };
        }

        res.status(200).json(response);
    } catch (error) {
        console.error('❌ Error fetching dashboard values:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching dashboard statistics.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined,
        });
    }
};

// 🟡 GET PENDING STUDIES
export const getPendingStudies = async (req, res) => {
    try {
        const startTime = Date.now();
        const limit = parseInt(req.query.limit) || 50;
        const page  = parseInt(req.query.page)  || 1;
        console.log(`🟡 PENDING: Fetching - Page: ${page}, Limit: ${limit}`);
        const user = req.user;
        if (!user) return res.status(401).json({ success: false, message: 'User not authenticated' });

        const pendingStatuses = WORKFLOW_STATUS_MAP.pending;
        const queryFilters    = buildBaseQuery(req, user, pendingStatuses);
        console.log('🔍 PENDING query filters:', JSON.stringify(queryFilters, null, 2));

        const { studies, totalStudies, currentPage } = await executeStudyQuery(queryFilters, limit, page);
        const processingTime = Date.now() - startTime;
        console.log(`✅ PENDING: Page ${currentPage} - ${studies.length} studies (Total: ${totalStudies})`);

        return res.status(200).json({
            success: true,
            count: studies.length,
            totalRecords: totalStudies,
            data: studies,
            pagination: {
                currentPage, totalPages: Math.ceil(totalStudies / limit),
                totalRecords: totalStudies, limit,
                hasNextPage: currentPage < Math.ceil(totalStudies / limit),
                hasPrevPage: currentPage > 1,
            },
            metadata: {
                category: 'pending', statusesIncluded: pendingStatuses,
                organizationFilter: user.role !== 'super_admin' ? user.organizationIdentifier : 'all',
                userRole: user.role, processingTime,
            },
        });
    } catch (error) {
        console.error('❌ PENDING: Error fetching pending studies:', error);
        res.status(500).json({ success: false, message: 'Server error fetching pending studies.', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
    }
};

// 🔵 GET IN-PROGRESS STUDIES
export const getInProgressStudies = async (req, res) => {
    try {
        const startTime = Date.now();
        const limit = parseInt(req.query.limit) || 50;
        const page  = parseInt(req.query.page)  || 1;
        console.log(`🔵 IN-PROGRESS: Fetching - Page: ${page}, Limit: ${limit}`);
        const user = req.user;
        if (!user) return res.status(401).json({ success: false, message: 'User not authenticated' });

        const inProgressStatuses = WORKFLOW_STATUS_MAP.inprogress;
        const queryFilters       = buildBaseQuery(req, user, inProgressStatuses);

        const { studies, totalStudies, currentPage } = await executeStudyQuery(queryFilters, limit, page);
        const processingTime = Date.now() - startTime;
        console.log(`✅ IN-PROGRESS: Page ${currentPage} - ${studies.length} studies (Total: ${totalStudies})`);

        return res.status(200).json({
            success: true,
            count: studies.length,
            totalRecords: totalStudies,
            data: studies,
            pagination: {
                currentPage, totalPages: Math.ceil(totalStudies / limit),
                totalRecords: totalStudies, limit,
                hasNextPage: currentPage < Math.ceil(totalStudies / limit),
                hasPrevPage: currentPage > 1,
            },
            metadata: {
                category: 'inprogress', statusesIncluded: inProgressStatuses,
                organizationFilter: user.role !== 'super_admin' ? user.organizationIdentifier : 'all',
                userRole: user.role, processingTime,
            },
        });
    } catch (error) {
        console.error('❌ IN-PROGRESS: Error fetching in-progress studies:', error);
        res.status(500).json({ success: false, message: 'Server error fetching in-progress studies.', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
    }
};

// 🟢 GET COMPLETED STUDIES
export const getCompletedStudies = async (req, res) => {
    try {
        const startTime = Date.now();
        const limit = parseInt(req.query.limit) || 50;
        const page  = parseInt(req.query.page)  || 1;
        console.log(`🟢 COMPLETED: Fetching - Page: ${page}, Limit: ${limit}`);
        const user = req.user;
        if (!user) return res.status(401).json({ success: false, message: 'User not authenticated' });

        const completedStatuses = WORKFLOW_STATUS_MAP.completed;
        const queryFilters      = buildBaseQuery(req, user, completedStatuses);

        const { studies, totalStudies, currentPage } = await executeStudyQuery(queryFilters, limit, page);
        const processingTime = Date.now() - startTime;
        console.log(`✅ COMPLETED: Page ${currentPage} - ${studies.length} studies (Total: ${totalStudies})`);

        return res.status(200).json({
            success: true,
            count: studies.length,
            totalRecords: totalStudies,
            data: studies,
            pagination: {
                currentPage, totalPages: Math.ceil(totalStudies / limit),
                totalRecords: totalStudies, limit,
                hasNextPage: currentPage < Math.ceil(totalStudies / limit),
                hasPrevPage: currentPage > 1,
            },
            metadata: {
                category: 'completed', statusesIncluded: completedStatuses,
                organizationFilter: user.role !== 'super_admin' ? user.organizationIdentifier : 'all',
                userRole: user.role, processingTime,
            },
        });
    } catch (error) {
        console.error('❌ COMPLETED: Error fetching completed studies:', error);
        res.status(500).json({ success: false, message: 'Server error fetching completed studies.', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
    }
};

// ✅ GET CATEGORY VALUES
export const getCategoryValues = async (req, res) => {
    const startTime = Date.now();
    try {
        const user = req.user;
        const queryFilters = buildBaseQuery(req, user);

        console.log('🔍 Category query filters:', JSON.stringify(queryFilters, null, 2));

        // ✅ MUST EXACTLY MATCH getStudiesByCategory switch cases
        const STATUS_TO_CATEGORY = {
            // case 'created' → workflowStatus = 'new_study_received'
            new_study_received: 'created',

            // case 'history-created' → workflowStatus = 'history_created'
            history_created: 'history_created',

            // case 'assigned' → workflowStatus = 'assigned_to_doctor'
            assigned_to_doctor: 'assigned',

            // case 'pending' → { $in: ['new_study_received', 'history_created', 'assigned_to_doctor', 'doctor_opened_report'] }
            // NOTE: new_study_received, history_created, assigned_to_doctor already counted above
            // pending tab TOTAL = created + history_created + assigned + doctor_opened_report
            doctor_opened_report: 'pending',

            report_drafted: 'draft',

             verification_pending: 'verification_pending',

            report_completed: 'final',
            final_report_downloaded: 'final',

            study_reverted: 'reverted',
            report_rejected: 'reverted',
            revert_to_radiologist: 'reverted',

            report_reprint_needed: 'reprint_need',
        };

        const [facetResult, unassignedCount, urgentCount, pendingCount] = await Promise.all([
            // ── Single aggregation for all status-based counts ──────────────
            DicomStudy.aggregate([
                { $match: queryFilters },
                {
                    $facet: {
                        statusGroups: [
                            { $group: { _id: '$workflowStatus', count: { $sum: 1 } } }
                        ],
                        total: [{ $count: 'n' }],
                    },
                },
            ]).allowDiskUse(false),

            // ── UNASSIGNED: exactly matches case 'unassigned' ───────────────
            DicomStudy.countDocuments({
                ...queryFilters,
                workflowStatus: { $in: ['new_study_received', 'history_created'] },
            }),

            // ── URGENT: exactly matches case 'urgent' ───────────────────────
            DicomStudy.countDocuments({
                ...queryFilters,
                $or: [
                    { priority: { $in: ['EMERGENCY', 'PRIORITY'] } },
                    { 'assignment.priority': { $in: ['EMERGENCY', 'PRIORITY'] } }
                ],
            }),

            // ── PENDING: exactly matches case 'pending' ─────────────────────
            DicomStudy.countDocuments({
                ...queryFilters,
                workflowStatus: { 
                    $in: [
                        'new_study_received', 
                        'history_created', 
                        'assigned_to_doctor', 
                        'doctor_opened_report',
                        'verification_pending', // ✅ ADD THIS
                    ] 
                },
            }),
        ]);

        // ── Build counts from facet result ──────────────────────────────────
        const counts = {
            created: 0,
            history_created: 0,
            assigned: 0,
            draft: 0,
            verification_pending: 0,
            final: 0,
            reverted: 0,
            reprint_need: 0,
        };

        const statusGroups = facetResult[0]?.statusGroups ?? [];
        const allCount     = facetResult[0]?.total[0]?.n  ?? 0;

        for (const { _id: status, count } of statusGroups) {
            const category = STATUS_TO_CATEGORY[status];
            if (category && counts[category] !== undefined) {
                counts[category] += count;
            }
        }

        const processingTime = Date.now() - startTime;
        console.log(`🎯 Category values fetched in ${processingTime}ms`);
        console.log(`📊 STATUS GROUPS:`, statusGroups);
        console.log(`📊 COUNTS:`, {
            all: allCount,
            ...counts,
            unassigned: unassignedCount,
            pending: pendingCount,
            urgent: urgentCount,
        });

        return res.status(200).json({
            success: true,
            all:                  allCount,
            created:              counts.created,
            history_created:      counts.history_created,
            unassigned:           unassignedCount,       // ✅ countDocuments exact match
            assigned:             counts.assigned,
            pending:              pendingCount,          // ✅ countDocuments exact match
            draft:                counts.draft,
            verification_pending: counts.verification_pending,
            final:                counts.final,          // ✅ only report_completed
            urgent:               urgentCount,           // ✅ countDocuments exact match
            reprint_need:         counts.reprint_need,
            reverted:             counts.reverted,
            processingTime,
        });

    } catch (error) {
        console.error('❌ Error fetching category values:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch category values',
            error: error.message,
        });
    }
};

// ✅ GET STUDIES BY CATEGORY
export const getStudiesByCategory = async (req, res) => {
    try {
        const startTime = Date.now();
        const limit = parseInt(req.query.limit) || 50;
        const page  = parseInt(req.query.page)  || 1;
        const { category } = req.params;
        const user = req.user;
        if (!user) return res.status(401).json({ success: false, message: 'User not authenticated' });

        console.log(`🔍 [${category.toUpperCase()}] Fetching studies - Page: ${page}, Limit: ${limit}`);

        const queryFilters = buildBaseQuery(req, user);

        switch (category) {
            case 'created':
                // ✅ CREATED: Only new_study_received
                queryFilters.workflowStatus = 'new_study_received';
                console.log('📋 [CREATED] Filtering: new_study_received');
                break;

            case 'history-created':
                // ✅ HISTORY-CREATED: Only history_created status
                queryFilters.workflowStatus = 'history_created';
                console.log('📋 [HISTORY-CREATED] Filtering: history_created');
                break;

            case 'unassigned':
                // ✅ UNASSIGNED: new_study_received + history_created
                queryFilters.workflowStatus = { $in: ['new_study_received', 'history_created'] };
                console.log('📋 [UNASSIGNED] Filtering: new_study_received, history_created');
                break;

            case 'assigned':
                // ✅ ASSIGNED: assigned_to_doctor
                queryFilters.workflowStatus = 'assigned_to_doctor';
                console.log('📋 [ASSIGNED] Filtering: assigned_to_doctor');
                break;

            case 'pending':
                // ✅ PENDING: includes verification_pending
                queryFilters.workflowStatus = { 
                    $in: [
                        'new_study_received', 
                        'history_created', 
                        'assigned_to_doctor', 
                        'doctor_opened_report',
                        'verification_pending', // ✅ ADD THIS
                    ] 
                };
                console.log('📋 [PENDING] Filtering: new_study_received, history_created, assigned_to_doctor, doctor_opened_report, verification_pending');
                break;

            case 'draft':
                // ✅ DRAFT: report_drafted
                queryFilters.workflowStatus = 'report_drafted';
                console.log('📋 [DRAFT] Filtering: report_drafted');
                break;

            case 'verification-pending':
                // ✅ VERIFICATION-PENDING: verification_pending
                queryFilters.workflowStatus = 'verification_pending';
                console.log('📋 [VERIFICATION-PENDING] Filtering: verification_pending');
                break;

            case 'final':
                // ✅ FINAL: report_completed or final_report_downloaded
                queryFilters.workflowStatus = { $in: ['report_completed', 'final_report_downloaded'] };
                console.log('📋 [FINAL] Filtering: report_completed, final_report_downloaded');
                break;

            case 'reverted':
                // ✅ REVERTED: study_reverted + report_rejected
                queryFilters.workflowStatus = { $in: ['study_reverted', 'report_rejected', 'revert_to_radiologist'] };
                console.log('📋 [REVERTED] Filtering: study_reverted, report_rejected');
                break;

            case 'urgent':
                // ✅ URGENT: EMERGENCY + PRIORITY
                queryFilters.$or = [
                    { priority: { $in: ['EMERGENCY', 'PRIORITY'] } },
                    { 'assignment.priority': { $in: ['EMERGENCY', 'PRIORITY'] } }
                ];
                console.log('🚨 [URGENT] Filtering by priority: EMERGENCY, PRIORITY');
                break;

            case 'reprint-need':
                // ✅ REPRINT-NEED: report_reprint_needed
                queryFilters.workflowStatus = 'report_reprint_needed';
                console.log('📋 [REPRINT-NEED] Filtering: report_reprint_needed');
                break;

            default:
                console.log(`⚠️  Unknown category: ${category}`);
                break;
        }

        const { studies, totalStudies, currentPage } = await executeStudyQuery(queryFilters, limit, page);
        const processingTime = Date.now() - startTime;
        console.log(`✅ [${category.toUpperCase()}]: Page ${currentPage} - ${studies.length} studies (Total: ${totalStudies})`);

        return res.status(200).json({
            success: true,
            count: studies.length,
            totalRecords: totalStudies,
            data: studies,
            pagination: {
                currentPage, totalPages: Math.ceil(totalStudies / limit),
                totalRecords: totalStudies, limit,
                hasNextPage: currentPage < Math.ceil(totalStudies / limit),
                hasPrevPage: currentPage > 1,
            },
            metadata: {
                category,
                filterType: category === 'urgent' ? 'priority' : 'workflowStatus',
                filterValue: category === 'urgent' ? queryFilters.studyPriority : (queryFilters.workflowStatus?.$in || 'all'),
                organizationFilter: user.role !== 'super_admin' ? user.organizationIdentifier : 'all',
                userRole: user.role, 
                processingTime,
            },
        });
    } catch (error) {
        console.error(`❌ [${req.params.category?.toUpperCase()}]: Error fetching studies:`, error);
        res.status(500).json({ success: false, message: 'Server error fetching studies.', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
    }
};

// ✅ GET ALL STUDIES FOR ADMIN
export const getAllStudiesForAdmin = async (req, res) => {
    try {
        const startTime = Date.now();
        const limit = parseInt(req.query.limit) || 50;
        const page  = parseInt(req.query.page)  || 1;
        const user  = req.user;
        if (!user) return res.status(401).json({ success: false, message: 'User not authenticated' });

        console.log(`🔍 [ALL STUDIES] Fetching - Page: ${page}, Limit: ${limit}`);

        let workflowStatuses = null;
        if (req.query.category && req.query.category !== 'all') {
            workflowStatuses = WORKFLOW_STATUS_MAP[req.query.category] ?? null;
        }

        const queryFilters = buildBaseQuery(req, user, workflowStatuses);
        const { studies, totalStudies, currentPage } = await executeStudyQuery(queryFilters, limit, page);

        const processingTime = Date.now() - startTime;
        console.log(`✅ [ALL STUDIES]: Page ${currentPage} - ${studies.length} studies (Total: ${totalStudies}) in ${processingTime}ms`);

        return res.status(200).json({
            success: true,
            count: studies.length,
            totalRecords: totalStudies,
            data: studies,
            pagination: {
                currentPage, totalPages: Math.ceil(totalStudies / limit),
                totalRecords: totalStudies, limit,
                hasNextPage: currentPage < Math.ceil(totalStudies / limit),
                hasPrevPage: currentPage > 1,
            },
            metadata: {
                category: req.query.category || 'all',
                statusesIncluded: workflowStatuses || 'all',
                organizationFilter: user.role !== 'super_admin' ? user.organizationIdentifier : 'all',
                userRole: user.role,
                processingTime,
                appliedFilters: {
                    modality: req.query.modality || 'all',
                    labId:    req.query.labId    || 'all',
                    priority: req.query.priority || 'all',
                    search:   req.query.search   || null,
                    dateType: req.query.dateType || 'createdAt',
                },
            },
        });
    } catch (error) {
        console.error('❌ ALL STUDIES: Error fetching studies:', error);
        res.status(500).json({ success: false, message: 'Server error fetching studies.', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
    }
};

// ✅ GET ALL LABS IN ORGANIZATION
export const getOrganizationLabs = async (req, res) => {
    try {
        const userRole      = req.user.role;
        const orgIdentifier = req.user.organizationIdentifier;
        const query = { isActive: true };
        if (userRole !== 'super_admin') query.organizationIdentifier = orgIdentifier;

        const labs = await Lab.find(query)
            .populate('organization', 'name displayName identifier')
            .select('name identifier contactPerson contactEmail settings isActive')
            .sort({ name: 1 })
            .lean();

        console.log(`✅ Found ${labs.length} labs for organization ${orgIdentifier || 'all'}`);
        res.json({ success: true, data: labs, count: labs.length });
    } catch (error) {
        console.error('❌ Get organization labs error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch labs' });
    }
};



// Update the imports at the top - REMOVE AuditLog

// import mongoose from 'mongoose';
// import DicomStudy from '../models/dicomStudyModel.js';
// import User from '../models/userModel.js';
// import Lab from '../models/labModel.js';
// import Organization from '../models/organisation.js';
// import StudyNotes from '../models/studyNotesModel.js';
// import Document from '../models/documentModal.js';
// import { formatStudiesForWorklist } from '../utils/formatStudies.js';

export const deleteStudy = async (req, res) => {
    try {
        const { studyId } = req.params;
        const user = req.user;

        // ✅ CRITICAL: Only super_admin can delete studies
        if (user.role !== 'super_admin') {
            return res.status(403).json({
                success: false,
                message: 'Only super_admin can delete studies'
            });
        }

        // ✅ Validate study ID
        if (!mongoose.Types.ObjectId.isValid(studyId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid study ID format'
            });
        }

        // ✅ Find the study
        const study = await DicomStudy.findById(studyId);
        if (!study) {
            return res.status(404).json({
                success: false,
                message: 'Study not found'
            });
        }

        // ✅ Log deletion action
        console.log(`🗑️ [DELETE] Study deleted by super_admin:`, {
            studyId: study._id,
            bharatPacsId: study.bharatPacsId,
            deletedBy: user.fullName,
            deletedAt: new Date(),
            patientName: study.patientName || study.patientInfo?.patientName || 'Unknown'
        });

        // ✅ Delete associated documents/attachments from storage
        if (study.attachments && study.attachments.length > 0) {
            for (const attachment of study.attachments) {
                try {
                    // Find and delete document
                    const doc = await Document.findById(attachment.documentId);
                    if (doc && doc.wasabiKey) {
                        try {
                            // Delete from Wasabi S3
                            const deleteCommand = new DeleteObjectCommand({
                                Bucket: doc.wasabiBucket,
                                Key: doc.wasabiKey
                            });
                            await wasabiS3Client.send(deleteCommand);
                            console.log(`✅ [Wasabi] Deleted attachment: ${doc.wasabiKey}`);
                        } catch (wasabiError) {
                            console.warn(`⚠️ [Wasabi] Failed to delete from S3:`, wasabiError.message);
                        }
                    }
                    // Delete document record from DB
                    await Document.findByIdAndDelete(attachment.documentId);
                } catch (docError) {
                    console.warn(`⚠️ Failed to delete attachment:`, docError.message);
                }
            }
            console.log(`✅ Deleted ${study.attachments.length} attachment(s)`);
        }

        // ✅ Delete associated study notes
        if (study._id) {
            try {
                const result = await StudyNotes.deleteMany({ studyId: study._id });
                console.log(`✅ Deleted ${result.deletedCount} study note(s)`);
            } catch (notesError) {
                console.warn(`⚠️ Failed to delete study notes:`, notesError.message);
            }
        }

        // ✅ Delete the study from database
        await DicomStudy.findByIdAndDelete(studyId);
        console.log(`✅ [Database] Study deleted: ${study.bharatPacsId}`);

        return res.json({
            success: true,
            message: 'Study deleted successfully',
            data: {
                deletedStudyId: studyId,
                bharatPacsId: study.bharatPacsId,
                patientName: study.patientName || study.patientInfo?.patientName || 'Unknown',
                deletedAt: new Date()
            }
        });

    } catch (error) {
        console.error('❌ [Delete Study] Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete study',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ✅ SIMPLIFIED: Bulk delete - NO ORTHANC, NO AUDIT LOG
export const bulkDeleteStudies = async (req, res) => {
    try {
        const { studyIds } = req.body;
        const user = req.user;

        // ✅ CRITICAL: Only super_admin can delete studies
        if (user.role !== 'super_admin') {
            return res.status(403).json({
                success: false,
                message: 'Only super_admin can delete studies'
            });
        }

        if (!Array.isArray(studyIds) || studyIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No study IDs provided'
            });
        }

        const results = {
            successful: [],
            failed: [],
            totalRequested: studyIds.length
        };

        console.log(`🗑️ [BULK DELETE] Starting bulk delete for ${studyIds.length} studies...`);

        // ✅ Delete each study
        for (const studyId of studyIds) {
            try {
                if (!mongoose.Types.ObjectId.isValid(studyId)) {
                    results.failed.push({ studyId, reason: 'Invalid study ID format' });
                    continue;
                }

                const study = await DicomStudy.findById(studyId);
                if (!study) {
                    results.failed.push({ studyId, reason: 'Study not found' });
                    continue;
                }

                // Delete attachments
                if (study.attachments && study.attachments.length > 0) {
                    for (const attachment of study.attachments) {
                        try {
                            const doc = await Document.findById(attachment.documentId);
                            if (doc && doc.wasabiKey) {
                                try {
                                    const deleteCommand = new DeleteObjectCommand({
                                        Bucket: doc.wasabiBucket,
                                        Key: doc.wasabiKey
                                    });
                                    await wasabiS3Client.send(deleteCommand);
                                } catch (wasabiError) {
                                    console.warn(`⚠️ [Wasabi] Failed to delete for ${studyId}`);
                                }
                            }
                            await Document.findByIdAndDelete(attachment.documentId);
                        } catch (docError) {
                            console.warn(`⚠️ Failed to delete attachment for ${studyId}`);
                        }
                    }
                }

                // Delete study notes
                try {
                    await StudyNotes.deleteMany({ studyId: study._id });
                } catch (notesError) {
                    console.warn(`⚠️ Failed to delete notes for ${studyId}`);
                }

                // Delete the study from database
                await DicomStudy.findByIdAndDelete(studyId);

                results.successful.push({
                    studyId,
                    bharatPacsId: study.bharatPacsId,
                    patientName: study.patientName || study.patientInfo?.patientName || 'Unknown'
                });

                console.log(`✅ Deleted: ${study.bharatPacsId}`);

            } catch (error) {
                results.failed.push({
                    studyId,
                    reason: error.message
                });
                console.error(`❌ Failed to delete ${studyId}:`, error.message);
            }
        }

        const message = results.successful.length === studyIds.length
            ? `✅ All ${results.successful.length} studies deleted successfully`
            : `⚠️ ${results.successful.length}/${studyIds.length} studies deleted (${results.failed.length} failed)`;

        console.log(`🗑️ [BULK DELETE] Complete:`, message);

        return res.json({
            success: results.successful.length > 0,
            message,
            data: results
        });

    } catch (error) {
        console.error('❌ [Bulk Delete Studies] Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to bulk delete studies',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

export default {
    getValues,
    getCategoryValues,
    getStudiesByCategory,
    getPendingStudies,
    getInProgressStudies,
    getCompletedStudies,
    getAllStudiesForAdmin,
    getOrganizationLabs,
    deleteStudy,
    bulkDeleteStudies
};