import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import HTMLTemplateController from '../controllers/html.controller.js';

const router = express.Router();

// Protect all routes
router.use(protect);

// Get all templates with filtering and pagination
router.get('/', 
//   authorize('admin', 'lab_staff', 'doctor_account'), 
  HTMLTemplateController.getTemplates
);

// Get categories for filters
router.get('/categories', 
//   authorize('admin', 'lab_staff', 'doctor_account'), 
  HTMLTemplateController.getCategories
);

// Get templates for reporting system (optimized)
router.get('/reporting', 
//   authorize('admin', 'lab_staff', 'doctor_account'), 
  HTMLTemplateController.getTemplatesForReporting
);

// Get single template by ID
router.get('/:templateId', 
//   authorize('admin', 'lab_staff', 'doctor_account'), 
  HTMLTemplateController.getTemplate
);

// Create new template
router.post('/', 
//   authorize('admin', 'lab_staff'), 
  HTMLTemplateController.createTemplate
);

// Update template
router.put('/:templateId', 
//   authorize('admin', 'lab_staff'), 
  HTMLTemplateController.updateTemplate
);

// Delete template
router.delete('/:templateId', 
//   authorize('admin'), 
  HTMLTemplateController.deleteTemplate
);

// Get cross-org global templates (super_global, created by super_admin)
router.get('/doctor/global-templates',
  HTMLTemplateController.getCrossOrgGlobalTemplates
);

// Get organization-level global templates
router.get('/doctor/org-templates',
  HTMLTemplateController.getOrgGlobalTemplates
);

// ✅ NEW: Get doctor-specific templates
router.get('/doctor/my-templates',
  HTMLTemplateController.getDoctorTemplates
);

// ✅ NEW: Get all accessible templates
router.get('/doctor/all-accessible', 
  HTMLTemplateController.getAllAccessibleTemplates
);

export default router;