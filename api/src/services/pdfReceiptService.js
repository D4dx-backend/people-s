const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const orgConfig = require('../config/orgConfig');

// Page constants (A4 in points)
const PAGE_W = 595;
const MARGIN = 40;
const CONTENT_W = PAGE_W - MARGIN * 2; // 515
const BOX_X = MARGIN;
const BOX_W = CONTENT_W;
const INNER_X = MARGIN + 10;        // left inner padding
const ROW_H = 18;                    // row height within tables
const SEC_GAP = 8;                   // gap between sections
const LABEL_W = 100;                 // label column width
const L_VAL_X = MARGIN + 112;       // left value column start
const L_VAL_W = 140;                 // left value column width
const R_COL_X = MARGIN + 270;       // right label column start
const R_LABEL_W = 90;
const R_VAL_X = MARGIN + 365;       // right value column start
const R_VAL_W = 150;                 // right value column width (fits to right margin)

class PDFReceiptService {
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
    
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  async generatePaymentReceipt(paymentData) {
    try {
      const fileName = `receipt-${paymentData.paymentNumber}.pdf`;
      const filePath = path.join(this.outputDir, fileName);
      
      const doc = new PDFDocument({
        size: 'A4',
        margin: MARGIN,
        autoFirstPage: true,
        info: {
          Title: `Payment Receipt - ${paymentData.paymentNumber}`,
          Author: orgConfig.erpTitle,
          Subject: 'Payment Receipt',
          Creator: `${orgConfig.erpTitle} System`
        }
      });

      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      this._addHeader(doc);
      this._addReceiptTitle(doc);
      this._addPaymentDetails(doc, paymentData);
      this._addBeneficiaryDetails(doc, paymentData);
      this._addFinancialBreakdown(doc, paymentData);
      this._addBankDetails(doc, paymentData);
      this._addFooter(doc);

      doc.end();

      return new Promise((resolve, reject) => {
        stream.on('finish', () => resolve(filePath));
        stream.on('error', reject);
        doc.on('error', reject);
      });

    } catch (error) {
      console.error('❌ Error generating PDF receipt:', error);
      throw error;
    }
  }

  // ─── private helpers ────────────────────────────────────────────────────────

  /** Render a label + value pair at exact coordinates, clamped to column widths */
  _field(doc, labelX, labelW, valueX, valueW, y, label, value) {
    const safeValue = String(value || 'N/A');
    doc.fontSize(9).font('Helvetica')
       .text(label, labelX, y, { width: labelW, lineBreak: false });
    doc.fontSize(9).font('Helvetica-Bold')
       .text(safeValue, valueX, y, { width: valueW, lineBreak: false, ellipsis: true });
  }

  /** Draw a plain stroked rectangle */
  _box(doc, y, h) {
    doc.rect(BOX_X, y, BOX_W, h).stroke();
  }

  /** Draw a section heading inside a box */
  _heading(doc, y, title) {
    doc.fontSize(11).font('Helvetica-Bold')
       .text(title, INNER_X, y + 8, { lineBreak: false });
  }

  // ─── sections ───────────────────────────────────────────────────────────────

  _addHeader(doc) {
    const hasLogo = (() => {
      try { return this.logoPath && fs.existsSync(this.logoPath); }
      catch { return false; }
    })();

    if (hasLogo) {
      doc.image(this.logoPath, MARGIN, 40, { width: 55, height: 55 });
    }

    const textX = hasLogo ? MARGIN + 65 : MARGIN;
    const textW  = hasLogo ? CONTENT_W - 65 : CONTENT_W;

    doc.fontSize(15).font('Helvetica-Bold')
       .text(this.org.name, textX, 42, { width: textW, lineBreak: false });
    doc.fontSize(8.5).font('Helvetica')
       .text(`Registered NGO | Reg. No: ${this.org.regNumber}`, textX, 62, { width: textW, lineBreak: false })
       .text(`Address: ${this.org.address}`,                    textX, 74, { width: textW, lineBreak: false })
       .text(`Phone: ${this.org.phone} | Email: ${this.org.email}`, textX, 86, { width: textW, lineBreak: false })
       .text(this.org.website,                                   textX, 98, { width: textW, lineBreak: false });

    doc.moveTo(MARGIN, 115).lineTo(PAGE_W - MARGIN, 115).stroke();
    doc.y = 123;
  }

  _addReceiptTitle(doc) {
    doc.fontSize(14).font('Helvetica-Bold')
       .text('PAYMENT RECEIPT', MARGIN, doc.y, { align: 'center', width: CONTENT_W, lineBreak: false });
    doc.y += 18;
  }

