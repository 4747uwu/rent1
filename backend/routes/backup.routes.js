import express from 'express';
import { backupSwitch, restoreFromBackup } from '../controllers/backupOhifSwitch.controller.js';

const router = express.Router();

// Accept text/plain or JSON (using express.text middleware for raw body)
router.post('/switch', express.text({ type: '*/*' }), backupSwitch);

// ✅ NEW: Restore study from R2 backup to backup Orthanc
router.post('/restore', express.json(), restoreFromBackup);

export default router;