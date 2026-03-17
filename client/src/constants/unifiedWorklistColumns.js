// ✅ UNIFIED WORKLIST COLUMNS - STANDARDIZED ORDER AND NAMING
export const UNIFIED_WORKLIST_COLUMNS = {
  // 1. SELECTION
  SELECTION: {
    id: 'selection',
    label: 'Select',
    description: 'Row selection checkbox',
    category: 'actions',
    tables: ['assignor', 'verifier'],
    alwaysVisible: true,
    defaultWidth: 50,
    minWidth: 40,
    maxWidth: 80
  },
  
  // 2. BHARAT PACS ID
  BHARAT_PACS_ID: {
    id: 'bharatPacsId',
    label: 'Bharat PACS ID',
    description: 'Unique study identifier',
    category: 'study',
    tables: ['assignor', 'radiologist', 'verifier', 'lab_staff', 'receptionist'],
    defaultWidth: 140,
    minWidth: 120,
    maxWidth: 200
  },

  // 3. ORGANIZATION
  ORGANIZATION: {
    id: 'organization',
    label: 'Organization',
    description: 'Organization name',
    category: 'lab',
    tables: ['assignor', 'radiologist', 'verifier', 'lab_staff', 'receptionist'],
    defaultWidth: 150,
    minWidth: 120,
    maxWidth: 250
  },

  // 4. CENTER NAME
  CENTER_NAME: {
    id: 'centerName',
    label: 'Center Name',
    description: 'Sub-center or lab location',
    category: 'lab',
    tables: ['assignor', 'radiologist', 'verifier', 'lab_staff', 'receptionist'],
    defaultWidth: 150,
    minWidth: 120,
    maxWidth: 250
  },

  // 5. LOCATION (NEW)
  LOCATION: {
    id: 'location',
    label: 'Location',
    description: 'Lab or center physical location/address',
    category: 'lab',
    tables: ['assignor', 'radiologist', 'verifier', 'lab_staff', 'receptionist'],
    defaultWidth: 200,
    minWidth: 150,
    maxWidth: 350
  },

  // 6. TIMELINE HISTORY (moved from 5)
  TIMELINE: {
    id: 'timeline',
    label: 'Timeline',
    description: 'Study timeline and events',
    category: 'workflow',
    tables: ['assignor', 'radiologist', 'verifier', 'lab_staff'],
    defaultWidth: 60,
    minWidth: 50,
    maxWidth: 80
  },

  // 7. PATIENT NAME / UHID
  PATIENT_NAME: {
    id: 'patientName',
    label: 'PT Name / UHID',
    description: 'Patient name and UHID',
    category: 'patient',
    tables: ['assignor', 'radiologist', 'verifier', 'lab_staff', 'receptionist', 'billing'],
    defaultWidth: 180,
    minWidth: 150,
    maxWidth: 300
  },

  // 8. AGE/SEX
  AGE_GENDER: {
    id: 'ageGender',
    label: 'Age/Sex',
    description: 'Patient age and gender',
    category: 'patient',
    tables: ['assignor', 'radiologist', 'verifier', 'lab_staff', 'receptionist'],
    defaultWidth: 80,
    minWidth: 70,
    maxWidth: 120
  },

  // 9. MODALITY
  MODALITY: {
    id: 'modality',
    label: 'Modality',
    description: 'Imaging modality',
    category: 'study',
    tables: ['assignor', 'radiologist', 'verifier', 'lab_staff', 'receptionist'],
    defaultWidth: 90,
    minWidth: 80,
    maxWidth: 150
  },

  // 10. VIEW ONLY
  VIEW_ONLY: {
    id: 'viewOnly',
    label: 'View',
    description: 'View images only (Eye icon)',
    category: 'actions',
    tables: ['assignor', 'radiologist', 'verifier', 'lab_staff'],
    defaultWidth: 60,
    minWidth: 50,
    maxWidth: 80
  },

  // 11. REPORTING
  REPORTING: {
    id: 'reporting',
    label: 'Reporting',
    description: 'Open reporting interface',
    category: 'actions',
    tables: ['assignor', 'radiologist'],
    defaultWidth: 100,
    minWidth: 80,
    maxWidth: 120
  },

  // 12. SERIES/IMAGES
  STUDY_SERIES_IMAGES: {
    id: 'studySeriesImages',
    label: 'Series/Images',
    description: 'Study series and image counts',
    category: 'study',
    tables: ['assignor', 'radiologist', 'verifier', 'lab_staff'],
    defaultWidth: 120,
    minWidth: 100,
    maxWidth: 180
  },

  // 13. PATIENT ID
  PATIENT_ID: {
    id: 'patientId',
    label: 'PT ID',
    description: 'Patient identifier',
    category: 'patient',
    tables: ['assignor', 'radiologist', 'verifier', 'lab_staff', 'receptionist'],
    defaultWidth: 120,
    minWidth: 100,
    maxWidth: 180
  },

  // 14. REFERRAL DOCTOR
  REFERRAL_DOCTOR: {
    id: 'referralDoctor',
    label: 'Referral Doctor',
    description: 'Referring physician',
    category: 'physician',
    tables: ['assignor', 'radiologist', 'verifier', 'lab_staff', 'receptionist'],
    defaultWidth: 180,
    minWidth: 150,
    maxWidth: 300
  },

  // 15. CLINICAL HISTORY
  CLINICAL_HISTORY: {
    id: 'clinicalHistory',
    label: 'Clinical History',
    description: 'Patient clinical history and notes',
    category: 'clinical',
    tables: ['assignor', 'radiologist', 'verifier', 'lab_staff'],
    defaultWidth: 250,
    minWidth: 200,
    maxWidth: 400
  },

  // 16. STUDY DATE/TIME
  STUDY_DATE_TIME: {
    id: 'studyDateTime',
    label: 'Study Date/Time',
    description: 'When study was performed',
    category: 'timing',
    tables: ['assignor', 'radiologist', 'verifier', 'lab_staff', 'receptionist'],
    defaultWidth: 150,
    minWidth: 130,
    maxWidth: 200
  },

  // 17. UPLOAD DATE/TIME
  UPLOAD_DATE_TIME: {
    id: 'uploadDateTime',
    label: 'Upload Date/Time',
    description: 'When study was uploaded',
    category: 'timing',
    tables: ['assignor', 'radiologist', 'verifier', 'lab_staff'],
    defaultWidth: 150,
    minWidth: 130,
    maxWidth: 200
  },

  // 18. RADIOLOGIST
  ASSIGNED_RADIOLOGIST: {
    id: 'assignedRadiologist',
    label: 'Radiologist',
    description: 'Assigned radiologist name',
    category: 'assignment',
    tables: ['assignor', 'radiologist', 'verifier', 'lab_staff'],
    defaultWidth: 180,
    minWidth: 150,
    maxWidth: 300
  },

  // 19. LOCK/UNLOCK TOGGLE
  STUDY_LOCK: {
    id: 'studyLock',
    label: 'Lock/Unlock',
    description: 'Study lock status toggle',
    category: 'workflow',
    tables: ['assignor', 'radiologist'],
    defaultWidth: 100,
    minWidth: 80,
    maxWidth: 120
  },

  // 20. STATUS
  STATUS: {
    id: 'status',
    label: 'Status',
    description: 'Current workflow status',
    category: 'workflow',
    tables: ['assignor', 'radiologist', 'verifier', 'lab_staff', 'receptionist'],
    defaultWidth: 140,
    minWidth: 120,
    maxWidth: 200
  },

  // 21. PRINT REPORT
  PRINT_COUNT: {
    id: 'printCount',
    label: 'Print Report',
    description: 'Print report count',
    category: 'report',
    tables: ['assignor', 'receptionist', 'lab_staff'],
    defaultWidth: 100,
    minWidth: 80,
    maxWidth: 150
  },

  // 22. REJECTION REASON
  REJECTION_REASON: {
    id: 'rejectionReason',
    label: 'Reverted Reason',
    description: 'Reason for report rejection',
    category: 'workflow',
    tables: ['assignor', 'radiologist', 'verifier', 'lab_staff'],
    defaultWidth: 250,
    minWidth: 150,
    maxWidth: 300
  },

  // 23. VERIFIED BY
  ASSIGNED_VERIFIER: {
    id: 'assignedVerifier',
    label: 'Verified By',
    description: 'Verifier who verified the report',
    category: 'assignment',
    tables: ['assignor', 'radiologist', 'verifier', 'lab_staff'],
    defaultWidth: 160,
    minWidth: 140,
    maxWidth: 250
  },

  // 24. VERIFIED DATE/TIME
  VERIFIED_DATE_TIME: {
    id: 'verifiedDateTime',
    label: 'Verified Date/Time',
    description: 'When report was verified',
    category: 'timing',
    tables: ['assignor', 'radiologist', 'verifier', 'lab_staff'],
    defaultWidth: 150,
    minWidth: 130,
    maxWidth: 200
  },

  // 25. ACTIONS
  ACTIONS: {
    id: 'actions',
    label: 'Actions',
    description: 'Available actions',
    category: 'actions',
    tables: ['assignor', 'radiologist', 'verifier', 'lab_staff', 'receptionist', 'billing'],
    alwaysVisible: true,
    defaultWidth: 150,
    minWidth: 100,
    maxWidth: 200
  }
};

