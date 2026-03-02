const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const orgConfig = require('../config/orgConfig');

class PDFReceiptService {
  constructor() {
    this.logoPath = orgConfig.logoPath;
    this.outputDir = path.join(__dirname, '../../receipts');
    
    // Organization details — driven by ORG_NAME env var via orgConfig
    this.org = {
      name: orgConfig.displayName.toUpperCase(),
      regNumber: orgConfig.regNumber,
      address: orgConfig.address,
      phone: orgConfig.phone,
      email: orgConfig.email,
      website: orgConfig.website
    };
    
    // Ensure output directory exists
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Generate PDF receipt for payment
   * @param {Object} paymentData - Payment data with populated references
   * @returns {Promise<string>} - Path to generated PDF file
   */
  async generatePaymentReceipt(paymentData) {
    try {
      const fileName = `receipt-${paymentData.paymentNumber}.pdf`;
      const filePath = path.join(this.outputDir, fileName);
      
      // Create PDF document
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: `Payment Receipt - ${paymentData.paymentNumber}`,
          Author: orgConfig.erpTitle,
          Subject: 'Payment Receipt',
          Creator: `${orgConfig.erpTitle} System`
        }
      });

      // Create write stream
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // Add content to PDF
      this.addHeader(doc);
      this.addReceiptTitle(doc);
      this.addPaymentDetails(doc, paymentData);
      this.addBeneficiaryDetails(doc, paymentData);
      this.addFinancialBreakdown(doc, paymentData);
      this.addBankDetails(doc, paymentData);
      this.addFooter(doc);

      // Finalize PDF
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

  /**
   * Add header with logo and organization details
   */
  addHeader(doc) {
    // Add logo if exists (skip if not found to avoid errors)
    try {
      if (fs.existsSync(this.logoPath)) {
        doc.image(this.logoPath, 50, 50, { width: 80 });
      }
    } catch (error) {
      console.log('Logo not found, continuing without logo');
    }

    // Organization details (configurable)
    doc.fontSize(20)
       .font('Helvetica-Bold')
       .text(this.org.name, 150, 60);
    
    doc.fontSize(12)
       .font('Helvetica')
       .text(`Registered NGO | Reg. No: ${this.org.regNumber}`, 150, 85)
       .text(`Address: ${this.org.address}`, 150, 100)
       .text(`Phone: ${this.org.phone} | Email: ${this.org.email}`, 150, 115)
       .text(this.org.website, 150, 130);

    // Add horizontal line
    doc.moveTo(50, 160)
       .lineTo(545, 160)
       .stroke();

    doc.y = 180;
  }

  /**
   * Add receipt title and number
   */
  addReceiptTitle(doc) {
    doc.fontSize(18)
       .font('Helvetica-Bold')
       .text('PAYMENT RECEIPT', 50, doc.y, { align: 'center' });
    
    doc.y += 30;
  }

  /**
   * Add payment details section
   */
  addPaymentDetails(doc, paymentData) {
    const startY = doc.y;
    
    // Receipt details box
    doc.rect(50, startY, 495, 120)
       .stroke();

    doc.fontSize(14)
       .font('Helvetica-Bold')
       .text('PAYMENT INFORMATION', 60, startY + 10);

    doc.fontSize(11)
       .font('Helvetica');

    const leftCol = 60;
    const rightCol = 300;
    let currentY = startY + 35;

    // Left column
    doc.text('Receipt Number:', leftCol, currentY)
       .font('Helvetica-Bold')
       .text(paymentData.paymentNumber, leftCol + 100, currentY);
    
    currentY += 20;
    doc.font('Helvetica')
       .text('Payment Date:', leftCol, currentY)
       .font('Helvetica-Bold')
       .text(this.formatDate(paymentData.timeline?.completedAt || paymentData.createdAt), leftCol + 100, currentY);

    currentY += 20;
    doc.font('Helvetica')
       .text('Payment Method:', leftCol, currentY)
       .font('Helvetica-Bold')
       .text(this.formatPaymentMethod(paymentData.method), leftCol + 100, currentY);

    // Right column
    currentY = startY + 35;
    doc.font('Helvetica')
       .text('Application No:', rightCol, currentY)
       .font('Helvetica-Bold')
       .text(paymentData.application?.applicationNumber || 'N/A', rightCol + 100, currentY);

    currentY += 20;
    doc.font('Helvetica')
       .text('Scheme:', rightCol, currentY)
       .font('Helvetica-Bold')
       .text(paymentData.scheme?.name || 'N/A', rightCol + 100, currentY);

    currentY += 20;
    doc.font('Helvetica')
       .text('Project:', rightCol, currentY)
       .font('Helvetica-Bold')
       .text(paymentData.project?.name || 'N/A', rightCol + 100, currentY);

    doc.y = startY + 140;
  }

