import React from 'react';
import { useState, useRef, useEffect, useCallback, useImperativeHandle } from 'react';

const ReportEditor = React.forwardRef(({ content, onChange, containerWidth = 100, isOpen = true }, ref) => {
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [paginatedContent, setPaginatedContent] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fontSize, setFontSize] = useState('11pt');
  const [fontFamily, setFontFamily] = useState('Comic Sans MS');
  const [showWordCount, setShowWordCount] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [darkMode, setDarkMode] = useState(false);
  const [lineSpacing, setLineSpacing] = useState('1.4');
  const [showRuler, setShowRuler] = useState(false); // ✅ Default OFF for compactness

  // ✅ NEW: Margin controls (in cm)
  const [margins, setMargins] = useState({
    top: 1.27,
    bottom: 1.27,
    left: 1.27,
    right: 1.27
  });
  const [showMarginControls, setShowMarginControls] = useState(false);

  const [activeTools, setActiveTools] = useState({
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
    subscript: false,
    superscript: false
  });
  const contentEditableRef = useRef(null);

  // Color pickers
  const [showTextColorPicker, setShowTextColorPicker] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);

  // ✅ FORMAT PAINTER
  const [formatPainterActive, setFormatPainterActive] = useState(false);
  const storedFormatRef = useRef(null);

  const savedRangeRef = useRef(null);

  const saveSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      // Only save if the range is actually inside our editor
      if (contentEditableRef.current && contentEditableRef.current.contains(range.commonAncestorContainer)) {
        savedRangeRef.current = range.cloneRange();
      }
    }
  };

  useImperativeHandle(ref, () => ({
    insertHTML: (html) => {
      if (!contentEditableRef.current) return;
      contentEditableRef.current.focus();

      const sel = window.getSelection();
      if (sel) {
        if (savedRangeRef.current) {
          try {
            sel.removeAllRanges();
            sel.addRange(savedRangeRef.current);
          } catch {
            // saved range references dead nodes (editor content was replaced) — fall back to end
            const r = document.createRange();
            r.selectNodeContents(contentEditableRef.current);
            r.collapse(false);
            sel.removeAllRanges();
            sel.addRange(r);
          }
        } else {
          // No saved position yet — place cursor at end of editor
          const r = document.createRange();
          r.selectNodeContents(contentEditableRef.current);
          r.collapse(false);
          sel.removeAllRanges();
          sel.addRange(r);
        }
      }

      const range = sel ? sel.getRangeAt(0) : null;
      if (range) {
        range.deleteContents();
        // Parse via innerHTML — 100% faithful, preserves all tags/styles/attributes
        const temp = document.createElement('div');
        temp.innerHTML = html;
        const fragment = document.createDocumentFragment();
        while (temp.firstChild) fragment.appendChild(temp.firstChild);
        const lastNode = fragment.lastChild;
        range.insertNode(fragment);
        if (lastNode) {
          try {
            const newRange = document.createRange();
            newRange.setStartAfter(lastNode);
            newRange.collapse(true);
            sel.removeAllRanges();
            sel.addRange(newRange);
          } catch { }
        }
      } else {
        // Absolute last resort
        document.execCommand('insertHTML', false, html);
      }
      setTimeout(() => {
        if (contentEditableRef.current) onChange(contentEditableRef.current.innerHTML);
      }, 10);
    },
    focus: () => contentEditableRef.current?.focus(),
  }), [onChange]);

  const [showFindReplace, setShowFindReplace] = useState(false);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [showTableDialog, setShowTableDialog] = useState(false);
  const [tableDialogRows, setTableDialogRows] = useState(3);
  const [tableDialogCols, setTableDialogCols] = useState(3);
  const [showLineSpacingMenu, setShowLineSpacingMenu] = useState(false);

  // When content prop changes, update the editor's view
  useEffect(() => {
    if (contentEditableRef.current && content !== contentEditableRef.current.innerHTML) {
      contentEditableRef.current.innerHTML = content || '';
    }
  }, [content]);

  // Process content for multi-page preview
  const processContentForPreview = useCallback((htmlContent) => {
    if (!htmlContent) return '';

    if (htmlContent.includes('report-page')) {
      return htmlContent.replace(
        /(<div[^>]*class="[^"]*report-page[^"]*"[^>]*>)/g,
        '$1'
      );
    }

    return `
      <div class="report-page-preview" data-page="1">
        ${htmlContent}
      </div>
    `;
  }, []);

  // Update paginated content when content or preview mode changes
  useEffect(() => {
    if (isPreviewMode && content) {
      const processed = processContentForPreview(content);
      setPaginatedContent(processed);
    }
  }, [content, isPreviewMode, processContentForPreview]);

  const handleContentChange = (e) => {
    onChange(e.target.innerHTML);
    updateToolStates();
  };

  // ✅ PASTE SANITIZER
  // Word, Google Docs, Outlook and web pages all paste hostile HTML: outer
  // wrapper divs with inline font-size/line-height, mso-* styles, and
  // <br>-only "lines". Left untouched, that breaks per-line tools later
  // (line-spacing applies to the whole template, font-size loses to inline
  // styles, etc.). We sanitize on paste so the rest of the editor sees a
  // clean tree of <p> blocks.
  const sanitizePastedHtml = (rawHtml) => {
    const doc = new DOMParser().parseFromString(rawHtml, 'text/html');
    const body = doc.body;
    if (!body) return '';

    // Remove Word/Office artifacts entirely
    body.querySelectorAll('o\\:p, style, meta, link, script, title, xml').forEach((el) => el.remove());

    // Strip all <!--[if ...]>...<![endif]--> conditional comments via innerHTML scrub
    body.innerHTML = body.innerHTML.replace(/<!--[\s\S]*?-->/g, '');

    // Allowed inline style properties — anything else (font-size, line-height,
    // margin, font-family, color from outer wrappers, mso-*) gets removed.
    const ALLOWED_STYLE_PROPS = new Set(['text-align', 'font-weight', 'font-style', 'text-decoration']);

    body.querySelectorAll('*').forEach((el) => {
      // Drop class and id (Mso*, docs-internal-guid-*, etc.)
      el.removeAttribute('class');
      el.removeAttribute('id');
      el.removeAttribute('lang');
      el.removeAttribute('dir');
      el.removeAttribute('align');

      const style = el.getAttribute('style');
      if (style) {
        const kept = style
          .split(';')
          .map((s) => s.trim())
          .filter(Boolean)
          .filter((decl) => {
            const prop = decl.split(':')[0]?.trim().toLowerCase();
            return prop && ALLOWED_STYLE_PROPS.has(prop);
          })
          .join('; ');
        if (kept) el.setAttribute('style', kept);
        else el.removeAttribute('style');
      }
    });

    // Convert <br>-separated content inside a block into real <p> blocks.
    // Only do this for block containers that have <br> children — we don't
    // want to mangle a <p> that happens to use a single <br> for a soft wrap.
    body.querySelectorAll('div, section, article').forEach((container) => {
      const brs = container.querySelectorAll(':scope > br');
      if (brs.length === 0) return;

      const newChildren = [];
      let buffer = [];
      const flush = () => {
        if (buffer.length === 0) return;
        const p = doc.createElement('p');
        buffer.forEach((n) => p.appendChild(n));
        newChildren.push(p);
        buffer = [];
      };
      Array.from(container.childNodes).forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'BR') {
          flush();
        } else {
          buffer.push(node);
        }
      });
      flush();
      container.innerHTML = '';
      newChildren.forEach((p) => container.appendChild(p));
    });

    // Unwrap pure-wrapper <div>/<span> that hold no semantics — promote
    // their children up so the paste isn't trapped in one giant container.
    const unwrapAll = (selector) => {
      let changed = true;
      while (changed) {
        changed = false;
        body.querySelectorAll(selector).forEach((el) => {
          if (!el.getAttribute('style')) {
            const parent = el.parentNode;
            while (el.firstChild) parent.insertBefore(el.firstChild, el);
            parent.removeChild(el);
            changed = true;
          }
        });
      }
    };
    unwrapAll('div:not([style])');
    unwrapAll('span:not([style])');

    return body.innerHTML;
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const cd = e.clipboardData;
    if (!cd) return;

    const html = cd.getData('text/html');
    const text = cd.getData('text/plain');

    let cleanHtml;
    if (html && html.trim()) {
      cleanHtml = sanitizePastedHtml(html);
    } else if (text) {
      // Plain-text paste: split on newlines into <p> blocks so per-line tools
      // work afterwards.
      const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      cleanHtml = text
        .split(/\r?\n/)
        .map((line) => `<p>${escape(line) || '<br>'}</p>`)
        .join('');
    } else {
      return;
    }

    // Insert at the current selection inside the editor
    contentEditableRef.current?.focus();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();

    const temp = document.createElement('div');
    temp.innerHTML = cleanHtml;
    const frag = document.createDocumentFragment();
    let lastNode = null;
    while (temp.firstChild) {
      lastNode = temp.firstChild;
      frag.appendChild(temp.firstChild);
    }
    range.insertNode(frag);

    if (lastNode) {
      const newRange = document.createRange();
      newRange.setStartAfter(lastNode);
      newRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(newRange);
    }

    setTimeout(() => {
      if (contentEditableRef.current) onChange(contentEditableRef.current.innerHTML);
    }, 10);
  };

  // ✅ FIXED: Update active tool states properly
  const updateToolStates = () => {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    setActiveTools({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      strikethrough: document.queryCommandState('strikeThrough'),
      subscript: document.queryCommandState('subscript'),
      superscript: document.queryCommandState('superscript')
    });
  };

  // ✅ FIXED: Enhanced command wrapper — focus first, then exec, don't force-restore range
  const applyCommand = (command, value = null) => {
    if (contentEditableRef.current) {
      contentEditableRef.current.focus();
    }

    // Restore saved selection if browser lost it (e.g. toolbar click stole focus)
    const sel = window.getSelection();
    if ((!sel || sel.rangeCount === 0) && savedRangeRef.current) {
      try {
        sel.removeAllRanges();
        sel.addRange(savedRangeRef.current);
      } catch { }
    }

    document.execCommand(command, false, value);

    // Save the new selection position after command
    saveSelection();

    // Update button states
    setTimeout(updateToolStates, 10);

    // Trigger change
    setTimeout(() => {
      if (contentEditableRef.current) onChange(contentEditableRef.current.innerHTML);
    }, 10);
  };

  // ✅ FIXED: Properly working font size change across multi-line / multi-block selections
  const applyFontSize = (size) => {
    setFontSize(size);

    const selection = window.getSelection();
    if (!selection.rangeCount) {
      contentEditableRef.current?.focus();
      return;
    }

    const range = selection.getRangeAt(0);

    if (range.collapsed) {
      contentEditableRef.current?.focus();
      return;
    }

    const root = contentEditableRef.current;
    if (!root) return;

    try {
      // 1. Collect every text node that intersects the selection.
      //    Wrapping a multi-block fragment in a single <span> produces invalid
      //    HTML (block elements inside an inline) and the size silently fails
      //    on the inner blocks — which is exactly the "only line spacing
      //    changes" symptom. Walking text nodes one-by-one avoids that.
      const textNodes = [];
      const walker = document.createTreeWalker(
        range.commonAncestorContainer.nodeType === Node.TEXT_NODE
          ? range.commonAncestorContainer.parentNode
          : range.commonAncestorContainer,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) => {
            if (!node.nodeValue || !node.nodeValue.length) return NodeFilter.FILTER_REJECT;
            if (!range.intersectsNode(node)) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
          }
        }
      );
      let n = walker.nextNode();
      while (n) {
        textNodes.push(n);
        n = walker.nextNode();
      }
      // Edge case: selection entirely within a single text node and the
      // walker started past it.
      if (textNodes.length === 0 && range.startContainer === range.endContainer && range.startContainer.nodeType === Node.TEXT_NODE) {
        textNodes.push(range.startContainer);
      }

      const startContainer = range.startContainer;
      const endContainer = range.endContainer;
      const startOffset = range.startOffset;
      const endOffset = range.endOffset;

      const wrappedSpans = [];

      // 2. For each text node, slice the portion inside the selection
      //    (handling partial start/end nodes) and wrap it in a span.fontSize.
      //    Also strip any inherited font-size from ancestor spans on that
      //    portion so the new size actually wins.
      textNodes.forEach((textNode) => {
        let node = textNode;
        if (node === startContainer && startOffset > 0) {
          node = node.splitText(startOffset);
          // After split, end offset on the same node needs adjusting
          if (textNode === endContainer) {
            // endOffset was relative to the original node
            const newEndOffset = endOffset - startOffset;
            if (newEndOffset < node.nodeValue.length) {
              node.splitText(newEndOffset);
            }
          }
        } else if (node === endContainer && endOffset < node.nodeValue.length) {
          node.splitText(endOffset);
        }

        if (!node.nodeValue || !node.nodeValue.length) return;

        const span = document.createElement('span');
        span.style.fontSize = size;
        node.parentNode.insertBefore(span, node);
        span.appendChild(node);
        wrappedSpans.push(span);
      });

      // 3. Neutralize any descendant spans inside the wrapped regions that
      //    still carry an explicit font-size from a previous edit — they would
      //    otherwise win via specificity and you'd see "no change".
      wrappedSpans.forEach((wrapper) => {
        wrapper.querySelectorAll('span[style*="font-size"]').forEach((inner) => {
          inner.style.fontSize = '';
          if (!inner.getAttribute('style')) inner.removeAttribute('style');
        });
      });

      // 4. Restore a selection that spans the wrapped region.
      if (wrappedSpans.length > 0) {
        const newRange = document.createRange();
        newRange.setStartBefore(wrappedSpans[0]);
        newRange.setEndAfter(wrappedSpans[wrappedSpans.length - 1]);
        selection.removeAllRanges();
        selection.addRange(newRange);
      }
    } catch (e) {
      console.error('Error applying font size:', e);
    }

    contentEditableRef.current?.focus();

    setTimeout(() => {
      if (contentEditableRef.current) {
        onChange(contentEditableRef.current.innerHTML);
      }
    }, 10);
  };

  const applyFontFamily = (family) => {
    setFontFamily(family);
    document.execCommand('fontName', false, family);
    contentEditableRef.current?.focus();
  };

  // ✅ FORMAT PAINTER: Capture formatting from current selection
  const activateFormatPainter = () => {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    const node = selection.anchorNode?.parentElement || selection.anchorNode;
    if (!node) return;
    const computed = window.getComputedStyle(node);
    storedFormatRef.current = {
      fontWeight: computed.fontWeight,
      fontStyle: computed.fontStyle,
      textDecoration: computed.textDecoration,
      fontFamily: computed.fontFamily,
      fontSize: computed.fontSize,
      color: computed.color,
    };
    setFormatPainterActive(true);
  };

  // ✅ FORMAT PAINTER: Apply stored format to current selection
  const applyStoredFormat = useCallback(() => {
    if (!formatPainterActive || !storedFormatRef.current) return;
    const selection = window.getSelection();
    if (!selection.rangeCount || selection.isCollapsed) return;
    const range = selection.getRangeAt(0);
    const span = document.createElement('span');
    const fmt = storedFormatRef.current;
    span.style.fontWeight = fmt.fontWeight;
    span.style.fontStyle = fmt.fontStyle;
    span.style.textDecoration = fmt.textDecoration;
    span.style.fontFamily = fmt.fontFamily;
    span.style.fontSize = fmt.fontSize;
    span.style.color = fmt.color;
    try {
      const fragment = range.extractContents();
      span.appendChild(fragment);
      range.insertNode(span);
    } catch (e) { /* fallback */ }
    setFormatPainterActive(false);
    storedFormatRef.current = null;
    setTimeout(() => {
      if (contentEditableRef.current) onChange(contentEditableRef.current.innerHTML);
    }, 10);
  }, [formatPainterActive, onChange]);

  // Word count functionality
  const getWordCount = () => {
    const text = contentEditableRef.current?.innerText || '';
    const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;
    const characters = text.length;
    const charactersNoSpaces = text.replace(/\s/g, '').length;
    return { words, characters, charactersNoSpaces };
  };

  // Page count
  const getPageCount = () => {
    const pages = document.querySelectorAll('.report-page, .report-page-preview');
    return pages.length || 1;
  };

  // Find and replace functionality
  const handleFind = () => {
    if (!findText) return;
    window.find(findText);
  };

  const handleReplace = () => {
    if (!findText || !replaceText) return;
    const content = contentEditableRef.current?.innerHTML || '';
    const updatedContent = content.replace(new RegExp(findText, 'g'), replaceText);
    if (contentEditableRef.current) {
      contentEditableRef.current.innerHTML = updatedContent;
      onChange(updatedContent);
    }
  };

  // Insert table
  const insertTable = (rows = 2, cols = 2) => {
    let tableHTML = '<table style="border-collapse: collapse; width: 100%; margin: 10px 0;"><tbody>';
    for (let i = 0; i < rows; i++) {
      tableHTML += '<tr>';
      for (let j = 0; j < cols; j++) {
        tableHTML += '<td style="border: 1px solid #ddd; padding: 8px; min-width: 50px;">&nbsp;</td>';
      }
      tableHTML += '</tr>';
    }
    tableHTML += '</tbody></table>';
    document.execCommand('insertHTML', false, tableHTML);
  };

  // Apply line spacing to selected blocks or whole editor
  const applyLineSpacing = (value) => {
    setLineSpacing(value);

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !contentEditableRef.current) return;

    const range = sel.getRangeAt(0);

    // If nothing is selected (collapsed cursor), apply to the block the cursor is in
    // If text is selected, apply to all block-level ancestors in the selection
    const getBlockParent = (node) => {
      let n = node.nodeType === 3 ? node.parentElement : node;
      while (n && n !== contentEditableRef.current) {
        const display = window.getComputedStyle(n).display;
        if (display === 'block' || display === 'list-item' || n.tagName === 'P' || n.tagName === 'DIV' || n.tagName === 'LI' || n.tagName === 'H1' || n.tagName === 'H2' || n.tagName === 'H3') {
          return n;
        }
        n = n.parentElement;
      }
      return contentEditableRef.current;
    };

    const blocks = new Set();

    if (range.collapsed) {
      // Cursor only — apply to current block
      blocks.add(getBlockParent(range.startContainer));
    } else {
      // Walk through all nodes in the selection range
      const walker = document.createTreeWalker(
        range.commonAncestorContainer,
        NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
        { acceptNode: (node) => range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT }
      );
      let node = walker.currentNode;
      while (node) {
        blocks.add(getBlockParent(node));
        node = walker.nextNode();
      }
    }

    blocks.forEach((block) => {
      // Safety: never set line-height on the editor root itself — that
      // silently re-styles the entire template. This happens when pasted
      // content has no inner block elements and getBlockParent climbs all
      // the way up.
      if (!block || block === contentEditableRef.current) return;
      block.style.lineHeight = value;
    });

    // Trigger content change
    setTimeout(() => {
      if (contentEditableRef.current) onChange(contentEditableRef.current.innerHTML);
    }, 10);
  };

  // Insert horizontal line
  const insertHorizontalLine = () => {
    document.execCommand('insertHTML', false, '<hr style="border: none; border-top: 1px solid #ddd; margin: 15px 0;">');
  };

  // Insert page break
  const insertPageBreak = () => {
    const pageBreakHTML = '<div style="page-break-after: always; border-top: 2px dashed #999; margin: 20px 0; padding: 10px 0; text-align: center; color: #999; font-size: 10pt;">--- Page Break ---</div>';
    document.execCommand('insertHTML', false, pageBreakHTML);
  };

  // ✅ NEW: Margin update handler
  const updateMargin = (side, value) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue < 0 || numValue > 5) return;

    setMargins(prev => ({
      ...prev,
      [side]: numValue
    }));
  };

  // ✅ NEW: Preset margin layouts
  const applyMarginPreset = (preset) => {
    const presets = {
      normal: { top: 2.54, bottom: 2.54, left: 2.54, right: 2.54 },
      narrow: { top: 1.27, bottom: 1.27, left: 1.27, right: 1.27 },
      moderate: { top: 2.54, bottom: 2.54, left: 1.91, right: 1.91 },
      wide: { top: 2.54, bottom: 2.54, left: 5.08, right: 5.08 }
    };

    if (presets[preset]) {
      setMargins(presets[preset]);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'b':
            e.preventDefault();
            applyCommand('bold');
            break;
          case 'i':
            e.preventDefault();
            applyCommand('italic');
            break;
          case 'u':
            e.preventDefault();
            applyCommand('underline');
            break;
          case 'f':
            e.preventDefault();
            setShowFindReplace(!showFindReplace);
            break;
          case 'p':
            e.preventDefault();
            setIsPreviewMode(!isPreviewMode);
            break;
          case 'z':
            // Let browser handle undo natively (don't preventDefault)
            break;
          case 'y':
            // Let browser handle redo natively
            break;
        }
      }

      if (e.ctrlKey && e.shiftKey && e.key === 'Enter') {
        e.preventDefault();
        setIsPreviewMode(!isPreviewMode);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPreviewMode, showFindReplace]);

  const ToolbarButton = ({ onClick, active, children, tooltip, className = "", disabled = false }) => (
    <button
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={tooltip}
      disabled={disabled}
      className={`
        flex items-center justify-center w-7 h-7 rounded text-sm font-medium
        transition-all duration-100
        ${active
          ? 'bg-blue-100 text-blue-700 border border-blue-300'
          : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
      `}
    >
      {children}
    </button>
  );

  const ToolbarSeparator = () => (
    <div className="w-px h-5 bg-gray-300 mx-0.5"></div>
  );

  const ToolbarGroup = ({ children }) => (
    <div className="flex items-center gap-0.5 bg-gray-50 rounded p-0.5">
      {children}
    </div>
  );

  return (
    <div className={`flex flex-col h-screen transition-all duration-300 ${darkMode ? 'bg-gray-900' : 'bg-gray-100'
      } ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>

      {/* ✅ TOOLBAR: Sticky at top with gap below */}
      <div className={`sticky top-0 z-40 border-b ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}>

        {/* Ultra compact toolbar */}
        <div className="px-2 py-1.5 flex flex-wrap items-center gap-1 text-[11px]">
          {/* Font Controls */}
          <select
            value={fontFamily}
            onChange={(e) => applyFontFamily(e.target.value)}
            className="px-1 py-1 bg-white border border-gray-300 rounded text-[11px] focus:ring-1 focus:ring-blue-400 focus:border-blue-400 w-36"
            title="Font"
          >
            <option value="Arial">Arial</option>
            <option value="Arial Black">Arial Black</option>
            <option value="Calibri">Calibri</option>
            <option value="Calibri Light">Calibri Light</option>
            <option value="Comic Sans MS">Comic Sans MS</option>
            <option value="Courier New">Courier New</option>
            <option value="Georgia">Georgia</option>
            <option value="Impact">Impact</option>
            <option value="Palatino Linotype">Palatino</option>
            <option value="Segoe Print">Segoe Print</option>
            <option value="Segoe Script">Segoe Script</option>
            <option value="Segoe UI">Segoe UI</option>
            <option value="Sylfaen">Sylfaen</option>
            <option value="Symbol">Symbol</option>
            <option value="Tahoma">Tahoma</option>
            <option value="Times New Roman">Times New Roman</option>
            <option value="Trebuchet MS">Trebuchet MS</option>
            <option value="Verdana">Verdana</option>
            <option value="Webdings">Webdings</option>
            <option value="Wingdings">Wingdings ✉</option>
          </select>

          <select
            value={fontSize}
            onChange={(e) => applyFontSize(e.target.value)}
            className="px-1 py-1 bg-white border border-gray-300 rounded text-[11px] focus:ring-1 focus:ring-blue-400 focus:border-blue-400 w-14"
            title="Size"
          >
            <option value="8pt">8</option>
            <option value="9pt">9</option>
            <option value="10pt">10</option>
            <option value="11pt">11</option>
            <option value="12pt">12</option>
            <option value="14pt">14</option>
            <option value="16pt">16</option>
            <option value="18pt">18</option>
            <option value="20pt">20</option>
          </select>

          <ToolbarSeparator />

          {/* Undo / Redo */}
          <ToolbarGroup>
            <ToolbarButton onClick={() => applyCommand('undo')} tooltip="Undo (Ctrl+Z)">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a5 5 0 015 5v0a5 5 0 01-5 5H10M3 10l4-4M3 10l4 4" />
              </svg>
            </ToolbarButton>
            <ToolbarButton onClick={() => applyCommand('redo')} tooltip="Redo (Ctrl+Y)">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 10H11a5 5 0 00-5 5v0a5 5 0 005 5h3M21 10l-4-4M21 10l-4 4" />
              </svg>
            </ToolbarButton>
          </ToolbarGroup>

          <ToolbarSeparator />

          {/* Format Buttons */}
          <ToolbarGroup>
            <ToolbarButton
              onClick={() => applyCommand('bold')}
              active={activeTools.bold}
              tooltip="Bold (Ctrl+B)"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M13.5 15.5H10V12.5H13.5A1.5 1.5 0 1113.5 15.5M15 10.5A1.5 1.5 0 0013.5 9H10V12H13.5A1.5 1.5 0 0015 10.5M15.6 11.79C16.57 11.12 17.25 10.02 17.25 9C17.25 6.74 15.5 5 13.25 5H7V19H14.04C16.13 19 17.75 17.3 17.75 15.21C17.75 13.69 16.89 12.39 15.6 11.79Z" />
              </svg>
            </ToolbarButton>

            <ToolbarButton
              onClick={() => applyCommand('italic')}
              active={activeTools.italic}
              tooltip="Italic (Ctrl+I)"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M10 5V8H12.21L8.79 16H6V19H14V16H11.79L15.21 8H18V5H10Z" />
              </svg>
            </ToolbarButton>

            <ToolbarButton
              onClick={() => applyCommand('underline')}
              active={activeTools.underline}
              tooltip="Underline (Ctrl+U)"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M5 21H19V19H5V21M12 17A6 6 0 006 11V3H8V11A4 4 0 0016 11V3H18V11A6 6 0 0012 17Z" />
              </svg>
            </ToolbarButton>
          </ToolbarGroup>

          {/* Text Color */}
          <div className="relative">
            <ToolbarButton
              onClick={() => { setShowTextColorPicker(!showTextColorPicker); setShowHighlightPicker(false); }}
              active={showTextColorPicker}
              tooltip="Text Color"
            >
              <div className="flex flex-col items-center">
                <span className="font-bold text-[13px] leading-none">A</span>
                <div className="w-4 h-1 rounded-sm bg-red-500 mt-px" />
              </div>
            </ToolbarButton>
            {showTextColorPicker && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 p-2 w-36">
                <div className="text-[9px] font-semibold text-gray-500 mb-1">Text Color</div>
                <div className="grid grid-cols-6 gap-1">
                  {['#000000', '#434343', '#666666', '#999999', '#d32f2f', '#c62828',
                    '#ad1457', '#6a1b9a', '#283593', '#1565c0', '#00838f', '#2e7d32',
                    '#558b2f', '#f9a825', '#ff8f00', '#ef6c00', '#d84315', '#37474f'].map(c => (
                      <button key={c}
                        onClick={() => { applyCommand('foreColor', c); setShowTextColorPicker(false); }}
                        className="w-4 h-4 rounded border border-gray-200 hover:scale-125 transition-transform"
                        style={{ backgroundColor: c }} title={c} />
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* Highlight Color */}
          <div className="relative">
            <ToolbarButton
              onClick={() => { setShowHighlightPicker(!showHighlightPicker); setShowTextColorPicker(false); }}
              active={showHighlightPicker}
              tooltip="Highlight"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" />
              </svg>
            </ToolbarButton>
            {showHighlightPicker && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 p-2 w-32">
                <div className="text-[9px] font-semibold text-gray-500 mb-1">Highlight</div>
                <div className="grid grid-cols-4 gap-1">
                  {['transparent', '#ffff00', '#00ff00', '#00ffff', '#ff00ff', '#ffd700',
                    '#ffa07a', '#98fb98', '#add8e6', '#dda0dd', '#ffe4b5', '#f0e68c'].map(c => (
                      <button key={c}
                        onClick={() => { applyCommand('hiliteColor', c); setShowHighlightPicker(false); }}
                        className="w-5 h-5 rounded border border-gray-200 hover:scale-110 transition-transform"
                        style={{ backgroundColor: c === 'transparent' ? '#fff' : c }}
                        title={c === 'transparent' ? 'None' : c}
                      >{c === 'transparent' ? <span className="text-[7px] text-gray-400">x</span> : null}</button>
                    ))}
                </div>
              </div>
            )}
          </div>

          <ToolbarSeparator />

          {/* Format Painter */}
          <ToolbarButton
            onClick={activateFormatPainter}
            active={formatPainterActive}
            tooltip="Format Painter — select text, click to capture, then select target text"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M4 2a2 2 0 00-2 2v1h2V4h3v1h2V4a2 2 0 00-2-2H4zM2 7v2h7V7H2zm0 4v5a2 2 0 002 2h1a2 2 0 002-2v-5H2z" />
            </svg>
          </ToolbarButton>

          <ToolbarSeparator />

          {/* Alignment */}
          <ToolbarGroup>
            <ToolbarButton onClick={() => applyCommand('justifyLeft')} tooltip="Left">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h6a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h6a1 1 0 110 2H4a1 1 0 01-1-1z" />
              </svg>
            </ToolbarButton>

            <ToolbarButton onClick={() => applyCommand('justifyCenter')} tooltip="Center">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3 4a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm0 4a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm-3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" />
              </svg>
            </ToolbarButton>

            <ToolbarButton onClick={() => applyCommand('justifyRight')} tooltip="Right">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M17 4a1 1 0 01-1 1H4a1 1 0 110-2h12a1 1 0 011 1zm0 4a1 1 0 01-1 1h-6a1 1 0 110-2h6a1 1 0 011 1zm0 4a1 1 0 01-1 1H4a1 1 0 110-2h12a1 1 0 011 1zm0 4a1 1 0 01-1 1h-6a1 1 0 110-2h6a1 1 0 011 1z" />
              </svg>
            </ToolbarButton>
          </ToolbarGroup>

          <ToolbarSeparator />

          {/* Lists */}
          <ToolbarGroup>
            <ToolbarButton onClick={() => applyCommand('insertUnorderedList')} tooltip="Bullets">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M6 4a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm0 4a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm0 4a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zM3 7a1 1 0 100-2 1 1 0 000 2zm0 4a1 1 0 100-2 1 1 0 000 2z" />
              </svg>
            </ToolbarButton>

            <ToolbarButton onClick={() => applyCommand('insertOrderedList')} tooltip="Numbering">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 4a1 1 0 01.707-.293l2 2a1 1 0 11-1.414 1.414L3 5.414V4zm0 4a1 1 0 01.707-.293l2 2a1 1 0 11-1.414 1.414L3 9.414V8zM8 5a1 1 0 011-1h8a1 1 0 110 2H9a1 1 0 01-1-1zm0 4a1 1 0 011-1h8a1 1 0 110 2H9a1 1 0 01-1-1z" />
              </svg>
            </ToolbarButton>
          </ToolbarGroup>

          <ToolbarSeparator />

          {/* Insert */}
          <ToolbarGroup>
            <div className="relative">
              <ToolbarButton onClick={() => setShowTableDialog(!showTableDialog)} active={showTableDialog} tooltip="Insert Table">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 4a3 3 0 00-3 3v6a3 3 0 003 3h10a3 3 0 003-3V7a3 3 0 00-3-3H5zm-1 9v-1h5v2H5a1 1 0 01-1-1zm7 1h4a1 1 0 001-1v-1h-5v2zm0-4h5V8h-5v2zM9 8H4v2h5V8z" />
                </svg>
              </ToolbarButton>

              {showTableDialog && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-3 z-50 w-44">
                  <div className="text-[10px] font-semibold text-gray-700 mb-2">Insert Table</div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <label className="text-[9px] text-gray-500 w-8">Rows:</label>
                    <input type="number" min="1" max="30" value={tableDialogRows}
                      onChange={e => setTableDialogRows(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-14 px-1 py-0.5 text-[10px] border border-gray-300 rounded" />
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <label className="text-[9px] text-gray-500 w-8">Cols:</label>
                    <input type="number" min="1" max="15" value={tableDialogCols}
                      onChange={e => setTableDialogCols(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-14 px-1 py-0.5 text-[10px] border border-gray-300 rounded" />
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => { insertTable(tableDialogRows, tableDialogCols); setShowTableDialog(false); }}
                      className="flex-1 px-2 py-1 text-[10px] font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                    >Insert</button>
                    <button
                      onClick={() => setShowTableDialog(false)}
                      className="px-2 py-1 text-[10px] text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                    >Cancel</button>
                  </div>
                </div>
              )}
            </div>

            <ToolbarButton onClick={insertHorizontalLine} tooltip="Line">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" />
              </svg>
            </ToolbarButton>
          </ToolbarGroup>

          <ToolbarSeparator />

          {/* Margins */}
          <div className="relative">
            <ToolbarButton
              onClick={() => setShowMarginControls(!showMarginControls)}
              active={showMarginControls}
              tooltip="Margins"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2H4zm0 2h12v12H4V4z" clipRule="evenodd" />
              </svg>
            </ToolbarButton>

            {showMarginControls && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded shadow-lg p-2 z-50 w-48">
                <div className="text-[10px] font-semibold mb-1">Margins (cm)</div>

                <div className="grid grid-cols-2 gap-0.5 mb-2">
                  <button
                    onClick={() => applyMarginPreset('normal')}
                    className="px-1.5 py-0.5 text-[9px] bg-gray-100 hover:bg-gray-200 rounded"
                  >
                    Normal
                  </button>
                  <button
                    onClick={() => applyMarginPreset('narrow')}
                    className="px-1.5 py-0.5 text-[9px] bg-gray-100 hover:bg-gray-200 rounded"
                  >
                    Narrow
                  </button>
                </div>

                <div className="space-y-1">
                  {['top', 'bottom', 'left', 'right'].map(side => (
                    <div key={side} className="flex items-center justify-between gap-1">
                      <label className="text-[9px] capitalize w-10">{side}:</label>
                      <input
                        type="number"
                        min="0"
                        max="5"
                        step="0.1"
                        value={margins[side]}
                        onChange={(e) => updateMargin(side, e.target.value)}
                        className="w-14 px-1 py-0.5 text-[9px] border border-gray-300 rounded"
                      />
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => setShowMarginControls(false)}
                  className="mt-2 w-full px-1.5 py-0.5 text-[9px] bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Apply
                </button>
              </div>
            )}
          </div>

          {/* Line Spacing Dropdown */}
          <div className="relative">
            <ToolbarButton
              onClick={() => setShowLineSpacingMenu(!showLineSpacingMenu)}
              active={showLineSpacingMenu}
              tooltip={`Line Spacing (${lineSpacing})`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 6v12M20 6l-1.5 1.5M20 6l1.5 1.5M20 18l-1.5-1.5M20 18l1.5-1.5" />
              </svg>
            </ToolbarButton>
            {showLineSpacingMenu && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 w-36">
                <div className="px-2 py-1 text-[9px] font-semibold text-gray-400 uppercase">Line Spacing</div>
                {[
                  { value: '1', label: 'Single (1.0)' },
                  { value: '1.15', label: '1.15' },
                  { value: '1.4', label: '1.4' },
                  { value: '1.5', label: '1.5' },
                  { value: '1.8', label: '1.8' },
                  { value: '2', label: 'Double (2.0)' },
                  { value: '2.5', label: '2.5' },
                  { value: '3', label: 'Triple (3.0)' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { applyLineSpacing(opt.value); setShowLineSpacingMenu(false); }}
                    className={`w-full px-3 py-1 text-left text-[11px] hover:bg-blue-50 flex items-center justify-between ${lineSpacing === opt.value ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700'
                      }`}
                  >
                    <span>{opt.label}</span>
                    {lineSpacing === opt.value && (
                      <svg className="w-3 h-3 text-blue-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <ToolbarSeparator />

          {/* Zoom */}
          <ToolbarGroup>
            <button
              onClick={() => setZoomLevel(Math.max(50, zoomLevel - 10))}
              className="px-1 py-0.5 bg-white border border-gray-300 rounded hover:bg-gray-50 text-[10px]"
              title="Zoom Out"
            >
              −
            </button>
            <span className="text-[10px] font-medium min-w-[2rem] text-center px-1">{zoomLevel}%</span>
            <button
              onClick={() => setZoomLevel(Math.min(200, zoomLevel + 10))}
              className="px-1 py-0.5 bg-white border border-gray-300 rounded hover:bg-gray-50 text-[10px]"
              title="Zoom In"
            >
              +
            </button>
          </ToolbarGroup>

          <ToolbarSeparator />

          {/* View Toggle */}
          <div className="flex bg-gray-100 rounded p-0.5">
            <button
              onClick={() => setIsPreviewMode(false)}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${!isPreviewMode
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
                }`}
            >
              Edit
            </button>
            <button
              onClick={() => setIsPreviewMode(true)}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${isPreviewMode
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
                }`}
            >
              Preview
            </button>
          </div>
        </div>
      </div>

      {/* ✅ SPACER: Always maintains gap, even with sticky toolbar */}
      <div className="flex-shrink-0 h-4" style={{
        background: darkMode ? '#2d2d30' : '#e1e1e1'
      }}></div>

      {/* ✅ SCROLLABLE CONTENT: Only this scrolls, toolbar + spacer stay fixed */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden" style={{
        background: darkMode ? '#2d2d30' : '#e1e1e1',
      }}>
        <style key={`editor-styles-${lineSpacing}-${margins.top}-${margins.bottom}-${margins.left}-${margins.right}-${fontSize}-${fontFamily}-${containerWidth}`} dangerouslySetInnerHTML={{ __html: getDocumentStyles() }} />

        <div className="min-h-full py-4 px-2 flex justify-center">
          <div
            className="editor-wrapper"
            style={{
              transform: `scale(${zoomLevel / 100})`,
              transformOrigin: 'top center',
              transition: 'transform 0.2s ease'
            }}
          >
            {isPreviewMode ? (
              <div className="preview-container-wrapper">
                <div
                  className="multi-page-preview"
                  dangerouslySetInnerHTML={{ __html: paginatedContent || content }}
                />
              </div>
            ) : (
              <div
                ref={contentEditableRef}
                contentEditable
                className="report-editor ms-word-page"
                style={{
                  lineHeight: lineSpacing,
                  padding: `${margins.top}cm ${margins.right}cm ${margins.bottom}cm ${margins.left}cm`,
                  fontFamily: `${fontFamily}, sans-serif`,
                  fontSize: fontSize
                }}
                onInput={handleContentChange}
                onPaste={handlePaste}
                onMouseUp={(e) => {
                  saveSelection();
                  if (formatPainterActive) applyStoredFormat();
                }}
                onKeyUp={saveSelection}
                suppressContentEditableWarning={true}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );

  function getDocumentStyles() {
    // ✅ Calculate responsive page width based on container width prop
    let pageWidth = '21cm'; // Default A4 width

    // ✅ Scale down page width for narrow containers
    if (containerWidth <= 30) {
      pageWidth = '18cm';
    } else if (containerWidth <= 40) {
      pageWidth = '19cm';
    } else if (containerWidth <= 50) {
      pageWidth = '20cm';
    }

    return `
    /* MS Word Page Style - RESPONSIVE WIDTH */
    .ms-word-page {
      width: ${pageWidth};
      max-width: 100%;
      min-height: 29.7cm;
      margin: 0 auto 20px auto;
      background: white;
      box-shadow: 0 0 10px rgba(0,0,0,0.1);
      font-family: ${fontFamily}, sans-serif;
      font-size: ${fontSize};
      line-height: ${lineSpacing};
      color: #000;
      outline: none;
      box-sizing: border-box;
      position: relative;
      /* ✅ APPLY MARGINS */
      padding: ${margins.top}cm ${margins.right}cm ${margins.bottom}cm ${margins.left}cm;
    }

    .ms-word-page:focus {
      box-shadow: 0 0 10px rgba(0,0,0,0.15), 0 0 0 1px rgba(59, 130, 246, 0.3);
    }

    /* Editor wrapper for zoom */
    .editor-wrapper {
      display: inline-block;
      width: 100%;
      max-width: ${pageWidth};
    }

    /* Preview container */
    .preview-container-wrapper {
      width: 100%;
      max-width: ${pageWidth};
      margin: 0 auto;
    }

    .multi-page-preview {
      width: 100%;
      max-width: ${pageWidth};
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    /* Page styling for preview */
    .report-page, .report-page-preview {
      background: white;
      width: 100%;
      max-width: ${pageWidth};
      min-height: 29.7cm;
      /* ✅ APPLY MARGINS */
      padding: ${margins.top}cm ${margins.right}cm ${margins.bottom}cm ${margins.left}cm;
      margin: 0 auto 20px auto;
      box-shadow: 0 0 10px rgba(0,0,0,0.1);
      box-sizing: border-box;
      position: relative;
      page-break-after: always;
      display: block;
      font-family: ${fontFamily}, sans-serif;
      font-size: ${fontSize};
      line-height: ${lineSpacing};
      color: #000;
    }

    .report-page:hover, .report-page-preview:hover {
      box-shadow: 0 0 15px rgba(0,0,0,0.15);
    }

    .report-page:last-child, .report-page-preview:last-child {
      page-break-after: auto;
    }

    /* Patient info table - Enhanced */
    .page-header-table, .patient-info-table {
      width: 100%;
      border-collapse: collapse;
      margin: 1rem 0;
      font-size: 10pt;
      border: 1px solid #333;
    }

    .page-header-table td, .patient-info-table td {
      border: 1px solid #333;
      padding: 8px 10px;
      vertical-align: top;
    }

    .page-header-table td:nth-child(1),
    .page-header-table td:nth-child(3),
    .patient-info-table td:nth-child(1),
    .patient-info-table td:nth-child(3) {
      background: linear-gradient(135deg, #6EE4F5 0%, #5DD4E4 100%);
      font-weight: 600;
      width: 22%;
      color: #000;
    }

    .page-header-table td:nth-child(2),
    .page-header-table td:nth-child(4),
    .patient-info-table td:nth-child(2),
    .patient-info-table td:nth-child(4) {
      background-color: #fff;
      width: 28%;
    }

    /* Content area */
    .content-flow-area {
      margin: 1rem 0;
      padding: 0;
    }

    /* Signature section - Enhanced */
    .signature-section {
      margin-top: 2rem;
      padding-top: 1rem;
      border-top: 1px solid #ddd;
      font-size: 10pt;
      page-break-inside: avoid;
    }

    .doctor-name {
      font-weight: 700;
      margin-bottom: 6px;
      font-size: 12pt;
      color: #000;
    }

    .doctor-specialization,
    .doctor-license {
      margin: 4px 0;
      font-size: 10pt;
      color: #333;
    }

    .signature-image {
      width: 100px;
      height: 50px;
      margin: 10px 0;
      object-fit: contain;
    }

    /* Typography */
    p { 
      margin: 8px 0; 
      font-size: inherit;
      line-height: inherit;
    }
  
    h1, h2, h3 { 
      font-weight: 700; 
      text-decoration: underline; 
      margin: 16px 0 8px 0; 
      page-break-after: avoid;
    }
    h1 { font-size: 16pt; }
    h2 { font-size: 14pt; }
    h3 { font-size: 12pt; }
  
    ul, ol {
      padding-left: 32px;
      margin: 8px 0;
    }
    ul {
      list-style-type: disc !important;
    }
    ol {
      list-style-type: decimal !important;
    }
    ul ul { list-style-type: circle !important; }
    ul ul ul { list-style-type: square !important; }
    li {
      margin: 4px 0;
      display: list-item !important;
    }
    strong, b { font-weight: 700 !important; }
    em, i { font-style: italic !important; }
    u { text-decoration: underline !important; }

    /* Tables in content */
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 10px 0;
    }

    td, th {
      border: 1px solid #ddd;
      padding: 8px;
      text-align: left;
    }

    th {
      background-color: #f2f2f2;
      font-weight: 600;
    }

    /* Page break indicator */
    div[style*="page-break-after: always"] {
      height: 0;
      margin: 20px 0;
      border-top: 2px dashed #999;
      position: relative;
    }

    div[style*="page-break-after: always"]:after {
      content: "--- Page Break ---";
      position: absolute;
      top: -10px;
      left: 50%;
      transform: translateX(-50%);
      background: white;
      color: #999;
      font-size: 9pt;
      padding: 0 10px;
    }

    /* Scrollbar styling */
    ::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }

    ::-webkit-scrollbar-track {
      background: #f1f1f1;
    }

    ::-webkit-scrollbar-thumb {
      background: #888;
      border-radius: 4px;
    }

    ::-webkit-scrollbar-thumb:hover {
      background: #555;
    }
`;
  }
});

export default ReportEditor;