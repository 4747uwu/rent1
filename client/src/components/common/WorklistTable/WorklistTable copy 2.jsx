import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import toast from 'react-hot-toast';
import { Copy, UserPlus, Lock, Edit, Clock } from 'lucide-react'; // ✅ ADD Clock
// ✅ Import modals
import AssignmentModal from '../../assigner/AssignmentModal';
import StudyDetailedView from '../PatientDetailedView';
import ReportModal from '../ReportModal/ReportModal';
import StudyNotesComponent from '../StudyNotes/StudyNotesComponent';
import ActionTimeline from '../ActionTimeline'; // ✅ ADD THIS IMPORT
import TimelineModal from '../TimelineModal'; // ✅ ADD THIS IMPORT
// import PatientEditModal from '../PatientEditModal/PatientEditModal';

const ROW_HEIGHT = 60; // ✅ Increased for multi-line support

// ✅ UTILITY FUNCTIONS
const getStatusColor = (status) => {
  switch (status) {
    case 'new_study_received':
    case 'pending_assignment':
      return 'bg-yellow-100 text-yellow-800';
    case 'assigned_to_doctor':
    case 'doctor_opened_report':
    case 'report_in_progress':
      return 'bg-blue-100 text-blue-800';
    case 'report_drafted':
    case 'report_finalized':
    case 'final_report_downloaded':
      return 'bg-green-100 text-green-800';
    default:
      return 'bg-gray-100 text-gray-800';
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

// ✅ ACTION BUTTONS DROPDOWN
const ActionDropdown = ({ study, onViewReport, onShowStudyNotes, onViewStudy }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors flex items-center gap-1"
        title="Actions"
      >
        Actions
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)}></div>
          <div className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-20">
            <div className="py-1">
              <button
                onClick={() => { onViewStudy?.(study); setIsOpen(false); }}
                className="flex items-center w-full px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
              >
                <svg className="w-3 h-3 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                View Study
              </button>
              
              <button
                onClick={() => { onViewReport?.(study); setIsOpen(false); }}
                className="flex items-center w-full px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
              >
                <svg className="w-3 h-3 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                View Report
              </button>
              
              <button
                onClick={() => { onShowStudyNotes?.(study._id); setIsOpen(false); }}
                className="flex items-center w-full px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
              >
                <svg className="w-3 h-3 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Study Notes
              </button>

              <button
                onClick={() => { console.log('Download study:', study._id); setIsOpen(false); }}
                className="flex items-center w-full px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
              >
                <svg className="w-3 h-3 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3" />
                </svg>
                Download
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// ✅ UTILITY FUNCTIONS FOR FORMATTING
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

const formatDateTime = (dateString) => {
  if (!dateString) return '-';
  try {
    const date = formatDate(dateString);
    const time = formatTime(dateString);
    return (
      <div className="text-center">
        <div className="font-medium">{date}</div>
        <div className="text-[10px] text-gray-500">{time}</div>
      </div>
    );
  } catch {
    return '-';
  }
};

// ✅ EXCEL-LIKE CELL COMPONENT
const Cell = ({ children, className = "", style = {}, align = "left", width, borderRight = true }) => {
  const alignmentClass = align === "center" ? "justify-center text-center" : 
                        align === "right" ? "justify-end text-right" : 
                        "justify-start text-left";
  
  return (
    <div 
      className={`flex items-center px-2 py-1 ${borderRight ? 'border-r border-gray-300' : ''} ${alignmentClass} ${className}`}
      style={{ width, minWidth: width, maxWidth: width, ...style }}
    >
      <div className="w-full overflow-hidden">
        {children}
      </div>
    </div>
  );
};

// ✅ COPY TO CLIPBOARD FUNCTION
const copyToClipboard = (text, label = 'ID') => {
  navigator.clipboard.writeText(text).then(() => {
    toast.success(`${label} copied to clipboard!`, {
      duration: 2000,
      position: 'top-center',
      style: {
        fontSize: '12px',
        padding: '8px 12px'
      }
    });
  }).catch(() => {
    toast.error('Failed to copy', { duration: 2000 });
  });
};

// ✅ PATIENT EDIT MODAL COMPONENT
const PatientEditModal = ({ study, isOpen, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    patientName: '',
    patientAge: '',
    patientGender: '',
    patientId: '',
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
        patientId: study.patientId || '',
        studyName: study.studyDescription || '',
        referringPhysician: study.referralNumber || '',
        accessionNumber: study.accessionNumber || '',
        clinicalHistory: study.clinicalHistory || ''
      });
    }
  }, [study, isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await onSave({
        studyId: study._id,
        ...formData
      });
      toast.success('Study details updated successfully');
      onClose();
    } catch (error) {
      console.error('Error saving study details:', error);
      toast.error('Failed to update study details');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-800 text-white">
          <h2 className="text-lg font-bold">{study?.patientName || 'Patient Name'}</h2>
          <p className="text-sm text-gray-300 mt-1">Update study details</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          <div className="grid grid-cols-2 gap-4">
            {/* Patient Name */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Patient Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="patientName"
                value={formData.patientName}
                onChange={handleChange}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            {/* Patient Age */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Patient Age <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="patientAge"
                value={formData.patientAge}
                onChange={handleChange}
                placeholder="045Y"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            {/* Patient Gender */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Patient Gender <span className="text-red-500">*</span>
              </label>
              <select
                name="patientGender"
                value={formData.patientGender}
                onChange={handleChange}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="">Select</option>
                <option value="M">Male</option>
                <option value="F">Female</option>
                <option value="O">Other</option>
              </select>
            </div>

            {/* Patient UHID */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Patient UHID
              </label>
              <input
                type="text"
                name="patientId"
                value={formData.patientId}
                onChange={handleChange}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-100"
                readOnly
              />
            </div>

            {/* Study Name */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Study Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="studyName"
                value={formData.studyName}
                onChange={handleChange}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            {/* Referring Physician */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Referring Physician Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="referringPhysician"
                value={formData.referringPhysician}
                onChange={handleChange}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            {/* Accession Number */}
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Accession Number
              </label>
              <input
                type="text"
                name="accessionNumber"
                value={formData.accessionNumber}
                onChange={handleChange}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Clinical History */}
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Add History <span className="text-red-500">*</span>
              </label>
              <textarea
                name="clinicalHistory"
                value={formData.clinicalHistory}
                onChange={handleChange}
                rows={4}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
              <p className="text-xs text-gray-500 mt-1">Updated values will show up in the report</p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
              disabled={loading}
            >
              Close
            </button>
            <button
              type="submit"
              className="px-6 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save Details'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ✅ MAIN STUDY ROW COMPONENT - EXCEL-LIKE WITH MULTI-LINE
const StudyRow = ({ index, style, data }) => {
  const { studies, selectedStudies, availableAssignees, callbacks } = data;
  const study = studies[index];
  const assignInputRef = useRef(null);
  const [assignInputValue, setAssignInputValue] = useState('');
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [assignmentModalPosition, setAssignmentModalPosition] = useState(null);
  const [inputFocused, setInputFocused] = useState(false);

  if (!study) return null;

  const isSelected = selectedStudies?.includes(study._id);
  const isUrgent = study.priority === 'URGENT' || study.priority === 'EMERGENCY';
  const isAssigned = study.isAssigned;
  const isLocked = study.studyLock?.isLocked || false;

  // ✅ SYNC INPUT VALUE WITH ASSIGNED RADIOLOGIST NAME
  useEffect(() => {
    if (isAssigned && !inputFocused && !assignInputValue) {
      const radiologistName = study.radiologist || '';
      setAssignInputValue(radiologistName);
    }
  }, [isAssigned, study.radiologist, inputFocused, assignInputValue]);

  const rowClasses = `flex items-stretch w-full h-full text-[11px] border-b border-gray-300 transition-all duration-100 hover:bg-blue-50 ${
    isSelected ? 'bg-blue-100 border-blue-400' : 
    isAssigned ? 'bg-green-50' : 
    index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
  } ${isUrgent ? 'bg-red-50 border-l-4 border-l-red-600' : ''}`;

  // ✅ IMPROVED POSITIONING - ALWAYS BELOW INPUT WITH HIGH Z-INDEX
  const handleAssignInputFocus = (e) => {
    if (isLocked) {
      toast.error(`Study is locked by ${study.studyLock?.lockedByName || 'another user'}. Cannot assign while locked.`, {
        duration: 3000,
        icon: '🔒'
      });
      e.target.blur();
      return;
    }

    setInputFocused(true);
    
    if (assignInputRef.current && !showAssignmentModal) {
      const rect = assignInputRef.current.getBoundingClientRect();
      const modalWidth = 450;
      const modalHeight = 500;
      
      // ✅ ALWAYS POSITION BELOW INPUT - NO EXCEPTIONS
      const top = rect.bottom + 8; // 8px gap below input
      let left = rect.left;
      
      // ✅ ADJUST HORIZONTAL POSITION IF GOES OFF-SCREEN
      const viewportWidth = window.innerWidth;
      if (left + modalWidth > viewportWidth - 20) {
        left = viewportWidth - modalWidth - 20;
      }
      if (left < 20) {
        left = 20;
      }
      
      const position = {
        top: top,
        left: left,
        width: modalWidth,
        zIndex: 99999 // ✅ VERY HIGH Z-INDEX TO APPEAR ON TOP
      };
      
      console.log('📍 Modal Position (Always Below):', {
        inputRect: rect,
        calculatedPosition: position,
        viewportHeight: window.innerHeight,
        modalWillExtendBeyondViewport: top + modalHeight > window.innerHeight
      });
      
      setAssignmentModalPosition(position);
      setShowAssignmentModal(true);
    }
  };

  const handleAssignInputChange = (e) => {
    setAssignInputValue(e.target.value);
  };

  const handleAssignInputBlur = () => {
    setTimeout(() => {
      if (!showAssignmentModal) {
        setInputFocused(false);
        if (isAssigned && study.radiologist) {
          setAssignInputValue(study.radiologist);
        }
      }
    }, 200);
  };

  const handleCloseAssignmentModal = () => {
    setShowAssignmentModal(false);
    setAssignmentModalPosition(null);
    setInputFocused(false);
    
    if (isAssigned && study.radiologist) {
      setAssignInputValue(study.radiologist);
    } else {
      setAssignInputValue('');
    }
  };

  const handleAssignmentSubmit = async (assignmentData) => {
    await callbacks.onAssignmentSubmit(assignmentData);
    handleCloseAssignmentModal();
  };

  return (
    <div style={style} className="w-full">
      <div className={rowClasses}>
        
        {/* ✅ BP ID WITH COPY BUTTON */}
        <Cell width="100px" align="center">
          <div className="flex items-center justify-center gap-1">
            <div className="text-[9px] font-mono text-gray-700 truncate" title={study.bharatPacsId !== 'N/A' ? study.bharatPacsId : study._id}>
              {study.bharatPacsId !== 'N/A' ? study.bharatPacsId : study._id.substring(0, 10)}
            </div>
            <button
              onClick={() => copyToClipboard(study.bharatPacsId !== 'N/A' ? study.bharatPacsId : study._id, 'BP ID')}
              className="p-1 hover:bg-gray-200 rounded transition-colors"
              title="Copy BP ID"
            >
              <Copy className="w-3 h-3 text-gray-500" />
            </button>
          </div>
        </Cell>

        {/* ✅ CENTER NAME (ORGANIZATION) */}
        <Cell width="120px">
          <div className="flex flex-col gap-0.5">
            <div className="font-semibold text-gray-900 truncate text-[10px]" title={study.organizationName}>
              {study.organizationName || '-'}
            </div>
          </div>
        </Cell>

        {/* ✅ SUB CENTER (LAB NAME) */}
        <Cell width="120px">
          <div className="flex flex-col gap-0.5">
            <div className="font-medium text-gray-700 truncate text-[10px]" title={study.centerName}>
              {study.centerName || '-'}
            </div>
          </div>
        </Cell>

        {/* ✅ TRACK CASE / STUDY UID */}
        <Cell width="60px">
          <div className="flex items-center justify-between gap-2 w-full">
            
            
            
            <button
              onClick={() => callbacks.onShowTimeline?.(study)}
              className="flex-shrink-0 p-1.5 hover:bg-purple-100 rounded-full transition-colors group"
              title="View Timeline"
            >
              <Clock className="w-4 h-4 text-purple-600 group-hover:text-purple-800" />
            </button>
          </div>
        </Cell>


        {/* ✅ PT NAME / UHID */}
        <Cell width="140px">
          <button 
            className={`w-full text-left hover:underline transition-colors ${
              isUrgent ? 'text-red-700 font-semibold' : 'text-gray-900 hover:text-blue-600'
            }`}
            onClick={() => callbacks.onPatienIdClick?.(study.patientId, study)}
          >
            <div className="flex flex-col gap-0.5">
              <div className="font-medium truncate text-[10px]" title={study.patientName}>
                {study.patientName || '-'}
                {isUrgent && <span className="ml-1 text-red-600">🚨</span>}
              </div>
              <div className="text-[8px] text-gray-500 truncate">
                UHID: {study.patientId || '-'}
              </div>
            </div>
          </button>
        </Cell>

        {/* ✅ AGE/SEX */}
        <Cell width="60px" align="center">
          <div className="font-medium text-[10px]">
            {study.ageGender !== 'N/A' ? study.ageGender : 
             study.patientAge && study.patientSex ? 
             `${study.patientAge}/${study.patientSex.charAt(0)}` : '-'}
          </div>
        </Cell>

        {/* ✅ MODALITY */}
        <Cell width="80px" align="center">
          <span className={`px-2 py-1 rounded text-[9px] font-bold ${
            isUrgent ? 'bg-red-600 text-white' : 'bg-blue-100 text-blue-800'
          }`}>
            {study.modality || '-'}
          </span>
        </Cell>

        {/* ✅ STUDY / SERIES / IMAGES */}
        <Cell width="90px" align="center">
          <div className="flex flex-col gap-0.5">
            <div className="text-[9px] text-gray-600">
              Study: 1
            </div>
            <div className="font-medium text-[10px]">
              S: {study.seriesCount || 0}
            </div>
            <div className="text-[9px] text-gray-500">
              I: {study.instanceCount || 0}
            </div>
          </div>
        </Cell>

        {/* ✅ PT ID / ACC. NO. */}
        <Cell width="100px">
          <div className="flex flex-col gap-0.5">
            <div className="text-[9px] text-gray-700 truncate" title={study.patientId}>
              ID: {study.patientId || '-'}
            </div>
            <div className="text-[8px] text-gray-500 truncate" title={study.accessionNumber}>
              Acc: {study.accessionNumber || '-'}
            </div>
          </div>
        </Cell>

        {/* ✅ REFERRAL DOCTOR */}
        <Cell width="110px">
          <div className="text-[9px] text-gray-600 truncate" title={study.referralNumber}>
            {study.referralNumber !== 'N/A' ? study.referralNumber : '-'}
          </div>
        </Cell>

        {/* ✅ CLINICAL HISTORY WITH EDIT BUTTON */}
        <Cell width="150px">
          <div className="flex flex-col gap-0.5 w-full">
            <div 
              className="text-[9px] text-gray-700 line-clamp-2 leading-tight" 
              title={study.clinicalHistory}
              style={{ 
                display: '-webkit-box', 
                WebkitLineClamp: 2, 
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                wordBreak: 'break-word'
              }}
            >
              {study.clinicalHistory || '-'}
            </div>
            <button
              onClick={() => callbacks.onEditPatient?.(study)}
              className="flex items-center gap-1 text-[8px] text-blue-600 hover:text-blue-800 hover:underline mt-1"
            >
              <Edit className="w-2.5 h-2.5" />
              Edit
            </button>
          </div>
        </Cell>

        {/* ✅ STUDY DATE & TIME */}
        <Cell width="100px" align="center">
          <div className="flex flex-col gap-0.5">
            <div className="font-medium text-[9px]">
              {study.studyDate ? formatDate(study.studyDate) : '-'}
            </div>
            <div className="text-[8px] text-gray-500">
              {study.studyTime || '-'}
            </div>
          </div>
        </Cell>

        {/* ✅ UPLOAD DATE & TIME */}
        <Cell width="100px" align="center">
          {formatDateTime(study.createdAt)}
        </Cell>

        {/* ✅ RADIOLOGIST WITH ALWAYS-ACTIVE INPUT FIELD */}
        <Cell width="200px">
          <div className="relative flex items-center gap-1 w-full">
            {/* ✅ INPUT FIELD - ALWAYS VISIBLE */}
            <input
              ref={assignInputRef}
              type="text"
              value={assignInputValue}
              onChange={handleAssignInputChange}
              onFocus={handleAssignInputFocus}
              onBlur={handleAssignInputBlur}
              placeholder={isLocked ? "🔒 Locked" : isAssigned ? "Click to reassign..." : "Assigned to"}
              disabled={isLocked}
              className={`flex-1 px-2 py-1.5 text-[10px] border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all ${
                isLocked 
                  ? 'bg-gray-100 cursor-not-allowed border-red-300 text-gray-500' 
                  : isAssigned 
                    ? 'bg-green-50 border-green-300 text-green-800 font-medium' 
                    : 'bg-white border-gray-300 text-gray-700'
              }`}
              title={
                isLocked 
                  ? `Study locked by ${study.studyLock?.lockedByName}` 
                  : isAssigned 
                    ? `Currently assigned to ${study.radiologist}. Click to change.`
                    : 'Click to assign radiologist'
              }
            />
            
            {/* ✅ STATUS INDICATORS */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {isAssigned && !isLocked && (
                <div className="w-2 h-2 bg-green-500 rounded-full" title="Assigned" />
              )}
              {isLocked && (
                <Lock className="w-3.5 h-3.5 text-red-600" title={`Locked by ${study.studyLock?.lockedByName}`} />
              )}
            </div>

            {/* ✅ ASSIGNMENT TIME (IF ASSIGNED) */}
            {isAssigned && study.assignedAt && !inputFocused && (
              <div className="absolute -bottom-3 left-0 text-[7px] text-gray-500">
                {formatTime(study.assignedAt)}
              </div>
            )}
          </div>
        </Cell>

        {/* ✅ CASE STATUS */}
        <Cell width="110px" align="center">
          <div className="flex flex-col gap-0.5">
            <span className={`px-2 py-0.5 rounded text-[8px] font-medium ${getStatusColor(study.workflowStatus)}`}>
              {study.caseStatus || formatWorkflowStatus(study.workflowStatus)}
            </span>
            {study.categoryTracking?.currentCategory && (
              <div className="text-[7px] text-gray-500">
                {study.categoryTracking.currentCategory}
              </div>
            )}
          </div>
        </Cell>

        {/* ✅ VIEW */}
        <Cell width="70px" align="center">
          <button
            onClick={() => callbacks.onViewStudy?.(study)}
            className="text-[9px] text-blue-600 hover:text-blue-800 font-medium hover:underline px-2 py-1 rounded hover:bg-blue-50"
          >
            View
          </button>
        </Cell>

        {/* ✅ PRINT REPORT/REPRINT */}
        <Cell width="100px" align="center">
          <div className="flex flex-col gap-0.5">
            <div className="text-[9px] font-medium text-gray-700">
              {study.printCount > 0 ? `${study.printCount} print(s)` : 'No prints'}
            </div>
            {study.lastPrintType && (
              <div className="text-[7px] text-gray-500">
                {study.lastPrintType}
              </div>
            )}
          </div>
        </Cell>

        {/* ✅ ACTION */}
        <Cell width="80px" align="center" borderRight={false}>
          <ActionDropdown 
            study={study}
            onViewReport={callbacks.onViewReport}
            onShowStudyNotes={callbacks.onShowStudyNotes}
            onViewStudy={callbacks.onViewStudy}
          />
        </Cell>

        

        {/* ✅ ASSIGNMENT MODAL - POSITIONED RELATIVE TO INPUT */}
        {showAssignmentModal && (
          <AssignmentModal
            study={study}
            availableAssignees={data.availableAssignees}
            onSubmit={handleAssignmentSubmit}
            onClose={handleCloseAssignmentModal}
            position={assignmentModalPosition}
            searchTerm={assignInputValue}
          />
        )}
      </div>
    </div>
  );
};

// ✅ MAIN WORKLIST TABLE COMPONENT
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
  onUpdateStudyDetails
}) => {
  
  const [assignmentModal, setAssignmentModal] = useState({
    show: false,
    study: null,
    position: null
  });

  const [detailedView, setDetailedView] = useState({
    show: false,
    studyId: null
  });

  const [reportModal, setReportModal] = useState({
    show: false,
    studyId: null,
    studyData: null
  });

  const [studyNotes, setStudyNotes] = useState({
    show: false,
    studyId: null
  });

  const [patientEditModal, setPatientEditModal] = useState({
    show: false,
    study: null
  });

  // ✅ ADD TIMELINE MODAL STATE
  const [timelineModal, setTimelineModal] = useState({
    show: false,
    studyId: null,
    studyData: null
  });

  // ✅ ADD TIMELINE HANDLERS
  const handleShowTimeline = useCallback((study) => {
    setTimelineModal({
      show: true,
      studyId: study._id,
      studyData: study
    });
  }, []);

  const handleCloseTimeline = useCallback(() => {
    setTimelineModal({ show: false, studyId: null, studyData: null });
  }, []);

  // ✅ HANDLERS
  const handleShowDetailedView = useCallback((studyId) => {
    setDetailedView({ show: true, studyId });
  }, []);

  const handleCloseDetailedView = useCallback(() => {
    setDetailedView({ show: false, studyId: null });
  }, []);

  const handleViewReport = useCallback((study) => {
    setReportModal({
      show: true,
      studyId: study._id,
      studyData: {
        patientName: study.patientName,
        patientId: study.patientId,
        studyDate: study.studyDate,
        modality: study.modality
      }
    });
  }, []);

  const handleCloseReportModal = useCallback(() => {
    setReportModal({ show: false, studyId: null, studyData: null });
  }, []);

  const handleShowStudyNotes = useCallback((studyId) => {
    setStudyNotes({ show: true, studyId });
  }, []);

  const handleCloseStudyNotes = useCallback(() => {
    setStudyNotes({ show: false, studyId: null });
  }, []);

  const handleViewStudy = useCallback((study) => {
    handleShowDetailedView(study._id);
  }, [handleShowDetailedView]);

  // ✅ HANDLE ASSIGN DOCTOR
  const handleAssignDoctor = useCallback((study, position) => {
    setAssignmentModal({
      show: true,
      study,
      position
    });
    
    if (onAssignDoctor) {
      onAssignDoctor(study);
    }
  }, [onAssignDoctor]);

  const handleAssignmentSubmit = useCallback(async (assignmentData) => {
    try {
      if (onAssignmentSubmit) {
        await onAssignmentSubmit(assignmentData);
      }
      setAssignmentModal({ show: false, study: null, position: null });
    } catch (error) {
      console.error('Assignment submission error:', error);
    }
  }, [onAssignmentSubmit]);

  const handleCloseAssignmentModal = useCallback(() => {
    setAssignmentModal({ show: false, study: null, position: null });
  }, []);

  // ✅ HANDLE PATIENT EDIT
  const handleEditPatient = useCallback((study) => {
    setPatientEditModal({ show: true, study });
  }, []);

  const handleClosePatientEdit = useCallback(() => {
    setPatientEditModal({ show: false, study: null });
  }, []);

  const handleSavePatientEdit = useCallback(async (formData) => {
    try {
      if (onUpdateStudyDetails) {
        await onUpdateStudyDetails(formData);
      }
      handleClosePatientEdit();
    } catch (error) {
      console.error('Error updating study details:', error);
      throw error;
    }
  }, [onUpdateStudyDetails, handleClosePatientEdit]);

  const virtualListData = useMemo(() => ({
    studies,
    selectedStudies,
    availableAssignees,
    callbacks: { 
      onSelectStudy, 
      onPatienIdClick, 
      onAssignDoctor: handleAssignDoctor,
      onShowDetailedView: handleShowDetailedView,
      onViewReport: handleViewReport,
      onShowStudyNotes: handleShowStudyNotes,
      onViewStudy: handleViewStudy,
      onEditPatient: handleEditPatient,
      onAssignmentSubmit,
      onShowTimeline: handleShowTimeline // ✅ ADD THIS
    }
  }), [studies, selectedStudies, availableAssignees, onSelectStudy, onPatienIdClick, handleAssignDoctor, handleShowDetailedView, handleViewReport, handleShowStudyNotes, handleViewStudy, handleEditPatient, onAssignmentSubmit, handleShowTimeline]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600 text-sm font-medium">Loading studies...</p>
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
          <h3 className="text-lg font-medium text-gray-900 mb-2">No studies found</h3>
          <p className="text-sm">Try adjusting your search or filter criteria</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-white border border-gray-300">
    
      {/* ✅ EXCEL-LIKE HEADER ROW */}
      <div className="flex-shrink-0">
        {/* ✅ COLUMN HEADERS - EXCEL STYLE */}
        <div className="flex items-stretch bg-purple-200 text-gray-800 text-[10px] font-bold border-b-2 border-gray-400">
          <Cell width="100px" align="center" style={{ backgroundColor: '#E9D5FF', padding: '8px 4px' }}>
            <div className="leading-tight">BP ID</div>
          </Cell>
          <Cell width="120px" align="center" style={{ backgroundColor: '#E9D5FF', padding: '8px 4px' }}>
            <div className="leading-tight">CENTER<br/>NAME</div>
          </Cell>
          <Cell width="120px" align="center" style={{ backgroundColor: '#E9D5FF', padding: '8px 4px' }}>
            <div className="leading-tight">SUB<br/>CENTER</div>
          </Cell>
          <Cell width="60px" align="center" style={{ backgroundColor: '#E9D5FF', padding: '8px 4px' }}>
            <div className="leading-tight flex items-center justify-center gap-1">
              <Clock className="w-3 h-3" />
              <span>TRACK<br/>CASE</span>
            </div>
          </Cell>
          <Cell width="140px" align="center" style={{ backgroundColor: '#E9D5FF', padding: '8px 4px' }}>
            <div className="leading-tight">PT NAME /<br/>UHID</div>
          </Cell>
          <Cell width="60px" align="center" style={{ backgroundColor: '#E9D5FF', padding: '8px 4px' }}>
            <div className="leading-tight">AGE/<br/>SEX</div>
          </Cell>
          <Cell width="80px" align="center" style={{ backgroundColor: '#E9D5FF', padding: '8px 4px' }}>
            <div className="leading-tight">MODALITY</div>
          </Cell>
          <Cell width="90px" align="center" style={{ backgroundColor: '#E9D5FF', padding: '8px 4px' }}>
            <div className="leading-tight">STUDY /<br/>SERIES /<br/>IMAGES</div>
          </Cell>
          <Cell width="100px" align="center" style={{ backgroundColor: '#E9D5FF', padding: '8px 4px' }}>
            <div className="leading-tight">PT ID/<br/>ACC. NO.</div>
          </Cell>
          <Cell width="110px" align="center" style={{ backgroundColor: '#E9D5FF', padding: '8px 4px' }}>
            <div className="leading-tight">REFERRAL<br/>DOCTOR</div>
          </Cell>
          <Cell width="150px" align="center" style={{ backgroundColor: '#E9D5FF', padding: '8px 4px' }}>
            <div className="leading-tight">CLINICAL<br/>HISTORY</div>
          </Cell>
          <Cell width="100px" align="center" style={{ backgroundColor: '#E9D5FF', padding: '8px 4px' }}>
            <div className="leading-tight">STUDY<br/>DATE/TIME</div>
          </Cell>
          <Cell width="100px" align="center" style={{ backgroundColor: '#E9D5FF', padding: '8px 4px' }}>
            <div className="leading-tight">UPLOAD<br/>DATE/TIME</div>
          </Cell>
          <Cell width="200px" align="center" style={{ backgroundColor: '#E9D5FF', padding: '8px 4px' }}>
            <div className="leading-tight">RADIOLOGIST</div>
          </Cell>
          <Cell width="110px" align="center" style={{ backgroundColor: '#E9D5FF', padding: '8px 4px' }}>
            <div className="leading-tight">CASE<br/>STATUS</div>
          </Cell>
          <Cell width="70px" align="center" style={{ backgroundColor: '#E9D5FF', padding: '8px 4px' }}>
            <div className="leading-tight">VIEW</div>
          </Cell>
          <Cell width="100px" align="center" style={{ backgroundColor: '#E9D5FF', padding: '8px 4px' }}>
            <div className="leading-tight">PRINT<br/>REPORT</div>
          </Cell>
          <Cell width="80px" align="center" borderRight={false} style={{ backgroundColor: '#E9D5FF', padding: '8px 4px' }}>
            <div className="leading-tight">ACTION</div>
          </Cell>
        </div>
      </div>

      {/* ✅ VIRTUALIZED CONTENT */}
      <div className="w-full flex-1 relative">
        <AutoSizer>
          {({ height, width }) => (
            <List
              height={height}
              width={width}
              itemCount={studies.length}
              itemSize={ROW_HEIGHT}
              itemData={virtualListData}
              overscanCount={5}
            >
              {StudyRow}
            </List>
          )}
        </AutoSizer>
      </div>

      {/* ✅ MODALS */}
      {assignmentModal.show && (
        <AssignmentModal
          study={assignmentModal.study}
          availableAssignees={availableAssignees}
          onSubmit={handleAssignmentSubmit}
          onClose={handleCloseAssignmentModal}
          position={assignmentModal.position}
        />
      )}

      {detailedView.show && (
        <StudyDetailedView
          studyId={detailedView.studyId}
          onClose={handleCloseDetailedView}
        />
      )}

      {reportModal.show && (
        <ReportModal
          isOpen={reportModal.show}
          studyId={reportModal.studyId}
          studyData={reportModal.studyData}
          onClose={handleCloseReportModal}
        />
      )}

      {studyNotes.show && (
        <StudyNotesComponent
          studyId={studyNotes.studyId}
          isOpen={studyNotes.show}
          onClose={handleCloseStudyNotes}
        />
      )}

      {patientEditModal.show && (
        <PatientEditModal
          study={patientEditModal.study}
          isOpen={patientEditModal.show}
          onClose={handleClosePatientEdit}
          onSave={handleSavePatientEdit}
        />
      )}

      {/* ✅ ADD TIMELINE MODAL */}
      {timelineModal.show && (
        <TimelineModal
          isOpen={timelineModal.show}
          onClose={handleCloseTimeline}
          studyId={timelineModal.studyId}
          studyData={timelineModal.studyData}
        />
      )}
    </div>
  );
};

export default WorklistTable;