// ✅ STANDARDIZED COLUMN ORDER - EXACT SEQUENCE
const STANDARD_COLUMN_ORDER = [
  'selection',
  'bharatPacsId',
  'organization',
  'centerName',
  'location',              // ✅ NEW: Added after centerName
  'timeline',
  'patientName',
  'ageGender',
  'modality',
  'viewOnly',
  'reporting',             // ✅ NEW: Added after viewOnly
  'studySeriesImages',
  'patientId',
  'referralDoctor',
  'clinicalHistory',
  'studyDateTime',
  'uploadDateTime',
  'assignedRadiologist',
  'studyLock',
  'status',
  'printCount',
  'rejectionReason',
  'assignedVerifier',
  'verifiedDateTime',
  'actions'
];

// ✅ ROLE-SPECIFIC DEFAULT COLUMNS - FOLLOWING STANDARD ORDER
export const SINGLE_ROLE_DEFAULTS = {
  assignor: [
    'selection',
    'bharatPacsId',
    'organization',
    'centerName',
    'location',              // ✅ NEW
    'timeline',
    'patientName',
    'ageGender',
    'modality',
    'viewOnly',
    'reporting',             // ✅ NEW
    'studySeriesImages',
    'patientId',
    'referralDoctor',
    'clinicalHistory',
    'studyDateTime',
    'uploadDateTime',
    'assignedRadiologist',
    'studyLock',
    'status',
    'printCount',
    'assignedVerifier',
    'verifiedDateTime',
    'actions'
  ],

  radiologist: [
    'bharatPacsId',
    'organization',
    'centerName',
    'location',              // ✅ NEW

    'patientName',
    'ageGender',
    'modality',
    'viewOnly',
    'reporting',             // ✅ NEW
    'studySeriesImages',
    'patientId',
    'referralDoctor',
    'clinicalHistory',
    'studyDateTime',
    'uploadDateTime',
  
    'studyLock',
    'status',
    'assignedVerifier',
    'verifiedDateTime',
    'actions'
  ],

  verifier: [
    'selection',
    'bharatPacsId',
    'organization',
    'centerName',
    'location',              // ✅ NEW
    'timeline',
    'patientName',
    'ageGender',
    'modality',
    'viewOnly',
    'studySeriesImages',
    'patientId',
    'referralDoctor',
    'clinicalHistory',
    'studyDateTime',
    'uploadDateTime',
    'assignedRadiologist',
    'status',
    'assignedVerifier',
    'verifiedDateTime',
    'actions'
  ],

  lab_staff: [
    'bharatPacsId',
    'organization',
    'centerName',
    'location',              // ✅ NEW
    'timeline',
    'patientName',
    'ageGender',
    'modality',
    'viewOnly',
    'studySeriesImages',
    'patientId',
    'referralDoctor',
    'clinicalHistory',
    'studyDateTime',
    'uploadDateTime',
    'assignedRadiologist',
    'status',
    'printCount',
    'assignedVerifier',
    'verifiedDateTime',
    'actions'
  ],

  receptionist: [
    'bharatPacsId',
    'organization',
    'centerName',
    'location',              // ✅ NEW
    'patientName',
    'ageGender',
    'modality',
    'patientId',
    'referralDoctor',
    'studyDateTime',
    'status',
    'printCount',
    'actions'
  ],

  billing: [
    'patientName',
    'patientId',
    'modality',
    'studyDateTime',
    'status',
    'actions'
  ]
};

