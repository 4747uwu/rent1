import React from 'react';
import { useState, useRef, useEffect, useImperativeHandle, useMemo } from 'react';
import { useEditor, EditorContent, Extension } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { TextStyle, FontFamily, FontSize, Color } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Subscript as SubIcon, Superscript as SupIcon,
  Undo2, Redo2, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Minus, TableIcon, Type, Baseline, Paintbrush, Highlighter,
  ZoomIn, ZoomOut, Eye, Edit3, Columns, PanelLeft,
} from 'lucide-react';

// ── Custom block-level LineHeight extension ──────────────────────────────────
// TipTap's built-in LineHeight applies to inline <span> (textStyle mark) which
// doesn't affect paragraph spacing. This extension applies line-height as a
// block-level attribute on paragraph/heading nodes.
const BlockLineHeight = Extension.create({
  name: 'blockLineHeight',
  addOptions() {
    return { types: ['paragraph', 'heading'] };
  },
  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        lineHeight: {
          default: null,
          parseHTML: (el) => el.style.lineHeight || null,
          renderHTML: (attrs) => {
            if (!attrs.lineHeight) return {};
            return { style: `line-height: ${attrs.lineHeight}` };
          },
        },
      },
    }];
  },
  addCommands() {
    return {
      setBlockLineHeight: (lineHeight) => ({ commands }) => {
        return this.options.types.every((type) =>
          commands.updateAttributes(type, { lineHeight })
        );
      },
      unsetBlockLineHeight: () => ({ commands }) => {
        return this.options.types.every((type) =>
          commands.resetAttributes(type, 'lineHeight')
        );
      },
    };
  },
});

// ── Editor defaults ──────────────────────────────────────────────────────────
const EDITOR_DEFAULTS = {
  fontSize: '11pt',
  fontFamily: 'Comic Sans MS',
  lineSpacing: '1.4',
};

// ── Bullet-character hierarchy for multi-level list detection ────────────────
// Level 0 = top-level (•, ●, ·)
// Level 1 = sub-level (○, ◦)
// Level 2 = sub-sub-level (▪, ▫, ■, □)
// Content pasted from Word uses different chars at each indent depth;
// we use that to rebuild nesting when margin/indent info has been stripped.
const BULLET_LEVELS = {
  '·': 0, '•': 0, '●': 0, '\u2022': 0,
  '◦': 1, '○': 1, '\u25CB': 1, '\u25E6': 1,
  '▪': 2, '▫': 2, '■': 2, '□': 2,
  '\u25A0': 2, '\u25A1': 2, '\u25AA': 2, '\u25AB': 2,
  '\u25CF': 0, '\u25CE': 0,
  '▸': 0, '▹': 0, '►': 0,
  // Word's "Wingdings bullet" paragraphs often come through as § (section
  // sign) or Ø after font conversion — treat them as sub-level bullets.
  // The logs showed § being used for OPINION sub-bullets in medical reports.
  '§': 1, '\u00A7': 1,
  'Ø': 1, '\u00D8': 1,
};
const BULLET_CHARS = Object.keys(BULLET_LEVELS).join('');
const BULLET_LEAD_RE = new RegExp(`^[\\s\\u00a0]*([${BULLET_CHARS}])[\\s\\u00a0\\t]*`);
const BULLET_TEST_RE = new RegExp(`^[${BULLET_CHARS}]`);

