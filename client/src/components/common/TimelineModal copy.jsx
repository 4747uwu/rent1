import React, { useState, useEffect } from 'react';
import {
  X, RefreshCw, FileWarning, AlertCircle,
  Calendar, Clock, User, MessageSquare, ChevronDown, ChevronUp
} from 'lucide-react';
import api from '../../services/api';

const formatDate = (iso) => {
  if (!iso) return { date: '-', time: '-' };
  try {
    const d = new Date(iso);
    return {
      date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    };
  } catch {
    return { date: '-', time: '-' };
  }
};

const formatStatusLabel = (status) => {
  if (!status) return 'Unknown';
  return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

const getStatusColors = (status = '') => {
  const s = status.toLowerCase();
  if (s.includes('reject') || s.includes('revert'))
    return { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-300', dot: 'bg-rose-500', expandBg: 'bg-rose-100/60' };
  if (s.includes('verified') || s.includes('verify'))
    return { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-300', dot: 'bg-indigo-500', expandBg: 'bg-indigo-100/60' };
  if (s.includes('download') || s.includes('printed') || s.includes('reprint'))
    return { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-300', dot: 'bg-cyan-500', expandBg: 'bg-cyan-100/60' };
  if (s.includes('final') || s.includes('complet'))
    return { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-300', dot: 'bg-violet-500', expandBg: 'bg-violet-100/60' };
  if (s.includes('draft') || s.includes('progress') || s.includes('opened'))
    return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-300', dot: 'bg-amber-500', expandBg: 'bg-amber-100/60' };
  if (s.includes('assign'))
    return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-300', dot: 'bg-emerald-500', expandBg: 'bg-emerald-100/60' };
  if (s.includes('history') || s.includes('clinical'))
    return { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-300', dot: 'bg-teal-500', expandBg: 'bg-teal-100/60' };
  if (s.includes('received') || s.includes('uploaded') || s.includes('created'))
    return { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-300', dot: 'bg-blue-500', expandBg: 'bg-blue-100/60' };
  if (s.includes('pending') || s.includes('waiting'))
    return { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-300', dot: 'bg-orange-500', expandBg: 'bg-orange-100/60' };
  return { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-300', dot: 'bg-slate-400', expandBg: 'bg-slate-100/60' };
};

const isHiddenTimelineStatus = (status = '') => {
  const s = String(status).toLowerCase();
  return s === 'assignments_cleared' || s === 'assignment_cleared';
};

// ✅ Group raw entries by status — latest first, collect all occurrences
const groupTimelineByStatus = (rawEntries) => {
  const map = new Map();

  // Already sorted newest→oldest from backend
  rawEntries.forEach((entry) => {
    if (!map.has(entry.status)) {
      // First occurrence seen = latest (since sorted newest first)
      map.set(entry.status, {
        status: entry.status,
        latest: entry,         // shown by default
        occurrences: [entry],  // all including latest
      });
    } else {
      map.get(entry.status).occurrences.push(entry);
    }
  });

  // Convert to array, sort groups by their latest changedAt (newest first)
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.latest.changedAt) - new Date(a.latest.changedAt)
  );
};

// ── Sub-row for each occurrence inside an expanded group ──────────────────────
const OccurrenceRow = ({ entry, colors, isFirst }) => {
  const { date, time } = formatDate(entry.changedAt);
  return (
    <div className={`flex gap-3 px-3 py-2 rounded-lg ${colors.expandBg} border ${colors.border} border-opacity-50`}>
      {/* small dot */}
      <div className="flex-shrink-0 flex flex-col items-center pt-1">
        <div className={`w-2 h-2 rounded-full ${colors.dot} ${isFirst ? 'ring-2 ring-offset-1 ring-current opacity-80' : 'opacity-50'}`} />
      </div>
      <div className="flex-1 min-w-0">
        {/* date/time */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 text-[10px] text-slate-500">
            <Calendar className="w-2.5 h-2.5" />
            <span>{date}</span>
            <span className="text-slate-400">·</span>
            <Clock className="w-2.5 h-2.5" />
            <span>{time}</span>
          </div>
          {isFirst && (
            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${colors.text} ${colors.bg} border ${colors.border}`}>
              LATEST
            </span>
          )}
        </div>
        {/* user */}
        {(entry.changedByName || entry.changedBy) && (
          <div className="flex items-center gap-1 mt-0.5">
            <User className="w-2.5 h-2.5 text-slate-400" />
            <span className="text-[10px] text-slate-600 font-medium">{entry.changedByName || entry.changedBy}</span>
            {entry.changedByRole && (
              <span className="text-[9px] text-slate-400 capitalize">· {entry.changedByRole.replace(/_/g, ' ')}</span>
            )}
          </div>
        )}
        {/* note */}
        {entry.note && (
          <div className="flex items-start gap-1 mt-1 pt-1 border-t border-slate-200/40">
            <MessageSquare className="w-2.5 h-2.5 text-slate-400 mt-0.5 flex-shrink-0" />
            <p className="text-[10px] text-slate-600 leading-relaxed">{entry.note}</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Single timeline card with expand/collapse ─────────────────────────────────
const TimelineCard = ({ group }) => {
  const [expanded, setExpanded] = useState(false);
  const colors = getStatusColors(group.status);
  const { date, time } = formatDate(group.latest.changedAt);
  const hasMultiple = group.occurrences.length > 1;

  return (
    <div className="relative flex gap-4">
      {/* Left dot */}
      <div className={`relative z-10 flex-shrink-0 w-10 h-10 rounded-full ${colors.bg} border-2 ${colors.border} flex items-center justify-center shadow-sm`}>
        <div className={`w-3 h-3 rounded-full ${colors.dot}`} />
      </div>

      {/* Card */}
      <div className={`flex-1 ${colors.bg} border ${colors.border} rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden`}>

        {/* ── Main row (always visible) ── */}
        <div className="p-3">
          {/* Top: label + date */}
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <span className={`text-xs font-semibold ${colors.text}`}>
              {formatStatusLabel(group.status)}
            </span>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 flex-shrink-0">
              <Calendar className="w-3 h-3" />
              <span>{date}</span>
              <span className="text-slate-400">·</span>
              <Clock className="w-3 h-3" />
              <span>{time}</span>
            </div>
          </div>

          {/* Raw status badge */}
          <div className="mb-1.5">
            <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-mono ${colors.text} bg-white/60 border ${colors.border}`}>
              {group.status}
            </span>
          </div>

          {/* User */}
          {(group.latest.changedByName || group.latest.changedBy) && (
            <div className="flex items-center gap-1.5 mb-1">
              <User className="w-3 h-3 text-slate-400" />
              <span className="text-xs text-slate-600 font-medium">
                {group.latest.changedByName || group.latest.changedBy}
              </span>
              {group.latest.changedByRole && (
                <>
                  <span className="text-slate-400">·</span>
                  <span className="text-[10px] text-slate-500 capitalize">
                    {group.latest.changedByRole.replace(/_/g, ' ')}
                  </span>
                </>
              )}
            </div>
          )}

          {/* Note */}
          {group.latest.note && (
            <div className="flex items-start gap-1.5 mt-2 pt-2 border-t border-slate-200/50">
              <MessageSquare className="w-3 h-3 text-slate-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-slate-600 leading-relaxed">{group.latest.note}</p>
            </div>
          )}

          {/* ── Expand toggle — only if multiple ── */}
          {hasMultiple && (
            <button
              onClick={() => setExpanded(v => !v)}
              className={`mt-2 w-full flex items-center justify-between px-2 py-1 rounded-md text-[10px] font-semibold transition-colors ${colors.text} bg-white/50 hover:bg-white/80 border ${colors.border}`}
            >
              <span>
                {expanded
                  ? 'Hide previous occurrences'
                  : `Show ${group.occurrences.length - 1} more occurrence${group.occurrences.length - 1 > 1 ? 's' : ''}`}
              </span>
              <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${colors.bg} border ${colors.border}`}>
                {group.occurrences.length}×
                {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </span>
            </button>
          )}
        </div>

        {/* ── Expanded occurrences list ── */}
        {expanded && hasMultiple && (
          <div className={`px-3 pb-3 space-y-2 border-t ${colors.border} border-opacity-40`}>
            <p className={`text-[9px] font-bold uppercase pt-2 pb-1 ${colors.text} opacity-70`}>All Occurrences</p>
            {group.occurrences.map((occ, i) => (
              <OccurrenceRow key={occ._id || i} entry={occ} colors={colors} isFirst={i === 0} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Main Modal ────────────────────────────────────────────────────────────────
const ActionTimeline = ({ isOpen, onClose, studyId, studyData }) => {
  const [grouped, setGrouped] = useState([]);
  const [totalRaw, setTotalRaw] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen || !studyId) return;

    const fetchTimeline = async () => {
      try {
        setLoading(true);
        setError(null);

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
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Full Study Timeline</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {studyData?.patientName || 'Patient'} · {studyData?.studyName || studyData?.studyDescription || 'Study'}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-slate-400 mb-3" />
              <span className="text-sm text-slate-500">Loading timeline...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="w-8 h-8 text-rose-500 mb-3" />
              <span className="text-sm text-rose-600">{error}</span>
            </div>
          ) : grouped.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <FileWarning className="w-8 h-8 text-slate-400 mb-3" />
              <span className="text-sm text-slate-500">No timeline data available</span>
            </div>
          ) : (
            <div className="relative">
              {/* Vertical connector line */}
              <div className="absolute left-[19px] top-3 bottom-3 w-0.5 bg-gradient-to-b from-slate-200 via-slate-300 to-slate-200" />

              <div className="space-y-3">
                {grouped.map((group, index) => (
                  <TimelineCard key={group.status + index} group={group} />
                ))}

                {/* Bottom anchor */}
                <div className="relative flex gap-4 items-center">
                  <div className="relative z-10 flex-shrink-0 w-10 h-10 rounded-full bg-slate-100 border-2 border-slate-300 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-slate-400" />
                  </div>
                  <span className="text-[10px] text-slate-400 italic">Study origin</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 bg-slate-50/50">
          <div className="flex items-center gap-3 text-[10px] text-slate-500">
            <span><span className="font-semibold text-slate-700">{grouped.length}</span> unique status{grouped.length !== 1 ? 'es' : ''}</span>
            <span className="text-slate-300">·</span>
            <span><span className="font-semibold text-slate-700">{totalRaw}</span> total event{totalRaw !== 1 ? 's' : ''}</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ActionTimeline;