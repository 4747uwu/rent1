import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import toast, { Toaster } from 'react-hot-toast';
import ReportEditor from './ReportEditorWithOhif';
import sessionManager from '../../services/sessionManager';
import { Plus, Trash2, ArrowLeft, CheckCircle, ChevronLeft, ChevronRight, User, Hash, Activity, FileText, Loader2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const OnlineReportingSystemEditMode = () => {
  const { studyId } = useParams();
  const navigate = useNavigate();
  const { getDashboardRoute } = useAuth();

  const [loading, setLoading] = useState(true);
  const [studyData, setStudyData] = useState(null);
  const [patientData, setPatientData] = useState(null);
  const [reportData, setReportData] = useState({});
  const [finalizing, setFinalizing] = useState(false);
  const [exportFormat, setExportFormat] = useState('docx');

  const [reports, setReports] = useState([{ id: 1, content: '', capturedImages: [], template: null }]);
  const [activeReportIndex, setActiveReportIndex] = useState(0);

  const activeReport = reports[activeReportIndex] || reports[0];
  const reportContent = activeReport.content;

  const setReportContent = (content) => {
    setReports(prev => prev.map((r, i) => i === activeReportIndex ? { ...r, content } : r));
  };

  useEffect(() => {
    if (studyId) initializeEditor();
  }, [studyId]);

  const initializeEditor = async () => {
    setLoading(true);
    try {
      const [studyRes, reportsRes] = await Promise.allSettled([
        api.get(`/documents/study/${studyId}/reporting-info`),
        api.get(`/reports/studies/${studyId}/all-reports`)
      ]);

      if (studyRes.status === 'fulfilled' && studyRes.value.data.success) {
        const data = studyRes.value.data.data;
        setStudyData(data.studyInfo || {});
        setPatientData(data.patientInfo || {});
        setReportData({
          referringPhysician: data.referringPhysicians?.current?.name || 'N/A',
          clinicalHistory: data.patientInfo?.clinicalHistory || 'No clinical history available'
        });
      }

      if (reportsRes.status === 'fulfilled' && reportsRes.value.data.success) {
        const allReports = reportsRes.value.data.data.reports || [];
        if (allReports.length > 0) {
          setReports(allReports.map((r, i) => ({
            id: r._id || `existing-${i}`,
            content: r.reportContent?.htmlContent || '',
            capturedImages: r.reportContent?.capturedImages || [],
            existingReportId: r._id,
            reportStatus: r.reportStatus
          })));
        }
      }
    } catch (error) {
      toast.error(`Load failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAddReport = () => {
    setReports(prev => [...prev, { id: Date.now(), content: '', capturedImages: [], template: null }]);
    setActiveReportIndex(reports.length);
    toast.success(`Report ${reports.length + 1} added`);
  };

  const handleRemoveReport = (index) => {
    if (reports.length === 1) return;
    const newReports = reports.filter((_, i) => i !== index);
    setReports(newReports);
    setActiveReportIndex(Math.max(0, index - 1));
  };

  const handleFinalizeReport = async () => {
    if (reports.some(r => !r.content.trim())) return toast.error("Reports cannot be empty");
    if (!window.confirm(`Finalize ${reports.length} report(s)?`)) return;

    setFinalizing(true);
    try {
      const response = await api.post(`/reports/studies/${studyId}/store-multiple`, {
        reports: reports.map(r => ({
          existingReportId: r.existingReportId || null,
          htmlContent: r.content,
          format: exportFormat,
          reportType: 'finalized',
          reportStatus: 'finalized'
        }))
      });

      if (response.data.success) {
        toast.success(`Finalized!`);
        setTimeout(() => navigate(getDashboardRoute()), 1500);
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setFinalizing(false);
    }
  };

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-[#F8F9FA]">
      <div className="flex flex-col items-center gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent" />
        <span className="text-sm font-medium text-gray-500 tracking-wide">Preparing Workspace...</span>
      </div>
    </div>
  );

  return (
    <div className="h-screen w-full flex overflow-hidden font-sans antialiased text-gray-900 bg-[#f0f2f5]">
      <Toaster position="top-center" />

      {/* ─── LEFT SIDEBAR — Patient Info + Controls ─── */}
      <aside className="w-[52px] bg-[#1e293b] flex flex-col items-center justify-between py-3 shrink-0">
        {/* Top — Back */}
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all"
            title="Go back"
          >
            <ArrowLeft className="w-4.5 h-4.5" />
          </button>

          <div className="w-6 h-px bg-slate-600" />

          {/* Patient info icons */}
          <div className="flex flex-col items-center gap-2" title={patientData?.fullName || 'Patient'}>
            <div className="w-9 h-9 rounded-xl bg-blue-500/15 flex items-center justify-center" title={patientData?.fullName || 'Patient'}>
              <User className="w-4 h-4 text-blue-400" />
            </div>
            <div className="w-9 h-9 rounded-xl bg-slate-500/15 flex items-center justify-center" title={`ID: ${patientData?.patientId || '—'}`}>
              <Hash className="w-4 h-4 text-slate-400" />
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center" title={`Modality: ${studyData?.modality || '—'}`}>
              <Activity className="w-4 h-4 text-emerald-400" />
            </div>
          </div>
        </div>

        {/* Bottom — Status */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Editor Active" />
        </div>
      </aside>

      {/* ─── MAIN CONTENT ─── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* ─── PATIENT INFO BAR — compact horizontal strip ─── */}
        <div className="h-10 bg-white border-b border-gray-200 flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-4 min-w-0">
            <span className="text-[13px] font-bold text-gray-800 truncate max-w-[220px] uppercase tracking-tight">
              {patientData?.fullName || 'Unknown Patient'}
            </span>
            <div className="hidden sm:flex items-center gap-1 text-gray-400">
              <span className="text-[11px]">ID:</span>
              <span className="text-[11px] font-semibold text-gray-600">{patientData?.patientId || '—'}</span>
            </div>
            <div className="hidden sm:flex items-center gap-1 text-gray-400">
              <span className="text-[11px]">Mod:</span>
              <span className="text-[11px] font-bold text-gray-600 uppercase">{studyData?.modality || '—'}</span>
            </div>
            <div className="hidden lg:flex items-center gap-1 text-gray-400">
              <span className="text-[11px]">Acc:</span>
              <span className="text-[11px] font-medium text-gray-500">{studyData?.accessionNumber || '—'}</span>
            </div>
          </div>

          {/* Right side — Format + Finalize */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Format toggle */}
            <div className="flex items-center bg-gray-100 p-0.5 rounded-md">
              {['docx', 'pdf'].map(fmt => (
                <button
                  key={fmt}
                  onClick={() => setExportFormat(fmt)}
                  className={`px-2 py-0.5 text-[10px] font-bold rounded transition-all uppercase
                    ${exportFormat === fmt ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  {fmt}
                </button>
              ))}
            </div>

            <div className="h-5 w-px bg-gray-200" />

            {/* Finalize */}
            <button
              onClick={handleFinalizeReport}
              disabled={finalizing}
              className="flex items-center gap-1.5 px-3 h-7 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-all font-bold text-[11px] disabled:opacity-50"
            >
              {finalizing ? (
                <><Loader2 className="w-3 h-3 animate-spin" /> Saving...</>
              ) : (
                <><CheckCircle className="w-3 h-3" /> Finalize</>
              )}
            </button>
          </div>
        </div>

        {/* ─── EDITOR ─── */}
        <div className="flex-1 overflow-hidden flex">
          <div className="flex-1 overflow-hidden">
            <ReportEditor
              key={`editor-${activeReport.id}`}
              content={reportContent}
              onChange={setReportContent}
            />
          </div>
        </div>

        {/* ─── BOTTOM BAR — Report Switcher ─── */}
        <div className="h-9 bg-white border-t border-gray-200 flex items-center justify-between px-3 shrink-0">
          {/* Report tabs */}
          <div className="flex items-center gap-1">
            {reports.map((r, i) => (
              <button
                key={r.id}
                onClick={() => setActiveReportIndex(i)}
                className={`group relative flex items-center gap-1.5 px-2.5 h-6 rounded-md text-[11px] font-semibold transition-all
                  ${activeReportIndex === i
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'
                  }`}
              >
                <FileText className="w-3 h-3" />
                <span>Report {i + 1}</span>
                {reports.length > 1 && (
                  <span
                    onClick={(e) => { e.stopPropagation(); handleRemoveReport(i); }}
                    className={`ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer
                      ${activeReportIndex === i ? 'text-blue-200 hover:text-white' : 'text-gray-400 hover:text-red-500'}`}
                  >
                    ×
                  </span>
                )}
              </button>
            ))}

            {/* Add report */}
            <button
              onClick={handleAddReport}
              className="w-6 h-6 flex items-center justify-center rounded-md text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-all"
              title="Add report"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Right info */}
          <div className="flex items-center gap-3 text-[10px] text-gray-400 font-medium uppercase tracking-wider">
            <span>{reportData?.referringPhysician}</span>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Active</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnlineReportingSystemEditMode;