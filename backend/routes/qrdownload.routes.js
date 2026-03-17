import express from 'express';
import QRDownloaderController from '../controllers/qr.dowload.controller.js';

const router = express.Router();

// ✅ PUBLIC routes — no auth middleware needed (QR codes are scanned publicly)

// GET /api/qr/:studyId/info  → metadata only
router.get('/:studyId/info', QRDownloaderController.getReportInfo);

// GET /api/qr/:studyId       → download PDF directly
router.get('/:studyId', QRDownloaderController.handleQRScan);

export default router;