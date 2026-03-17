import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, FileText, AlignLeft, Type, ChevronDown, ChevronRight, Eye, ToggleLeft, ToggleRight } from 'lucide-react';

// ─── Template Preview Modal ──────────────────────────────────────────────────
const TemplatePreviewModal = ({ template, html, onInsert, onClose }) => {
  const [autoInsert, setAutoInsert] = useState(false);
  const [pendingText, setPendingText] = useState('');
  const [btnPos, setBtnPos] = useState(null);
  const contentRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    const onDown = (e) => {
      if (!e.target.closest('[data-template-insert-btn]')) {
        setPendingText('');
        setBtnPos(null);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const handleMouseUp = useCallback(() => {
    const sel = window.getSelection();
    const text = sel?.toString().trim();

    if (!text || !contentRef.current?.contains(sel?.anchorNode)) {
      if (!autoInsert) { setPendingText(''); setBtnPos(null); }
      return;
    }

    if (autoInsert) {
      onInsert(text);
      sel.removeAllRanges();
      return;
    }

    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    setBtnPos({ top: rect.bottom + 8, left: rect.left });
    setPendingText(text);
  }, [autoInsert, onInsert]);

  return (
    <>
      <div className="fixed inset-0 z-[200] bg-black/50" onClick={onClose} />

      <div
        className="fixed z-[210] top-1/2 left-1/2 bg-white rounded-xl shadow-2xl border border-gray-200 flex flex-col"
        style={{ width: '620px', maxHeight: '82vh', transform: 'translate(-50%, -50%)' }}
      >
        <div className="flex items-center justify-between px-4 py-2.5 bg-indigo-50 border-b border-indigo-100 rounded-t-xl flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-4 h-4 text-indigo-600 flex-shrink-0" />
            <span className="text-sm font-bold text-indigo-900 truncate">{template.title}</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-3">
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-gray-500 whitespace-nowrap">Auto-insert</span>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setAutoInsert(v => !v)}
                className={`transition-colors ${autoInsert ? 'text-indigo-600' : 'text-gray-300'}`}
                title={autoInsert ? 'Auto-insert ON' : 'Auto-insert OFF'}
              >
                {autoInsert ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
              </button>
            </div>
            <button
              onMouseDown={(e) => { e.preventDefault(); onInsert(html); onClose(); }}
              className="px-2.5 py-1 text-[11px] font-bold bg-indigo-600 text-white rounded hover:bg-indigo-700 whitespace-nowrap"
            >
              Insert All
            </button>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded flex-shrink-0">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>

        <div className="px-4 py-1 bg-amber-50 border-b border-amber-100 flex-shrink-0">
          <p className="text-[10px] text-amber-700">
            {autoInsert
              ? '⚡ Auto-insert ON — any text you select is inserted instantly at your cursor'
              : '✋ Select any text and an Insert button will appear — or toggle Auto-insert'}
          </p>
        </div>

        <div
          ref={contentRef}
          className="flex-1 overflow-y-auto p-5 text-sm leading-relaxed"
          style={{ userSelect: 'text', cursor: 'text' }}
          onMouseUp={handleMouseUp}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>

      {pendingText && btnPos && !autoInsert && (
        <div
          data-template-insert-btn="1"
          className="fixed z-[220] flex items-center gap-1"
          style={{ top: btnPos.top, left: btnPos.left }}
        >
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onInsert(pendingText);
              window.getSelection()?.removeAllRanges();
              setPendingText('');
              setBtnPos(null);
            }}
            className="px-3 py-1.5 text-[11px] font-bold bg-indigo-600 text-white rounded-lg shadow-xl hover:bg-indigo-700 border-2 border-white flex items-center gap-1.5"
          >
            <AlignLeft className="w-3 h-3" />
            Insert "{pendingText.length > 30 ? pendingText.slice(0, 30) + '…' : pendingText}"
          </button>
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              setPendingText('');
              setBtnPos(null);
              window.getSelection()?.removeAllRanges();
            }}
            className="p-1 bg-white rounded-full shadow-lg hover:bg-gray-100 border border-gray-200"
          >
            <X className="w-3 h-3 text-gray-400" />
          </button>
        </div>
      )}
    </>
  );
};

// ─── Main Search Panel ───────────────────────────────────────────────────────
export const TemplateSearchPanel = ({ isOpen, onClose, onInsert, templateList = [] }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [expandedTemplates, setExpandedTemplates] = useState({});
  const [previewTemplate, setPreviewTemplate] = useState(null);

  const debounceRef = useRef(null);
  const contentCacheRef = useRef({});
  const activeQueryRef = useRef('');

  const getId = (t) => {
    const id = t?._id || t?.id;
    if (!id || typeof id !== 'string' || id.length !== 24) return null;
    return id;
  };

  useEffect(() => {
    if (!isOpen) { setQuery(''); setResults([]); setPreviewTemplate(null); }
  }, [isOpen]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); activeQueryRef.current = ''; return; }
    debounceRef.current = setTimeout(() => runSearch(query.trim()), 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, templateList]);

  // Pure regex extraction — works on any HTML string without needing a DOM node attached
