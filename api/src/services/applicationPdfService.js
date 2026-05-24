const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const orgConfig = require('../config/orgConfig');

class ApplicationPdfService {
  constructor() {
    this.logoPath = orgConfig.logoPath;
    this.outputDir = path.join(__dirname, '../../receipts');
    this.org = {
      name: orgConfig.displayName.toUpperCase(),
      regNumber: orgConfig.regNumber,
      address: orgConfig.address,
      phone: orgConfig.phone,
      email: orgConfig.email,
      website: orgConfig.website
    };
    // Noto Sans Malayalam — supports both Latin and Malayalam Unicode
    const fontsDir = path.join(__dirname, '../assets/fonts');
    this.fontRegular = path.join(fontsDir, 'NotoSansMalayalam-Regular.ttf');
    this.fontBold = path.join(fontsDir, 'NotoSansMalayalam-Bold.ttf');
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  // Register Malayalam fonts on a PDFDocument instance
  _registerFonts(doc) {
    doc.registerFont('Regular', this.fontRegular);
    doc.registerFont('Bold', this.fontBold);
    // Latin fonts are PDFKit built-ins — no registration needed
  }

  // ─── Script-aware text rendering ────────────────────────────────────────────

  // Returns true if the string contains any Malayalam character (U+0D00–U+0D7F)
  _hasMalayalam(text) {
    return /[\u0D00-\u0D7F]/.test(String(text));
  }

  // Split a string into runs of Malayalam vs. non-Malayalam characters
  _splitByScript(text) {
    const str = String(text || '');
    if (!str) return [];
    const runs = [];
    let buf = '';
    let lastIsMal = null;
    for (const ch of str) {
      const code = ch.codePointAt(0);
      const isMal = code >= 0x0D00 && code <= 0x0D7F;
      if (lastIsMal === null) lastIsMal = isMal;
      if (isMal !== lastIsMal) {
        if (buf) runs.push({ text: buf, isMalayalam: lastIsMal });
        buf = ch;
        lastIsMal = isMal;
      } else {
        buf += ch;
      }
    }
    if (buf) runs.push({ text: buf, isMalayalam: lastIsMal });
    return runs;
  }

  /**
   * Render text with automatic per-script font switching.
   * Malayalam segments use NotoSansMalayalam; everything else uses Helvetica.
   * @param {PDFDocument} doc
   * @param {string} text
   * @param {number|null} x  - absolute x (first segment only); pass null to stay at cursor
   * @param {number|null} y  - absolute y (first segment only)
   * @param {object} opts    - PDFKit text options
   * @param {boolean} bold
   */
  _t(doc, text, x, y, opts = {}, bold = false) {
    if (!text && text !== 0) return;
    const str = String(text);
    const runs = this._splitByScript(str);
    if (runs.length === 0) return;

    runs.forEach((run, idx) => {
      const isLast = idx === runs.length - 1;
      // Choose font: Malayalam → registered Noto font; Latin/other → Helvetica built-in
      if (run.isMalayalam) {
        doc.font(bold ? 'Bold' : 'Regular');
      } else {
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica');
      }
      // All non-last runs must use continued:true to stay on the same line
      const runOpts = { ...opts, continued: isLast ? (opts.continued || false) : true };
      if (idx === 0 && x !== null && x !== undefined) {
        doc.text(run.text, x, y, runOpts);
      } else {
        doc.text(run.text, runOpts);
      }
    });
  }

  /**
   * Generate a filled application PDF (with all submitted data)
   * @param {Object} application - Populated application document
   * @param {Object} formConfig - The FormConfiguration document for the scheme
   * @returns {Promise<string>} Path to generated PDF
   */
  async generateFilledApplicationPdf(application, formConfig) {
    const fileName = `application-${application.applicationNumber || application._id}.pdf`;
    const filePath = path.join(this.outputDir, fileName);

    const doc = new PDFDocument({ size: 'A4', margin: 50, info: {
      Title: `Application - ${application.applicationNumber}`,
      Author: orgConfig.erpTitle,
      Subject: 'Application Form'
    }});

    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);
    this._registerFonts(doc);

    this._addHeader(doc);
    this._addApplicationTitle(doc, application, false);
    this._addBeneficiaryInfo(doc, application);
    this._addFormData(doc, formConfig, application.formData || {}, false);
    this._addDocumentsList(doc, application.documents || []);
    this._addFooter(doc);
    doc.end();

    return new Promise((resolve, reject) => {
      stream.on('finish', () => resolve(filePath));
      stream.on('error', reject);
    });
  }

