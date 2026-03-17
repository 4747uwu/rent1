/**
 * 🔥 PROFESSIONAL RADIOLOGY REPORT RENDERING ENGINE
 * 
 * Architecture: Text → HTML (faithful, literal conversion)
 * - Preserves original section names exactly
 * - Preserves original formatting/structure
 * - No renaming, no reordering, no "smart" changes
 * - Only adds styling (bold headers, underline, center title)
 */

class RadiologyReportEngine {

  /**
   * 🎯 SECTION HEADERS - just for detection, NOT for renaming
   */
  static SECTION_HEADERS = [
    'CLINICAL HISTORY', 'HISTORY', 'INDICATION', 'REASON FOR EXAM',
    'CLINICAL INFORMATION', 'REASON FOR STUDY', 'CLINICAL NOTES',
    'TECHNIQUE', 'PROCEDURE', 'METHOD', 'METHODOLOGY', 'PROTOCOL', 'IMAGING TECHNIQUE',
    'COMPARISON', 'PRIOR STUDIES', 'PREVIOUS STUDIES', 'PRIOR EXAM',
    'OBSERVATION', 'OBSERVATIONS',
    'FINDINGS', 'DESCRIPTION', 'RADIOLOGICAL FINDINGS', 'IMAGING FINDINGS',
    'IMPRESSION', 'OPINION', 'SUMMARY', 'RADIOLOGICAL IMPRESSION', 'RADIOLOGICAL OPINION',
    'CONCLUSION', 'FINAL DIAGNOSIS', 'DIAGNOSIS',
    'RECOMMENDATION', 'RECOMMENDATIONS', 'ADVICE', 'SUGGESTION',
    'FOLLOW-UP', 'FOLLOW UP', 'FURTHER MANAGEMENT'
  ];

  /**
   * 🎯 SEVERITY-AWARE MEDICAL TERMS
   */
  static MEDICAL_TERMS = {
    critical: [
      'HEMORRHAGE', 'RUPTURE', 'MALIGNANT', 'ACUTE INFARCT', 'FRACTURE',
      'DISSECTION', 'ANEURYSM', 'OCCLUSION', 'THROMBOSIS', 'EMBOLISM'
    ],
    normal: [
      'UNREMARKABLE', 'WNL', 'NORMAL', 'WITHIN NORMAL LIMITS',
      'NO ABNORMALITY', 'PRESERVED'
    ],
    negative: [
      'NO EVIDENCE OF', 'NO EVIDENCE FOR', 'ABSENT', 'NOT SEEN',
      'NO SIGNS OF', 'NO ACUTE', 'NO DEFINITE', 'NO SIGNIFICANT'
    ]
  };

