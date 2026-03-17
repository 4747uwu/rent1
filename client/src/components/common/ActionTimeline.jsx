import React, { useState, useEffect } from 'react';
import { 
  Upload, FileText, UserCheck, Lock, Unlock, 
  CheckCircle, XCircle, Clock, FileCheck, Printer, 
  AlertCircle, RefreshCw, Users, FileWarning 
} from 'lucide-react';
import api from '../../services/api';

const formatSmallDate = (iso) => {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    const date = d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
    const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${date} ${time}`;
  } catch {
    return '-';
  }
};

const getStatusIcon = (status) => {
  const iconProps = { className: "w-3.5 h-3.5", strokeWidth: 2 };
  
  if (!status) return <Clock {...iconProps} />;
  
  if (status.includes('uploaded') || status.includes('received')) 
    return <Upload {...iconProps} />;
  if (status.includes('assigned') || status.includes('reassigned')) 
    return <UserCheck {...iconProps} />;
  if (status.includes('cleared')) 
    return <Users {...iconProps} />;
  if (status.includes('locked')) 
    return <Lock {...iconProps} />;
  if (status.includes('unlocked')) 
    return <Unlock {...iconProps} />;
  if (status.includes('finalized') || status.includes('verified')) 
    return <CheckCircle {...iconProps} />;
  if (status.includes('rejected')) 
    return <XCircle {...iconProps} />;
  if (status.includes('report') || status.includes('draft')) 
    return <FileCheck {...iconProps} />;
  if (status.includes('print')) 
    return <Printer {...iconProps} />;
  
  return <Clock {...iconProps} />;
};

const getStatusColor = (status) => {
  if (!status) return { 
    bg: 'bg-slate-50/50', 
    text: 'text-slate-600', 
    dot: 'bg-slate-300',
    border: 'border-slate-200'
  };
  
  if (status.includes('uploaded') || status.includes('received')) 
    return { 
      bg: 'bg-blue-50/50', 
      text: 'text-blue-600', 
      dot: 'bg-blue-400',
      border: 'border-blue-200'
    };
  if (status.includes('assigned')) 
    return { 
      bg: 'bg-emerald-50/50', 
      text: 'text-emerald-600', 
      dot: 'bg-emerald-400',
      border: 'border-emerald-200'
    };
  if (status.includes('cleared')) 
    return { 
      bg: 'bg-amber-50/50', 
      text: 'text-amber-600', 
      dot: 'bg-amber-400',
      border: 'border-amber-200'
    };
  if (status.includes('locked')) 
    return { 
      bg: 'bg-red-50/50', 
      text: 'text-red-600', 
      dot: 'bg-red-400',
      border: 'border-red-200'
    };
  if (status.includes('unlocked')) 
    return { 
      bg: 'bg-orange-50/50', 
      text: 'text-orange-600', 
      dot: 'bg-orange-400',
      border: 'border-orange-200'
    };
  if (status.includes('finalized') || status.includes('verified')) 
    return { 
      bg: 'bg-indigo-50/50', 
      text: 'text-indigo-600', 
      dot: 'bg-indigo-400',
      border: 'border-indigo-200'
    };
  if (status.includes('rejected')) 
    return { 
      bg: 'bg-rose-50/50', 
      text: 'text-rose-600', 
      dot: 'bg-rose-400',
      border: 'border-rose-200'
    };
  if (status.includes('report') || status.includes('draft')) 
    return { 
      bg: 'bg-violet-50/50', 
      text: 'text-violet-600', 
      dot: 'bg-violet-400',
      border: 'border-violet-200'
    };
  if (status.includes('print')) 
    return { 
      bg: 'bg-purple-50/50', 
      text: 'text-purple-600', 
      dot: 'bg-purple-400',
      border: 'border-purple-200'
    };
  
  return { 
    bg: 'bg-slate-50/50', 
    text: 'text-slate-600', 
    dot: 'bg-slate-300',
    border: 'border-slate-200'
  };
};

const formatStatusLabel = (status = '') => {
  if (!status) return 'Status Update';
  
  const labels = {
    study_uploaded: 'Study Uploaded',
    new_study_received: 'Study Received',
    assignments_cleared: 'Assignments Cleared',
    assigned_to_doctor: 'Assigned to Radiologist',
    study_reassigned: 'Reassigned',
    study_locked: 'Locked for Reporting',
    study_unlocked: 'Unlocked',
    report_started: 'Report Started',
    report_drafted: 'Draft Saved',
    report_finalized: 'Report Finalized',
    report_verified: 'Report Verified',
    report_rejected: 'Report Rejected',
    report_printed: 'Report Printed',
    status_changed: 'Status Changed',
    priority_changed: 'Priority Changed'
  };
  
  return labels[status] || status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

const ActionTimeline = ({ studyId, maxItems = 5 }) => {
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!studyId) {
      setTimeline([]);
      setLoading(false);
      return;
    }

    const fetchTimeline = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await api.get(`/admin/study/${studyId}/status-history`);
        
        if (response.data.success) {
          setTimeline(response.data.timeline || []);
        } else {
          setError('Failed to load timeline');
        }
      } catch (err) {
        console.error('Error fetching status history:', err);
        setError('Error loading timeline');
      } finally {
        setLoading(false);
      }
    };

    fetchTimeline();
  }, [studyId]);

  if (loading) {
    return (
      <div className="w-full p-3 flex items-center justify-center">
        <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />
        <span className="ml-2 text-xs text-slate-500">Loading timeline...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full p-3 flex items-center justify-center text-xs text-rose-600">
        <AlertCircle className="w-3.5 h-3.5 mr-1.5" />
        {error}
      </div>
    );
  }

  if (timeline.length === 0) {
    return (
      <div className="w-full p-3 flex items-center justify-center text-xs text-slate-500">
        <FileWarning className="w-3.5 h-3.5 mr-1.5" />
        No timeline data available
      </div>
    );
  }

  const visibleEntries = timeline.slice(0, maxItems);
  const remainingCount = timeline.length - maxItems;

  return (
    <div className="w-full py-2">
      <div className="flex flex-col gap-2">
        {visibleEntries.map((entry, index) => {
          const colors = getStatusColor(entry.status);
          const icon = getStatusIcon(entry.status);
          
          return (
            <div
              key={entry._id}
              className="flex items-start gap-2 group"
            >
              {/* Timeline line and dot */}
              <div className="flex flex-col items-center flex-shrink-0 mt-1">
                <div className={`w-2.5 h-2.5 rounded-full ${colors.dot} ring-2 ring-white shadow-sm`} />
                {index < visibleEntries.length - 1 && (
                  <div className="w-px h-full min-h-[20px] bg-slate-200" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pb-1">
                <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border ${colors.bg} ${colors.border}`}>
                  <div className={colors.text}>
                    {icon}
                  </div>
                  <span className={`text-[10px] font-medium ${colors.text}`}>
                    {formatStatusLabel(entry.status)}
                  </span>
                </div>
                
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[9px] text-slate-500 font-medium">
                    {formatSmallDate(entry.changedAt)}
                  </span>
                  {entry.changedByName && entry.changedByName !== 'System' && (
                    <>
                      <span className="text-[9px] text-slate-400">•</span>
                      <span className="text-[9px] text-slate-600">
                        {entry.changedByName}
                      </span>
                    </>
                  )}
                </div>
                
                {entry.note && (
                  <div className="text-[9px] text-slate-500 mt-0.5 line-clamp-2">
                    {entry.note}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {remainingCount > 0 && (
          <div className="flex items-center gap-2 ml-4 mt-1">
            <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
            <button
              className="text-[10px] text-blue-600 hover:text-blue-700 hover:underline font-medium"
              onClick={() => {
                console.log('Show full timeline for study:', studyId);
                // This will be handled by parent component
              }}
            >
              +{remainingCount} more update{remainingCount !== 1 ? 's' : ''}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActionTimeline;