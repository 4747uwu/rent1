import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { Copy, UserPlus, Lock, Unlock, Edit, Clock, Download, Paperclip, MessageSquare, FileText, Monitor, Eye, ChevronLeft, ChevronRight, CheckCircle, XCircle, Palette, Share2, RotateCcw, Printer } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AssignmentModal from '../../assigner/AssignmentModal';
import StudyDetailedView from '../PatientDetailedView';
import ReportModal from '../ReportModal/ReportModal';
import StudyNotesComponent from '../StudyNotes/StudyNotesComponent';
import TimelineModal from '../TimelineModal';
import DownloadOptions from '../DownloadOptions/DownloadOptions';
import StudyDocumentsManager from '../../StudyDocuments/StudyDocumentsManager';
import api from '../../../services/api';
import { useAuth } from '../../../hooks/useAuth';
import { useColumnResizing } from '../../../hooks/useColumnResizing';
import ResizableTableHeader from './ResizableTableHeader';
import { UNIFIED_WORKLIST_COLUMNS } from '../../../constants/unifiedWorklistColumns';
import RevertModal from '../../../components/RevertModal.jsx';
import PrintModal from '../../../components/PrintModal.jsx';
import { calculateElapsedTime } from '../../../utils/dateUtils.js';
import useWebSocket from '../../../hooks/useWebSocket';
import { navigateWithRestore } from '../../../utils/backupRestoreHelper';
import sessionManager from '../../../services/sessionManager.jsx';

// ✅ UTILITY FUNCTIONS
const getStatusColor = (status) => {
  switch (status) {
    case 'new_study_received':
    case 'pending_assignment':
      return 'bg-gray-100 text-gray-700 border border-gray-300';
    case 'assigned_to_doctor':
    case 'doctor_opened_report':
    case 'report_in_progress':
      return 'bg-gray-200 text-gray-800 border border-gray-400';
    case 'report_drafted':
    case 'report_finalized':
      return 'bg-blue-100 text-blue-700 border border-blue-200';
    case 'verification_in_progress':
      return 'bg-yellow-100 text-yellow-700 border border-yellow-200';
    case 'report_verified':
      return 'bg-green-100 text-green-700 border border-green-200';
    case 'report_rejected':
      return 'bg-red-100 text-red-700 border border-red-200';
    case 'final_report_downloaded':
      return 'bg-gray-800 text-white border border-gray-900';
    default:
      return 'bg-slate-50 text-slate-700 border border-slate-200';
  }
};

const formatWorkflowStatus = (status) => {
  switch (status) {
    case 'new_study_received': return 'New';
    case 'pending_assignment': return 'Pending';
    case 'assigned_to_doctor': return 'Assigned';
    case 'doctor_opened_report': return 'Opened';
    case 'report_in_progress': return 'In Progress';
    case 'report_drafted': return 'Drafted';
    case 'report_finalized': return 'Finalized';
    case 'verification_in_progress': return 'Verifying';
    case 'report_verified': return 'Verified';
    case 'report_rejected': return 'Rejected';
    case 'final_report_downloaded': return 'Completed';
    default: return status || 'Unknown';
  }
};