// ── Convert Word/Office "fake bullets" into real <ul><li> lists ──────────────
// Top-level helper (not inside component) so it can run on initial editor
// content as well as on content sync — fixes the "only works after HTML
// toggle" timing bug where TipTap's init fired onUpdate before the sync
// effect could apply the conversion.
const convertFakeBullets = (html) => {
  if (!html) return html;
  const doc = new DOMParser().parseFromString(html, 'text/html');

  // Step 1: Split <br>-separated bullet lines inside <p>/<div> into siblings
  const splitBrSeparatedBullets = (container) => {
    const blocks = Array.from(container.querySelectorAll('p, div'));
    blocks.forEach((block) => {
      const brs = block.querySelectorAll(':scope > br');
      if (brs.length === 0) return;
      const text = (block.textContent || '').replace(/\u00a0/g, ' ').trimStart();
      if (!BULLET_TEST_RE.test(text)) {
        const segments = block.innerHTML.split(/<br\s*\/?>/i);
        const anyBullet = segments.some((seg) => {
          const tmp = doc.createElement('div');
          tmp.innerHTML = seg;
          const t = (tmp.textContent || '').replace(/\u00a0/g, ' ').trimStart();
          return BULLET_TEST_RE.test(t);
        });
        if (!anyBullet) return;
      }
      const segments = block.innerHTML.split(/<br\s*\/?>/i);
      const tag = block.tagName.toLowerCase();
      const newBlocks = segments
        .map((seg) => seg.trim())
        .filter((seg) => seg.length > 0)
        .map((seg) => {
          const el = doc.createElement(tag);
          el.innerHTML = seg;
          return el;
        });
      if (newBlocks.length > 0) {
        newBlocks.forEach((nb) => block.parentNode.insertBefore(nb, block));
        block.remove();
      }
    });
  };

  // Get the first bullet character + its level for a block, or null if not a bullet
  const getBulletInfo = (el) => {
    if (!el) return null;
    if (el.tagName !== 'P' && el.tagName !== 'DIV') return null;
    const text = (el.textContent || '').replace(/\u00a0/g, ' ').trimStart();
    if (!text) return null;
    const ch = text[0];
    if (!(ch in BULLET_LEVELS)) return null;
    return { char: ch, level: BULLET_LEVELS[ch] };
  };

  // Strip leading bullet from first non-whitespace text node and build <li>
  const blockToLi = (el) => {
    const li = doc.createElement('li');
    const walker = doc.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const val = node.nodeValue || '';
      if (/\S/.test(val)) {
        node.nodeValue = val.replace(BULLET_LEAD_RE, '');
        break;
      }
      node = walker.nextNode();
    }
    while (el.firstChild) li.appendChild(el.firstChild);
    return li;
  };

  // Walk container children; group consecutive bullet blocks into nested <ul>
  // based on their level (using a stack of open <ul> elements).
  const processContainer = (container) => {
    const children = Array.from(container.children);
    let i = 0;
    while (i < children.length) {
      const el = children[i];
      const info = getBulletInfo(el);
      if (info) {
        // Start a bullet run. Use a stack keyed by level.
        const rootUl = doc.createElement('ul');
        container.insertBefore(rootUl, el);
        // Stack entries: { level, ul, lastLi }
        const stack = [{ level: info.level, ul: rootUl, lastLi: null }];

        while (i < children.length) {
          const cur = children[i];
          const curInfo = getBulletInfo(cur);
          if (!curInfo) break;

          const li = blockToLi(cur);

          // Pop deeper levels off the stack until the top is <= curInfo.level
          while (stack.length > 1 && stack[stack.length - 1].level > curInfo.level) {
            stack.pop();
          }

          const top = stack[stack.length - 1];
          if (curInfo.level === top.level) {
            // Same level: append to current ul
            top.ul.appendChild(li);
            top.lastLi = li;
          } else if (curInfo.level > top.level) {
            // Deeper level: create nested ul inside the last li of the parent
            const parentLi = top.lastLi || (() => {
              // No previous li at this level; create an empty wrapper li
              const wrapper = doc.createElement('li');
              top.ul.appendChild(wrapper);
              top.lastLi = wrapper;
              return wrapper;
            })();
            const nestedUl = doc.createElement('ul');
            parentLi.appendChild(nestedUl);
            nestedUl.appendChild(li);
            stack.push({ level: curInfo.level, ul: nestedUl, lastLi: li });
          } else {
            // Shallower than anything on stack (shouldn't happen after pop loop)
            top.ul.appendChild(li);
            top.lastLi = li;
          }

          cur.remove();
          i++;
        }
      } else {
        if (el && ['DIV', 'TD', 'TH', 'BLOCKQUOTE', 'SECTION', 'ARTICLE'].includes(el.tagName)) {
          processContainer(el);
        }
        i++;
      }
    }
  };

  splitBrSeparatedBullets(doc.body);
  processContainer(doc.body);
  return doc.body.innerHTML;
};

