import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { Copy, UserPlus, Lock, Unlock, Edit, Clock, Download, Paperclip, MessageSquare, FileText } from 'lucide-react';
// ✅ Import modals
import {  Monitor, Eye,  } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AssignmentModal from '../../assigner/AssignmentModal';
import StudyDetailedView from '../PatientDetailedView';
import ReportModal from '../ReportModal/ReportModal';
import StudyNotesComponent from '../StudyNotes/StudyNotesComponent';
import TimelineModal from '../TimelineModal';
import DownloadOptions from '../DownloadOptions/DownloadOptions';
import StudyDocumentsManager  from '../../StudyDocuments/StudyDocumentsManager';  // ✅ NEW IMPORT
import api from '../../../services/api'
import TableFooter from './TableFooter';

// ✅ UTILITY FUNCTIONS
const getStatusColor = (status) => {
  switch (status) {
    case 'new_study_received':
    case 'pending_assignment':
      return 'bg-amber-50 text-amber-700 border border-amber-200';
    case 'assigned_to_doctor':
    case 'doctor_opened_report':
    case 'report_in_progress':
      return 'bg-blue-50 text-blue-700 border border-blue-200';
    case 'report_drafted':
    case 'report_finalized':
    case 'final_report_downloaded':
      return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
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

// ✅ ACTION DROPDOWN COMPONENT
const ActionDropdown = ({ study, onViewReport, onShowStudyNotes, onViewStudy }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-1.5 text-xs font-medium bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-all flex items-center gap-1.5 w-full justify-center shadow-sm hover:shadow"
      >
        <span>Actions</span>
        <svg className="w-3.5 h-3.5 transition-transform" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {isOpen && (
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setIsOpen(false)}></div>
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-200 z-[9999] overflow-hidden">
            <div className="py-1">
              <button
                onClick={() => { onViewStudy?.(study); setIsOpen(false); }}
                className="flex items-center w-full px-4 py-2.5 text-sm text-slate-700 hover:bg-teal-50 hover:text-teal-700 transition-colors"
              >
                <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                View Study
              </button>
              
              <button
                onClick={() => { onViewReport?.(study); setIsOpen(false); }}
                className="flex items-center w-full px-4 py-2.5 text-sm text-slate-700 hover:bg-teal-50 hover:text-teal-700 transition-colors"
              >
                <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                View Report
              </button>
              
              <button
                onClick={() => { onShowStudyNotes?.(study._id); setIsOpen(false); }}
                className="flex items-center w-full px-4 py-2.5 text-sm text-slate-700 hover:bg-teal-50 hover:text-teal-700 transition-colors"
              >
                <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Study Notes
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
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
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        <div className="px-6 py-4 border-b bg-gray-800 text-white">
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
                className="w-full px-3 py-2 text-sm border rounded focus:ring-2 focus:ring-blue-500"
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
                className="w-full px-3 py-2 text-sm border rounded focus:ring-2 focus:ring-blue-500"
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
                className="w-full px-3 py-2 text-sm border rounded focus:ring-2 focus:ring-blue-500"
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
                className="w-full px-3 py-2 text-sm border rounded focus:ring-2 focus:ring-blue-500"
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
                className="w-full px-3 py-2 text-sm border rounded focus:ring-2 focus:ring-blue-500"
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
                className="w-full px-3 py-2 text-sm border rounded focus:ring-2 focus:ring-blue-500"
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
                className="w-full px-3 py-2 text-sm border rounded focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              disabled={loading}
            >
              Close
            </button>
            <button
              type="submit"
              className="px-6 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
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

// ✅ UPDATED STUDY ROW - Modern styling
const StudyRow = ({ 
  study, 
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
  onShowDocuments,  // ✅ NEW PROP
  userRole
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
  const canToggleLock = userRole === 'admin' || userRole === 'assignor';

  // ✅ SYNC INPUT VALUE WITH RADIOLOGIST NAME (ONLY WHEN NOT FOCUSED)
  useEffect(() => {
    if (!inputFocused && !showAssignmentModal) {
      // Only show radiologist name when input is NOT focused
      setAssignInputValue(isAssigned && study.radiologist ? study.radiologist : '');
    }
  }, [isAssigned, study.radiologist, inputFocused, showAssignmentModal]);

  const rowClasses = `${
    isSelected ? 'bg-teal-50 border-l-2 border-l-teal-500' : 
    isAssigned ? 'bg-emerald-50/30' : 
    index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
  } ${isUrgent ? 'border-l-4 border-l-rose-500' : ''} hover:bg-teal-50/50 transition-all duration-200 border-b border-slate-100`;

  // ✅ FIX: Clear input value when modal opens to show ALL radiologists
  const handleAssignInputFocus = (e) => {
    if (isLocked) {
      toast.error(`Locked by ${study.studyLock?.lockedByName}`, { icon: '🔒' });
      e.target.blur();
      return;
    }

    setInputFocused(true);
    
    // ✅ CRITICAL FIX: Clear input value to show full list
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

  // ✅ FIX: Reset input value when modal closes
  const handleCloseAssignmentModal = () => {
    setShowAssignmentModal(false);
    setInputFocused(false);
    
    // ✅ Reset to radiologist name or empty
    setAssignInputValue(isAssigned && study.radiologist ? study.radiologist : '');
  };

  const handleAssignmentSubmit = async (assignmentData) => {
    await onAssignmentSubmit(assignmentData);
    handleCloseAssignmentModal();
  };

  // ✅ Handle download button click
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
  navigate(`/doctor/viewer/${study._id}`, {  // ✅ Changed from /view-study to /doctor/viewer
    state: { study }
  });
};


  const handleOHIFReporting = () => {
    console.log('🟢 OHIF + Reporting:', study._id);
    navigate(`/online-reporting/${study._id}?openOHIF=true`, {
      state: { 
        study: study,
        studyInstanceUID: study.studyInstanceUID || study._id
      }
    });
  };

  console.log(study)

  // ✅ Handle lock toggle
 const handleLockToggle = async (e) => {
    e.stopPropagation();

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
      {/* BP ID - Updated styling */}
      <td className="px-3 py-3.5 text-center border-r border-b border-slate-200" style={{ width: '100px' }}>
        <div className="flex items-center justify-center gap-1.5">
          <span className="text-xs font-mono font-semibold text-slate-700 truncate" title={study.bharatPacsId}>
            {study.bharatPacsId !== 'N/A' ? study.bharatPacsId : study._id?.substring(0, 10)}
          </span>
          <button
            onClick={() => copyToClipboard(study.bharatPacsId !== 'N/A' ? study.bharatPacsId : study._id, 'BP ID')}
            className="p-1 hover:bg-teal-200 rounded-md transition-colors"
          >
            <Copy className="w-3.5 h-3.5 text-slate-500 hover:text-teal-600" />
          </button>
        </div>
      </td>

      {/* CENTER NAME */}
      {/* <td className="px-3 py-3.5 border-r border-b border-slate-200" style={{ width: '140px' }}>
        <div className="text-xs font-semibold text-slate-800 truncate" title={study.organizationName}>
          {study.organizationName || '-'}
        </div>
      </td> */}

      {/* SUB CENTER */}
      <td className="px-3 py-3.5 border-r border-b border-slate-200" style={{ width: '130px' }}>
        <div className="text-xs text-slate-600 truncate" title={study.centerName}>
          {study.centerName || '-'}
        </div>
      </td>

      {/* TRACK CASE */}
      <td className="px-3 py-3.5 text-center border-r border-b border-slate-200" style={{ width: '50px' }}>
        <button
          onClick={() => onShowTimeline?.(study)}
          className="p-2 hover:bg-teal-200 rounded-lg transition-all hover:scale-110"
          title="View Timeline"
        >
          <Clock className="w-4 h-4 text-teal-600" />
        </button>
      </td>

      {/* PT NAME / UHID */}
      <td className="px-3 py-3.5 border-r border-b border-slate-200" style={{ width: '160px' }}>
        <button 
          className="w-full text-left hover:underline decoration-teal-500"
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

      {/* AGE/SEX */}
      <td className="px-3 py-3.5 text-center border-r border-b border-slate-200" style={{ width: '70px' }}>
        <div className="text-xs font-medium text-slate-700">
          {study.ageGender !== 'N/A' ? study.ageGender : 
           study.patientAge && study.patientSex ? 
           `${study.patientAge}/${study.patientSex.charAt(0)}` : '-'}
        </div>
      </td>

      {/* MODALITY */}
      <td className="px-3 py-3.5 text-center border-r border-b border-slate-200" style={{ width: '70px' }}>
        <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold shadow-sm ${
          isUrgent ? 'bg-rose-200 text-rose-700 border border-rose-200' : 'bg-blue-200 text-blue-700 border border-blue-200'
        }`}>
          {study.modality || '-'}
        </span>
      </td>

      {/* EYE BUTTON - View Only */}
      <td className="px-3 py-3.5 text-center border-r border-slate-200" style={{ width: '60px' }}>
        <button
          onClick={handleViewOnlyClick}
          className="p-2 hover:bg-blue-50 rounded-lg transition-all group hover:scale-110"
          title="View Images Only (No Locking)"
        >
          <Eye className="w-4 h-4 text-blue-600 group-hover:text-blue-700" />
        </button>
      </td>

      {/* DOWNLOAD + OHIF REPORTING */}
      <td className="px-3 py-3.5 text-center border-r border-slate-200" style={{ width: '150px' }}>
        <div className="flex items-center justify-center gap-1.5">
          {/* Download button */}
          <button
            ref={downloadButtonRef}
            onClick={handleDownloadClick}
            className="p-2 hover:bg-blue-50 rounded-lg transition-all group hover:scale-110"
            title="Download Options"
          >
            <Download className="w-4 h-4 text-blue-600 group-hover:text-blue-700" />
          </button>

          {/* OHIF + Reporting button */}
          <button
            onClick={handleOHIFReporting}
            className="p-2 hover:bg-emerald-50 rounded-lg transition-all group hover:scale-110"
            title="Report + OHIF Viewer"
          >
            <Monitor className="w-4 h-4 text-emerald-600 group-hover:text-emerald-700" />
          </button>
        </div>
      </td>

      {/* STUDY / SERIES / IMAGES */}
      <td className="px-3 py-3.5 text-center border-r border-b border-slate-200" style={{ width: '90px' }}>
        <div className="text-[11px] text-slate-600 truncate">{study.studyDescription || 'N/A'}</div>
        <div className="text-xs font-medium text-slate-800">S: {study.seriesCount || 0} / {study.instanceCount || 0}</div>
      </td>

      {/* PT ID / ACC NO */}
      <td className="px-3 py-3.5 border-r border-b border-slate-200" style={{ width: '110px' }}>
        <div className="text-[11px] text-slate-700 truncate">ID: {study.patientId || '-'}</div>
        <div className="text-[10px] text-slate-500 truncate">Acc: {study.accessionNumber || '-'}</div>
      </td>

      {/* REFERRAL DOCTOR */}
      <td className="px-3 py-3.5 border-r border-b border-slate-200" style={{ width: '600px' }}>
        <div className="text-xs text-slate-700 truncate" title={study.referralNumber}>
          {study.referralNumber !== 'N/A' ? study.referralNumber : '-'}
        </div>
      </td>

      {/* CLINICAL HISTORY - reduced by 25% (1000px → 750px) */}
      <td className="px-3 py-3.5 border-r border-b border-slate-200" style={{ width: '750px' }}>
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

         <div class="flex items-center gap-4 mt-3">

          <button
           onClick={() => onEditPatient?.(study)}
           className="flex items-center gap-1 text-[10px] text-teal-600 hover:text-teal-700 hover:underline mt-1.5 font-medium"
         >
           <Edit className="w-4 h-4" />
           Edit
         </button>

          <button
  onClick={() => onShowDocuments?.(study._id)}
  className={`p-2 rounded-lg transition-all group hover:scale-110 relative ${
    hasAttachments ? 'bg-emerald-50' : 'hover:bg-slate-100'
  }`}
  title={hasAttachments ? `${study.attachments.length} attachment(s)` : 'Manage attachments'}
>
  <Paperclip className={`w-4 h-4 ${
    hasAttachments ? 'text-emerald-600' : 'text-slate-400'
  } group-hover:text-emerald-700`} />
  
  {/* Attachment Count Badge */}
  {hasAttachments && study.attachments.length > 0 && (
    <span className="absolute -top-1 -right-1 bg-emerald-600 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 shadow-sm">
      {study.attachments.length}
    </span>
  )}
</button>

          {/* Study Notes */}
          <button
            onClick={() => onShowStudyNotes?.(study._id)}
            className={`p-2 rounded-lg transition-all group hover:scale-110 ${
              hasNotes ? 'bg-emerald-50' : 'hover:bg-slate-100'
            }`}
            title={hasNotes ? `${study.discussions?.length || '1'} note(s)` : 'No notes'}
          >
            <MessageSquare className={`w-4 h-4 ${
              hasNotes ? 'text-emerald-600' : 'text-slate-400'
            } group-hover:text-emerald-700`} />
          </button>
         </div>
         
       </td>

      {/* STUDY DATE/TIME */}
      <td className="px-3 py-3.5 text-center border-r border-b border-slate-200" style={{ width: '100px' }}>
        <div className="text-[11px] font-medium text-slate-800">{formatDate(study.studyDate)}</div>
        <div className="text-[10px] text-slate-500">{study.studyTime || '-'}</div>
      </td>

      {/* UPLOAD DATE/TIME */}
      <td className="px-3 py-3.5 text-center border-r border-b border-slate-200" style={{ width: '100px' }}>
        <div className="text-[11px] font-medium text-slate-800">{formatDate(study.createdAt)}</div>
        <div className="text-[10px] text-slate-500">{formatTime(study.createdAt)}</div>
      </td>

      {/* RADIOLOGIST - increased by 25% (150px → 190px) */}
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
                }
              }, 200);
            }}
            placeholder={isLocked ? "🔒 Locked" : "Search radiologist..."}
            disabled={isLocked}
            className={`w-full px-3 py-2 text-xs border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all ${
              isLocked ? 'bg-slate-200 cursor-not-allowed text-slate-500' : 
              isAssigned && !inputFocused ? 'bg-emerald-50 border-emerald-300 text-emerald-700 font-medium shadow-sm' : 
              'bg-white border-slate-200 hover:border-slate-300'
            }`}
          />
          {isAssigned && !inputFocused && !isLocked && (
            <div className="w-2 h-2 bg-emerald-500 rounded-full absolute right-3 top-3 shadow-sm" />
          )}
          {isLocked && (
            <Lock className="w-4 h-4 text-rose-600 absolute right-3 top-2.5" />
          )}
        </div>
      </td>

      {/* CASE STATUS - increased by 25% (110px → 137.5px ≈ 140px) */}
      <td className="px-3 py-3.5 text-center border-r border-slate-200" style={{ width: '140px' }}>
        <span className={`px-2.5 py-1 rounded-md text-[10px] font-medium shadow-sm ${getStatusColor(study.workflowStatus)}`}>
          {study.caseStatusCategory || formatWorkflowStatus(study.workflowStatus)}
        </span>
      </td>

      {/* VIEW */}
      {/* <td className="px-3 py-3.5 text-center border-r border-b border-slate-200" style={{ width: '60px' }}>
        <button
          onClick={() => onViewStudy?.(study)}
          className="text-xs text-teal-600 hover:text-teal-700 font-semibold px-3 py-1.5 hover:bg-teal-50 rounded-lg transition-all"
        >
          View
        </button>
      </td> */}

      {/* PRINT REPORT */}
      <td className="px-3 py-3.5 text-center border-r border-b border-b border-slate-200" style={{ width: '90px' }}>
        <div className="text-xs text-slate-600">
          {study.printCount > 0 ? (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-200 rounded-md text-[10px] font-medium">
              <span className="w-1.5 h-1.5 bg-teal-500 rounded-full"></span>
              {study.printCount}
            </span>
          ) : (
            <span className="text-slate-400">No prints</span>
          )}
        </div>
      </td>

      {/* ACTION */}
      <td className="px-3 py-3.5 text-center border-slate-200" style={{ width: '200px' }}>
        <div className="flex items-center justify-center gap-1.5">
          {/* Download */}
          <button
            ref={downloadButtonRef}
            onClick={handleDownloadClick}
            className="p-2 hover:bg-blue-50 rounded-lg transition-all group hover:scale-110"
            title="Download Options"
          >
            <Download className="w-4 h-4 text-blue-600 group-hover:text-blue-700" />
          </button>

          {/* Lock/Unlock */}
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

          {/* Attachments */}
         

          {/* View Report */}
          <button
            onClick={() => onViewReport?.(study)}
            className="p-2 hover:bg-purple-50 rounded-lg transition-all group hover:scale-110"
            title="View Report"
          >
            <FileText className="w-4 h-4 text-purple-600 group-hover:text-purple-700" />
          </button>

          {/* Action Dropdown */}
          {/* <ActionDropdown 
            study={study}
            onViewReport={onViewReport}
            onShowStudyNotes={onShowStudyNotes}
            onViewStudy={onViewStudy}
          /> */}
        </div>
      </td>

      {/* Download Options Modal */}
      {showDownloadOptions && (
        <DownloadOptions
          study={study}
          isOpen={showDownloadOptions}
          onClose={() => setShowDownloadOptions(false)}
          position={downloadPosition}
        />
      )}

      {/* ASSIGNMENT MODAL */}
      {showAssignmentModal && (
        <AssignmentModal
          study={study}
          availableAssignees={availableAssignees}
          onSubmit={handleAssignmentSubmit}
          onClose={handleCloseAssignmentModal}
          position={assignmentModalPosition}
          searchTerm={assignInputValue} // ✅ This will be empty string on open
        />
      )}
    </tr>
  );
};

// ✅ UPDATED MAIN TABLE - with pagination footer
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
  onToggleStudyLock,
  // ✅ NEW: Pagination props
  pagination = {
    currentPage: 1,
    totalPages: 1,
    totalRecords: 0,
    recordsPerPage: 50,
    hasNextPage: false,
    hasPrevPage: false
  },
  onPageChange,
  onRecordsPerPageChange
}) => {
  
  const [assignmentModal, setAssignmentModal] = useState({ show: false, study: null });
  const [detailedView, setDetailedView] = useState({ show: false, studyId: null });
  const [reportModal, setReportModal] = useState({ show: false, studyId: null, studyData: null });
  const [studyNotes, setStudyNotes] = useState({ show: false, studyId: null });
  const [patientEditModal, setPatientEditModal] = useState({ show: false, study: null });
  const [timelineModal, setTimelineModal] = useState({ show: false, studyId: null, studyData: null });
  const [documentsModal, setDocumentsModal] = useState({ show: false, studyId: null });  // ✅ NEW STATE

  // Handlers
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

  const handleEditPatient = useCallback((study) => {
    setPatientEditModal({ show: true, study });
  }, []);

  const handleSavePatientEdit = useCallback(async (formData) => {
    await onUpdateStudyDetails?.(formData);
    setPatientEditModal({ show: false, study: null });
  }, [onUpdateStudyDetails]);

  // ✅ NEW: Handle show documents
  const handleShowDocuments = useCallback((studyId) => {
    setDocumentsModal({ show: true, studyId });
  }, []);

  // ✅ Handle study lock toggle
   const handleToggleStudyLock = useCallback(async (studyId, shouldLock) => {
    try {
      console.log("yes it is there")
      
      const response = await api.post(`/admin/toggle-study-lock/${studyId}`, {
        shouldLock
      });

      console.log(response)

      if (response.data.success) {
        // Refresh study data or update local state
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
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent mx-auto mb-4"></div>
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
    <div className="w-full h-full flex flex-col bg-white rounded-xl shadow-lg border border-slate-200">
      {/* ✅ SCROLLABLE TABLE CONTAINER */}
      <div className="flex-1 overflow-x-auto overflow-y-auto">
        <table className="min-w-full border-collapse" style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}>
          {/* ✅ MODERN HEADER - Teal gradient */}
          <thead className="sticky top-0 z-10">
            <tr className="text-white text-xs font-bold bg-gradient-to-r from-teal-600 via-teal-700 to-cyan-700 shadow-lg">
              <th className="px-3 py-4 text-center border-r border-teal-500/30" style={{ width: '100px' }}>
                <div className="flex items-center justify-center gap-1.5">
                  <span>Xcentic ID</span>
                </div>
              </th>
              {/* <th className="px-3 py-4 text-center border-r border-teal-500/30" style={{ width: '140px' }}>
                CENTER<br/>NAME
              </th> */}
              <th className="px-3 py-4 text-center border-r border-teal-500/30" style={{ width: '130px' }}>
                SUB<br/>CENTER
              </th>
              <th className="px-3 py-4 text-center border-r border-teal-500/30" style={{ width: '50px' }}>
                <Clock className="w-4 h-4 mx-auto" />
              </th>
              <th className="px-3 py-4 text-center border-r border-teal-500/30" style={{ width: '160px' }}>
                PT NAME /<br/>UHID
              </th>
              <th className="px-3 py-4 text-center border-r border-teal-500/30" style={{ width: '70px' }}>
                AGE/<br/>SEX
              </th>
              <th className="px-3 py-4 text-center border-r border-teal-500/30" style={{ width: '70px', minWidth: '110px' }}>
                MOD
              </th>
              <th className="px-3 py-4 text-center border-r border-teal-500/30" style={{ width: '60px' }}>
                <Eye className="w-4 h-4 mx-auto" />
              </th>
              <th className="px-3 py-4 text-center border-r border-teal-500/30" style={{ width: '150px' }}>
                <div className="flex items-center justify-center gap-2">
                  <Download className="w-4 h-4" />
                  <Monitor className="w-4 h-4" />
                </div>
              </th>
              <th className="px-3 py-4 text-center border-r border-teal-500/30" style={{ width: '90px' }}>
                STUDY /<br/>SERIES / IMAGES
              </th>
              <th className="px-3 py-4 text-center border-r border-teal-500/30" style={{ width: '110px' }}>
                PT ID/<br/>ACC. NO.
              </th>
              <th className="px-3 py-4 text-center border-r border-teal-500/30" style={{ width: '900px' }}>
                REFERRAL<br/>DOCTOR
              </th>
              <th className="px-3 py-4 text-center border-r border-teal-500/30" style={{ width: '1000px', minWidth: '300px' }}>
                CLINICAL<br/>HISTORY
              </th>
              <th className="px-3 py-4 text-center border-r border-teal-500/30" style={{ width: '100px' }}>
                STUDY<br/>DATE/TIME
              </th>
              <th className="px-3 py-4 text-center border-r border-teal-500/30" style={{ width: '100px' }}>
                UPLOAD<br/>DATE/TIME
              </th>
              <th className="px-3 py-4 text-center border-r border-teal-500/30" style={{ width: '190px', minWidth: '190px', maxWidth: '190px' }}>
                RADIOLOGIST
              </th>
              <th className="px-3 py-4 text-center border-r border-teal-500/30" style={{ width: '140px', minWidth: '140px', maxWidth: '140px' }}>
                STATUS
              </th>
              {/* <th className="px-3 py-4 text-center border-r border-teal-500/30" style={{ width: '60px' }}>
                VIEW
              </th> */}
              <th className="px-3 py-4 text-center border-r border-teal-500/30" style={{ width: '90px' }}>
                PRINT<br/>REPORT
              </th>
              <th className="px-3 py-4 text-center" style={{ width: '200px' }}>
                <div className="flex items-center justify-center gap-2">
                  <Download className="w-4 h-4" />
                  <Lock className="w-4 h-4" />
                  <MessageSquare className="w-4 h-4" />
                </div>
              </th>
            </tr>
          </thead>

          {/* ✅ TABLE BODY */}
          <tbody>
            {studies.map((study, index) => (
              <StudyRow
                key={study._id}
                study={study}
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
                onShowDocuments={handleShowDocuments}  // ✅ NEW PROP
                userRole={userRole}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* ✅ PAGINATION FOOTER */}
      {studies.length > 0 && (
        <TableFooter
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          totalRecords={pagination.totalRecords}
          recordsPerPage={pagination.recordsPerPage}
          onPageChange={onPageChange}
          onRecordsPerPageChange={onRecordsPerPageChange}
          displayedRecords={studies.length}
          loading={loading}
        />
      )}

      {/* ✅ MODALS */}
      {detailedView.show && <StudyDetailedView studyId={detailedView.studyId} onClose={() => setDetailedView({ show: false, studyId: null })} />}
      {reportModal.show && <ReportModal isOpen={reportModal.show} studyId={reportModal.studyId} studyData={reportModal.studyData} onClose={() => setReportModal({ show: false, studyId: null, studyData: null })} />}
      {studyNotes.show && <StudyNotesComponent studyId={studyNotes.studyId} isOpen={studyNotes.show} onClose={() => setStudyNotes({ show: false, studyId: null })} />}
      {patientEditModal.show && <PatientEditModal study={patientEditModal.study} isOpen={patientEditModal.show} onClose={() => setPatientEditModal({ show: false, study: null })} onSave={handleSavePatientEdit} />}
      {timelineModal.show && <TimelineModal isOpen={timelineModal.show} onClose={() => setTimelineModal({ show: false, studyId: null, studyData: null })} studyId={timelineModal.studyId} studyData={timelineModal.studyData} />}
      {/* ✅ NEW: Documents Modal */}
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

export default WorklistTable;