import express from 'express';
import typistController from '../controllers/typist.controller.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// ✅ TYPIST DASHBOARD ROUTES (2 categories: pending & typed)
router.get('/values', protect, typistController.getValues);
router.get('/studies/pending', protect, typistController.getPendingStudies);
router.get('/studies/typed', protect, typistController.getTypedStudies);
router.get('/studies', protect, typistController.getAllStudiesForTypist);

// ✅ TYPIST-SPECIFIC ROUTES
router.get('/radiologist', protect, typistController.getLinkedRadiologist);

export default router;