// ── Strip background colors and run bullet conversion in one pass ─────────────
// EXPORTED so parent components (e.g. Templates.jsx) can pre-process content
// before passing it to ReportEditor, guaranteeing the conversion happens
// regardless of TipTap's internal init timing.
export const preprocessContent = (html) => {
  if (!html) return html;
  const noBg = html.replace(/\s*(background(?:-color)?)\s*:\s*[^;"]+(;?)/gi, '');
  return convertFakeBullets(noBg);
};

// ── Main component ───────────────────────────────────────────────────────────
const ReportEditor = React.forwardRef(({ content, onChange, containerWidth = 100, isOpen = true }, ref) => {
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fontSize, setFontSize] = useState(EDITOR_DEFAULTS.fontSize);
  const [fontFamily, setFontFamily] = useState(EDITOR_DEFAULTS.fontFamily);
  const [lineSpacing, setLineSpacing] = useState(EDITOR_DEFAULTS.lineSpacing);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [darkMode, setDarkMode] = useState(false);

  const [margins, setMargins] = useState({ top: 1.27, bottom: 1.27, left: 1.27, right: 1.27 });
  const [showMarginControls, setShowMarginControls] = useState(false);
  const [showTextColorPicker, setShowTextColorPicker] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const [showTableDialog, setShowTableDialog] = useState(false);
  const [tableDialogRows, setTableDialogRows] = useState(3);
  const [tableDialogCols, setTableDialogCols] = useState(3);
  const [showLineSpacingMenu, setShowLineSpacingMenu] = useState(false);

  const isInternalUpdate = useRef(false);
  // Tracks whether we've pushed the processed initial content into the editor.
  // Needed because TipTap's useEditor initializes the editor asynchronously
  // via an internal effect — by the time `editor` is non-null, the content
  // option may have already been applied without our bullet conversion.
  const hasInitializedContent = useRef(false);

  // ── TipTap editor ──────────────────────────────────────────────────────────
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      TextStyle,
      FontFamily.configure({ types: ['textStyle'] }),
      FontSize.configure({ types: ['textStyle'] }),
      Color.configure({ types: ['textStyle'] }),
      BlockLineHeight.configure({ types: ['paragraph', 'heading'] }),
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Table.configure({ resizable: true }),
      TableRow, TableCell, TableHeader,
      Subscript, Superscript,
    ],
    content: preprocessContent(content || ''),
    editorProps: {
      attributes: {
        class: 'report-editor ms-word-page',
        style: [
          `line-height: ${EDITOR_DEFAULTS.lineSpacing}`,
          `font-family: ${EDITOR_DEFAULTS.fontFamily}, sans-serif`,
          `font-size: ${EDITOR_DEFAULTS.fontSize}`,
          `padding: ${margins.top}cm ${margins.right}cm ${margins.bottom}cm ${margins.left}cm`,
        ].join('; '),
      },
      transformPastedHTML(html) {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const body = doc.body;
        if (!body) return html;
        body.querySelectorAll('o\\:p, style, meta, link, script, title, xml').forEach(el => el.remove());
        body.innerHTML = body.innerHTML.replace(/<!--[\s\S]*?-->/g, '');
        const ALLOWED = new Set(['text-align', 'font-weight', 'font-style', 'text-decoration']);
        body.querySelectorAll('*').forEach(el => {
          el.removeAttribute('class'); el.removeAttribute('id');
          el.removeAttribute('lang'); el.removeAttribute('dir'); el.removeAttribute('align');
          const style = el.getAttribute('style');
          if (style) {
            const kept = style.split(';').map(s => s.trim()).filter(Boolean)
              .filter(decl => { const p = decl.split(':')[0]?.trim().toLowerCase(); return p && ALLOWED.has(p); })
              .join('; ');
            if (kept) el.setAttribute('style', kept); else el.removeAttribute('style');
          }
        });
        // ✅ Convert Word/Office fake bullets to real <ul><li> on paste —
        // so pasted content enters the editor pre-converted, before
        // onUpdate fires and blocks later sync attempts.
        return preprocessContent(body.innerHTML);
      },
    },
    onUpdate({ editor }) {
      isInternalUpdate.current = true;
      onChange(editor.getHTML());
    },
    onSelectionUpdate({ editor }) {
      const attrs = editor.getAttributes('textStyle');
      if (attrs.fontSize) setFontSize(attrs.fontSize);
      if (attrs.fontFamily) setFontFamily(attrs.fontFamily);
      const blockAttrs = editor.getAttributes('paragraph');
      if (blockAttrs.lineHeight) setLineSpacing(blockAttrs.lineHeight);
    },
  });

  // ── Sync content from parent ───────────────────────────────────────────────
  useEffect(() => {
    if (!editor) return;
    const cleaned = preprocessContent(content || '');
    const currentEditorHtml = editor.getHTML();

    // If the cleaned version has bullet lists that the current editor HTML
    // is missing, the content needs converting — force apply regardless of
    // the internal-update flag. This catches the case where pasted content
    // fired onUpdate (setting isInternalUpdate) before we could preprocess.
    const cleanedHasUl = cleaned.includes('<ul');
    const editorHasUl = currentEditorHtml.includes('<ul');
    const needsBulletFix = cleanedHasUl && !editorHasUl;

    if (needsBulletFix) {
      isInternalUpdate.current = false;
      editor.commands.setContent(cleaned, false);
      return;
    }

    // First sync after editor is ready — force apply
    if (!hasInitializedContent.current) {
      hasInitializedContent.current = true;
      isInternalUpdate.current = false;
      if (cleaned !== currentEditorHtml) {
        editor.commands.setContent(cleaned, false);
      }
      return;
    }

    // Normal flow: skip our own updates to prevent loops
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false;
      return;
    }
    if (cleaned !== currentEditorHtml) {
      editor.commands.setContent(cleaned, false);
    }
  }, [content, editor]);

  // ── Sync padding on margin change ──────────────────────────────────────────
  useEffect(() => {
    if (!editor) return;
    editor.view.dom.style.padding = `${margins.top}cm ${margins.right}cm ${margins.bottom}cm ${margins.left}cm`;
  }, [margins, editor]);

  // ── Imperative handle ──────────────────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    insertHTML: (html) => { if (editor) editor.chain().focus().insertContent(html).run(); },
    focus: () => editor?.chain().focus().run(),
  }), [editor]);

  // ── Tool functions ─────────────────────────────────────────────────────────
  const applyFontSize = (size) => { setFontSize(size); editor?.chain().focus().setFontSize(size).run(); };
  const applyFontFamily = (family) => { setFontFamily(family); editor?.chain().focus().setFontFamily(family).run(); };
  const applyLineSpacing = (value) => { setLineSpacing(value); editor?.chain().focus().setBlockLineHeight(value).run(); };

  const updateMargin = (side, value) => {
    const n = parseFloat(value);
    if (isNaN(n) || n < 0 || n > 5) return;
    setMargins(prev => ({ ...prev, [side]: n }));
  };
  const applyMarginPreset = (p) => {
    const presets = { normal: { top: 2.54, bottom: 2.54, left: 2.54, right: 2.54 }, narrow: { top: 1.27, bottom: 1.27, left: 1.27, right: 1.27 } };
    if (presets[p]) setMargins(presets[p]);
  };

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    const h = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') { e.preventDefault(); setIsPreviewMode(v => !v); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const pageWidth = useMemo(() => {
    if (containerWidth <= 30) return '18cm';
    if (containerWidth <= 40) return '19cm';
    if (containerWidth <= 50) return '20cm';
    return '21cm';
  }, [containerWidth]);

  // ── Toolbar helpers ────────────────────────────────────────────────────────
  const Btn = ({ onClick, active, children, tooltip, disabled }) => (
    <button onMouseDown={e => e.preventDefault()} onClick={onClick} title={tooltip} disabled={disabled}
      className={`flex items-center justify-center w-7 h-7 rounded text-sm transition-all duration-100
        ${active ? 'bg-blue-100 text-blue-700 border border-blue-300' : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
      {children}
    </button>
  );
  const Sep = () => <div className="w-px h-5 bg-gray-300 mx-0.5" />;
  const Grp = ({ children }) => <div className="flex items-center gap-0.5 bg-gray-50 rounded p-0.5">{children}</div>;

  if (!editor) return null;

  return (
    <div className={`flex flex-col h-screen transition-all duration-300 ${darkMode ? 'bg-gray-900' : 'bg-gray-100'} ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>

      {/* ── TOOLBAR ────────────────────────────────────────────────────── */}
      <div className={`sticky top-0 z-40 border-b ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="px-2 py-1.5 flex flex-wrap items-center gap-1 text-[11px]">

          {/* Font family */}
          <select value={fontFamily} onChange={e => applyFontFamily(e.target.value)}
            className="px-1 py-1 bg-white border border-gray-300 rounded text-[11px] w-36" title="Font">
            {['Arial','Arial Black','Calibri','Calibri Light','Comic Sans MS','Courier New','Georgia','Impact','Palatino Linotype','Segoe UI','Tahoma','Times New Roman','Trebuchet MS','Verdana'].map(f =>
              <option key={f} value={f}>{f}</option>
            )}
          </select>

          {/* Font size */}
          <select value={fontSize} onChange={e => applyFontSize(e.target.value)}
            className="px-1 py-1 bg-white border border-gray-300 rounded text-[11px] w-14" title="Size">
            {['8pt','9pt','10pt','11pt','12pt','14pt','16pt','18pt','20pt'].map(s =>
              <option key={s} value={s}>{parseInt(s)}</option>
            )}
          </select>

          <Sep />

          {/* Undo / Redo */}
          <Grp>
            <Btn onClick={() => editor.chain().focus().undo().run()} tooltip="Undo (Ctrl+Z)"><Undo2 size={16} /></Btn>
            <Btn onClick={() => editor.chain().focus().redo().run()} tooltip="Redo (Ctrl+Y)"><Redo2 size={16} /></Btn>
          </Grp>

          <Sep />

          {/* B / I / U / S / Sub / Sup */}
          <Grp>
            <Btn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} tooltip="Bold"><Bold size={16} /></Btn>
            <Btn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} tooltip="Italic"><Italic size={16} /></Btn>
            <Btn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} tooltip="Underline"><UnderlineIcon size={16} /></Btn>
            <Btn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} tooltip="Strikethrough"><Strikethrough size={16} /></Btn>
            <Btn onClick={() => editor.chain().focus().toggleSubscript().run()} active={editor.isActive('subscript')} tooltip="Subscript"><SubIcon size={16} /></Btn>
            <Btn onClick={() => editor.chain().focus().toggleSuperscript().run()} active={editor.isActive('superscript')} tooltip="Superscript"><SupIcon size={16} /></Btn>
          </Grp>

          <Sep />

          {/* Text color */}
          <div className="relative">
            <Btn onClick={() => { setShowTextColorPicker(!showTextColorPicker); setShowHighlightPicker(false); }} active={showTextColorPicker} tooltip="Text Color">
              <div className="flex flex-col items-center"><Type size={14} /><div className="w-4 h-1 rounded-sm bg-red-500 -mt-0.5" /></div>
            </Btn>
            {showTextColorPicker && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 p-2 w-36">
                <div className="text-[9px] font-semibold text-gray-500 mb-1">Text Color</div>
                <div className="grid grid-cols-6 gap-1">
                  {['#000000','#434343','#666666','#999999','#d32f2f','#c62828','#ad1457','#6a1b9a','#283593','#1565c0','#00838f','#2e7d32','#558b2f','#f9a825','#ff8f00','#ef6c00','#d84315','#37474f'].map(c => (
                    <button key={c} onMouseDown={e => e.preventDefault()}
                      onClick={() => { editor.chain().focus().setColor(c).run(); setShowTextColorPicker(false); }}
                      className="w-4 h-4 rounded border border-gray-200 hover:scale-125 transition-transform" style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Highlight */}
          <div className="relative">
            <Btn onClick={() => { setShowHighlightPicker(!showHighlightPicker); setShowTextColorPicker(false); }} active={showHighlightPicker} tooltip="Highlight">
              <Highlighter size={16} />
            </Btn>
            {showHighlightPicker && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 p-2 w-32">
                <div className="text-[9px] font-semibold text-gray-500 mb-1">Highlight</div>
                <div className="grid grid-cols-4 gap-1">
                  {['transparent','#ffff00','#00ff00','#00ffff','#ff00ff','#ffd700','#ffa07a','#98fb98','#add8e6','#dda0dd','#ffe4b5','#f0e68c'].map(c => (
                    <button key={c} onMouseDown={e => e.preventDefault()}
                      onClick={() => { c === 'transparent' ? editor.chain().focus().unsetHighlight().run() : editor.chain().focus().toggleHighlight({ color: c }).run(); setShowHighlightPicker(false); }}
                      className="w-5 h-5 rounded border border-gray-200 hover:scale-110 transition-transform"
                      style={{ backgroundColor: c === 'transparent' ? '#fff' : c }}>
                      {c === 'transparent' ? <span className="text-[7px] text-gray-400">x</span> : null}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Sep />

          {/* Alignment */}
          <Grp>
            <Btn onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} tooltip="Left"><AlignLeft size={16} /></Btn>
            <Btn onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} tooltip="Center"><AlignCenter size={16} /></Btn>
            <Btn onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} tooltip="Right"><AlignRight size={16} /></Btn>
            <Btn onClick={() => editor.chain().focus().setTextAlign('justify').run()} active={editor.isActive({ textAlign: 'justify' })} tooltip="Justify"><AlignJustify size={16} /></Btn>
          </Grp>

          <Sep />

          {/* Lists */}
          <Grp>
            <Btn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} tooltip="Bullets"><List size={16} /></Btn>
            <Btn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} tooltip="Numbering"><ListOrdered size={16} /></Btn>
          </Grp>

          <Sep />

          {/* Table + HR */}
          <Grp>
            <div className="relative">
              <Btn onClick={() => setShowTableDialog(!showTableDialog)} active={showTableDialog} tooltip="Insert Table"><TableIcon size={16} /></Btn>
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
                    <button onClick={() => { editor.chain().focus().insertTable({ rows: tableDialogRows, cols: tableDialogCols, withHeaderRow: false }).run(); setShowTableDialog(false); }}
                      className="flex-1 px-2 py-1 text-[10px] font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded">Insert</button>
                    <button onClick={() => setShowTableDialog(false)}
                      className="px-2 py-1 text-[10px] text-gray-500 bg-gray-100 hover:bg-gray-200 rounded">Cancel</button>
                  </div>
                </div>
              )}
            </div>
            <Btn onClick={() => editor.chain().focus().setHorizontalRule().run()} tooltip="Horizontal Line"><Minus size={16} /></Btn>
          </Grp>

          <Sep />

          {/* Margins */}
          <div className="relative">
            <Btn onClick={() => setShowMarginControls(!showMarginControls)} active={showMarginControls} tooltip="Margins"><Columns size={16} /></Btn>
            {showMarginControls && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded shadow-lg p-2 z-50 w-48">
                <div className="text-[10px] font-semibold mb-1">Margins (cm)</div>
                <div className="grid grid-cols-2 gap-0.5 mb-2">
                  <button onClick={() => applyMarginPreset('normal')} className="px-1.5 py-0.5 text-[9px] bg-gray-100 hover:bg-gray-200 rounded">Normal</button>
                  <button onClick={() => applyMarginPreset('narrow')} className="px-1.5 py-0.5 text-[9px] bg-gray-100 hover:bg-gray-200 rounded">Narrow</button>
                </div>
                <div className="space-y-1">
                  {['top','bottom','left','right'].map(s => (
                    <div key={s} className="flex items-center justify-between gap-1">
                      <label className="text-[9px] capitalize w-10">{s}:</label>
                      <input type="number" min="0" max="5" step="0.1" value={margins[s]}
                        onChange={e => updateMargin(s, e.target.value)}
                        className="w-14 px-1 py-0.5 text-[9px] border border-gray-300 rounded" />
                    </div>
                  ))}
                </div>
                <button onClick={() => setShowMarginControls(false)}
                  className="mt-2 w-full px-1.5 py-0.5 text-[9px] bg-blue-600 text-white rounded hover:bg-blue-700">Apply</button>
              </div>
            )}
          </div>

          {/* Line Spacing */}
          <div className="relative">
            <Btn onClick={() => setShowLineSpacingMenu(!showLineSpacingMenu)} active={showLineSpacingMenu} tooltip={`Line Spacing (${lineSpacing})`}>
              <Baseline size={16} />
            </Btn>
            {showLineSpacingMenu && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 w-36">
                <div className="px-2 py-1 text-[9px] font-semibold text-gray-400 uppercase">Line Spacing</div>
                {[
                  { value: '1', label: 'Single (1.0)' }, { value: '1.15', label: '1.15' },
                  { value: '1.4', label: '1.4' }, { value: '1.5', label: '1.5' },
                  { value: '1.8', label: '1.8' }, { value: '2', label: 'Double (2.0)' },
                  { value: '2.5', label: '2.5' }, { value: '3', label: 'Triple (3.0)' },
                ].map(opt => (
                  <button key={opt.value} onMouseDown={e => e.preventDefault()}
                    onClick={() => { applyLineSpacing(opt.value); setShowLineSpacingMenu(false); }}
                    className={`w-full px-3 py-1 text-left text-[11px] hover:bg-blue-50 flex items-center justify-between ${lineSpacing === opt.value ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700'}`}>
                    <span>{opt.label}</span>
                    {lineSpacing === opt.value && <span className="text-blue-600">&#10003;</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Sep />

          {/* Zoom */}
          <Grp>
            <button onClick={() => setZoomLevel(Math.max(50, zoomLevel - 10))} className="px-1 py-0.5 bg-white border border-gray-300 rounded hover:bg-gray-50 text-[10px]" title="Zoom Out"><ZoomOut size={14} /></button>
            <span className="text-[10px] font-medium min-w-[2rem] text-center px-1">{zoomLevel}%</span>
            <button onClick={() => setZoomLevel(Math.min(200, zoomLevel + 10))} className="px-1 py-0.5 bg-white border border-gray-300 rounded hover:bg-gray-50 text-[10px]" title="Zoom In"><ZoomIn size={14} /></button>
          </Grp>

          <Sep />

          {/* Edit / Preview */}
          <div className="flex bg-gray-100 rounded p-0.5">
            <button onClick={() => setIsPreviewMode(false)}
              className={`px-2 py-0.5 rounded text-[10px] font-medium flex items-center gap-1 transition-all ${!isPreviewMode ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}>
              <Edit3 size={12} /> Edit
            </button>
            <button onClick={() => setIsPreviewMode(true)}
              className={`px-2 py-0.5 rounded text-[10px] font-medium flex items-center gap-1 transition-all ${isPreviewMode ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}>
              <Eye size={12} /> Preview
            </button>
          </div>

        </div>
      </div>

      {/* ── Spacer ────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 h-4" style={{ background: darkMode ? '#2d2d30' : '#e1e1e1' }} />

      {/* ── Content ───────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden" style={{ background: darkMode ? '#2d2d30' : '#e1e1e1' }}>
        <style dangerouslySetInnerHTML={{ __html: getEditorStyles(pageWidth, margins) }} />
        <div className="min-h-full py-4 px-2 flex justify-center">
          <div className="editor-wrapper" style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center', transition: 'transform 0.2s ease', width: '100%', maxWidth: pageWidth }}>
            {isPreviewMode ? (
              <div className="ms-word-page" style={{ padding: `${margins.top}cm ${margins.right}cm ${margins.bottom}cm ${margins.left}cm` }}
                dangerouslySetInnerHTML={{ __html: editor.getHTML() }} />
            ) : (
              <EditorContent editor={editor} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

// ── Styles ───────────────────────────────────────────────────────────────────
function getEditorStyles(pageWidth, margins) {
  return `
    .ms-word-page, .ProseMirror {
      width: ${pageWidth}; max-width: 100%; min-height: 29.7cm;
      margin: 0 auto 20px auto; background: white;
      box-shadow: 0 0 10px rgba(0,0,0,0.1);
      font-family: ${EDITOR_DEFAULTS.fontFamily}, sans-serif;
      font-size: ${EDITOR_DEFAULTS.fontSize};
      line-height: ${EDITOR_DEFAULTS.lineSpacing};
      color: #000; outline: none; box-sizing: border-box; position: relative;
      padding: ${margins.top}cm ${margins.right}cm ${margins.bottom}cm ${margins.left}cm;
    }
    .ProseMirror:focus { box-shadow: 0 0 10px rgba(0,0,0,0.15), 0 0 0 1px rgba(59,130,246,0.3); }
    .editor-wrapper { display: inline-block; width: 100%; max-width: ${pageWidth}; }

    .page-header-table, .patient-info-table { width: 100%; border-collapse: collapse; margin: 1rem 0; font-size: 10pt; border: 1px solid #333; }
    .page-header-table td, .patient-info-table td { border: 1px solid #333; padding: 8px 10px; vertical-align: top; }
    .page-header-table td:nth-child(1), .page-header-table td:nth-child(3),
    .patient-info-table td:nth-child(1), .patient-info-table td:nth-child(3) {
      background: linear-gradient(135deg, #6EE4F5 0%, #5DD4E4 100%); font-weight: 600; width: 22%; color: #000;
    }
    .page-header-table td:nth-child(2), .page-header-table td:nth-child(4),
    .patient-info-table td:nth-child(2), .patient-info-table td:nth-child(4) { background-color: #fff; width: 28%; }

    .signature-section { margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #ddd; font-size: 10pt; page-break-inside: avoid; }
    .doctor-name { font-weight: 700; margin-bottom: 6px; font-size: 12pt; color: #000; }
    .doctor-specialization, .doctor-license { margin: 4px 0; font-size: 10pt; color: #333; }
    .signature-image { width: 100px; height: 50px; margin: 10px 0; object-fit: contain; }

    p { margin: 8px 0; font-size: inherit; line-height: inherit; }
    h1, h2, h3 { font-weight: 700; text-decoration: underline; margin: 16px 0 8px 0; page-break-after: avoid; }
    h1 { font-size: 16pt; } h2 { font-size: 14pt; } h3 { font-size: 12pt; }
    ul, ol { padding-left: 32px; margin: 8px 0; }
    ul { list-style-type: disc !important; } ol { list-style-type: decimal !important; }
    li { margin: 4px 0; display: list-item !important; }
    strong, b { font-weight: 700 !important; } em, i { font-style: italic !important; } u { text-decoration: underline !important; }
    table { border-collapse: collapse; width: 100%; margin: 10px 0; }
    td, th { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f2f2f2; font-weight: 600; }
    hr { border: none; border-top: 1px solid #ddd; margin: 15px 0; }

    .selectedCell:after { z-index: 2; position: absolute; content: ""; left: 0; right: 0; top: 0; bottom: 0; background: rgba(200,200,255,0.4); pointer-events: none; }
    .column-resize-handle { position: absolute; right: -2px; top: 0; bottom: 0; width: 4px; z-index: 20; background-color: #adf; pointer-events: none; }
    .tableWrapper { overflow-x: auto; }
    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-track { background: #f1f1f1; }
    ::-webkit-scrollbar-thumb { background: #888; border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: #555; }
  `;
}

export default ReportEditor;