  _addPaymentDetails(doc, paymentData) {
    const BOX_H = 28 + 3 * ROW_H + 6; // header + 3 rows + bottom pad
    const startY = doc.y;
    this._box(doc, startY, BOX_H);
    this._heading(doc, startY, 'PAYMENT INFORMATION');

    let y = startY + 28;
    this._field(doc, INNER_X,  LABEL_W, L_VAL_X, L_VAL_W, y, 'Receipt Number:',  paymentData.paymentNumber);
    this._field(doc, R_COL_X, R_LABEL_W, R_VAL_X, R_VAL_W, y, 'Application No:', paymentData.application?.applicationNumber);

    y += ROW_H;
    this._field(doc, INNER_X,  LABEL_W, L_VAL_X, L_VAL_W, y, 'Payment Date:',   this.formatDate(paymentData.timeline?.completedAt || paymentData.createdAt));
    this._field(doc, R_COL_X, R_LABEL_W, R_VAL_X, R_VAL_W, y, 'Scheme:',         paymentData.scheme?.name);

    y += ROW_H;
    this._field(doc, INNER_X,  LABEL_W, L_VAL_X, L_VAL_W, y, 'Payment Method:', this.formatPaymentMethod(paymentData.method));
    this._field(doc, R_COL_X, R_LABEL_W, R_VAL_X, R_VAL_W, y, 'Project:',        paymentData.project?.name);

    doc.y = startY + BOX_H + SEC_GAP;
  }

  _addBeneficiaryDetails(doc, paymentData) {
    const bankAccount = paymentData.beneficiary?.financial?.bankAccount;
    const rows = bankAccount ? 2 : 2;
    const BOX_H = 28 + rows * ROW_H + 6;
    const startY = doc.y;
    this._box(doc, startY, BOX_H);
    this._heading(doc, startY, 'BENEFICIARY DETAILS');

    let y = startY + 28;
    this._field(doc, INNER_X, LABEL_W, L_VAL_X, L_VAL_W, y, 'Name:',  paymentData.beneficiary?.name);
    if (bankAccount) {
      this._field(doc, R_COL_X, R_LABEL_W, R_VAL_X, R_VAL_W, y, 'Account No:', `****${bankAccount.accountNumber?.slice(-4) || 'XXXX'}`);
    }

    y += ROW_H;
    this._field(doc, INNER_X, LABEL_W, L_VAL_X, L_VAL_W, y, 'Phone:', paymentData.beneficiary?.phone);
    if (bankAccount) {
      this._field(doc, R_COL_X, R_LABEL_W, R_VAL_X, R_VAL_W, y, 'Bank:', bankAccount.bankName);
    }

    doc.y = startY + BOX_H + SEC_GAP;
  }

  _addFinancialBreakdown(doc, paymentData) {
    const amounts = [
      { label: 'Gross Amount:',    value: paymentData.amount,                          bold: false },
      { label: 'Processing Fee:',  value: paymentData.financial?.processingFee || 0,   bold: false },
      { label: 'Bank Charges:',    value: paymentData.financial?.bankCharges || 0,      bold: false },
    ];

    if (paymentData.financial?.taxes?.tds?.applicable) {
      amounts.push({ label: `TDS (${paymentData.financial.taxes.tds.rate}%):`, value: paymentData.financial.taxes.tds.amount || 0, bold: false });
    }
    if (paymentData.financial?.taxes?.gst?.applicable) {
      amounts.push({ label: `GST (${paymentData.financial.taxes.gst.rate}%):`, value: paymentData.financial.taxes.gst.amount || 0, bold: false });
    }
    amounts.push({ label: 'Net Amount Paid:', value: paymentData.financial?.netAmount || paymentData.amount, bold: true });

    // words line can wrap to 2 lines for large amounts
    const WORDS_H = 30;
    const BOX_H = 28 + amounts.length * ROW_H + 8 + WORDS_H + 4;
    const startY = doc.y;
    this._box(doc, startY, BOX_H);
    this._heading(doc, startY, 'FINANCIAL BREAKDOWN');

    let y = startY + 28;
    const AMT_LABEL_W = 180;
    const AMT_VAL_X = MARGIN + 380;
    const AMT_VAL_W = CONTENT_W - 380; // right-align in this space

    amounts.forEach((item, index) => {
      const isLast = index === amounts.length - 1;
      if (isLast) {
        doc.moveTo(INNER_X, y - 3).lineTo(PAGE_W - MARGIN - 10, y - 3).stroke();
        y += 4;
      }
      doc.fontSize(9).font(item.bold ? 'Helvetica-Bold' : 'Helvetica')
         .text(item.label, INNER_X, y, { width: AMT_LABEL_W, lineBreak: false });
      doc.fontSize(9).font(item.bold ? 'Helvetica-Bold' : 'Helvetica')
         .text(`Rs. ${this.formatAmount(item.value)}`, AMT_VAL_X, y, { width: AMT_VAL_W, align: 'right', lineBreak: false });
      y += ROW_H;
    });

    y += 5;
    doc.fontSize(8.5).font('Helvetica')
       .text('Amount in Words:', INNER_X, y, { lineBreak: false });
    y += 12;
    doc.fontSize(8.5).font('Helvetica-Bold')
       .text(this.numberToWords(paymentData.financial?.netAmount || paymentData.amount), INNER_X, y, {
         width: CONTENT_W - 20,
         lineBreak: true
       });

    doc.y = startY + BOX_H + SEC_GAP;
  }

