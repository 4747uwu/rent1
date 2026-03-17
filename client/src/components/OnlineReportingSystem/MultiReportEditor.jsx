import React, { useState, useCallback } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';
import ReportEditor from './ReportEditorWithOhif';

const MultiReportEditor = ({ 
  studyId, 
  studyData, 
  patientData,
  reportData,
  onSubmit,
  onCancel 
}) => {
  const [reports, setReports] = useState([
    {
      id: 'report-1',
      title: 'Report 1',
      htmlContent: '',
      placeholders: {},
      capturedImages: [],
      templateInfo: {},
      format: 'docx',
      isExpanded: true
    }
  ]);

  const [activeReportId, setActiveReportId] = useState('report-1');
  const [submitting, setSubmitting] = useState(false);

  // Get current active report
  const activeReport = reports.find(r => r.id === activeReportId);

  // Add new report
  const handleAddReport = () => {
    const newId = `report-${reports.length + 1}`;
    const newReport = {
      id: newId,
      title: `Report ${reports.length + 1}`,
      htmlContent: '',
      placeholders: {},
      capturedImages: [],
      templateInfo: {},
      format: 'docx',
      isExpanded: true
    };
    setReports([...reports, newReport]);
    setActiveReportId(newId);
    toast.success(`Report ${reports.length + 1} added`, { icon: '➕' });
  };

  // Remove report
  const handleRemoveReport = (reportId) => {
    if (reports.length === 1) {
      toast.error('Must have at least one report');
      return;
    }

    const reportNumber = reports.findIndex(r => r.id === reportId) + 1;
    setReports(reports.filter(r => r.id !== reportId));
    
    if (activeReportId === reportId) {
      setActiveReportId(reports[0].id);
    }
    
    toast.success(`Report ${reportNumber} deleted`, { icon: '🗑️' });
  };

  // Update report content
  const handleUpdateReport = (reportId, field, value) => {
    setReports(reports.map(r => 
      r.id === reportId ? { ...r, [field]: value } : r
    ));
  };

  // Toggle report expansion
  const handleToggleExpand = (reportId) => {
    setReports(reports.map(r =>
      r.id === reportId ? { ...r, isExpanded: !r.isExpanded } : r
    ));
  };

  // Submit all reports
  const handleSubmitMultiple = async () => {
    // Validate all reports have content
    const emptyReports = reports.filter(r => !r.htmlContent?.trim());
    if (emptyReports.length > 0) {
      toast.error(`Reports ${emptyReports.map((_, i) => reports.findIndex(r => r.id === emptyReports[i].id) + 1).join(', ')} are empty`);
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        reports: reports.map(r => ({
          htmlContent: r.htmlContent,
          placeholders: {
            '--name--': patientData?.fullName || '',
            '--patientid--': patientData?.patientId || '',
            '--accessionno--': studyData?.accessionNumber || '',
            '--agegender--': `${patientData?.age || ''} / ${patientData?.gender || ''}`,
            '--referredby--': reportData?.referringPhysician || '',
            '--reporteddate--': new Date().toLocaleDateString(),
            '--Content--': r.htmlContent
          },
          capturedImages: r.capturedImages,
          templateInfo: r.templateInfo,
          format: r.format,
          reportType: 'finalized',
          reportStatus: 'finalized'
        }))
      };

      const response = await api.post(`/reports/studies/${studyId}/store-multiple`, payload);

      if (response.data.success) {
        toast.success(`✅ ${response.data.data.totalReports} reports finalized successfully!`, {
          duration: 5000,
          icon: '🎉'
        });

        onSubmit?.(response.data.data);
      } else {
        throw new Error(response.data.message || 'Failed to store reports');
      }
    } catch (error) {
      console.error('❌ Multi-report submission error:', error);
      toast.error(`Failed to submit reports: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-300 px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Multiple Reports for Study</h2>
            <p className="text-sm text-gray-600 mt-1">
              {studyData?.accessionNumber} - {studyData?.studyDescription} | {patientData?.fullName}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleAddReport}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <Plus className="w-4 h-4" />
              Add Report
            </button>
            <span className="text-sm font-semibold text-gray-700 bg-gray-100 px-3 py-2 rounded">
              {reports.length} Report{reports.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Report Tabs */}
      <div className="bg-white border-b border-gray-300 px-6 py-3 overflow-x-auto flex gap-2">
        {reports.map((report, index) => (
          <button
            key={report.id}
            onClick={() => setActiveReportId(report.id)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
              activeReportId === report.id
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Report {index + 1}
            {report.htmlContent && <span className="ml-2 text-xm">✓</span>}
          </button>
        ))}
      </div>

      {/* Active Report Editor */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {activeReport ? (
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Report Title Bar */}
            <div className="bg-white border-b border-gray-300 px-6 py-3 flex items-center justify-between">
              <input
                type="text"
                value={activeReport.title}
                onChange={(e) => handleUpdateReport(activeReport.id, 'title', e.target.value)}
                className="text-lg font-semibold px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {reports.length > 1 && (
                <button
                  onClick={() => handleRemoveReport(activeReport.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete this report"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Editor */}
            <div className="flex-1 overflow-hidden">
              <ReportEditor
                content={activeReport.htmlContent}
                onChange={(content) => handleUpdateReport(activeReport.id, 'htmlContent', content)}
                containerWidth={85}
                isOpen={true}
              />
            </div>
          </div>
        ) : null}
      </div>

      {/* Footer Actions */}
      <div className="bg-white border-t border-gray-300 px-6 py-4 shadow-lg flex items-center justify-between">
        <button
          onClick={onCancel}
          className="px-6 py-2.5 text-sm font-bold bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 border border-gray-300 transition-colors"
        >
          Cancel
        </button>

        <div className="flex items-center gap-3">
          <div className="text-sm text-gray-600">
            {reports.filter(r => r.htmlContent?.trim()).length} of {reports.length} reports filled
          </div>
          <button
            onClick={handleSubmitMultiple}
            disabled={submitting || reports.length === 0}
            className={`flex items-center gap-2 px-6 py-2.5 text-sm font-bold rounded-lg transition-colors ${
              submitting
                ? 'bg-gray-400 text-white cursor-not-allowed'
                : 'bg-black text-white hover:bg-gray-800'
            }`}
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                ✅ Finalize {reports.length} Report{reports.length !== 1 ? 's' : ''}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MultiReportEditor;