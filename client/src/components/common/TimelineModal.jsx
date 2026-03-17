import React, { useState, useEffect } from 'react';
import {
  X, RefreshCw, FileWarning, AlertCircle,
  Calendar, Clock, User, MessageSquare, ChevronDown, ChevronUp, Loader2
} from 'lucide-react';
import api from '../../services/api';

const formatDate = (iso) => {
  if (!iso) return { date: '—', time: '—' };
  try {
    const d = new Date(iso);
    return {
      date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    };
  } catch { return { date: '—', time: '—' }; }
};

const formatStatusLabel = (status) => {
  if (!status) return 'Unknown';
  return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

const getStatusDot = (status = '') => {
  const s = status.toLowerCase();
  if (s.includes('reject') || s.includes('revert')) return 'bg-red-500';
  if (s.includes('verified') || s.includes('verify')) return 'bg-indigo-500';
  if (s.includes('download') || s.includes('printed') || s.includes('reprint')) return 'bg-cyan-500';
  if (s.includes('final') || s.includes('complet')) return 'bg-violet-500';
  if (s.includes('draft') || s.includes('progress') || s.includes('opened')) return 'bg-amber-500';
  if (s.includes('assign')) return 'bg-emerald-500';
  if (s.includes('history') || s.includes('clinical')) return 'bg-teal-500';
  if (s.includes('received') || s.includes('uploaded') || s.includes('created')) return 'bg-blue-500';
  if (s.includes('pending') || s.includes('waiting')) return 'bg-orange-500';
  return 'bg-neutral-400';
};

const isHiddenTimelineStatus = (status = '') => {
  const s = String(status).toLowerCase();
  return s === 'assignments_cleared' || s === 'assignment_cleared';
};

const groupTimelineByStatus = (rawEntries) => {
  const map = new Map();
  rawEntries.forEach((entry) => {
    if (!map.has(entry.status)) {
      map.set(entry.status, { status: entry.status, latest: entry, occurrences: [entry] });
    } else {
      map.get(entry.status).occurrences.push(entry);
    }
  });
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.latest.changedAt) - new Date(a.latest.changedAt)
  );
};

// ── Occurrence sub-row ──
const OccurrenceRow = ({ entry, isFirst }) => {
  const { date, time } = formatDate(entry.changedAt);
  return (
    <div className={`flex gap-2.5 px-3 py-2 rounded-lg ${isFirst ? 'bg-neutral-100' : 'bg-neutral-50'} border border-neutral-200/60`}>
      <div className="flex-shrink-0 pt-1">
        <div className={`w-1.5 h-1.5 rounded-full ${isFirst ? 'bg-black' : 'bg-neutral-300'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-neutral-500 font-mono">{date} · {time}</span>
          {isFirst && (
            <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-black text-white uppercase">Latest</span>
          )}
        </div>
        {(entry.changedByName || entry.changedBy) && (
          <div className="flex items-center gap-1 mt-0.5">
            <User className="w-2.5 h-2.5 text-neutral-400" />
            <span className="text-[10px] text-neutral-600 font-medium">{entry.changedByName || entry.changedBy}</span>
            {entry.changedByRole && (
              <span className="text-[9px] text-neutral-400 capitalize">· {entry.changedByRole.replace(/_/g, ' ')}</span>
            )}
          </div>
        )}
        {entry.note && (
          <p className="text-[10px] text-neutral-500 mt-1 leading-relaxed italic">"{entry.note}"</p>
        )}
      </div>
    </div>
  );
};

// ── Timeline card ──
const TimelineCard = ({ group, isLast }) => {
  const [expanded, setExpanded] = useState(false);
  const dotColor = getStatusDot(group.status);
  const { date, time } = formatDate(group.latest.changedAt);
  const hasMultiple = group.occurrences.length > 1;

  return (
    <div className="relative flex gap-3">
      {/* Vertical line + dot */}
      <div className="flex flex-col items-center shrink-0 w-5">
        <div className={`w-2.5 h-2.5 rounded-full ${dotColor} ring-2 ring-white z-10 shrink-0`} />
        {!isLast && <div className="w-px flex-1 bg-neutral-200 mt-0.5" />}
      </div>

      {/* Content */}
      <div className="flex-1 pb-4 min-w-0">
        {/* Header row */}
        <div className="flex items-baseline justify-between gap-2 mb-0.5">
          <span className="text-[12px] font-semibold text-black leading-tight">
            {formatStatusLabel(group.status)}
          </span>
          <span className="text-[10px] text-neutral-400 font-mono shrink-0">{date} · {time}</span>
        </div>

        {/* Raw status */}
        <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-mono text-neutral-400 bg-neutral-100 border border-neutral-200 mb-1.5">
          {group.status}
        </span>

        {/* User */}
        {(group.latest.changedByName || group.latest.changedBy) && (
          <div className="flex items-center gap-1.5 mb-0.5">
            <User className="w-3 h-3 text-neutral-400" />
            <span className="text-[11px] text-neutral-600 font-medium">{group.latest.changedByName || group.latest.changedBy}</span>
            {group.latest.changedByRole && (
              <span className="text-[10px] text-neutral-400 capitalize">· {group.latest.changedByRole.replace(/_/g, ' ')}</span>
            )}
          </div>
        )}

        {/* Note */}
        {group.latest.note && (
          <div className="flex items-start gap-1.5 mt-1.5 pt-1.5 border-t border-neutral-100">
            <MessageSquare className="w-3 h-3 text-neutral-300 mt-0.5 shrink-0" />
            <p className="text-[11px] text-neutral-500 leading-relaxed">{group.latest.note}</p>
          </div>
        )}

        {/* Expand toggle */}
        {hasMultiple && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="mt-2 flex items-center gap-1.5 text-[10px] font-semibold text-neutral-500 hover:text-black transition-colors"
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expanded ? 'Hide' : `${group.occurrences.length - 1} more`}
            <span className="px-1.5 py-0.5 rounded-full bg-neutral-100 text-[9px] font-bold">{group.occurrences.length}×</span>
          </button>
        )}

        {/* Expanded list */}
        {expanded && hasMultiple && (
          <div className="mt-2 space-y-1.5">
            {group.occurrences.map((occ, i) => (
              <OccurrenceRow key={occ._id || i} entry={occ} isFirst={i === 0} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Main Modal ──
const ActionTimeline = ({ isOpen, onClose, studyId, studyData }) => {
  const [grouped, setGrouped] = useState([]);
  const [totalRaw, setTotalRaw] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen || !studyId) return;
    const fetchTimeline = async () => {
      try {
        setLoading(true); setError(null);
        const response = await api.get(`/admin/study/${studyId}/status-history`);
        if (response.data.success) {
          const raw = response.data.timeline || [];
          const visible = raw.filter(entry => !isHiddenTimelineStatus(entry.status));
          setTotalRaw(visible.length);
          setGrouped(groupTimelineByStatus(visible));
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
  }, [isOpen, studyId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col border border-neutral-200/60">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-100 shrink-0">
          <div>
            <h2 className="text-[14px] font-bold text-black leading-tight">Study Timeline</h2>
            <p className="text-[11px] text-neutral-400 mt-0.5 truncate max-w-[300px]">
              {studyData?.patientName || 'Patient'} · {studyData?.studyName || studyData?.studyDescription || 'Study'}
            </p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-neutral-400 hover:text-black hover:bg-neutral-100 transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-5 h-5 text-black animate-spin mb-2" />
              <span className="text-[12px] text-neutral-400">Loading…</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16">
              <AlertCircle className="w-6 h-6 text-neutral-300 mb-2" />
              <span className="text-[12px] text-neutral-500">{error}</span>
            </div>
          ) : grouped.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <FileWarning className="w-6 h-6 text-neutral-300 mb-2" />
              <span className="text-[12px] text-neutral-400">No timeline data</span>
            </div>
          ) : (
            <div>
              {grouped.map((group, i) => (
                <TimelineCard key={group.status + i} group={group} isLast={i === grouped.length - 1} />
              ))}
              {/* Origin dot */}
              <div className="flex items-center gap-3">
                <div className="w-5 flex justify-center">
                  <div className="w-2 h-2 rounded-full bg-neutral-300 ring-2 ring-white" />
                </div>
                <span className="text-[10px] text-neutral-400 italic">Study origin</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-2.5 border-t border-neutral-100 shrink-0">
          <div className="flex items-center gap-2 text-[10px] text-neutral-400 font-medium">
            <span><span className="text-black font-semibold">{grouped.length}</span> statuses</span>
            <span>·</span>
            <span><span className="text-black font-semibold">{totalRaw}</span> events</span>
          </div>
          <button onClick={onClose}
            className="px-3 h-7 text-[11px] font-semibold text-neutral-600 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-all">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ActionTimeline;