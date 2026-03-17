import express from 'express';
import doctorTemplateController from '../controllers/doctorTemplate.controller.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// ✅ DOCTOR TEMPLATE ROUTES
router.post('/create', protect, doctorTemplateController.createTemplate);
router.get('/all', protect, doctorTemplateController.getAllTemplates);
router.get('/my-templates', protect, doctorTemplateController.getMyTemplates);
router.get('/categories', protect, doctorTemplateController.getTemplateCategories);
router.get('/:templateId', protect, doctorTemplateController.getTemplateById);
router.put('/:templateId', protect, doctorTemplateController.updateTemplate);
router.delete('/:templateId', protect, doctorTemplateController.deleteTemplate);

export default router;