import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { Copy, UserPlus, Lock, Unlock, Edit, Clock, Download, Paperclip, MessageSquare, FileText, Monitor, Eye, ChevronLeft, ChevronRight, CheckCircle, XCircle } from 'lucide-react';
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

const formatTime = (dateString) => {
  if (!dateString) return '';
  try {
    return new Date(dateString).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false
    });
  } catch {
    return '';
  }
};

const copyToClipboard = (text, label = 'ID') => {
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

// ✅ PATIENT EDIT MODAL
const PatientEditModal = ({ study, isOpen, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    patientName: '',
    patientAge: '',
    patientGender: '',
    studyName: '',
    referringPhysician: '',
    accessionNumber: '',
    clinicalHistory: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (study && isOpen) {
      setFormData({
        patientName: study.patientName || '',
        patientAge: study.patientAge || '',
        patientGender: study.patientSex || '',
        studyName: study.studyDescription || '',
        referringPhysician: study.referralNumber || '',
        accessionNumber: study.accessionNumber || '',
        clinicalHistory: study.clinicalHistory || ''
      });
    }
  }, [study, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await onSave({ studyId: study._id, ...formData });
      toast.success('Study details updated');
      onClose();
    } catch (error) {
      toast.error('Failed to update');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden border-2 border-gray-900">
        <div className="px-6 py-4 border-b-2 bg-gray-900 text-white">
          <h2 className="text-lg font-bold">{study?.patientName || 'Edit Study'}</h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Patient Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.patientName}
                onChange={(e) => setFormData(prev => ({ ...prev, patientName: e.target.value }))}
                className="w-full px-3 py-2 text-sm border-2 border-gray-300 rounded focus:ring-2 focus:ring-gray-900 focus:border-gray-900"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Patient Age <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.patientAge}
                onChange={(e) => setFormData(prev => ({ ...prev, patientAge: e.target.value }))}
                className="w-full px-3 py-2 text-sm border-2 border-gray-300 rounded focus:ring-2 focus:ring-gray-900 focus:border-gray-900"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Gender <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.patientGender}
                onChange={(e) => setFormData(prev => ({ ...prev, patientGender: e.target.value }))}
                className="w-full px-3 py-2 text-sm border-2 border-gray-300 rounded focus:ring-2 focus:ring-gray-900 focus:border-gray-900"
                required
              >
                <option value="">Select</option>
                <option value="M">Male</option>
                <option value="F">Female</option>
                <option value="O">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Study Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.studyName}
                onChange={(e) => setFormData(prev => ({ ...prev, studyName: e.target.value }))}
                className="w-full px-3 py-2 text-sm border-2 border-gray-300 rounded focus:ring-2 focus:ring-gray-900 focus:border-gray-900"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Referring Physician <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.referringPhysician}
                onChange={(e) => setFormData(prev => ({ ...prev, referringPhysician: e.target.value }))}
                className="w-full px-3 py-2 text-sm border-2 border-gray-300 rounded focus:ring-2 focus:ring-gray-900 focus:border-gray-900"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Accession Number
              </label>
              <input
                type="text"
                value={formData.accessionNumber}
                onChange={(e) => setFormData(prev => ({ ...prev, accessionNumber: e.target.value }))}
                className="w-full px-3 py-2 text-sm border-2 border-gray-300 rounded focus:ring-2 focus:ring-gray-900 focus:border-gray-900"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Clinical History <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.clinicalHistory}
                onChange={(e) => setFormData(prev => ({ ...prev, clinicalHistory: e.target.value }))}
                rows={4}
                className="w-full px-3 py-2 text-sm border-2 border-gray-300 rounded focus:ring-2 focus:ring-gray-900 focus:border-gray-900"
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t-2 border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 border-2 border-gray-400"
              disabled={loading}
            >
              Close
            </button>
            <button
              type="submit"
              className="px-6 py-2 text-sm bg-gray-900 text-white rounded hover:bg-black disabled:opacity-50 border-2 border-gray-900"
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ✅ UNIFIED STUDY ROW - ALL POSSIBLE COLUMNS
const UnifiedStudyRow = ({ 
  study, 
  index,
  selectedStudies,
  availableAssignees,
  onSelectStudy,
  onPatienIdClick,
  onShowDetailedView,
  onViewReport,
  onShowStudyNotes,
  onEditPatient,
  onAssignmentSubmit,
  onShowTimeline,
  onToggleLock,
  onShowDocuments,
  userRole,
  userRoles = [],
  isColumnVisible
}) => {
  const navigate = useNavigate();
  
  const assignInputRef = useRef(null);
  const downloadButtonRef = useRef(null);
  const [assignInputValue, setAssignInputValue] = useState('');
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [assignmentModalPosition, setAssignmentModalPosition] = useState(null);
  const [inputFocused, setInputFocused] = useState(false);
  const [showDownloadOptions, setShowDownloadOptions] = useState(false);
  const [downloadPosition, setDownloadPosition] = useState(null);
  const [togglingLock, setTogglingLock] = useState(false);

  const isSelected = selectedStudies?.includes(study._id);
  const isUrgent = study.priority === 'URGENT' || study.priority === 'EMERGENCY';
  const isAssigned = study.isAssigned;
  const isLocked = study?.isLocked || false;
  const hasNotes = study.hasStudyNotes === true || (study.discussions && study.discussions.length > 0);
  const hasAttachments = study.attachments && study.attachments.length > 0;
  const canToggleLock = userRoles.includes('admin') || userRoles.includes('assignor');
  const isRejected = study.workflowStatus === 'report_rejected';
  const rejectionReason = study.reportInfo?.verificationInfo?.rejectionReason || '-';

  useEffect(() => {
    if (!inputFocused && !showAssignmentModal) {
      setAssignInputValue(isAssigned && study.radiologist ? study.radiologist : '');
    }
  }, [isAssigned, study.radiologist, inputFocused, showAssignmentModal]);

  const rowClasses = `${
    isSelected ? 'bg-gray-100 border-l-2 border-l-gray-900' : 
    isAssigned ? 'bg-gray-50' : 
    index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
  } ${isUrgent ? 'border-l-4 border-l-rose-500' : ''} ${isRejected ? 'border-l-4 border-l-rose-600' : ''} hover:bg-gray-100 transition-all duration-200 border-b border-slate-100`;

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

  const handleViewOnlyClick = (e) => {
    e.stopPropagation();
    navigate(`/doctor/viewer/${study._id}`, {
      state: { study }
    });
  };

  const handleOHIFReporting = () => {
    navigate(`/online-reporting/${study._id}?openOHIF=true`, {
      state: { 
        study: study,
        studyInstanceUID: study.studyInstanceUID || study._id
      }
    });
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
      {/* ✅ SELECTION CHECKBOX */}
      {isColumnVisible('selection') && (
        <td className="px-2 py-3 text-center">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onSelectStudy(study._id)}
            className="w-4 h-4 rounded border-slate-300 text-slate-800 focus:ring-slate-500"
          />
        </td>
      )}

      {/* ✅ BHARAT PACS ID / XCENTIC ID */}
      {isColumnVisible('bharatPacsId') && (
        <td className="px-3 py-3.5 text-center border-r border-b border-slate-200" style={{ width: '100px' }}>
          <div className="flex items-center justify-center gap-1.5">
            <span className="text-xs font-mono font-semibold text-slate-700 truncate" title={study.bharatPacsId}>
              {study.bharatPacsId !== 'N/A' ? study.bharatPacsId : study._id?.substring(0, 10)}
            </span>
            <button
              onClick={() => copyToClipboard(study.bharatPacsId !== 'N/A' ? study.bharatPacsId : study._id, 'BP ID')}
              className="p-1 hover:bg-gray-200 rounded-md transition-colors"
            >
              <Copy className="w-3.5 h-3.5 text-slate-500 hover:text-gray-900" />
            </button>
          </div>
        </td>
      )}

      {/* ✅ CENTER NAME / SUB CENTER */}
      {isColumnVisible('centerName') && (
        <td className="px-3 py-3.5 border-r border-b border-slate-200" style={{ width: '130px' }}>
          <div className="text-xs text-slate-600 truncate" title={study.centerName}>
            {study.centerName || '-'}
          </div>
        </td>
      )}

      {/* ✅ TIMELINE */}
      {isColumnVisible('timeline') && (
        <td className="px-3 py-3.5 text-center border-r border-b border-slate-200" style={{ width: '50px' }}>
          <button
            onClick={() => onShowTimeline?.(study)}
            className="p-2 hover:bg-gray-200 rounded-lg transition-all hover:scale-110"
            title="View Timeline"
          >
            <Clock className="w-4 h-4 text-gray-700" />
          </button>
        </td>
      )}

      {/* ✅ PATIENT NAME */}
      {isColumnVisible('patientName') && (
        <td className="px-3 py-3.5 border-r border-b border-slate-200" style={{ width: '160px' }}>
          <button 
            className="w-full text-left hover:underline decoration-gray-900"
            onClick={() => onPatienIdClick?.(study.patientId, study)}
          >
            <div className="text-xs font-semibold text-slate-800 truncate flex items-center gap-1" title={study.patientName}>
              {study.patientName || '-'}
              {isUrgent && <span className="text-rose-500">●</span>}
            </div>
            <div className="text-[10px] text-slate-500 truncate">
              UHID: {study.patientId || '-'}
            </div>
          </button>
        </td>
      )}

      {/* ✅ PATIENT ID (separate column) */}
      {isColumnVisible('patientId') && (
        <td className="px-3 py-3.5 border-r border-b border-slate-200" style={{ width: '120px' }}>
          <button 
            className="text-teal-600 hover:text-teal-700 font-semibold text-xs hover:underline"
            onClick={() => onPatienIdClick?.(study.patientId, study)}
          >
            {study.patientId || study.patientInfo?.patientID || 'N/A'}
            {isUrgent && (
              <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-red-600 text-white">
                🚨
              </span>
            )}
          </button>
        </td>
      )}

      {/* ✅ AGE/GENDER (combined) */}
      {isColumnVisible('ageGender') && (
        <td className="px-3 py-3.5 text-center border-r border-b border-slate-200" style={{ width: '70px' }}>
          <div className="text-xs font-medium text-slate-700">
            {study.ageGender !== 'N/A' ? study.ageGender : 
             study.patientAge && study.patientSex ? 
             `${study.patientAge}/${study.patientSex.charAt(0)}` : 
             study.patientAge && study.patientGender ?
             `${study.patientAge}/${study.patientGender.charAt(0)}` : '-'}
          </div>
        </td>
      )}

      {/* ✅ PATIENT GENDER (separate) */}
      {isColumnVisible('patientGender') && (
        <td className="px-3 py-3.5 text-center border-r border-b border-slate-200" style={{ width: '60px' }}>
          <div className="text-xs text-slate-600">
            {study.patientSex || study.patientInfo?.gender || 'N/A'}
          </div>
        </td>
      )}

      {/* ✅ MODALITY */}
      {isColumnVisible('modality') && (
        <td className="px-3 py-3.5 text-center border-r border-b border-slate-200" style={{ width: '70px' }}>
          <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold shadow-sm ${
            isUrgent ? 'bg-rose-200 text-rose-700 border border-rose-200' : 'bg-gray-200 text-gray-900 border border-gray-300'
          }`}>
            {study.modality || '-'}
          </span>
        </td>
      )}

      {/* ✅ PRIORITY */}
      {isColumnVisible('priority') && (
        <td className="px-3 py-3.5 text-center border-r border-b border-slate-200" style={{ width: '80px' }}>
          <span className={`px-2 py-1 rounded text-xs font-medium ${
            isUrgent ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
          }`}>
            {study.priority || 'NORMAL'}
          </span>
        </td>
      )}

      {/* ✅ VIEW ONLY */}
      {isColumnVisible('viewOnly') && (
        <td className="px-3 py-3.5 text-center border-r border-slate-200" style={{ width: '60px' }}>
          <button
            onClick={handleViewOnlyClick}
            className="p-2 hover:bg-gray-100 rounded-lg transition-all group hover:scale-110"
            title="View Images Only (No Locking)"
          >
            <Eye className="w-4 h-4 text-gray-700 group-hover:text-gray-900" />
          </button>
        </td>
      )}

      {/* ✅ DOWNLOAD + VIEWER */}
      {isColumnVisible('downloadViewer') && (
        <td className="px-3 py-3.5 text-center border-r border-slate-200" style={{ width: '150px' }}>
          <div className="flex items-center justify-center gap-1.5">
            <button
              ref={downloadButtonRef}
              onClick={handleDownloadClick}
              className="p-2 hover:bg-gray-100 rounded-lg transition-all group hover:scale-110"
              title="Download Options"
            >
              <Download className="w-4 h-4 text-gray-700 group-hover:text-gray-900" />
            </button>

            <button
              onClick={handleOHIFReporting}
              className="p-2 hover:bg-gray-200 rounded-lg transition-all group hover:scale-110"
              title="Report + OHIF Viewer"
            >
              <Monitor className="w-4 h-4 text-gray-700 group-hover:text-gray-900" />
            </button>
          </div>
        </td>
      )}

      {/* ✅ STUDY/SERIES/IMAGES */}
      {isColumnVisible('studySeriesImages') && (
        <td className="px-3 py-3.5 text-center border-r border-b border-slate-200" style={{ width: '90px' }}>
          <div className="text-[11px] text-slate-600 truncate">{study.studyDescription || 'N/A'}</div>
          <div className="text-xs font-medium text-slate-800">S: {study.seriesCount || 0} / {study.instanceCount || 0}</div>
        </td>
      )}

      {/* ✅ PATIENT ID / ACCESSION */}
      {isColumnVisible('patientIdAccession') && (
        <td className="px-3 py-3.5 border-r border-b border-slate-200" style={{ width: '110px' }}>
          <div className="text-[11px] text-slate-700 truncate">ID: {study.patientId || '-'}</div>
          <div className="text-[10px] text-slate-500 truncate">Acc: {study.accessionNumber || '-'}</div>
        </td>
      )}

      {/* ✅ ACCESSION NUMBER (separate) */}
      {isColumnVisible('accessionNumber') && (
        <td className="px-3 py-3.5 border-r border-b border-slate-200" style={{ width: '120px' }}>
          <div className="text-xs text-slate-600 truncate">{study.accessionNumber || '-'}</div>
        </td>
      )}

      {/* ✅ REFERRAL DOCTOR */}
      {isColumnVisible('referralDoctor') && (
        <td className="px-3 py-3.5 border-r border-b border-slate-200" style={{ width: '150px' }}>
          <div className="text-xs text-slate-700 truncate" title={study.referralNumber}>
            {study.referralNumber !== 'N/A' ? study.referralNumber : '-'}
          </div>
        </td>
      )}

      {/* ✅ REFERRING PHYSICIAN */}
      {isColumnVisible('referringPhysician') && (
        <td className="px-3 py-3.5 border-r border-b border-slate-200" style={{ width: '150px' }}>
          <div className="text-xs text-slate-700 truncate">
            {study.referringPhysician || study.referralNumber || '-'}
          </div>
        </td>
      )}

      {/* ✅ CLINICAL HISTORY */}
      {isColumnVisible('clinicalHistory') && (
        <td className="px-3 py-3.5 border-r border-b border-slate-200" style={{ width: '300px' }}>
          <div 
            className="text-xs text-slate-700 leading-relaxed" 
            style={{
              whiteSpace: 'normal',
              overflowWrap: 'break-word',
              wordBreak: 'break-word'
            }}
          >
             {study.clinicalHistory || '-'}
           </div>

           <div className="flex items-center gap-4 mt-3">
            <button
             onClick={() => onEditPatient?.(study)}
             className="flex items-center gap-1 text-[10px] text-gray-700 hover:text-gray-900 hover:underline mt-1.5 font-medium"
           >
             <Edit className="w-4 h-4" />
             Edit
           </button>

            <button
              onClick={() => onShowDocuments?.(study._id)}
              className={`p-2 rounded-lg transition-all group hover:scale-110 relative ${
                hasAttachments ? 'bg-gray-200' : 'hover:bg-slate-100'
              }`}
              title={hasAttachments ? `${study.attachments.length} attachment(s)` : 'Manage attachments'}
            >
              <Paperclip className={`w-4 h-4 ${
                hasAttachments ? 'text-gray-900' : 'text-slate-400'
              } group-hover:text-gray-900`} />
              
              {hasAttachments && study.attachments.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-gray-900 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 shadow-sm">
                  {study.attachments.length}
                </span>
              )}
            </button>

            <button
              onClick={() => onShowStudyNotes?.(study._id)}
              className={`p-2 rounded-lg transition-all group hover:scale-110 ${
                hasNotes ? 'bg-gray-200' : 'hover:bg-slate-100'
              }`}
              title={hasNotes ? `${study.discussions?.length || '1'} note(s)` : 'No notes'}
            >
              <MessageSquare className={`w-4 h-4 ${
                hasNotes ? 'text-gray-900' : 'text-slate-400'
              } group-hover:text-gray-900`} />
            </button>
           </div>
         </td>
      )}

      {/* ✅ STUDY DATE */}
      {isColumnVisible('studyDate') && (
        <td className="px-3 py-3.5 text-center border-r border-b border-slate-200" style={{ width: '100px' }}>
          <div className="text-xs font-medium text-slate-800">{formatDate(study.studyDate)}</div>
        </td>
      )}

      {/* ✅ STUDY TIME */}
      {isColumnVisible('studyTime') && (
        <td className="px-3 py-3.5 text-center border-r border-b border-slate-200" style={{ width: '80px' }}>
          <div className="text-xs text-slate-500">{study.studyTime || '-'}</div>
        </td>
      )}

      {/* ✅ STUDY DATE/TIME (combined) */}
      {isColumnVisible('studyDateTime') && (
        <td className="px-3 py-3.5 text-center border-r border-b border-slate-200" style={{ width: '100px' }}>
          <div className="text-[11px] font-medium text-slate-800">{formatDate(study.studyDate)}</div>
          <div className="text-[10px] text-slate-500">{study.studyTime || '-'}</div>
        </td>
      )}

      {/* ✅ UPLOAD DATE/TIME */}
      {isColumnVisible('uploadDateTime') && (
        <td className="px-3 py-3.5 text-center border-r border-b border-slate-200" style={{ width: '100px' }}>
          <div className="text-[11px] font-medium text-slate-800">{formatDate(study.createdAt)}</div>
          <div className="text-[10px] text-slate-500">{formatTime(study.createdAt)}</div>
        </td>
      )}

      {/* ✅ ASSIGNED RADIOLOGIST */}
      {isColumnVisible('assignedRadiologist') && userRoles.includes('assignor') && (
        <td className="px-3 py-3.5 border-r border-b border-slate-200" style={{ width: '190px', minWidth: '190px', maxWidth: '190px' }}>
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
        </td>
      )}

      {/* ✅ ASSIGNED RADIOLOGIST (read-only for radiologist/verifier) */}
      {isColumnVisible('assignedRadiologist') && !userRoles.includes('assignor') && (
        <td className="px-3 py-3.5 border-r border-b border-slate-200" style={{ width: '140px' }}>
          <div className="text-xs">
            {study.radiologist || study.assignedTo?.name || '-'}
          </div>
        </td>
      )}

      {/* ✅ ASSIGNED VERIFIER */}
      {isColumnVisible('assignedVerifier') && (
        <td className="px-3 py-3.5 border-r border-b border-slate-200" style={{ width: '140px' }}>
          <div className="text-xs">
            {study.verifier || study._raw?.reportInfo?.verificationInfo?.verifiedBy || '-'}
          </div>
        </td>
      )}

      {/* ✅ LAB NAME */}
      {isColumnVisible('labName') && (
        <td className="px-3 py-3.5 border-r border-b border-slate-200" style={{ width: '120px' }}>
          <div className="text-xs text-slate-600 truncate">{study.labName || study.centerName || '-'}</div>
        </td>
      )}

      {/* ✅ STATUS */}
      {isColumnVisible('status') && (
        <td className="px-3 py-3.5 text-center border-r border-slate-200" style={{ width: '140px' }}>
          <span className={`px-2.5 py-1 rounded-md text-[10px] font-medium shadow-sm ${getStatusColor(study.workflowStatus)}`}>
            {study.caseStatusCategory || formatWorkflowStatus(study.workflowStatus)}
          </span>
        </td>
      )}

      {/* ✅ REPORT STATUS */}
      {isColumnVisible('reportStatus') && (
        <td className="px-3 py-3.5 text-center border-r border-slate-200" style={{ width: '120px' }}>
          <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(study.workflowStatus)}`}>
            {formatWorkflowStatus(study.workflowStatus)}
          </span>
        </td>
      )}

      {/* ✅ TAT */}
      {isColumnVisible('tat') && (
        <td className="px-3 py-3.5 text-center border-r border-slate-200" style={{ width: '80px' }}>
          <div className="text-xs text-slate-600">{study.tat || '-'}</div>
        </td>
      )}

      {/* ✅ PRINT COUNT */}
      {isColumnVisible('printCount') && (
        <td className="px-3 py-3.5 text-center border-r border-b border-b border-slate-200" style={{ width: '90px' }}>
          <div className="text-xs text-slate-600">
            {study.printCount > 0 ? (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-200 rounded-md text-[10px] font-medium">
                <span className="w-1.5 h-1.5 bg-gray-900 rounded-full"></span>
                {study.printCount}
              </span>
            ) : (
              <span className="text-slate-400">No prints</span>
            )}
          </div>
        </td>
      )}

      {/* ✅ REJECTION REASON (for radiologist when rejected) */}
      {isColumnVisible('rejectionReason') && isRejected && (
        <td className="px-3 py-3.5 border-r border-b border-slate-200" style={{ width: '200px' }}>
          <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
            <strong>Rejected:</strong> {rejectionReason}
          </div>
        </td>
      )}

      {/* ✅ ACTIONS */}
      {isColumnVisible('actions') && (
        <td className="px-3 py-3.5 text-center border-slate-200" style={{ width: '200px' }}>
          <div className="flex items-center justify-center gap-1.5">
            <button
              ref={downloadButtonRef}
              onClick={handleDownloadClick}
              className="p-2 hover:bg-gray-100 rounded-lg transition-all group hover:scale-110"
              title="Download Options"
            >
              <Download className="w-4 h-4 text-gray-700 group-hover:text-gray-900" />
            </button>

            {canToggleLock && (
              <button
                onClick={handleLockToggle}
                disabled={togglingLock}
                className={`p-2 rounded-lg transition-all group hover:scale-110 ${
                  togglingLock ? 'opacity-50 cursor-not-allowed' : 
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
            )}

            <button
              onClick={() => onViewReport?.(study)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-all group hover:scale-110"
              title="View Report"
            >
              <FileText className="w-4 h-4 text-gray-700 group-hover:text-gray-900" />
            </button>

            {/* ✅ VERIFY BUTTON (for verifier) */}
            {userRoles.includes('verifier') && ['report_finalized', 'report_drafted'].includes(study.workflowStatus) && (
              <button 
                className="px-2.5 py-1.5 text-xs font-semibold bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors shadow-sm" 
                title="Open OHIF + Reporting for Verification"
                onClick={handleOHIFReporting}
              >
                Verify
              </button>
            )}

            {/* ✅ VERIFIED/REJECTED INDICATORS */}
            {study.workflowStatus === 'report_verified' && (
              <div className="p-1 text-green-600" title="Verified">
                <CheckCircle className="w-4 h-4 fill-current" />
              </div>
            )}

            {study.workflowStatus === 'report_rejected' && (
              <div className="p-1 text-red-600" title="Rejected">
                <XCircle className="w-4 h-4 fill-current" />
              </div>
            )}
          </div>
        </td>
      )}

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

// ✅ TABLE FOOTER
const TableFooter = ({ pagination, onPageChange, onRecordsPerPageChange, displayedRecords, loading }) => {
  const { currentPage, totalPages, totalRecords, recordsPerPage, hasNextPage, hasPrevPage } = pagination;
  const recordsPerPageOptions = [10, 25, 50, 100];

  const startRecord = totalRecords === 0 ? 0 : ((currentPage - 1) * recordsPerPage) + 1;
  const endRecord = Math.min(currentPage * recordsPerPage, totalRecords);

  return (
    <div className="sticky bottom-0 bg-gradient-to-r from-gray-50 to-gray-100 border-t-2 border-gray-300 px-4 py-3 flex items-center justify-between shadow-lg">
      <div className="flex items-center space-x-4">
        <span className="text-sm text-gray-700 font-medium">
          Showing <span className="font-bold text-gray-900">{startRecord}</span> to{' '}
          <span className="font-bold text-gray-900">{endRecord}</span> of{' '}
          <span className="font-bold text-gray-900">{totalRecords}</span> records
        </span>

        <div className="flex items-center space-x-2">
          <label htmlFor="recordsPerPage" className="text-sm text-gray-700 font-medium">
            Show:
          </label>
          <select
            id="recordsPerPage"
            value={recordsPerPage}
            onChange={(e) => onRecordsPerPageChange(Number(e.target.value))}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            {recordsPerPageOptions.map((option) => (
              <option key={option} value={option}>{option} per page</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={!hasPrevPage}
          className={`p-2 rounded-lg transition-all ${
            hasPrevPage ? 'bg-gray-800 hover:bg-black text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-700 font-medium">Page</span>
          <input
            type="number"
            min="1"
            max={totalPages}
            value={currentPage}
            onChange={(e) => {
              const page = parseInt(e.target.value);
              if (page >= 1 && page <= totalPages) onPageChange(page);
            }}
            className="w-16 px-2 py-1.5 text-center text-sm border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-500"
          />
          <span className="text-sm text-gray-700 font-medium">of {totalPages}</span>
        </div>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!hasNextPage}
          className={`p-2 rounded-lg transition-all ${
            hasNextPage ? 'bg-gray-800 hover:bg-black text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

// ✅ MAIN UNIFIED WORKLIST TABLE
const UnifiedWorklistTable = ({ 
  studies = [], 
  loading = false, 
  selectedStudies = [],
  onSelectAll, 
  onSelectStudy,
  onPatienIdClick,
  availableAssignees = { radiologists: [], verifiers: [] },
  onAssignmentSubmit,
  onUpdateStudyDetails,
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
  // ✅ NEW PROPS
  visibleColumns = [], // Array of column IDs that should be shown
  userRole = 'assignor',
  userRoles = []
}) => {

  const userAccountRoles = userRoles.length > 0 ? userRoles : [userRole];
  // ✅ COLUMN VISIBILITY CHECKER
  const isColumnVisible = useCallback((columnId) => {
    // Always show actions and selection
    if (columnId === 'actions' || columnId === 'selection') return true;
    
    // Check if column is in visibleColumns array
    return visibleColumns.includes(columnId);
  }, [visibleColumns]);

  console.log('📊 UnifiedWorklistTable:', {
    visibleColumns: visibleColumns.length,
    userRole,
    userRoles,
    studies: studies.length
  });

  // ✅ LOG FOR DEBUGGING
  useEffect(() => {
    console.log('👁️ User Visible Columns:', visibleColumns);
    console.log('👥 User Account Roles:', userRoles);
  }, [visibleColumns, userRoles]);

  const [detailedView, setDetailedView] = useState({ show: false, studyId: null });
  const [reportModal, setReportModal] = useState({ show: false, studyId: null, studyData: null });
  const [studyNotes, setStudyNotes] = useState({ show: false, studyId: null });
  const [patientEditModal, setPatientEditModal] = useState({ show: false, study: null });
  const [timelineModal, setTimelineModal] = useState({ show: false, studyId: null, studyData: null });
  const [documentsModal, setDocumentsModal] = useState({ show: false, studyId: null });


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
        <table className="min-w-full border-collapse" style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}>
          {/* ✅ UNIFIED HEADER WITH CONDITIONAL COLUMNS */}
          <thead className="sticky top-0 z-10">
            <tr className="text-white text-xs font-bold bg-gradient-to-r from-gray-800 via-gray-900 to-black shadow-lg">
              {isColumnVisible('selection') && (
                <th className="px-3 py-4 text-center border-r border-gray-700">
                  <input
                    type="checkbox"
                    checked={studies.length > 0 && selectedStudies.length === studies.length}
                    onChange={(e) => onSelectAll?.(e.target.checked)}
                    className="w-4 h-4 rounded border-white/30"
                  />
                </th>
              )}
              
              {isColumnVisible('bharatPacsId') && <th className="px-3 py-4 text-center border-r border-gray-700">Xcentic ID</th>}
              {isColumnVisible('centerName') && <th className="px-3 py-4 text-center border-r border-gray-700">SUB CENTER</th>}
              {isColumnVisible('timeline') && <th className="px-3 py-4 text-center border-r border-gray-700"><Clock className="w-4 h-4 mx-auto" /></th>}
              {isColumnVisible('patientName') && <th className="px-3 py-4 text-center border-r border-gray-700">PATIENT NAME</th>}
              {isColumnVisible('patientId') && <th className="px-3 py-4 text-center border-r border-gray-700">PATIENT ID</th>}
              {isColumnVisible('ageGender') && <th className="px-3 py-4 text-center border-r border-gray-700">AGE/SEX</th>}
              {isColumnVisible('patientAge') && <th className="px-3 py-4 text-center border-r border-gray-700">AGE/GENDER</th>}
              
              {isColumnVisible('modality') && <th className="px-3 py-4 text-center border-r border-gray-700">MODALITY</th>}
              {isColumnVisible('priority') && <th className="px-3 py-4 text-center border-r border-gray-700">PRIORITY</th>}
              {isColumnVisible('viewOnly') && <th className="px-3 py-4 text-center border-r border-gray-700"><Eye className="w-4 h-4 mx-auto" /></th>}
              {isColumnVisible('downloadViewer') && <th className="px-3 py-4 text-center border-r border-gray-700">DOWNLOAD/VIEWER</th>}
              {isColumnVisible('studySeriesImages') && <th className="px-3 py-4 text-center border-r border-gray-700">STUDY/SERIES</th>}
              {isColumnVisible('patientIdAccession') && <th className="px-3 py-4 text-center border-r border-gray-700">PT ID/ACC</th>}
              {isColumnVisible('accessionNumber') && <th className="px-3 py-4 text-center border-r border-gray-700">ACCESSION NO</th>}
              {isColumnVisible('referralDoctor') && <th className="px-3 py-4 text-center border-r border-gray-700">REFERRAL DR</th>}
              {isColumnVisible('referringPhysician') && <th className="px-3 py-4 text-center border-r border-gray-700">REFERRING PHY</th>}
              {isColumnVisible('clinicalHistory') && <th className="px-3 py-4 text-center border-r border-gray-700">CLINICAL HISTORY</th>}
              {isColumnVisible('studyDate') && <th className="px-3 py-4 text-center border-r border-gray-700">STUDY DATE</th>}
              {isColumnVisible('studyTime') && <th className="px-3 py-4 text-center border-r border-gray-700">STUDY TIME</th>}
              {isColumnVisible('studyDateTime') && <th className="px-3 py-4 text-center border-r border-gray-700">STUDY DATE/TIME</th>}
              {isColumnVisible('uploadDateTime') && <th className="px-3 py-4 text-center border-r border-gray-700">UPLOAD DATE/TIME</th>}
              {isColumnVisible('assignedRadiologist') && <th className="px-3 py-4 text-center border-r border-gray-700">RADIOLOGIST</th>}
              {isColumnVisible('assignedVerifier') && <th className="px-3 py-4 text-center border-r border-gray-700">VERIFIER</th>}
              {isColumnVisible('labName') && <th className="px-3 py-4 text-center border-r border-gray-700">LAB NAME</th>}
              {isColumnVisible('status') && <th className="px-3 py-4 text-center border-r border-gray-700">STATUS</th>}
              {isColumnVisible('reportStatus') && <th className="px-3 py-4 text-center border-r border-gray-700">REPORT STATUS</th>}
              {isColumnVisible('tat') && <th className="px-3 py-4 text-center border-r border-gray-700">TAT</th>}
              {isColumnVisible('printCount') && <th className="px-3 py-4 text-center border-r border-gray-700">PRINT COUNT</th>}
              {isColumnVisible('rejectionReason') && <th className="px-3 py-4 text-center border-r border-gray-700">REJECTION</th>}
              {isColumnVisible('actions') && <th className="px-3 py-4 text-center">ACTIONS</th>}
            </tr>
          </thead>

          <tbody>
            {studies.map((study, index) => (
              <UnifiedStudyRow
                key={study._id}
                study={study}
                index={index}
                selectedStudies={selectedStudies}
                availableAssignees={availableAssignees}
                onSelectStudy={onSelectStudy}
                onPatienIdClick={onPatienIdClick}
                onShowDetailedView={handleShowDetailedView}
                onViewReport={handleViewReport}
                onShowStudyNotes={handleShowStudyNotes}
                onEditPatient={handleEditPatient}
                onAssignmentSubmit={onAssignmentSubmit}
                onShowTimeline={handleShowTimeline}
                onToggleLock={handleToggleStudyLock}
                onShowDocuments={handleShowDocuments}
                userRole={userRole}
                userRoles={userAccountRoles}
                isColumnVisible={isColumnVisible}
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

      {detailedView.show && <StudyDetailedView studyId={detailedView.studyId} onClose={() => setDetailedView({ show: false, studyId: null })} />}
      {reportModal.show && <ReportModal isOpen={reportModal.show} studyId={reportModal.studyId} studyData={reportModal.studyData} onClose={() => setReportModal({ show: false, studyId: null, studyData: null })} />}
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
    </div>
  );
};

export default UnifiedWorklistTable;