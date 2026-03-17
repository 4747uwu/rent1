import React, { useState, useEffect, useRef } from 'react';
import { X, FileText, Eye, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../services/api';

const VerifyModal = ({ isOpen, onClose, studyId, studyData, onVerifyComplete }) => {
  const [activeTab, setActiveTab] = useState('report');
  const [reportData, setReportData] = useState(null);
  const [studyInfo, setStudyInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verificationNotes, setVerificationNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [corrections, setCorrections] = useState([]);
  const [reportSource, setReportSource] = useState(null);
  const ohifIframeRef = useRef(null);

  // ✅ UPDATED: Use the verifier-specific endpoint
  useEffect(() => {
    if (isOpen && studyId) {
      fetchReportData();
    }
  }, [isOpen, studyId]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      console.log('📋 [Verify Modal] Fetching report for study:', studyId);
      
      // ✅ NEW ENDPOINT: Use verifier-specific endpoint
      const response = await api.get(`/verifier/studies/${studyId}/report`);
      
      console.log('📋 [Verify Modal] Report response:', {
        status: response.status,
        success: response.data?.success,
        hasReport: !!response.data?.data?.report,
        source: response.data?.source
      });
      
      if (response.data.success && response.data.data.report) {
        const { report, studyInfo } = response.data.data;
        const source = response.data.source;
        
        console.log('✅ [Verify Modal] Report found:', {
          reportId: report._id,
          reportType: report.reportType,
          reportStatus: report.reportStatus,
          contentLength: report.reportContent?.htmlContent?.length || 0,
          source
        });
        
        setReportData(report);
        setStudyInfo(studyInfo);
        setReportSource(source);
        
        // Show success toast with source info
        const sourceLabels = {
          'modern_report_system': 'Modern Report',
          'legacy_uploaded_report': 'Legacy Uploaded Report',
          'basic_report_info': 'Basic Report'
        };
        
        toast.success(
          `📄 Loaded ${sourceLabels[source] || 'Report'} (${report.reportStatus}) for verification`,
          { duration: 3000, icon: '📋' }
        );
      } else {
        console.warn('⚠️ [Verify Modal] No report found for study:', studyId);
        toast.error('No report found for this study');
        setReportData(null);
        setStudyInfo(null);
        setReportSource(null);
      }
    } catch (error) {
      console.error('❌ [Verify Modal] Error fetching report:', error);
      
      if (error.response?.status === 404) {
        console.log('📋 [Verify Modal] 404 - No report found');
        toast.error('No report available for verification');
      } else if (error.response?.status === 403) {
        console.log('📋 [Verify Modal] 403 - Access denied');
        toast.error('Access denied to this report');
      } else if (error.response?.status === 400) {
        console.log('📋 [Verify Modal] 400 - Study not verifiable');
        toast.error('Study is not in a verifiable state');
      } else {
        console.error('📋 [Verify Modal] Unknown error:', error.message);
        toast.error('Failed to load report');
      }
      
      setReportData(null);
      setStudyInfo(null);
      setReportSource(null);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (approved) => {
    setVerifying(true);
    try {
      const verificationData = {
        verificationNotes,
        approved,
        rejectionReason: approved ? undefined : rejectionReason,
        corrections: approved ? [] : corrections,
        verificationTimeMinutes: 5 // You can track actual time
      };

      console.log('✅ [Verify Modal] Submitting verification:', {
        studyId,
        approved,
        hasNotes: !!verificationNotes,
        hasRejectionReason: !!rejectionReason,
        correctionsCount: corrections.length
      });

      const response = await api.post(`/verifier/studies/${studyId}/verify`, verificationData);
      
      if (response.data.success) {
        console.log('✅ [Verify Modal] Verification successful');
        toast.success(approved ? 'Report verified successfully!' : 'Report rejected with feedback');
        onVerifyComplete?.();
        onClose();
      }
    } catch (error) {
      console.error('❌ [Verify Modal] Error verifying report:', error);
      
      if (error.response?.status === 403) {
        toast.error('Access denied: Cannot verify this report');
      } else if (error.response?.status === 400) {
        toast.error('Invalid verification data');
      } else {
        toast.error('Failed to verify report');
      }
    } finally {
      setVerifying(false);
    }
  };

  const addCorrection = () => {
    setCorrections([...corrections, {
      section: 'findings',
      comment: '',
      severity: 'minor'
    }]);
  };

  const updateCorrection = (index, field, value) => {
    const updated = [...corrections];
    updated[index][field] = value;
    setCorrections(updated);
  };

  const removeCorrection = (index) => {
    setCorrections(corrections.filter((_, i) => i !== index));
  };

  const getOHIFUrl = () => {
    if (!studyData?.orthancStudyID && !studyData?.studyInstanceUID) {
      return null;
    }
    
    const studyIdentifier = studyData.orthancStudyID || studyData.studyInstanceUID;
    
    // ✅ ENHANCED: Better OHIF URL construction
    const ohifBaseURL = import.meta.env.VITE_OHIF_LOCAL_URL || 'http://localhost:4000';
    const ohifUrl = `${ohifBaseURL}/viewer?StudyInstanceUIDs=${encodeURIComponent(studyIdentifier)}`;
    
    console.log('👁️ [Verify Modal] OHIF URL:', ohifUrl);
    return ohifUrl;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose} />
      
      {/* Modal */}
      <div className="relative w-full h-full flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl h-full max-h-[95vh] flex flex-col">
          
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <div className="flex items-center space-x-4">
              <h2 className="text-xl font-semibold text-gray-900">
                Verify Report - {studyData?.patientName || studyInfo?.patientInfo?.patientName || 'Unknown Patient'}
              </h2>
              <div className="text-sm text-gray-500">
                Study ID: {studyData?.patientId || studyInfo?.patientInfo?.patientID} • 
                Modality: {studyData?.modality || studyInfo?.modality}
              </div>
              {/* ✅ ENHANCED: Show report status and source */}
              {reportData && (
                <div className="flex items-center space-x-2">
                  <div className={`px-2 py-1 rounded text-xs font-medium ${
                    reportData.reportStatus === 'finalized' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {reportData.reportStatus === 'finalized' ? 'Finalized Report' : 'Draft Report'}
                  </div>
                  {reportSource && (
                    <div className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-600">
                      {reportSource === 'modern_report_system' ? 'Modern' : 
                       reportSource === 'legacy_uploaded_report' ? 'Legacy' : 'Basic'}
                    </div>
                  )}
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 bg-gray-50">
            <button
              onClick={() => setActiveTab('report')}
              className={`flex items-center space-x-2 px-6 py-3 font-medium text-sm transition-colors ${
                activeTab === 'report'
                  ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Report Content</span>
            </button>
            
            <button
              onClick={() => setActiveTab('viewer')}
              className={`flex items-center space-x-2 px-6 py-3 font-medium text-sm transition-colors ${
                activeTab === 'viewer'
                  ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Eye className="w-4 h-4" />
              <span>DICOM Viewer</span>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 flex overflow-hidden">
            
            {/* Main Content Area */}
            <div className="flex-1 overflow-hidden">
              
              {/* Report Tab */}
              {activeTab === 'report' && (
                <div className="h-full overflow-y-auto p-6">
                  {loading ? (
                    <div className="flex items-center justify-center h-64">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent mx-auto mb-4"></div>
                        <p className="text-gray-600">Loading report content...</p>
                      </div>
                    </div>
                  ) : reportData ? (
                    <div className="prose max-w-none">
                      {/* ✅ ENHANCED: Report metadata */}
                      <div className="bg-gray-50 p-4 rounded-lg mb-6">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div><strong>Report Type:</strong> {reportData.reportType}</div>
                          <div><strong>Status:</strong> 
                            <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${
                              reportData.reportStatus === 'finalized' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {reportData.reportStatus}
                            </span>
                          </div>
                          <div><strong>Created:</strong> {new Date(reportData.createdAt).toLocaleString()}</div>
                          <div><strong>Updated:</strong> {new Date(reportData.updatedAt).toLocaleString()}</div>
                          {reportData.doctorId && (
                            <div><strong>Reported By:</strong> {reportData.doctorId.fullName || 'Unknown Doctor'}</div>
                          )}
                          {reportData.templateInfo && (
                            <div><strong>Template:</strong> {reportData.templateInfo.templateName || 'Custom'}</div>
                          )}
                          {reportSource && (
                            <div><strong>Source:</strong> 
                              <span className="ml-2 px-2 py-1 rounded text-xs bg-gray-100 text-gray-600">
                                {reportSource === 'modern_report_system' ? 'Modern Report System' : 
                                 reportSource === 'legacy_uploaded_report' ? 'Legacy Upload' : 
                                 'Basic Report Info'}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* ✅ ENHANCED: Report content with better styling */}
                      <div className="bg-white border border-gray-200 rounded-lg">
                        {/* Content Header */}
                        <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 rounded-t-lg">
                          <h3 className="font-medium text-gray-900">Report Content</h3>
                        </div>
                        
                        {/* Content Body */}
                        <div 
                          className="p-6 min-h-96 prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{ 
                            __html: reportData.reportContent?.htmlContent || '<p class="text-gray-500 italic">No content available</p>' 
                          }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-64 text-gray-500">
                      <div className="text-center">
                        <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                        <p className="text-lg font-medium text-gray-900 mb-2">No report content available</p>
                        <p className="text-sm">This study does not have a report ready for verification.</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* OHIF Viewer Tab */}
              {activeTab === 'viewer' && (
                <div className="h-full">
                  {getOHIFUrl() ? (
                    <iframe
                      ref={ohifIframeRef}
                      src={getOHIFUrl()}
                      className="w-full h-full border-0"
                      title="DICOM Viewer"
                      onLoad={() => console.log('👁️ [Verify Modal] OHIF viewer loaded')}
                      onError={() => console.error('❌ [Verify Modal] OHIF viewer failed to load')}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      <div className="text-center">
                        <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
                        <p className="text-lg font-medium text-gray-900 mb-2">DICOM viewer not available</p>
                        <p className="text-sm">Study identifiers missing</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Verification Panel */}
            <div className="w-80 bg-gray-50 border-l border-gray-200 p-4 overflow-y-auto">
              <h3 className="font-semibold text-gray-900 mb-4">Verification</h3>
              
              {/* ✅ ENHANCED: Only show verification panel if report exists */}
              {reportData ? (
                <>
                  {/* Verification Notes */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Verification Notes
                    </label>
                    <textarea
                      value={verificationNotes}
                      onChange={(e) => setVerificationNotes(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                      placeholder="Add your verification notes..."
                    />
                  </div>

                  {/* Rejection Section */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Rejection Reason (if rejecting)
                    </label>
                    <textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                      placeholder="Reason for rejection..."
                    />
                  </div>

                  {/* Corrections */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Corrections
                      </label>
                      <button
                        onClick={addCorrection}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                      >
                        + Add
                      </button>
                    </div>
                    
                    {corrections.map((correction, index) => (
                      <div key={index} className="border rounded-lg p-3 mb-2 bg-white">
                        <div className="flex justify-between items-center mb-2">
                          <select
                            value={correction.section}
                            onChange={(e) => updateCorrection(index, 'section', e.target.value)}
                            className="text-xs border rounded px-2 py-1"
                          >
                            <option value="findings">Findings</option>
                            <option value="impression">Impression</option>
                            <option value="recommendation">Recommendation</option>
                            <option value="technique">Technique</option>
                            <option value="other">Other</option>
                          </select>
                          <button
                            onClick={() => removeCorrection(index)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                        <textarea
                          value={correction.comment}
                          onChange={(e) => updateCorrection(index, 'comment', e.target.value)}
                          rows={2}
                          className="w-full text-xs border rounded px-2 py-1"
                          placeholder="Correction details..."
                        />
                        <select
                          value={correction.severity}
                          onChange={(e) => updateCorrection(index, 'severity', e.target.value)}
                          className="w-full text-xs border rounded px-2 py-1 mt-1"
                        >
                          <option value="minor">Minor</option>
                          <option value="major">Major</option>
                          <option value="critical">Critical</option>
                        </select>
                      </div>
                    ))}
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-2">
                    <button
                      onClick={() => handleVerify(true)}
                      disabled={verifying}
                      className="w-full flex items-center justify-center space-x-2 bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium transition-colors"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>{verifying ? 'Verifying...' : 'Approve Report'}</span>
                    </button>
                    
                    <button
                      onClick={() => handleVerify(false)}
                      disabled={verifying || (!rejectionReason.trim() && corrections.length === 0)}
                      className="w-full flex items-center justify-center space-x-2 bg-red-600 text-white py-3 px-4 rounded-lg hover:bg-red-700 disabled:opacity-50 font-medium transition-colors"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>{verifying ? 'Processing...' : 'Reject Report'}</span>
                    </button>

                    <button
                      onClick={onClose}
                      className="w-full bg-gray-300 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-400 font-medium transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center text-gray-500">
                  <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm">No report available for verification</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyModal;