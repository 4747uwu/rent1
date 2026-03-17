import React from 'react';
import { useState, useRef, useEffect, useCallback } from 'react';

const ReportEditor = ({ content, onChange }) => {
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [paginatedContent, setPaginatedContent] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fontSize, setFontSize] = useState('11pt');
  const [fontFamily, setFontFamily] = useState('Arial');
  const [showWordCount, setShowWordCount] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [darkMode, setDarkMode] = useState(false);
  const [lineSpacing, setLineSpacing] = useState('1.4');
  const [showRuler, setShowRuler] = useState(true);
  const [activeTools, setActiveTools] = useState({
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
    subscript: false,
    superscript: false
  });
  const contentEditableRef = useRef(null);
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

  // Update active tool states
  const updateToolStates = () => {
    setActiveTools({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      strikethrough: document.queryCommandState('strikeThrough'),
      subscript: document.queryCommandState('subscript'),
      superscript: document.queryCommandState('superscript')
    });
  };

  // Enhanced command wrapper
  const applyCommand = (command, value = null) => {
    document.execCommand(command, false, value);
    contentEditableRef.current?.focus();
    updateToolStates();
  };

  // Enhanced style application
  const applyStyle = (style, value) => {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const span = document.createElement('span');
      span.style[style] = value;
      range.surroundContents(span);
    }
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

  const ToolbarButton = ({ onClick, active, children, tooltip, className = "", disabled = false }) => (
    <button
      onClick={onClick}
      title={tooltip}
      disabled={disabled}
      className={`
        flex items-center justify-center px-2.5 py-1.5 rounded text-sm font-medium
        transition-all duration-150
        ${active 
          ? 'bg-blue-100 text-blue-700 border border-blue-300' 
          : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-sm'}
        ${className}
      `}
    >
      {children}
    </button>
  );

  const ToolbarSeparator = () => (
    <div className="w-px h-6 bg-gray-300 mx-1"></div>
  );

  const ToolbarGroup = ({ children, label }) => (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-0.5 bg-gray-50 rounded p-1">
        {children}
      </div>
      {label && <span className="text-[9px] text-gray-500 mt-0.5">{label}</span>}
    </div>
  );

  return (
    <div className={`flex flex-col h-screen transition-all duration-300 ${
      darkMode ? 'bg-gray-900' : 'bg-gray-100'
    } ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      
      {/* MS Word-like Title Bar */}
      <div className={`flex-shrink-0 border-b ${
        darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}>
        <div className="flex items-center justify-between px-4 py-1.5">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-gradient-to-br from-blue-600 to-blue-700 rounded flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.414A2 2 0 0016.414 5L14 2.586A2 2 0 0012.586 2H9z" />
                </svg>
              </div>
              <span className="font-semibold text-sm">Medical Report Editor</span>
            </div>
            <span className="text-xs text-gray-500">- Untitled Document</span>
          </div>
          
          <div className="flex items-center gap-2">
            <button className="px-3 py-1 text-xs hover:bg-gray-100 rounded">File</button>
            <button className="px-3 py-1 text-xs hover:bg-gray-100 rounded">Edit</button>
            <button className="px-3 py-1 text-xs hover:bg-gray-100 rounded">View</button>
            <button className="px-3 py-1 text-xs hover:bg-gray-100 rounded">Insert</button>
            <button className="px-3 py-1 text-xs hover:bg-gray-100 rounded">Format</button>
            <button className="px-3 py-1 text-xs hover:bg-gray-100 rounded">Help</button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 hover:bg-gray-100 rounded"
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isFullscreen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Main Toolbar - MS Word Style */}
      <div className={`flex-shrink-0 border-b shadow-sm ${
        darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}>
        
        {/* Quick Access Toolbar */}
        <div className="flex items-center justify-between px-4 py-1.5 border-b border-gray-200">
          <div className="flex items-center gap-1">
            <button className="p-1 hover:bg-gray-100 rounded" title="Save (Ctrl+S)">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
            </button>
            <button className="p-1 hover:bg-gray-100 rounded" title="Undo (Ctrl+Z)">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
            </button>
            <button className="p-1 hover:bg-gray-100 rounded" title="Redo (Ctrl+Y)">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 10h-10a8 8 0 00-8 8v2m18-10l-6-6m6 6l-6 6" />
              </svg>
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setIsPreviewMode(false)}
              className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                !isPreviewMode 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Edit
            </button>
            <button
              onClick={() => setIsPreviewMode(true)}
              className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                isPreviewMode 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Preview
            </button>
          </div>
        </div>

        {/* Main Formatting Toolbar */}
        <div className="px-4 py-2 flex flex-wrap items-center gap-2">
          
          {/* Font Group */}
          <ToolbarGroup label="Font">
            <select
              value={fontFamily}
              onChange={(e) => {
                setFontFamily(e.target.value);
                applyStyle('fontFamily', e.target.value);
              }}
              className="px-2 py-1 bg-white border border-gray-300 rounded text-xs hover:border-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="Arial">Arial</option>
              <option value="Times New Roman">Times New Roman</option>
              <option value="Courier New">Courier New</option>
              <option value="Verdana">Verdana</option>
              <option value="Georgia">Georgia</option>
              <option value="Calibri">Calibri</option>
              <option value="Cambria">Cambria</option>
              <option value="Helvetica">Helvetica</option>
            </select>

            <select
              value={fontSize}
              onChange={(e) => {
                setFontSize(e.target.value);
                applyStyle('fontSize', e.target.value);
              }}
              className="px-2 py-1 bg-white border border-gray-300 rounded text-xs hover:border-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 w-16"
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
              <option value="24pt">24</option>
              <option value="28pt">28</option>
              <option value="36pt">36</option>
            </select>
          </ToolbarGroup>

          <ToolbarSeparator />

          {/* Text Formatting Group */}
          <ToolbarGroup label="Format">
            <ToolbarButton 
              onClick={() => applyCommand('bold')} 
              active={activeTools.bold}
              tooltip="Bold (Ctrl+B)"
            >
              <svg className="w-4 h-4 font-bold" fill="currentColor" viewBox="0 0 20 20">
                <path d="M3 5a1 1 0 011-1h5a3 3 0 110 6H4v3h6a3 3 0 110 6H4a1 1 0 01-1-1V5zm3 1v4h3a1 1 0 100-2H6zm0 6v4h4a1 1 0 100-2H6z"/>
              </svg>
            </ToolbarButton>

            <ToolbarButton 
              onClick={() => applyCommand('italic')} 
              active={activeTools.italic}
              tooltip="Italic (Ctrl+I)"
            >
              <svg className="w-4 h-4 italic" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 3a1 1 0 011 1v5h3a1 1 0 110 2h-3v5a1 1 0 11-2 0v-5H6a1 1 0 110-2h3V4a1 1 0 011-1z"/>
              </svg>
            </ToolbarButton>

            <ToolbarButton 
              onClick={() => applyCommand('underline')} 
              active={activeTools.underline}
              tooltip="Underline (Ctrl+U)"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M4 2a1 1 0 011 1v8a5 5 0 1010 0V3a1 1 0 112 0v8a7 7 0 11-14 0V3a1 1 0 011-1zm2 14a1 1 0 100 2h8a1 1 0 100-2H6z"/>
              </svg>
            </ToolbarButton>

            <ToolbarButton 
              onClick={() => applyCommand('strikeThrough')} 
              active={activeTools.strikethrough}
              tooltip="Strikethrough"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M3 10h14M7 6h6M7 14h6"/>
              </svg>
            </ToolbarButton>

            <div className="relative">
              <label className="flex items-center justify-center px-2 py-1 bg-white border border-gray-200 rounded hover:bg-gray-50 cursor-pointer">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M4 2a2 2 0 00-2 2v11a3 3 0 106 0V4a2 2 0 00-2-2H4z"/>
                </svg>
                <input 
                  type="color" 
                  onChange={(e) => applyCommand('foreColor', e.target.value)} 
                  className="absolute inset-0 opacity-0 cursor-pointer" 
                  title="Text Color"
                />
              </label>
            </div>

            <div className="relative">
              <label className="flex items-center justify-center px-2 py-1 bg-white border border-gray-200 rounded hover:bg-gray-50 cursor-pointer">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M3 3h14a1 1 0 011 1v12a1 1 0 01-1 1H3a1 1 0 01-1-1V4a1 1 0 011-1z"/>
                </svg>
                <input 
                  type="color" 
                  onChange={(e) => applyCommand('backColor', e.target.value)} 
                  className="absolute inset-0 opacity-0 cursor-pointer" 
                  title="Highlight Color"
                />
              </label>
            </div>
          </ToolbarGroup>

          <ToolbarSeparator />

          {/* Alignment Group */}
          <ToolbarGroup label="Paragraph">
            <ToolbarButton onClick={() => applyCommand('justifyLeft')} tooltip="Align Left">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h6a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h6a1 1 0 110 2H4a1 1 0 01-1-1z"/>
              </svg>
            </ToolbarButton>

            <ToolbarButton onClick={() => applyCommand('justifyCenter')} tooltip="Center">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3 4a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm0 4a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm-3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"/>
              </svg>
            </ToolbarButton>

            <ToolbarButton onClick={() => applyCommand('justifyRight')} tooltip="Align Right">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M17 4a1 1 0 01-1 1H4a1 1 0 110-2h12a1 1 0 011 1zm0 4a1 1 0 01-1 1h-6a1 1 0 110-2h6a1 1 0 011 1zm0 4a1 1 0 01-1 1H4a1 1 0 110-2h12a1 1 0 011 1zm0 4a1 1 0 01-1 1h-6a1 1 0 110-2h6a1 1 0 011 1z"/>
              </svg>
            </ToolbarButton>

            <ToolbarButton onClick={() => applyCommand('justifyFull')} tooltip="Justify">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"/>
              </svg>
            </ToolbarButton>
          </ToolbarGroup>

          <ToolbarSeparator />

          {/* Lists Group */}
          <ToolbarGroup label="Lists">
            <ToolbarButton onClick={() => applyCommand('insertUnorderedList')} tooltip="Bullet List">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M6 4a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm0 4a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm0 4a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zM3 7a1 1 0 100-2 1 1 0 000 2zm0 4a1 1 0 100-2 1 1 0 000 2z"/>
              </svg>
            </ToolbarButton>

            <ToolbarButton onClick={() => applyCommand('insertOrderedList')} tooltip="Numbered List">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 4a1 1 0 01.707-.293l2 2a1 1 0 11-1.414 1.414L3 5.414V4zm0 4a1 1 0 01.707-.293l2 2a1 1 0 11-1.414 1.414L3 9.414V8zm0 4a1 1 0 01.707-.293l2 2a1 1 0 11-1.414 1.414L3 13.414V12zM8 5a1 1 0 011-1h8a1 1 0 110 2H9a1 1 0 01-1-1zm0 4a1 1 0 011-1h8a1 1 0 110 2H9a1 1 0 01-1-1zm0 4a1 1 0 011-1h8a1 1 0 110 2H9a1 1 0 01-1-1z"/>
              </svg>
            </ToolbarButton>

            <ToolbarButton onClick={() => applyCommand('indent')} tooltip="Increase Indent">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"/>
              </svg>
            </ToolbarButton>

            <ToolbarButton onClick={() => applyCommand('outdent')} tooltip="Decrease Indent">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm6 4a1 1 0 011-1h6a1 1 0 110 2h-6a1 1 0 01-1-1zm0 4a1 1 0 011-1h6a1 1 0 110 2h-6a1 1 0 01-1-1zm-6 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"/>
              </svg>
            </ToolbarButton>
          </ToolbarGroup>

          <ToolbarSeparator />

          {/* Insert Group */}
          <ToolbarGroup label="Insert">
            <ToolbarButton onClick={() => insertTable(3, 3)} tooltip="Insert Table">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 4a3 3 0 00-3 3v6a3 3 0 003 3h10a3 3 0 003-3V7a3 3 0 00-3-3H5zm-1 9v-1h5v2H5a1 1 0 01-1-1zm7 1h4a1 1 0 001-1v-1h-5v2zm0-4h5V8h-5v2zM9 8H4v2h5V8z"/>
              </svg>
            </ToolbarButton>

            <ToolbarButton onClick={insertHorizontalLine} tooltip="Insert Horizontal Line">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"/>
              </svg>
            </ToolbarButton>

            <ToolbarButton onClick={insertPageBreak} tooltip="Insert Page Break">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M3 3h14a1 1 0 011 1v5H2V4a1 1 0 011-1zm0 14a1 1 0 01-1-1v-5h16v5a1 1 0 01-1 1H3z"/>
                <path fillRule="evenodd" d="M2 10h16v1H2v-1z" clipRule="evenodd"/>
              </svg>
            </ToolbarButton>

            <ToolbarButton onClick={() => applyCommand('insertImage')} tooltip="Insert Image">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"/>
              </svg>
            </ToolbarButton>
          </ToolbarGroup>

          <ToolbarSeparator />

          {/* View Tools */}
          <ToolbarGroup label="View">
            <ToolbarButton 
              onClick={() => setShowRuler(!showRuler)} 
              active={showRuler}
              tooltip="Toggle Ruler"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 6a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zm2 0v2h2V6H4zm3 0v2h2V6H7zm3 0v2h2V6h-2zm3 0v2h2V6h-2z"/>
              </svg>
            </ToolbarButton>

            <button
              onClick={() => setZoomLevel(Math.max(50, zoomLevel - 10))}
              className="px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 text-xs"
              title="Zoom Out"
            >
              −
            </button>
            <span className="text-xs font-medium min-w-[2.5rem] text-center bg-white border-t border-b border-gray-300 py-1">{zoomLevel}%</span>
            <button
              onClick={() => setZoomLevel(Math.min(200, zoomLevel + 10))}
              className="px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 text-xs"
              title="Zoom In"
            >
              +
            </button>

            <ToolbarButton 
              onClick={() => setShowWordCount(!showWordCount)} 
              active={showWordCount}
              tooltip="Word Count"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
                <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z"/>
              </svg>
            </ToolbarButton>

            <ToolbarButton 
              onClick={() => setShowFindReplace(!showFindReplace)} 
              active={showFindReplace}
              tooltip="Find & Replace (Ctrl+F)"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"/>
              </svg>
            </ToolbarButton>
          </ToolbarGroup>
        </div>

        {/* Ruler */}
        {showRuler && !isPreviewMode && (
          <div className="h-6 bg-gradient-to-b from-gray-50 to-gray-100 border-t border-b border-gray-300 relative overflow-hidden">
            <div className="absolute inset-0 flex items-end px-4" style={{ width: '21cm', margin: '0 auto' }}>
              {[...Array(21)].map((_, i) => (
                <div key={i} className="flex-1 border-l border-gray-400 h-3 relative">
                  {i % 5 === 0 && (
                    <span className="absolute -top-3 -left-1 text-[9px] text-gray-600">{i}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Find & Replace Panel */}
        {showFindReplace && (
          <div className="px-4 py-2 bg-yellow-50 border-t border-yellow-200 flex items-center gap-2">
            <input
              type="text"
              placeholder="Find..."
              value={findText}
              onChange={(e) => setFindText(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <input
              type="text"
              placeholder="Replace with..."
              value={replaceText}
              onChange={(e) => setReplaceText(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              onClick={handleFind}
              className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
            >
              Find
            </button>
            <button
              onClick={handleReplace}
              className="px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700"
            >
              Replace All
            </button>
            <button
              onClick={() => setShowFindReplace(false)}
              className="ml-auto p-1 hover:bg-yellow-100 rounded"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/>
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Status Bar - MS Word Style */}
      {(showWordCount || isPreviewMode) && (
        <div className={`flex-shrink-0 px-4 py-1.5 border-b text-xs flex items-center justify-between ${
          darkMode ? 'bg-gray-800 border-gray-700 text-gray-300' : 'bg-white border-gray-200 text-gray-600'
        }`}>
          <div className="flex items-center gap-4">
            {showWordCount && (
              <>
                <span>Page {getPageCount()}</span>
                <span>Words: {getWordCount().words}</span>
                <span>Characters (no spaces): {getWordCount().charactersNoSpaces}</span>
                <span>Characters (with spaces): {getWordCount().characters}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>Language: English (US)</span>
          </div>
        </div>
      )}

      {/* Editor Container - MS Word Style */}
      <div className="flex-1 overflow-auto" style={{ 
        background: darkMode ? '#2d2d30' : '#e1e1e1',
      }}>
        <style dangerouslySetInnerHTML={{ __html: documentStyles }} />
        
        <div className="min-h-full py-8 px-4 flex justify-center">
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
                }}
                onInput={handleContentChange}
                onMouseUp={updateToolStates}
                onKeyUp={updateToolStates}
                suppressContentEditableWarning={true}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Enhanced MS Word-like styles
const documentStyles = `
  /* MS Word Page Style */
  .ms-word-page {
    width: 21cm;
    min-height: 29.7cm;
    padding: 2.54cm 2.54cm 2.54cm 2.54cm; /* Standard 1 inch margins */
    margin: 0 auto 20px auto;
    background: white;
    box-shadow: 0 0 10px rgba(0,0,0,0.1);
    font-family: Arial, sans-serif;
    font-size: 11pt;
    color: #000;
    outline: none;
    box-sizing: border-box;
    position: relative;
  }

  .ms-word-page:focus {
    box-shadow: 0 0 10px rgba(0,0,0,0.15), 0 0 0 1px rgba(59, 130, 246, 0.3);
  }

  /* Editor wrapper for zoom */
  .editor-wrapper {
    display: inline-block;
    min-width: 21cm;
  }

  /* Preview container */
  .preview-container-wrapper {
    width: 21cm;
    margin: 0 auto;
  }

  .multi-page-preview {
    width: 21cm;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  /* Page styling for preview */
  .report-page, .report-page-preview {
    background: white;
    width: 21cm;
    min-height: 29.7cm;
    padding: 2.54cm;
    margin: 0 auto 20px auto;
    box-shadow: 0 0 10px rgba(0,0,0,0.1);
    box-sizing: border-box;
    position: relative;
    page-break-after: always;
    display: block;
    font-family: Arial, sans-serif;
    font-size: 11pt;
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
    font-size: 11pt;
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
  strong { font-weight: 700; }
  em { font-style: italic; }
  u { text-decoration: underline; }

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

  /* Page numbering */
  .report-page::after, .report-page-preview::after {
    content: "Page " attr(data-page);
    position: absolute;
    bottom: 1.5cm;
    right: 2.5cm;
    font-size: 10pt;
    color: #666;
  }

  /* Print styles */
  @media print {
    .ms-word-page,
    .report-page, 
    .report-page-preview { 
      margin: 0; 
      box-shadow: none; 
      page-break-after: always;
    }
    
    .report-page:last-child, 
    .report-page-preview:last-child { 
      page-break-after: auto; 
    }
    
    div[style*="page-break-after: always"] {
      page-break-after: always;
      border: none;
      height: 0;
      margin: 0;
    }
    
    div[style*="page-break-after: always"]:after {
      display: none;
    }
  }

  /* Scrollbar styling */
  ::-webkit-scrollbar {
    width: 12px;
    height: 12px;
  }

  ::-webkit-scrollbar-track {
    background: #f1f1f1;
  }

  ::-webkit-scrollbar-thumb {
    background: #888;
    border-radius: 6px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: #555;
  }
`;

export default ReportEditor;