const extractLines = (html) => {
  if (!html) return [];

  const BLOCK_TAGS = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'TD', 'TH', 'BLOCKQUOTE', 'PRE', 'ARTICLE', 'SECTION']);
  const results = [];

  let body;
  try {
    body = new DOMParser().parseFromString(html, 'text/html').body;
  } catch {
    return [];
  }

  const isBlock = (el) => el.nodeType === 1 && BLOCK_TAGS.has(el.tagName);
  // An element is a "visual line" if it has NO block-element children
  const hasBlockChild = (el) => [...el.children].some(isBlock);

  const walk = (el) => {
    if (!isBlock(el)) return;
    if (hasBlockChild(el)) {
      // Container — recurse into block children
      for (const child of el.children) walk(child);
    } else {
      // Leaf visual line — no block descendants, capture outerHTML with all inline styles/tags
      const plain = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (plain) results.push({ plain, html: el.outerHTML });
    }
  };

  for (const child of body.children) walk(child);

  // Fallback: no block elements at all (pure inline/text content)
  if (results.length === 0) {
    const plain = (body.textContent || '').replace(/\s+/g, ' ').trim();
    if (plain) results.push({ plain, html });
  }

  return results;
};

  const matchTemplate = (template, id, html, qLower) => {
    const lines = extractLines(html);
    const matchingLines = lines.map(({ plain, html: lineHTML }) => {
      if (!plain.toLowerCase().includes(qLower)) return null;
      const words = plain.split(/\s+/).filter(w => w.trim());
      const matchingWords = [...new Set(
        words.filter(w => w.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().includes(qLower))
      )];
      return { lineText: plain, lineHTML, matchingWords };
    }).filter(Boolean);
    return matchingLines.length > 0 ? { template, matches: matchingLines, id } : null;
  };

  // Fully synchronous — templateList already has htmlContent, zero API calls
  const runSearch = (q) => {
    activeQueryRef.current = q;
    const qLower = q.toLowerCase();
    const newResults = [];

    for (const template of templateList) {
      const id = getId(template);
      if (!id) continue;

      // Seed cache from the already-fetched template data
      if (contentCacheRef.current[id] === undefined) {
        contentCacheRef.current[id] = template.htmlContent || '';
      }

      const html = contentCacheRef.current[id];
      if (!html) continue;

      const hit = matchTemplate(template, id, html, qLower);
      if (hit) newResults.push(hit);
    }

    setResults(newResults);
    const expanded = {};
    newResults.forEach(r => { expanded[r.id] = true; });
    setExpandedTemplates(expanded);
  };

  // No API call — htmlContent is already on the template object
  const handleOpenPreview = (template, id) => {
    if (contentCacheRef.current[id] === undefined) {
      contentCacheRef.current[id] = template.htmlContent || '';
    }
    setPreviewTemplate({ template, html: contentCacheRef.current[id] });
  };

  const highlightMatch = (text, q) => {
    if (!q) return text;
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return text.replace(new RegExp(`(${escaped})`, 'gi'),
      '<mark style="background:#fef08a;padding:0 1px;border-radius:2px;">$1</mark>');
  };

  if (!isOpen) return null;

  return (
    <>
      {/* ── Side Panel ── */}
      <div
        className="flex flex-col bg-white border-l border-indigo-100 shadow-2xl overflow-hidden flex-shrink-0"
        style={{ width: '280px' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 bg-indigo-50 border-b border-indigo-100 flex-shrink-0">
          <div className="flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5 text-indigo-600" />
            <span className="text-xs font-bold text-indigo-800">Search in Templates</span>
          </div>
          <button onClick={onClose} className="p-0.5 hover:bg-indigo-100 rounded">
            <X className="w-3.5 h-3.5 text-indigo-500" />
          </button>
        </div>

        {/* Search input */}
        <div className="px-2 py-2 border-b border-gray-100 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type word or phrase…"
              autoFocus
              className="w-full pl-6 pr-6 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
            />
            {query && (
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setQuery('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 hover:bg-gray-100 rounded"
              >
                <X className="w-3 h-3 text-gray-400" />
              </button>
            )}
          </div>
          <p className="text-[9px] text-gray-400 mt-0.5">{templateList.length} templates</p>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {!query && (
            <div className="py-8 px-4 text-center">
              <Search className="w-6 h-6 text-gray-300 mx-auto mb-2" />
              <p className="text-xs text-gray-400 leading-relaxed">Type a word or phrase to search inside all templates</p>
              <div className="mt-3 text-[9px] text-gray-300 space-y-1">
                <p><span className="bg-yellow-100 border border-yellow-300 px-1 rounded">Word</span> — inserts a word</p>
                <p><span className="bg-green-100 border border-green-300 px-1 rounded">Line</span> — inserts a full line</p>
                <p className="flex items-center justify-center gap-1"><Eye className="w-2.5 h-2.5" /> — opens preview to select &amp; insert</p>
              </div>
            </div>
          )}

          {query && results.length === 0 && (
            <div className="py-8 px-4 text-center">
              <p className="text-xs text-gray-400">No templates contain <strong>"{query}"</strong></p>
            </div>
          )}

          {results.map(({ template, matches, id }) => (
            <div key={id} className="border-b border-gray-100">
              {/* Template header row */}
              <div className="flex items-center gap-1 px-2 py-1.5 bg-indigo-50 hover:bg-indigo-100 select-none">
                <button
                  className="flex items-center gap-1 flex-1 min-w-0 text-left"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setExpandedTemplates(prev => ({ ...prev, [id]: !prev[id] }))}
                >
                  {expandedTemplates[id]
                    ? <ChevronDown className="w-3 h-3 text-indigo-400 flex-shrink-0" />
                    : <ChevronRight className="w-3 h-3 text-indigo-400 flex-shrink-0" />}
                  <FileText className="w-3 h-3 text-indigo-500 flex-shrink-0" />
                  <span className="text-[11px] font-semibold text-indigo-800 truncate">{template.title}</span>
                </button>
                <span className="text-[9px] text-indigo-400 flex-shrink-0 mx-0.5">{matches.length}</span>
                {/* Preview button */}
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleOpenPreview(template, id)}
                  className="flex-shrink-0 p-0.5 text-indigo-400 hover:text-indigo-700 hover:bg-white rounded"
                  title="Preview template — select text to insert at cursor"
                >
                  <Eye className="w-3.5 h-3.5" />
                </button>
                {/* Insert All */}
                <button
                  onMouseDown={(e) => {
                    e.preventDefault();
                    const html = contentCacheRef.current[id] ?? template.htmlContent ?? '';
                    if (html) onInsert(html);
                  }}
                  className="flex-shrink-0 px-1.5 py-0.5 text-[9px] font-bold bg-indigo-600 text-white rounded hover:bg-indigo-700"
                  title="Insert entire template at cursor"
                >
                  All
                </button>
              </div>

              {/* Matching lines */}
              {expandedTemplates[id] && (
                <div>
                  {matches.slice(0, 8).map((match, mi) => (
                    <div key={mi} className="px-2 py-1.5 border-t border-gray-50 hover:bg-gray-50">
                      <div className="flex items-start gap-1.5 mb-1">
                        <div
                          className="flex-1 text-[10px] text-gray-700 leading-relaxed break-words min-w-0"
                          dangerouslySetInnerHTML={{ __html: highlightMatch(match.lineText, query) }}
                        />
                        <button
                          onMouseDown={(e) => { e.preventDefault(); onInsert(match.lineHTML || `<span>${match.lineText}</span>`); }}
                          className="flex-shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] bg-green-50 text-green-700 border border-green-200 rounded hover:bg-green-100 whitespace-nowrap"
                          title="Insert this line at cursor"
                        >
                          <AlignLeft className="w-2.5 h-2.5" /> Line
                        </button>
                      </div>
                      {match.matchingWords.length > 0 && (
                        <div className="flex flex-wrap gap-0.5">
                          {match.matchingWords.slice(0, 8).map((word, wi) => (
                            <button
                              key={wi}
                              onMouseDown={(e) => { e.preventDefault(); onInsert(word); }}
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-medium bg-yellow-50 text-yellow-800 border border-yellow-200 rounded hover:bg-yellow-100"
                              title={`Insert "${word}" at cursor`}
                            >
                              <Type className="w-2 h-2" />{word}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {matches.length > 8 && (
                    <div className="px-2 py-1 text-[9px] text-gray-400 bg-gray-50">
                      +{matches.length - 8} more lines
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Legend */}
        {results.length > 0 && (
          <div className="flex-shrink-0 px-2 py-1.5 border-t border-gray-100 bg-gray-50 flex gap-3">
            <span className="text-[9px] text-gray-400 flex items-center gap-0.5">
              <span className="inline-block w-2 h-2 rounded bg-yellow-100 border border-yellow-300" /> word
            </span>
            <span className="text-[9px] text-gray-400 flex items-center gap-0.5">
              <span className="inline-block w-3 h-2 rounded bg-green-100 border border-green-300" /> line
            </span>
            <span className="text-[9px] text-gray-400 flex items-center gap-0.5">
              <Eye className="w-2.5 h-2.5" /> preview
            </span>
          </div>
        )}
      </div>

      {previewTemplate && (
        <TemplatePreviewModal
          template={previewTemplate.template}
          html={previewTemplate.html}
          onInsert={onInsert}
          onClose={() => setPreviewTemplate(null)}
        />
      )}
    </>
  );
};

export default TemplateSearchPanel;