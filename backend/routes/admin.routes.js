import express from 'express';
import multer from 'multer';
import User from '../models/userModel.js';
import {
  getValues,
  getCategoryValues, // ✅ NEW
  getStudiesByCategory, // ✅ NEW
  getPendingStudies,
  getInProgressStudies,
  getCompletedStudies,
  getAllStudiesForAdmin,
  getOrganizationLabs,
  deleteStudy,
  bulkDeleteStudies
} from '../controllers/admin.controller.js';

//revert to radiologist

import {
  revertToRadiologist,
  getRevertHistory,
  resolveRevert
} from '../controllers/revertToRadiologist.controller.js';

import {
  getAllLabsForManagement,
  getLabDetails,
  updateLabDetails
} from '../controllers/manageLabs.controller.js';


import { createManualStudy } from '../controllers/manualStudyCreator.controller.js';
// Add import at the top
import { getStudyStatusHistory } from '../controllers/statusHistory.controller.js';


import {
  createDoctor,
  createLab,
  getAllDoctors,
  getAllLabs,
  updateDoctor,
  updateLab,
  deleteDoctor,
  deleteLab,

} from '../controllers/adminCRUD.controller.js';


// ✅ IMPORT USER MANAGEMENT ROUTES
import userManagementRoutes from './userManagement.routes.js';

// ✅ IMPORT ADMIN USER MANAGEMENT
import {
  getOrganizationUsers,
  updateUserCredentials,
  switchUserRole,
  toggleUserStatus,
  resetUserPassword,
  deleteUser,

} from '../controllers/adminUserManagement.controller.js';

import { updateUserRoleConfig } from '../controllers/userManagement.controller.js';


//filter data 
import { getRadiologistsForFilter, getLabsForFilter } from '../controllers/filterOptions.controller.js';





import { protect } from '../middleware/authMiddleware.js';
import { updateStudyDetails, getStudyActionLogs, lockStudyForReporting } from '../controllers/Patient.controller.js'; // ✅ ADD getStudyActionLogs

import { toggleStudyLock } from '../controllers/download.controller.js';
import systemOverviewController from '../controllers/systemOverview.controller.js';
import { uploadOrgLogo, getOrgLogo, deleteOrgLogo, getQueryCallNumber, updateQueryCallNumber } from '../controllers/orgLogo.controller.js';

// import { getOrganisation}


const router = express.Router();

// ✅ Protect all admin routes
router.use(protect);
// router.use(authorize('admin', 'super_admin'));

// ✅ Analytics endpoints
router.get('/values', getValues);
router.get('/category-values', getCategoryValues); // ✅ NEW

// ✅ Category-based study endpoints
router.get('/studies/category/:category', getStudiesByCategory); // ✅ NEW

// ✅ Add this route
router.put('/studies/:studyId/details', protect, updateStudyDetails);

// ✅ ADD THIS ROUTE
router.get('/study-action-logs/:studyId', protect, getStudyActionLogs);

// Legacy endpoints (keep for backwards compatibility)
router.get('/studies/pending', getPendingStudies);
router.get('/studies/inprogress', getInProgressStudies);
router.get('/studies/completed', getCompletedStudies);
router.get('/studies', getAllStudiesForAdmin);
router.post('/studies/:studyId/lock', lockStudyForReporting);


router.post('/toggle-study-lock/:studyId', protect, toggleStudyLock);

// ✅ CRUD OPERATION ROUTES WITH PROTECTION
router.post('/admin-crud/doctors', protect, createDoctor);
router.get('/admin-crud/doctors', protect, getAllDoctors);
router.put('/admin-crud/doctors/:doctorId', protect, updateDoctor);
router.delete('/admin-crud/doctors/:doctorId', protect, deleteDoctor);

router.post('/admin-crud/labs', protect, createLab);
router.get('/admin-crud/labs', protect, getAllLabs);
router.put('/admin-crud/labs/:labId', protect, updateLab);
router.delete('/admin-crud/labs/:labId', protect, deleteLab);

// ✅ USER MANAGEMENT ROUTES
router.use('/user-management', userManagementRoutes);