const formatDate = (dateString) => {
  if (!dateString) return '-';
  try {
    return new Date(dateString).toLocaleDateString('en-US', { 
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return '-';
  }
};

const formatTime = (value) => {
  if (value === null || value === undefined || value === '') return '';

  try {
    const str = String(value).trim();
    const clean = str.split('.')[0]; // remove fractional seconds

    // Accept HHMM or HHMMSS
    if (!/^\d{4,6}$/.test(clean)) return '';

    const hh = clean.slice(0, 2);
    const mm = clean.slice(2, 4);

    // Basic validation
    if (+hh > 23 || +mm > 59) return '';

    return `${hh}:${mm}`;
  } catch {
    return '';
  }
};


const copyToClipboard = (text, label = 'ID') => {
  if (!text || text === 'N/A') {
    toast.error('No value to copy', { duration: 2000 });
    return;
  }
  
  navigator.clipboard.writeText(text).then(() => {
    toast.success(`${label} copied!`, {
      duration: 2000,
      position: 'top-center',
      style: { fontSize: '12px', padding: '8px 12px' }
    });
  }).catch(() => {
    toast.error('Failed to copy', { duration: 2000 });
  });
};

const PRIORITY_SORT_ORDER = {
  'EMERGENCY': 0,
  'PRIORITY':  1,
  'MLC':       2,
  'NORMAL':    3,
  'STAT':      4,
};

// ✅ ADD THIS BLOCK HERE ↓
const CASE_PRIORITY_OPTIONS = [
  {
    value: 'NORMAL',
    label: '🟢 Normal',
    border: 'border-gray-300',
    bg: 'bg-gray-50',
    text: 'text-gray-700',
    desc: 'Standard workflow — no special handling required.',
  },
  {
    value: 'STAT',
    label: '⏱️ STAT',
    border: 'border-sky-400',
    bg: 'bg-sky-50',
    text: 'text-sky-700',
    desc: 'Expedited turnaround — report needed soon.',
  },
  {
    value: 'PRIORITY',
    label: '⭐ Priority',
    border: 'border-purple-400',
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    desc: 'Elevated priority — handle before normal cases.',
  },
  {
    value: 'MLC',
    label: '⚖️ MLC',
    border: 'border-amber-400',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    desc: 'Medico-legal case — requires careful documentation.',
  },
  {
    value: 'EMERGENCY',
    label: '🚨 Emergency',
    border: 'border-red-500',
    bg: 'bg-red-50',
    text: 'text-red-700',
    desc: 'Life-threatening — report immediately.',
  },
];






const getPriorityWeight = (study) => {
  const p = (study.priority || study.assignment?.[0]?.priority || '').toUpperCase();
  return PRIORITY_SORT_ORDER[p] ?? 3; // default to NORMAL weight
};

const sortStudiesByPriority = (studies) => {
  return [...studies].sort((a, b) => getPriorityWeight(a) - getPriorityWeight(b));
};

// Priority tag badge renderer
const getPriorityTag = (study) => {
  const raw = study.priority || study.assignment?.[0]?.priority || '';
  const p = raw.toUpperCase();

  switch (p) {
    case 'EMERGENCY':
      return (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold text-red-600 bg-red-50 border border-red-200">
          🚨 Emergency
        </span>
      );
    case 'PRIORITY':
      return (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold text-purple-700 bg-purple-50 border border-purple-200">
          ⭐ Priority
        </span>
      );
    case 'MLC':
      return (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold text-gray-700 bg-gray-100 border border-gray-300">
          ⚖️ MLC
        </span>
      );
    case 'STAT':
      return (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold text-sky-700 bg-sky-50 border border-sky-200">
          ⏱️ STAT
        </span>
      );
    case 'NORMAL':
      return null; // no badge for normal — keep UI clean
    default:
      return null;
  }
};



const PatientEditModal = ({ study, isOpen, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    patientName: '',
    patientAge: '',
    patientGender: '',
    studyName: '',
    referringPhysician: '',
    accessionNumber: '',
    clinicalHistory: '',
    priority: 'NORMAL',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (study && isOpen) {
      // Normalize existing priority to one of our 5 canonical values
      const rawPriority = (study.priority || study.assignment?.[0]?.priority || '').toUpperCase().trim();
      const validValues = CASE_PRIORITY_OPTIONS.map(o => o.value);
      const resolvedPriority = validValues.includes(rawPriority) ? rawPriority : 'NORMAL';

      setFormData({
        patientName:       study.patientName || study.patientInfo?.patientName || '',
        patientAge:        study.patientAge  || study.patientInfo?.age          || '',
        patientGender:     study.patientSex  || study.patientInfo?.gender       || '',
        studyName:         study.studyDescription || study.examDescription      || '',
        referringPhysician:study.referralNumber   || study.referringPhysicianName || '',
        accessionNumber:   study.accessionNumber  || '',
        clinicalHistory:   study.clinicalHistory?.clinicalHistory || (typeof study.clinicalHistory === 'string' ? study.clinicalHistory : '') || '',
        priority:          resolvedPriority,
      });
    }
  }, [study, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave({ studyId: study._id, ...formData });
      toast.success('Study details updated successfully');
      onClose();
    } catch (error) {
      toast.error('Failed to update study details');
    } finally {
      setLoading(false);
    }
  };

  const selectedOption = CASE_PRIORITY_OPTIONS.find(o => o.value === formData.priority) || CASE_PRIORITY_OPTIONS[0];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden border-2 border-gray-900">

        {/* Header */}
        <div className="px-6 py-4 border-b-2 bg-gray-900 text-white flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold uppercase">{study?.patientName || 'Edit Study Details'}</h2>
            <p className="text-xs text-gray-300 mt-0.5 uppercase">
              BP ID: {study?.bharatPacsId} | MODALITY: {study?.modality}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-700 rounded-lg transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">

          {/* ── PRIORITY PICKER ─────────────────────────────────────────── */}
          <div className={`mb-6 p-4 rounded-lg border-2 ${selectedOption.border} ${selectedOption.bg} transition-all`}>
            <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2 uppercase">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                formData.priority === 'EMERGENCY' ? 'bg-red-600'    :
                formData.priority === 'PRIORITY'  ? 'bg-purple-600' :
                formData.priority === 'MLC'       ? 'bg-amber-600'  :
                formData.priority === 'STAT'      ? 'bg-sky-600'    :
                'bg-gray-500'
              }`}>!</span>
              Case Priority
            </h3>

            {/* Card-style selector */}
            <div className="grid grid-cols-5 gap-2 mb-3">
              {CASE_PRIORITY_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, priority: opt.value }))}
                  className={`p-2 rounded-lg border-2 text-center transition-all hover:scale-105 ${
                    formData.priority === opt.value
                      ? `${opt.border} ${opt.bg} ${opt.text} shadow-md font-bold`
                      : 'border-gray-200 bg-white text-gray-500 hover:border-gray-400'
                  }`}
                >
                  <div className="text-lg leading-none mb-1">
                    {opt.label.split(' ')[0]}
                  </div>
                  <div className="text-[10px] font-bold leading-tight">
                    {opt.label.split(' ').slice(1).join(' ')}
                  </div>
                </button>
              ))}
            </div>

            {/* Description of selected */}
            <p className={`text-xs ${selectedOption.text} font-medium`}>
              {selectedOption.desc}
            </p>
          </div>

          {/* ── PATIENT INFORMATION ────────────────────────────────────── */}
          <div className="mb-6">
            <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2 uppercase">
              <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs">1</span>
              Patient Information
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1 uppercase">
                  Patient Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.patientName}
                  onChange={(e) => setFormData(prev => ({ ...prev, patientName: e.target.value }))}
                  className="w-full px-3 py-2 text-sm font-semibold border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900 uppercase"
                  required
                  placeholder="ENTER PATIENT NAME"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1 uppercase">
                  Age <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.patientAge}
                  onChange={(e) => setFormData(prev => ({ ...prev, patientAge: e.target.value }))}
                  className="w-full px-3 py-2 text-sm font-semibold border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900 uppercase"
                  required
                  placeholder="E.G., 45Y"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1 uppercase">
                  Gender <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.patientGender}
                  onChange={(e) => setFormData(prev => ({ ...prev, patientGender: e.target.value }))}
                  className="w-full px-3 py-2 text-sm font-semibold border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900 uppercase"
                  required
                >
                  <option value="">SELECT GENDER</option>
                  <option value="M">MALE</option>
                  <option value="F">FEMALE</option>
                  <option value="O">OTHER</option>
                </select>
              </div>
            </div>
          </div>

          {/* ── STUDY INFORMATION ──────────────────────────────────────── */}
          <div className="mb-6">
            <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2 uppercase">
              <span className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-xs">2</span>
              Study Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1 uppercase">
                  Study Name / Description <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.studyName}
                  onChange={(e) => setFormData(prev => ({ ...prev, studyName: e.target.value }))}
                  className="w-full px-3 py-2 text-sm font-semibold border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900 uppercase"
                  required
                  placeholder="E.G., CT HEAD PLAIN"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1 uppercase">
                  Accession Number
                </label>
                <input
                  type="text"
                  value={formData.accessionNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, accessionNumber: e.target.value }))}
                  className="w-full px-3 py-2 text-sm font-semibold border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900 uppercase"
                  placeholder="ENTER ACCESSION NUMBER"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1 uppercase">
                  Referring Physician <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.referringPhysician}
                  onChange={(e) => setFormData(prev => ({ ...prev, referringPhysician: e.target.value }))}
                  className="w-full px-3 py-2 text-sm font-semibold border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900 uppercase"
                  required
                  placeholder="ENTER REFERRING PHYSICIAN NAME"
                />
              </div>
            </div>
          </div>

          {/* ── CLINICAL HISTORY ───────────────────────────────────────── */}
          <div className="mb-6">
            <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2 uppercase">
              <span className="w-6 h-6 bg-purple-600 text-white rounded-full flex items-center justify-center text-xs">3</span>
              Clinical History
            </h3>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1 uppercase">
                Clinical History / Notes <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.clinicalHistory}
                onChange={(e) => setFormData(prev => ({ ...prev, clinicalHistory: e.target.value }))}
                rows={4}
                className="w-full px-3 py-2 text-sm font-semibold border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900 resize-none uppercase"
                
                placeholder="ENTER CLINICAL HISTORY, SYMPTOMS, OR RELEVANT NOTES..."
              />
              <p className="text-xs text-gray-500 mt-1">
                {formData.clinicalHistory.length} / 2000 CHARACTERS
              </p>
            </div>
          </div>

          {/* ── FOOTER ─────────────────────────────────────────────────── */}
          <div className="flex justify-between items-center mt-6 pt-4 border-t-2 border-gray-200">
            <div className="text-xs text-gray-500 uppercase">
              <span className="text-red-500">*</span> REQUIRED FIELDS
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 text-sm font-bold bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 border-2 border-gray-300 transition-colors uppercase"
                disabled={loading}
              >
                CANCEL
              </button>
              <button
                type="submit"
                className={`px-6 py-2.5 text-sm font-bold text-white rounded-lg disabled:opacity-50 border-2 transition-colors flex items-center gap-2 uppercase ${
                  formData.priority === 'EMERGENCY' ? 'bg-red-600 border-red-600 hover:bg-red-700'       :
                  formData.priority === 'PRIORITY'  ? 'bg-purple-600 border-purple-600 hover:bg-purple-700' :
                  formData.priority === 'MLC'        ? 'bg-amber-600 border-amber-600 hover:bg-amber-700'  :
                  formData.priority === 'STAT'       ? 'bg-sky-600 border-sky-600 hover:bg-sky-700'       :
                  'bg-gray-900 border-gray-900 hover:bg-black'
                }`}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    SAVING...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    SAVE CHANGES
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

// ✅ STUDY ROW - ALL COLUMNS VISIBLE WITH DYNAMIC WIDTHS
const StudyRow = ({ 
  study, 
  activeViewers = [],
  index,
  selectedStudies,
  availableAssignees,
  onSelectStudy,
  onPatienIdClick,
  onAssignDoctor,
  onShowDetailedView,
  onViewReport,
  onShowStudyNotes,
  onViewStudy,
  onEditPatient,
  onAssignmentSubmit,
  onShowTimeline,
  onToggleLock,
  onShowDocuments,
  onShowRevertModal,
  setPrintModal,

  userRole,
  userRoles = [],
  getColumnWidth
}) => {
  const navigate = useNavigate();
  // console.log(study)
  
  const assignInputRef = useRef(null);
  const verifierInputRef = useRef(null);
  const downloadButtonRef = useRef(null);
  const [assignInputValue, setAssignInputValue] = useState('');
  const [verifierInputValue, setVerifierInputValue] = useState('');
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [assignmentModalPosition, setAssignmentModalPosition] = useState(null);
  const [inputFocused, setInputFocused] = useState(false);
  const [showDownloadOptions, setShowDownloadOptions] = useState(false);
  const [downloadPosition, setDownloadPosition] = useState(null);
  const [togglingLock, setTogglingLock] = useState(false);
  const [restoringStudy, setRestoringStudy] = useState(false); // ✅ NEW STATE
  const hasActiveViewers  = activeViewers.length > 0;

  const isSelected = selectedStudies?.includes(study._id);
  const studyPriority = (study.priority || study.assignment?.[0]?.priority || '').toUpperCase();
  const isEmergencyCase = studyPriority === 'EMERGENCY';
  const isPriorityCase  = studyPriority === 'PRIORITY';
  const isMLCCase       = studyPriority === 'MLC';
  const isStatCase      = studyPriority === 'STAT';
  const isUrgent = isEmergencyCase;   const isAssigned = study.isAssigned;
  const isLocked = study?.isLocked || false;
  const hasNotes = study.hasStudyNotes === true || (study.discussions && study.discussions.length > 0);
  const hasAttachments = study.attachments && study.attachments.length > 0;
  const canToggleLock = userRoles.includes('admin') || userRoles.includes('assignor') || userRole === 'admin' || userRole === 'assignor';
  const isRejected = study.workflowStatus === 'report_rejected';
  const rejectionReason = study.reportInfo?.verificationInfo?.rejectionReason || '-';

  // ✅ Check if study is an Emergency Case
  // const isEmergencyCase = study?.priority === 'EMERGENCY CASE';

  const userAccountRoles = userRoles.length > 0 ? userRoles : [userRole];

    const [elapsedTime, setElapsedTime] = useState(null);

      const assignedDoctor = study.assignedDoctors?.[0] || study.assignment?.[0];
  const isAssignedStatus = assignedDoctor?.status === 'assigned';
  const assignedAt = assignedDoctor?.assignedAt;
  
  // Check if report is completed
  const isReportCompleted = ['report_drafted', 'report_finalized', 'verification_pending', 'report_verified', 'report_completed'].includes(study.workflowStatus);
  const reportCompletedAt = study.reportInfo?.finalizedAt || study.reportInfo?.draftedAt;
  console.log(study)

  // Update timer every second if assigned
  useEffect(() => {
    if (isAssignedStatus && assignedAt) {
      const interval = setInterval(() => {
        setElapsedTime(calculateElapsedTime(assignedAt));
      }, 1000);
      
      return () => clearInterval(interval);
    }
  }, [isAssignedStatus, assignedAt]);


  // ✅ PRIORITY SYSTEM
// Sort order: Emergency (top) → Priority → MLC → Normal → STAT (bottom)



  useEffect(() => {
    if (!inputFocused && !showAssignmentModal) {
      setAssignInputValue(isAssigned && study.assignedTo ? study.assignedTo : '');
    }
  }, [isAssigned, study.assignedTo, inputFocused, showAssignmentModal]);

  useEffect(() => {
    if (study.verifier) {
      setVerifierInputValue(
        typeof study.verifier === 'string' 
          ? study.verifier 
          : study.verifier?.fullName || study.verifier?.email || study.reportInfo?.verificationInfo?.verifiedBy?.name || study.verifiedBy || ''
      );
    }
  }, [study.verifier]);

  // ✅ NEW: Direct print handler (bypasses ReportModal)


  const rowClasses = `${
    isEmergencyCase ? 'border-l-4 border-l-red-600' :     // Emergency: red left border only
    isPriorityCase  ? 'border-l-4 border-l-purple-500' :  // Priority: purple left border
    isStatCase      ? 'opacity-90' :                       // STAT: slightly muted
    isSelected      ? 'bg-gray-100 border-l-2 border-l-gray-900' :
    isAssigned      ? 'bg-gray-50' :
    index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
  } ${isRejected && !isEmergencyCase ? 'border-l-4 border-l-rose-600' : ''} ${
    isEmergencyCase ? 'hover:bg-red-50' :
    isPriorityCase  ? 'hover:bg-purple-50' :
    'hover:bg-gray-100'
  } transition-all duration-200 border-b border-slate-100`;


  const handleAssignInputFocus = (e) => {
    if (isLocked) {
      toast.error(`Locked by ${study.studyLock?.lockedByName}`, { icon: '🔒' });
      e.target.blur();
      return;
    }

    setInputFocused(true);
    setAssignInputValue('');
    
    if (assignInputRef.current) {
      const rect = assignInputRef.current.getBoundingClientRect();
      setAssignmentModalPosition({
        top: rect.bottom + 8,
        left: Math.max(20, Math.min(rect.left, window.innerWidth - 470)),
        width: 450,
        zIndex: 99999
      });
      setShowAssignmentModal(true);
    }
  };

  const handleCloseAssignmentModal = () => {
    setShowAssignmentModal(false);
    setInputFocused(false);
    setAssignInputValue(isAssigned && study.radiologist ? study.radiologist : '');
  };

  const handleAssignmentSubmit = async (assignmentData) => {
    await onAssignmentSubmit(assignmentData);
    handleCloseAssignmentModal();
  };
  const handleDirectPrint = useCallback(async (study) => {
    try {
        console.log('🖨️ [Direct Print] Fetching report for study:', study._id);
        
        // ✅ VALIDATE WORKFLOW STATUS FIRST
        const allowedStatuses = ['report_reprint_needed', 'report_completed', 'reprint_requested'];
        if (!allowedStatuses.includes(study.workflowStatus)) {
            toast.error(`Cannot print report in "${study.workflowStatus}" status. Only completed or reprint-requested reports can be printed.`);
            console.log('❌ [Direct Print] Invalid status:', study.workflowStatus);
            return;
        }
        
        // Fetch the latest report for this study
        const response = await api.get(`/reports/studies/${study._id}`);
        
        if (!response.data.success || !response.data.data.reports || response.data.data.reports.length === 0) {
            toast.error('No report found for this study');
            return;
        }
        
        // Get the latest finalized report
        const reports = response.data.data.reports;
        const latestReport = reports.find(r => r.reportStatus === 'finalized') || reports[0];
        
        if (!latestReport) {
            toast.error('No finalized report available');
            return;
        }
        
        console.log('✅ [Direct Print] Opening print modal for report:', latestReport._id);
        
        // Open print modal directly
        setPrintModal({
            show: true,
            report: latestReport
        });
        
    } catch (error) {
        console.error('❌ [Direct Print] Error:', error);
        toast.error('Failed to load report for printing');
    }
}, []); 

  const handleDownloadClick = (e) => {
    e.stopPropagation();
    if (downloadButtonRef.current) {
      const rect = downloadButtonRef.current.getBoundingClientRect();
      setDownloadPosition({
        top: rect.bottom + 8,
        left: Math.max(20, Math.min(rect.left, window.innerWidth - 300))
      });
      setShowDownloadOptions(true);
    }
  };

  // ✅ UPDATED: View Only with Restore Check
  const handleViewOnlyClick = async (e) => {
    e.stopPropagation();
    
    setRestoringStudy(true);
    
    try {
      // ✅ Use navigateWithRestore to open in new tab
      await navigateWithRestore(
        // Custom navigate function that opens in new tab
        (path) => window.open(path, '_blank'),
        `/doctor/viewer/${study._id}`,
        study,
        {
          daysThreshold: 1,
          onRestoreStart: (study) => {
            console.log(`🔄 [View Only] Restoring study: ${study.bharatPacsId}`);
            toast.loading(`Restoring study from backup...`, { id: `restore-${study._id}` });
          },
          onRestoreComplete: (data) => {
            console.log(`✅ [View Only] Restore completed:`, data);
            toast.success(`Study restored (${data.fileSizeMB}MB)`, { id: `restore-${study._id}` });
          },
          onRestoreError: (error) => {
            console.error(`❌ [View Only] Restore failed:`, error);
            toast.error(`Restore failed: ${error}`, { id: `restore-${study._id}` });
          }
        }
      );
    } catch (error) {
      console.error('Error in handleViewOnlyClick:', error);
      // Still open the viewer even if restore fails
      window.open(`/doctor/viewer/${study._id}`, '_blank');
    } finally {
      setRestoringStudy(false);
    }
  };

  // ✅ UPDATED: OHIF Reporting with Restore Check
// ✅ UPDATED: OHIF Reporting with Restore Check + Role-based Lock Logic
const handleOHIFReporting = async () => {
  setRestoringStudy(true);
  
  try {
    // ✅ Get current user and check roles
    const currentUser = sessionManager.getCurrentUser();
    const accountRoles = currentUser?.accountRoles || [currentUser?.role];
    
    // ✅ Check if user is radiologist (only radiologists can lock/bypass)
    const isRadiologist = accountRoles.includes('radiologist');
    
    // ✅ Check if user is verifier (read-only access)
    const isVerifier = accountRoles.includes('verifier');
    
    // ✅ ONLY RADIOLOGISTS attempt to lock (and can bypass existing locks)
    if (isRadiologist && !isVerifier) {
      console.log('🔒 [Lock] Radiologist - attempting to lock study (will bypass if already locked)');
      
      try {
        setTogglingLock(true);
        const lockResponse = await api.post(`/admin/studies/${study._id}/lock`);
        
        if (lockResponse?.data?.success) {
          toast.success('Study locked for reporting', { 
            icon: '🔒',
            duration: 2000,
            style: {
              border: '1px solid #10b981',
            }
          });
        }
        setTogglingLock(false);
      } catch (lockError) {
        setTogglingLock(false);
        // ✅ Radiologist can bypass locks - just show info message
        if (lockError.response?.status === 423) {
          const lockedBy = lockError.response.data.lockedBy || 'another user';
          console.log(`⚠️ [Bypass] Study locked by ${lockedBy}, but radiologist can proceed`);
          
          toast.info(`Study locked by ${lockedBy} - Opening anyway (Radiologist bypass)`, {
            duration: 3000,
            icon: '⚠️',
            style: {
              border: '1px solid #f59e0b',
            }
          });
        } else {
          // Some other error - log but still proceed
          console.warn('⚠️ [Lock] Lock attempt failed, proceeding anyway:', lockError);
        }
      }
    } else if (isVerifier) {
      console.log('✅ [Verifier] Read-only access - no locking');
    } else {
      console.log('👁️ [Viewer] Non-radiologist - no locking');
    }
    
    // ✅ Build URL with appropriate query params
    const queryParams = new URLSearchParams({
      openOHIF: 'true',
      ...(isVerifier && { verifierMode: 'true', action: 'verify' })
    });
    
    const reportingUrl = `/online-reporting/${study._id}?${queryParams.toString()}`;
    
    // ✅ USE navigateWithRestore TO CHECK 10-DAY THRESHOLD AND RESTORE IF NEEDED
    await navigateWithRestore(
      // Custom navigate function that opens in new tab
      (path) => window.open(path, '_blank'),
      reportingUrl,
      study,
      {
        daysThreshold: 10, // ✅ 10-day threshold for restore
        onRestoreStart: (study) => {
          console.log(`🔄 [OHIF Reporting] Restoring study: ${study.bharatPacsId}`);
          toast.loading(`Restoring study from backup...`, { id: `restore-report-${study._id}` });
        },
        onRestoreComplete: (data) => {
          console.log(`✅ [OHIF Reporting] Restore completed:`, data);
          toast.success(`Study restored (${data.fileSizeMB}MB)`, { id: `restore-report-${study._id}` });
        },
        onRestoreError: (error) => {
          console.error(`❌ [OHIF Reporting] Restore failed:`, error);
          toast.error(`Restore failed: ${error}`, { id: `restore-report-${study._id}` });
        }
      }
    );
    
  } catch (error) {
    console.error('❌ [Error] OHIF reporting error:', error);
    
    // ✅ Only show lock errors for non-radiologists
    const currentUser = sessionManager.getCurrentUser();
    const accountRoles = currentUser?.accountRoles || [currentUser?.role];
    const isRadiologist = accountRoles.includes('radiologist');
    
    if (error.response?.status === 423 && !isRadiologist) {
      // Study is locked and user is NOT a radiologist
      const lockedBy = error.response.data.lockedBy || 'another user';
      
      toast.error(`Study is locked by ${lockedBy}`, {
        duration: 5000,
        icon: '🔒',
        style: {
          border: '1px solid #ef4444',
        }
      });
    } else if (error.response?.status !== 423) {
      // Other errors (not lock-related)
      toast.error(error.response?.data?.message || 'Failed to open study', {
        duration: 4000,
        icon: '❌'
      });
    }
    
    // ✅ Still try to open the reporting interface even if lock/restore fails
    const queryParams = new URLSearchParams({
      openOHIF: 'true',
      ...(accountRoles.includes('verifier') && { verifierMode: 'true', action: 'verify' })
    });
    window.open(`/online-reporting/${study._id}?${queryParams.toString()}`, '_blank');
    
  } finally {
    setTogglingLock(false);
    setRestoringStudy(false);
  }
};

  const handleLockToggle = async (e) => {
    e.stopPropagation();
    if (!canToggleLock) {
      toast.error('You do not have permission to lock/unlock studies');
      return;
    }
    setTogglingLock(true);
    try {
      await onToggleLock(study._id, !isLocked);
      toast.success(isLocked ? 'Study unlocked' : 'Study locked');
    } catch (error) {
      toast.error('Failed to toggle study lock');
    } finally {
      setTogglingLock(false);
    }
  };

  return (
    <tr className={rowClasses}>
      {/* 1. SELECTION CHECKBOX */}
      <td className="px-2 py-3 text-center border-r border-b border-slate-200" style={{ width: `${getColumnWidth('selection')}px` }}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onSelectStudy(study._id)}
          className="w-4 h-4 rounded border-slate-300 text-slate-800 focus:ring-slate-500"
        />
      </td>

      {/* 2. BHARAT PACS ID */}
      <td className="px-3 py-3.5 text-center border-r border-b border-slate-200">
        <div className="flex items-center justify-center gap-1.5">
          <span className="text-xs font-mono font-semibold text-slate-700 truncate">
            {study.bharatPacsId}
          </span>
          <button onClick={() => copyToClipboard(study.bharatPacsId, 'BP ID')}>
            <Copy className="w-3.5 h-3.5 text-slate-500" />
          </button>
          
          {/* ✅ NEW: Active Viewer Indicator */}
          {hasActiveViewers && (
            <div 
              className="relative group"
              title={`Viewing: ${activeViewers.map(v => v.userName).join(', ')}`}
            >
              <Eye className="w-4 h-4 text-blue-600 animate-pulse" />
              <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {activeViewers.length}
              </span>
              
              {/* Tooltip on hover */}
              <div className="absolute hidden group-hover:block bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap z-50">
                {activeViewers.map(v => (
                  <div key={v.userId}>{v.userName} ({v.mode})</div>
                ))}
              </div>
            </div>
          )}
        </div>
      </td>

      {/* 3. ORGANIZATION */}
      {/* 3. ORGANIZATION - Only for super_admin */}
{(userRoles.includes('super_admin') || userRole === 'super_admin') && (
  <td className="px-3 py-3.5 border-r border-b border-slate-200" style={{ width: `${getColumnWidth('organization')}px` }}>
    <div className="text-xs text-slate-600 truncate" title={study.organizationName}>
      {study.organizationName || '-'}
    </div>
  </td>
)}

      {/* 4. CENTER NAME */}
      <td className="px-3 py-3.5 border-r border-b border-slate-200" style={{ width: `${getColumnWidth('centerName')}px` }}>
        <div className="text-xs font-bold text-center text-slate-900 truncate"
 title={study.centerName}>
          {study.centerName || '-'}
        </div>
      </td>

      {/* //location */}
 <td
  className="px-2 py-2 border-r border-b border-slate-200"
  style={{ width: `${getColumnWidth('centerName')}px` }}
>
  <div className="flex items-center justify-center h-full text-xs text-slate-600 text-center whitespace-normal break-words leading-snug">
    {study?.location || '-'}
  </div>
</td>



      {/* 5. TIMELINE */}
      <td className="px-3 py-3.5 text-center border-r border-b border-slate-200" style={{ width: `${getColumnWidth('timeline')}px` }}>
        <button
          onClick={() => onShowTimeline?.(study)}
          className="p-2 hover:bg-gray-200 rounded-lg transition-all hover:scale-110"
          title="View Timeline"
        >
          <Clock className="w-4 h-4 text-gray-700" />
        </button>
      </td>

      {/* 6. PATIENT NAME / UHID */}
      <td className="px-3 py-3.5 border-r border-b border-slate-200" style={{ width: `${getColumnWidth('patientName')}px` }}>
        <button 
          className="w-full text-left hover:underline decoration-gray-900"
          onClick={() => onPatienIdClick?.(study.patientId, study)}
        >
          <div className="text-xs font-bold text-slate-800 truncate flex items-center gap-1" title={study.patientName}>
            {study.patientName || '-'}
            {isUrgent && <span className="text-rose-500">●</span>}
            {isRejected && <span className="text-rose-600" title={`Rejected: ${rejectionReason}`}>🚫</span>}
          </div>
          <div className="text-[10px] text-slate-500 truncate">
            UHID: {study.patientId || '-'}
          </div>
        </button>
        {getPriorityTag(study)}
      </td>

      {/* 7. AGE/SEX */}
      <td className="px-3 py-3.5 text-center border-r border-b border-slate-200" style={{ width: `${getColumnWidth('ageGender')}px` }}>
        <div className="text-xs font-medium text-slate-700">
          {study.ageGender !== 'N/A' ? study.ageGender : 
           study.patientAge && study.patientSex ? 
           `${study.patientAge}/${study.patientSex.charAt(0)}` : 
           study.patientAge && study.patientGender ?
           `${study.patientAge}/${study.patientGender.charAt(0)}` : '-'}
        </div>
      </td>

      {/* 8. MODALITY */}
      <td className="px-3 py-3.5 text-center border-r border-b border-slate-200" style={{ width: `${getColumnWidth('modality')}px` }}>
        <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold shadow-sm ${
          isUrgent ? 'bg-rose-200 text-rose-700 border border-rose-200' : 'bg-gray-200 text-gray-900 border border-gray-300'
        }`}>
          {study.modality || '-'}
        </span>
      </td>

      {/* 9. VIEW */}
      <td className="px-3 py-3.5 text-center border-r border-b border-slate-200" style={{ width: `${getColumnWidth('viewOnly')}px` }}>
        <button
          onClick={handleViewOnlyClick}
          className="p-2 hover:bg-gray-100 rounded-lg transition-all group hover:scale-110"
          title="View Images Only (No Locking)"
        >
          <Eye className="w-4 h-4 text-gray-700 group-hover:text-gray-900" />
        </button>
      </td>

      <td className="px-3 py-3.5 text-center border-r border-b border-slate-200" style={{ width: `${getColumnWidth('ohif&reporting')}px` }}>
        <button
          onClick={handleOHIFReporting}
          className="p-2 hover:bg-gray-100 rounded-lg transition-all group hover:scale-110"
          title="View Images Only (No Locking)"
        >
         <div className="flex items-center justify-center h-full w-full">
                  <Monitor className="w-4 h-4 text-emerald-600 group-hover:text-emerald-700" />
                </div>
        </button>
      </td>

      {/* 10. SERIES/IMAGES */}
      <td
  className="px-3 py-3.5 text-center border-r border-b border-slate-200 align-top"
  style={{ width: `${getColumnWidth('studySeriesImages')}px` }}