  /**
   * 🔥 MAIN CONVERSION: Text → HTML (literal, faithful)
   */
  static convert(text, options = {}) {
    const {
      templateVariables = {},
      fontFamily = 'Times New Roman',
      fontSize = '12pt',
      lineHeight = '1.15',
      formatHeaders = true,
      formatLists = true,
      formatMedicalTerms = true,
      createParagraphs = true,
      addPageBreaks = false
    } = options;

    if (!text || typeof text !== 'string') {
      return '';
    }

    // Apply template variables first
    let processed = text.trim();
    if (Object.keys(templateVariables).length > 0) {
      processed = processed.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
        return path.split('.').reduce((obj, key) => obj?.[key], templateVariables) || match;
      });
    }

    // Convert text to HTML line by line - LITERAL conversion
    const html = this.convertLines(processed, { formatHeaders, formatLists, formatMedicalTerms, createParagraphs });

    // Wrap in simple container
    return this.wrapInContainer(html, { fontFamily, fontSize, lineHeight });
  }

  /**
   * 🧠 Convert text line by line - FAITHFUL to original
   */
  static convertLines(text, options) {
    const lines = text.split('\n');
    let html = '';
    let isFirstLine = true;
    let firstLineProcessed = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Empty line = line break
      if (!trimmed) {
        html += '<br>';
        continue;
      }

      // First non-empty line: check if it's a title (all caps, short)
      if (isFirstLine && !firstLineProcessed) {
        firstLineProcessed = true;
        isFirstLine = false;

        if (trimmed === trimmed.toUpperCase() && trimmed.length < 80) {
          html += `<div style="text-align: center; font-weight: bold; font-size: 14pt; text-decoration: underline; margin-bottom: 8px;">${trimmed}</div>\n`;
          continue;
        }
      }

      // Check if this line is a section header (standalone like "OBSERVATION:" or inline like "TECHNIQUE: content")
      if (options.formatHeaders) {
        const headerMatch = this.matchSectionHeader(trimmed);

        if (headerMatch) {
          if (headerMatch.content) {
            // Inline header: "TECHNIQUE: Volume scan of arm..."
            let content = headerMatch.content;
            if (options.formatMedicalTerms) {
              content = this.applyMedicalEmphasis(content);
            }
            html += `<div style="margin-top: 6px;"><span style="font-weight: bold; text-decoration: underline;">${headerMatch.header}:</span> ${content}</div>\n`;
          } else {
            // Standalone header: "OBSERVATION:"
            html += `<div style="font-weight: bold; text-decoration: underline; margin-top: 6px;">${headerMatch.header}:</div>\n`;
          }
          continue;
        }
      }

      // Check if line starts with any bullet-like character or checkbox
      if (options.formatLists && this.isBulletLine(trimmed)) {
        const cleaned = this.stripBulletMarker(trimmed);
        let content = cleaned;
        if (options.formatMedicalTerms) {
          content = this.applyMedicalEmphasis(content);
        }
        
        // Use simple bullet point that works in Times New Roman
        html += `<div style="margin-left: 30px; text-indent: -20px; margin-top: 2px;">• ${content}</div>\n`;
        continue;
      }

      // Regular line
      let content = trimmed;
      if (options.formatMedicalTerms) {
        content = this.applyMedicalEmphasis(content);
      }
      html += `<div style="margin-top: 2px;">${content}</div>\n`;
    }

    return html;
  }

  /**
   * 🔍 Detect if a line is a bullet/arrow line
   * Detects ANY non-letter character at the start followed by space, or tab indentation
   */
  static isBulletLine(line) {
    // Match: any symbol/punctuation at start + space, OR tab-indented text
    // This catches: ☐, □, ■, ✓, >, •, ➤, ▸, etc. AND broken Unicode boxes
    return /^[^\w\s]\s+/.test(line) || /^\t+\S/.test(line);
  }

  /**
   * 🔍 Strip bullet marker from start of line
   */
  static stripBulletMarker(line) {
    // Remove any non-word, non-space character at the start + following spaces
    return line.replace(/^[^\w\s]\s*/, '').replace(/^\t+/, '').trim();
  }

  /**
   * 🔍 Match section header - returns original name, never renames
   */
  static matchSectionHeader(line) {
    const upper = line.toUpperCase().replace(/[:\s]+$/, '');

    for (const header of this.SECTION_HEADERS) {
      if (upper === header) {
        // Standalone header (e.g., "OBSERVATION:")
        return { header: line.replace(/[:\s]+$/, ''), content: null };
      }
      if (upper.startsWith(header + ':') || upper.startsWith(header + ' :')) {
        // Inline header (e.g., "TECHNIQUE: Volume scan...")
        const colonIndex = line.indexOf(':');
        const originalHeader = line.substring(0, colonIndex).trim();
        const content = line.substring(colonIndex + 1).trim();
        return { header: originalHeader, content: content || null };
      }
    }

    return null;
  }

  /**
   * 🎯 Apply medical term emphasis - conservative
   */
  static applyMedicalEmphasis(text) {
    // Critical terms
    this.MEDICAL_TERMS.critical.forEach(term => {
      const regex = new RegExp(`\\b(${term})\\b`, 'gi');
      text = text.replace(regex, '<strong style="color: #d32f2f;">$1</strong>');
    });

    // Normal findings (bold, black)
    this.MEDICAL_TERMS.normal.forEach(term => {
      const regex = new RegExp(`\\b(${term})\\b`, 'gi');
      text = text.replace(regex, '<strong>$1</strong>');
    });

    // Negative findings (bold, black)
    this.MEDICAL_TERMS.negative.forEach(term => {
      const regex = new RegExp(`(${term})`, 'gi');
      text = text.replace(regex, '<strong>$1</strong>');
    });

    return text;
  }

  /**
   * 🎨 Wrap in simple container - NO <style> tags, ONLY inline styles
   */
  static wrapInContainer(html, { fontFamily, fontSize, lineHeight }) {
    return `<div style="font-family: '${fontFamily}', 'Times New Roman', serif; font-size: ${fontSize}; line-height: ${lineHeight}; color: #000; padding: 20px 30px; max-width: 21cm; margin: 0 auto;">${html}</div>`;
  }

  /**
   * 🔄 Convert HTML back to plain text
   */
  static htmlToText(html) {
    if (!html) return '';

    const div = document.createElement('div');
    div.innerHTML = html;

    // Replace <br> with newlines
    div.innerHTML = div.innerHTML.replace(/<br\s*\/?>/gi, '\n');

    // Replace divs/sections with newlines
    const blocks = div.querySelectorAll('div, section, p, header');
    blocks.forEach(block => {
      block.insertAdjacentText('afterend', '\n');
    });

    // Replace list items
    const listItems = div.querySelectorAll('li');
    listItems.forEach(li => {
      li.insertAdjacentText('beforebegin', '• ');
      li.insertAdjacentText('afterend', '\n');
    });

    let text = div.textContent || div.innerText || '';

    // Clean up multiple newlines
    text = text.replace(/\n{3,}/g, '\n\n');

    return text.trim();
  }

  /**
   * 🔍 Extract structured data for AI/Analytics
   */
  static extractStructuredData(text) {
    const ast = { title: '', sections: {}, measurements: [], criticalFindings: [] };
    const lines = text.trim().split('\n');

    if (lines[0] && lines[0] === lines[0].toUpperCase()) {
      ast.title = lines[0].trim();
    }

    // Extract measurements
    const measurementRegex = /\d+(?:\.\d+)?\s*(?:x|×)\s*\d+(?:\.\d+)?\s*(?:mm|cm)/gi;
    const measurements = text.match(measurementRegex);
    if (measurements) ast.measurements = measurements;

    // Extract critical findings
    this.MEDICAL_TERMS.critical.forEach(term => {
      if (new RegExp(term, 'i').test(text)) {
        ast.criticalFindings.push(term);
      }
    });

    return ast;
  }
}

// 🔥 Export with backward compatibility alias
class TextToHtmlService extends RadiologyReportEngine {
  static convertToHtml(text, options = {}) {
    return super.convert(text, options);
  }
}

export default TextToHtmlService;