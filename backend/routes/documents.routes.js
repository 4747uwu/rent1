import express from 'express';
import documentsController from '../controllers/documents.controller.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// ✅ STUDY REPORTING INFO
router.get('/study/:studyId/reporting-info', protect, documentsController.getStudyReportingInfo);


// backend/routes/documents.routes.js
// import express from 'express';
import documentController from '../controllers/document.controller.js';
// import { protect } from '../middleware/authMiddleware.js';

// const router = express.Router();

// ✅ DOCUMENT UPLOAD & MANAGEMENT
router.post(
    '/study/:studyId/upload',
    protect,
    documentController.upload.single('file'),
    documentController.uploadDocument
);

router.get('/study/:studyId', protect, documentController.getStudyDocuments);
router.get('/:documentId/url', protect, documentController.getDocumentUrl);
router.get('/:documentId/metadata', protect, documentController.getDocumentMetadata);
router.delete('/:documentId', protect, documentController.deleteDocument);

// export default router;

export default router;