>
  <div className="text-[11px] text-slate-600 break-words whitespace-normal leading-snug">
    {study.studyDescription || 'N/A'}
  </div>

  <div className="text-xs font-semibold text-slate-800 mt-1">
    S: {study.seriesCount || 0} / {study.instanceCount || 0}
  </div>
</td>


      {/* 11. PT ID */}
      <td className="px-3 py-3.5 border-r border-b border-slate-200" style={{ width: `${getColumnWidth('patientId')}px` }}>
        <button 
          className="text-teal-600 hover:text-teal-700 font-semibold text-xs hover:underline"
          onClick={() => onPatienIdClick?.(study.patientId, study)}
        >
          {study.patientId || study.patientInfo?.patientID || 'N/A'}
        </button>
      </td>

      {/* 12. REFERRAL DOCTOR */}
      <td className="px-3 py-3.5 border-r border-b border-slate-200" style={{ width: `${getColumnWidth('referralDoctor')}px` }}>
        <div className="text-xs text-slate-700 truncate" title={study.referralNumber || study.referringPhysician}>
          {study.referralNumber || study.referringPhysician || '-'}
        </div>
      </td>

      {/* 13. CLINICAL HISTORY */}
  <td className="px-3 py-3.5 border-r border-b border-slate-200" style={{ width: `${getColumnWidth('clinicalHistory')}px` }}>
        <div className="text-xs font-bold text-slate-700 line-clamp-2 uppercase" title={study.clinicalHistory}>
          {study.clinicalHistory || '-'}
        </div>

  {/* Action Buttons */}
  <div className="flex items-center gap-4 mt-3">
    <button
      onClick={() => onEditPatient?.(study)}
      className="flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-slate-900 hover:underline transition-colors"
    >
      <Edit className="w-4 h-4" />
      Edit
    </button>

    <button
      onClick={() => onShowDocuments?.(study._id)}
      className={`p-2 rounded-lg transition-all hover:scale-105 relative ${
        hasAttachments ? 'bg-slate-200' : 'hover:bg-slate-100'
      }`}
      title={
        hasAttachments
          ? `${study.attachments.length} attachment(s)`
          : 'Manage attachments'
      }
    >
      <Paperclip
        className={`w-4 h-4 ${
          hasAttachments ? 'text-slate-900' : 'text-slate-400'
        }`}
      />

      {hasAttachments && study.attachments.length > 0 && (
        <span className="absolute -top-1 -right-1 bg-slate-900 text-white text-[10px] font-semibold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 shadow-sm">
          {study.attachments.length}
        </span>
      )}
    </button>

    <button
                  onClick={() => onShowStudyNotes?.(study._id)}
                  className={`relative p-2 rounded-lg transition-all group hover:scale-110 ${
                    hasNotes ? 'bg-gray-200' : 'hover:bg-slate-100'
                  }`}
                  title={hasNotes ? `${study.notesCount || '1'} note(s)` : 'No notes'}
                >
                  <div className="flex items-center gap-1">
                    <MessageSquare className={`w-4 h-4 ${
                      hasNotes ? 'text-gray-900' : 'text-slate-400'
                    } group-hover:text-gray-900`} />
                    {study.notesCount > 0 && (
                      <span className="bg-gray-900 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 shadow-sm">
                        {study.notesCount}
                      </span>
                    )}
                  </div>
                </button>
  </div>
