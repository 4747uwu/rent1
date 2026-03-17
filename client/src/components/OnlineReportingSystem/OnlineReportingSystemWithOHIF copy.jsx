import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import api from '../../services/api';
import toast, { Toaster } from 'react-hot-toast';
import ReportEditor from './ReportEditorWithOhif';
import DoctorTemplateDropdown from './DoctorTemplateDropdown';
import AllTemplateDropdown from './AllTemplateDropdown';
import sessionManager from '../../services/sessionManager';
import TemplateSearchPanel from './TemplateSearchPanel.jsx';
// also add BookOpen to the lucide-react import line:
import { CheckCircle, XCircle, Edit, Camera, FileText, ChevronRight, ChevronLeft, Plus, Layers, Trash2, BookOpen, Save } from 'lucide-react';
import useWebSocket from '../../hooks/useWebSocket';
import { useAuth } from '../../hooks/useAuth'; // ✅ ADD this import at top
import { StudyDocumentsManager } from '../StudyDocuments/StudyDocumentsManager';

const OnlineReportingSystemWithOHIF = () => {
  const { studyId } = useParams();
  const { sendMessage, readyState } = useWebSocket();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const { getDashboardRoute } = useAuth(); // ✅ ADD this

  const [isReportOpen, setIsReportOpen] = useState(false);

  const passedStudy = location.state?.study;
  const passedStudyInstanceUID = passedStudy?.studyInstanceUID || passedStudy?.studyInstanceUIDs || null;

  const [loading, setLoading] = useState(true);
  const [studyData, setStudyData] = useState(null);
  const [patientData, setPatientData] = useState(null);
  const [templates, setTemplates] = useState({});
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [reportData, setReportData] = useState({});
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const isFinalizedRef = useRef(false); // ✅ ADD: tracks finalization state across closures
  const [exportFormat, setExportFormat] = useState('docx');

  // ✅ ADD: Auto-save state
  const [autoSaveStatus, setAutoSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'
  const [lastAutoSaved, setLastAutoSaved] = useState(null);
  const autoSaveIntervalRef = useRef(null);
  const autoSaveStatusTimerRef = useRef(null);

  const [ohifViewerUrl, setOhifViewerUrl] = useState('');
  const [downloadOptions, setDownloadOptions] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(50);

  // ✅ MULTI-REPORT STATE — replaces single reportContent
  const [reports, setReports] = useState([{ id: 1, content: '', capturedImages: [], template: null }]);
  const [activeReportIndex, setActiveReportIndex] = useState(0);
  const [showReportDropdown, setShowReportDropdown] = useState(false);
  const reportDropdownRef = useRef(null);

  const [showSaveAsTemplate, setShowSaveAsTemplate] = useState(false);
  const [saveTemplateForm, setSaveTemplateForm] = useState({ name: '', category: '' });
  const [savingAsTemplate, setSavingAsTemplate] = useState(false);

  const editorRef = useRef(null);
  const [showTemplateSearch, setShowTemplateSearch] = useState(false);

  const handleInsertFromSearch = (html) => {
    editorRef.current?.insertHTML(html);
  };

  const handleOpenSaveAsTemplate = () => {
    setSaveTemplateForm({
      name: '',
      category: studyData?.modality || 'General',
    });
    setShowSaveAsTemplate(true);
  };

  const handleSaveAsTemplate = async () => {
    if (!saveTemplateForm.name.trim()) {
      toast.error('Please enter a template name');
      return;
    }
    if (!reportContent?.trim()) {
      toast.error('Report is empty — nothing to save');
      return;
    }
    try {
      setSavingAsTemplate(true);
      const htmlContent = cleanTemplateHTML(reportContent);
      await api.post('/html-templates', {
        title: saveTemplateForm.name.trim(),
        category: saveTemplateForm.category || 'General',
        htmlContent,
      });
      toast.success('Template saved successfully!');
      setShowSaveAsTemplate(false);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save template');
    } finally {
      setSavingAsTemplate(false);
    }
  };

  // ✅ Helpers to get/set current report data
  const activeReport = reports[activeReportIndex] || reports[0];
  const reportContent = activeReport.content;
  const capturedImages = activeReport.capturedImages;
  const [showDocuments, setShowDocuments] = useState(false);

  const setReportContent = (content) => {
    setReports(prev => prev.map((r, i) => i === activeReportIndex ? { ...r, content } : r));
  };

  const setCapturedImages = (images) => {
    setReports(prev => prev.map((r, i) => i === activeReportIndex ? { ...r, capturedImages: typeof images === 'function' ? images(r.capturedImages) : images } : r));
  };


  //  const [saving, setSaving] = useState(false);
  // const [finalizing, setFinalizing] = useState(false);
  // const [exportFormat, setExportFormat] = useState('docx');

  // // ✅ ADD: Auto-save state
  // const [autoSaveStatus, setAutoSaveStatus] = useState('idle');
  // const [lastAutoSaved, setLastAutoSaved] = useState(null);
  // const autoSaveIntervalRef = useRef(null);
  // const autoSaveStatusTimerRef = useRef(null);

  // ...existing code...


  // ✅ Add new report
  const handleAddReport = () => {
    const newReport = { id: Date.now(), content: '', capturedImages: [], template: null };
    setReports(prev => [...prev, newReport]);
    setActiveReportIndex(reports.length);
    setIsReportOpen(true);
    setShowReportDropdown(false);
    toast.success(`Report ${reports.length + 1} added`, { icon: '➕' });
  };

  // ✅ Remove report
  const handleRemoveReport = (index) => {
    if (reports.length === 1) { toast.error('Must have at least one report'); return; }
    setReports(prev => prev.filter((_, i) => i !== index));
    setActiveReportIndex(Math.max(0, index === activeReportIndex ? index - 1 : activeReportIndex > index ? activeReportIndex - 1 : activeReportIndex));
    setShowReportDropdown(false);
    toast.success(`Report ${index + 1} removed`);
  };

  // ✅ Switch report
  const handleSwitchReport = (index) => {
    if (index >= 0 && index < reports.length) {
      setActiveReportIndex(index);
      setShowReportDropdown(false);
      toast.success(`Switched to Report ${index + 1}`, { duration: 1000 });
    }
  };

  // ✅ Keyboard shortcuts: Alt+N = add, Alt+1-9 = switch, Alt+R = toggle dropdown
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.altKey && e.key.toLowerCase() === 'n') { e.preventDefault(); handleAddReport(); }
      if (e.altKey && e.key.toLowerCase() === 'r') { e.preventDefault(); setShowReportDropdown(prev => !prev); }
      if (e.altKey && /^[1-9]$/.test(e.key)) {
        e.preventDefault();
        const idx = parseInt(e.key) - 1;
        if (idx < reports.length) handleSwitchReport(idx);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [reports.length, activeReportIndex]);

  // ✅ Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (reportDropdownRef.current && !reportDropdownRef.current.contains(e.target)) {
        setShowReportDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
    const attemptSend = () => {
      if (readyState === WebSocket.OPEN && !hasSentStudyOpened.current) {
        sendMessage({ type: 'study_opened', studyId, mode: 'reporting' });
        hasSentStudyOpened.current = true;
      } else if (readyState !== WebSocket.OPEN && !hasSentStudyOpened.current) {
        sendAttemptTimeout.current = setTimeout(attemptSend, 1000);
      }
    };
    initialDelayTimeout.current = setTimeout(attemptSend, 4000);
    return () => {
      if (sendAttemptTimeout.current) clearTimeout(sendAttemptTimeout.current);
      if (initialDelayTimeout.current) clearTimeout(initialDelayTimeout.current);
      if (hasSentStudyOpened.current && readyState === WebSocket.OPEN) {
        sendMessage({ type: 'study_closed', studyId });
        hasSentStudyOpened.current = false;
      }
    };
  }, [studyId, readyState, sendMessage]);

  useEffect(() => {
    if (studyId) {
      setStudyData(null);
      setPatientData(null);
      setSelectedTemplate(null);
      setReportData({});
      setReports([{ id: 1, content: '', capturedImages: [], template: null }]);
      setActiveReportIndex(0);
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
      if (!currentUser) { toast.error('Authentication required.'); navigate('/login'); return; }

      const urlParams = new URLSearchParams(window.location.search);
      const reportIdParam = urlParams.get('reportId');
      const actionParam = urlParams.get('action');

      let existingReportEndpoint = `/reports/studies/${studyId}/edit-report`;
      if (reportIdParam && actionParam === 'edit') {
        existingReportEndpoint = `/reports/studies/${studyId}/edit-report?reportId=${reportIdParam}`;
      }

      const [studyInfoResponse, templatesResponse, existingReportResponse, allReportsResponse] = await Promise.allSettled([
        api.get(`/documents/study/${studyId}/reporting-info`),
        api.get('/html-templates/reporting'),
        api.get(existingReportEndpoint),
        api.get(`/reports/studies/${studyId}/all-reports`) // ✅ NEW: fetch all reports
      ]);

      if (studyInfoResponse.status === 'fulfilled' && studyInfoResponse.value.data.success) {
        const data = studyInfoResponse.value.data.data;
        const studyInfo = data.studyInfo || {};
        const patientInfo = data.patientInfo || {};
        const allStudies = data.allStudies || [];
        const currentStudy = allStudies.find(s => s.studyId === studyId) || studyInfo;

        const orthancStudyID = currentStudy.orthancStudyID || currentStudy.studyId || studyInfo.studyId || null;
        const studyInstanceUID = passedStudyInstanceUID || currentStudy.studyInstanceUID || currentStudy.studyId || studyInfo.studyInstanceUID || studyInfo.studyId || null;

        if (studyInstanceUID) {
          const OHIF_VIEWERS = {
            viewer1: 'https://viewer.bharatpacs.com/viewer',
            viewer2: 'https://viewer2.bharatpacs.com/viewer',
          };

          const viewerPref = urlParams.get('viewer') || localStorage.getItem('preferredOhifViewer') || 'viewer1';
          let studyUIDs = Array.isArray(studyInstanceUID) ? studyInstanceUID.join(',') : (typeof studyInstanceUID === 'string' && studyInstanceUID.trim()) ? studyInstanceUID.trim() : orthancStudyID;

          if (studyUIDs) {
            // Apply conditional formatting
            const formattedUrl = viewerPref === 'viewer2'
              ? `${OHIF_VIEWERS.viewer2}/${studyUIDs}` // Path format
              : `${OHIF_VIEWERS.viewer1}?StudyInstanceUIDs=${encodeURIComponent(studyUIDs)}`; // Query format

            setOhifViewerUrl(formattedUrl);
          }
        }

        setStudyData({ _id: studyId, ...currentStudy, ...studyInfo });
        setPatientData({ ...patientInfo, fullName: patientInfo.fullName || patientInfo.patientName || 'Unknown Patient' });
        setDownloadOptions({
          downloadOptions: { hasR2CDN: data.downloadOptions?.hasR2CDN || false, zipStatus: data.downloadOptions?.zipStatus || 'not_started' },
          orthancStudyID, studyInstanceUID
        });

        const currentReferring = (data.referringPhysicians || {}).current || {};
        setReportData({
          referringPhysician: currentReferring.name || currentStudy.referringPhysician || studyInfo.referringPhysician || 'N/A',
          clinicalHistory: (() => {
            const h = patientInfo.clinicalHistory || data.clinicalHistory;
            if (typeof h === 'string') return h;
            if (typeof h === 'object' && h) return h.clinicalHistory || h.previousInjury || h.previousSurgery || 'No clinical history available';
            return 'No clinical history available';
          })()
        });
        // toast.success(`Loaded study: ${currentStudy.accessionNumber || studyId}`);
      }

      if (templatesResponse.status === 'fulfilled' && templatesResponse.value.data.success) {
        setTemplates(templatesResponse.value.data.data.templates);
      }

      // ✅ NEW: Load ALL existing reports if study has multiple
      if (allReportsResponse.status === 'fulfilled' && allReportsResponse.value.data.success) {
        const allReports = allReportsResponse.value.data.data.reports || [];

        if (allReports.length > 1) {
          // ✅ Multiple reports - load all into state
          const loadedReports = allReports.map((r, i) => ({
            id: r._id || `existing-${i}`,
            content: r.reportContent?.htmlContent || '',
            capturedImages: r.reportContent?.capturedImages || [],
            template: r.reportContent?.templateInfo || null,
            existingReportId: r._id,
            reportStatus: r.reportStatus,
            reportType: r.reportType
          }));
          setReports(loadedReports);
          setActiveReportIndex(0);
          setIsReportOpen(true);
          // toast.success(`📝 Loaded ${allReports.length} existing reports`);

          // Load template for first report
          if (allReports[0]?.reportContent?.templateInfo?.templateId) {
            try {
              const tr = await api.get(`/html-templates/${allReports[0].reportContent.templateInfo.templateId}`);
              if (tr.data.success) setSelectedTemplate(tr.data.data);
            } catch (e) { }
          }

          setReportData(prev => ({ ...prev, existingReport: { id: allReports[0]._id, reportType: allReports[0].reportType, reportStatus: allReports[0].reportStatus } }));
          return; // ✅ Skip single report loading below
        }
      }

      // ✅ Fallback: single report loading (original logic)
      if (existingReportResponse.status === 'fulfilled' && existingReportResponse.value.data.success) {
        const existingReport = existingReportResponse.value.data.data.report;
        if (existingReport.reportContent?.htmlContent) {
          setReports([{ id: existingReport._id || 1, content: existingReport.reportContent.htmlContent, capturedImages: existingReport.reportContent?.capturedImages || [], template: null, existingReportId: existingReport._id }]);
          // toast.success('📝 Loaded existing report');
          setIsReportOpen(true);
        }
        if (existingReport.reportContent?.templateInfo?.templateId) {
          try {
            const tr = await api.get(`/html-templates/${existingReport.reportContent.templateInfo.templateId}`);
            if (tr.data.success) setSelectedTemplate(tr.data.data);
          } catch (e) { }
        }
        setReportData(prev => ({ ...prev, existingReport: { id: existingReport._id, reportId: existingReport.reportId, reportType: existingReport.reportType, reportStatus: existingReport.reportStatus } }));
      }
    } catch (error) {
      if (error.response?.status === 404) { toast.error(`Study not found.`); setTimeout(() => navigate('/doctor/dashboard'), 2000); }
      else if (error.response?.status === 401) { toast.error('Authentication expired.'); navigate('/login'); }
      else toast.error(`Failed to load study: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAttachOhifImage = () => {
    const iframe = document.getElementById('ohif-viewer-iframe');
    if (iframe?.contentWindow) { iframe.contentWindow.postMessage({ action: 'ATTACH_REPORT_SIGNAL' }, '*'); toast.loading('📸 Capturing...', { duration: 2000 }); }
    else toast.error('❌ OHIF Viewer not ready');
  };

  useEffect(() => {
    const handleOhifMessage = (event) => {
      if (!event.data || event.data.action !== 'OHIF_IMAGE_CAPTURED') return;
      const { image, viewportId, metadata } = event.data;
      setCapturedImages(prev => {
        const newImages = [...prev, { imageData: image, viewportId: viewportId || 'viewport-1', capturedAt: new Date().toISOString(), imageMetadata: { format: 'png', ...metadata }, displayOrder: prev.length }];
        toast.success(`📸 Image captured! ${newImages.length} ready`);
        return newImages;
      });
    };
    window.addEventListener('message', handleOhifMessage);
    return () => window.removeEventListener('message', handleOhifMessage);
  }, [activeReportIndex]);

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
        '--referredby--': reportData?.referringPhysician || '[Referring Physician]',
        '--reporteddate--': new Date().toLocaleDateString(),
        '--studydate--': studyData?.studyDate ? new Date(studyData.studyDate).toLocaleDateString() : '[Study Date]',
        '--modality--': studyData?.modality || '[Modality]',
        '--clinicalhistory--': reportData?.clinicalHistory || '[Clinical History]'
      };

      let processedContent = templateData.htmlContent || '';
      Object.entries(placeholders).forEach(([k, v]) => {
        processedContent = processedContent.replace(new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), v);
      });

      processedContent = cleanTemplateHTML(processedContent);
      setSelectedTemplate(templateData);
      setReportContent(processedContent);
      setIsReportOpen(true);
      try { await api.post(`/html-templates/${template._id}/record-usage`); } catch (e) { }
      toast.success(`Template "${template.title}" applied to Report ${activeReportIndex + 1}!`);
    } catch (error) { toast.error(`Failed to load template: ${error.message}`); }
  };

  const cleanTemplateHTML = (html) => {
    if (!html) return '';
    const temp = document.createElement('div');
    temp.innerHTML = html;
    const removeBoxStyles = (el) => {
      if (el.tagName === 'DIV' || el.tagName === 'SECTION') {
        const s = el.style;
        if (s.boxShadow) s.boxShadow = '';
        if (el.tagName !== 'TABLE' && el.tagName !== 'TD' && el.tagName !== 'TH') {
          if (s.background || s.backgroundColor) { s.background = ''; s.backgroundColor = ''; s.backgroundImage = ''; }
        }
        if (el.tagName !== 'TABLE' && !el.classList.contains('patient-info-table')) {
          if (s.border || s.borderTop) { s.border = ''; s.borderTop = ''; s.borderBottom = ''; s.borderLeft = ''; s.borderRight = ''; }
        }
        if (el.tagName !== 'TABLE' && parseInt(s.padding || 0) > 20) s.padding = '';
        if (parseInt(s.margin || 0) > 20) s.margin = '';
      }
      Array.from(el.children).forEach(removeBoxStyles);
    };
    removeBoxStyles(temp);
    return temp.innerHTML;
  };

  // ✅ Build placeholders (shared helper)
  const buildPlaceholders = (content) => ({
    '--name--': patientData?.fullName || '',
    '--patientid--': patientData?.patientId || '',
    '--accessionno--': studyData?.accessionNumber || '',
    '--agegender--': `${patientData?.age || ''} / ${patientData?.gender || ''}`,
    '--referredby--': reportData?.referringPhysician || 'N/A',
    '--reporteddate--': new Date().toLocaleDateString(),
    '--Content--': content
  });

  const handleSaveDraft = async () => {
    if (!reportContent.trim()) { toast.error('Cannot save an empty draft.'); return; }
    setSaving(true);
    try {
      const currentUser = sessionManager.getCurrentUser();
      const isMulti = reports.length > 1;

      if (isMulti) {
        const emptyReports = reports.filter(r => !r.content.trim());
        if (emptyReports.length > 0) { toast.error(`Report(s) ${emptyReports.map((_, i) => reports.findIndex(r => r === emptyReports[i]) + 1).join(', ')} are empty`); return; }

        const response = await api.post(`/reports/studies/${studyId}/store-multiple`, {
          reports: reports.map(r => ({
            htmlContent: r.content,
            placeholders: buildPlaceholders(r.content),
            capturedImages: r.capturedImages.map(img => ({ ...img, capturedBy: currentUser._id })),
            templateInfo: r.template ? { templateId: r.template._id, templateName: r.template.title } : {},
            format: 'docx', reportType: 'draft', reportStatus: 'draft'
          }))
        });
        if (response.data.success) toast.success(`${reports.length} drafts saved!`, { icon: '📝' });
        else throw new Error(response.data.message);
      } else {
        // ✅ FIX: Use existingReportId from the active report OR reportData
        const existingId = reports[activeReportIndex]?.existingReportId || reportData.existingReport?.id || null;

        const response = await api.post(`/reports/studies/${studyId}/store-draft`, {
          templateName: `${currentUser.email.split('@')[0]}_draft_${Date.now()}.docx`,
          placeholders: buildPlaceholders(reportContent),
          htmlContent: reportContent,
          templateId: selectedTemplate?._id,
          templateInfo: selectedTemplate ? { templateId: selectedTemplate._id, templateName: selectedTemplate.title, templateCategory: selectedTemplate.category, templateTitle: selectedTemplate.title } : null,
          capturedImages: capturedImages.map(img => ({ ...img, capturedBy: currentUser._id })),
          existingReportId: existingId  // ✅ Always pass existing ID
        });
        if (response.data.success) {
          const returnedReportId = response.data.data?.reportId;
          if (returnedReportId) {
            // ✅ Store on both the report and reportData
            setReports(prev => prev.map((r, i) =>
              i === activeReportIndex ? { ...r, existingReportId: returnedReportId } : r
            ));
            if (!existingId) {
              setReportData(prev => ({ ...prev, existingReport: { id: returnedReportId, reportType: 'draft', reportStatus: 'draft' } }));
            }
          }
          toast.success('Draft saved!', { icon: '📝' });
        } else throw new Error(response.data.message);
      }
    } catch (error) { toast.error(`Failed to save draft: ${error.message}`); } finally { setSaving(false); }
  };

  const handleFinalizeReport = async () => {
    if (!reportContent.trim()) { toast.error('Please enter report content.'); return; }
    const isMulti = reports.length > 1;

    if (isMulti) {
      const emptyReports = reports.filter(r => !r.content.trim());
      if (emptyReports.length > 0) { toast.error(`Reports ${emptyReports.map((_, i) => reports.findIndex(r => r === emptyReports[i]) + 1).join(', ')} are empty`); return; }
    }

    if (!window.confirm(`Finalize ${isMulti ? reports.length + ' reports' : 'this report'} as ${exportFormat.toUpperCase()}?`)) return;

    // ✅ FIX: Stop auto-save BEFORE setting finalizing state
    if (autoSaveIntervalRef.current) {
      clearInterval(autoSaveIntervalRef.current);
      autoSaveIntervalRef.current = null;
      console.log('⏹️ [AutoSave] Stopped before finalization');
    }
    isFinalizedRef.current = true; // ✅ Block any in-flight auto-save from writing after finalize

    setFinalizing(true);
    try {
      const currentUser = sessionManager.getCurrentUser();

      if (isMulti) {
        // ✅ MULTI endpoint
        const response = await api.post(`/reports/studies/${studyId}/store-multiple`, {
          reports: reports.map(r => ({
            existingReportId: r.existingReportId || null,
            htmlContent: r.content,
            placeholders: buildPlaceholders(r.content),
            capturedImages: r.capturedImages.map(img => ({ ...img, capturedBy: currentUser._id })),
            templateInfo: r.template ? { templateId: r.template._id, templateName: r.template.title } : {},
            format: exportFormat, reportType: 'finalized', reportStatus: 'finalized'
          }))
        });
        if (response.data.success) {
          toast.success(`${reports.length} reports finalized!`, { icon: '🎉' });
          setTimeout(() => handleBackToWorklist(), 3000);
        } else throw new Error(response.data.message);
      } else {
        // ✅ SINGLE endpoint
        const response = await api.post(`/reports/studies/${studyId}/store-finalized`, {
          templateName: `${currentUser.email.split('@')[0]}_final_${Date.now()}.${exportFormat}`,
          placeholders: buildPlaceholders(reportContent),
          htmlContent: reportContent,
          format: exportFormat,
          templateId: selectedTemplate?._id,
          templateInfo: selectedTemplate
            ? { templateId: selectedTemplate._id, templateName: selectedTemplate.title, templateCategory: selectedTemplate.category, templateTitle: selectedTemplate.title }
            : null,
          capturedImages: capturedImages.map(img => ({ ...img, capturedBy: currentUser._id }))
        });
        if (response.data.success) {
          toast.success(`Report finalized as ${exportFormat.toUpperCase()}! Closing...`, { icon: '🎉' });
          setTimeout(() => window.close(), 2500); // ✅ close tab
        } else throw new Error(response.data.message);
      }
    } catch (error) {
      toast.error(`Failed to finalize: ${error.message}`);
      isFinalizedRef.current = false; // ✅ Reset on failure so auto-save can resume
    } finally {
      setFinalizing(false);
    }
  };

  const handleUpdateReport = async () => {
    if (!reportContent.trim()) { toast.error('Cannot update an empty report.'); return; }
    setSaving(true);
    try {
      const response = await api.post(`/verifier/studies/${studyId}/update-report`, {
        htmlContent: reportContent,
        verificationNotes: 'Report updated during verification',
        templateId: selectedTemplate?._id,
        templateInfo: selectedTemplate
          ? { templateId: selectedTemplate._id, templateName: selectedTemplate.title, templateCategory: selectedTemplate.category, templateTitle: selectedTemplate.title }
          : null,
        maintainFinalizedStatus: true
      });
      if (response.data.success) toast.success('Report updated!', { icon: '✏️' });
      else throw new Error(response.data.message);
    } catch (error) { toast.error(`Failed to update: ${error.message}`); } finally { setSaving(false); }
  };

  const handleVerifyReport = async () => {
    if (!reportContent.trim()) { toast.error('Report content is required for verification.'); return; }
    if (!window.confirm('Verify this report?')) return;
    setVerifying(true);
    try {
      const response = await api.post(`/verifier/studies/${studyId}/verify`, { approved: true, verificationNotes: 'Verified via OHIF', corrections: [], verificationTimeMinutes: 0 });
      if (response.data.success) {
        toast.success('Report verified! Closing tab...', { icon: '✅' });
        setTimeout(() => window.close(), 2500); // ✅ close tab instead of navigate
      } else throw new Error(response.data.message);
    } catch (error) { toast.error(`Failed to verify: ${error.message}`); } finally { setVerifying(false); }
  };

  const handleRejectReport = async () => {
    const reason = prompt('Reason To Revert:');
    if (!reason?.trim()) { toast.error('Revert reason is required.'); return; }
    if (!window.confirm('Revert this report?')) return;
    setRejecting(true);
    try {
      const response = await api.post(`/verifier/studies/${studyId}/verify`, { approved: false, verificationNotes: reason, rejectionReason: reason, corrections: [], verificationTimeMinutes: 0 });
      if (response.data.success) {
        toast.success('Report Reverted! Closing tab...', { icon: '❌' });
        setTimeout(() => window.close(), 2500); // ✅ close tab instead of navigate
      } else throw new Error(response.data.message);
    } catch (error) { toast.error(`Failed to Revert: ${error.message}`); } finally { setRejecting(false); }
  };

  const handleBackToWorklist = () => {
    const route = getDashboardRoute(); // ✅ uses currentUser.role from authContext
    console.log(`🔙 [Back] Role: ${currentUser?.role} → Redirecting to: ${route}`);
    navigate(route);
  };



  // ✅ ADD: Auto-save handler — must be defined BEFORE the useEffect that uses it
  const handleAutoSave = useCallback(async () => {
    const currentContent = reports[activeReportIndex]?.content || '';
    const textContent = currentContent.replace(/<[^>]*>/g, '').trim();

    if (!textContent || saving || finalizing || isVerifierMode || isFinalizedRef.current) {
      console.log('⏭️ [AutoSave] Skipped — empty content, already saving, or finalized');
      return;
    }

    setAutoSaveStatus('saving');
    try {
      const currentUser = sessionManager.getCurrentUser();

      // ✅ FIX: Check BOTH reportData.existingReport AND the active report's own existingReportId
      const existingId = reports[activeReportIndex]?.existingReportId || reportData.existingReport?.id || null;

      const response = await api.post(`/reports/studies/${studyId}/store-draft`, {
        templateName: `${currentUser.email.split('@')[0]}_autosave_${Date.now()}.docx`,
        placeholders: buildPlaceholders(currentContent),
        htmlContent: currentContent,
        templateId: selectedTemplate?._id,
        templateInfo: selectedTemplate
          ? { templateId: selectedTemplate._id, templateName: selectedTemplate.title, templateCategory: selectedTemplate.category, templateTitle: selectedTemplate.title }
          : null,
        capturedImages: (reports[activeReportIndex]?.capturedImages || []).map(img => ({ ...img, capturedBy: currentUser._id })),
        existingReportId: existingId,  // ✅ Always send the correct ID
        reportStatus: 'report_drafted',
        isAutoSave: true
      });

      if (response.data.success) {
        const returnedReportId = response.data.data?.reportId;

        if (returnedReportId) {
          // ✅ FIX: Save reportId BOTH in active report state AND in reportData
          setReports(prev => prev.map((r, i) =>
            i === activeReportIndex
              ? { ...r, existingReportId: returnedReportId }  // ✅ Store on the report itself
              : r
          ));

          if (!existingId) {
            setReportData(prev => ({
              ...prev,
              existingReport: {
                id: returnedReportId,
                reportType: 'draft',
                reportStatus: 'report_drafted'
              }
            }));
          }
        }

        setAutoSaveStatus('saved');
        setLastAutoSaved(new Date());
        console.log('✅ [AutoSave] Saved at', new Date().toLocaleTimeString(), '| reportId:', returnedReportId);
      } else {
        setAutoSaveStatus('error');
        console.warn('⚠️ [AutoSave] Server returned failure:', response.data.message);
      }
    } catch (error) {
      console.error('❌ [AutoSave] Failed:', error);
      setAutoSaveStatus('error');
    } finally {
      if (autoSaveStatusTimerRef.current) clearTimeout(autoSaveStatusTimerRef.current);
      autoSaveStatusTimerRef.current = setTimeout(() => setAutoSaveStatus('idle'), 3000);
    }
  }, [reports, activeReportIndex, saving, finalizing, isVerifierMode, studyId, selectedTemplate, reportData, buildPlaceholders]);

  // ✅ ADD: Start/stop auto-save interval when report panel opens/closes
  useEffect(() => {
    // Clear any existing interval first
    if (autoSaveIntervalRef.current) {
      clearInterval(autoSaveIntervalRef.current);
      autoSaveIntervalRef.current = null;
    }

    if (isReportOpen && !isVerifierMode) {
      console.log('⏱️ [AutoSave] Starting auto-save interval (every 10s)');
      autoSaveIntervalRef.current = setInterval(handleAutoSave, 10000);
    } else {
      console.log('⏹️ [AutoSave] Auto-save stopped');
    }

    // Cleanup on unmount or dependency change
    return () => {
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current);
        autoSaveIntervalRef.current = null;
      }
    };
  }, [isReportOpen, isVerifierMode, handleAutoSave]); // ✅ handleAutoSave in deps so it uses fresh state

  // ✅ ADD: Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoSaveIntervalRef.current) clearInterval(autoSaveIntervalRef.current);
      if (autoSaveStatusTimerRef.current) clearTimeout(autoSaveStatusTimerRef.current);
    };
  }, []);

  if (loading) {
    return (
      <div className="h-screen w-full bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-black border-t-transparent mx-auto mb-3"></div>
          <p className="text-gray-600 text-xs">Loading study {studyId}...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="h-screen w-full bg-gray-50 flex flex-col overflow-hidden border-b-4 border-blue-600">

        {/* ✅ Single Toaster - bottom-left */}
        <Toaster
          position="bottom-left"
          toastOptions={{
            duration: 3000,
            style: {
              fontSize: '12px',
              maxWidth: '320px',
              padding: '8px 12px',
              borderRadius: '6px'
            },
            success: {
              duration: 2500,
              style: { background: '#10b981', color: '#fff' }
            },
            error: {
              duration: 3000,
              style: { background: '#ef4444', color: '#fff' }
            },
            loading: {
              style: { background: '#3b82f6', color: '#fff' }
            }
          }}
        />

        {/* Top Control Bar */}
        <div className="flex-shrink-0 bg-white border-b border-gray-200 shadow-sm z-50">
          <div className="px-3 py-2">
            <div className="flex items-center justify-between gap-4">

              {/* Left — Study Info */}
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  <div className="p-1 bg-gray-600 rounded">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="text-xs">
                    <div className="flex flex-row gap-4">
                      <div className="flex items-center gap-4">
                        <span className="font-medium text-gray-900 truncate uppercase" title={patientData?.fullName || ''}>
                          {(patientData?.fullName || 'Loading...').toString().toUpperCase()}
                        </span>
                        <span className="text-gray-500 text-[11px] uppercase">
                          {(studyData?.accessionNumber || (studyId ? `${String(studyId).substring(0, 8)}...` : '')).toString().toUpperCase()}
                        </span>
                        <span className="text-[11px] text-gray-600 ml-2 uppercase">
                          <strong>AGE:</strong> {(patientData?.age || studyData?.patientAge || 'N/A').toString().toUpperCase()}
                          {(patientData?.gender || studyData?.patientSex) ? ` / ${(patientData?.gender || studyData?.patientSex).toString().toUpperCase()}` : ''}
                        </span>
                      </div>
                      <div className="text-[12px] text-gray-700 truncate max-w-xs" title={reportData?.clinicalHistory || ''}>
                        <span className="font-medium text-gray-600 mr-1 uppercase">CLINICAL HISTORY:</span>
                        <span className="font-normal uppercase">{(reportData?.clinicalHistory || 'No clinical history').toString().toUpperCase()}</span>
                      </div>
                      <button
                        onClick={() => setShowDocuments(true)}
                        className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-100 transition-colors"
                      >
                        <FileText className="w-3 h-3" /> Docs
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-3 text-xs text-gray-600">
                  <span>{studyData?.modality || 'N/A'}</span>
                  <span>•</span>
                  <span>{studyData?.studyDate ? new Date(studyData.studyDate).toLocaleDateString() : 'N/A'}</span>
                </div>
              </div>

              {/* Center — Controls */}
              <div className="flex items-center space-x-3">
                {!isReportOpen && (
                  <button onClick={() => setIsReportOpen(true)} className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white rounded-md shadow hover:bg-blue-700 transition-all font-medium text-sm animate-pulse">
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
                          <DoctorTemplateDropdown onTemplateSelect={handleTemplateSelect} selectedTemplate={selectedTemplate?.templateScope === 'doctor_specific' ? selectedTemplate : null} />
                          <AllTemplateDropdown onTemplateSelect={handleTemplateSelect} selectedTemplate={selectedTemplate} />
                        </div>
                        <div className="h-6 w-px bg-gray-300"></div>
                        <button
                          onClick={handleAttachOhifImage}
                          className="relative flex items-center space-x-1 px-3 py-1 text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 rounded hover:bg-indigo-100 transition-colors"
                          title="Capture active viewport"
                        >
                          <Camera className="w-3 h-3" />
                          <span>Capture</span>
                          {capturedImages.length > 0 && (
                            <span className="absolute -top-2 -right-2 flex items-center justify-center min-w-[18px] h-4 px-1 text-[9px] font-bold text-white bg-green-500 rounded-full border border-white">
                              {capturedImages.length}
                            </span>
                          )}
                        </button>
                        <div className="flex items-center space-x-2">
                          <label className="text-xs font-medium text-gray-700">Layout:</label>
                          <select value={leftPanelWidth} onChange={(e) => setLeftPanelWidth(parseInt(e.target.value))} className="px-2 py-1 text-xs border border-gray-200 rounded bg-white">
                            {widthOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </div>

                        <button
                          onClick={() => setShowTemplateSearch(prev => !prev)}
                          className={`flex items-center space-x-1 px-3 py-1 text-xs font-medium border rounded transition-colors ${showTemplateSearch
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                            }`}
                          title="Search inside templates (insert at cursor)"
                        >
                          <BookOpen className="w-3 h-3" />
                          <span>Find</span>
                        </button>


                        <button
                          onClick={handleOpenSaveAsTemplate}
                          disabled={!reportContent?.trim()}
                          className="flex items-center space-x-1 px-3 py-1 text-xs font-medium bg-green-50 text-green-700 border border-green-200 rounded hover:bg-green-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Save current report content as a reusable template"
                        >
                          <Save className="w-3 h-3" />
                          <span>Save as Template</span>
                        </button>

                      </>
                    ) : (
                      <>
                        <div className="flex items-center space-x-2">
                          <label className="text-xs font-medium text-purple-700">Layout:</label>
                          <select value={leftPanelWidth} onChange={(e) => setLeftPanelWidth(parseInt(e.target.value))} className="px-1.5 py-0.5 text-xs border border-purple-200 rounded bg-white">
                            {widthOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </div>
                        <div className="h-6 w-px bg-purple-300"></div>
                        <div className="flex items-center space-x-1">

                          <button onClick={handleRejectReport} disabled={rejecting} className="px-2 py-1 text-xs font-medium bg-red-600 text-white rounded disabled:opacity-50">{rejecting ? 'Reverting...' : 'Revert'}</button>
                          <button onClick={handleVerifyReport} disabled={verifying || !reportContent.trim()} className="px-2 py-1 text-xs font-medium bg-green-600 text-white rounded disabled:opacity-50">{verifying ? 'Verifying...' : 'Verify'}</button>
                        </div>
                      </>
                    )}
                    <button onClick={() => setIsReportOpen(false)} className="p-1 text-gray-500 hover:text-gray-700 border border-gray-300 rounded ml-2" title="Hide Report Panel">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>

              {/* Right — Actions + REPORT SWITCHER */}
              <div className="flex items-center space-x-1.5">

                {/* ✅ ADD: Auto-save status indicator */}
                {isReportOpen && !isVerifierMode && (
                  <div className={`flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-medium transition-all ${autoSaveStatus === 'saving' ? 'border-blue-200 bg-blue-50' :
                      autoSaveStatus === 'saved' ? 'border-green-200 bg-green-50' :
                        autoSaveStatus === 'error' ? 'border-red-200 bg-red-50' :
                          'border-gray-200 bg-gray-50'
                    }`}>
                    {autoSaveStatus === 'saving' && (
                      <><div className="animate-spin rounded-full h-2 w-2 border border-blue-500 border-t-transparent" /><span className="text-blue-600">Saving...</span></>
                    )}
                    {autoSaveStatus === 'saved' && (
                      <><div className="w-2 h-2 rounded-full bg-green-500" /><span className="text-green-600">Saved {lastAutoSaved?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span></>
                    )}
                    {autoSaveStatus === 'error' && (
                      <><div className="w-2 h-2 rounded-full bg-red-500" /><span className="text-red-600">Save failed</span></>
                    )}
                    {autoSaveStatus === 'idle' && (
                      <><div className="w-2 h-2 rounded-full bg-gray-300" /><span className="text-gray-400">Auto-save on</span></>
                    )}
                  </div>
                )}

                {/* ✅ Save, Finalize buttons */}
                {(isReportOpen && !isVerifierMode) && (
                  <>
                    <button
                      onClick={handleSaveDraft}
                      disabled={saving || !reportContent.trim()}
                      className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200 rounded hover:bg-gray-200 disabled:opacity-50 whitespace-nowrap"
                    >
                      {saving ? (
                        <span className="flex items-center gap-1">
                          <div className="animate-spin rounded-full h-2 w-2 border border-gray-500 border-t-transparent"></div>
                          <span className="hidden sm:inline">Saving...</span>
                        </span>
                      ) : 'Save'}
                    </button>
                    <button
                      onClick={handleFinalizeReport}
                      disabled={finalizing || !reportContent.trim()}
                      className="px-2 py-1 text-xs font-medium bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 whitespace-nowrap"
                    >
                      {finalizing ? (
                        <span className="flex items-center gap-1">
                          <div className="animate-spin rounded-full h-2 w-2 border border-white border-t-transparent"></div>
                          <span className="hidden sm:inline">Finalizing...</span>
                        </span>
                      ) : `Final${reports.length > 1 ? ` (${reports.length})` : ''}`}
                    </button>
                  </>
                )}

                {/* ✅ REPORT SWITCHER DROPDOWN — always visible for doctors */}

                <div className="relative" ref={reportDropdownRef}>
                  <button
                    onClick={() => setShowReportDropdown(prev => !prev)}
                    className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border transition-colors ${reports.length > 1
                        ? 'bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100'
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                      }`}
                    title="Alt+R: Toggle | Alt+1-9: Switch | Alt+N: Add"
                  >
                    <Layers className="w-3 h-3" />
                    <span className="hidden sm:inline">{activeReportIndex + 1}/{reports.length}</span>
                    <span
                      className="ml-0.5 w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 flex-shrink-0"
                      onClick={(e) => { e.stopPropagation(); handleAddReport(); }}
                      title="Add report (Alt+N)"
                    >
                      <Plus className="w-2.5 h-2.5" />
                    </span>
                  </button>

                  {showReportDropdown && (
                    <div className="absolute top-full right-0 mt-1 w-52 bg-white border border-gray-200 rounded-lg shadow-xl z-50">
                      {/* Header */}
                      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50 rounded-t-lg">
                        <span className="text-[11px] font-bold text-gray-700 uppercase">Reports</span>
                        <button
                          onClick={handleAddReport}
                          className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-blue-600 text-white rounded hover:bg-blue-700"
                          title="Alt+N"
                        >
                          <Plus className="w-3 h-3" /> Add
                        </button>
                      </div>

                      {/* Report List */}
                      <div className="max-h-48 overflow-y-auto">
                        {reports.map((report, index) => (
                          <div
                            key={report.id}
                            className={`flex items-center justify-between px-3 py-2 cursor-pointer transition-colors border-b border-gray-50 last:border-b-0 ${index === activeReportIndex ? 'bg-blue-50' : 'hover:bg-gray-50'
                              }`}
                            onClick={() => handleSwitchReport(index)}
                          >
                            <div className="flex items-center gap-2">
                              <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center flex-shrink-0 ${index === activeReportIndex ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                                }`}>
                                {index + 1}
                              </span>
                              <div>
                                <div className={`text-[11px] font-medium ${index === activeReportIndex ? 'text-blue-700' : 'text-gray-700'}`}>
                                  Report {index + 1}
                                  {report.reportStatus && (
                                    <span className={`ml-1 text-[9px] px-1 rounded ${report.reportStatus === 'finalized' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                      {report.reportStatus}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[9px] text-gray-400">
                                  {report.content.trim() ? `${report.content.replace(/<[^>]*>/g, '').substring(0, 20)}...` : 'Empty'}
                                  {report.capturedImages.length > 0 && ` • ${report.capturedImages.length} img`}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              {index === activeReportIndex && <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>}
                              {reports.length > 1 && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleRemoveReport(index); }}
                                  className="p-0.5 hover:bg-red-50 rounded text-gray-400 hover:text-red-500"
                                  title="Remove"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Shortcuts hint */}
                      <div className="px-3 py-1.5 border-t border-gray-100 bg-gray-50 rounded-b-lg flex gap-3">
                        <span className="text-[9px] text-gray-500"><kbd className="bg-white border border-gray-300 rounded px-1">Alt+R</kbd> toggle</span>
                        <span className="text-[9px] text-gray-500"><kbd className="bg-white border border-gray-300 rounded px-1">Alt+1-9</kbd> switch</span>
                        <span className="text-[9px] text-gray-500"><kbd className="bg-white border border-gray-300 rounded px-1">Alt+N</kbd> add</span>
                      </div>
                    </div>
                  )}
                </div>


                <button
                  onClick={handleBackToWorklist}
                  className="px-2 py-1 text-xs font-medium text-gray-600 border border-gray-200 rounded hover:bg-gray-50 whitespace-nowrap"
                >
                  {isVerifierMode ? 'Back' : 'Back'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex min-h-0">
          {/* LEFT — OHIF */}
          <div className="bg-black border-r border-gray-200 flex flex-col transition-all duration-300 ease-in-out h-full" style={{ width: isReportOpen ? `${leftPanelWidth}%` : '100%' }}>
            <div className="flex-1 h-full w-full">
              {ohifViewerUrl ? (
                <iframe id="ohif-viewer-iframe" src={ohifViewerUrl} className="w-full h-full border-0" title="OHIF DICOM Viewer" allow="cross-origin-isolated" />
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

          {/* RIGHT — Report Editor */}
          <div
            className="bg-white flex flex-col transition-all duration-300 ease-in-out h-full"
            style={{ width: isReportOpen ? `${100 - leftPanelWidth}%` : '0%', opacity: isReportOpen ? 1 : 0, overflow: 'hidden' }}
          >
            <div className="flex-1 min-h-0 h-full overflow-hidden flex flex-row">
              <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
                <ReportEditor
                  key={`report-${activeReport.id}`}
                  ref={editorRef}
                  content={reportContent}
                  onChange={setReportContent}
                />
              </div>
              <TemplateSearchPanel
                isOpen={showTemplateSearch}
                onClose={() => setShowTemplateSearch(false)}
                onInsert={handleInsertFromSearch}
                templateList={Object.values(templates).flat()}
              />
            </div>
          </div>
        </div>

        {/* Template Indicator */}
        {selectedTemplate && isReportOpen && (
          <div className="fixed bottom-4 right-4 z-40 bg-white border border-gray-200 rounded-lg shadow-lg p-3 max-w-xs">
            <div className="flex items-start justify-between">
              <p className="text-sm font-medium text-gray-900 truncate mr-2">📋 {selectedTemplate.title}</p>
              <button onClick={() => setSelectedTemplate(null)} className="p-1 hover:bg-gray-100 rounded">
                <XCircle className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>
        )}

      </div>


      <StudyDocumentsManager
        studyId={studyId}
        isOpen={showDocuments}
        onClose={() => setShowDocuments(false)}
        studyMeta={{ patientName: patientData?.fullName, accessionNumber: studyData?.accessionNumber }}
      />


      {showSaveAsTemplate && (
        <>
          <div
            className="fixed inset-0 z-[300] bg-black/50"
            onClick={() => setShowSaveAsTemplate(false)}
          />
          <div className="fixed z-[310] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-2xl border border-gray-200 w-[420px]">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 bg-green-50 border-b border-green-100 rounded-t-xl">
              <div className="flex items-center gap-2">
                <Save className="w-4 h-4 text-green-600" />
                <span className="text-sm font-bold text-green-900">Save as Template</span>
              </div>
              <button
                onClick={() => setShowSaveAsTemplate(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <XCircle className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Template Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  autoFocus
                  value={saveTemplateForm.name}
                  onChange={(e) => setSaveTemplateForm(f => ({ ...f, name: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveAsTemplate(); if (e.key === 'Escape') setShowSaveAsTemplate(false); }}
                  placeholder="e.g. CT Brain Routine"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Category</label>
                <select
                  value={saveTemplateForm.category}
                  onChange={(e) => setSaveTemplateForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 bg-white"
                >
                  {['General', 'CT', 'CR', 'CT SCREENING FORMAT', 'ECHO', 'EEG-TMT-NCS', 'MR', 'MRI SCREENING FORMAT', 'PT', 'US', 'Other'].map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                {studyData?.modality && (
                  <p className="mt-1 text-[10px] text-gray-400">Auto-filled from study modality: <strong>{studyData.modality}</strong></p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100 rounded-b-xl bg-gray-50">
              <button
                onClick={() => setShowSaveAsTemplate(false)}
                className="px-4 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAsTemplate}
                disabled={savingAsTemplate || !saveTemplateForm.name.trim()}
                className="px-4 py-1.5 text-xs font-bold bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <Save className="w-3 h-3" />
                {savingAsTemplate ? 'Saving…' : 'Save Template'}
              </button>
            </div>
          </div>
        </>
      )}

    </>



  );

};

export default OnlineReportingSystemWithOHIF;