  /**
   * Add beneficiary details section
   */
  addBeneficiaryDetails(doc, paymentData) {
    const startY = doc.y;
    
    // Beneficiary details box
    doc.rect(50, startY, 495, 100)
       .stroke();

    doc.fontSize(14)
       .font('Helvetica-Bold')
       .text('BENEFICIARY DETAILS', 60, startY + 10);

    doc.fontSize(11)
       .font('Helvetica');

    const leftCol = 60;
    const rightCol = 300;
    let currentY = startY + 35;

    // Left column
    doc.text('Name:', leftCol, currentY)
       .font('Helvetica-Bold')
       .text(paymentData.beneficiary?.name || 'N/A', leftCol + 80, currentY);
    
    currentY += 20;
    doc.font('Helvetica')
       .text('Phone:', leftCol, currentY)
       .font('Helvetica-Bold')
       .text(paymentData.beneficiary?.phone || 'N/A', leftCol + 80, currentY);

    // Right column
    currentY = startY + 35;
    const bankAccount = paymentData.beneficiary?.financial?.bankAccount;
    if (bankAccount) {
      doc.font('Helvetica')
         .text('Account No:', rightCol, currentY)
         .font('Helvetica-Bold')
         .text(`****${bankAccount.accountNumber?.slice(-4) || 'XXXX'}`, rightCol + 80, currentY);

      currentY += 20;
      doc.font('Helvetica')
         .text('Bank:', rightCol, currentY)
         .font('Helvetica-Bold')
         .text(bankAccount.bankName || 'N/A', rightCol + 80, currentY);
    }

    doc.y = startY + 120;
  }

  /**
   * Add financial breakdown section
   */
  addFinancialBreakdown(doc, paymentData) {
    const startY = doc.y;
    
    // Financial breakdown box
    doc.rect(50, startY, 495, 160)
       .stroke();

    doc.fontSize(14)
       .font('Helvetica-Bold')
       .text('FINANCIAL BREAKDOWN', 60, startY + 10);

    doc.fontSize(11);
    let currentY = startY + 40;

    // Amount details
    const amounts = [
      { label: 'Gross Amount:', value: paymentData.amount, bold: false },
      { label: 'Processing Fee:', value: paymentData.financial?.processingFee || 0, bold: false },
      { label: 'Bank Charges:', value: paymentData.financial?.bankCharges || 0, bold: false }
    ];

    // Add TDS if applicable
    if (paymentData.financial?.taxes?.tds?.applicable) {
      amounts.push({
        label: `TDS (${paymentData.financial.taxes.tds.rate}%):`,
        value: paymentData.financial.taxes.tds.amount || 0,
        bold: false
      });
    }

    // Add GST if applicable
    if (paymentData.financial?.taxes?.gst?.applicable) {
      amounts.push({
        label: `GST (${paymentData.financial.taxes.gst.rate}%):`,
        value: paymentData.financial.taxes.gst.amount || 0,
        bold: false
      });
    }

    // Add net amount
    amounts.push({
      label: 'Net Amount Paid:',
      value: paymentData.financial?.netAmount || paymentData.amount,
      bold: true
    });

    // Render amounts
    amounts.forEach((item, index) => {
      const isLast = index === amounts.length - 1;
      
      if (isLast) {
        // Add separator line before net amount
        doc.moveTo(60, currentY - 5)
           .lineTo(535, currentY - 5)
           .stroke();
        currentY += 10;
      }

      doc.font(item.bold ? 'Helvetica-Bold' : 'Helvetica')
         .text(item.label, 60, currentY)
         .text(`₹ ${this.formatAmount(item.value)}`, 450, currentY, { align: 'right' });
      
      currentY += 20;
    });

    // Amount in words
    currentY += 10;
    doc.font('Helvetica')
       .text('Amount in Words:', 60, currentY)
       .font('Helvetica-Bold')
       .text(this.numberToWords(paymentData.financial?.netAmount || paymentData.amount), 60, currentY + 15, {
         width: 475,
         align: 'left'
       });

    doc.y = startY + 180;
  }

  /**
   * Add bank transaction details
   */
  addBankDetails(doc, paymentData) {
    if (paymentData.method === 'bank_transfer' && paymentData.bankTransfer) {
      const startY = doc.y;
      
      // Bank details box
      doc.rect(50, startY, 495, 80)
         .stroke();

      doc.fontSize(14)
         .font('Helvetica-Bold')
         .text('TRANSACTION DETAILS', 60, startY + 10);

      doc.fontSize(11)
         .font('Helvetica');

      let currentY = startY + 35;

      if (paymentData.bankTransfer.transactionId) {
        doc.text('Transaction ID:', 60, currentY)
           .font('Helvetica-Bold')
           .text(paymentData.bankTransfer.transactionId, 160, currentY);
        currentY += 20;
      }

      if (paymentData.bankTransfer.utrNumber) {
        doc.font('Helvetica')
           .text('UTR Number:', 60, currentY)
           .font('Helvetica-Bold')
           .text(paymentData.bankTransfer.utrNumber, 160, currentY);
      }

      doc.y = startY + 100;
    }
  }

  /**
   * Add footer with signatures and terms
   */
  addFooter(doc) {
    const startY = doc.y + 20;
    
    // Signature section
    doc.fontSize(11)
       .font('Helvetica');

    // Authorized signature
    doc.text('Authorized Signature:', 350, startY)
       .moveTo(350, startY + 40)
       .lineTo(500, startY + 40)
       .stroke();

    // Terms and conditions
    doc.fontSize(9)
       .font('Helvetica')
       .text('Terms & Conditions:', 50, startY + 60)
       .text('• This is a computer-generated receipt and does not require a physical signature.', 50, startY + 75)
       .text('• For any queries regarding this payment, please contact our finance department.', 50, startY + 90)
       .text('• This receipt is valid for all official purposes.', 50, startY + 105);

    // Footer
    doc.fontSize(8)
       .font('Helvetica')
       .text(`Generated on: ${this.formatDate(new Date())} | System: ${orgConfig.erpTitle}`, 50, 750, {
         align: 'center'
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