  /**
   * Generate a blank application form PDF (all fields empty)
   * @param {Object} formConfig - The FormConfiguration document
   * @param {string} schemeName - Name of the scheme
   * @returns {Promise<string>} Path to generated PDF
   */
  async generateBlankFormPdf(formConfig, schemeName) {
    const safeScheme = (schemeName || 'scheme').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const fileName = `blank-form-${safeScheme}-${Date.now()}.pdf`;
    const filePath = path.join(this.outputDir, fileName);

    const doc = new PDFDocument({ size: 'A4', margin: 50, info: {
      Title: `Application Form - ${schemeName}`,
      Author: orgConfig.erpTitle,
      Subject: 'Blank Application Form'
    }});

    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);
    this._registerFonts(doc);

    this._addHeader(doc);
    this._addBlankFormTitle(doc, schemeName, formConfig);
    this._addFormData(doc, formConfig, {}, true);
    this._addFooter(doc);
    doc.end();

    return new Promise((resolve, reject) => {
      stream.on('finish', () => resolve(filePath));
      stream.on('error', reject);
    });
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  _addHeader(doc) {
    try {
      if (fs.existsSync(this.logoPath)) {
        doc.image(this.logoPath, 50, 50, { width: 70 });
      }
    } catch (e) { /* no logo */ }

    // Org name — English, use Helvetica-Bold
    doc.fontSize(18).font('Helvetica-Bold').text(this.org.name, 130, 55);
    doc.fontSize(10);
    this._t(doc, `Reg. No: ${this.org.regNumber}`, 130, 78);
    this._t(doc, `${this.org.address}`, 130, 90);
    this._t(doc, `Phone: ${this.org.phone} | Email: ${this.org.email}`, 130, 102);

    doc.moveTo(50, 130).lineTo(545, 130).strokeColor('#cccccc').stroke();
    doc.strokeColor('#000000');
    doc.y = 145;
  }

  _addApplicationTitle(doc, application, isBlank) {
    doc.fontSize(16);
    this._t(doc, application.scheme?.name || 'Application Form', 50, doc.y, { align: 'center', width: 495 }, true);
    doc.y += 6;
    doc.fontSize(11).fillColor('#666666');
    this._t(doc, isBlank ? 'Blank Application Form' : `Application No: ${application.applicationNumber}`, null, null, { align: 'center', width: 495 });
    doc.fillColor('#000000');
    doc.y += 4;

    if (!isBlank) {
      doc.fontSize(10);
      this._t(doc, `Status: ${this._formatStatus(application.status)}   |   Applied: ${this._formatDate(application.createdAt)}`, null, null, { align: 'center', width: 495 });
    }
    doc.y += 12;
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#cccccc').stroke();
    doc.strokeColor('#000000');
    doc.y += 10;
  }

  _addBlankFormTitle(doc, schemeName, formConfig) {
    doc.fontSize(16);
    this._t(doc, schemeName || formConfig.title || 'Application Form', 50, doc.y, { align: 'center', width: 495 }, true);
    doc.y += 6;
    doc.fontSize(11).fillColor('#666666');
    this._t(doc, 'Application Form — Please Fill All Required Fields (*)', null, null, { align: 'center', width: 495 });
    doc.fillColor('#000000');
    doc.y += 12;
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#cccccc').stroke();
    doc.strokeColor('#000000');
    doc.y += 10;
  }

  _addBeneficiaryInfo(doc, application) {
    const b = application.beneficiary || {};
    doc.fontSize(13);
    this._t(doc, 'Applicant Information', 50, doc.y, {}, true);
    doc.y += 6;
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#eeeeee').stroke();
    doc.strokeColor('#000000');
    doc.y += 8;

    const leftX = 60, rightX = 310, lineH = 18;
    doc.fontSize(10);

    this._labelValue(doc, 'Name:', b.name || 'N/A', leftX, doc.y);
    const rowY = doc.y;
    this._labelValue(doc, 'Phone:', b.phone || 'N/A', rightX, rowY);
    doc.y += lineH;

    if (application.district?.name || application.area?.name || application.unit?.name) {
      this._labelValue(doc, 'Location:', [application.unit?.name, application.area?.name, application.district?.name].filter(Boolean).join(', '), leftX, doc.y);
      doc.y += lineH;
    }

    if (application.scheme?.name) {
      this._labelValue(doc, 'Scheme:', application.scheme.name, leftX, doc.y);
      doc.y += lineH;
    }

    if (application.requestedAmount) {
      this._labelValue(doc, 'Requested Amount:', `₹${Number(application.requestedAmount).toLocaleString('en-IN')}`, leftX, doc.y);
      doc.y += lineH;
    }

    doc.y += 8;
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#eeeeee').stroke();
    doc.strokeColor('#000000');
    doc.y += 10;
  }

