import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, FileText, AlertCircle, Lock } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const OHIFViewerPage = () => {
  const { studyId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [study, setStudy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [locking, setLocking] = useState(false);
  const [ohifUrl, setOhifUrl] = useState('');

  useEffect(() => {
    const fetchStudyDetails = async () => {
      setLoading(true);

      // Use location.state if caller provided full study object
      if (location.state?.study) {
        const passed = location.state.study;
        setStudy(passed);

        // Build StudyInstanceUIDs string from passed study (support array or single value)
        const orthancStudyID = passed.orthancStudyID || passed.studyId || passed._id || null;
        const studyInstanceUID = passed.studyInstanceUID || passed.studyInstanceUIDs || passed.StudyInstanceUID || passed.studyInstanceUid || null;

        let studyUIDs = '';
        if (Array.isArray(studyInstanceUID) && studyInstanceUID.length) {
          studyUIDs = studyInstanceUID.join(',');
        } else if (typeof studyInstanceUID === 'string' && studyInstanceUID.trim()) {
          studyUIDs = studyInstanceUID.trim();
        } else if (orthancStudyID) {
          studyUIDs = orthancStudyID;
        }

        if (studyUIDs) {
          // const OHIF_BASE = 'https://pacs.xcentic.com/viewer';
          const OHIF_BASE = 'https://viewer.bharatpacs.com/viewer';

          const url = `${OHIF_BASE}/viewer?StudyInstanceUIDs=${encodeURIComponent(studyUIDs)}`;
          setOhifUrl(url);
          console.log('OHIFViewerPage -> crafted OHIF URL from location.state:', url);
        } else {
          console.warn('OHIFViewerPage -> no StudyInstanceUID found in location.state study');
        }

        setLoading(false);
        return;
      }
      
      try {
        // Use same endpoint OnlineReportingSystemWithOHIF uses to get reporting info
        const resp = await api.get(`/documents/study/${studyId}/reporting-info`);
        if (resp?.data?.success) {
          const data = resp.data.data || {};
          // data.studyInfo and data.allStudies structure used by reporting component
          const studyInfo = data.studyInfo || {};
          const allStudies = data.allStudies || [];
          const currentStudy = allStudies.find(s => s.studyId === studyId) || studyInfo || {};

          // Normalize fields used by reporting system
          const orthancStudyID = currentStudy.orthancStudyID || currentStudy.studyId || studyInfo.studyId || null;
          const studyInstanceUID = currentStudy.studyInstanceUID || currentStudy.studyInstanceUIDs || studyInfo.studyInstanceUID || null;

          const normalizedStudy = {
            ...currentStudy,
            orthancStudyID,
            studyInstanceUID
          };

          setStudy(normalizedStudy);

          // Build StudyInstanceUIDs string (support array or single value)
          let studyUIDs = '';
          if (Array.isArray(studyInstanceUID) && studyInstanceUID.length) {
            studyUIDs = studyInstanceUID.join(',');
          } else if (typeof studyInstanceUID === 'string' && studyInstanceUID.trim()) {
            studyUIDs = studyInstanceUID.trim();
          } else if (orthancStudyID) {
            // fallback: sometimes orthancStudyID can be used by OHIF deployments; prefer UID though
            studyUIDs = orthancStudyID;
          }

          if (studyUIDs) {
            // Craft exact URL like your example
            const OHIF_BASE = 'http://165.232.189.64:4000/viewer';
            const url = `${OHIF_BASE}?StudyInstanceUIDs=${encodeURIComponent(studyUIDs)}`;
            setOhifUrl(url);
            console.log('OHIFViewerPage -> crafted OHIF URL:', url);
          } else {
            console.warn('OHIFViewerPage -> no StudyInstanceUID found in reporting-info response');
            setOhifUrl('');
          }
        } else {
          toast.error('Study reporting info not found');
        }
      } catch (err) {
        console.error('Error fetching reporting-info:', err);
        toast.error('Failed to load study details');
      } finally {
        setLoading(false);
      }
    };

    fetchStudyDetails();
  }, [studyId, location.state]);

  const handleReportNow = async () => {
    try {
      setLocking(true);
      const lockResponse = await api.post(`/admin/studies/${studyId}/lock`);
      if (!lockResponse?.data?.success) throw new Error(lockResponse?.data?.message || 'Lock failed');
      toast.success('Study locked for reporting', { icon: '🔒' });

      // ✅ UPDATED: Pass studyInstanceUID in state
      navigate(`/online-reporting/${studyId}?openOHIF=true`, { 
        state: { 
          study: {
            ...study,
            studyInstanceUID: study.studyInstanceUID || study.studyInstanceUIDs || null
          },
          locked: true, 
          lockInfo: lockResponse.data.data 
        } 
      });
    } catch (error) {
      console.error('Error transitioning to reporting:', error);
      if (error.response?.status === 423) {
        toast.error(`Study is locked by ${error.response.data.lockedBy}`, {
          duration: 5000,
          icon: '🔒'
        });
      } else {
        toast.error(error.response?.data?.message || 'Failed to start reporting session');
      }
    } finally {
      setLocking(false);
    }
  };

  const handleBack = () => navigate('/doctor/dashboard');

  // If OHIF host is plain HTTP and browser blocks COOP, provide open-in-new-tab fallback
  const openInNewTab = () => {
    if (ohifUrl) window.open(ohifUrl, '_blank', 'noopener,noreferrer');
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-black text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500" />
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-black overflow-hidden">
      <div className="h-14 bg-slate-900 border-b border-slate-700 flex items-center justify-between px-4 shadow-md z-10">
        <div className="flex items-center space-x-4">
          <button onClick={handleBack} className="p-2 hover:bg-slate-800 rounded-full text-slate-300" title="Back to Dashboard" disabled={locking}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex flex-col">
            <div className="flex items-center space-x-2">
              <span className="text-white font-medium text-sm">{study?.patientName || 'Unknown Patient'}</span>
              <span className="text-slate-400 text-xs">({study?.patientId || 'No ID'})</span>
            </div>
            <span className="text-teal-400 text-xs">{study?.modality} • {study?.studyDate ? new Date(study.studyDate).toLocaleDateString() : ''}</span>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="hidden md:flex items-center px-3 py-1 bg-yellow-500/10 border border-yellow-500/20 rounded text-yellow-500 text-xs">
            <AlertCircle className="w-3 h-3 mr-1.5" /> View Only Mode
          </div>

          <button onClick={handleReportNow} disabled={locking} className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors shadow-lg ${locking ? 'bg-slate-600 cursor-not-allowed' : 'bg-teal-600 hover:bg-teal-500'} text-white`}>
            {locking ? <><Lock className="w-4 h-4 animate-pulse" /><span>Locking Study...</span></> : <><FileText className="w-4 h-4" /><span>Report Now</span></>}
          </button>
        </div>
      </div>

      <div className="flex-1 relative bg-black">
        {ohifUrl ? (
          // render iframe with crafted URL
          <iframe src={ohifUrl} className="absolute inset-0 w-full h-full border-none" title="OHIF Viewer" allow="fullscreen" />
        ) : (
          // show fallback message + button to open in new tab
          <div className="h-full w-full flex flex-col items-center justify-center text-center p-6 text-white">
            <p className="mb-3">Unable to build OHIF viewer URL (no StudyInstanceUID available).</p>
            <p className="text-sm text-slate-300 mb-4">If the external viewer requires HTTPS due to COOP/COEP headers, use an HTTPS OHIF host or run a local proxy on this origin (localhost).</p>
            <div className="flex gap-3">
              <button onClick={openInNewTab} disabled={!ohifUrl} className="px-3 py-2 bg-teal-600 rounded text-white disabled:opacity-50">Open viewer (new tab)</button>
              <button onClick={() => window.location.reload()} className="px-3 py-2 bg-gray-700 rounded text-white">Retry</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OHIFViewerPage;