// ✅ MULTI-ROLE COMBINATIONS - MERGED IN STANDARD ORDER
export const MULTI_ROLE_DEFAULTS = {
  'assignor+radiologist': [
    'selection',
    'bharatPacsId',
    'organization',
    'centerName',
    'location',              // ✅ NEW
    'timeline',
    'patientName',
    'ageGender',
    'modality',
    'viewOnly',
    'reporting',             // ✅ NEW
    'studySeriesImages',
    'patientId',
    'referralDoctor',
    'clinicalHistory',
    'studyDateTime',
    'uploadDateTime',
    'assignedRadiologist',
    'studyLock',
    'status',
    'printCount',
    'assignedVerifier',
    'verifiedDateTime',
    'actions'
  ],

  'assignor+verifier': [
    'selection',
    'bharatPacsId',
    'organization',
    'centerName',
    'location',              // ✅ NEW
    'timeline',
    'patientName',
    'ageGender',
    'modality',
    'viewOnly',
    'studySeriesImages',
    'patientId',
    'referralDoctor',
    'clinicalHistory',
    'studyDateTime',
    'uploadDateTime',
    'assignedRadiologist',
    'status',
    'printCount',
    'assignedVerifier',
    'verifiedDateTime',
    'actions'
  ],

  'radiologist+verifier': [
    'selection',
    'bharatPacsId',
    'organization',
    'centerName',
    'location',              // ✅ NEW
    
    'patientName',
    'ageGender',
    'modality',
    'viewOnly',
    'studySeriesImages',
    'patientId',
    'referralDoctor',
    'clinicalHistory',
    'studyDateTime',
    'uploadDateTime',
    'assignedRadiologist',
    'studyLock',
    'status',
    'assignedVerifier',
    'verifiedDateTime',
    'actions'
  ],

  'assignor+radiologist+verifier': [
    'selection',
    'bharatPacsId',
    'organization',
    'centerName',
    'location',              // ✅ NEW
    'timeline',
    'patientName',
    'ageGender',
    'modality',
    'viewOnly',
    'reporting',             // ✅ NEW
    'studySeriesImages',
    'patientId',
    'referralDoctor',
    'clinicalHistory',
    'studyDateTime',
    'uploadDateTime',
    'assignedRadiologist',
    'studyLock',
    'status',
    'printCount',
    'assignedVerifier',
    'verifiedDateTime',
    'actions'
  ]
};