  _addFormData(doc, formConfig, formData, isBlank) {
    const pages = (formConfig && formConfig.pages) ? formConfig.pages : [];

    pages.forEach((page, pageIdx) => {
      const fields = page.fields || [];
      const visibleFields = fields.filter(f => f.enabled !== false && !['title', 'html', 'group', 'page'].includes(f.type));
      if (visibleFields.length === 0) return;

      // Page section title
      doc.fontSize(13);
      this._t(doc, `Section ${pageIdx + 1}: ${page.title || 'Details'}`, 50, doc.y, {}, true);
      doc.y += 4;
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#eeeeee').stroke();
      doc.strokeColor('#000000');
      doc.y += 8;

      visibleFields.forEach(field => {
        this._checkPageBreak(doc);
        const key = `field_${field.id}`;
        const rawValue = formData[key];
        const displayValue = isBlank ? '' : this._getDisplayValue(field, rawValue);
        const required = field.required ? ' *' : '';
        const label = `${field.label}${required}`;

        doc.fontSize(10);
        this._t(doc, label, 60, doc.y, {}, true);
        doc.y += 3;

        if (field.helpText) {
          doc.fontSize(8).fillColor('#888888');
          this._t(doc, field.helpText, 60, doc.y);
          doc.fillColor('#000000');
          doc.y += 3;
        }

        // Value / input area
        if (isBlank) {
          const lineY = doc.y + 12;
          doc.moveTo(60, lineY).lineTo(535, lineY).strokeColor('#999999').lineWidth(0.5).stroke();
          doc.lineWidth(1).strokeColor('#000000');
          doc.y = lineY + 10;
        } else {
          doc.fontSize(10);
          if (displayValue && displayValue !== '—') {
            doc.fillColor('#1a1a1a');
            this._t(doc, displayValue, 60, doc.y, { width: 480 });
          } else {
            doc.fillColor('#aaaaaa');
            this._t(doc, '—', 60, doc.y);
          }
          doc.fillColor('#000000');
          doc.y += 4;
        }

        doc.y += 6;
      });

      doc.y += 6;
    });
  }

  _addDocumentsList(doc, documents) {
    if (!documents || documents.length === 0) return;

    this._checkPageBreak(doc);
    doc.fontSize(13);
    this._t(doc, 'Submitted Documents', 50, doc.y, {}, true);
    doc.y += 4;
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#eeeeee').stroke();
    doc.strokeColor('#000000');
    doc.y += 8;

    documents.forEach((docItem, idx) => {
      this._checkPageBreak(doc);
      doc.fontSize(10);
      this._t(doc, `${idx + 1}. ${docItem.fieldLabel || docItem.type || 'Document'}: ${docItem.filename || docItem.originalName || 'Uploaded'}`, 60, doc.y);
      doc.y += 16;
    });
  }

  _addFooter(doc) {
    const pageHeight = doc.page.height;
    doc.fontSize(8).fillColor('#888888');
    this._t(doc, `Generated by ${orgConfig.erpTitle} on ${new Date().toLocaleString('en-IN')}`, 50, pageHeight - 50, { align: 'center', width: 495 });
    doc.fillColor('#000000');
  }

  _checkPageBreak(doc) {
    if (doc.y > doc.page.height - 120) {
      doc.addPage();
      doc.y = 50;
    }
  }

  _labelValue(doc, label, value, x, y) {
    doc.fontSize(10);
    // label (bold) + value (regular) — each may be Malayalam or Latin
    const labelRuns = this._splitByScript(label);
    const valRuns = this._splitByScript(` ${value || 'N/A'}`);
    const allRuns = [...labelRuns.map(r => ({ ...r, bold: true })), ...valRuns.map(r => ({ ...r, bold: false }))];
    allRuns.forEach((run, idx) => {
      const isLast = idx === allRuns.length - 1;
      doc.font(run.isMalayalam ? (run.bold ? 'Bold' : 'Regular') : (run.bold ? 'Helvetica-Bold' : 'Helvetica'));
      const opts = { continued: !isLast };
      if (idx === 0) {
        doc.text(run.text, x, y, opts);
      } else {
        doc.text(run.text, opts);
      }
    });
  }

  _getDisplayValue(field, rawValue) {
    if (rawValue === null || rawValue === undefined || rawValue === '') return '—';

    if (field.type === 'file') return rawValue ? 'Document uploaded' : '—';

    if (Array.isArray(rawValue)) {
      if (rawValue.length === 0) return '—';
      // Table fields (rows of arrays)
      if (Array.isArray(rawValue[0])) {
        return rawValue
          .map((row, r) => `  Row ${r + 1}: ${row.join(' | ')}`)
          .join('\n');
      }
      return rawValue.join(', ');
    }

    if (typeof rawValue === 'boolean') return rawValue ? 'Yes' : 'No';

    return String(rawValue);
  }

  _formatDate(dateVal) {
    if (!dateVal) return 'N/A';
    return new Date(dateVal).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  _formatStatus(status) {
    if (!status) return 'N/A';
    return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
}

module.exports = new ApplicationPdfService();
