import ExcelJS from 'exceljs';
import mongoose from 'mongoose';
import NodeCache from 'node-cache';

import DicomStudy from '../models/dicomStudyModel.js';
import Lab from '../models/labModel.js';
import Doctor from '../models/doctorModel.js';

const cache = new NodeCache({
    stdTTL: 300,
    checkperiod: 120,
    useClones: false
});

const TAT_STATUS = {
    UPLOAD: ['new_study_received'],
    ASSIGNED: ['assigned_to_doctor'],
    REPORT_COMPLETED: ['report_completed'],
    FINAL_DOWNLOAD: ['final_report_downloaded']
};

const toValidDate = (value) => {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

const calculateMinutesDiff = (start, end) => {
    const s = toValidDate(start);
    const e = toValidDate(end);
    if (!s || !e) return null;
    const diff = e.getTime() - s.getTime();
    if (diff < 0) return null;
    return Math.round(diff / 60000);
};

const formatMinutes = (minutes) => {
    if (minutes === null || minutes === undefined) return '-';
    if (minutes < 60) return `${minutes}m`;

    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

const pickStatusTime = (statusHistory = [], statuses = [], mode = 'latest') => {
    if (!Array.isArray(statusHistory) || statusHistory.length === 0) return null;

    const times = statusHistory
        .filter((entry) => entry && statuses.includes(entry.status))
        .map((entry) => toValidDate(entry.changedAt))
        .filter(Boolean)
        .sort((a, b) => a.getTime() - b.getTime());

    if (times.length === 0) return null;
    return mode === 'first' ? times[0] : times[times.length - 1];
};

const computeStatusHistoryTat = (study) => {
    const statusHistory = Array.isArray(study.statusHistory) ? study.statusHistory : [];

    const uploadedAt = pickStatusTime(statusHistory, TAT_STATUS.UPLOAD, 'first') || toValidDate(study.createdAt);
    const assignedAt = pickStatusTime(statusHistory, TAT_STATUS.ASSIGNED, 'latest');
    const reportCompletedAt =
        pickStatusTime(statusHistory, TAT_STATUS.REPORT_COMPLETED, 'latest') ||
        toValidDate(study.reportInfo?.finalizedAt);
    const finalDownloadedAt = pickStatusTime(statusHistory, TAT_STATUS.FINAL_DOWNLOAD, 'latest');

    const uploadToAssignedMinutes = calculateMinutesDiff(uploadedAt, assignedAt);
    const uploadToReportCompletedMinutes = calculateMinutesDiff(uploadedAt, reportCompletedAt);
    const assignedToReportCompletedMinutes = calculateMinutesDiff(assignedAt, reportCompletedAt);
    const uploadToFinalDownloadMinutes = calculateMinutesDiff(uploadedAt, finalDownloadedAt);

    return {
        uploadedAt,
        assignedAt,
        reportCompletedAt,
        finalDownloadedAt,

        uploadToAssignedLatestMinutes: uploadToAssignedMinutes,
        uploadToAssignedLatestFormatted: formatMinutes(uploadToAssignedMinutes),

        uploadToReportCompletedMinutes,
        uploadToReportCompletedFormatted: formatMinutes(uploadToReportCompletedMinutes),

        assignedToReportCompletedMinutes,
        assignedToReportCompletedFormatted: formatMinutes(assignedToReportCompletedMinutes),

        uploadToFinalDownloadMinutes,
        uploadToFinalDownloadFormatted: formatMinutes(uploadToFinalDownloadMinutes)
    };
};

const getISTStartOfDayUTC = (dateString) => {
    const d = new Date(dateString);
    if (Number.isNaN(d.getTime())) return null;

    const y = d.getUTCFullYear();
    const m = d.getUTCMonth();
    const day = d.getUTCDate();
    const utcMs = Date.UTC(y, m, day, 0, 0, 0, 0) - (5.5 * 60 * 60 * 1000);
    return new Date(utcMs);
};

const getISTEndOfDayUTC = (dateString) => {
    const d = new Date(dateString);
    if (Number.isNaN(d.getTime())) return null;

    const y = d.getUTCFullYear();
    const m = d.getUTCMonth();
    const day = d.getUTCDate();
    const utcMs = Date.UTC(y, m, day, 23, 59, 59, 999) - (5.5 * 60 * 60 * 1000);
    return new Date(utcMs);
};

const formatDateIST = (value) => {
    const date = toValidDate(value);
    if (!date) return '-';
    return date.toLocaleString('en-GB', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
};

const getDateFieldByType = (dateType) => {
    switch (dateType) {
        case 'studyDate': return 'studyDate';
        case 'assignedDate': return 'assignment.assignedAt';
        case 'reportDate': return 'reportInfo.finalizedAt';
        case 'uploadDate':
        default:
            return 'createdAt';
    }
};

const buildCommonPipeline = ({ user, location, status, dateType, fromDate, toDate }) => {
    const pipeline = [];

    const match = {};
    if (user?.role !== 'super_admin' && user?.organizationIdentifier) {
        match.organizationIdentifier = user.organizationIdentifier;
    }

    if (location && mongoose.Types.ObjectId.isValid(location)) {
        match.sourceLab = new mongoose.Types.ObjectId(location);
    }

    if (status) {
        match.workflowStatus = status;
    }

    if (Object.keys(match).length > 0) {
        pipeline.push({ $match: match });
    }

    if (fromDate && toDate) {
        const start = getISTStartOfDayUTC(fromDate);
        const end = getISTEndOfDayUTC(toDate);
        if (start && end) {
            const field = getDateFieldByType(dateType);
            pipeline.push({ $match: { [field]: { $gte: start, $lte: end } } });
        }
    }

    pipeline.push(
        {
            $lookup: {
                from: 'patients',
                localField: 'patient',
                foreignField: '_id',
                as: 'patientData',
                pipeline: [
                    {
                        $project: {
                            patientID: 1,
                            firstName: 1,
                            lastName: 1,
                            patientNameRaw: 1,
                            gender: 1,
                            'computed.fullName': 1
                        }
                    }
                ]
            }
        },
        {
            $lookup: {
                from: 'labs',
                localField: 'sourceLab',
                foreignField: '_id',
                as: 'labData',
                pipeline: [{ $project: { name: 1, identifier: 1 } }]
            }
        },
        {
            $lookup: {
                from: 'doctors',
                localField: 'assignment.assignedTo',
                foreignField: '_id',
                as: 'doctorData',
                pipeline: [
                    {
                        $lookup: {
                            from: 'users',
                            localField: 'userAccount',
                            foreignField: '_id',
                            as: 'userAccount',
                            pipeline: [{ $project: { fullName: 1, _id: 1 } }]
                        }
                    },
                    { $project: { userAccount: 1, specialization: 1, _id: 1 } }
                ]
            }
        },
        {
            $lookup: {
                from: 'documents',
                localField: '_id',
                foreignField: 'studyId',
                as: 'documentData',
                pipeline: [
                    { $match: { documentType: 'clinical' } },
                    { $sort: { uploadedAt: -1 } },
                    { $limit: 1 },
                    {
                        $lookup: {
                            from: 'users',
                            localField: 'uploadedBy',
                            foreignField: '_id',
                            as: 'uploaderInfo',
                            pipeline: [{ $project: { _id: 1, fullName: 1 } }]
                        }
                    },
                    {
                        $project: {
                            uploadedBy: 1,
                            uploadedAt: 1,
                            uploaderInfo: { $arrayElemAt: ['$uploaderInfo', 0] }
                        }
                    }
                ]
            }
        },
        {
            $project: {
                workflowStatus: 1,
                studyDate: 1,
                createdAt: 1,
                accessionNumber: 1,
                examDescription: 1,
                modality: 1,
                modalitiesInStudy: 1,
                referredBy: 1,
                seriesCount: 1,
                instanceCount: 1,
                assignment: 1,
                reportInfo: 1,
                statusHistory: 1,
                calculatedTAT: 1,
                patient: { $arrayElemAt: ['$patientData', 0] },
                lab: { $arrayElemAt: ['$labData', 0] },
                doctor: { $arrayElemAt: ['$doctorData', 0] },
                documentData: { $arrayElemAt: ['$documentData', 0] }
            }
        }
    );

    return pipeline;
};

const processStudies = (studies, selectedDoctor) => {
    const mapped = studies.map((study) => {
        const statusTat = computeStatusHistoryTat(study);
        const patient = study.patient || {};
        const patientName =
            patient.computed?.fullName ||
            (patient.firstName && patient.lastName ? `${patient.lastName}, ${patient.firstName}` : patient.patientNameRaw) ||
            '-';

        const uploadedById = study.documentData?.uploadedBy ? study.documentData.uploadedBy.toString() : null;
        const assignedDoctorId = study.assignment?.[0]?.assignedTo
            ? study.assignment[0].assignedTo.toString()
            : (study.assignment?.assignedTo ? study.assignment.assignedTo.toString() : null);

        return {
            _id: study._id,
            studyStatus: study.workflowStatus || '-',
            patientId: patient.patientID || '-',
            patientName,
            gender: patient.gender || '-',
            referredBy: study.referredBy || '-',
            accessionNumber: study.accessionNumber || '-',
            studyDescription: study.examDescription || '-',
            modality: Array.isArray(study.modalitiesInStudy) && study.modalitiesInStudy.length > 0
                ? study.modalitiesInStudy.join(', ')
                : (study.modality || '-'),
            seriesImages: `${study.seriesCount || 0}/${study.instanceCount || 0}`,
            institutionName: study.lab?.name || '-',
            uploadDate: formatDateIST(study.createdAt),
            assignedDate: formatDateIST(statusTat.assignedAt),
            reportDate: formatDateIST(statusTat.reportCompletedAt),
            finalDownloadDate: formatDateIST(statusTat.finalDownloadedAt),
            reportedBy: study.reportInfo?.reporterName || study.doctor?.userAccount?.[0]?.fullName || '-',
            assignedDoctorId,
            uploadedById,
            uploaderName: study.documentData?.uploaderInfo?.fullName || '-',
            statusTatMetrics: statusTat,
            calculatedTAT: {
                ...(study.calculatedTAT || {}),
                uploadToAssignmentTAT: statusTat.uploadToAssignedLatestMinutes,
                uploadToAssignmentTATFormatted: statusTat.uploadToAssignedLatestFormatted,
                uploadToReportTAT: statusTat.uploadToReportCompletedMinutes,
                uploadToReportTATFormatted: statusTat.uploadToReportCompletedFormatted,
                assignmentToReportTAT: statusTat.assignedToReportCompletedMinutes,
                assignmentToReportTATFormatted: statusTat.assignedToReportCompletedFormatted,
                uploadToFinalDownloadTAT: statusTat.uploadToFinalDownloadMinutes,
                uploadToFinalDownloadTATFormatted: statusTat.uploadToFinalDownloadFormatted
            }
        };
    });

    if (selectedDoctor) {
        return mapped.filter((study) => study.uploadedById === selectedDoctor);
    }

    return mapped;
};

const queryTatStudies = async ({ req, forExport = false }) => {
    const {
        location,
        dateType = 'uploadDate',
        fromDate,
        toDate,
        status,
        selectedDoctor,
        page = 1,
        limit = 200
    } = req.query;

    const cacheKey = `tat:${req.user?._id}:${location || 'all'}:${dateType}:${fromDate || '-'}:${toDate || '-'}:${status || '-'}:${selectedDoctor || '-'}:${page}:${limit}:${forExport ? 'export' : 'view'}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const pipeline = buildCommonPipeline({
        user: req.user,
        location,
        status,
        dateType,
        fromDate,
        toDate
    });

    pipeline.push({ $sort: { createdAt: -1 } });

    if (!forExport) {
        const pageNum = Number.parseInt(page, 10) || 1;
        const pageSize = Math.max(1, Math.min(Number.parseInt(limit, 10) || 200, 2000));
        const skip = (pageNum - 1) * pageSize;

        pipeline.push({ $skip: skip }, { $limit: pageSize });
    }

    const rawStudies = await DicomStudy.aggregate(pipeline).allowDiskUse(true);
    const processedStudies = processStudies(rawStudies, selectedDoctor);

    const reported = processedStudies.filter((s) => s.statusTatMetrics.uploadToReportCompletedMinutes !== null);
    const avgUploadToReport = reported.length > 0
        ? Math.round(reported.reduce((acc, cur) => acc + cur.statusTatMetrics.uploadToReportCompletedMinutes, 0) / reported.length)
        : 0;
    const avgAssignToReport = reported.length > 0
        ? Math.round(reported.reduce((acc, cur) => acc + (cur.statusTatMetrics.assignedToReportCompletedMinutes || 0), 0) / reported.length)
        : 0;

    const payload = {
        studies: processedStudies,
        summary: {
            totalStudies: processedStudies.length,
            reportedStudies: reported.length,
            averageUploadToReportMinutes: avgUploadToReport,
            averageAssignToReportMinutes: avgAssignToReport,
            averageUploadToReportFormatted: formatMinutes(avgUploadToReport),
            averageAssignToReportFormatted: formatMinutes(avgAssignToReport)
        }
    };

    cache.set(cacheKey, payload, forExport ? 120 : 300);
    return payload;
};

export const getLocations = async (req, res) => {
    try {
        const query = {};
        if (req.user?.role !== 'super_admin' && req.user?.organizationIdentifier) {
            query.organizationIdentifier = req.user.organizationIdentifier;
        }

        query.isActive = true;

        const labs = await Lab.find(query).select('name identifier').lean();
        const locations = labs.map((lab) => ({
            value: lab._id.toString(),
            label: lab.name,
            code: lab.identifier
        }));

        return res.status(200).json({ success: true, locations });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Failed to fetch locations', error: error.message });
    }
};

export const getDoctors = async (req, res) => {
    try {
        const orgMatch = {};
        if (req.user?.role !== 'super_admin' && req.user?.organizationIdentifier) {
            orgMatch.organizationIdentifier = req.user.organizationIdentifier;
        }

        const doctors = await Doctor.aggregate([
            { $match: { ...orgMatch, isActiveProfile: true } },
            {
                $lookup: {
                    from: 'users',
                    localField: 'userAccount',
                    foreignField: '_id',
                    as: 'userAccount',
                    pipeline: [
                        { $match: { isActive: true } },
                        { $project: { _id: 1, fullName: 1, email: 1, role: 1 } }
                    ]
                }
            },
            { $match: { userAccount: { $ne: [] } } },
            {
                $project: {
                    specialization: 1,
                    userAccount: { $arrayElemAt: ['$userAccount', 0] }
                }
            },
            { $sort: { 'userAccount.fullName': 1 } }
        ]);

        const formatted = doctors.map((doctor) => ({
            value: doctor.userAccount._id.toString(),
            label: doctor.userAccount.fullName,
            email: doctor.userAccount.email || '-',
            specialization: doctor.specialization || 'N/A'
        }));

        return res.status(200).json({ success: true, doctors: formatted });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Failed to fetch doctors', error: error.message });
    }
};

export const getTATReport = async (req, res) => {
    try {
        const start = Date.now();
        const payload = await queryTatStudies({ req, forExport: false });

        return res.status(200).json({
            success: true,
            ...payload,
            totalRecords: payload.studies.length,
            performance: {
                queryTimeMs: Date.now() - start
            }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Failed to generate TAT report', error: error.message });
    }
};

export const exportTATReport = async (req, res) => {
    try {
        const payload = await queryTatStudies({ req, forExport: true });
        const { studies } = payload;

        if (!studies.length) {
            return res.status(404).json({ success: false, message: 'No data found for export criteria' });
        }

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('TAT Report');

        sheet.columns = [
            { header: 'Status', key: 'studyStatus', width: 20 },
            { header: 'Patient ID', key: 'patientId', width: 16 },
            { header: 'Patient Name', key: 'patientName', width: 24 },
            { header: 'Accession', key: 'accessionNumber', width: 18 },
            { header: 'Study Description', key: 'studyDescription', width: 30 },
            { header: 'Location', key: 'institutionName', width: 24 },
            { header: 'Upload Date (IST)', key: 'uploadDate', width: 22 },
            { header: 'Assigned Date (IST)', key: 'assignedDate', width: 22 },
            { header: 'Report Completed Date (IST)', key: 'reportDate', width: 28 },
            { header: 'Final Download Date (IST)', key: 'finalDownloadDate', width: 25 },
            { header: 'Upload -> Assigned', key: 'tat1', width: 20 },
            { header: 'Upload -> Report Completed', key: 'tat2', width: 25 },
            { header: 'Assigned -> Report Completed', key: 'tat3', width: 25 },
            { header: 'Upload -> Final Download', key: 'tat4', width: 23 },
            { header: 'Reported By', key: 'reportedBy', width: 24 },
            { header: 'Uploader', key: 'uploaderName', width: 24 }
        ];

        studies.forEach((study) => {
            sheet.addRow({
                studyStatus: study.studyStatus,
                patientId: study.patientId,
                patientName: study.patientName,
                accessionNumber: study.accessionNumber,
                studyDescription: study.studyDescription,
                institutionName: study.institutionName,
                uploadDate: study.uploadDate,
                assignedDate: study.assignedDate,
                reportDate: study.reportDate,
                finalDownloadDate: study.finalDownloadDate,
                tat1: study.statusTatMetrics.uploadToAssignedLatestFormatted,
                tat2: study.statusTatMetrics.uploadToReportCompletedFormatted,
                tat3: study.statusTatMetrics.assignedToReportCompletedFormatted,
                tat4: study.statusTatMetrics.uploadToFinalDownloadFormatted,
                reportedBy: study.reportedBy,
                uploaderName: study.uploaderName
            });
        });

        const now = new Date().toISOString().slice(0, 10);
        const fileName = `TAT_Report_${now}.xlsx`;

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        if (!res.headersSent) {
            return res.status(500).json({ success: false, message: 'Failed to export TAT report', error: error.message });
        }
    }
};

export default {
    getLocations,
    getDoctors,
    getTATReport,
    exportTATReport
};