// ✅ HELPER: Get default columns for user based on their account roles
export const getDefaultColumnsForUser = (accountRoles = []) => {
  if (accountRoles.length === 0) return [];
  if (accountRoles.length === 1) {
    return SINGLE_ROLE_DEFAULTS[accountRoles[0]] || [];
  }

  const roleKey = accountRoles.sort().join('+');
  
  if (MULTI_ROLE_DEFAULTS[roleKey]) {
    return MULTI_ROLE_DEFAULTS[roleKey];
  }

  // Merge columns in standard order
  const mergedSet = new Set();
  accountRoles.forEach(role => {
    const roleColumns = SINGLE_ROLE_DEFAULTS[role] || [];
    roleColumns.forEach(col => mergedSet.add(col));
  });

  // Return in standard order
  return STANDARD_COLUMN_ORDER.filter(col => mergedSet.has(col));
};

export const getAllColumns = () => {
  return Object.values(UNIFIED_WORKLIST_COLUMNS);
};

export const getColumnById = (id) => {
  return Object.values(UNIFIED_WORKLIST_COLUMNS).find(col => col.id === id);
};

export const isColumnAlwaysVisible = (columnId) => {
  const column = getColumnById(columnId);
  return column?.alwaysVisible || false;
};

export const getColumnsForRoles = (roles = []) => {
  return Object.values(UNIFIED_WORKLIST_COLUMNS).filter(col => {
    return roles.some(role => col.tables.includes(role));
  });
};