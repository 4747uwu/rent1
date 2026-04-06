import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { Copy, UserPlus, Lock, Unlock, Edit, Clock, Download, Paperclip, MessageSquare, FileText, Trash2, Monitor, Eye, ChevronLeft, ChevronRight, CheckCircle, XCircle, Palette, Share2, RotateCcw, Printer, Users, X, Link, Shield, Hash } from 'lucide-react';
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
import MultiAssignModal from '../../assigner/MultiAssignModal';
import { useStudyShare } from '../../../hooks/useStudyShare';
import DeleteStudyModal from '../../superadmin/DeleteModal.jsx';

// ✅ UTILITY FUNCTIONS


// ...existing code...


const ShareModal = ({ study, isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const studyInstanceUID = study?.studyInstanceUID || study?.studyInstanceUIDs || study?._id || '';
  const viewerUrl = `hhttps://viewer.xcentic.com/viewer?StudyInstanceUIDs=${encodeURIComponent(studyInstanceUID)}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(viewerUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }).catch(() => { });
  };

  return (
    /* Removed bg-black and bg-opacity-60 from the div below */
    <div className="fixed inset-0 flex items-center justify-center z-[99999] p-3">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm border border-gray-200">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-900 text-white rounded-t-xl">
          <div className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-sky-400" />
            <div>
              <h2 className="text-xs font-bold uppercase">Share Study</h2>
              <p className="text-[9px] text-gray-400 mt-0.5">
                {study?.bharatPacsId} · {study?.patientName || study?.patientInfo?.patientName}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-[9px] font-bold uppercase text-gray-500 mb-1">
              👁️ View-Only OHIF Link
            </label>
            <div className="flex items-center gap-2 p-2 bg-gray-50 border border-gray-200 rounded-lg">
              <input
                readOnly
                value={viewerUrl}
                className="flex-1 text-[9px] font-mono bg-transparent text-gray-700 truncate outline-none"
              />
              <button
                onClick={handleCopy}
                className={`flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded text-[9px] font-bold transition-colors ${copied
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-900 text-white hover:bg-gray-700'
                  }`}
              >
                {copied ? (
                  <><CheckCircle className="w-3 h-3" /> Copied!</>
                ) : (
                  <><Copy className="w-3 h-3" /> Copy</>
                )}
              </button>
            </div>
          </div>

          <p className="text-[8px] text-gray-400 text-center">
            Anyone with this link can view the study images in the OHIF viewer.
          </p>
        </div>
      </div>
    </div>
  );
};



// ...existing code...


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

const useElapsedTime = (openedAt) => {
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    if (!openedAt) return;

    const calc = () => {
      const diff = Math.floor((Date.now() - new Date(openedAt).getTime()) / 1000);
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      if (h > 0) setElapsed(`${h}h ${m}m`);
      else if (m > 0) setElapsed(`${m}m ${s}s`);
      else setElapsed(`${s}s`);
    };

    calc();
    const interval = setInterval(calc, 1000);
    return () => clearInterval(interval);
  }, [openedAt]);

  return elapsed;
};

const ViewerTimerRow = ({ viewer }) => {
  const elapsed = useElapsedTime(viewer.openedAt);
  return (
    <div key={viewer.userId} className="flex flex-col text-[10px] leading-tight mb-1">
      <span className="font-semibold">{viewer.userName}</span>
      <span className="text-gray-300">Mode: <span className="text-blue-300">{viewer.mode}</span></span>
      {viewer.openedAt && (
        <span className="text-yellow-300 font-mono">
          ⏱ {elapsed} ago
        </span>
      )}
    </div>
  );
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
    const clean = str.split('.')[0];
    if (!/^\d{4,6}$/.test(clean)) return '';
    const hh = clean.slice(0, 2);
    const mm = clean.slice(2, 4);
    if (+hh > 23 || +mm > 59) return '';
    return `${hh}:${mm}`;
  } catch {
    return '';
  }
};

const copyToClipboard = (text, label = 'ID') => {
  if (!text || text === 'N/A') return;
  navigator.clipboard.writeText(text).catch(() => { });
};

const PRIORITY_SORT_ORDER = {
  'EMERGENCY': 0,
  'PRIORITY': 1,
  'MLC': 2,
  'STAT': 3,
  'NORMAL': 4,
};

const COMPLETED_STATUSES = new Set([
  'report_completed',
  'final_report_downloaded',
  'report_verified',
  'archived',
]);

const CASE_PRIORITY_OPTIONS = [
  { value: 'NORMAL', label: '🟢 Normal', border: 'border-gray-300', bg: 'bg-gray-50', text: 'text-gray-700', desc: 'Standard workflow.' },
  { value: 'STAT', label: '⏱️ STAT', border: 'border-sky-400', bg: 'bg-sky-50', text: 'text-sky-700', desc: 'Expedited turnaround.' },
  { value: 'PRIORITY', label: '⭐ Priority', border: 'border-purple-400', bg: 'bg-purple-50', text: 'text-purple-700', desc: 'Elevated priority.' },
  { value: 'MLC', label: '⚖️ MLC', border: 'border-amber-400', bg: 'bg-amber-50', text: 'text-amber-700', desc: 'Medico-legal case.' },
  { value: 'EMERGENCY', label: '🚨 Emergency', border: 'border-red-500', bg: 'bg-red-50', text: 'text-red-700', desc: 'Life-threatening.' },
];

const getPriorityWeight = (study) => {
  const p = (study.priority || study.assignment?.[0]?.priority || '').toUpperCase();
  const baseWeight = PRIORITY_SORT_ORDER[p] ?? 4;

  // ✅ Completed cases stay in their priority group but sink below active ones
  // e.g. active EMERGENCY=0, completed EMERGENCY=5 (still above active NORMAL=4? no...)
  // Active:    EMERGENCY=0, PRIORITY=1, MLC=2, STAT=3, NORMAL=4
  // Completed: EMERGENCY=5, PRIORITY=6, MLC=7, STAT=8, NORMAL=9
  if (COMPLETED_STATUSES.has(study.workflowStatus)) {
    return baseWeight + Object.keys(PRIORITY_SORT_ORDER).length + 1; // offset by 5
  }

  return baseWeight;
};

const sortStudiesByPriority = (studies) => {
  return [...studies].sort((a, b) => getPriorityWeight(a) - getPriorityWeight(b));
};

const getPriorityTag = (study) => {
  const raw = study.priority || study.assignment?.[0]?.priority || '';
  const p = raw.toUpperCase();
  switch (p) {
    case 'EMERGENCY': return <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold text-red-600 bg-red-50 border border-red-200">🚨 Emergency</span>;
    case 'PRIORITY': return <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold text-purple-700 bg-purple-50 border border-purple-200">⭐ Priority</span>;
    case 'MLC': return <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold text-gray-700 bg-gray-100 border border-gray-300">⚖️ MLC</span>;
    case 'STAT': return <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold text-sky-700 bg-sky-50 border border-sky-200">⏱️ STAT</span>;
    case 'NORMAL':
    default: return null;
  }
};



const PatientEditModal = ({ study, isOpen, onClose, onSave, onRefreshStudies }) => {
  const [formData, setFormData] = useState({
    patientName: '', patientAge: '', patientGender: '', studyName: '', referringPhysician: '', accessionNumber: '', clinicalHistory: '', priority: 'NORMAL',
  });
  const [loading, setLoading] = useState(false);

  // ✅ CHANGED: Follow-up is now staged — not called immediately on toggle
  const [followUpReason, setFollowUpReason] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [isFollowUp, setIsFollowUp] = useState(false);           // current DB state
  const [stagedFollowUp, setStagedFollowUp] = useState(false);   // what user toggled to (pending save)
  const [followUpChanged, setFollowUpChanged] = useState(false); // did user change it?

  const hasBeenCompleted = study?.statusHistory?.some(
    s => s.status === 'final_report_downloaded' || s.status === 'report_completed' || s.status === 'report_verified'
  );

  useEffect(() => {
    if (study && isOpen) {
      const rawPriority = (study.priority || study.assignment?.[0]?.priority || '').toUpperCase().trim();
      const validValues = CASE_PRIORITY_OPTIONS.map(o => o.value);
      const resolvedPriority = validValues.includes(rawPriority) ? rawPriority : 'NORMAL';

      setFormData({
        patientName: study.patientName || study.patientInfo?.patientName || '',
        patientAge: study.patientAge || study.patientInfo?.age || '',
        patientGender: study.patientSex || study.patientInfo?.gender || '',
        studyName: study.studyDescription || study.examDescription || '',
        referringPhysician: study.referralNumber || study.referringPhysicianName || '',
        accessionNumber: study.accessionNumber || '',
        clinicalHistory: study.clinicalHistory?.clinicalHistory || (typeof study.clinicalHistory === 'string' ? study.clinicalHistory : '') || '',
        priority: resolvedPriority,
      });

      // ✅ Sync follow-up from study — both staged and current match on open
      const currentFollowUp = study.followUp?.isFollowUp || false;
      setIsFollowUp(currentFollowUp);
      setStagedFollowUp(currentFollowUp);
      setFollowUpChanged(false);
      setFollowUpReason(study.followUp?.reason || '');
      setFollowUpDate(
        study.followUp?.followUpDate
          ? new Date(study.followUp.followUpDate).toISOString().split('T')[0]
          : ''
      );
    }
  }, [study, isOpen]);

  // ✅ CHANGED: Toggle only updates staged state, no API call yet
  const handleFollowUpToggle = () => {
    const newValue = !stagedFollowUp;
    setStagedFollowUp(newValue);
    setFollowUpChanged(newValue !== isFollowUp);
    // Clear fields if toggling off
    if (!newValue) {
      setFollowUpReason('');
      setFollowUpDate('');
    }
  };

  // ✅ CHANGED: handleSubmit now handles follow-up API call + study details save together
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // ── Step 1: Save study details ──────────────────────────────────────────
      await onSave({ studyId: study._id, ...formData });

      // ── Step 2: Handle follow-up change if toggled ──────────────────────────
      if (followUpChanged) {
        if (stagedFollowUp) {
          // Mark as follow-up
          const response = await api.post(`/follow-up/studies/${study._id}/follow-up`, {
            reason: followUpReason,
            followUpDate: followUpDate || null,
          });
          if (!response.data.success) throw new Error(response.data.message || 'Failed to mark follow-up');
          toast.success('Study marked as follow-up 🔁', { icon: '📋' });
        } else {
          // Resolve follow-up
          const response = await api.delete(`/follow-up/studies/${study._id}/follow-up`, {
            data: { notes: followUpReason },
          });
          if (!response.data.success) throw new Error(response.data.message || 'Failed to resolve follow-up');
          toast.success('Follow-up removed ✅');
        }
      }

      toast.success('Study details updated successfully');

      // ✅ NEW: Refresh worklist so follow-up tag appears/disappears immediately
      onRefreshStudies?.();
      onClose();

    } catch (error) {
      toast.error(error.message || 'Failed to save changes');
    } finally {
      setLoading(false);
    }
  };

  const selectedOption = CASE_PRIORITY_OPTIONS.find(o => o.value === formData.priority) || CASE_PRIORITY_OPTIONS[0];
  const isStagedOn = stagedFollowUp;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-white/30 backdrop-blur-sm flex items-center justify-center z-[10000] p-2">
      <div className="bg-white rounded shadow-2xl w-full max-w-2xl max-h-[95vh] overflow-hidden border border-gray-200 flex flex-col">

        <div className="px-3 py-2 bg-gray-900 text-white flex items-center justify-between">
          <div>
            <h2 className="text-xs sm:text-sm font-bold uppercase truncate max-w-[200px] sm:max-w-md">{study?.patientName || 'Edit Study'}</h2>
            <p className="text-[9px] text-gray-300 mt-0 uppercase leading-tight">
              BP ID: {study?.bharatPacsId} | MOD: {study?.modality}
              {isStagedOn && <span className="ml-2 text-amber-400 font-bold">🔁 FOLLOW-UP</span>}
              {followUpChanged && (
                <span className="ml-1 text-yellow-300 font-normal">(unsaved)</span>
              )}
            </p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded transition-colors">
            <XCircle className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-3 overflow-y-auto flex-1">

          {/* PRIORITY */}
          <div className={`mb-3 p-2 rounded border ${selectedOption.border} ${selectedOption.bg} transition-all`}>
            <div className="flex justify-between items-end mb-1.5">
              <h3 className="text-[10px] font-bold text-gray-800 uppercase">Case Priority</h3>
              <span className={`text-[8px] ${selectedOption.text} font-medium`}>{selectedOption.desc}</span>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {CASE_PRIORITY_OPTIONS.map(opt => (
                <button
                  key={opt.value} type="button"
                  onClick={() => setFormData(prev => ({ ...prev, priority: opt.value }))}
                  className={`p-1 rounded border text-center transition-all ${formData.priority === opt.value
                    ? `${opt.border} ${opt.bg} ${opt.text} shadow-sm font-bold scale-[1.02]`
                    : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                    }`}
                >
                  <div className="text-[10px] leading-none mb-0.5">{opt.label.split(' ')[0]}</div>
                  <div className="text-[8px] font-bold leading-tight truncate">{opt.label.split(' ').slice(1).join(' ')}</div>
                </button>
              ))}
            </div>
          </div>

          {/* ✅ CHANGED: FOLLOW-UP SECTION — toggle is staged, saved on form submit */}
          {hasBeenCompleted && (
            <div className={`mb-3 p-2 rounded border transition-all ${isStagedOn ? 'border-amber-400 bg-amber-50' : 'border-gray-200 bg-gray-50'
              }`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-gray-800 uppercase">🔁 Follow-Up</span>
                  {isStagedOn && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold bg-amber-200 text-amber-800 border border-amber-300">
                      ACTIVE
                    </span>
                  )}
                  {/* ✅ Unsaved change indicator */}
                  {followUpChanged && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold bg-yellow-100 text-yellow-700 border border-yellow-300">
                      ● Pending Save
                    </span>
                  )}
                </div>

                {/* ✅ CHANGED: Toggle switch instead of immediate API button */}
                <button
                  type="button"
                  onClick={handleFollowUpToggle}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${isStagedOn ? 'bg-amber-500' : 'bg-gray-300'
                    }`}
                  title={isStagedOn ? 'Toggle off follow-up (will apply on Save)' : 'Toggle on follow-up (will apply on Save)'}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${isStagedOn ? 'translate-x-[18px]' : 'translate-x-[2px]'
                      }`}
                  />
                </button>
              </div>

              {/* ✅ Fields only editable when toggling ON and not yet saved */}
              {isStagedOn && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[8px] font-medium text-gray-600 mb-0.5 uppercase">Reason</label>
                    <input
                      type="text"
                      value={followUpReason}
                      onChange={(e) => setFollowUpReason(e.target.value)}
                      placeholder="e.g. Post-op review..."
                      className="w-full px-1.5 py-1 text-[9px] border border-gray-300 rounded focus:ring-1 focus:ring-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] font-medium text-gray-600 mb-0.5 uppercase">Follow-Up Date</label>
                    <input
                      type="date"
                      value={followUpDate}
                      onChange={(e) => setFollowUpDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-1.5 py-1 text-[9px] border border-gray-300 rounded focus:ring-1 focus:ring-amber-400"
                    />
                  </div>
                </div>
              )}

              {/* ✅ Show existing follow-up info when already active and unchanged */}
              {isFollowUp && !followUpChanged && study.followUp?.markedAt && (
                <div className="mt-1.5 text-[8px] text-amber-700">
                  Marked by <strong>{study.followUp.markedByName}</strong> on{' '}
                  {new Date(study.followUp.markedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  {study.followUp.followUpDate && (
                    <> · Due: <strong>{new Date(study.followUp.followUpDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</strong></>
                  )}
                </div>
              )}

              <p className="mt-1.5 text-[8px] text-gray-400">
                💡 Toggle follow-up above — changes apply when you click <strong>SAVE</strong>.
              </p>
            </div>
          )}

          {/* PATIENT INFO */}
          <div className="mb-3">
            <h3 className="text-[10px] font-bold text-gray-800 mb-1.5 uppercase">Patient Info</h3>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[8px] font-medium text-gray-700 mb-0.5 uppercase">Name *</label>
                <input type="text" value={formData.patientName} onChange={(e) => setFormData(prev => ({ ...prev, patientName: e.target.value }))} className="w-full px-1.5 py-1 text-[10px] font-semibold border border-gray-300 rounded focus:ring-1 focus:ring-gray-900 uppercase" required />
              </div>
              <div>
                <label className="block text-[8px] font-medium text-gray-700 mb-0.5 uppercase">Age *</label>
                <input type="text" value={formData.patientAge} onChange={(e) => setFormData(prev => ({ ...prev, patientAge: e.target.value }))} className="w-full px-1.5 py-1 text-[10px] font-semibold border border-gray-300 rounded focus:ring-1 focus:ring-gray-900 uppercase" required />
              </div>
              <div>
                <label className="block text-[8px] font-medium text-gray-700 mb-0.5 uppercase">Gender</label>
                <select value={formData.patientGender} onChange={(e) => setFormData(prev => ({ ...prev, patientGender: e.target.value }))} className="w-full px-1.5 py-1 text-[10px] font-semibold border border-gray-300 rounded focus:ring-1 focus:ring-gray-900 uppercase">
                  <option value="">SEL</option><option value="M">M</option><option value="F">F</option><option value="O">O</option>
                </select>
              </div>
            </div>
          </div>

          <div className="mb-3">
            <h3 className="text-[10px] font-bold text-gray-800 mb-1.5 uppercase">Study Info</h3>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[8px] font-medium text-gray-700 mb-0.5 uppercase">Study Name *</label>
                <input type="text" value={formData.studyName} onChange={(e) => setFormData(prev => ({ ...prev, studyName: e.target.value }))} className="w-full px-1.5 py-1 text-[10px] font-semibold border border-gray-300 rounded uppercase" required />
              </div>
              <div>
                <label className="block text-[8px] font-medium text-gray-700 mb-0.5 uppercase">Accession #</label>
                <input type="text" value={formData.accessionNumber} onChange={(e) => setFormData(prev => ({ ...prev, accessionNumber: e.target.value }))} className="w-full px-1.5 py-1 text-[10px] font-semibold border border-gray-300 rounded uppercase" />
              </div>
              <div className="col-span-2">
                <label className="block text-[8px] font-medium text-gray-700 mb-0.5 uppercase">Ref. Physician *</label>
                <input type="text" value={formData.referringPhysician} onChange={(e) => setFormData(prev => ({ ...prev, referringPhysician: e.target.value }))} className="w-full px-1.5 py-1 text-[10px] font-semibold border border-gray-300 rounded uppercase" required />
              </div>
            </div>
          </div>

          <div className="mb-2">
            <h3 className="text-[10px] font-bold text-gray-800 mb-1 uppercase">Clinical History</h3>
            <textarea value={formData.clinicalHistory} onChange={(e) => setFormData(prev => ({ ...prev, clinicalHistory: e.target.value }))} rows={2} className="w-full px-1.5 py-1 text-[10px] font-semibold border border-gray-300 rounded resize-none uppercase" />
          </div>

          <div className="flex justify-between items-center pt-2 mt-2 border-t border-gray-200">
            <div className="text-[8px] text-gray-500 uppercase"><span className="text-red-500">*</span> REQ</div>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="px-3 py-1 text-[10px] font-bold bg-gray-100 text-gray-700 rounded border border-gray-300 uppercase" disabled={loading}>CANCEL</button>
              <button
                type="submit"
                className={`px-3 py-1 text-[10px] font-bold text-white rounded border uppercase flex items-center gap-1 transition-colors ${followUpChanged
                  ? 'bg-amber-600 border-amber-700 hover:bg-amber-700'  // amber when follow-up pending
                  : 'bg-gray-900 border-gray-900 hover:bg-gray-700'
                  }`}
                disabled={loading}
              >
                {loading
                  ? 'SAVING...'
                  : followUpChanged
                    ? `SAVE + ${stagedFollowUp ? 'MARK FOLLOW-UP' : 'REMOVE FOLLOW-UP'}`
                    : 'SAVE'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};



// ✅ NEW: Follow-up tag in getPriorityTag — add below existing STAT case
const getFollowUpTag = (study) => {
  if (!study?.followUp?.isFollowUp) return null;
  return (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-300">
      🔁 Follow-Up
    </span>
  );
};


const StudyRow = ({
  study, activeViewers = [], index, selectedStudies, availableAssignees, onSelectStudy, onPatienIdClick, onAssignDoctor, onShowDetailedView, onViewReport, onShowStudyNotes, onViewStudy, onEditPatient, onAssignmentSubmit, onShowTimeline, onToggleLock, onShowDocuments, onShowRevertModal, setPrintModal, onDirectPrint,
  userRole,
  onRefreshStudies,
  userRoles = [],
  getColumnWidth, isColumnVisible = () => true,
  onShowDeleteModal,  // ✅ ADD THIS PROP

}) => {
  const navigate = useNavigate();
  console.log('Rendering StudyRow for study:', study);

  //  const userAccountRoles = userRoles.length > 0 ? userRoles : [userRole];


  // ✅ Viewer preference — persisted in localStorage
  const [selectedViewer, setSelectedViewer] = useState(
    () => localStorage.getItem('preferredOhifViewer') || 'viewer1'
  );
  const handleViewerChange = (e) => {
    const v = e.target.value;
    setSelectedViewer(v);
    localStorage.setItem('preferredOhifViewer', v);
  };


  const [showViewerDropdownView, setShowViewerDropdownView] = useState(false);
  const [showViewerDropdownReport, setShowViewerDropdownReport] = useState(false);

  const assignInputRef = useRef(null);
  const downloadButtonRef = useRef(null);
  const [assignInputValue, setAssignInputValue] = useState('');
  const [verifierInputValue, setVerifierInputValue] = useState('');
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [assignmentModalPosition, setAssignmentModalPosition] = useState(null);
  const [inputFocused, setInputFocused] = useState(false);
  const [showDownloadOptions, setShowDownloadOptions] = useState(false);
  const [downloadPosition, setDownloadPosition] = useState(null);
  const [togglingLock, setTogglingLock] = useState(false);
  const [restoringStudy, setRestoringStudy] = useState(false);
  const hasActiveViewers = activeViewers.length > 0;
  const [shareModal, setShareModal] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);

  const WORKFLOW_STATUS_OPTIONS = [
    { value: 'new_study_received', label: 'New' },
    { value: 'pending_assignment', label: 'Pending' },
    { value: 'assigned_to_doctor', label: 'Assigned' },
    { value: 'doctor_opened_report', label: 'Opened' },
    { value: 'report_in_progress', label: 'In Progress' },
    { value: 'report_drafted', label: 'Drafted' },
    { value: 'report_finalized', label: 'Finalized' },
    { value: 'verification_pending', label: 'Verification Pending' },
    { value: 'report_verified', label: 'Verified' },
    { value: 'report_completed', label: 'Completed' },
    { value: 'final_report_downloaded', label: 'Downloaded' },
    { value: 'report_rejected', label: 'Rejected' },
    { value: 'revert_to_radiologist', label: 'Reverted' },
    { value: 'archived', label: 'Archived' },
  ];

  const handleWorkflowStatusChange = async (newStatus) => {
    setChangingStatus(true);
    try {
      const response = await api.put(`/doctor/studies/${study._id}/workflow-status`, { workflowStatus: newStatus });
      if (response.data.success) {
        toast.success(`Status changed to ${newStatus.replace(/_/g, ' ')}`);
        onRefreshStudies?.();
      } else {
        toast.error(response.data.message || 'Failed to change status');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to change status');
    } finally {
      setChangingStatus(false);
      setShowStatusDropdown(false);
    }
  };

  const printCount = study.printCount || 0;
  const lastPrint = study.lastPrintedAt || null;
  const lastDownload = study.lastDownload || null;


  const isSelected = selectedStudies?.includes(study._id);
  const studyPriority = (study.priority || study.assignment?.[0]?.priority || '').toUpperCase();
  const isEmergencyCase = studyPriority === 'EMERGENCY';
  const isPriorityCase = studyPriority === 'PRIORITY';
  const isMLCCase = studyPriority === 'MLC';
  const isStatCase = studyPriority === 'STAT';
  const isUrgent = isEmergencyCase;
  const isAssigned = study.isAssigned;
  const isLocked = study?.isLocked || false;
  const hasNotes = study.hasStudyNotes === true || (study.discussions && study.discussions.length > 0);
  const hasAttachments = study.attachments && study.attachments.length > 0;
  const canToggleLock = userRoles.includes('admin') || userRoles.includes('assignor') || userRole === 'admin' || userRole === 'assignor';
  const isRejected = study.workflowStatus === 'report_rejected';
  const rejectionReason = study.reportInfo?.verificationInfo?.rejectionReason || '-';

  const userAccountRoles = userRoles.length > 0 ? userRoles : [userRole];
  const isSuperAdmin = userAccountRoles.includes('super_admin');

  const [elapsedTime, setElapsedTime] = useState(null);
  const assignedDoctor = study.assignedDoctors?.[0] || study.assignment?.[0];
  const isAssignedStatus = assignedDoctor?.status === 'assigned';
  const assignedAt = assignedDoctor?.assignedAt;
  const isReportCompleted = ['report_drafted', 'report_finalized', 'verification_pending', 'report_verified', 'report_completed'].includes(study.workflowStatus);
  const reportCompletedAt = study.reportInfo?.finalizedAt || study.reportInfo?.draftedAt;

  useEffect(() => {
    if (isAssignedStatus && assignedAt) {
      const interval = setInterval(() => {
        setElapsedTime(calculateElapsedTime(assignedAt));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isAssignedStatus, assignedAt]);

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

  const rowClasses = `${isEmergencyCase ? 'border-l-4 border-l-red-600' :
    isPriorityCase ? 'border-l-4 border-l-purple-500' :
      isStatCase ? '' :
        isSelected ? 'bg-gray-100 border-l-2 border-l-gray-900' :
          isAssigned ? 'bg-gray-50' :
            index % 2 === 0 ? 'bg-white' : 'bg-slate-50'
    } ${isRejected && !isEmergencyCase ? 'border-l-4 border-l-rose-600' : ''} ${isEmergencyCase ? 'hover:bg-red-50' :
      isPriorityCase ? 'hover:bg-purple-50' :
        'hover:bg-gray-100'
    } transition-colors duration-200 border-b border-slate-100`;

  const handleAssignInputFocus = (e) => {
    if (isLocked) {
      e.target.blur();
      return;
    }
    setInputFocused(true);
    setAssignInputValue('');
    if (assignInputRef.current) {
      const rect = assignInputRef.current.getBoundingClientRect();
      const modalHeight = 380;
      const modalWidth = 450;
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;

      let top;
      if (spaceBelow >= modalHeight) top = rect.bottom + 8;
      else if (spaceAbove >= modalHeight) top = rect.top - modalHeight - 24;
      else top = Math.max(8, (viewportHeight - modalHeight) / 1.5);

      let left = rect.left;
      if (left + modalWidth > viewportWidth - 20) left = viewportWidth - modalWidth - 20;
      if (left < 20) left = 20;

      setAssignmentModalPosition({ top, left, width: modalWidth, zIndex: 99999 });
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


  const handleCloseDocuments = useCallback(() => {
    setDocumentsModal({ show: false, studyId: null, studyMeta: null });
    onRefreshStudies?.();  // ✅ Trigger refresh
  }, [onRefreshStudies]);

  // ✅ UPDATED: Refresh on close
  const handleCloseStudyNotes = useCallback(() => {
    setStudyNotes({ show: false, studyId: null });
    onRefreshStudies?.();  // ✅ Trigger refresh
  }, [onRefreshStudies]);


  // ✅ UNIFIED: Get report then download as PDF (same pattern as DOCX)
  // const handleDirectPrint = useCallback(async (study) => {
  //         toast.loading('Fetching reports...', { id: 'print-load' });
  //         try {
  //             // Step 1: Get all finalized report IDs
  //             const response = await api.get(`/reports/studies/${study._id}/report-ids`);

  //             if (!response.data.success || !response.data.data?.reports?.length) {
  //                 toast.error('No finalized reports found', { id: 'print-load' });
  //                 return;
  //             }

  //             const { reports, totalReports } = response.data.data;
  //             toast.success(`Found ${totalReports} report(s). Opening for print...`, { id: 'print-load', duration: 2000 });

  //             // Step 2: Print each report one by one
  //             for (let i = 0; i < reports.length; i++) {
  //                 const reportMeta = reports[i];

  //                 if (i > 0) await new Promise(resolve => setTimeout(resolve, 1000));

  //                 toast.loading(`Preparing print ${i + 1} of ${totalReports}...`, { id: `print-${i}` });

  //                 try {
  //                     const pdfResponse = await api.get(
  //                         `/reports/reports/${reportMeta.reportId}/print`,
  //                         { responseType: 'blob', timeout: 60000 }
  //                     );

  //                     const blob = new Blob([pdfResponse.data], { type: 'application/pdf' });
  //                     const url = window.URL.createObjectURL(blob);

  //                     // Open PDF inline in new tab — browser print dialog opens
  //                     const printWindow = window.open(url, '_blank');
  //                     if (printWindow) {
  //                         printWindow.onload = () => {
  //                             printWindow.focus();
  //                             printWindow.print();
  //                         };
  //                     }

  //                     // Clean up blob URL after a delay
  //                     setTimeout(() => window.URL.revokeObjectURL(url), 30000);

  //                     toast.success(
  //                         totalReports > 1
  //                             ? `🖨️ Print ${i + 1} of ${totalReports} opened!`
  //                             : '🖨️ Print dialog opened!',
  //                         { id: `print-${i}`, duration: 2500 }
  //                     );
  //                 } catch (err) {
  //                     console.error(`❌ Failed to print report ${i + 1}:`, err);
  //                     toast.error(`❌ Print ${i + 1} failed`, { id: `print-${i}`, duration: 3000 });
  //                 }
  //             }

  //             if (totalReports > 1) {
  //                 toast.success(`🎉 All ${totalReports} reports sent to print!`, { id: 'print-done', duration: 3000 });
  //             }

  //         } catch (error) {
  //             console.error('❌ [Print] Error:', error);
  //             toast.error('Failed to load reports for printing.', { id: 'print-load' });
  //         }
  //     }, []);

  // ✅ UNIFIED: Get report then download as PDF (same pattern as DOCX)
  const handleDownloadPDF = useCallback(async (study) => {
    try {
      const response = await api.get(`/reports/studies/${study._id}/reports`);

      if (!response.data.success || !response.data.data?.reports?.length) {
        toast.error('No report found for this study');
        return;
      }

      const reports = response.data.data.reports;
      const latestReport =
        reports.find(r => r.reportStatus === 'finalized') || reports[0];

      if (!latestReport) {
        toast.error('No finalized report available');
        return;
      }

      const pdfResponse = await api.get(
        `/reports/reports/${latestReport._id}/download/pdf`,
        { responseType: 'blob' }
      );

      const url = window.URL.createObjectURL(new Blob([pdfResponse.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        `${study.patientName || 'report'}_${study.bharatPacsId || study._id}.pdf`
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

    } catch (error) {
      console.error('❌ [Download PDF] Error:', error);
      toast.error('Failed to download PDF');
    }
  }, []);

  const handleDownloadClick = (e) => {
    e.stopPropagation();
    if (downloadButtonRef.current) {
      const rect = downloadButtonRef.current.getBoundingClientRect();
      setDownloadPosition({ top: rect.bottom + 8, left: Math.max(20, Math.min(rect.left, window.innerWidth - 300)) });
      setShowDownloadOptions(true);
    }
  };

  const handleViewOnlyClick = (e) => {
    e.stopPropagation();
    try {
      const src = study || {};
      const studyInstanceUID = src.studyInstanceUID || src.studyInstanceUIDs || src.StudyInstanceUID || src.studyInstanceUid || src.orthancStudyID || src.studyId || src._id || '';

      let studyUIDs = '';
      if (Array.isArray(studyInstanceUID) && studyInstanceUID.length) studyUIDs = studyInstanceUID.join(',');
      else if (typeof studyInstanceUID === 'string' && studyInstanceUID.trim()) studyUIDs = studyInstanceUID.trim();
      else studyUIDs = String(src._id || '');

      const OHIF_VIEWERS = {
        viewer1: 'https://viewer.xcentic.com/viewer',
        viewer2: 'https://viewer2.xcentic.com/viewer',
      };

      // Determine format based on selectedViewer
      const finalUrl = selectedViewer === 'viewer2'
        ? `${OHIF_VIEWERS.viewer2}/${studyUIDs}` // Viewer 2 format: /viewer/UID
        : `${OHIF_VIEWERS.viewer1}?StudyInstanceUIDs=${encodeURIComponent(studyUIDs)}`; // Viewer 1 format: ?StudyInstanceUIDs=UID

      window.open(finalUrl, '_blank');
    } catch (error) {
      window.open(`/ohif/viewer?StudyInstanceUIDs=${study?._id || ''}`, '_blank');
    }
  };

  const handleOHIFReporting = async () => {
    setRestoringStudy(true);
    try {
      const currentUser = sessionManager.getCurrentUser();
      const accountRoles = currentUser?.accountRoles || [currentUser?.role];
      const isRadiologist = accountRoles.includes('radiologist');
      const isVerifier = accountRoles.includes('verifier');

      if (isRadiologist && !isVerifier) {
        try {
          setTogglingLock(true);
          await api.post(`/admin/studies/${study._id}/lock`);
          setTogglingLock(false);
        } catch (lockError) {
          setTogglingLock(false);
        }
      }

      const queryParams = new URLSearchParams({ openOHIF: 'true', ...(isVerifier && { verifierMode: 'true', action: 'verify' }) });
      const reportingUrl = `/online-reporting/${study._id}?${queryParams.toString()}`;

      await navigateWithRestore(
        (path) => window.open(path, '_blank'), reportingUrl, study,
        {
          daysThreshold: 10,
          onRestoreStart: () => { },
          onRestoreComplete: () => { },
          onRestoreError: () => { }
        }
      );
    } catch (error) {
      const currentUser = sessionManager.getCurrentUser();
      const accountRoles = currentUser?.accountRoles || [currentUser?.role];
      const isRadiologist = accountRoles.includes('radiologist');

      if (error.response?.status === 423 && !isRadiologist) {
        // silently handled
      } else if (error.response?.status !== 423) {
        toast.error(error.response?.data?.message || 'Failed to open study');
      }

      const queryParams = new URLSearchParams({
        openOHIF: 'true',
        viewer: selectedViewer,
        ...(isVerifier && { verifierMode: 'true', action: 'verify' })
      });

      window.open(`/online-reporting/${study._id}?${queryParams.toString()}`, '_blank');
    } finally {
      setTogglingLock(false);
      setRestoringStudy(false);
    }
  };



  const handleDirectDownloadPDF = useCallback(async (study) => {
    try {
      const response = await api.get(`/reports/studies/${study._id}/report-ids`);

      if (!response.data.success || !response.data.data?.reports?.length) {
        toast.error('No finalized reports found');
        return;
      }

      const { reports, totalReports } = response.data.data;

      for (let i = 0; i < reports.length; i++) {
        const reportMeta = reports[i];
        if (i > 0) await new Promise(resolve => setTimeout(resolve, 800));

        try {
          const pdfResponse = await api.get(
            `/reports/reports/${reportMeta.reportId}/download/pdf`,
            { responseType: 'blob', timeout: 60000 }
          );
          const blob = new Blob([pdfResponse.data], { type: 'application/pdf' });
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${study.patientName || 'report'}_${study.bharatPacsId || study._id}_${i + 1}.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
        } catch (err) {
          toast.error(`Report ${i + 1} download failed`);
        }
      }

    } catch (error) {
      console.error('❌ [Download PDF] Error:', error);
      toast.error('Failed to fetch reports');
    }
  }, []);

  const handleDirectPrint = useCallback(async (study) => {
    try {
      const response = await api.get(`/reports/studies/${study._id}/report-ids`);

      if (!response.data.success || !response.data.data?.reports?.length) {
        toast.error('No finalized reports found');
        return;
      }

      const { reports, totalReports } = response.data.data;

      for (let i = 0; i < reports.length; i++) {
        const reportMeta = reports[i];
        if (i > 0) await new Promise(resolve => setTimeout(resolve, 1000));

        try {
          const pdfResponse = await api.get(
            `/reports/reports/${reportMeta.reportId}/print`,
            { responseType: 'blob', timeout: 60000 }
          );
          const blob = new Blob([pdfResponse.data], { type: 'application/pdf' });
          const url = window.URL.createObjectURL(blob);

          const printWindow = window.open(url, '_blank');
          if (printWindow) {
            printWindow.onload = () => {
              printWindow.focus();
              printWindow.print();
            };
          }
          setTimeout(() => window.URL.revokeObjectURL(url), 30000);
        } catch (err) {
          console.error(`❌ Failed to print report ${i + 1}:`, err);
          toast.error(`Print ${i + 1} failed`);
        }
      }

    } catch (error) {
      console.error('❌ [Print] Error:', error);
      toast.error('Failed to load reports for printing');
    }
  }, []);



  const handleDirectPrintDOCX = useCallback(async (study) => {
    try {
      const response = await api.get(`/reports/studies/${study._id}/report-ids`);

      if (!response.data.success || !response.data.data?.reports?.length) {
        toast.error('No finalized reports found');
        return;
      }

      const { reports, totalReports } = response.data.data;

      for (let i = 0; i < reports.length; i++) {
        const reportMeta = reports[i];
        if (i > 0) await new Promise(resolve => setTimeout(resolve, 800));

        try {
          const docxResponse = await api.get(
            `/reports/reports/${reportMeta.reportId}/download/docx`,
            { responseType: 'blob', timeout: 60000 }
          );

          const blob = new Blob([docxResponse.data], {
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          });
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${study.patientName || 'report'}_${study.bharatPacsId || study._id}_${i + 1}_of_${totalReports}.docx`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
        } catch (err) {
          console.error(`❌ Failed to download DOCX report ${i + 1}:`, err);
          toast.error(`DOCX ${i + 1} download failed`);
        }
      }

    } catch (error) {
      console.error('❌ [Download DOCX] Error:', error);
      toast.error('Failed to download DOCX files');
    }
  }, []);



  const handleLockToggle = async (e) => {
    e.stopPropagation();
    if (!canToggleLock) return;
    setTogglingLock(true);
    try {
      await onToggleLock(study._id, !isLocked);
    } catch (error) {
      toast.error('Failed to toggle study lock');
    } finally {
      setTogglingLock(false);
    }
  };

  // ✅ COMPACT & RESPONSIVE: Reduced all cell padding (px-1.5 py-2) and adjusted fonts for small viewports
  return (
    <tr className={rowClasses}>
      {/* 1. SELECTION */}
      <td className="px-1.5 py-2 sm:px-2 text-center border-r border-b border-slate-200 align-middle" style={{ width: `${getColumnWidth('selection')}px` }}>
        <input type="checkbox" checked={isSelected} onChange={() => onSelectStudy(study._id)} className="w-3.5 h-3.5 rounded border-slate-300 text-slate-800 focus:ring-slate-500 mt-1" />
      </td>

      {/* 2. BHARAT PACS ID */}
      {isColumnVisible('bharatPacsId') && (
        <td className="px-1.5 py-2 sm:px-2 text-center border-r border-b border-slate-200 align-middle" style={{ width: `${getColumnWidth('bharatPacsId')}px` }}>
          <div className="flex items-start justify-center gap-1">
            <span className="text-[10px] sm:text-xs font-mono font-semibold text-slate-700 whitespace-normal break-all leading-snug text-left" title={study.bharatPacsId}>
              {study.bharatPacsId !== 'N/A' ? study.bharatPacsId : study._id?.substring(0, 10)}
            </span>
            <button onClick={() => copyToClipboard(study.bharatPacsId !== 'N/A' ? study.bharatPacsId : study._id, 'BP ID')} className="p-0.5 sm:p-1 hover:bg-gray-200 rounded-md transition-colors flex-shrink-0">
              <Copy className="w-3 h-3 text-slate-500 hover:text-gray-900" />
            </button>
            {hasActiveViewers && (
              <div className="relative group flex-shrink-0" title={`Viewing: ${activeViewers.map(v => v.userName).join(', ')}`}>
                <Eye className="w-3.5 h-3.5 text-blue-600 animate-pulse mt-0.5" />
                <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-[8px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center">
                  {activeViewers.length}
                </span>
                <div className="absolute hidden group-hover:block bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded whitespace-nowrap z-50 shadow-lg border border-gray-700">
                  <div className="font-bold mb-1">👁️ Currently Viewing:</div>
                  {activeViewers.map((viewer) => <ViewerTimerRow key={viewer.userId} viewer={viewer} />)}
                </div>
              </div>
            )}
          </div>
        </td>
      )}


      {(userRoles.includes('super_admin') || userRole === 'super_admin') && (
        <td className="px-1.5 py-2 sm:px-2 border-r border-b border-slate-200" style={{ width: `${getColumnWidth('organization')}px` }}>
          <div className="text-[10px] sm:text-xs text-slate-600 truncate" title={study.organizationName}>{study.organizationName || '-'}</div>
        </td>
      )}

      {/* 4. CENTER NAME */}
      {isColumnVisible('centerName') && (
        <td className="px-1.5 py-2 sm:px-2 border-r border-b border-slate-200 align-middle" style={{ width: `${getColumnWidth('centerName')}px` }}>
          <div className="text-[10px] sm:text-xs font-bold text-center text-slate-900 whitespace-normal break-words leading-tight" title={study.centerName}>{study.centerName || '-'}</div>
        </td>
      )}

      {isColumnVisible('location') && (
        <td className="px-1.5 py-2 sm:px-2 border-r border-b border-slate-200 align-middle" style={{ width: `${getColumnWidth('centerName')}px` }}>
          <div className="text-[10px] sm:text-xs text-slate-600 text-center whitespace-normal break-words leading-snug">{study?.location || '-'}</div>
        </td>
      )}

      {/* 5. TIMELINE */}
      <td className="px-1.5 py-2 sm:px-2 text-center border-r border-b border-slate-200 align-middle" style={{ width: `${getColumnWidth('timeline')}px` }}>
        <button onClick={() => onShowTimeline?.(study)} className="p-1 sm:p-1.5 hover:bg-gray-200 rounded-lg transition-all hover:scale-110 mx-auto">
          <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-700" />
        </button>
      </td>

      {/* 6. PATIENT NAME / UHID */}
      {isColumnVisible('patientName') && (
        <td
          className="px-1.5 py-2 sm:px-2 border-r border-b border-slate-200 align-middle"
          style={{ width: `${getColumnWidth('patientName')}px` }}
        >
          <button
            className="w-full text-left hover:underline decoration-gray-900 mb-0.5"
            onClick={(e) => handleViewOnlyClick(e)}
          >
            <div
              className={`text-[10px] sm:text-xs font-bold ${isUrgent ? 'text-rose-600' : 'text-slate-800'
                } whitespace-normal break-all leading-tight flex items-start gap-1`}
              title={study.patientName}
            >
              {study.patientName || '-'}
              {isUrgent && (
                <span className="text-rose-500 mt-0.5 flex-shrink-0">●</span>
              )}
              {isRejected && (
                <span
                  className="text-rose-600 mt-0.5 flex-shrink-0"
                  title={`Rejected: ${rejectionReason}`}
                >
                  🚫
                </span>
              )}
            </div>

            <div
              className={`text-[9px] sm:text-[10px] ${isUrgent ? 'text-rose-400' : 'text-slate-500'
                } whitespace-normal break-all leading-tight mt-0.5`}
            >
              UHID: {study.accessionNumber || '-'}
            </div>
          </button>

          {getPriorityTag(study)}


          {/* ✅ NEW: Follow-up tag */}
          {study.followUp?.isFollowUp && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-300 mt-0.5">
              🔁 Follow-Up
              {study.followUp.followUpDate && (
                <span className="text-amber-500 font-normal ml-1">
                  {new Date(study.followUp.followUpDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                </span>
              )}
            </span>
          )}
        </td>
      )}

      {/* 7. AGE/SEX */}
      {isColumnVisible('ageGender') && (
        <td className="px-1.5 py-2 sm:px-2 text-center border-r border-b border-slate-200 align-middle" style={{ width: `${getColumnWidth('ageGender')}px` }}>
          <div className="text-[10px] sm:text-xs font-medium text-slate-700 whitespace-normal break-words leading-tight">
            {study.ageGender !== 'N/A' ? study.ageGender :
              study.patientAge && study.patientSex ? `${study.patientAge}/${study.patientSex.charAt(0)}` :
                study.patientAge && study.patientGender ? `${study.patientAge}/${study.patientGender.charAt(0)}` : '-'}
          </div>
        </td>
      )}

      {/* 8. MODALITY */}
      {isColumnVisible('modality') && (
        <td className="px-1.5 py-2 sm:px-2 text-center border-r border-b border-slate-200 align-middle" style={{ width: `${getColumnWidth('modality')}px` }}>
          <span className={`inline-block px-1.5 py-0.5 sm:px-2 sm:py-1 rounded text-[9px] sm:text-[10px] font-bold shadow-sm whitespace-normal break-words leading-tight ${isUrgent ? 'bg-rose-200 text-rose-700 border border-rose-200' : 'bg-gray-200 text-gray-900 border border-gray-300'}`}>
            {study.modality || '-'}
          </span>
        </td>
      )}

      {/* 9. VIEW & REPORTING */}
      <td className="px-1.5 py-2 sm:px-2 text-center border-r border-b border-slate-200 align-middle" style={{ width: `${getColumnWidth('viewOnly')}px` }}>
        <div className="relative flex items-center justify-center gap-0.5">
          <button onClick={handleViewOnlyClick} className="p-1 sm:p-1.5 hover:bg-gray-100 rounded-lg transition-all group hover:scale-110" title={`View Only — ${selectedViewer === 'viewer2' ? 'Viewer 2' : 'Viewer 1'}`}>
            <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-700 group-hover:text-gray-900" />
          </button>
          <div className="relative">
            <button
              className="p-0.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 transition-colors"
              onClick={(e) => { e.stopPropagation(); setShowViewerDropdownView(prev => !prev); setShowViewerDropdownReport(false); }}
            >
              <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
            </button>
            {showViewerDropdownView && (
              <div className="absolute left-full top-0 ml-1 bg-white border border-gray-200 rounded shadow-lg z-50 min-w-[80px]">
                {['viewer1', 'viewer2'].map(v => (
                  <button
                    key={v}
                    onClick={(e) => { e.stopPropagation(); setSelectedViewer(v); localStorage.setItem('preferredOhifViewer', v); setShowViewerDropdownView(false); }}
                    className={`w-full px-2 py-1.5 text-[9px] text-left hover:bg-gray-50 transition-colors ${selectedViewer === v ? 'font-bold text-blue-600 bg-blue-50' : 'text-gray-700'}`}
                  >
                    {v === 'viewer1' ? 'Viewer 1' : 'Viewer 2'}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </td>

      {isColumnVisible('reporting') && (
        <td className="px-1.5 py-2 sm:px-2 text-center border-r border-b border-slate-200 align-middle" style={{ width: `${getColumnWidth('reporting')}px` }}>
          <div className="relative flex items-center justify-center gap-0.5">
            <button
              onClick={handleOHIFReporting}
              disabled={study.workflowStatus === 'new_study_received' || !study.isAssigned || !study.radiologist}
              className={`p-1 sm:p-1.5 rounded-lg transition-all group ${study.workflowStatus === 'new_study_received' || !study.isAssigned
                ? 'opacity-40 cursor-not-allowed'
                : 'hover:bg-gray-100 hover:scale-110'
                }`}
              title={
                study.workflowStatus === 'new_study_received'
                  ? 'Available after study is received'
                  : !study.isAssigned
                    ? 'Available after assignment'
                    : `Open ${selectedViewer === 'viewer2' ? 'Viewer 2' : 'Viewer 1'} + Reporting`
              }
            >
              <Monitor className="w-4 h-4 text-emerald-600" />
            </button>
            <div className="relative">
              <button
                className="p-0.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 transition-colors"
                onClick={(e) => { e.stopPropagation(); setShowViewerDropdownReport(prev => !prev); setShowViewerDropdownView(false); }}
              >
                <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
              </button>
              {showViewerDropdownReport && (
                <div className="absolute left-full top-0 ml-1 bg-white border border-gray-200 rounded shadow-lg z-50 min-w-[80px]">
                  {['viewer1', 'viewer2'].map(v => (
                    <button
                      key={v}
                      onClick={(e) => { e.stopPropagation(); setSelectedViewer(v); localStorage.setItem('preferredOhifViewer', v); setShowViewerDropdownReport(false); }}
                      className={`w-full px-2 py-1.5 text-[9px] text-left hover:bg-gray-50 transition-colors ${selectedViewer === v ? 'font-bold text-blue-600 bg-blue-50' : 'text-gray-700'}`}
                    >
                      {v === 'viewer1' ? 'Viewer 1' : 'Viewer 2'}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </td>
      )}

      {/* 10. SERIES/IMAGES */}
      {isColumnVisible('seriesCount') && (
        <td className="px-1.5 py-2 sm:px-2 text-center border-r border-b border-slate-200 align-middle" style={{ width: `${getColumnWidth('studySeriesImages')}px` }}>
          <div className="text-[9px] sm:text-[10px] font-bold text-slate-900 break-words whitespace-normal leading-snug mb-0.5">{study.studyDescription || 'N/A'}</div>
          <div className="text-[10px] sm:text-xs font-semibold text-slate-800 whitespace-nowrap">S: {study.seriesCount || 0} / {study.instanceCount || 0}</div>
        </td>
      )}

      {/* 11. PT ID */}
      {isColumnVisible('patientId') && (
        <td className="px-1.5 py-2 sm:px-2 border-r border-b border-slate-200 align-middle" style={{ width: `${getColumnWidth('patientId')}px` }}>
          <button className="text-teal-600 hover:text-teal-700 font-semibold text-[10px] sm:text-xs hover:underline whitespace-normal break-all leading-tight text-center w-full" onClick={() => onPatienIdClick?.(study.patientId, study)}>
            {study.patientId || study.patientInfo?.patientID || 'N/A'}
          </button>
        </td>
      )}

      {/* 12. REFERRAL DOCTOR */}
      {isColumnVisible('referralDoctor') && (
        <td className="px-1.5 py-2 sm:px-2 border-r border-b border-slate-200 align-middle" style={{ width: `${getColumnWidth('referralDoctor')}px` }}>
          <div className="text-[10px] sm:text-xs text-slate-700 whitespace-normal break-words leading-tight">{study.referralNumber || study.referringPhysician || '-'}</div>
        </td>
      )}

      {/* 13. CLINICAL HISTORY & ATTACHMENTS */}
      {isColumnVisible('clinicalHistory') && (
        <td className="px-1.5 py-2 sm:px-2 border-r border-b border-slate-200 align-middle" style={{ width: `${getColumnWidth('clinicalHistory')}px` }}>
          <div className="text-[10px] sm:text-[11px] font-bold text-slate-700 whitespace-normal break-words leading-relaxed uppercase truncate max-h-12" title={study.clinicalHistory}>{study.clinicalHistory || '-'}</div>
          <div className="flex items-center flex-wrap gap-1 mt-1.5">
            <button onClick={() => onEditPatient?.(study)} className="flex items-center gap-0.5 text-[9px] font-medium text-slate-700 hover:text-slate-900 hover:underline">
              <Edit className="w-3 h-3" />Edit
            </button>
            <button onClick={() => onShowDocuments?.(study)} className={`p-1 rounded transition-all relative ${hasAttachments ? 'bg-slate-200' : 'hover:bg-slate-100'}`}>
              <Paperclip className={`w-3 h-3 ${hasAttachments ? 'text-slate-900' : 'text-slate-400'}`} />
              {hasAttachments && study.attachments.length > 0 && <span className="absolute -top-1 -right-1 bg-slate-900 text-white text-[8px] font-semibold rounded-full min-w-[12px] h-3 flex items-center justify-center">{study.attachments.length}</span>}
            </button>
            <button onClick={() => onShowStudyNotes?.(study._id)} className={`relative p-1 rounded transition-all group ${hasNotes ? 'bg-gray-200' : 'hover:bg-slate-100'}`}>
              <MessageSquare className={`w-3 h-3 ${hasNotes ? 'text-gray-900' : 'text-slate-400'}`} />
              {study.notesCount > 0 && <span className="absolute -top-1 -right-1 bg-gray-900 text-white text-[8px] font-bold rounded-full min-w-[12px] h-3 flex items-center justify-center">{study.notesCount}</span>}
            </button>
          </div>
        </td>
      )}

      {/* 14 & 15. DATES */}
      {isColumnVisible('studyTime') && (
        <td className="px-1.5 py-2 sm:px-2 text-center border-r border-b border-slate-200 align-middle" style={{ width: `${getColumnWidth('studyDateTime')}px` }}>
          <div className="text-[9px] sm:text-[10px] font-medium text-slate-800 whitespace-nowrap">{formatDate(study.studyDate)}</div>
          <div className="text-[8px] sm:text-[9px] text-slate-500 whitespace-nowrap mt-0.5">{formatTime(study.studyTime) || '-'}</div>
        </td>
      )}
      {isColumnVisible('uploadTime') && (
        <td className="px-1.5 py-2 sm:px-2 text-center border-r border-b border-slate-200 align-middle" style={{ width: `${getColumnWidth('uploadDateTime')}px` }}>
          <div className="text-[9px] sm:text-[10px] font-medium text-slate-800 whitespace-nowrap">{formatDate(study.uploadDate || study.createdAt)}</div>
          <div className="text-[8px] sm:text-[9px] text-slate-500 whitespace-nowrap mt-0.5">{study.uploadTime ? study.uploadTime.split(',')[2]?.trim() || study.uploadTime : formatTime(study.uploadDate || study.createdAt)}</div>
        </td>
      )}

      {/* 16. RADIOLOGIST */}
      {isColumnVisible('radiologist') && (
        <td className="px-1.5 py-2 sm:px-2 border-r border-b border-slate-200 align-middle" style={{ width: `${getColumnWidth('assignedRadiologist')}px` }}>
          <div className="relative">
            <input ref={assignInputRef} type="text" value={assignInputValue} onChange={(e) => setAssignInputValue(e.target.value)} onFocus={handleAssignInputFocus} onBlur={() => { setTimeout(() => { if (!showAssignmentModal) { setInputFocused(false); setAssignInputValue(isAssigned && study.radiologist ? study.radiologist : ''); } }, 200); }} placeholder={isLocked ? "🔒 Locked" : "Search..."} disabled={isLocked} className={`w-full px-1.5 py-1 text-[10px] sm:text-xs border rounded focus:ring-1 focus:ring-gray-900 transition-all ${isLocked ? 'bg-slate-200 cursor-not-allowed text-slate-500 border-gray-400' : isAssigned && !inputFocused ? 'bg-gray-200 border-gray-400 text-gray-900 font-medium' : 'bg-white border-slate-200'}`} />
            {isLocked && <Lock className="w-3 h-3 text-rose-600 absolute right-1.5 top-1.5" />}
          </div>

          {/* ✅ Show assignedAt time under input */}
          {isAssigned && assignedDoctor?.assignedAt && (
            <div className="mt-0.5 text-[8px] text-slate-500 whitespace-nowrap">
              🕐 {new Date(assignedDoctor.assignedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} {new Date(assignedDoctor.assignedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
            </div>
          )}

          {isAssigned && assignedDoctor && (
            <div className="mt-1 flex flex-wrap items-center justify-between gap-1">
              {isAssignedStatus && !isReportCompleted && elapsedTime ? (
                <div className="flex items-center gap-1 px-1 py-0.5 bg-amber-50 border border-amber-200 rounded text-[8px] sm:text-[9px] font-mono font-bold text-amber-700">
                  <Clock className="w-2.5 h-2.5 animate-pulse" /> {elapsedTime}
                </div>
              ) : null}
            </div>
          )}
        </td>
      )}


      {/* 17. LOCK/UNLOCK */}
      {isColumnVisible('studyLock') && (
        <td className="px-1.5 py-2 sm:px-2 text-center border-r border-slate-200 align-middle" style={{ width: `${getColumnWidth('studyLock')}px` }}>
          <button onClick={handleLockToggle} disabled={togglingLock || !canToggleLock} className={`p-1 sm:p-1.5 rounded-lg transition-all mx-auto group ${togglingLock ? 'opacity-50 cursor-not-allowed' : !canToggleLock ? 'opacity-30 cursor-not-allowed' : isLocked ? 'hover:bg-rose-50' : 'hover:bg-slate-100'}`} title={isLocked ? `Locked by ${study.studyLock?.lockedByName}` : 'Lock Study'}>
            {isLocked ? <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-600" /> : <Unlock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-500" />}
          </button>

          {/* ✅ Show lockedBy + lockedAt */}
          {isLocked && (
            <div className="mt-0.5 space-y-0.5">
              <div className="text-[8px] font-semibold text-rose-600 truncate max-w-[70px] mx-auto" title={study.studyLock?.lockedByName}>
                {study.studyLock?.lockedByName || study.lockedBy || '-'}
              </div>
              {(study.studyLock?.lockedAt || study.lockedAt) && (
                <div className="text-[7px] text-slate-500 whitespace-nowrap">
                  {new Date(study.studyLock?.lockedAt || study.lockedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}{' '}
                  {new Date(study.studyLock?.lockedAt || study.lockedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                </div>
              )}
            </div>
          )}
        </td>
      )}

      {/* 18. STATUS */}
      {isColumnVisible('caseStatus') && (
        <td className="px-1.5 py-2 sm:px-2 text-center border-r border-slate-200 align-middle" style={{ width: `${getColumnWidth('status')}px` }}>
          <div className="flex flex-col items-center gap-1">
            <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-medium whitespace-normal break-words leading-tight ${getStatusColor(study.workflowStatus)}`}>
              {study.caseStatusCategory || formatWorkflowStatus(study.workflowStatus)}
            </span>
            <span className="text-[11px] text-slate-600 whitespace-normal break-words leading-tight">
              {study.workflowStatus
                ? study.workflowStatus === 'report_completed'
                  ? 'Final'
                  : formatWorkflowStatus(study.workflowStatus)
                : '-'}
            </span>

            {/* ✅ Show when this status happened from statusHistory */}
            {(() => {
              const latestHistory = study.statusHistory?.length
                ? [...study.statusHistory].sort((a, b) => new Date(b.changedAt) - new Date(a.changedAt))[0]
                : null;
              if (!latestHistory?.changedAt) return null;
              return (
                <div className="text-[7px] text-slate-400 whitespace-nowrap" title={latestHistory.note || ''}>
                  {new Date(latestHistory.changedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}{' '}
                  {new Date(latestHistory.changedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                </div>
              );
            })()}
          </div>
        </td>
      )}


      {isColumnVisible('printCount') && (
        <td className="px-1.5 py-2 sm:px-2 text-center border-r border-b border-slate-200 align-middle" style={{ width: `${getColumnWidth('printCount')}px` }}>
          {['report_completed', 'final_report_downloaded', 'report_reprint_needed'].includes(study.workflowStatus) ? (
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-1 justify-center">
                <button onClick={() => onDirectPrint(study)} className="p-1 hover:bg-purple-50 rounded transition-all hover:scale-110" title="Print Report">
                  <Printer className="w-3.5 h-3.5 text-purple-600" />
                </button>
                <button onClick={() => handleDirectPrintDOCX(study)} className="p-1 hover:bg-blue-50 rounded transition-all hover:scale-110" title="Download DOCX">
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                </button>
                <button onClick={() => handleDirectDownloadPDF(study)} className="p-1 hover:bg-red-50 rounded transition-all hover:scale-110" title="Download PDF">
                  <Download className="w-3.5 h-3.5 text-red-500" />
                </button>
              </div>

              {/* ✅ NEW: Last download info */}
              {study.lastDownload?.downloadedAt ? (
                <div className="flex flex-col items-center gap-0.5">
                  <span className={`text-[8px] font-bold px-1 py-0.5 rounded ${study.lastDownload.downloadType === 'pdf' ? 'bg-red-50 text-red-600 border border-red-200' :
                    study.lastDownload.downloadType === 'docx' ? 'bg-blue-50 text-blue-600 border border-blue-200' :
                      'bg-purple-50 text-purple-600 border border-purple-200'
                    }`}>
                    {study.lastDownload.downloadType?.toUpperCase() || 'DL'}
                  </span>
                  <div className="text-[7px] text-slate-500 whitespace-nowrap">
                    {new Date(study.lastDownload.downloadedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}{' '}
                    {new Date(study.lastDownload.downloadedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                  </div>
                  <div className="text-[7px] text-slate-400 truncate max-w-[70px]" title={study.lastDownload.downloadedByName}>
                    {study.lastDownload.downloadedByName}
                  </div>
                </div>
              ) : (study.lastPrintedAt || study.printInfo?.lastPrintedAt) ? (
                <div className="text-[8px] text-slate-500 whitespace-nowrap">
                  {formatDate(study.lastPrintedAt || study.printInfo?.lastPrintedAt)}
                </div>
              ) : null}

              {/* Print count */}
              {printCount > 0 && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-slate-100 rounded text-[8px] font-medium text-slate-600">
                  {printCount} action{printCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          ) : (
            <span className="text-slate-300 text-xs">-</span>
          )}
        </td>
      )}





      {/* 22. REJECTION REASON */}
      {isColumnVisible('rejectionReason') && (
        <td className="px-3 py-3.5 border-r border-slate-200 align-center" style={{ width: `${getColumnWidth('rejectionReason')}px` }}>
          {(() => {
            // ✅ Priority 1: Rejection reason from verifier
            if (isRejected && rejectionReason && rejectionReason !== '-') {
              return (
                <div className="flex items-start gap-1.5">
                  <XCircle className="w-3.5 h-3.5 text-rose-600 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-rose-700 leading-relaxed font-medium whitespace-normal break-words" title={rejectionReason}>
                    {study.verificationNotes || rejectionReason}
                  </div>
                </div>
              );
            }

            // ✅ Priority 2: Revert info — ONLY if study is actively reverted
            const isActivelyReverted = study.revertInfo?.isReverted === true;
            const revert = isActivelyReverted
              ? (study.revertInfo?.currentRevert || study.revertInfo?.revertHistory?.[study.revertInfo.revertHistory.length - 1])
              : null;

            if (isActivelyReverted && revert) {
              return (
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <RotateCcw className="w-3 h-3 text-orange-600 flex-shrink-0" />
                    <span className="text-[9px] font-bold text-orange-700 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded">
                      REVERTED {study.revertInfo.revertCount > 1 ? `(×${study.revertInfo.revertCount})` : ''}
                    </span>
                    {revert.resolved && (
                      <span className="text-[9px] font-bold text-green-700 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded">✓ Resolved</span>
                    )}
                  </div>

                  {revert.reason && (
                    <div className="text-[10px] text-orange-800 font-medium leading-tight whitespace-normal break-words" title={revert.reason}>
                      "{revert.reason}"
                    </div>
                  )}

                  <div className="text-[9px] text-slate-500 whitespace-nowrap">
                    by <span className="font-semibold text-slate-700">{revert.revertedByName}</span>
                    {revert.revertedAt && (
                      <> · {new Date(revert.revertedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} {new Date(revert.revertedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}</>
                    )}
                  </div>

                  {revert.notes && (
                    <div className="text-[9px] text-slate-500 italic whitespace-normal break-words">
                      Note: {revert.notes}
                    </div>
                  )}
                </div>
              );
            }

            return <div className="text-xs text-slate-400 text-center">-</div>;
          })()}
        </td>
      )}




      {/* 20 & 21. VERIFIED INFO */}
      {isColumnVisible('caseStatus') && (
        <td className="px-1.5 py-2 text-center sm:px-2 border-r border-b border-slate-200 align-middle" style={{ width: `${getColumnWidth('assignedVerifier')}px` }}>
          <div className="text-[9px] sm:text-[10px] text-slate-700 whitespace-normal break-words leading-tight">{typeof study.verifier === 'string' ? study.verifier : study.verifier?.fullName || study.verifier?.email || study.reportInfo?.verificationInfo?.verifiedBy?.name || study.verifiedBy || '-'}</div>
        </td>
      )}
      {isColumnVisible('caseStatus') && (
        <td className="px-1.5 py-2 sm:px-2 text-center border-r border-b border-slate-200 align-middle" style={{ width: `${getColumnWidth('verifiedDateTime')}px` }}>
          <div className="text-[9px] font-medium text-slate-800 whitespace-nowrap">{(() => { const ts = study.reportInfo?.verificationInfo?.verifiedAt || study.verifiedAt; if (!ts) return '-'; try { return new Date(ts).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }); } catch { return '-'; } })()}</div>
          <div className="text-[9px] text-slate-500 whitespace-nowrap mt-0.5">{(() => { const ts = study.reportInfo?.verificationInfo?.verifiedAt || study.verifiedAt; if (!ts) return '-'; try { return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' }); } catch { return '-'; } })()}</div>
        </td>
      )}





      {isColumnVisible('actions') && (
        <td className="px-1.5 py-2 sm:px-2 text-center border-slate-200 align-middle" style={{ width: `${getColumnWidth('actions')}px` }}>
          {/* ✅ COMPACT & RESPONSIVE: Download + Share only (except super_admin) */}
          <div className="flex flex-wrap items-center justify-center gap-1 max-w-[100px] mx-auto">

            {/* ✅ Hide ALL actions for super_admin */}
            {!userAccountRoles.includes('super_admin') && (
              <>
                {/* Download Button */}
                <button
                  ref={downloadButtonRef}
                  onClick={handleDownloadClick}
                  className="p-1 hover:bg-blue-50 rounded transition-all hover:scale-110"
                  title="Download Options"
                >
                  <Download className="w-3.5 h-3.5 text-blue-600" />
                </button>

                {study.workflowStatus === 'verification_pending' && (
                  <button
                    className="px-1.5 py-1 text-[10px] font-semibold bg-green-600 text-white rounded hover:bg-green-700 transition-colors shadow-sm"
                    title="Open Reporting for Verification"
                    onClick={() => {
                      // ✅ Force verifier mode regardless of user role
                      const queryParams = new URLSearchParams({
                        openOHIF: 'true',
                        verifierMode: 'true',
                        action: 'verify'
                      });
                      window.open(`/online-reporting/${study._id}?${queryParams.toString()}`, '_blank');
                    }}
                  >
                    Verify
                  </button>
                )}

                {['report_completed', 'final_report_downloaded'].includes(study.workflowStatus) && (
                  <button
                    onClick={() => onShowRevertModal?.(study)}
                    className="p-1 hover:bg-rose-50 rounded transition-all hover:scale-110"
                    title="Revert to Radiologist"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                  </button>
                )}

                <button
                  onClick={() => onViewReport?.(study)}
                  className="p-2 hover:bg-purple-50 rounded-lg transition-all group hover:scale-110"
                  title="View Report"
                >
                  <FileText className="w-4 h-4 text-purple-600 group-hover:text-purple-700" />
                </button>

                {/* Share Button */}
                <button
                  onClick={() => setShareModal(true)}
                  className="p-1 hover:bg-sky-50 rounded transition-all hover:scale-110"
                  title="Share Study (Secure Link)"
                >
                  <Share2 className="w-3.5 h-3.5 text-sky-600" />
                </button>

                {/* ✅ Workflow Status Change Dropdown — admin/assignor only */}
                {(userAccountRoles.includes('admin') || userAccountRoles.includes('assignor')) && (
                  <div className="relative">
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowStatusDropdown(prev => !prev); }}
                      disabled={changingStatus}
                      className="p-1 hover:bg-amber-50 rounded transition-all hover:scale-110"
                      title="Change Workflow Status"
                    >
                      <Edit className="w-3.5 h-3.5 text-amber-600" />
                    </button>
                    {showStatusDropdown && (
                      <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-[9999] min-w-[160px] max-h-[200px] overflow-y-auto">
                        {WORKFLOW_STATUS_OPTIONS.map(opt => (
                          <button
                            key={opt.value}
                            onClick={(e) => { e.stopPropagation(); handleWorkflowStatusChange(opt.value); }}
                            disabled={study.workflowStatus === opt.value || changingStatus}
                            className={`w-full px-2.5 py-1.5 text-left text-[9px] font-medium hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-b-0 ${study.workflowStatus === opt.value ? 'bg-gray-100 text-gray-900 font-bold' : 'text-gray-700'}`}
                          >
                            {study.workflowStatus === opt.value && '✓ '}{opt.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {isSuperAdmin && (
              <button
                onClick={() => onShowDeleteModal?.(study)}
                className="p-1 hover:bg-red-50 rounded transition-all hover:scale-110"
                title="Delete Study (Super Admin Only)"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-600" />
              </button>
            )}

            {/* Message for super_admin */}
            {userAccountRoles.includes('super_admin') && (
              <div className="text-[8px] text-slate-400">-</div>
            )}
          </div>
        </td>
      )}

      {showDownloadOptions && <DownloadOptions study={study} isOpen={showDownloadOptions} onClose={() => setShowDownloadOptions(false)} position={downloadPosition} />}
      {showAssignmentModal && <AssignmentModal study={study} availableAssignees={availableAssignees} onSubmit={handleAssignmentSubmit} onClose={handleCloseAssignmentModal} position={assignmentModalPosition} searchTerm={assignInputValue} />}
      {shareModal && (
        <ShareModal
          study={study}
          isOpen={shareModal}
          onClose={() => setShareModal(false)}
        />
      )}
    </tr>
  );
};

const TableFooter = ({ pagination, onPageChange, onRecordsPerPageChange, displayedRecords, loading, queryCallNumber = '', onQueryCallNumberChange, isAdmin = false }) => {
  const { currentPage, totalPages, totalRecords, recordsPerPage, hasNextPage, hasPrevPage } = pagination;
  const recordsPerPageOptions = [10, 25, 50, 100];
  const startRecord = totalRecords === 0 ? 0 : ((currentPage - 1) * recordsPerPage) + 1;
  const endRecord = Math.min(currentPage * recordsPerPage, totalRecords);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(queryCallNumber);

  return (
    <div className="sticky bottom-0 bg-white border-t border-gray-200 px-3 py-1 z-20">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-1 sm:gap-2">

        <div className="flex items-center gap-2 text-[10px] text-gray-600">
          <span>
            <span className="font-semibold text-gray-800">{startRecord}-{endRecord}</span>
            <span className="text-gray-400 mx-1">/</span>
            <span className="font-semibold text-gray-900">{totalRecords.toLocaleString()}</span>
          </span>
          <div className="h-3 w-px bg-gray-300 hidden sm:block" />
          <select value={recordsPerPage} onChange={(e) => onRecordsPerPageChange(Number(e.target.value))} className="px-1.5 py-0.5 text-[10px] font-medium bg-gray-50 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-gray-400">
            {recordsPerPageOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-1">
          <button onClick={() => onPageChange(currentPage - 1)} disabled={!hasPrevPage} className={`p-1 rounded ${hasPrevPage ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-400'}`}><ChevronLeft className="w-3 h-3" /></button>
          <div className="flex items-center gap-1 text-[10px] text-gray-600">
            <span>Page</span>
            <input type="number" min="1" max={totalPages} value={currentPage} onChange={(e) => { const p = parseInt(e.target.value); if (p >= 1 && p <= totalPages) onPageChange(p); }} className="w-8 px-1 py-0.5 text-center border border-gray-200 rounded text-[10px] focus:outline-none focus:ring-1 focus:ring-gray-400" />
            <span>of {totalPages}</span>
          </div>
          <button onClick={() => onPageChange(currentPage + 1)} disabled={!hasNextPage} className={`p-1 rounded ${hasNextPage ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-400'}`}><ChevronRight className="w-3 h-3" /></button>
        </div>

        <div className="flex items-center gap-2 text-[9px] text-gray-500">
          {loading && <div className="w-2 h-2 border border-gray-600 border-t-transparent rounded-full animate-spin" />}
          {queryCallNumber ? (
            <div>
              For any query call: <span className="font-semibold text-gray-900">{queryCallNumber}</span>
              {isAdmin && (
                <button onClick={() => { setEditing(true); setEditValue(queryCallNumber); }} className="ml-1 text-gray-400 hover:text-gray-700">✎</button>
              )}
            </div>
          ) : isAdmin ? (
            <button onClick={() => { setEditing(true); setEditValue(''); }} className="text-gray-400 hover:text-gray-700 underline">Set query call number</button>
          ) : null}
          {editing && (
            <div className="flex items-center gap-1">
              <input
                type="text" autoFocus value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="w-28 px-1.5 py-0.5 text-[10px] border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400"
                placeholder="e.g. 9876543210"
                onKeyDown={(e) => { if (e.key === 'Enter') { onQueryCallNumberChange?.(editValue); setEditing(false); } if (e.key === 'Escape') setEditing(false); }}
              />
              <button onClick={() => { onQueryCallNumberChange?.(editValue); setEditing(false); }} className="text-[10px] px-1.5 py-0.5 bg-gray-900 text-white rounded">Save</button>
              <button onClick={() => setEditing(false)} className="text-[10px] px-1 py-0.5 text-gray-500">✕</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const WorklistTable = ({
  studies = [], loading = false, selectedStudies = [], onSelectAll, onSelectStudy, onPatienIdClick, onAssignDoctor, availableAssignees = { radiologists: [], verifiers: [] }, onAssignmentSubmit, onUpdateStudyDetails, userRole = 'viewer', userRoles = [], onRefreshStudies, onToggleStudyLock, pagination = { currentPage: 1, totalPages: 1, totalRecords: 0, recordsPerPage: 50, hasNextPage: false, hasPrevPage: false }, onPageChange, onRecordsPerPageChange, headerColor, columnConfig = null, queryCallNumber = '', onQueryCallNumberChange, isAdmin = false
}) => {
  const userAccountRoles = userRoles.length > 0 ? userRoles : [userRole];

  const isColumnVisible = useCallback((key) => {
    if (!columnConfig) return true;
    return columnConfig[key]?.visible !== false;
  }, [columnConfig]);

  const { columnWidths, getColumnWidth, handleColumnResize, resetColumnWidths } = useColumnResizing(
    `admin-worklist-widths`,
    []
  );

  const [multiAssignModal, setMultiAssignModal] = useState({ show: false });
  const [duplicateModal, setDuplicateModal] = useState({ show: false });
  const [duplicating, setDuplicating] = useState(false);
  const [duplicateResult, setDuplicateResult] = useState(null);

  const handleDuplicateStudy = useCallback(async () => {
    if (selectedStudies.length !== 1) {
      toast.error('Please select exactly one study to duplicate');
      return;
    }
    setDuplicating(true);
    setDuplicateResult(null);
    try {
      const response = await api.post(`/admin/studies/${selectedStudies[0]}/duplicate`);
      if (response.data.success) {
        setDuplicateResult(response.data.data);
        toast.success(`Study duplicated! New ID: ${response.data.data.duplicatedBharatPacsId}`);
        onRefreshStudies?.();
      } else {
        toast.error(response.data.message || 'Failed to duplicate study');
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to duplicate study');
    } finally {
      setDuplicating(false);
    }
  }, [selectedStudies, onRefreshStudies]);

  const handleMultiAssignSuccess = useCallback(() => {
    setMultiAssignModal({ show: false });
    selectedStudies.forEach(id => onSelectStudy?.(id));
    window.dispatchEvent(new CustomEvent('studies-updated'));
  }, [selectedStudies, onSelectStudy]);

  const [activeViweres, setActiveViewers] = useState({});
  const { sendMessage, lastMessage, readyState } = useWebSocket();

  const [detailedView, setDetailedView] = useState({ show: false, studyId: null });
  const [reportModal, setReportModal] = useState({ show: false, studyId: null, studyData: null });
  const [studyNotes, setStudyNotes] = useState({ show: false, studyId: null });
  const [patientEditModal, setPatientEditModal] = useState({ show: false, study: null });
  const [timelineModal, setTimelineModal] = useState({ show: false, studyId: null, studyData: null });
  const [documentsModal, setDocumentsModal] = useState({ show: false, studyId: null });
  const [revertModal, setRevertModal] = useState({ show: false, study: null });
  const [printModal, setPrintModal] = useState({ show: false, report: null, reports: [] });
  // ✅ Viewer preference — persisted in localStorage

  useEffect(() => {
    if (readyState === WebSocket.OPEN) {
      sendMessage({ type: 'subscribe_to_viewer_updates' });
      sendMessage({ type: 'request_active_viewers' });
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
              ...prev, [studyId]: [...viewers, {
                userId: message.data.userId,
                userName: message.data.userName,
                mode: message.data.mode,
                // ✅ FIX: Use openedAt from server message, fallback to now
                openedAt: message.data.openedAt || new Date().toISOString()
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
          if (viewers.length === 0) { const { [studyId]: removed, ...rest } = prev; return rest; }
          return { ...prev, [studyId]: viewers };
        });
        break;
      case 'active_viewers_list':
        setActiveViewers(message.data);
        break;
    }
  }, [lastMessage]);

  //Delete modal and stuff

  const [deleteModal, setDeleteModal] = useState({ show: false, studies: [] });


  const handleShowDeleteModal = useCallback((study) => {
    setDeleteModal({ show: true, studies: [study] });
  }, []);

  // ✅ ADD this handler for bulk delete
  const handleBulkDelete = useCallback(() => {
    if (selectedStudies.length === 0) return;
    const studiesToDelete = studies.filter(s => selectedStudies.includes(s._id));
    setDeleteModal({ show: true, studies: studiesToDelete });
  }, [selectedStudies, studies]);

  const handleDeleteSuccess = useCallback(() => {
    setDeleteModal({ show: false, studies: [] });
    selectedStudies.forEach(id => onSelectStudy?.(id));
    onRefreshStudies?.();
  }, [onRefreshStudies, selectedStudies, onSelectStudy]);

  const handleShowTimeline = useCallback((study) => setTimelineModal({ show: true, studyId: study._id, studyData: study }), []);
  const handleShowDetailedView = useCallback((studyId) => setDetailedView({ show: true, studyId }), []);
  const handleViewReport = useCallback((study) => setReportModal({ show: true, studyId: study._id, studyData: { patientName: study.patientName, patientId: study.patientId } }), []);
  const handleShowStudyNotes = useCallback((studyId) => setStudyNotes({ show: true, studyId }), []);
  const handleViewStudy = useCallback((study) => handleShowDetailedView(study._id), [handleShowDetailedView]);
  const handleShowRevertModal = useCallback((study) => setRevertModal({ show: true, study }), []);


  const handleRevertSuccess = useCallback(() => {
    setRevertModal({ show: false, study: null });
    onRefreshStudies?.();
  }, [onRefreshStudies]);


  // const handleDirectPrint = useCallback(async (study) => {
  //   try {
  //     const loadingToast = toast.loading('Loading report...', { icon: '🖨️' });

  //     // Step 1: Get reports for study (same endpoint ReportModal uses)
  //     const response = await api.get(`/reports/studies/${study._id}/reports`);

  //     if (!response.data.success || !response.data.data?.reports?.length) {
  //       toast.dismiss(loadingToast);
  //       toast.error('No report found for this study');
  //       return;
  //     }

  //     // Step 2: Pick latest finalized report
  //     const reports = response.data.data.reports;
  //     const latestReport =
  //       reports.find(r => r.reportStatus === 'finalized') || reports[0];

  //     if (!latestReport) {
  //       toast.dismiss(loadingToast);
  //       toast.error('No finalized report available');
  //       return;
  //     }

  //     toast.dismiss(loadingToast);

  //     // Step 3: Open PrintModal with reportId (same as DOCX flow)
  //     setPrintModal({ show: true, report: latestReport });

  //   } catch (error) {
  //     console.error('❌ [Print] Error:', error);
  //     toast.error('Failed to load report for printing');
  //   }
  // }, []);

  const handleClosePrintModal = useCallback(() => setPrintModal({ show: false, report: null, reports: [] }), []);
  const handleEditPatient = useCallback((study) => setPatientEditModal({ show: true, study }), []);
  const handleSavePatientEdit = useCallback(async (formData) => { await onUpdateStudyDetails?.(formData); setPatientEditModal({ show: false, study: null }); }, [onUpdateStudyDetails]);
  const handleShowDocuments = useCallback((study) => setDocumentsModal({ show: true, studyId: study?._id || null, studyMeta: { patientId: study?.patientId || study?.patientInfo?.patientID || study?.patient?.PatientID || '', patientName: study?.patientName || study?.patientInfo?.patientName || study?.patient?.PatientName || '' } }), []);




  const handleDirectPrint = useCallback(async (study) => {
    try {
      const response = await api.get(`/reports/studies/${study._id}/report-ids`);

      if (!response.data.success || !response.data.data?.reports?.length) {
        toast.error('No finalized reports found');
        return;
      }

      const { reports } = response.data.data;

      setPrintModal({
        show: true,
        report: null,
        reports: reports.map(r => ({
          _id: r.reportId,
          reportId: r.reportId,
          patientInfo: { fullName: study.patientName },
          doctorId: { fullName: r.doctorName }
        }))
      });

    } catch (error) {
      console.error('❌ [Print] Error:', error);
      toast.error('Failed to load reports for printing');
    }
  }, []);

  const handleCloseDocuments = useCallback(() => {
    setDocumentsModal({ show: false, studyId: null, studyMeta: null });
    onRefreshStudies?.();  // ✅ Trigger refresh
  }, [onRefreshStudies]);

  // ✅ UPDATED: Refresh on close
  const handleCloseStudyNotes = useCallback(() => {
    setStudyNotes({ show: false, studyId: null });
    onRefreshStudies?.();  // ✅ Trigger refresh
  }, [onRefreshStudies]);



  const handleToggleStudyLock = useCallback(async (studyId, shouldLock) => {
    try {
      const response = await api.post(`/admin/toggle-study-lock/${studyId}`, { shouldLock });
      if (response.data.success) onToggleStudyLock?.(studyId, shouldLock);
      else throw new Error(response.data.message || 'Failed to toggle lock');
    } catch (error) { throw error; }
  }, [onToggleStudyLock]);

  if (loading) return (
    <div className="flex-1 h-full min-h-[400px] flex items-center justify-center bg-gradient-to-b from-slate-50 to-white">
      <div className="flex flex-col items-center gap-4">
        {/* Pit container — clips the image so it looks like it's emerging from below */}
        <div
          style={{
            width: 90,
            height: 100,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <img
            src="/bharatHalf.png"
            alt="Loading"
            style={{
              width: 80,
              height: 80,
              objectFit: 'contain',
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
              animation: 'pitRise 2s ease-in-out infinite',
            }}
          />
        </div>

        {/* Loading text with pulse */}
        <p
          className="text-sm font-semibold text-slate-500 tracking-wide"
          style={{ animation: 'pulse 2s ease-in-out infinite' }}
        >
          Loading studies...
        </p>

        {/* Shimmer bar */}
        <div
          style={{
            width: 120,
            height: 3,
            borderRadius: 4,
            background: 'linear-gradient(90deg, transparent 0%, #0d9488 50%, transparent 100%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s linear infinite',
          }}
        />

        {/* Inline keyframes */}
        <style>{`
          @keyframes pitRise {
            0%   { top: 100%; }
            35%  { top: 10%;  }
            42%  { transform: translateX(-50%) scale(1.15); }
            50%  { transform: translateX(-50%) scale(1); top: 10%; }
            85%  { top: 100%; }
            100% { top: 100%; }
          }
          @keyframes shimmer {
            0%   { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
        `}</style>
      </div>
    </div>
  );
  if (studies.length === 0) return <div className="flex-1 flex items-center justify-center"><div className="text-center text-gray-500"><svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg><h3 className="text-lg font-medium mb-2">No studies found</h3></div></div>;

  return (
    <div className="w-full h-full flex flex-col bg-white rounded-xl shadow-lg border-2 border-gray-300 relative">
      {selectedStudies.length > 0 && (
        <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 bg-blue-600 text-white text-[10px] sm:text-xs font-semibold border-b border-blue-700 flex-shrink-0 z-20">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-white text-blue-700 flex items-center justify-center text-[9px] sm:text-[11px] font-bold">{selectedStudies.length}</div>
            <span>{selectedStudies.length} selected</span>
          </div>
          <div className="h-3 sm:h-4 w-px bg-blue-400" />
          {(userAccountRoles.includes('admin') || userAccountRoles.includes('assignor')) && (
            <button onClick={() => setMultiAssignModal({ show: true })} className="flex items-center gap-1 px-2 py-1 bg-white text-blue-700 rounded hover:bg-blue-50 transition-colors font-bold">
              <Users className="w-3 h-3" /> <span className="hidden sm:inline">Multi-Assign</span><span className="sm:hidden">Assign</span>
            </button>
          )}

          {(userAccountRoles.includes('admin') || userAccountRoles.includes('super_admin')) && selectedStudies.length === 1 && (
            <button onClick={() => { setDuplicateResult(null); setDuplicateModal({ show: true }); }} className="flex items-center gap-1 px-2 py-1 bg-white text-purple-700 rounded hover:bg-purple-50 transition-colors font-bold">
              <Copy className="w-3 h-3" /> <span className="hidden sm:inline">Duplicate Study</span><span className="sm:hidden">Duplicate</span>
            </button>
          )}

          {userAccountRoles.includes('super_admin') && (
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-1 px-2 py-1 bg-red-700 text-white rounded hover:bg-red-800 transition-colors font-bold"
            >
              <Trash2 className="w-3 h-3" />
              Delete {selectedStudies.length}
            </button>
          )}

          <div className="ml-auto">
            <button onClick={() => selectedStudies.forEach(id => onSelectStudy?.(id))} className="text-blue-200 hover:text-white transition-colors">Clear</button>
          </div>
        </div>
      )}

      {/* ✅ COMPACT & RESPONSIVE: Kept overflow-x-auto so massive tables just horizontal scroll smoothly */}
      <div style={{ flex: '1 1 0%', height: 0, minHeight: '500px', overflowX: 'auto', overflowY: 'auto', width: '100%', WebkitOverflowScrolling: 'touch' }}>
        <table className="border-collapse" style={{ fontFamily: 'system-ui, -apple-system, sans-serif', width: 'max-content', minWidth: '2400px' }}>
          <thead className="sticky top-0 z-10 bg-white">
            <tr className="text-[10px] sm:text-xs font-semibold border-b-2 border-gray-200" style={headerColor?.css ? { backgroundImage: headerColor.css, color: '#ffffff' } : { backgroundColor: '#f9fafb', color: '#374151' }}>
              {/* Note: I'm leaving the ResizableTableHeader widths intact as they rely on your hooks/constants */}
              <ResizableTableHeader columnId="selection" label="" width={getColumnWidth('selection')} onResize={handleColumnResize} minWidth={UNIFIED_WORKLIST_COLUMNS.SELECTION.minWidth} maxWidth={UNIFIED_WORKLIST_COLUMNS.SELECTION.maxWidth}>
                <input type="checkbox" checked={studies.length > 0 && selectedStudies.length === studies.length} onChange={(e) => onSelectAll?.(e.target.checked)} className="w-3.5 h-3.5 rounded border-white/30" />
              </ResizableTableHeader>

              {isColumnVisible('bharatPacsId') && <ResizableTableHeader columnId="bharatPacsId" label={<>RADIVUE<br />PACS ID</>} width={getColumnWidth('bharatPacsId')} onResize={handleColumnResize} minWidth={UNIFIED_WORKLIST_COLUMNS.BHARAT_PACS_ID.minWidth} maxWidth={UNIFIED_WORKLIST_COLUMNS.BHARAT_PACS_ID.maxWidth} />}
              {(userRoles.includes('super_admin') || userRole === 'super_admin') && <ResizableTableHeader columnId="organization" label="ORGANIZATION" width={getColumnWidth('organization')} onResize={handleColumnResize} minWidth={UNIFIED_WORKLIST_COLUMNS.ORGANIZATION.minWidth} maxWidth={UNIFIED_WORKLIST_COLUMNS.ORGANIZATION.maxWidth} />}
              {isColumnVisible('centerName') && <ResizableTableHeader columnId="centerName" label={<>CENTER<br />NAME</>} width={getColumnWidth('centerName')} onResize={handleColumnResize} minWidth={UNIFIED_WORKLIST_COLUMNS.CENTER_NAME.minWidth} maxWidth={UNIFIED_WORKLIST_COLUMNS.CENTER_NAME.maxWidth} />}
              {isColumnVisible('location') && <ResizableTableHeader columnId="location" label={<>Location<br />NAME</>} width={getColumnWidth('location')} onResize={handleColumnResize} minWidth={UNIFIED_WORKLIST_COLUMNS.CENTER_NAME.minWidth} maxWidth={UNIFIED_WORKLIST_COLUMNS.CENTER_NAME.maxWidth} />}
              <ResizableTableHeader columnId="timeline" label="" width={getColumnWidth('timeline')} onResize={handleColumnResize} minWidth={UNIFIED_WORKLIST_COLUMNS.TIMELINE.minWidth} maxWidth={UNIFIED_WORKLIST_COLUMNS.TIMELINE.maxWidth}><Clock className="w-4 h-4 mx-auto" /></ResizableTableHeader>
              {isColumnVisible('patientName') && <ResizableTableHeader columnId="patientName" label={<>PT NAME /<br />UHID</>} width={getColumnWidth('patientName')} onResize={handleColumnResize} minWidth={UNIFIED_WORKLIST_COLUMNS.PATIENT_NAME.minWidth} maxWidth={UNIFIED_WORKLIST_COLUMNS.PATIENT_NAME.maxWidth} />}
              {isColumnVisible('ageGender') && <ResizableTableHeader columnId="ageGender" label={<>AGE/<br />SEX</>} width={getColumnWidth('ageGender')} onResize={handleColumnResize} minWidth={UNIFIED_WORKLIST_COLUMNS.AGE_GENDER.minWidth} maxWidth={UNIFIED_WORKLIST_COLUMNS.AGE_GENDER.maxWidth} />}
              {isColumnVisible('modality') && <ResizableTableHeader columnId="modality" label="MODALITY" width={getColumnWidth('modality')} onResize={handleColumnResize} minWidth={UNIFIED_WORKLIST_COLUMNS.MODALITY.minWidth} maxWidth={UNIFIED_WORKLIST_COLUMNS.MODALITY.maxWidth} />}
              <ResizableTableHeader columnId="viewOnly" label="VIEW" width={getColumnWidth('viewOnly')} onResize={handleColumnResize} minWidth={UNIFIED_WORKLIST_COLUMNS.VIEW_ONLY.minWidth} maxWidth={UNIFIED_WORKLIST_COLUMNS.VIEW_ONLY.maxWidth}><Eye className="w-4 h-4 mx-auto" /></ResizableTableHeader>
              <ResizableTableHeader columnId="Reporting" label="Reporting" width={getColumnWidth('viewOnly')} onResize={handleColumnResize} minWidth={UNIFIED_WORKLIST_COLUMNS.VIEW_ONLY.minWidth} maxWidth={UNIFIED_WORKLIST_COLUMNS.VIEW_ONLY.maxWidth}><Monitor className="w-4 h-4 mx-auto text-emerald-400" /></ResizableTableHeader>
              {isColumnVisible('seriesCount') && <ResizableTableHeader columnId="studySeriesImages" label={<>SERIES/<br />IMAGES</>} width={getColumnWidth('studySeriesImages')} onResize={handleColumnResize} minWidth={UNIFIED_WORKLIST_COLUMNS.STUDY_SERIES_IMAGES.minWidth} maxWidth={UNIFIED_WORKLIST_COLUMNS.STUDY_SERIES_IMAGES.maxWidth} />}
              {isColumnVisible('patientId') && <ResizableTableHeader columnId="patientId" label="PT ID" width={getColumnWidth('patientId')} onResize={handleColumnResize} minWidth={UNIFIED_WORKLIST_COLUMNS.PATIENT_ID.minWidth} maxWidth={UNIFIED_WORKLIST_COLUMNS.PATIENT_ID.maxWidth} />}
              {isColumnVisible('referralDoctor') && <ResizableTableHeader columnId="referralDoctor" label={<>REFERRAL<br />DOCTOR</>} width={getColumnWidth('referralDoctor')} onResize={handleColumnResize} minWidth={UNIFIED_WORKLIST_COLUMNS.REFERRAL_DOCTOR.minWidth} maxWidth={UNIFIED_WORKLIST_COLUMNS.REFERRAL_DOCTOR.maxWidth} />}
              {isColumnVisible('clinicalHistory') && <ResizableTableHeader columnId="clinicalHistory" label={<>CLINICAL<br />HISTORY</>} width={getColumnWidth('clinicalHistory')} onResize={handleColumnResize} minWidth={UNIFIED_WORKLIST_COLUMNS.CLINICAL_HISTORY.minWidth} maxWidth={UNIFIED_WORKLIST_COLUMNS.CLINICAL_HISTORY.maxWidth} />}
              {isColumnVisible('studyTime') && <ResizableTableHeader columnId="studyDateTime" label={<>STUDY<br />DATE/TIME</>} width={getColumnWidth('studyDateTime')} onResize={handleColumnResize} minWidth={UNIFIED_WORKLIST_COLUMNS.STUDY_DATE_TIME.minWidth} maxWidth={UNIFIED_WORKLIST_COLUMNS.STUDY_DATE_TIME.maxWidth} />}
              {isColumnVisible('uploadTime') && <ResizableTableHeader columnId="uploadDateTime" label={<>UPLOAD<br />DATE/TIME</>} width={getColumnWidth('uploadDateTime')} onResize={handleColumnResize} minWidth={UNIFIED_WORKLIST_COLUMNS.UPLOAD_DATE_TIME.minWidth} maxWidth={UNIFIED_WORKLIST_COLUMNS.UPLOAD_DATE_TIME.maxWidth} />}
              {isColumnVisible('radiologist') && <ResizableTableHeader columnId="assignedRadiologist" label="RADIOLOGIST" width={getColumnWidth('assignedRadiologist')} onResize={handleColumnResize} minWidth={UNIFIED_WORKLIST_COLUMNS.ASSIGNED_RADIOLOGIST.minWidth} maxWidth={UNIFIED_WORKLIST_COLUMNS.ASSIGNED_RADIOLOGIST.maxWidth} />}
              {isColumnVisible('studyLock') && <ResizableTableHeader columnId="studyLock" label={<>LOCK/<br />UNLOCK</>} width={getColumnWidth('studyLock')} onResize={handleColumnResize} minWidth={UNIFIED_WORKLIST_COLUMNS.STUDY_LOCK.minWidth} maxWidth={UNIFIED_WORKLIST_COLUMNS.STUDY_LOCK.maxWidth} />}

              {isColumnVisible('studyLock') && <ResizableTableHeader columnId="status" label="STATUS" width={getColumnWidth('status')} onResize={handleColumnResize} minWidth={UNIFIED_WORKLIST_COLUMNS.STATUS.minWidth} maxWidth={UNIFIED_WORKLIST_COLUMNS.STATUS.maxWidth} />}



              {isColumnVisible('printCount') && <ResizableTableHeader columnId="printCount" label={<>PRINT<br />REPORT</>} width={getColumnWidth('printCount')} onResize={handleColumnResize} minWidth={UNIFIED_WORKLIST_COLUMNS.PRINT_COUNT.minWidth} maxWidth={UNIFIED_WORKLIST_COLUMNS.PRINT_COUNT.maxWidth} />}
              {isColumnVisible('rejectionReason') && <ResizableTableHeader columnId="rejectionReason" label="Reverted Reason" width={getColumnWidth('rejectionReason')} onResize={handleColumnResize} minWidth={UNIFIED_WORKLIST_COLUMNS.REJECTION_REASON.minWidth} maxWidth={UNIFIED_WORKLIST_COLUMNS.REJECTION_REASON.maxWidth} />}
              {isColumnVisible('assignedVerifier') && <ResizableTableHeader columnId="assignedVerifier" label={<>FINALISED<br />BY</>} width={getColumnWidth('assignedVerifier')} onResize={handleColumnResize} minWidth={UNIFIED_WORKLIST_COLUMNS.ASSIGNED_VERIFIER.minWidth} maxWidth={UNIFIED_WORKLIST_COLUMNS.ASSIGNED_VERIFIER.maxWidth} />}
              {isColumnVisible('verifiedDateTime') && <ResizableTableHeader columnId="verifiedDateTime" label={<>FINALISED<br />DATE/TIME</>} width={getColumnWidth('verifiedDateTime')} onResize={handleColumnResize} minWidth={UNIFIED_WORKLIST_COLUMNS.VERIFIED_DATE_TIME.minWidth} maxWidth={UNIFIED_WORKLIST_COLUMNS.VERIFIED_DATE_TIME.maxWidth} />}
              {isColumnVisible('actions') && <ResizableTableHeader columnId="actions" label="ACTIONS" width={getColumnWidth('actions')} onResize={handleColumnResize} minWidth={UNIFIED_WORKLIST_COLUMNS.ACTIONS.minWidth} maxWidth={UNIFIED_WORKLIST_COLUMNS.ACTIONS.maxWidth} />}
            </tr>
          </thead>
          <tbody>
            {sortStudiesByPriority(studies).map((study, index) => (
              <StudyRow key={study._id} study={study} activeViewers={activeViweres[study._id] || []} index={index} selectedStudies={selectedStudies} availableAssignees={availableAssignees} onSelectStudy={onSelectStudy} onPatienIdClick={onPatienIdClick} onAssignDoctor={onAssignDoctor} onShowDetailedView={handleShowDetailedView} onViewReport={handleViewReport} onShowStudyNotes={handleShowStudyNotes} onViewStudy={handleViewStudy} onEditPatient={handleEditPatient} onAssignmentSubmit={onAssignmentSubmit} onShowTimeline={handleShowTimeline} onToggleLock={handleToggleStudyLock} onShowDocuments={handleShowDocuments} onShowRevertModal={handleShowRevertModal} setPrintModal={setPrintModal} userRole={userRole} userRoles={userAccountRoles} getColumnWidth={getColumnWidth} isColumnVisible={isColumnVisible} onShowDeleteModal={handleShowDeleteModal} onDirectPrint={handleDirectPrint} onRefreshStudies={onRefreshStudies} />
            ))}
          </tbody>
        </table>
      </div>

      {studies.length > 0 && <TableFooter pagination={pagination} onPageChange={onPageChange} onRecordsPerPageChange={onRecordsPerPageChange} displayedRecords={studies.length} loading={loading} queryCallNumber={queryCallNumber} onQueryCallNumberChange={onQueryCallNumberChange} isAdmin={isAdmin} />}

      {deleteModal.show && (
        <DeleteStudyModal
          isOpen={deleteModal.show}
          onClose={() => setDeleteModal({ show: false, studies: [] })}
          studies={deleteModal.studies}
          onSuccess={handleDeleteSuccess}
        // setSelectedStudies={setSelectedStudies}  // ✅ ADD THIS LINE

        />
      )}

      {multiAssignModal.show && <MultiAssignModal isOpen={multiAssignModal.show} onClose={() => setMultiAssignModal({ show: false })} selectedStudies={studies.filter(s => selectedStudies.includes(s._id))} availableAssignees={availableAssignees} onSuccess={handleMultiAssignSuccess} />}
      {detailedView.show && <StudyDetailedView studyId={detailedView.studyId} onClose={() => setDetailedView({ show: false, studyId: null })} />}
      {reportModal.show && <ReportModal isOpen={reportModal.show} studyId={reportModal.studyId} studyData={reportModal.studyData} onShowPrintModal={handleDirectPrint} onClose={() => setReportModal({ show: false, studyId: null, studyData: null })} />}
      {studyNotes.show && <StudyNotesComponent studyId={studyNotes.studyId} isOpen={studyNotes.show} onClose={handleCloseStudyNotes}  // ✅ CHANGED
      />}
      {patientEditModal.show && <PatientEditModal study={patientEditModal.study} isOpen={patientEditModal.show} onClose={() => setPatientEditModal({ show: false, study: null })} onSave={handleSavePatientEdit} onRefreshStudies={onRefreshStudies} />}
      {timelineModal.show && <TimelineModal isOpen={timelineModal.show} onClose={() => setTimelineModal({ show: false, studyId: null, studyData: null })} studyId={timelineModal.studyId} studyData={timelineModal.studyData} />}

      {documentsModal.show && <StudyDocumentsManager studyId={documentsModal.studyId} studyMeta={documentsModal.studyMeta} isOpen={documentsModal.show}
        onClose={handleCloseDocuments} />}


      {revertModal.show && <RevertModal isOpen={revertModal.show} study={revertModal.study} onClose={() => setRevertModal({ show: false, study: null })} onSuccess={handleRevertSuccess} />}
      {/* {printModal.show && <PrintModal report={printModal.report} onClose={handleClosePrintModal} />} */}

      {printModal.show && (
        <PrintModal
          report={printModal.report}
          reports={printModal.reports}
          onClose={handleClosePrintModal}
        />
      )}

      {/* ✅ DUPLICATE STUDY MODAL */}
      {duplicateModal.show && (
        <>
          <div className="fixed inset-0 z-[300] bg-black/50" onClick={() => { setDuplicateModal({ show: false }); setDuplicateResult(null); }} />
          <div className="fixed z-[310] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-2xl border border-gray-200 w-[480px]">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 bg-purple-50 border-b border-purple-100 rounded-t-xl">
              <div className="flex items-center gap-2">
                <Copy className="w-4 h-4 text-purple-600" />
                <span className="text-sm font-bold text-purple-900">Duplicate Study</span>
              </div>
              <button onClick={() => { setDuplicateModal({ show: false }); setDuplicateResult(null); }} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-4">
              {!duplicateResult ? (
                <div className="space-y-3">
                  {(() => {
                    const selectedStudy = studies.find(s => selectedStudies.includes(s._id));
                    return selectedStudy ? (
                      <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-xs">
                        <div className="flex justify-between"><span className="text-gray-500">BharatPacs ID:</span><span className="font-semibold">{selectedStudy.bharatPacsId}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">Patient:</span><span className="font-semibold">{selectedStudy.patientInfo?.patientName || 'Unknown'}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">Modality:</span><span className="font-semibold">{selectedStudy.modality || 'N/A'}</span></div>
                      </div>
                    ) : null;
                  })()}
                  <p className="text-xs text-gray-500">
                    This will create a duplicate of the selected study with a new BharatPacs ID. The original study will be marked as duplicated.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-green-600 mb-2">
                    <CheckCircle className="w-5 h-5" />
                    <span className="text-sm font-bold">Study Duplicated Successfully!</span>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3 space-y-1 text-xs">
                    <div className="flex justify-between"><span className="text-gray-500">Original ID:</span><span className="font-semibold">{duplicateResult.originalBharatPacsId}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">New ID:</span><span className="font-bold text-purple-700">{duplicateResult.duplicatedBharatPacsId}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Patient:</span><span className="font-semibold">{duplicateResult.patientName}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Modality:</span><span className="font-semibold">{duplicateResult.modality}</span></div>
                  </div>
                  {/* Viewer URL */}
                  {duplicateResult.studyInstanceUID && (
                    <div className="flex gap-2 mt-2">
                      <a
                        href={`https://viewer.xcentic.com/viewer?StudyInstanceUIDs=${encodeURIComponent(duplicateResult.studyInstanceUID)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <Eye className="w-3 h-3" /> Open in Viewer
                      </a>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(`https://viewer.xcentic.com/viewer?StudyInstanceUIDs=${encodeURIComponent(duplicateResult.studyInstanceUID)}`);
                          toast.success('Viewer URL copied!');
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        <Link className="w-3 h-3" /> Copy Link
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100 rounded-b-xl bg-gray-50">
              <button
                onClick={() => { setDuplicateModal({ show: false }); setDuplicateResult(null); }}
                className="px-4 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100"
              >
                {duplicateResult ? 'Close' : 'Cancel'}
              </button>
              {!duplicateResult && (
                <button
                  onClick={handleDuplicateStudy}
                  disabled={duplicating}
                  className="px-4 py-1.5 text-xs font-bold bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  <Copy className="w-3 h-3" />
                  {duplicating ? 'Duplicating...' : 'Duplicate Study'}
                </button>
              )}
            </div>
          </div>
        </>
      )}


    </div>
  );
};

export default WorklistTable;