  _addBankDetails(doc, paymentData) {
    if (paymentData.method !== 'bank_transfer' || !paymentData.bankTransfer) return;
    const { transactionId, utrNumber } = paymentData.bankTransfer;
    if (!transactionId && !utrNumber) return;

    const rows = [transactionId, utrNumber].filter(Boolean).length;
    const BOX_H = 28 + rows * ROW_H + 6;
    const startY = doc.y;
    this._box(doc, startY, BOX_H);
    this._heading(doc, startY, 'TRANSACTION DETAILS');

    let y = startY + 28;
    if (transactionId) {
      this._field(doc, INNER_X, 110, INNER_X + 115, CONTENT_W - 125, y, 'Transaction ID:', transactionId);
      y += ROW_H;
    }
    if (utrNumber) {
      this._field(doc, INNER_X, 110, INNER_X + 115, CONTENT_W - 125, y, 'UTR Number:', utrNumber);
    }

    doc.y = startY + BOX_H + SEC_GAP;
  }

  _addFooter(doc) {
    const startY = doc.y + 10;

    // Left: terms & conditions
    doc.fontSize(8).font('Helvetica')
       .text('Terms & Conditions:', MARGIN, startY)
       .text('• This is a computer-generated receipt and does not require a physical signature.', MARGIN, startY + 13, { width: 290, lineBreak: false })
       .text('• For queries, please contact our finance department.',                             MARGIN, startY + 25, { width: 290, lineBreak: false })
       .text('• This receipt is valid for all official purposes.',                               MARGIN, startY + 37, { width: 290, lineBreak: false });

    // Right: authorized signature
    doc.fontSize(9).font('Helvetica')
       .text('Authorized Signature:', R_COL_X, startY, { lineBreak: false });
    doc.moveTo(R_COL_X, startY + 38).lineTo(PAGE_W - MARGIN, startY + 38).stroke();

    // Bottom separator + generated-on line
    const bottomY = startY + 60;
    doc.moveTo(MARGIN, bottomY).lineTo(PAGE_W - MARGIN, bottomY).stroke();
    doc.fontSize(7.5).font('Helvetica')
       .text(`Generated on: ${this.formatDate(new Date())} | ${orgConfig.erpTitle}`, MARGIN, bottomY + 4, {
         align: 'center',
         width: CONTENT_W,
         lineBreak: false
       });
  }

  /**
   * Format date to readable string
   */
  formatDate(date) {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  /**
   * Format payment method
   */
  formatPaymentMethod(method) {
    const methods = {
      'bank_transfer': 'Bank Transfer',
      'cheque': 'Cheque',
      'cash': 'Cash',
      'digital_wallet': 'Digital Wallet',
      'upi': 'UPI'
    };
    return methods[method] || method;
  }

  /**
   * Format amount with commas
   */
  formatAmount(amount) {
    if (!amount) return '0.00';
    return parseFloat(amount).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  /**
   * Convert number to words (Indian format)
   */
  numberToWords(amount) {
    if (!amount) return 'Zero Rupees Only';
    
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    
    function convertHundreds(num) {
      let result = '';
      
      if (num > 99) {
        result += ones[Math.floor(num / 100)] + ' Hundred ';
        num %= 100;
      }
      
      if (num > 19) {
        result += tens[Math.floor(num / 10)] + ' ';
        num %= 10;
      } else if (num > 9) {
        result += teens[num - 10] + ' ';
        return result;
      }
      
      if (num > 0) {
        result += ones[num] + ' ';
      }
      
      return result;
    }
    
    const rupees = Math.floor(amount);
    const paise = Math.round((amount - rupees) * 100);
    
    let result = '';
    
    if (rupees === 0) {
      result = 'Zero';
    } else {
      const crores = Math.floor(rupees / 10000000);
      const lakhs = Math.floor((rupees % 10000000) / 100000);
      const thousands = Math.floor((rupees % 100000) / 1000);
      const hundreds = rupees % 1000;
      
      if (crores > 0) {
        result += convertHundreds(crores) + 'Crore ';
      }
      
      if (lakhs > 0) {
        result += convertHundreds(lakhs) + 'Lakh ';
      }
      
      if (thousands > 0) {
        result += convertHundreds(thousands) + 'Thousand ';
      }
      
      if (hundreds > 0) {
        result += convertHundreds(hundreds);
      }
    }
    
    result += 'Rupees';
    
    if (paise > 0) {
      result += ' and ' + convertHundreds(paise) + 'Paise';
    }
    
    result += ' Only';
    
    return result.trim();
  }
}

module.exports = PDFReceiptService;