// routes/billing.routes.js
import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
    getBillingModules,
    createBillingModule,
    updateBillingModule,
    deleteBillingModule,
    getLabBillingConfig,
    saveLabBillingConfig,
    getStudyBillingOptions,
    setStudyBilling,
    getLabBillingReport,
} from '../controllers/billing.controller.js';

const router = express.Router();

router.use(protect);

// ── Billing Modules (admin-defined service items) ────────────
router.get('/modules', getBillingModules);
router.post('/modules', createBillingModule);
router.put('/modules/:moduleId', updateBillingModule);
router.delete('/modules/:moduleId', deleteBillingModule);

// ── Lab Billing Config ───────────────────────────────────────
router.get('/lab/:labId', getLabBillingConfig);
router.post('/lab/:labId', saveLabBillingConfig);

// ── Study Billing (verifier) ─────────────────────────────────
router.get('/study/:studyId/options', getStudyBillingOptions);
router.put('/study/:studyId', setStudyBilling);

// ── Reports ──────────────────────────────────────────────────
router.get('/reports/lab/:labId', getLabBillingReport);

export default router;