// ✅ ADMIN USER MANAGEMENT ROUTES
router.get('/manage-users', protect, getOrganizationUsers);
router.put('/manage-users/:userId/credentials', protect, updateUserCredentials);
router.put('/manage-users/:userId/role', protect, switchUserRole);
router.put('/manage-users/:userId/status', protect, toggleUserStatus);
router.post('/manage-users/:userId/reset-password', protect, resetUserPassword);
router.delete('/manage-users/:userId', protect, deleteUser);

// ✅ FILTER OPTIONS ROUTES
router.get('/filters/radiologists', protect, getRadiologistsForFilter);
router.get('/filters/labs', protect, getLabsForFilter);


//to get all the labs 
router.get('/labs', protect, getOrganizationLabs);

//get the status history for a study
router.get('/study/:studyId/status-history', protect, getStudyStatusHistory);

//revert to radiologist routes

router.post('/studies/:studyId/revert-to-radiologist', protect, revertToRadiologist);
router.get('/studies/:studyId/revert-history', protect, getRevertHistory);
router.post('/studies/:studyId/resolve-revert', protect, resolveRevert);

// Update the multer configuration in admin.routes.js (around line 143-156)



// ✅ MANAGE LABS ROUTES
router.get('/labss', protect, getAllLabsForManagement);
router.get('/labs/:labId', protect, getLabDetails);
router.put('/labs/:labId', protect, updateLabDetails);

//management route for the role config and the update of the user

router.put('/manage-users/:userId/role-config', protect, updateUserRoleConfig);




router.put('/manage-users/:userId', protect, async (req, res) => {
  try {
    const { userId } = req.params;
    const { fullName, visibleColumns, password } = req.body;

    const updateData = {};
    if (fullName) updateData.fullName = fullName;
    if (visibleColumns) updateData.visibleColumns = visibleColumns;

    const user = await User.findOneAndUpdate(
      {
        _id: userId,
        organizationIdentifier: req.user.organizationIdentifier
      },
      { $set: updateData },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // ✅ Update password separately if provided
    if (password && password.trim() !== '') {
      const userDoc = await User.findById(userId);
      userDoc.password = password;
      await userDoc.save();
    }

    res.json({ success: true, message: 'User updated successfully', data: user });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ success: false, message: 'Failed to update user' });
  }
});


const manualUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 * 1024 // 5GB per file
  },
  fileFilter: (req, file, cb) => {
    console.log('🔍 [Multer] Checking file:', {
      fieldname: file.fieldname,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size
    });

    // Check field name
    if (file.fieldname === 'images') {
      // For images field, only accept image files
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Images field only accepts image files'));
      }
    } else if (file.fieldname === 'zipFile') {
      // For zipFile field, accept ZIP files (check both extension and mimetype)
      const isZipMime = file.mimetype === 'application/zip' ||
        file.mimetype === 'application/x-zip-compressed' ||
        file.mimetype === 'application/octet-stream'; // Sometimes ZIP is sent as octet-stream
      const isZipExt = file.originalname.toLowerCase().endsWith('.zip');

      if (isZipMime || isZipExt) {
        cb(null, true);
      } else {
        cb(new Error('zipFile field only accepts ZIP files'));
      }
    } else {
      // Unknown field
      cb(new Error(`Unexpected field: ${file.fieldname}`));
    }
  }
});

// Route remains the same
router.post('/create-manual-study', protect, manualUpload.fields([
  { name: 'images', maxCount: 50 },
  { name: 'zipFile', maxCount: 5 }
]), createManualStudy);



//superadmin delete routes

router.delete('/studies/:studyId', protect, deleteStudy);
router.post('/studies/bulk-delete', protect, bulkDeleteStudies);


router.get('/system-overview',
  protect
  ,
  // authorize(['admin', 'super_admin']), 
  systemOverviewController.getSystemOverview);

// ✅ ORG LOGO ROUTES
const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'), false);
    }
    cb(null, true);
  }
});
router.post('/org-logo/upload', protect, logoUpload.single('logo'), uploadOrgLogo);
router.get('/org-logo', protect, getOrgLogo);
router.delete('/org-logo', protect, deleteOrgLogo);

// ✅ ORG SETTINGS ROUTES
router.get('/org-settings/query-number', protect, getQueryCallNumber);
router.put('/org-settings/query-number', protect, updateQueryCallNumber);


export default router;