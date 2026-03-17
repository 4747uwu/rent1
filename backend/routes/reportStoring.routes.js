import express from 'express';
import reportStoringController from '../controllers/ReportStoring.controller.js';
import ReportDownloadController from '../controllers/ReportDownload.controller.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// ✅ REPORT STORAGE ROUTES
router.post('/studies/:studyId/store-draft', protect, reportStoringController.storeDraftReport);
router.post('/studies/:studyId/store-finalized', protect, reportStoringController.storeFinalizedReport);
router.get('/studies/:studyId/edit-report', protect, reportStoringController.getReportForEditing);

// ✅ REPORT RETRIEVAL ROUTES
router.get('/studies/:studyId/reports', protect, reportStoringController.getStudyReports);
router.get('/reports/:reportId/download', protect, reportStoringController.downloadReport);
//multi report storing
router.post('/studies/:studyId/store-multiple', protect, reportStoringController.storeMultipleReports);


router.get('/studies/:studyId/all-reports', protect, reportStoringController.getStudyReports);

router.get('/studies/:studyId/all-reports', protect, reportStoringController.getAllReportsWithContent);



// ✅ DOWNLOAD ROUTES
router.use(protect);
router.get('/reports/:reportId/download/pdf',  ReportDownloadController.downloadReportAsPDF);
router.get('/reports/:reportId/download/docx', ReportDownloadController.downloadReportAsDOCX);

router.get('/studies/:studyId/report-ids', ReportDownloadController.getStudyReportIds);

// ✅ FIX: was '/:reportId/print' → must be '/reports/:reportId/print'
// Frontend calls: /api/reports/reports/:reportId/print
router.get('/reports/:reportId/print', ReportDownloadController.printReportAsPDF);

// ✅ TRACK PRINT
router.post('/reports/:reportId/track-print', ReportDownloadController.trackPrintClick);

// ✅ DELETE & RENAME
router.delete('/reports/:reportId', protect, reportStoringController.deleteReport);
router.patch('/reports/:reportId/rename', protect, reportStoringController.renameReport);

export default router;