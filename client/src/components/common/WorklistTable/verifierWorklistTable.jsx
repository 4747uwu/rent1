import React, { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { CheckCircle, XCircle, FileText, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
// ✅ Import modals
import StudyDetailedView from '../PatientDetailedView';
import ReportModal from '../ReportModal/ReportModal';

// ✅ UTILITY FUNCTIONS
const getStatusColor = (status) => {
  switch (status) {
    case 'report_finalized':
    case 'report_drafted':
      return 'bg-blue-100 text-blue-700 border border-blue-200';
    case 'verification_in_progress':
      return 'bg-yellow-100 text-yellow-700 border border-yellow-200';
    case 'report_verified':
      return 'bg-green-100 text-green-700 border border-green-200';
    case 'report_rejected':
      return 'bg-red-100 text-red-700 border border-red-200';
    default:
      return 'bg-gray-100 text-gray-700 border border-gray-200';
  }
};

const formatWorkflowStatus = (status) => {
  switch (status) {
    case 'report_finalized': return 'Finalized';
    case 'report_drafted': return 'Drafted';
    case 'verification_in_progress': return 'Verifying';
    case 'report_verified': return 'Verified';
    case 'report_rejected': return 'Rejected';
    default: return status || 'Unknown';
  }
};

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleDateString('en-US', { 
      month: 'short', 
      day: '2-digit',
      year: 'numeric'
    });
  } catch {
    return 'N/A';
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

// ✅ PAGINATION FOOTER COMPONENT (matching doctor table)
const TableFooter = ({ pagination, onPageChange, onRecordsPerPageChange }) => {
  const { currentPage, totalPages, totalRecords, recordsPerPage, hasNextPage, hasPrevPage } = pagination;

  const recordsPerPageOptions = [10, 25, 50, 100];

  const handlePrevPage = () => {
    if (hasPrevPage) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (hasNextPage) {
      onPageChange(currentPage + 1);
    }
  };

  const handlePageInput = (e) => {
    const page = parseInt(e.target.value);
    if (page >= 1 && page <= totalPages) {
      onPageChange(page);
    }
  };

  const startRecord = totalRecords === 0 ? 0 : ((currentPage - 1) * recordsPerPage) + 1;
  const endRecord = Math.min(currentPage * recordsPerPage, totalRecords);

  return (
    <div className="sticky bottom-0 bg-gradient-to-r from-teal-50 to-cyan-50 border-t-2 border-teal-200 px-4 py-3 flex items-center justify-between shadow-lg z-20">
      {/* Left: Records info */}
      <div className="flex items-center space-x-4">
        <span className="text-sm text-teal-700 font-medium">
          Showing <span className="font-bold text-teal-900">{startRecord}</span> to{' '}
          <span className="font-bold text-teal-900">{endRecord}</span> of{' '}
          <span className="font-bold text-teal-900">{totalRecords}</span> records
        </span>

        <div className="flex items-center space-x-2">
          <label htmlFor="recordsPerPage" className="text-sm text-teal-700 font-medium">
            Show:
          </label>
          <select
            id="recordsPerPage"
            value={recordsPerPage}
            onChange={(e) => onRecordsPerPageChange(Number(e.target.value))}
            className="px-3 py-1.5 text-sm border border-teal-300 rounded-lg bg-white text-teal-900 focus:outline-none focus:ring-2 focus:ring-teal-500 hover:border-teal-400 transition-colors"
          >
            {recordsPerPageOptions.map((option) => (
              <option key={option} value={option}>
                {option} per page
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Right: Pagination controls */}
      <div className="flex items-center space-x-2">
        <button
          onClick={handlePrevPage}
          disabled={!hasPrevPage}
          className={`p-2 rounded-lg transition-all ${
            hasPrevPage
              ? 'bg-teal-600 hover:bg-teal-700 text-white shadow-md hover:shadow-lg'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
          title="Previous Page"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-2">
          <span className="text-sm text-teal-700 font-medium">Page</span>
          <input
            type="number"
            min="1"
            max={totalPages}
            value={currentPage}
            onChange={handlePageInput}
            className="w-16 px-2 py-1.5 text-center text-sm border border-teal-300 rounded-lg bg-white text-teal-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <span className="text-sm text-teal-700 font-medium">of {totalPages}</span>
        </div>

        <button
          onClick={handleNextPage}
          disabled={!hasNextPage}
          className={`p-2 rounded-lg transition-all ${
            hasNextPage
              ? 'bg-teal-600 hover:bg-teal-700 text-white shadow-md hover:shadow-lg'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
          title="Next Page"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

// ✅ STUDY ROW COMPONENT
const StudyRow = ({ 
  study, 
  index,
  isSelected,
  onSelectStudy,
  onShowDetailedView,
  onViewReport,
  onOpenOHIFReporting
}) => {
  const isEmergency = study.priority === 'EMERGENCY';
  
  const rowClasses = `
    ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}
    ${isSelected ? 'bg-blue-50 border-blue-200' : ''}
    ${isEmergency ? 'border-l-4 border-l-red-500 bg-red-50/30' : ''}
    hover:bg-teal-50/50 transition-all duration-200 border-b border-slate-100
  `;

  const handleUserIconClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onShowDetailedView(study._id);
  };

  return (
    <tr className={rowClasses}>
      {/* CHECKBOX */}
      <td className="px-3 py-3 text-center border-r border-slate-200" style={{ width: '50px' }}>
        <input
          type="checkbox"
          className="w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
          checked={isSelected}
          onChange={() => onSelectStudy(study._id)}
        />
      </td>

      {/* PATIENT ID */}
      <td className="px-3 py-3 border-r border-slate-200" style={{ width: '120px' }}>
        <button 
          className="text-teal-600 hover:text-teal-700 font-semibold text-xs hover:underline"
          onClick={handleUserIconClick}
        >
          {study.patientId || study.patientInfo?.patientID || 'N/A'}
          {isEmergency && (
            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-red-600 text-white">
              🚨
            </span>
          )}
        </button>
      </td>

      {/* PATIENT NAME */}
      <td className="px-3 py-3 border-r border-slate-200" style={{ width: '160px' }}>
        <div className={`text-xs font-semibold ${isEmergency ? 'text-red-900' : 'text-slate-800'} truncate`}>
          {study.patientName || study.patientInfo?.patientName || 'Unknown Patient'}
        </div>
      </td>

      {/* AGE/SEX */}
      <td className="px-3 py-3 text-center border-r border-slate-200" style={{ width: '80px' }}>
        <div className="text-xs text-slate-600">
          {study.patientInfo?.age || 'N/A'} / {study.patientInfo?.gender || 'N/A'}
        </div>
      </td>

      {/* MODALITY */}
      <td className="px-3 py-3 text-center border-r border-slate-200" style={{ width: '80px' }}>
        <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${
          isEmergency ? 'bg-red-600 text-white' : 'bg-blue-100 text-blue-700 border border-blue-200'
        }`}>
          {study.modality || 'N/A'}
        </span>
      </td>

      {/* STUDY DATE */}
      <td className="px-3 py-3 text-center border-r border-slate-200" style={{ width: '120px' }}>
        <div className="text-xs font-medium text-slate-800">{formatDate(study.studyDate)}</div>
        <div className="text-xs text-slate-500">{formatTime(study.studyDate)}</div>
      </td>

      {/* REPORTED DATE */}
      <td className="px-3 py-3 text-center border-r border-slate-200" style={{ width: '120px' }}>
        {study.reportInfo?.finalizedAt || study._raw?.reportInfo?.finalizedAt ? (
          <>
            <div className="text-xs font-medium text-slate-800">
              {formatDate(study.reportInfo?.finalizedAt || study._raw?.reportInfo?.finalizedAt)}
            </div>
            <div className="text-xs text-slate-500">
              {formatTime(study.reportInfo?.finalizedAt || study._raw?.reportInfo?.finalizedAt)}
            </div>
          </>
        ) : (
          <div className="text-xs text-gray-400">Not reported</div>
        )}
      </td>

      {/* REPORTED BY */}
      <td className="px-3 py-3 border-r border-slate-200" style={{ width: '140px' }}>
        <div className="text-xs">
          {(() => {
            if (study.reportedBy) {
              return <div className="font-medium text-slate-800 truncate">Dr. {study.reportedBy}</div>;
            }
            if (study._raw?.reportInfo?.reporterName) {
              return <div className="font-medium text-slate-800 truncate">{study._raw.reportInfo.reporterName}</div>;
            }
            if (study._raw?._reportCreator?.fullName) {
              return <div className="font-medium text-slate-800 truncate">{study._raw._reportCreator.fullName}</div>;
            }
            if (study._raw?.assignment?.[0]?.assignedTo?.fullName) {
              return <div className="font-medium text-slate-800 truncate">{study._raw.assignment[0].assignedTo.fullName}</div>;
            }
            return <div className="text-gray-400">N/A</div>;
          })()}
        </div>
      </td>

      {/* VERIFIED DATE */}
      <td className="px-3 py-3 text-center border-r border-slate-200" style={{ width: '120px' }}>
        {study._raw?.reportInfo?.verificationInfo?.verifiedAt ? (
          <>
            <div className="text-xs font-medium text-slate-800">
              {formatDate(study._raw.reportInfo.verificationInfo.verifiedAt)}
            </div>
            <div className="text-xs text-slate-500">
              {formatTime(study._raw.reportInfo.verificationInfo.verifiedAt)}
            </div>
          </>
        ) : (
          <div className="text-xs text-gray-400">Not verified</div>
        )}
      </td>

      {/* VERIFIED BY */} 
      <td className="px-3 py-3 border-r border-slate-200" style={{ width: '140px' }}>
        <div className="text-xs">
          {(() => {
            if (study.verifiedBy) {
              return <div className="font-medium text-slate-800 truncate">{study.verifiedBy}</div>;
            }
            const verifiedBy = study._raw?.reportInfo?.verificationInfo?.verifiedBy;
            if (verifiedBy && typeof verifiedBy === 'object' && verifiedBy.fullName) {
              return <div className="font-medium text-slate-800 truncate">{verifiedBy.fullName}</div>;
            }
            if (verifiedBy && typeof verifiedBy === 'string') {
              return <div className="font-medium text-slate-800 truncate">User {verifiedBy.substring(0, 8)}...</div>;
            }
            return <div className="text-gray-400">N/A</div>;
          })()}
        </div>
      </td>

      {/* VERIFICATION STATUS */}
      <td className="px-3 py-3 text-center border-r border-slate-200" style={{ width: '120px' }}>
        <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${getStatusColor(study.workflowStatus)}`}>
          {formatWorkflowStatus(study.workflowStatus)}
        </span>
      </td>

      {/* ACTIONS */}
      <td className="px-3 py-3 text-center" style={{ width: '150px' }}>
        <div className="flex items-center justify-center gap-2">
          {/* View Report */}
          <button 
            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors" 
            title="View Report"
            onClick={() => onViewReport(study)}
          >
            <FileText className="w-4 h-4" />
          </button>

          {/* DICOM Viewer */}
          <button 
            className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-md transition-colors" 
            title="DICOM Viewer"
            onClick={() => {
              const ohifUrl = `/ohif/viewer?StudyInstanceUIDs=${study.studyInstanceUID || study._id}`;
              window.open(ohifUrl, '_blank');
            }}
          >
            <Eye className="w-4 h-4" />
          </button>

          {/* OHIF + Reporting */}
          {['report_finalized', 'report_drafted'].includes(study.workflowStatus) && (
            <button 
              className="px-2.5 py-1.5 text-xs font-semibold bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors shadow-sm" 
              title="Open OHIF + Reporting for Verification"
              onClick={() => onOpenOHIFReporting(study)}
            >
              Verify
            </button>
          )}

          {/* Status Indicators */}
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
    </tr>
  );
};

// ✅ MAIN COMPONENT
const VerifierWorklistTable = ({ 
  studies = [], 
  loading = false, 
  selectedStudies = [],
  onSelectAll, 
  onSelectStudy,
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
  const navigate = useNavigate();
  
  // ✅ Detailed view state
  const [detailedView, setDetailedView] = useState({
    show: false,
    studyId: null
  });

  // ✅ Report modal state
  const [reportModal, setReportModal] = useState({
    show: false,
    studyId: null,
    studyData: null
  });

  // ✅ Handlers
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
        patientName: study.patientName || study.patientInfo?.patientName,
        patientId: study.patientId || study.patientInfo?.patientID,
        studyDate: study.studyDate,
        modality: study.modality
      }
    });
  }, []);

  const handleCloseReportModal = useCallback(() => {
    setReportModal({ show: false, studyId: null, studyData: null });
  }, []);
const handleOpenOHIFReporting = useCallback((study) => {
  console.log('🌐 [Verifier] Opening OHIF + Reporting for verification:', study._id);
  
  // ✅ FIXED: Pass correct query parameters that OnlineReportingSystemWithOHIF expects
  navigate(`/online-reporting/${study._id}?openOHIF=true&verifierMode=true&action=verify`, {
    state: { 
      study: study,
      studyInstanceUID: study.studyInstanceUID || study._id
    }
  });
  
  toast.success('Opening OHIF + Reporting for verification...', { 
    icon: '🔍',
    duration: 3000
  });
}, [navigate]);

  const allSelected = studies?.length > 0 && selectedStudies?.length === studies?.length;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-teal-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600 text-sm font-medium">Loading verification queue...</p>
        </div>
      </div>
    );
  }

  if (studies.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-gray-500">
          <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No studies found</h3>
          <p className="text-sm">No reports available for verification</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      
      {/* ✅ TABLE */}
      <div className="flex-1 overflow-auto relative">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gradient-to-r from-teal-600 via-teal-700 to-cyan-700 sticky top-0 z-10 shadow-lg">
            <tr className="text-white text-xs font-bold">
              <th className="px-3 py-4 text-center border-r border-teal-500/30" style={{ width: '50px' }}>
                <input 
                  type="checkbox" 
                  className="w-4 h-4 rounded border-white/30 bg-white/10 text-teal-200 focus:ring-teal-300"
                  checked={allSelected}
                  onChange={(e) => onSelectAll?.(e.target.checked)}
                />
              </th>
              <th className="px-3 py-4 text-center border-r border-teal-500/30" style={{ width: '120px' }}>PATIENT ID</th>
              <th className="px-3 py-4 text-center border-r border-teal-500/30" style={{ width: '160px' }}>PATIENT NAME</th>
              <th className="px-3 py-4 text-center border-r border-teal-500/30" style={{ width: '80px' }}>AGE/SEX</th>
              <th className="px-3 py-4 text-center border-r border-teal-500/30" style={{ width: '80px' }}>MODALITY</th>
              <th className="px-3 py-4 text-center border-r border-teal-500/30" style={{ width: '120px' }}>STUDY<br/>DATE/TIME</th>
              <th className="px-3 py-4 text-center border-r border-teal-500/30" style={{ width: '120px' }}>REPORTED<br/>DATE/TIME</th>
              <th className="px-3 py-4 text-center border-r border-teal-500/30" style={{ width: '140px' }}>REPORTED BY</th>
              <th className="px-3 py-4 text-center border-r border-teal-500/30" style={{ width: '120px' }}>VERIFIED<br/>DATE/TIME</th>
              <th className="px-3 py-4 text-center border-r border-teal-500/30" style={{ width: '140px' }}>VERIFIED BY</th>
              <th className="px-3 py-4 text-center border-r border-teal-500/30" style={{ width: '120px' }}>STATUS</th>
              <th className="px-3 py-4 text-center" style={{ width: '150px' }}>ACTIONS</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {studies.map((study, index) => (
              <StudyRow
                key={study._id}
                study={study}
                index={index}
                isSelected={selectedStudies?.includes(study._id)}
                onSelectStudy={onSelectStudy}
                onShowDetailedView={handleShowDetailedView}
                onViewReport={handleViewReport}
                onOpenOHIFReporting={handleOpenOHIFReporting}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* ✅ PAGINATION FOOTER */}
      <TableFooter
        pagination={pagination}
        onPageChange={onPageChange}
        onRecordsPerPageChange={onRecordsPerPageChange}
      />

      {/* ✅ MODALS */}
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
    </div>
  );
};

export default VerifierWorklistTable;