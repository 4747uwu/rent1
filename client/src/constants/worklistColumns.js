// ✅ WORKLIST COLUMN DEFINITIONS - STANDARDIZED WITH UNIFIED COLUMNS
import { getDefaultColumnsForUser } from './unifiedWorklistColumns';

export const WORKLIST_COLUMNS = {
  // 1. SELECTION
  SELECTION: {
    id: 'selection',
    label: 'Select',
    description: 'Row selection checkbox',
    category: 'actions',
    defaultVisible: true,
    alwaysVisible: true
  },
  
  // 2. BHARAT PACS ID
  BHARAT_PACS_ID: {
    id: 'bharatPacsId',
    label: 'Bharat PACS ID',
    description: 'Unique study identifier',
    category: 'study',
    defaultVisible: true
  },

  // 3. ORGANIZATION
  ORGANIZATION: {
    id: 'organization',
    label: 'Organization',
    description: 'Organization name',
    category: 'lab',
    defaultVisible: true
  },

  // 4. CENTER NAME
  CENTER_NAME: {
    id: 'centerName',
    label: 'Center Name',
    description: 'Sub-center or lab location',
    category: 'lab',
    defaultVisible: true
  },

  // 5. TIMELINE
  TIMELINE: {
    id: 'timeline',
    label: 'Timeline',
    description: 'Study timeline and events',
    category: 'workflow',
    defaultVisible: true
  },

  // 6. PATIENT NAME / UHID
  PATIENT_NAME: {
    id: 'patientName',
    label: 'PT Name / UHID',
    description: 'Patient name and UHID',
    category: 'patient',
    defaultVisible: true
  },

  // 7. AGE/SEX
  AGE_GENDER: {
    id: 'ageGender',
    label: 'Age/Sex',
    description: 'Patient age and gender',
    category: 'patient',
    defaultVisible: true
  },

  // 8. MODALITY
  MODALITY: {
    id: 'modality',
    label: 'Modality',
    description: 'Imaging modality',
    category: 'study',
    defaultVisible: true
  },

  // 9. VIEW ONLY
  VIEW_ONLY: {
    id: 'viewOnly',
    label: 'View',
    description: 'View images only',
    category: 'actions',
    defaultVisible: true
  },

  // 10. SERIES/IMAGES
  STUDY_SERIES_IMAGES: {
    id: 'studySeriesImages',
    label: 'Series/Images',
    description: 'Study series and image counts',
    category: 'study',
    defaultVisible: true
  },

  // 11. PATIENT ID
  PATIENT_ID: {
    id: 'patientId',
    label: 'PT ID',
    description: 'Patient identifier',
    category: 'patient',
    defaultVisible: true
  },

  // 12. REFERRAL DOCTOR
  REFERRAL_DOCTOR: {
    id: 'referralDoctor',
    label: 'Referral Doctor',
    description: 'Referring physician',
    category: 'physician',
    defaultVisible: true
  },

  // 13. CLINICAL HISTORY
  CLINICAL_HISTORY: {
    id: 'clinicalHistory',
    label: 'Clinical History',
    description: 'Patient clinical history and notes',
    category: 'clinical',
    defaultVisible: true
  },

  // 14. STUDY DATE/TIME
  STUDY_DATE_TIME: {
    id: 'studyDateTime',
    label: 'Study Date/Time',
    description: 'When study was performed',
    category: 'timing',
    defaultVisible: true
  },

  // 15. UPLOAD DATE/TIME
  UPLOAD_DATE_TIME: {
    id: 'uploadDateTime',
    label: 'Upload Date/Time',
    description: 'When study was uploaded',
    category: 'timing',
    defaultVisible: true
  },

  // 16. RADIOLOGIST
  ASSIGNED_RADIOLOGIST: {
    id: 'assignedRadiologist',
    label: 'Radiologist',
    description: 'Assigned radiologist name',
    category: 'assignment',
    defaultVisible: true
  },

  // 17. LOCK/UNLOCK
  STUDY_LOCK: {
    id: 'studyLock',
    label: 'Lock/Unlock',
    description: 'Study lock status',
    category: 'workflow',
    defaultVisible: true
  },

  // 18. STATUS
  STATUS: {
    id: 'status',
    label: 'Status',
    description: 'Current workflow status',
    category: 'workflow',
    defaultVisible: true
  },

  // 19. PRINT REPORT
  PRINT_COUNT: {
    id: 'printCount',
    label: 'Print Report',
    description: 'Print report count',
    category: 'report',
    defaultVisible: false
  },

  // 20. VERIFIED BY
  ASSIGNED_VERIFIER: {
    id: 'assignedVerifier',
    label: 'Verified By',
    description: 'Verifier name',
    category: 'assignment',
    defaultVisible: true
  },

  // 21. VERIFIED DATE/TIME
  VERIFIED_DATE_TIME: {
    id: 'verifiedDateTime',
    label: 'Verified Date/Time',
    description: 'When report was verified',
    category: 'timing',
    defaultVisible: true
  },

  // 22. ACTIONS
  ACTIONS: {
    id: 'actions',
    label: 'Actions',
    description: 'Available actions',
    category: 'actions',
    defaultVisible: true,
    alwaysVisible: true
  }
};

// ✅ COLUMN CATEGORIES
export const COLUMN_CATEGORIES = {
  patient: {
    label: 'Patient Information',
    icon: '👤',
    color: 'blue'
  },
  study: {
    label: 'Study Details',
    icon: '🔬',
    color: 'green'
  },
  workflow: {
    label: 'Status & Workflow',
    icon: '⚡',
    color: 'purple'
  },
  assignment: {
    label: 'Assignment Info',
    icon: '👥',
    color: 'teal'
  },
  physician: {
    label: 'Physician Details',
    icon: '👨‍⚕️',
    color: 'indigo'
  },
  lab: {
    label: 'Lab/Center Info',
    icon: '🏥',
    color: 'cyan'
  },
  report: {
    label: 'Report Information',
    icon: '📄',
    color: 'orange'
  },
  timing: {
    label: 'Timing & TAT',
    icon: '⏱️',
    color: 'red'
  },
  clinical: {
    label: 'Clinical Data',
    icon: '📋',
    color: 'pink'
  },
  actions: {
    label: 'Actions',
    icon: '⚙️',
    color: 'slate'
  }
};

// ✅ USE UNIFIED DEFAULTS
export const getDefaultColumnsForRole = (roles = []) => {
  if (roles.length === 0) return [];
  return getDefaultColumnsForUser(roles);
};

export const getColumnsByCategory = (category) => {
  return Object.values(WORKLIST_COLUMNS).filter(col => col.category === category);
};

export const getAllColumns = () => {
  return Object.values(WORKLIST_COLUMNS);
};

export const getColumnById = (id) => {
  return Object.values(WORKLIST_COLUMNS).find(col => col.id === id);
};

export const isColumnAlwaysVisible = (columnId) => {
  const column = getColumnById(columnId);
  return column?.alwaysVisible || false;
};


