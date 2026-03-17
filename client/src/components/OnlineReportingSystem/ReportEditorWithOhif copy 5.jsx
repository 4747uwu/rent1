import React from 'react';
import { useState, useRef, useEffect, useCallback, useImperativeHandle } from 'react';

const ReportEditor = React.forwardRef(({ content, onChange, containerWidth = 100, isOpen = true }, ref) =>{
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [paginatedContent, setPaginatedContent] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fontSize, setFontSize] = useState('11pt');
  const [fontFamily, setFontFamily] = useState('Arial');
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
        } catch {}
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

  // ✅ FIXED: Enhanced command wrapper with proper focus restoration
  const applyCommand = (command, value = null) => {
    // Save selection before executing command
    const selection = window.getSelection();
    const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    
    document.execCommand(command, false, value);
    
    // Restore focus and selection
    if (contentEditableRef.current) {
      contentEditableRef.current.focus();
      if (range) {
        try {
          selection.removeAllRanges();
          selection.addRange(range);
        } catch (e) {
          // Ignore errors
        }
      }
    }
    
    // Update button states
    setTimeout(updateToolStates, 10);
  };

  // ✅ FIXED: Properly working font size change
  const applyFontSize = (size) => {
    setFontSize(size);
    
    const selection = window.getSelection();
    if (!selection.rangeCount) {
      contentEditableRef.current?.focus();
      return;
    }

    const range = selection.getRangeAt(0);
    
    // ✅ If text is selected, wrap it in a span with the font size
    if (!range.collapsed) {
      try {
        const span = document.createElement('span');
        span.style.fontSize = size;
        
        // Extract the selected content
        const fragment = range.extractContents();
        span.appendChild(fragment);
        
        // Insert the styled span
        range.insertNode(span);
        
        // Restore selection
        selection.removeAllRanges();
        const newRange = document.createRange();
        newRange.selectNodeContents(span);
        selection.addRange(newRange);
        
      } catch (e) {
        console.error('Error applying font size:', e);
        // Fallback to execCommand
        document.execCommand('fontSize', false, '7');
        const fontElements = contentEditableRef.current.querySelectorAll('font[size="7"]');
        fontElements.forEach(el => {
          const span = document.createElement('span');
          span.style.fontSize = size;
          span.innerHTML = el.innerHTML;
          el.parentNode.replaceChild(span, el);
        });
      }
    }
    
    contentEditableRef.current?.focus();
    
    // Trigger content change
    setTimeout(() => {
      if (contentEditableRef.current) {
        onChange(contentEditableRef.current.innerHTML);
      }
    }, 10);
  };

  // ✅ FIXED: Enhanced font family application
  const applyFontFamily = (family) => {
    setFontFamily(family);
    document.execCommand('fontName', false, family);
    contentEditableRef.current?.focus();
  };

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
        switch(e.key.toLowerCase()) {
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

  // ✅ SUPER COMPACT: Tiny toolbar button
  const ToolbarButton = ({ onClick, active, children, tooltip, className = "", disabled = false }) => (
    <button
      onClick={onClick}
      title={tooltip}
      disabled={disabled}
      className={`
        flex items-center justify-center px-1.5 py-0.5 rounded text-[11px] font-medium
        transition-all duration-100
        ${active 
          ? 'bg-blue-100 text-blue-700 border border-blue-300' 
          : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
      `}
    >
      {children}
    </button>
  );

  const ToolbarSeparator = () => (
    <div className="w-px h-4 bg-gray-300 mx-0.5"></div>
  );

  // ✅ SUPER COMPACT: No labels, smaller gaps
  const ToolbarGroup = ({ children }) => (
    <div className="flex items-center gap-0.5 bg-gray-50 rounded p-0.5">
      {children}
    </div>
  );

  return (
    <div className={`flex flex-col h-screen transition-all duration-300 ${
      darkMode ? 'bg-gray-900' : 'bg-gray-100'
    } ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      
      {/* ✅ TOOLBAR: Sticky at top with gap below */}
      <div className={`sticky top-0 z-40 border-b ${
        darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}>
        
        {/* Ultra compact toolbar */}
        <div className="px-2 py-1 flex flex-wrap items-center gap-1 text-[10px]">
          {/* Font Controls */}
          <select
            value={fontFamily}
            onChange={(e) => applyFontFamily(e.target.value)}
            className="px-1 py-0.5 bg-white border border-gray-300 rounded text-[10px] focus:ring-1 focus:ring-blue-400 focus:border-blue-400 w-20"
            title="Font"
          >
            <option value="Arial">Arial</option>
            <option value="Times New Roman">Times</option>
            <option value="Calibri">Calibri</option>
            <option value="Georgia">Georgia</option>
          </select>

          <select
            value={fontSize}
            onChange={(e) => applyFontSize(e.target.value)}
            className="px-1 py-0.5 bg-white border border-gray-300 rounded text-[10px] focus:ring-1 focus:ring-blue-400 focus:border-blue-400 w-12"
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

          {/* Format Buttons */}
          <ToolbarGroup>
            <ToolbarButton 
              onClick={() => applyCommand('bold')} 
              active={activeTools.bold}
              tooltip="Bold (Ctrl+B)"
            >
              <strong className="font-bold">B</strong>
            </ToolbarButton>

            <ToolbarButton 
              onClick={() => applyCommand('italic')} 
              active={activeTools.italic}
              tooltip="Italic (Ctrl+I)"
            >
              <em className="italic">I</em>
            </ToolbarButton>

            <ToolbarButton 
              onClick={() => applyCommand('underline')} 
              active={activeTools.underline}
              tooltip="Underline (Ctrl+U)"
            >
              <span className="underline">U</span>
            </ToolbarButton>
          </ToolbarGroup>

          <ToolbarSeparator />

          {/* Alignment */}
          <ToolbarGroup>
            <ToolbarButton onClick={() => applyCommand('justifyLeft')} tooltip="Left">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h6a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h6a1 1 0 110 2H4a1 1 0 01-1-1z"/>
              </svg>
            </ToolbarButton>

            <ToolbarButton onClick={() => applyCommand('justifyCenter')} tooltip="Center">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3 4a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm0 4a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm-3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"/>
              </svg>
            </ToolbarButton>

            <ToolbarButton onClick={() => applyCommand('justifyRight')} tooltip="Right">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M17 4a1 1 0 01-1 1H4a1 1 0 110-2h12a1 1 0 011 1zm0 4a1 1 0 01-1 1h-6a1 1 0 110-2h6a1 1 0 011 1zm0 4a1 1 0 01-1 1H4a1 1 0 110-2h12a1 1 0 011 1zm0 4a1 1 0 01-1 1h-6a1 1 0 110-2h6a1 1 0 011 1z"/>
              </svg>
            </ToolbarButton>
          </ToolbarGroup>

          <ToolbarSeparator />

          {/* Lists */}
          <ToolbarGroup>
            <ToolbarButton onClick={() => applyCommand('insertUnorderedList')} tooltip="Bullets">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M6 4a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm0 4a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm0 4a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zM3 7a1 1 0 100-2 1 1 0 000 2zm0 4a1 1 0 100-2 1 1 0 000 2z"/>
              </svg>
            </ToolbarButton>

            <ToolbarButton onClick={() => applyCommand('insertOrderedList')} tooltip="Numbering">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 4a1 1 0 01.707-.293l2 2a1 1 0 11-1.414 1.414L3 5.414V4zm0 4a1 1 0 01.707-.293l2 2a1 1 0 11-1.414 1.414L3 9.414V8zM8 5a1 1 0 011-1h8a1 1 0 110 2H9a1 1 0 01-1-1zm0 4a1 1 0 011-1h8a1 1 0 110 2H9a1 1 0 01-1-1z"/>
              </svg>
            </ToolbarButton>
          </ToolbarGroup>

          <ToolbarSeparator />

          {/* Insert */}
          <ToolbarGroup>
            <ToolbarButton onClick={() => insertTable(2, 2)} tooltip="Table">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 4a3 3 0 00-3 3v6a3 3 0 003 3h10a3 3 0 003-3V7a3 3 0 00-3-3H5zm-1 9v-1h5v2H5a1 1 0 01-1-1zm7 1h4a1 1 0 001-1v-1h-5v2zm0-4h5V8h-5v2zM9 8H4v2h5V8z"/>
              </svg>
            </ToolbarButton>

            <ToolbarButton onClick={insertHorizontalLine} tooltip="Line">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"/>
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
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2H4zm0 2h12v12H4V4z" clipRule="evenodd"/>
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

          {/* Line Spacing */}
          <select
            value={lineSpacing}
            onChange={(e) => setLineSpacing(e.target.value)}
            className="px-1 py-0.5 bg-white border border-gray-300 rounded text-[10px] focus:ring-1 focus:ring-blue-400 w-12"
            title="Line Spacing"
          >
            <option value="1">1.0</option>
            <option value="1.15">1.15</option>
            <option value="1.5">1.5</option>
            <option value="2">2.0</option>
          </select>

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
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                !isPreviewMode 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Edit
            </button>
            <button
              onClick={() => setIsPreviewMode(true)}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                isPreviewMode 
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
        <style dangerouslySetInnerHTML={{ __html: getDocumentStyles() }} />
        
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
                onInput={handleContentChange}
                onMouseUp={saveSelection}
                onKeyUp={saveSelection}
                // onBlur={saveSelection}
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
      padding-left: 24px; 
      margin: 8px 0; 
    }
    li { 
      margin: 4px 0; 
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