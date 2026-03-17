import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import api from '../../services/api';
import toast from 'react-hot-toast';
import ReportEditor from './ReportEditorWithOhif';
import DoctorTemplateDropdown from './DoctorTemplateDropdown';
import AllTemplateDropdown from './AllTemplateDropdown';
import sessionManager from '../../services/sessionManager';
import { CheckCircle, XCircle, Edit, Camera, FileText, ChevronRight, ChevronLeft } from 'lucide-react';
import useWebSocket from '../../hooks/useWebSocket';

const OnlineReportingSystemWithOHIF = () => {
  const { studyId } = useParams();
  const { sendMessage, readyState } = useWebSocket();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const [capturedImages, setCapturedImages] = useState([]);
  
  // ✅ Control for Opening/Closing the Report Panel
  const [isReportOpen, setIsReportOpen] = useState(false); 

  // ✅ Get studyInstanceUID from location state if available
  const passedStudy = location.state?.study;
  const passedStudyInstanceUID = passedStudy?.studyInstanceUID || passedStudy?.studyInstanceUIDs || null;
  
  // ✅ STATE VARIABLES
  const [loading, setLoading] = useState(true);
  const [studyData, setStudyData] = useState(null);
  const [patientData, setPatientData] = useState(null);
  const [templates, setTemplates] = useState({});
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [reportData, setReportData] = useState({});
  const [reportContent, setReportContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [exportFormat, setExportFormat] = useState('docx');
  const [ohifViewerUrl, setOhifViewerUrl] = useState('');
  const [downloadOptions, setDownloadOptions] = useState(null);
  
  // ✅ Verifier-specific states
  const [verifying, setVerifying] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  
  // ✅ Layout State
  const [leftPanelWidth, setLeftPanelWidth] = useState(50);

  // ✅ User Roles
  const currentUser = sessionManager.getCurrentUser();
  const userRoles = currentUser?.accountRoles || [currentUser?.role];
  const hasRole = (role) => userRoles.includes(role);

  const isVerifierMode = searchParams.get('verifierMode') === 'true' || 
                         searchParams.get('verifier') === 'true' ||
                         searchParams.get('action') === 'verify' ||
                         hasRole('verifier');

  const widthOptions = [
    { value: 30, label: '30% / 70%' },
    { value: 40, label: '40% / 60%' },
    { value: 50, label: '50% / 50%' },
    { value: 60, label: '60% / 40%' },
    { value: 70, label: '70% / 30%' },
    { value: 80, label: '80% / 20%' }
  ];

  // ✅ WebSocket Refs & Logic
  const hasSentStudyOpened = useRef(false);
  const sendAttemptTimeout = useRef(null);
  const initialDelayTimeout = useRef(null);

  useEffect(() => {
    if (!studyId) {
      hasSentStudyOpened.current = false;
      if (sendAttemptTimeout.current) clearTimeout(sendAttemptTimeout.current);
      if (initialDelayTimeout.current) clearTimeout(initialDelayTimeout.current);
      return;
    }

    console.log('⏳ [WebSocket] Waiting 5 seconds before sending study_opened...');
    
    const attemptSend = () => {
      if (readyState === WebSocket.OPEN && !hasSentStudyOpened.current) {
        const message = { type: 'study_opened', studyId: studyId, mode: 'reporting' };
        sendMessage(message);
        hasSentStudyOpened.current = true;
      } else if (readyState !== WebSocket.OPEN && !hasSentStudyOpened.current) {
        sendAttemptTimeout.current = setTimeout(attemptSend, 1000);
      }
    };

    initialDelayTimeout.current = setTimeout(() => {
      attemptSend();
    }, 4000);

    return () => {
      if (sendAttemptTimeout.current) clearTimeout(sendAttemptTimeout.current);
      if (initialDelayTimeout.current) clearTimeout(initialDelayTimeout.current);
      
      if (hasSentStudyOpened.current && readyState === WebSocket.OPEN) {
        sendMessage({ type: 'study_closed', studyId: studyId });
        hasSentStudyOpened.current = false;
      }
    };
  }, [studyId, readyState, sendMessage]);

  // ✅ Initialize Study
  useEffect(() => {
    if (studyId) {
      setStudyData(null);
      setPatientData(null);
      setSelectedTemplate(null);
      setReportData({});
      setReportContent('');
      setSaving(false);
      setFinalizing(false);
      setVerifying(false);
      setRejecting(false);
      setExportFormat('docx');
      setOhifViewerUrl('');
      setIsReportOpen(false);
      
      initializeReportingSystem();
    }
  }, [studyId]);

  const initializeReportingSystem = async () => {
    setLoading(true);
    try {
      const currentUser = sessionManager.getCurrentUser();
      if (!currentUser) {
        toast.error('Authentication required.');
        navigate('/login');
        return;
      }
      
      const urlParams = new URLSearchParams(window.location.search);
      const reportIdParam = urlParams.get('reportId');
      const actionParam = urlParams.get('action');
      
      const studyInfoEndpoint = `/documents/study/${studyId}/reporting-info`;
      const templatesEndpoint = '/html-templates/reporting';
      
      let existingReportEndpoint = `/reports/studies/${studyId}/edit-report`;
      if (reportIdParam && actionParam === 'edit') {
        existingReportEndpoint = `/reports/studies/${studyId}/edit-report?reportId=${reportIdParam}`;
      }
      
      const [studyInfoResponse, templatesResponse, existingReportResponse] = await Promise.allSettled([
        api.get(studyInfoEndpoint),
        api.get(templatesEndpoint),
        api.get(existingReportEndpoint)
      ]);

      if (studyInfoResponse.status === 'fulfilled' && studyInfoResponse.value.data.success) {
        const data = studyInfoResponse.value.data.data;
        const studyInfo = data.studyInfo || {};
        const patientInfo = data.patientInfo || {};
        const allStudies = data.allStudies || [];
        const currentStudy = allStudies.find(study => study.studyId === studyId) || studyInfo;
        
        const orthancStudyID = currentStudy.orthancStudyID || currentStudy.studyId || studyInfo.studyId || null;
        const studyInstanceUID = passedStudyInstanceUID || currentStudy.studyInstanceUID || currentStudy.studyId || studyInfo.studyInstanceUID || studyInfo.studyId || null;
      
        if (studyInstanceUID) {
          // const OHIF_BASE = 'http://206.189.133.52:4000/viewer';
          const OHIF_BASE = 'https://viewer.bharatpacs.com/viewer';
          console.log(OHIF_BASE)

          // const OHIF_BASE = 'https://viewer.pacs.xcentic.com/viewer';
          let studyUIDs = '';
          
          if (Array.isArray(studyInstanceUID) && studyInstanceUID.length) {
            studyUIDs = studyInstanceUID.join(',');
          } else if (typeof studyInstanceUID === 'string' && studyInstanceUID.trim()) {
            studyUIDs = studyInstanceUID.trim();
          } else if (orthancStudyID) {
            studyUIDs = orthancStudyID;
          }
          
          if (studyUIDs) {
            const viewerUrl = `${OHIF_BASE}?StudyInstanceUIDs=${encodeURIComponent(studyUIDs)}`;
            setOhifViewerUrl(viewerUrl);
          }
        }
        
        setStudyData({
          _id: studyId,
          ...currentStudy,
          ...studyInfo
        });
        
        setPatientData({
          ...patientInfo,
          fullName: patientInfo.fullName || patientInfo.patientName || 'Unknown Patient'
        });
        
        setDownloadOptions({
          downloadOptions: {
            hasR2CDN: data.downloadOptions?.hasR2CDN || false,
            hasWasabiZip: data.downloadOptions?.hasWasabiZip || false,
            hasR2Zip: data.downloadOptions?.hasR2Zip || false,
            r2SizeMB: data.downloadOptions?.r2SizeMB || 0,
            wasabiSizeMB: data.downloadOptions?.wasabiSizeMB || 0,
            zipStatus: data.downloadOptions?.zipStatus || 'not_started'
          },
          orthancStudyID: orthancStudyID,
          studyInstanceUID: studyInstanceUID
        });
        
        const referringPhysicians = data.referringPhysicians || {};
        const currentReferring = referringPhysicians.current || {};
        
        setReportData({
          referringPhysician: currentReferring.name || currentStudy.referringPhysician || studyInfo.physicians?.referring?.name || studyInfo.referringPhysician || 'N/A',
           clinicalHistory: (() => {
            const clinicalHist = patientInfo.clinicalHistory || data.clinicalHistory;
            if (typeof clinicalHist === 'string') return clinicalHist;
            if (typeof clinicalHist === 'object' && clinicalHist !== null) {
              return clinicalHist.clinicalHistory || clinicalHist.previousInjury || clinicalHist.previousSurgery || 'No clinical history available';
            }
            return 'No clinical history available';
          })()
        });

        toast.success(`Loaded study: ${currentStudy.accessionNumber || studyInfo.accessionNumber || studyId}`);
      }
      
      if (templatesResponse.status === 'fulfilled' && templatesResponse.value.data.success) {
        setTemplates(templatesResponse.value.data.data.templates);
      }
      
      if (existingReportResponse.status === 'fulfilled' && existingReportResponse.value.data.success) {
        const existingReport = existingReportResponse.value.data.data.report;
        if (existingReport.reportContent?.htmlContent) {
          setReportContent(existingReport.reportContent.htmlContent);
          toast.success(`📝 Loaded existing report`);
          setIsReportOpen(true);
        }

        if (existingReport.reportContent?.templateInfo?.templateId) {
          try {
            const templateResponse = await api.get(`/html-templates/${existingReport.reportContent.templateInfo.templateId}`);
            if (templateResponse.data.success) {
              setSelectedTemplate(templateResponse.data.data);
            }
          } catch (templateError) {
            console.warn('Could not load template from existing report:', templateError);
          }
        }

        setReportData(prev => ({
          ...prev,
          existingReport: {
            id: existingReport._id,
            reportId: existingReport.reportId,
            reportType: existingReport.reportType,
            reportStatus: existingReport.reportStatus,
            createdAt: existingReport.createdAt,
            updatedAt: existingReport.updatedAt
          }
        }));
      } else if (existingReportResponse.status === 'fulfilled' && existingReportResponse.value.status === 404) {
        setReportContent(''); 
      }

    } catch (error) {
      if (error.response?.status === 404) {
        toast.error(`Study ${studyId} not found or access denied.`);
        setTimeout(() => navigate('/doctor/dashboard'), 2000);
      } else if (error.response?.status === 401) {
        toast.error('Authentication expired.');
        navigate('/login');
      } else {
        toast.error(`Failed to load study: ${error.message || 'Unknown error'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // ✅ OHIF Image Capture Logic
  const handleAttachOhifImage = () => {
    const iframe = document.getElementById('ohif-viewer-iframe');
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({ action: 'ATTACH_REPORT_SIGNAL' }, '*');
      toast.loading('📸 Capturing image from viewer...', { duration: 2000 });
    } else {
      toast.error('❌ OHIF Viewer not ready');
    }
  };

  useEffect(() => {
    const handleOhifMessage = (event) => {
      if (!event.data) return;

      if (event.data.action === 'OHIF_IMAGE_CAPTURED') {
        const { image, viewportId, metadata } = event.data;
        const imageObj = {
          imageData: image,
          viewportId: viewportId || 'viewport-1',
          capturedAt: new Date().toISOString(),
          imageMetadata: { format: 'png', ...metadata },
          displayOrder: capturedImages.length
        };

        setCapturedImages(prev => {
          const newImages = [...prev, imageObj];
          const imageCount = newImages.length;
          toast.success(`📸 Image captured! ${imageCount} ready`);
          return newImages;
        });
      }
    };

    window.addEventListener('message', handleOhifMessage);
    return () => window.removeEventListener('message', handleOhifMessage);
  }, [capturedImages]);

  // ✅ Template Logic
 const handleTemplateSelect = async (template) => {
  if (!template) return;
  try {
    const response = await api.get(`/html-templates/${template._id}`);
    if (!response.data?.success) throw new Error('Failed to load template');
    const templateData = response.data.data;

    const placeholders = {
      '--name--': patientData?.fullName || '[Patient Name]',
      '--patientid--': patientData?.patientId || '[Patient ID]',
      '--accessionno--': studyData?.accessionNumber || '[Accession Number]',
      '--age--': patientData?.age || '[Age]',
      '--gender--': patientData?.gender || '[Gender]',
      '--agegender--': `${patientData?.age || '[Age]'} / ${patientData?.gender || '[Gender]'}`,
      '--referredby--': reportData?.referringPhysician || studyData?.referringPhysician || '[Referring Physician]',
      '--reporteddate--': new Date().toLocaleDateString(),
      '--studydate--': studyData?.studyDate ? new Date(studyData.studyDate).toLocaleDateString() : '[Study Date]',
      '--modality--': studyData?.modality || '[Modality]',
      '--clinicalhistory--': reportData?.clinicalHistory || '[Clinical History]'
    };

    let processedContent = templateData.htmlContent || '';
    Object.entries(placeholders).forEach(([placeholder, value]) => {
      const regex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      processedContent = processedContent.replace(regex, value);
    });

    processedContent = cleanTemplateHTML(processedContent);
    setSelectedTemplate(templateData);
    setReportContent(processedContent);
    setIsReportOpen(true);

    try { await api.post(`/html-templates/${template._id}/record-usage`); } catch (e) {}
    toast.success(`Template "${template.title}" applied!`);
  } catch (error) {
    toast.error(`Failed to load template: ${error.message}`);
  }
};

const cleanTemplateHTML = (html) => {
  if (!html) return '';
  const temp = document.createElement('div');
  temp.innerHTML = html;
  const removeBoxStyles = (element) => {
    if (element.tagName === 'DIV' || element.tagName === 'SECTION') {
      const style = element.style;
      if (style.boxShadow) style.boxShadow = '';
      if (element.tagName !== 'TABLE' && element.tagName !== 'TD' && element.tagName !== 'TH') {
        if (style.background || style.backgroundColor || style.backgroundImage) {
          style.background = ''; style.backgroundColor = ''; style.backgroundImage = '';
        }
      }
      if (element.tagName !== 'TABLE' && !element.classList.contains('patient-info-table')) {
        if (style.border || style.borderTop) {
           style.border = ''; style.borderTop = ''; style.borderBottom = ''; style.borderLeft = ''; style.borderRight = '';
        }
      }
      if (element.tagName !== 'TABLE') {
        const padding = parseInt(style.padding || 0);
        if (padding > 20) style.padding = '';
      }
      const margin = parseInt(style.margin || 0);
      if (margin > 20) style.margin = '';
    }
    Array.from(element.children).forEach(child => removeBoxStyles(child));
  };
  removeBoxStyles(temp);
  return temp.innerHTML;
};

  // ✅ Saving / Actions
  const handleSaveDraft = async () => {
    if (!reportContent.trim()) { toast.error('Cannot save an empty draft.'); return; }
    setSaving(true);
    try {
      const currentUser = sessionManager.getCurrentUser();
      const templateName = `${currentUser.email.split('@')[0]}_draft_${Date.now()}.docx`;
      const referringPhysicianName = reportData?.referringPhysician || 'N/A';
      
      const placeholders = {
        '--name--': patientData?.fullName || '',
        '--patientid--': patientData?.patientId || '',
        '--accessionno--': studyData?.accessionNumber || '',
        '--agegender--': `${patientData?.age || ''} / ${patientData?.gender || ''}`,
        '--referredby--': referringPhysicianName,
        '--reporteddate--': new Date().toLocaleDateString(),
        '--Content--': reportContent
      };

      const endpoint = `/reports/studies/${studyId}/store-draft`;
      const response = await api.post(endpoint, {
        templateName, placeholders, htmlContent: reportContent,
        templateId: selectedTemplate?._id,
        templateInfo: selectedTemplate ? { templateId: selectedTemplate._id, templateName: selectedTemplate.title, templateCategory: selectedTemplate.category, templateTitle: selectedTemplate.title } : null,
        capturedImages: capturedImages.map(img => ({ ...img, capturedBy: currentUser._id })),
        existingReportId: reportData.existingReport?.id || null
      });

      if (response.data.success) {
        if (!reportData.existingReport) {
          setReportData(prev => ({
            ...prev,
            existingReport: { id: response.data.data.reportId, reportType: 'draft', reportStatus: 'draft', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
          }));
        }
        toast.success(`Draft saved successfully!`, { icon: '📝' });
      } else { throw new Error(response.data.message || 'Failed to save draft'); }
    } catch (error) { toast.error(`Failed to save draft: ${error.message}`); } finally { setSaving(false); }
  };

  const handleUpdateReport = async () => {
    if (!reportContent.trim()) { toast.error('Cannot update an empty report.'); return; }
    setSaving(true);
    try {
      const endpoint = `/verifier/studies/${studyId}/update-report`;
      const updatePayload = {
        htmlContent: reportContent,
        verificationNotes: 'Report updated during verification process',
        templateId: selectedTemplate?._id,
        templateInfo: selectedTemplate ? { templateId: selectedTemplate._id, templateName: selectedTemplate.title, templateCategory: selectedTemplate.category, templateTitle: selectedTemplate.title } : null,
        maintainFinalizedStatus: true
      };
      
      const response = await api.post(endpoint, updatePayload);
      if (response.data.success) { toast.success('Report updated successfully!', { icon: '✏️' }); } 
      else { throw new Error(response.data.message || 'Failed to update report'); }
    } catch (error) { toast.error(`Failed to update report: ${error.message}`); } finally { setSaving(false); }
  };

  const handleFinalizeReport = async () => {
    if (!reportContent.trim()) { toast.error('Please enter report content to finalize.'); return; }
    if (!window.confirm(`Are you sure you want to finalize this report as ${exportFormat.toUpperCase()}?`)) return;

    setFinalizing(true);
    try {
      const currentUser = sessionManager.getCurrentUser();
      const templateName = `${currentUser.email.split('@')[0]}_final_${Date.now()}.${exportFormat}`;
      const referringPhysicianName = reportData?.referringPhysician || 'N/A';
      
      const placeholders = {
        '--name--': patientData?.fullName || '',
        '--patientid--': patientData?.patientId || '',
        '--accessionno--': studyData?.accessionNumber || '',
        '--agegender--': `${patientData?.age || ''} / ${patientData?.gender || ''}`,
        '--referredby--': referringPhysicianName,
        '--reporteddate--': new Date().toLocaleDateString(),
        '--Content--': reportContent
      };

      const storeEndpoint = `/reports/studies/${studyId}/store-finalized`;
      const response = await api.post(storeEndpoint, {
        templateName, placeholders, htmlContent: reportContent, format: exportFormat,
        templateId: selectedTemplate?._id,
        templateInfo: selectedTemplate ? { templateId: selectedTemplate._id, templateName: selectedTemplate.title, templateCategory: selectedTemplate.category, templateTitle: selectedTemplate.title } : null,
        capturedImages: capturedImages.map(img => ({ ...img, capturedBy: currentUser._id }))
      });

      if (response.data.success) {
        toast.success(`Report finalized as ${exportFormat.toUpperCase()} successfully!`, { icon: '🎉' });
        const currentUser = sessionManager.getCurrentUser();
        if (currentUser?.role === 'doctor_account') setTimeout(() => navigate('/doctor/dashboard'), 3000);
        else if (currentUser?.role === 'verifier') setTimeout(() => navigate('/verifier/dashboard'), 3000);
        else setTimeout(() => navigate('/admin/dashboard'), 3000);
      } else { throw new Error(response.data.message || 'Failed to finalize report'); }
    } catch (error) { toast.error(`Failed to finalize report: ${error.message}`); } finally { setFinalizing(false); }
  };

  const handleVerifyReport = async () => {
    if (!reportContent.trim()) { toast.error('Report content is required for verification.'); return; }
    if (!window.confirm('Are you sure you want to verify this report?')) return;
    setVerifying(true);
    try {
      const response = await api.post(`/verifier/studies/${studyId}/verify`, {
        approved: true, verificationNotes: 'Report verified through OHIF + Reporting interface', corrections: [], verificationTimeMinutes: 0
      });
      if (response.data.success) { toast.success('Report verified successfully!', { icon: '✅' }); setTimeout(() => navigate('/verifier/dashboard'), 2000); }
      else { throw new Error(response.data.message || 'Failed to verify report'); }
    } catch (error) { toast.error(`Failed to verify report: ${error.message}`); } finally { setVerifying(false); }
  };

  const handleRejectReport = async () => {
    const rejectionReason = prompt('Please provide a reason for rejecting this report:');
    if (!rejectionReason?.trim()) { toast.error('Rejection reason is required.'); return; }
    if (!window.confirm('Are you sure you want to reject this report?')) return;
    setRejecting(true);
    try {
      const response = await api.post(`/verifier/studies/${studyId}/verify`, {
        approved: false, verificationNotes: rejectionReason, rejectionReason: rejectionReason, corrections: [], verificationTimeMinutes: 0
      });
      if (response.data.success) { toast.success('Report rejected successfully!', { icon: '❌' }); setTimeout(() => navigate('/verifier/dashboard'), 2000); }
      else { throw new Error(response.data.message || 'Failed to reject report'); }
    } catch (error) { toast.error(`Failed to reject report: ${error.message}`); } finally { setRejecting(false); }
  };

   const handleBackToWorklist = () => {
    if (isVerifierMode || hasRole('verifier')) navigate('/verifier/dashboard');
    else if (hasRole('assignor')) navigate('/assignor/dashboard');
    else if (hasRole('radiologist') || hasRole('doctor_account')) navigate('/doctor/dashboard');
    else if (hasRole('admin')) navigate('/admin/dashboard');
    else if (hasRole('lab_staff')) navigate('/lab/dashboard');
    else navigate('/login');
  };

  if (loading) {
    return (
      <div className="h-screen w-full bg-white flex items-center justify-center overflow-hidden">
        <div className="text-center">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-black border-t-transparent mx-auto mb-3"></div>
          <p className="text-gray-600 text-xs">Loading study {studyId}...</p>
        </div>
      </div>
    );
  }

  // ✅ Main Layout with Fixed Height and Bottom Border
  return (
    <div className="h-screen w-full bg-gray-50 flex flex-col overflow-hidden border-b-4 border-blue-600">
      
      {/* Top Control Bar */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 shadow-sm z-10">
        <div className="px-3 py-2">
          <div className="flex items-center justify-between gap-4">
            
            {/* Left Section - Study Info */}
            <div className="flex items-center space-x-3">
              <div className="flex  items-center space-x-2">
                <div className="p-1 bg-gray-600 rounded">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>

               <div className="text-xs">
  <div className="flex flex-row gap-4">
    <div className="flex items-center gap-4">
      <span
        className="font-medium text-gray-900 truncate uppercase"
        title={patientData?.fullName || ''}
      >
        {(patientData?.fullName || 'Loading...').toString().toUpperCase()}
      </span>

      <span className="text-gray-500 text-[11px] uppercase">
        {(studyData?.accessionNumber || (studyId ? `${String(studyId).substring(0, 8)}...` : '')).toString().toUpperCase()}
      </span>

      <span className="text-[11px] text-gray-600 ml-2 uppercase">
        <strong className="font-medium">AGE:</strong>{' '}
        {(patientData?.age || studyData?.patientAge || 'N/A').toString().toUpperCase()}
        {(patientData?.gender || studyData?.patientSex) ? ` / ${(patientData?.gender || studyData?.patientSex).toString().toUpperCase()}` : ''}
      </span>
    </div>

    <div
      className="text-[12px] text-gray-700 truncate max-w-xs"
      title={reportData?.clinicalHistory || patientData?.clinicalHistory || studyData?.clinicalHistory || 'No clinical history'}
    >
      <span className="font-medium text-gray-600 mr-1 uppercase">CLINICAL HISTORY:</span>
      <span className="font-normal uppercase">
        {(reportData?.clinicalHistory || patientData?.clinicalHistory || studyData?.clinicalHistory || 'No clinical history').toString().toUpperCase()}
      </span>
    </div>
  </div>
</div>
              </div>
              
              <div className="flex items-center space-x-3 text-xs text-gray-600">
                <span>{studyData?.modality || 'N/A'}</span>
                <span>•</span>
                <span>{studyData?.studyDate ? new Date(studyData.studyDate).toLocaleDateString() : 'N/A'}</span>
              </div>
            </div>

            {/* Center Section */}
            <div className="flex items-center space-x-3">
              {!isReportOpen && (
                <button
                    onClick={() => setIsReportOpen(true)}
                    className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white rounded-md shadow hover:bg-blue-700 transition-all font-medium text-sm animate-pulse"
                >
                    <FileText className="w-4 h-4" />
                    {isVerifierMode ? 'Start Verification' : 'Report Now'}
                    <ChevronLeft className="w-4 h-4" />
                </button>
              )}

              {isReportOpen && (
                <>
                    {!isVerifierMode ? (
                        <>
                        <div className="flex items-center space-x-2">
                            <DoctorTemplateDropdown 
                            onTemplateSelect={handleTemplateSelect}
                            selectedTemplate={selectedTemplate?.templateScope === 'doctor_specific' ? selectedTemplate : null}
                            />
                            <AllTemplateDropdown 
                            onTemplateSelect={handleTemplateSelect}
                            selectedTemplate={selectedTemplate}
                            />
                        </div>
                        <div className="h-6 w-px bg-gray-300"></div>
                        <button
                            onClick={handleAttachOhifImage}
                            className="relative flex items-center space-x-1 px-3 py-1 text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 rounded hover:bg-indigo-100 transition-colors shadow-sm"
                            title={`Capture active viewport`}
                        >
                            <Camera className="w-3 h-3" />
                            <span>Capture</span>
                            {capturedImages.length > 0 && (
                            <span className="absolute -top-2 -right-2 flex items-center justify-center min-w-[20px] h-5 px-1 text-[10px] font-bold text-white bg-gradient-to-r from-green-500 to-emerald-600 rounded-full shadow-md border-2 border-white">
                                {capturedImages.length}
                            </span>
                            )}
                        </button>
                        <div className="flex items-center space-x-2">
                            <label className="text-xs font-medium text-gray-700">Layout:</label>
                            <select
                            value={leftPanelWidth}
                            onChange={(e) => setLeftPanelWidth(parseInt(e.target.value))}
                            className="px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                            >
                            {widthOptions.map(option => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                            </select>
                        </div>
                        <div className="flex items-center space-x-2">
                            <label className="text-xs font-medium text-gray-700">Format:</label>
                            <select
                            value={exportFormat}
                            onChange={(e) => setExportFormat(e.target.value)}
                            className="px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-green-400 bg-white"
                            >
                            <option value="docx">DOCX</option>
                            <option value="pdf">PDF</option>
                            </select>
                        </div>
                        </>
                    ) : (
                        <>
                        <div className="flex items-center space-x-2">
                            <label className="text-xs font-medium text-purple-700">Layout:</label>
                            <select
                            value={leftPanelWidth}
                            onChange={(e) => setLeftPanelWidth(parseInt(e.target.value))}
                            className="px-1.5 py-0.5 text-xs border border-purple-200 rounded focus:outline-none focus:ring-1 focus:ring-purple-400 bg-white"
                            >
                            {widthOptions.map(option => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                            </select>
                        </div>
                        <div className="h-6 w-px bg-purple-300"></div>
                        <div className="flex items-center space-x-1">
                            <button
                                onClick={handleUpdateReport}
                                disabled={saving || !reportContent.trim()}
                                className="px-2 py-1 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                            >
                                {saving ? 'Updating...' : 'Update'}
                            </button>
                            <button
                                onClick={handleRejectReport}
                                disabled={rejecting}
                                className="px-2 py-1 text-xs font-medium bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                            >
                                {rejecting ? 'Rejecting...' : 'Reject'}
                            </button>
                            <button
                                onClick={handleVerifyReport}
                                disabled={verifying || !reportContent.trim()}
                                className="px-2 py-1 text-xs font-medium bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                            >
                                {verifying ? 'Verifying...' : 'Verify'}
                            </button>
                        </div>
                        </>
                    )}
                    
                    <button 
                        onClick={() => setIsReportOpen(false)}
                        className="p-1 text-gray-500 hover:text-gray-700 border border-gray-300 rounded ml-2"
                        title="Hide Report Panel"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </>
              )}
            </div>

            {/* Right Section - Action Buttons */}
            <div className="flex items-center space-x-2">
              {(isReportOpen && !isVerifierMode) && (
                <>
                  <button
                    onClick={handleSaveDraft}
                    disabled={saving || !reportContent.trim()}
                    className="px-3 py-1 text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200 rounded hover:bg-gray-200 disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save Draft'}
                  </button>
                  <button
                    onClick={handleFinalizeReport}
                    disabled={finalizing || !reportContent.trim()}
                    className="px-3 py-1 text-xs font-medium bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                  >
                    {finalizing ? 'Finalizing...' : `Finalize as ${exportFormat.toUpperCase()}`}
                  </button>
                </>
              )}
              <button
                onClick={handleBackToWorklist}
                className="px-3 py-1 text-xs font-medium text-gray-600 border border-gray-200 rounded hover:bg-gray-50 transition-colors"
              >
                {isVerifierMode ? 'Back to Verifier' : 'Back to Dashboard'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area - FLEX 1 MIN-H-0 ensures scroll inside children, not window */}
      <div className="flex-1 flex min-h-0">
        
        {/* LEFT PANEL - OHIF Viewer */}
        <div 
          className="bg-black border-r border-gray-200 flex flex-col transition-all duration-300 ease-in-out h-full"
          style={{ width: isReportOpen ? `${leftPanelWidth}%` : '100%' }}
        >
          <div className="flex-1 h-full w-full">
            {ohifViewerUrl ? (
              <iframe
                id="ohif-viewer-iframe"
                src={ohifViewerUrl}
                className="w-full h-full border-0"
                title="OHIF DICOM Viewer"
                allow="cross-origin-isolated"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                  <p className="text-sm">Loading OHIF viewer...</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL - Report Editor */}
        <div 
          className="bg-white flex flex-col transition-all duration-300 ease-in-out h-full"
          style={{ 
              width: isReportOpen ? `${100 - leftPanelWidth}%` : '0%',
              opacity: isReportOpen ? 1 : 0,
              overflow: 'hidden'
          }}
        >
          <div className="flex-1 min-h-0 h-full overflow-hidden flex flex-col">
            <ReportEditor
              content={reportContent}
              onChange={setReportContent}
            />
          </div>
        </div>
      </div>

      {/* Selected Template Indicator */}
      {(selectedTemplate && isReportOpen) && (
        <div className="fixed bottom-4 right-4 z-40 bg-white border border-gray-200 rounded-lg shadow-lg p-3 max-w-xs">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0 mr-2">
              <p className="text-sm font-medium text-gray-900 truncate">📋 {selectedTemplate.title}</p>
            </div>
            <button onClick={() => setSelectedTemplate(null)} className="p-1 hover:bg-gray-100 rounded">
              <XCircle className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OnlineReportingSystemWithOHIF;