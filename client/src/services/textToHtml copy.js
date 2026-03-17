class TextToHtmlService {
  
  /**
   * Convert plain text to HTML - PROFESSIONAL RADIOLOGY REPORT TEMPLATE
   */
  static convertToHtml(text, options = {}) {
    if (!text || typeof text !== 'string') {
      return '';
    }

    const {
      formatHeaders = true,
      formatLists = true,
      formatMedicalTerms = true,
      createParagraphs = true,
      addPageBreaks = false,
      fontFamily = 'Times New Roman',
      fontSize = '12pt',
      lineHeight = '1.2' // ✅ Tight line spacing
    } = options;

    let html = text.trim();

    // 1. NO HTML escaping for templates - keep formatting intact
    // html = this.escapeHtml(html);

    // 2. Format medical sections with professional styling
    if (formatHeaders) {
      html = this.formatMedicalSections(html);
    }

    // 3. Format lists (minimal spacing)
    if (formatLists) {
      html = this.formatLists(html);
    }

    // 4. Format medical terms
    if (formatMedicalTerms) {
      html = this.formatMedicalTerms(html);
    }

    // 5. Create paragraphs with minimal spacing
    if (createParagraphs) {
      html = this.createParagraphs(html);
    } else {
      html = html.replace(/\n/g, '<br>');
    }

    // 6. Add page breaks if needed
    if (addPageBreaks) {
      html = this.addPageBreaks(html);
    }

    // 7. Wrap in professional radiology report container
    return this.wrapInMedicalContainer(html, { fontFamily, fontSize, lineHeight });
  }

  /**
   * Professional medical section formatting - RADIOLOGY STYLE
   */
  static formatMedicalSections(text) {
    // ✅ Extract first line as CENTERED HEADING
    const lines = text.split('\n');
    let processedText = text;
    let heading = '';

    // Check if first line looks like a heading (all caps or study name)
    if (lines[0] && (lines[0] === lines[0].toUpperCase() || lines[0].length < 80)) {
      heading = lines[0].trim();
      processedText = lines.slice(1).join('\n');
    }

    // ✅ PRIMARY SECTIONS: FINDINGS, CONCLUSION, IMPRESSION (Bold, Underlined, Left-aligned)
    const primarySections = [
      /^(FINDINGS?:?)\s*$/gmi,
      /^(IMPRESSION:?)\s*$/gmi,
      /^(CONCLUSION:?)\s*$/gmi,
      /^(CLINICAL HISTORY:?|HISTORY:?|INDICATION:?)\s*$/gmi,
      /^(RECOMMENDATIONS?:?|ADVICE:?)\s*$/gmi,
      /^(TECHNIQUE:?|PROCEDURE:?|COMPARISON:?)\s*$/gmi
    ];

    primarySections.forEach(pattern => {
      processedText = processedText.replace(pattern, (match, header) => {
        const headerStyle = `
          font-weight: bold; 
          text-decoration: underline; 
          margin: 8px 0 4px 0;
          padding: 0;
          display: block;
        `;
        return `<div style="${headerStyle}">${header}</div>`;
      });
    });

    // ✅ Wrap with centered heading if found
    if (heading) {
      const headingStyle = `
        text-align: center;
        font-weight: bold;
        font-size: 14pt;
        margin-bottom: 12px;
        text-decoration: underline;
      `;
      return `<div style="${headingStyle}">${heading.toUpperCase()}</div>\n${processedText}`;
    }

    return processedText;
  }

  /**
   * Minimal list formatting - COMPACT RADIOLOGY STYLE
   */
  static formatLists(text) {
    // ✅ Bullet points with minimal spacing
    text = text.replace(/^([•\-*]\s+.+)$/gm, (match, item) => {
      const cleanItem = item.replace(/^[•\-*]\s*/, '');
      return `<div style="margin: 1px 0 1px 20px; line-height: 1.2;">• ${cleanItem}</div>`;
    });

    // ✅ Numbered lists with minimal spacing
    text = text.replace(/^(\d+[\.)]\s+.+)$/gm, (match, item) => {
      return `<div style="margin: 1px 0 1px 20px; line-height: 1.2;">${item}</div>`;
    });

    return text;
  }

  /**
   * Medical terms formatting - SUBTLE EMPHASIS
   */
  static formatMedicalTerms(text) {
    // ✅ Bold critical findings ONLY
    const criticalFindings = [
      /\b(NORMAL|ABNORMAL|NO\s+(?:EVIDENCE|DEFINITE|SIGNIFICANT))\b/gi,
      /\b(WITHIN\s+NORMAL\s+LIMITS?|WNL|UNREMARKABLE)\b/gi
    ];

    criticalFindings.forEach(pattern => {
      text = text.replace(pattern, '<strong>$1</strong>');
    });

    // ✅ Keep measurements as-is (no special formatting for clean look)
    
    return text;
  }

  /**
   * Create paragraphs - MINIMAL SPACING
   */
  static createParagraphs(text) {
    const paragraphs = text.split(/\n\s*\n/);
    
    return paragraphs.map(paragraph => {
      const trimmed = paragraph.trim();
      if (!trimmed) return '';
      
      // Don't wrap if already has HTML tags
      if (/<\/?(h[1-6]|ul|ol|li|div|p)\b/i.test(trimmed)) {
        return trimmed;
      }
      
      // ✅ Single line breaks become <br> (no paragraph spacing)
      const lines = trimmed.split('\n');
      if (lines.length === 1) {
        return `<div style="margin: 2px 0; line-height: 1.2;">${trimmed}</div>`;
      }
      
      // ✅ Multiple lines with minimal spacing
      return `<div style="margin: 4px 0; line-height: 1.2;">${trimmed.replace(/\n/g, '<br>')}</div>`;
    }).filter(p => p).join('');
  }

  /**
   * Professional Radiology Report Container
   */
  static wrapInMedicalContainer(html, { fontFamily, fontSize, lineHeight }) {
    return `
      <div style="
        font-family: '${fontFamily}', 'Times New Roman', serif;
        font-size: ${fontSize};
        line-height: ${lineHeight};
        color: #000000;
        margin: 0;
        padding: 20px 30px;
        background-color: #ffffff;
        max-width: 21cm;
        margin: 0 auto;
        text-align: left;
      ">
        ${html}
      </div>
    `;
  }

  /**
   * Convert HTML back to plain text
   */
  static htmlToText(html) {
    if (!html) return '';
    
    const div = document.createElement('div');
    div.innerHTML = html;
    
    // Replace headers
    const headers = div.querySelectorAll('h1, h2, h3, h4, h5, h6');
    headers.forEach(header => {
      const text = header.textContent.trim();
      header.outerHTML = `\n${text}\n`;
    });

    // Replace divs with line breaks
    const divs = div.querySelectorAll('div');
    divs.forEach(d => {
      d.outerHTML = d.textContent.trim() + '\n';
    });

    // Replace <br> with newlines
    div.innerHTML = div.innerHTML.replace(/<br\s*\/?>/gi, '\n');

    return div.textContent || div.innerText || '';
  }

  // ✅ NO HTML escaping for templates
  static escapeHtml(str) {
    return str; // Keep as-is for templates
  }

  // ✅ Page breaks before major sections
  static addPageBreaks(text) {
    if (!text || typeof text !== 'string') return text;
    return text.replace(
      /(<div[^>]*>\s*)(IMPRESSION|CONCLUSION|RECOMMENDATIONS?)(:?\s*<\/div>)/gmi,
      '<div style="page-break-before: always;"></div>$1$2$3'
    );
  }
}

export default TextToHtmlService;