</td>


      {/* 14. STUDY DATE/TIME */}
      <td className="px-3 py-3.5 text-center border-r border-b border-slate-200" style={{ width: `${getColumnWidth('studyDateTime')}px` }}>
        <div className="text-[11px] font-medium text-slate-800">{formatDate(study.studyDate)}</div>
        <div className="text-[10px] text-slate-500">{formatTime(study.studyTime) || '-'}</div>
      </td>

      {/* 15. UPLOAD DATE/TIME */}
   <td className="px-3 py-3.5 text-center border-r border-b border-slate-200" style={{ width: `${getColumnWidth('uploadDateTime')}px` }}>
    <div className="text-[11px] font-medium text-slate-800">
        {formatDate(study.uploadDate || study.createdAt)}
    </div>
    <div className="text-[10px] text-slate-500">
        {study.uploadTime ? study.uploadTime.split(',')[2]?.trim() || study.uploadTime : formatTime(study.uploadDate || study.createdAt)}
    </div>
</td>

<td className="px-3 py-3.5 border-r border-b border-slate-200" style={{ width: `${getColumnWidth('assignedRadiologist')}px` }}>
  <div className="relative">
    <input
      ref={assignInputRef}
      type="text"
      value={assignInputValue}
      onChange={(e) => setAssignInputValue(e.target.value)}
      onFocus={handleAssignInputFocus}
      onBlur={() => {
        setTimeout(() => {
          if (!showAssignmentModal) {
            setInputFocused(false);
            setAssignInputValue(isAssigned && study.radiologist ? study.radiologist : '');
          }
        }, 200);
      }}
      placeholder={isLocked ? "🔒 Locked" : "Search radiologist..."}
      disabled={isLocked}
      className={`w-full px-3 py-2 text-xs border-2 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900 transition-all ${
        isLocked ? 'bg-slate-200 cursor-not-allowed text-slate-500 border-gray-400' : 
        isAssigned && !inputFocused ? 'bg-gray-200 border-gray-400 text-gray-900 font-medium shadow-sm' : 
        'bg-white border-slate-200 hover:border-slate-300'
      }`}
    />
    {isAssigned && !inputFocused && !isLocked && (
      <div className="w-2 h-2 bg-gray-900 rounded-full absolute right-3 top-3 shadow-sm" />
    )}
    {isLocked && (
      <Lock className="w-4 h-4 text-rose-600 absolute right-3 top-2.5" />
    )}
  </div>
  
  {/* ✅ NEW: Timer below radiologist name */}
  {isAssigned && assignedDoctor && (
    <div className="mt-1 flex items-center justify-between gap-2">
      {isAssignedStatus && !isReportCompleted && elapsedTime ? (
        // Show running timer if still assigned and no report
        <div className="flex items-center gap-1.5 px-2 py-0 bg-amber-50 border border-amber-200 rounded-md">
          <Clock className="w-2 h-2 text-amber-600 animate-pulse" />
          <span className="text-[10px] font-mono font-bold text-amber-700">
            {elapsedTime}
          </span>
        </div>
      ) : isReportCompleted && assignedAt && reportCompletedAt ? (
        // Show completed time if report is done
        <div className="flex items-center gap-1.5 px-2 py-1 bg-green-50 border border-green-200 rounded-md">
          <CheckCircle className="w-3 h-3 text-green-600" />
          <span className="text-[10px] font-mono font-bold text-green-700">
            ✓ {formatTimeTaken(assignedAt, reportCompletedAt)}
          </span>
        </div>
      ) : null}
      
      {/* Show priority badge if urgent */}
      {assignedDoctor.priority === 'URGENT' && (
        <span className="text-[9px] px-1.5 py-0.5 bg-rose-100 text-rose-700 rounded font-bold">
          URGENT
        </span>
      )}
    </div>
  )}
