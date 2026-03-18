import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../services/api';
import { Monitor, FileText, AlertCircle, Loader2, ChevronRight, Lock } from 'lucide-react';

const QRStudyDecisionPage = () => {
  const { studyId } = useParams();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadInfo = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/qr/${studyId}/info`);
        const json = res.data;
        if (!json.success) throw new Error(json.message || 'Failed to load study info');
        setData(json.data);
      } catch (e) {
        setError(e.message || 'Failed to load');
      } finally {
        setLoading(false);
      }
    };
    if (studyId) loadInfo();
  }, [studyId]);

  const openStudy = () => {
    if (!data?.viewer?.ohifUrl) return;
    window.open(data.viewer.ohifUrl, '_blank', 'noopener,noreferrer');
  };

  const openReport = () => {
    if (!data?.report?.downloadUrl) return;
    const reportUrl = `https://radivue.xcentic.com${data.report.downloadUrl}`;
    window.open(reportUrl, '_blank', 'noopener,noreferrer');
  };

  // ── Loading ──
  if (loading) return (
    <div className="min-h-[100dvh] bg-white flex items-center justify-center px-5">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-5 h-5 text-black animate-spin" />
        <p className="text-[12px] text-neutral-400 font-medium tracking-wide">Loading…</p>
      </div>
    </div>
  );

  // ── Error ──
  if (error) return (
    <div className="min-h-[100dvh] bg-white flex items-center justify-center px-5">
      <div className="w-full max-w-[340px] text-center">
        <AlertCircle className="w-8 h-8 text-neutral-300 mx-auto mb-4" />
        <h2 className="text-[15px] font-semibold text-black mb-1">Unable to load</h2>
        <p className="text-[12px] text-neutral-400 leading-relaxed mb-5">{error}</p>
        <button onClick={() => window.location.reload()}
          className="w-full h-10 text-[12px] font-semibold text-black border border-neutral-200 rounded-lg hover:bg-neutral-50 active:scale-[0.98] transition-all">
          Try again
        </button>
      </div>
    </div>
  );

  // ── Main ──
  const initials = (data?.patientName || 'U').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-[340px]">

        {/* Patient */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-full bg-black flex items-center justify-center shrink-0">
            <span className="text-[13px] font-bold text-white tracking-tight">{initials}</span>
          </div>
          <div className="min-w-0">
            <p className="text-[15px] font-bold text-black truncate leading-tight">{data?.patientName || 'Unknown'}</p>
            <p className="text-[11px] text-neutral-400 font-mono mt-0.5 truncate">{String(data?.studyId || '—')}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <button
            onClick={openStudy}
            disabled={!data?.viewer?.ohifUrl}
            className="group w-full flex items-center gap-3 px-4 h-14 bg-black text-white rounded-xl
              hover:bg-neutral-800 active:scale-[0.98] transition-all
              disabled:opacity-25 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            <Monitor className="w-[18px] h-[18px] shrink-0" />
            <div className="flex-1 text-left">
              <p className="text-[13px] font-semibold leading-tight">View Study</p>
              <p className="text-[10px] text-neutral-400">OHIF DICOM Viewer</p>
            </div>
            <ChevronRight className="w-4 h-4 text-neutral-500 group-hover:translate-x-0.5 transition-transform shrink-0" />
          </button>

          <button
            onClick={openReport}
            disabled={!data?.report?.downloadUrl}
            className="group w-full flex items-center gap-3 px-4 h-14 bg-white text-black border border-neutral-200 rounded-xl
              hover:bg-neutral-50 hover:border-neutral-300 active:scale-[0.98] transition-all
              disabled:opacity-25 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            <FileText className="w-[18px] h-[18px] shrink-0" />
            <div className="flex-1 text-left">
              <p className="text-[13px] font-semibold leading-tight">View Report</p>
              <p className="text-[10px] text-neutral-400">Download PDF</p>
            </div>
            <ChevronRight className="w-4 h-4 text-neutral-300 group-hover:translate-x-0.5 transition-transform shrink-0" />
          </button>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center gap-1.5 mt-6">
          <Lock className="w-3 h-3 text-neutral-300" />
          <p className="text-[10px] text-neutral-300 font-medium">Secure, time-limited access</p>
        </div>
      </div>
    </div>
  );
};

export default QRStudyDecisionPage;