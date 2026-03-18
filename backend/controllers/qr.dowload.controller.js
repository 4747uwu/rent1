import mongoose from 'mongoose';
import DicomStudy from '../models/dicomStudyModel.js';
import Report from '../models/reportModel.js';
import ReportDownloadController from './ReportDownload.controller.js';

class QRDownloaderController {

    /**
     * 🔧 QR CODE SCAN ENDPOINT
     * Scans study ID from QR, finds latest finalized report, streams PDF
     * Route: GET /api/qr/:studyId
     */
    static async handleQRScan(req, res) {
        console.log('🔧 [QR Scan] Handling QR scan download...');
        try {
            const { studyId } = req.params;

            // 1️⃣ VALIDATE STUDY ID
            if (!studyId || !mongoose.Types.ObjectId.isValid(studyId)) {
                return res.status(400).json({ success: false, message: 'Invalid study ID format' });
            }

            // 2️⃣ FETCH STUDY
            const study = await DicomStudy.findById(studyId).select('_id patientInfo currentReportStatus workflowStatus createdAt studyInstanceUID orthancStudyID').lean();
            if (!study) {
                return res.status(404).json({ success: false, message: 'Study not found' });
            }

            console.log(`✅ [QR Scan] Study found: ${study._id} - Patient: ${study.patientInfo?.patientName || 'Unknown'}`);

            // 3️⃣ FIND LATEST FINALIZED REPORT
            const report = await Report.findOne({
                dicomStudy: studyId,
                reportStatus: { $in: ['finalized', 'verified', 'approved'] }
            }).sort({ createdAt: -1 }).select('_id');

            if (!report) {
                return res.status(404).json({
                    success: false,
                    message: 'No finalized report available for this study',
                    study: {
                        _id: study._id,
                        patientName: study.patientInfo?.patientName,
                        patientId: study.patientInfo?.patientID
                    }
                });
            }

            console.log(`📄 [QR Scan] Found report: ${report._id}, delegating to printReportAsPDF...`);

            // 4️⃣ DELEGATE TO EXISTING PDF PRINT (reuse same logic)
            // Inject reportId into params so printReportAsPDF works as-is
            req.params.reportId = report._id.toString();

            // QR scans are public — attach a minimal user object if none exists
            if (!req.user) {
                req.user = { _id: null, fullName: 'QR Scan (Public)', role: 'public' };
            }

            return ReportDownloadController.printReportAsPDF(req, res);

        } catch (error) {
            console.error('❌ [QR Scan] Error:', error);
            res.status(500).json({ success: false, message: 'Error retrieving report', error: error.message });
        }
    }

    /**
     * ℹ️ GET REPORT INFO ENDPOINT
     * Returns report metadata without downloading
     * Route: GET /api/qr/:studyId/info
     */
    static async getReportInfo(req, res) {
        try {
            const { studyId } = req.params;

            if (!studyId || !mongoose.Types.ObjectId.isValid(studyId)) {
                return res.status(400).json({ success: false, message: 'Invalid study ID format' });
            }

            const study = await DicomStudy.findById(studyId)
                .select('_id patientInfo currentReportStatus workflowStatus createdAt studyInstanceUID orthancStudyID')
                .lean();

            if (!study) {
                return res.status(404).json({ success: false, message: 'Study not found' });
            }

            const report = await Report.findOne({
                dicomStudy: studyId,
                reportStatus: { $in: ['finalized', 'verified', 'approved'] }
            })
                .sort({ createdAt: -1 })
                .select('_id reportStatus reportType createdAt doctorId reportId')
                .populate('doctorId', 'fullName')
                .lean();

            const OHIF_BASE_URL = process.env.OHIF_BASE_URL || 'https://viewer.xcentic.com/viewer';
            const uid = study.studyInstanceUID || study.orthancStudyID || '';
            const ohifUrl = uid ? `${OHIF_BASE_URL}?StudyInstanceUIDs=${encodeURIComponent(uid)}` : null;

            res.json({
                success: true,
                data: {
                    studyId: study._id,
                    patientName: study.patientInfo?.patientName,
                    patientId: study.patientInfo?.patientID,
                    workflowStatus: study.workflowStatus,
                    createdAt: study.createdAt,
                    viewer: {
                        studyInstanceUID: study.studyInstanceUID || null,
                        orthancStudyID: study.orthancStudyID || null,
                        ohifUrl
                    },
                    report: report ? {
                        reportId: report._id,
                        reportStatus: report.reportStatus,
                        reportType: report.reportType,
                        reportedBy: report.doctorId?.fullName || 'Unknown',
                        createdAt: report.createdAt,
                        downloadUrl: `/api/qr/${studyId}`
                    } : null
                }
            });

        } catch (error) {
            console.error('❌ [QR Info] Error:', error);
            res.status(500).json({ success: false, message: 'Error fetching report info', error: error.message });
        }
    }
}

export default QRDownloaderController;