import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
    getLocations,
    getDoctors,
    getTATReport,
    exportTATReport
} from '../controllers/tat.controller.js';

const router = express.Router();

router.use(protect);

router.get('/locations', getLocations);
router.get('/doctors', getDoctors);
router.get('/report', getTATReport);
router.get('/report/export', exportTATReport);

export default router;
