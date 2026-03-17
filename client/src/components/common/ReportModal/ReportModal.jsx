import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, FileText, Calendar, Clock, AlertCircle, CheckCircle, RefreshCw, ExternalLink, Monitor, Edit, File, Trash2, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../services/api';
import { useAuth } from '../../../hooks/useAuth'; // ✅ AD

const ReportModal = ({ 
  isOpen, 
  onClose, 
  studyId, 
  studyData = null,
  onShowPrintModal,
  userRoles = [],
  userRole = ''
}) => {
  const navigate = useNavigate();
  const { currentUser } = useAuth(); // ✅ ADD — get directly from auth context

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');

  // ✅ FIX: Read roles from auth context directly — don't trust props alone
  const resolvedRoles = [
    ...(userRoles || []),
    ...(currentUser?.accountRoles || []),
    ...(currentUser?.roles || []),
    userRole,
    currentUser?.role,
    currentUser?.primaryRole
  ].filter(Boolean).map(r => r.toString().toLowerCase());

  // ✅ SINGLE SOURCE OF TRUTH
  const isLabStaff = resolvedRoles.includes('lab_staff');
  
  const canEdit      = !isLabStaff;
  const canDelete    = !isLabStaff;
  const canRename    = !isLabStaff;
  const canCreateNew = !isLabStaff;

  useEffect(() => {
    if (isOpen && studyId) {
      fetchReports();
    }
  }, [isOpen, studyId]);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/reports/studies/${studyId}/reports`);
      if (response.data.success) {
        setReports(response.data.data.reports);
      } else {
        throw new Error(response.data.message || 'Failed to load reports');
      }
    } catch (err) {
      console.error('Error fetching reports:', err);
      setError('Failed to load reports');
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [studyId]);

  const handleDeleteReport = useCallback(async (reportId) => {
    try {
      setDeletingId(reportId);
      await api.delete(`/reports/reports/${reportId}`);
      toast.success('Report deleted');
      setReports(prev => prev.filter(r => r._id !== reportId));
      setConfirmDeleteId(null);
    } catch (error) {
      toast.error('Failed to delete report');
    } finally {
      setDeletingId(null);
    }
  }, []);

  const handleStartRename = useCallback((report) => {
    setRenamingId(report._id);
    setRenameValue(report.filename?.replace(/\.[^/.]+$/, '') || '');
  }, []);

  const handleConfirmRename = useCallback(async (report) => {
    if (!renameValue.trim()) return;
    try {
      const res = await api.patch(`/reports/reports/${report._id}/rename`, { filename: renameValue.trim() });
      toast.success('Report renamed');
      setReports(prev => prev.map(r => r._id === report._id ? { ...r, filename: res.data.data.filename } : r));
      setRenamingId(null);
    } catch (error) {
      toast.error('Failed to rename report');
    }
  }, [renameValue]);

  const handleEditReport = useCallback((report) => {
    if (!studyId) return;
    onClose();
    navigate(`/online-reporting/${studyId}?reportId=${report._id}&action=edit`);
  }, [studyId, navigate, onClose]);

  const handleOnlineReporting = useCallback(() => {
    if (!studyId) return;
    onClose();
    navigate(`/online-reporting/${studyId}`);
  }, [studyId, navigate, onClose]);

  const handleOnlineReportingWithOHIF = useCallback(() => {
    if (!studyId) return;
    onClose();
    navigate(`/online-reporting/${studyId}?openOHIF=true`);
  }, [studyId, navigate, onClose]);

  const handleRefresh = useCallback(() => {
    fetchReports();
  }, [fetchReports]);

  // Utility functions
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit'
    });
  };

  // ✅ UPDATED BADGE STYLES: Minimalist Black/White/Green
  const getStatusBadge = (status, verificationType = null) => {
    if (verificationType === 'verified') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-green-100 text-green-700 border border-green-200">
          <CheckCircle className="w-3 h-3" />
          VERIFIED
        </span>
      );
    }
    switch (status) {
      case 'finalized':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-700 border border-gray-300">
            <CheckCircle className="w-3 h-3" />
            FINALIZED
          </span>
        );
      case 'draft':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-white text-gray-500 border border-gray-200 border-dashed">
            <Clock className="w-3 h-3" />
            DRAFT
          </span>
        );
      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 font-sans antialiased">
      {/* Container: Max width restricted for compactness */}
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden border border-gray-100 flex flex-col max-h-[85vh]">
        
        {/* ✅ HEADER: Minimalist, White & Black */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex flex-col">
            <h2 className="text-lg font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <FileText className="w-5 h-5 text-gray-900" />
              Medical Reports
            </h2>
            <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
              <span className="font-medium text-gray-700">{studyData?.patientName || 'Unknown Patient'}</span>
              <span className="text-gray-300">|</span>
              <span className="font-mono">{studyId ? studyId.substring(0, 12) : 'N/A'}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="p-2 text-gray-400 hover:text-black hover:bg-gray-50 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-black hover:bg-gray-50 rounded-lg transition-colors"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ✅ CONTENT: Scrollable Area */}
        <div className="flex-1 overflow-y-auto bg-white p-2">
          
          {loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-gray-200 border-t-black rounded-full animate-spin mb-3"></div>
              <span className="text-xs text-gray-500 font-medium">Loading records...</span>
            </div>
          )}

          {error && !loading && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <AlertCircle className="w-8 h-8 text-gray-300 mb-2" />
              <p className="text-sm text-gray-600 mb-3">{error}</p>
              <button onClick={handleRefresh} className="text-xs font-semibold text-black underline">Retry</button>
            </div>
          )}

          {!loading && !error && reports.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                <File className="w-5 h-5 text-gray-400" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900">No Reports Found</h3>
              <p className="text-xs text-gray-500 mb-5 max-w-xs mx-auto">
                Start by creating a new report for this patient study.
              </p>
              <button
                onClick={handleOnlineReporting}
                className="px-4 py-2 bg-black text-white text-xs font-medium rounded-lg hover:bg-gray-800 transition-colors shadow-sm"
              >
                Create First Report
              </button>
            </div>
          )}

          {/* ✅ REPORT LIST */}
          {!loading && !error && reports.length > 0 && (
            <div className="space-y-1">
              {reports.map((report) => (
                <div
                  key={report._id}
                  className="group flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-all duration-200"
                >
                  {/* Left: Info */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-gray-600 group-hover:text-black transition-colors" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h4 className="text-sm font-semibold text-gray-900 truncate max-w-[200px]" title={report.filename}>
                          {report.filename}
                        </h4>
                        {getStatusBadge(report.reportStatus, report.verificationStatus)}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {formatDate(report.uploadedAt)}
                        </span>
                        <span className="text-gray-300">|</span>
                        <span>{formatFileSize(report.size)}</span>
                        <span className="text-gray-300">|</span>
                        <span className="truncate max-w-[100px]">{report.uploadedBy}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-1 pl-2">

                    {renamingId === report._id ? (
                      <div className="flex items-center gap-1">
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={e => setRenameValue(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleConfirmRename(report); if (e.key === 'Escape') setRenamingId(null); }}
                          className="px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-gray-900 w-40"
                        />
                        <button onClick={() => handleConfirmRename(report)} className="px-2 py-1 bg-gray-900 text-white text-[10px] rounded hover:bg-black">Save</button>
                        <button onClick={() => setRenamingId(null)} className="px-2 py-1 bg-white border border-gray-200 text-gray-600 text-[10px] rounded hover:bg-gray-50">Cancel</button>
                      </div>
                    ) : confirmDeleteId === report._id ? (
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-red-600 font-medium">Delete?</span>
                        <button
                          onClick={() => handleDeleteReport(report._id)}
                          disabled={deletingId === report._id}
                          className="px-2 py-1 bg-red-600 text-white text-[10px] rounded hover:bg-red-700 disabled:opacity-50"
                        >
                          {deletingId === report._id ? '...' : 'Yes'}
                        </button>
                        <button onClick={() => setConfirmDeleteId(null)} className="px-2 py-1 bg-white border border-gray-200 text-gray-600 text-[10px] rounded hover:bg-gray-50">No</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                        {canEdit && (
                          <button onClick={() => handleEditReport(report)} className="p-1.5 text-gray-500 hover:text-black hover:bg-white rounded border border-transparent hover:border-gray-200 transition-all" title="Edit">
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canRename && (
                          <button onClick={() => handleStartRename(report)} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded border border-transparent hover:border-blue-200 transition-all" title="Rename">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canDelete && (
                          <button onClick={() => setConfirmDeleteId(report._id)} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded border border-transparent hover:border-red-200 transition-all" title="Delete">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}

                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ✅ FOOTER */}
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between shrink-0">
          <span className="text-xs text-gray-500 font-medium">
            {reports.length > 0 ? `${reports.length} Document${reports.length !== 1 ? 's' : ''}` : ''}
          </span>

          {/* ✅ Lab staff: ONLY close button — no New Report, no Report+OHIF */}
          {isLabStaff ? (
            <button onClick={onClose} className="flex items-center gap-2 px-3 py-1.5 bg-black text-white text-xs font-semibold rounded-lg hover:bg-gray-800 transition-all shadow-sm">
              Close
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button onClick={handleOnlineReporting} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm">
                <ExternalLink className="w-3.5 h-3.5" />
                New Report
              </button>
              <button onClick={handleOnlineReportingWithOHIF} className="flex items-center gap-2 px-3 py-1.5 bg-black text-white text-xs font-semibold rounded-lg hover:bg-gray-800 transition-all shadow-sm group">
                <Monitor className="w-3.5 h-3.5 group-hover:text-green-400 transition-colors" />
                Report + OHIF
              </button>
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
};

export default ReportModal;