</td>

      {/* 17. LOCK/UNLOCK TOGGLE */}
      <td className="px-3 py-3.5 text-center border-r border-slate-200" style={{ width: `${getColumnWidth('studyLock')}px` }}>
        <button
          onClick={handleLockToggle}
          disabled={togglingLock || !canToggleLock}
          className={`p-2 rounded-lg transition-all group hover:scale-110 ${
            togglingLock ? 'opacity-50 cursor-not-allowed' : 
            !canToggleLock ? 'opacity-30 cursor-not-allowed' :
            isLocked ? 'hover:bg-rose-50' : 'hover:bg-slate-100'
          }`}
          title={isLocked ? `Locked by ${study.studyLock?.lockedByName}` : 'Lock Study'}
        >
          {isLocked ? (
            <Lock className="w-4 h-4 text-rose-600 group-hover:text-rose-700" />
          ) : (
            <Unlock className="w-4 h-4 text-slate-500 group-hover:text-rose-600" />
          )}
        </button>
      </td>

      {/* 18. STATUS - WITH DATE/TIME */}
      <td className="px-3 py-3.5 text-center border-r border-slate-200" style={{ width: `${getColumnWidth('status')}px` }}>
        <div className="flex flex-col items-center gap-1">
          <span className={`px-2.5 py-1 rounded-md text-[10px] font-medium shadow-sm ${getStatusColor(study.workflowStatus)}`}>
            {study.caseStatusCategory || formatWorkflowStatus(study.workflowStatus)}
          </span>
          <span className="text-xs text-slate-600">{study.workflowStatus ? formatWorkflowStatus(study.workflowStatus) : '-'}</span>
          {study.statusHistory && study.statusHistory.length > 0 && (() => {
            const currentStatusEntry = study.statusHistory
              .slice()
              .reverse()
              .find(entry => entry.status === study.workflowStatus);
            
            if (currentStatusEntry && currentStatusEntry.changedAt) {
              return (
                <div className="text-[9px] text-slate-500">
                  {formatDate(currentStatusEntry.changedAt)} {formatTime(currentStatusEntry.changedAt)}
                </div>
              );
            }
            return null;
          })()}
        </div>
      </td>

      {/* 19. PRINT COUNT */}
      <td className="px-3 py-3.5 text-center border-r border-b border-slate-200" style={{ width: `${getColumnWidth('printCount')}px` }}>
  {study.printCount > 0 || (study.printInfo && study.printInfo.totalPrints > 0) ? (
    <div className="flex flex-col items-center gap-1">
      
      <button
          onClick={() => handleDirectPrint(study)}
          className="p-2 hover:bg-purple-50 rounded-lg transition-all group hover:scale-110"
          title="Print Report"
      >
          <Printer className="w-4 h-4 text-purple-600 group-hover:text-purple-700" />
      </button>
      
      {/* Print Date & Time */}
      <div className="text-[10px] text-slate-500 text-center">
        <div className="font-medium">{formatDate(study.lastPrintedAt || study.printInfo?.lastPrintedAt)}</div>
        <div>{formatTime(study.lastPrintedAt || study.printInfo?.lastPrintedAt)}</div>
      </div>
      
      {/* Printed By */}
      {study.lastPrintedBy && (
        <div className="text-[9px] text-slate-600 font-medium">
          By: {study.lastPrintedBy}
        </div>
      )}
      
      {/* Print Type Badge */}
      {study.lastPrintType && (
        <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold ${
          study.lastPrintType === 'reprint' 
            ? 'bg-rose-100 text-rose-700' 
            : 'bg-emerald-100 text-emerald-700'
        }`}>
          {study.lastPrintType.toUpperCase()}
        </span>
      )}
      
      {/* First print indicator if reprinted - fallback to printInfo if exists */}
      {((study.printCount > 1 || study.printInfo?.totalPrints > 1) && study.printInfo?.firstPrintedAt) && (
        <div className="text-[9px] text-slate-400 flex items-center gap-0.5">
          <Clock className="w-2.5 h-2.5" />
          <span>First: {formatDate(study.printInfo.firstPrintedAt)}</span>
        </div>
      )}
    </div>
  ) : (
    <button
      onClick={() => handleDirectPrint(study)}
      className="flex flex-col items-center gap-1 px-2 py-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all"
      title="No prints yet - Click to print report"
    >
      <Printer className="w-4 h-4" />
      <span className="text-[10px]">No prints</span>
    </button>
  )}
</td>

      <td className="px-3 py-3.5 border-r border-slate-200" style={{ width: `${getColumnWidth('rejectionReason')}px` }}>
        {isRejected ? (
          <div className="flex items-start gap-2">
            <XCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <div 
              className="text-xs text-rose-700 leading-relaxed font-medium" 
              style={{
                whiteSpace: 'normal',
                overflowWrap: 'break-word',
                wordBreak: 'break-word'
              }}
              title={rejectionReason}
            >
              {study.verificationNotes || rejectionReason}
            </div>
          </div>
        ) : (
          <div className="text-xs text-slate-400 text-center">-</div>
        )}
      </td>

      {/* 20. VERIFIED BY */}
      <td className="px-3 py-3.5 border-r border-b border-slate-200" style={{ width: `${getColumnWidth('assignedVerifier')}px` }}>
        <div className="text-xs text-slate-700 truncate">
          {typeof study.verifier === 'string' 
            ? study.verifier 
            : study.verifier?.fullName || study.verifier?.email || study.reportInfo?.verificationInfo?.verifiedBy?.name || study.verifiedBy || '-'}
        </div>
      </td>

      {/* 21. VERIFIED DATE/TIME */}
 <td className="px-3 py-3.5 text-center border-r border-b border-slate-200" style={{ width: `${getColumnWidth('verifiedDateTime')}px` }}>
  <div className="text-[11px] font-medium text-slate-800">
    {(() => {
      const ts = study.reportInfo?.verificationInfo?.verifiedAt || study.verifiedAt;
      if (!ts) return '-';
      try {
        const d = new Date(ts);
        return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
      } catch {
        return '-';
      }
    })()}
  </div>
  <div className="text-[10px] text-slate-500">
    {(() => {
      const ts = study.reportInfo?.verificationInfo?.verifiedAt || study.verifiedAt;
      if (!ts) return '-';
      try {
        const d = new Date(ts);
        return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' });
      } catch {
        return '-';
      }
    })()}
  </div>
</td>

            
      {/* 22. ACTIONS - ALL ADMIN OPTIONS */}
     <td className="px-3 py-3.5 text-center border-slate-200" style={{ width: `${getColumnWidth('actions')}px` }}>
  <div className="flex items-center justify-center gap-1.5 flex-wrap">
    {/* ADMIN/ASSIGNOR GETS ALL OPTIONS */}
    {(userAccountRoles.includes('admin') || userAccountRoles.includes('assignor') || userAccountRoles.includes('super_admin')) && (
      <>
        {/* Download Button */}
        <button
          ref={downloadButtonRef}
          onClick={handleDownloadClick}
          className="p-2 hover:bg-blue-50 rounded-lg transition-all group hover:scale-110"
          title="Download Options"
        >
          <Download className="w-4 h-4 text-blue-600 group-hover:text-blue-700" />
        </button>

        {/* OHIF + Reporting Button */}
        <button
          onClick={handleOHIFReporting}
          className="p-2 hover:bg-emerald-50 rounded-lg transition-all group hover:scale-110"
          title="OHIF + Reporting"
        >
          <Monitor className="w-4 h-4 text-emerald-600 group-hover:text-emerald-700" />
        </button>

        {/* View Report Button */}
        <button
          onClick={() => onViewReport?.(study)}
          className="p-2 hover:bg-purple-50 rounded-lg transition-all group hover:scale-110"
          title="View Report"
        >
          <FileText className="w-4 h-4 text-purple-600 group-hover:text-purple-700" />
        </button>

        {/* DICOM Viewer Button */}
        <button
          onClick={() => {
            const ohifUrl = `/ohif/viewer?StudyInstanceUIDs=${study.studyInstanceUID || study._id}`;
            window.open(ohifUrl, '_blank');
          }}
          className="p-2 hover:bg-indigo-50 rounded-lg transition-all group hover:scale-110"
          title="DICOM Viewer"
        >
          <Eye className="w-4 h-4 text-indigo-600 group-hover:text-indigo-700" />
        </button>

        {/* Share Button */}
        <button
          onClick={() => {
            const shareUrl = `${window.location.origin}/study/${study._id}`;
            navigator.clipboard.writeText(shareUrl);
            toast.success('Study link copied to clipboard!');
          }}
          className="p-2 hover:bg-sky-50 rounded-lg transition-all group hover:scale-110"
          title="Share Study"
        >
          <Share2 className="w-4 h-4 text-sky-600 group-hover:text-sky-700" />
        </button>
      </>
    )}

    {(userRoles.includes('admin') || userRoles.includes('super_admin')) && 
    ['report_drafted', 'report_finalized', 'verification_pending', 'report_verified', 'report_completed'].includes(study.workflowStatus) && (
      <button
        onClick={() => onShowRevertModal(study)}
        className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded hover:bg-rose-100 transition-colors"
        title="Revert to Radiologist"
      >
        <RotateCcw className="w-3 h-3" />
        <span>Revert</span>
      </button>
    )}

    {/* RADIOLOGIST ACTIONS */}
    {userAccountRoles.includes('radiologist') && !userAccountRoles.includes('admin') && !userAccountRoles.includes('assignor') && (
      <>
        <button
          onClick={handleOHIFReporting}
          className="p-2 hover:bg-emerald-50 rounded-lg transition-all group hover:scale-110"
          title="OHIF + Reporting"
        >
          <Monitor className="w-4 h-4 text-emerald-600 group-hover:text-emerald-700" />
        </button>

        <button
          onClick={() => onViewReport?.(study)}
          className="p-2 hover:bg-purple-50 rounded-lg transition-all group hover:scale-110"
          title="View Report"
        >
          <FileText className="w-4 h-4 text-purple-600 group-hover:text-purple-700" />
        </button>
      </>
    )}

    {/* VERIFIER ACTIONS */}
    {userAccountRoles.includes('verifier') && !userAccountRoles.includes('admin') && !userAccountRoles.includes('assignor') && (
      <>
        <button 
          className="p-2 hover:bg-blue-50 rounded-lg transition-all group hover:scale-110" 
          title="View Report"
          onClick={() => onViewReport?.(study)}
        >
          <FileText className="w-4 h-4 text-blue-600 group-hover:text-blue-700" />
        </button>

        <button 
          className="p-2 hover:bg-purple-50 rounded-lg transition-all group hover:scale-110" 
          title="DICOM Viewer"
          onClick={() => {
            const ohifUrl = `/ohif/viewer?StudyInstanceUIDs=${study.studyInstanceUID || study._id}`;
            window.open(ohifUrl, '_blank');
          }}
        >
          <Eye className="w-4 h-4 text-purple-600 group-hover:text-purple-700" />
        </button>

        <button 
          className="px-2.5 py-1.5 text-xs font-semibold bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors shadow-sm" 
          title="Open OHIF + Reporting for Verification"
          onClick={handleOHIFReporting}
        >
          Verify
        </button>
      </>
    )}

    {/* ✅ LAB STAFF ACTIONS - Download Report & Download Study */}
    {userAccountRoles.includes('lab_staff') && !userAccountRoles.includes('admin') && !userAccountRoles.includes('assignor') && (
      <>
        {/* Download Study Button */}
        <button
          ref={downloadButtonRef}
          onClick={handleDownloadClick}
          className="p-2 hover:bg-blue-50 rounded-lg transition-all group hover:scale-110"
          title="Download Study"
        >
          <Download className="w-4 h-4 text-blue-600 group-hover:text-blue-700" />
        </button>

        {/* View/Download Report Button */}
        <button
          onClick={() => onViewReport?.(study)}
          className="p-2 hover:bg-purple-50 rounded-lg transition-all group hover:scale-110"
          title="View/Download Report"
        >
          <FileText className="w-4 h-4 text-purple-600 group-hover:text-purple-700" />
        </button>

        {/* DICOM Viewer Button (View Only) */}
        <button
          onClick={() => {
            const ohifUrl = `/ohif/viewer?StudyInstanceUIDs=${study.studyInstanceUID || study._id}`;
            window.open(ohifUrl, '_blank');
          }}
          className="p-2 hover:bg-indigo-50 rounded-lg transition-all group hover:scale-110"
          title="View DICOM Images"
        >
          <Eye className="w-4 h-4 text-indigo-600 group-hover:text-indigo-700" />
        </button>
      </>
    )}    
  </div>
</td>

      {showDownloadOptions && (
        <DownloadOptions
          study={study}
          isOpen={showDownloadOptions}
          onClose={() => setShowDownloadOptions(false)}
          position={downloadPosition}
        />
      )}

      {showAssignmentModal && (
        <AssignmentModal
          study={study}
          availableAssignees={availableAssignees}
          onSubmit={handleAssignmentSubmit}
          onClose={handleCloseAssignmentModal}
          position={assignmentModalPosition}
          searchTerm={assignInputValue}
        />
      )}
    </tr>
  );
};

const TableFooter = ({ pagination, onPageChange, onRecordsPerPageChange, displayedRecords, loading }) => {
  const { currentPage, totalPages, totalRecords, recordsPerPage, hasNextPage, hasPrevPage } = pagination;
  const recordsPerPageOptions = [10, 25, 50, 100];

  const startRecord = totalRecords === 0 ? 0 : ((currentPage - 1) * recordsPerPage) + 1;
  const endRecord = Math.min(currentPage * recordsPerPage, totalRecords);

  return (
    <div className="sticky bottom-0 bg-white border-t border-slate-200 px-3 py-1.5">
      <div className="flex items-center justify-between gap-3">
        
        {/* LEFT: Compact records info */}
        <div className="flex items-center gap-2 text-[10px] text-slate-600">
          <span>
            <span className="font-semibold text-slate-800">{startRecord}-{endRecord}</span>
            <span className="text-slate-500 mx-1">/</span>
            <span className="font-semibold text-teal-600">{totalRecords.toLocaleString()}</span>
          </span>
          
          <div className="h-3 w-px bg-slate-300" />
          
          {/* Compact records per page */}
          <select
            id="recordsPerPage"
            value={recordsPerPage}
            onChange={(e) => onRecordsPerPageChange(Number(e.target.value))}
            className="px-1.5 py-0.5 text-[10px] font-medium bg-slate-50 border border-slate-200 rounded hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
          >
            {recordsPerPageOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>

        {/* CENTER: Compact page navigation */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={!hasPrevPage}
            className={`p-1 rounded transition-all ${
              hasPrevPage ? 'bg-gray-800 hover:bg-black text-white' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
            title="Previous"
          >
            <ChevronLeft className="w-3 h-3" />
          </button>

          <div className="flex items-center gap-1 text-[10px] text-slate-600">
            <span>Page</span>
            <input
              type="number"
              min="1"
              max={totalPages}
              value={currentPage}
              onChange={(e) => {
                const page = parseInt(e.target.value);
                if (page >= 1 && page <= totalPages) onPageChange(page);
              }}
              className="w-10 px-1 py-0.5 text-center text-[10px] border border-slate-200 rounded bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
            <span>of {totalPages}</span>
          </div>

          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={!hasNextPage}
            className={`p-1 rounded transition-all ${
              hasNextPage ? 'bg-gray-800 hover:bg-black text-white' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
            title="Next"
          >
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        {/* RIGHT: Contact info + loading */}
        <div className="flex items-center gap-2">
          {loading && (
            <div className="w-2.5 h-2.5 border border-teal-600 border-t-transparent rounded-full animate-spin" />
          )}
          
          <div className="text-[10px] text-slate-500">
            For any query call: <span className="font-semibold text-teal-600">98XXXX</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ✅ MAIN WORKLIST TABLE - ALL COLUMNS, NO RESTRICTIONS, RESIZABLE
const WorklistTable = ({ 
  studies = [], 
  loading = false, 
  selectedStudies = [],
  onSelectAll, 
  onSelectStudy,
  onPatienIdClick,
  onAssignDoctor,
  availableAssignees = { radiologists: [], verifiers: [] },
  onAssignmentSubmit,
  onUpdateStudyDetails,
  userRole = 'viewer',
  userRoles = [],
  onToggleStudyLock,
  pagination = {
    currentPage: 1,
    totalPages: 1,
    totalRecords: 0,
    recordsPerPage: 50,
    hasNextPage: false,
    hasPrevPage: false
  },
  onPageChange,
  onRecordsPerPageChange,
  headerColor
}) => {
  const userAccountRoles = userRoles.length > 0 ? userRoles : [userRole];

  // ✅ ADD COLUMN RESIZING HOOK
  const { columnWidths, getColumnWidth, handleColumnResize, resetColumnWidths } = useColumnResizing(
    `admin-worklist-widths`,
    []
  );

  const [activeViweres, setActiveViewers] = useState({});
  const { sendMessage, lastMessage, readyState } = useWebSocket();


  const [detailedView, setDetailedView] = useState({ show: false, studyId: null });
  const [reportModal, setReportModal] = useState({ show: false, studyId: null, studyData: null });
  const [studyNotes, setStudyNotes] = useState({ show: false, studyId: null });
  const [patientEditModal, setPatientEditModal] = useState({ show: false, study: null });
  const [timelineModal, setTimelineModal] = useState({ show: false, studyId: null, studyData: null });
  const [documentsModal, setDocumentsModal] = useState({ show: false, studyId: null });

  const [revertModal, setRevertModal] = useState({ show: false, study: null });
  const[printModal, setPrintModal] = useState({ show: false, report: false });


  useEffect(() => {
    if (readyState === WebSocket.OPEN) {
      // Subscribe to viewer updates
      sendMessage({
        type: 'subscribe_to_viewer_updates'
      });

      // Request current active viewers
      sendMessage({
        type: 'request_active_viewers'
      });
    }
  }, [readyState, sendMessage]);

  useEffect(() => {
    if (!lastMessage) return;

    const message = JSON.parse(lastMessage.data);

    switch (message.type) {
      case 'study_viewer_opened':
        setActiveViewers(prev => {
          const studyId = message.data.studyId;
          const viewers = prev[studyId] || [];
          if (!viewers.find(v => v.userId === message.data.userId)) {
            return {
              ...prev,
              [studyId]: [...viewers, {
                userId: message.data.userId,
                userName: message.data.userName,
                mode: message.data.mode
              }]
            };
          }
          return prev;
        });
        break;

      case 'study_viewer_closed':
        setActiveViewers(prev => {
          const studyId = message.data.studyId;
          const viewers = (prev[studyId] || []).filter(v => v.userId !== message.data.userId);
          if (viewers.length === 0) {
            const { [studyId]: removed, ...rest } = prev;
            return rest;
          }
          return { ...prev, [studyId]: viewers };
        });
        break;

      case 'active_viewers_list':
        setActiveViewers(message.data);
        break;
    }
  }, [lastMessage]);


  const handleShowTimeline = useCallback((study) => {
    setTimelineModal({ show: true, studyId: study._id, studyData: study });
  }, []);

  const handleShowDetailedView = useCallback((studyId) => {
    setDetailedView({ show: true, studyId });
  }, []);

  const handleViewReport = useCallback((study) => {
    setReportModal({
      show: true,
      studyId: study._id,
      studyData: { patientName: study.patientName, patientId: study.patientId }
    });
  }, []);

  const handleShowStudyNotes = useCallback((studyId) => {
    setStudyNotes({ show: true, studyId });
  }, []);

  const handleViewStudy = useCallback((study) => {
    handleShowDetailedView(study._id);
  }, [handleShowDetailedView]);

  const handleShowRevertModal = useCallback((study) => {
  setRevertModal({ show: true, study });
}, []);

const handleRevertSuccess = useCallback(() => {
  setRevertModal({ show: false, study: null });
  // Optionally refresh the study list
  window.location.reload();
}, []);

const handleDirectPrint = useCallback(async (study) => {
    try {
        console.log('🖨️ [Direct Print] Fetching report for study:', study._id);
        
        // ✅ VALIDATE WORKFLOW STATUS FIRST
        const allowedStatuses = ['report_reprint_needed', 'report_completed', 'reprint_requested'];
        if (!allowedStatuses.includes(study.workflowStatus)) {
            toast.error(`Cannot print report in "${study.workflowStatus}" status. Only completed or reprint-requested reports can be printed.`);
            console.log('❌ [Direct Print] Invalid status:', study.workflowStatus);
            return;
        }
        
        // Fetch the latest report for this study
        const response = await api.get(`/reports/studies/${study._id}`);
        
        if (!response.data.success || !response.data.data.reports || response.data.data.reports.length === 0) {
            toast.error('No report found for this study');
            return;
        }
        
        // Get the latest finalized report
        const reports = response.data.data.reports;
        const latestReport = reports.find(r => r.reportStatus === 'finalized') || reports[0];
        
        if (!latestReport) {
            toast.error('No finalized report available');
            return;
        }
        
        console.log('✅ [Direct Print] Opening print modal for report:', latestReport._id);
        
        // Open print modal directly
        setPrintModal({
            show: true,
            report: latestReport
        });
        
    } catch (error) {
        console.error('❌ [Direct Print] Error:', error);
        toast.error('Failed to load report for printing');
    }
}, []); 

const handleClosePrintModal = useCallback(() => {
  setPrintModal({ show: false, report: false });

},[]);


  const handleEditPatient = useCallback((study) => {
    setPatientEditModal({ show: true, study });
  }, []);

  const handleSavePatientEdit = useCallback(async (formData) => {
    await onUpdateStudyDetails?.(formData);
    setPatientEditModal({ show: false, study: null });
  }, [onUpdateStudyDetails]);

  const handleShowDocuments = useCallback((studyId) => {
    setDocumentsModal({ show: true, studyId });
  }, []);

  const handleToggleStudyLock = useCallback(async (studyId, shouldLock) => {
    try {
      const response = await api.post(`/admin/toggle-study-lock/${studyId}`, { shouldLock });
      if (response.data.success) {
        onToggleStudyLock?.(studyId, shouldLock);
      } else {
        throw new Error(response.data.message || 'Failed to toggle lock');
      }
    } catch (error) {
      throw error;
    }
  }, [onToggleStudyLock]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-900 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600 text-sm">Loading studies...</p>
        </div>
      </div>
    );
  }

  if (studies.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-gray-500">
          <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="text-lg font-medium mb-2">No studies found</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-white rounded-xl shadow-lg border-2 border-gray-300">
      <div className="flex-1 overflow-x-auto overflow-y-auto">
        <table 
          className="border-collapse" 
          style={{ 
            fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
            tableLayout: 'fixed',
            width: '100%',
            minWidth: 'max-content'
          }}
        >
          {/* ✅ DYNAMIC COLORED HEADER WITH RESIZABLE COLUMNS - ALL COLUMNS */}
          <thead className="sticky top-0 z-10">
            <tr className={`text-xs font-bold bg-gradient-to-r ${headerColor?.gradient || 'from-gray-800 via-gray-900 to-black'} ${headerColor?.textColor || 'text-white'} shadow-lg`}>
              {/* 1. SELECTION */}
              <ResizableTableHeader
                columnId="selection"
                label=""
                width={getColumnWidth('selection')}
                onResize={handleColumnResize}
                minWidth={UNIFIED_WORKLIST_COLUMNS.SELECTION.minWidth}
                maxWidth={UNIFIED_WORKLIST_COLUMNS.SELECTION.maxWidth}
              >
                <input
                  type="checkbox"
                  checked={studies.length > 0 && selectedStudies.length === studies.length}
                  onChange={(e) => onSelectAll?.(e.target.checked)}
                  className="w-4 h-4 rounded border-white/30"
                />
              </ResizableTableHeader>
              
              {/* 2. BHARAT PACS ID */}
              <ResizableTableHeader
                columnId="bharatPacsId"
                label={<>BHARAT<br/>PACS ID</>}
                width={getColumnWidth('bharatPacsId')}
                onResize={handleColumnResize}
                minWidth={UNIFIED_WORKLIST_COLUMNS.BHARAT_PACS_ID.minWidth}
                maxWidth={UNIFIED_WORKLIST_COLUMNS.BHARAT_PACS_ID.maxWidth}
              />
              
              {/* 3. ORGANIZATION - Only for super_admin */}
              {(userRoles.includes('super_admin') || userRole === 'super_admin') && (
                <ResizableTableHeader
                  columnId="organization"
                  label="ORGANIZATION"
                  width={getColumnWidth('organization')}
                  onResize={handleColumnResize}
                  minWidth={UNIFIED_WORKLIST_COLUMNS.ORGANIZATION.minWidth}
                  maxWidth={UNIFIED_WORKLIST_COLUMNS.ORGANIZATION.maxWidth}
                />
              )}
              
              {/* 4. CENTER NAME */}
              <ResizableTableHeader
                columnId="centerName"
                label={<>CENTER<br/>NAME</>}
                width={getColumnWidth('centerName')}
                onResize={handleColumnResize}
                minWidth={UNIFIED_WORKLIST_COLUMNS.CENTER_NAME.minWidth}
                maxWidth={UNIFIED_WORKLIST_COLUMNS.CENTER_NAME.maxWidth}
              />

              <ResizableTableHeader
                columnId="centerName"
                label={<>Location<br/>NAME</>}
                width={getColumnWidth('centerName')}
                onResize={handleColumnResize}
                minWidth={UNIFIED_WORKLIST_COLUMNS.CENTER_NAME.minWidth}
                maxWidth={UNIFIED_WORKLIST_COLUMNS.CENTER_NAME.maxWidth}
              />

              {/* 5. TIMELINE */}
              <ResizableTableHeader
                columnId="timeline"
                label=""
                width={getColumnWidth('timeline')}
                onResize={handleColumnResize}
                minWidth={UNIFIED_WORKLIST_COLUMNS.TIMELINE.minWidth}
                maxWidth={UNIFIED_WORKLIST_COLUMNS.TIMELINE.maxWidth}
              >
                <Clock className="w-4 h-4 mx-auto" />
              </ResizableTableHeader>

              {/* 6. PATIENT NAME / UHID */}
              <ResizableTableHeader
                columnId="patientName"
                label={<>PT NAME /<br/>UHID</>}
                width={getColumnWidth('patientName')}
                onResize={handleColumnResize}
                minWidth={UNIFIED_WORKLIST_COLUMNS.PATIENT_NAME.minWidth}
                maxWidth={UNIFIED_WORKLIST_COLUMNS.PATIENT_NAME.maxWidth}
              />

              {/* 7. AGE/SEX */}
              <ResizableTableHeader
                columnId="ageGender"
                label={<>AGE/<br/>SEX</>}
                width={getColumnWidth('ageGender')}
                onResize={handleColumnResize}
                minWidth={UNIFIED_WORKLIST_COLUMNS.AGE_GENDER.minWidth}
                maxWidth={UNIFIED_WORKLIST_COLUMNS.AGE_GENDER.maxWidth}
              />

              {/* 8. MODALITY */}
              <ResizableTableHeader
                columnId="modality"
                label="MODALITY"
                width={getColumnWidth('modality')}
                onResize={handleColumnResize}
                minWidth={UNIFIED_WORKLIST_COLUMNS.MODALITY.minWidth}
                maxWidth={UNIFIED_WORKLIST_COLUMNS.MODALITY.maxWidth}
              />

              {/* 9. VIEW */}
              <ResizableTableHeader
                columnId="viewOnly"
                label=""
                width={getColumnWidth('viewOnly')}
                onResize={handleColumnResize}
                minWidth={UNIFIED_WORKLIST_COLUMNS.VIEW_ONLY.minWidth}
                maxWidth={UNIFIED_WORKLIST_COLUMNS.VIEW_ONLY.maxWidth}
              >
                <Eye className="w-4 h-4 mx-auto" />
              </ResizableTableHeader>

              <ResizableTableHeader
                columnId="Reporting"
                label=""
                width={getColumnWidth('viewOnly')}
                onResize={handleColumnResize}
                minWidth={UNIFIED_WORKLIST_COLUMNS.VIEW_ONLY.minWidth}
                maxWidth={UNIFIED_WORKLIST_COLUMNS.VIEW_ONLY.maxWidth}
              >
                <div className="flex items-center justify-center h-full w-full">
                  <Monitor className="w-4 h-4 text-emerald-600 group-hover:text-emerald-700" />
                </div>
              </ResizableTableHeader>


              {/* 10. SERIES/IMAGES */}
              <ResizableTableHeader
                columnId="studySeriesImages"
                label={<>SERIES/<br/>IMAGES</>}
                width={getColumnWidth('studySeriesImages')}
                onResize={handleColumnResize}
                minWidth={UNIFIED_WORKLIST_COLUMNS.STUDY_SERIES_IMAGES.minWidth}
                maxWidth={UNIFIED_WORKLIST_COLUMNS.STUDY_SERIES_IMAGES.maxWidth}
              />

              {/* 11. PT ID */}
              <ResizableTableHeader
                columnId="patientId"
                label="PT ID"
                width={getColumnWidth('patientId')}
                onResize={handleColumnResize}
                minWidth={UNIFIED_WORKLIST_COLUMNS.PATIENT_ID.minWidth}
                maxWidth={UNIFIED_WORKLIST_COLUMNS.PATIENT_ID.maxWidth}
              />

              {/* 12. REFERRAL DOCTOR */}
              <ResizableTableHeader
                columnId="referralDoctor"
                label={<>REFERRAL<br/>DOCTOR</>}
                width={getColumnWidth('referralDoctor')}
                onResize={handleColumnResize}
                minWidth={UNIFIED_WORKLIST_COLUMNS.REFERRAL_DOCTOR.minWidth}
                maxWidth={UNIFIED_WORKLIST_COLUMNS.REFERRAL_DOCTOR.maxWidth}
              />

              {/* 13. CLINICAL HISTORY */}
              <ResizableTableHeader
                columnId="clinicalHistory"
                label={<>CLINICAL<br/>HISTORY</>}
                width={getColumnWidth('clinicalHistory')}
                onResize={handleColumnResize}
                minWidth={UNIFIED_WORKLIST_COLUMNS.CLINICAL_HISTORY.minWidth}
                maxWidth={UNIFIED_WORKLIST_COLUMNS.CLINICAL_HISTORY.maxWidth}
              />

              {/* 14. STUDY DATE/TIME */}
              <ResizableTableHeader
                columnId="studyDateTime"
                label={<>STUDY<br/>DATE/TIME</>}
                width={getColumnWidth('studyDateTime')}
                onResize={handleColumnResize}
                minWidth={UNIFIED_WORKLIST_COLUMNS.STUDY_DATE_TIME.minWidth}
                maxWidth={UNIFIED_WORKLIST_COLUMNS.STUDY_DATE_TIME.maxWidth}
              />

              {/* 15. UPLOAD DATE/TIME */}
              <ResizableTableHeader
                columnId="uploadDateTime"
                label={<>UPLOAD<br/>DATE/TIME</>}
                width={getColumnWidth('uploadDateTime')}
                onResize={handleColumnResize}
                minWidth={UNIFIED_WORKLIST_COLUMNS.UPLOAD_DATE_TIME.minWidth}
                maxWidth={UNIFIED_WORKLIST_COLUMNS.UPLOAD_DATE_TIME.maxWidth}
              />

              {/* 16. RADIOLOGIST */}
              <ResizableTableHeader
                columnId="assignedRadiologist"
                label="RADIOLOGIST"
                width={getColumnWidth('assignedRadiologist')}
                onResize={handleColumnResize}
                minWidth={UNIFIED_WORKLIST_COLUMNS.ASSIGNED_RADIOLOGIST.minWidth}
                maxWidth={UNIFIED_WORKLIST_COLUMNS.ASSIGNED_RADIOLOGIST.maxWidth}
              />

              {/* 17. LOCK/UNLOCK */}
              <ResizableTableHeader
                columnId="studyLock"
                label={<>LOCK/<br/>UNLOCK</>}
                width={getColumnWidth('studyLock')}
                onResize={handleColumnResize}
                minWidth={UNIFIED_WORKLIST_COLUMNS.STUDY_LOCK.minWidth}
                maxWidth={UNIFIED_WORKLIST_COLUMNS.STUDY_LOCK.maxWidth}
              />

              {/* 18. STATUS */}
              <ResizableTableHeader
                columnId="status"
                label="STATUS"
                width={getColumnWidth('status')}
                onResize={handleColumnResize}
                minWidth={UNIFIED_WORKLIST_COLUMNS.STATUS.minWidth}
                maxWidth={UNIFIED_WORKLIST_COLUMNS.STATUS.maxWidth}
              />

              {/* 19. PRINT REPORT */}
              <ResizableTableHeader
                columnId="printCount"
                label={<>PRINT<br/>REPORT</>}
                width={getColumnWidth('printCount')}
                onResize={handleColumnResize}
                minWidth={UNIFIED_WORKLIST_COLUMNS.PRINT_COUNT.minWidth}
                maxWidth={UNIFIED_WORKLIST_COLUMNS.PRINT_COUNT.maxWidth}
              />

               <ResizableTableHeader
              columnId="rejectionReason"
              label="Rejection Reason"
              width={getColumnWidth('rejectionReason')}
              minWidth={UNIFIED_WORKLIST_COLUMNS.REJECTION_REASON.minWidth}
              maxWidth={UNIFIED_WORKLIST_COLUMNS.REJECTION_REASON.maxWidth}
              onResize={handleColumnResize}
            />

              {/* 20. VERIFIED BY */}
              <ResizableTableHeader
                columnId="assignedVerifier"
                label={<>VERIFIED<br/>BY</>}
                width={getColumnWidth('assignedVerifier')}
                onResize={handleColumnResize}
                minWidth={UNIFIED_WORKLIST_COLUMNS.ASSIGNED_VERIFIER.minWidth}
                maxWidth={UNIFIED_WORKLIST_COLUMNS.ASSIGNED_VERIFIER.maxWidth}
              />

              {/* 21. VERIFIED DATE/TIME */}
              <ResizableTableHeader
                columnId="verifiedDateTime"
                label={<>VERIFIED<br/>DATE/TIME</>}
                width={getColumnWidth('verifiedDateTime')}
                onResize={handleColumnResize}
                minWidth={UNIFIED_WORKLIST_COLUMNS.VERIFIED_DATE_TIME.minWidth}
                maxWidth={UNIFIED_WORKLIST_COLUMNS.VERIFIED_DATE_TIME.maxWidth}
              />

              {/* 22. ACTIONS */}
              <ResizableTableHeader
                columnId="actions"
                label="ACTIONS"
                width={getColumnWidth('actions')}
                onResize={handleColumnResize}
                minWidth={UNIFIED_WORKLIST_COLUMNS.ACTIONS.minWidth}
                maxWidth={UNIFIED_WORKLIST_COLUMNS.ACTIONS.maxWidth}
              />
            </tr>
          </thead>
<tbody>
  {sortStudiesByPriority(studies).map((study, index) => (
    <StudyRow
      key={study._id}
      study={study}
      activeViewers={activeViweres[study._id] || []}
      index={index}
      selectedStudies={selectedStudies}
      availableAssignees={availableAssignees}
      onSelectStudy={onSelectStudy}
      onPatienIdClick={onPatienIdClick}
      onAssignDoctor={onAssignDoctor}
      onShowDetailedView={handleShowDetailedView}
      onViewReport={handleViewReport}
      onShowStudyNotes={handleShowStudyNotes}
      onViewStudy={handleViewStudy}
      onEditPatient={handleEditPatient}
      onAssignmentSubmit={onAssignmentSubmit}
      onShowTimeline={handleShowTimeline}
      onToggleLock={handleToggleStudyLock}
      onShowDocuments={handleShowDocuments}
      onShowRevertModal={handleShowRevertModal}
      setPrintModal={setPrintModal}
      userRole={userRole}
      userRoles={userAccountRoles}
      getColumnWidth={getColumnWidth}
    />
  ))}
</tbody>
        </table>
      </div>

      {studies.length > 0 && (
        <TableFooter
          pagination={pagination}
          onPageChange={onPageChange}
          onRecordsPerPageChange={onRecordsPerPageChange}
          displayedRecords={studies.length}
          loading={loading}
        />
      )}

      {/* MODALS */}
      {detailedView.show && <StudyDetailedView studyId={detailedView.studyId} onClose={() => setDetailedView({ show: false, studyId: null })} />}


      {reportModal.show && <ReportModal isOpen={reportModal.show} studyId={reportModal.studyId} studyData={reportModal.studyData} onShowPrintModal={handleDirectPrint} onClose={() => setReportModal({ show: false, studyId: null, studyData: null })} />}


      {studyNotes.show && <StudyNotesComponent studyId={studyNotes.studyId} isOpen={studyNotes.show} onClose={() => setStudyNotes({ show: false, studyId: null })} />}
      {patientEditModal.show && <PatientEditModal study={patientEditModal.study} isOpen={patientEditModal.show} onClose={() => setPatientEditModal({ show: false, study: null })} onSave={handleSavePatientEdit} />}
      {timelineModal.show && <TimelineModal isOpen={timelineModal.show} onClose={() => setTimelineModal({ show: false, studyId: null, studyData: null })} studyId={timelineModal.studyId} studyData={timelineModal.studyData} />}
      {documentsModal.show && (
        <StudyDocumentsManager
          studyId={documentsModal.studyId}
          isOpen={documentsModal.show}
          onClose={() => setDocumentsModal({ show: false, studyId: null })}
        />
      )}
      {/* ✅ ADD REVERT MODAL */}
{revertModal.show && (
  <RevertModal
    isOpen={revertModal.show}
    study={revertModal.study}
    onClose={() => setRevertModal({ show: false, study: null })}
    onSuccess={handleRevertSuccess}
  />
)}

{printModal.show && (
  <PrintModal
    report={printModal.report}
    onClose={handleClosePrintModal}
  />
)}
    </div>
  );
};

export default WorklistTable;