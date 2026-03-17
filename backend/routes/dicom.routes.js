// backend/routes/dicom.routes.js
import express from 'express';
import { saveExtractedDicomData } from '../controllers/dicom.controller.js';

const router = express.Router();

// ✅ Endpoint for Python server to send extracted DICOM data
router.post('/save-extracted-data', saveExtractedDicomData);

export default router;