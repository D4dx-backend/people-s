const PDFReceiptService = require('../services/pdfReceiptService');
const Payment = require('../models/Payment');
const path = require('path');
const fs = require('fs');

class PDFReceiptController {
  constructor() {
    this.pdfService = new PDFReceiptService();
  }

  /**
   * Generate and download PDF receipt for a payment
   */
  async generateReceipt(req, res) {
    try {
      const paymentId = req.params.id;

      // Fetch payment with all populated references
      const payment = await Payment.findById(paymentId)
        .populate('application', 'applicationNumber')
        .populate('beneficiary', 'name phone personalInfo financial')
        .populate('project', 'name code')
        .populate('scheme', 'name code')
        .populate('initiatedBy', 'name')
        .populate('processedBy', 'name');

      if (!payment) {
        return res.status(404).json({
          success: false,
          message: 'Payment not found',
          timestamp: new Date().toISOString()
        });
      }

      // Check if payment is completed
      if (payment.status !== 'completed') {
        return res.status(400).json({
          success: false,
          message: 'Receipt can only be generated for completed payments',
          timestamp: new Date().toISOString()
        });
      }

      // Generate PDF receipt
      const pdfPath = await this.pdfService.generatePaymentReceipt(payment);

      // Set response headers for PDF download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="receipt-${payment.paymentNumber}.pdf"`);

      // Stream the PDF file
      const fileStream = fs.createReadStream(pdfPath);
      fileStream.pipe(res);

      // Clean up file after sending
      fileStream.on('end', () => {
        // Delete the generated PDF after streaming to prevent disk space accumulation
        try {
          if (fs.existsSync(pdfPath)) {
            fs.unlinkSync(pdfPath);
          }
        } catch (cleanupErr) {
          console.error('Warning: Failed to clean up receipt file:', cleanupErr.message);
        }
      });

    } catch (error) {
      console.error('❌ Error generating PDF receipt:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate PDF receipt',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Generate receipt and return file path (for internal use)
   */
  async generateReceiptFile(req, res) {
    try {
      const paymentId = req.params.id;

      const payment = await Payment.findById(paymentId)
        .populate('application', 'applicationNumber')
        .populate('beneficiary', 'name phone personalInfo financial')
        .populate('project', 'name code')
        .populate('scheme', 'name code')
        .populate('initiatedBy', 'name')
        .populate('processedBy', 'name');

      if (!payment) {
        return res.status(404).json({
          success: false,
          message: 'Payment not found',
          timestamp: new Date().toISOString()
        });
      }

      if (payment.status !== 'completed') {
        return res.status(400).json({
          success: false,
          message: 'Receipt can only be generated for completed payments',
          timestamp: new Date().toISOString()
        });
      }

      const pdfPath = await this.pdfService.generatePaymentReceipt(payment);
      const fileName = path.basename(pdfPath);

      res.json({
        success: true,
        message: 'PDF receipt generated successfully',
        data: {
          fileName,
          filePath: pdfPath,
          paymentNumber: payment.paymentNumber,
          downloadUrl: `/api/payments/${paymentId}/receipt/download`
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Error generating PDF receipt file:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate PDF receipt',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Bulk generate receipts for multiple payments
   */
  async bulkGenerateReceipts(req, res) {
    try {
      const { paymentIds } = req.body;

      if (!paymentIds || !Array.isArray(paymentIds) || paymentIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Payment IDs array is required',
          timestamp: new Date().toISOString()
        });
      }

      const results = [];
      const errors = [];

      for (const paymentId of paymentIds) {
        try {
          const payment = await Payment.findById(paymentId)
            .populate('application', 'applicationNumber')
            .populate('beneficiary', 'name phone personalInfo financial')
            .populate('project', 'name code')
            .populate('scheme', 'name code')
            .populate('initiatedBy', 'name')
            .populate('processedBy', 'name');

          if (!payment) {
            errors.push({ paymentId, error: 'Payment not found' });
            continue;
          }

          if (payment.status !== 'completed') {
            errors.push({ paymentId, error: 'Payment not completed' });
            continue;
          }

          const pdfPath = await this.pdfService.generatePaymentReceipt(payment);
          results.push({
            paymentId,
            paymentNumber: payment.paymentNumber,
            fileName: path.basename(pdfPath),
            filePath: pdfPath
          });

        } catch (error) {
          errors.push({ paymentId, error: error.message });
        }
      }

      res.json({
        success: true,
        message: `Generated ${results.length} receipts successfully`,
        data: {
          generated: results,
          errors: errors,
          summary: {
            total: paymentIds.length,
            successful: results.length,
            failed: errors.length
          }
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Error in bulk receipt generation:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate bulk receipts',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get receipt status for a payment
   */
  async getReceiptStatus(req, res) {
    try {
      const { paymentId } = req.params;

      const payment = await Payment.findById(paymentId).select('paymentNumber status timeline');

      if (!payment) {
        return res.status(404).json({
          success: false,
          message: 'Payment not found',
          timestamp: new Date().toISOString()
        });
      }

      const receiptFileName = `receipt-${payment.paymentNumber}.pdf`;
      const receiptPath = path.join(__dirname, '../services/../../receipts', receiptFileName);
      const receiptExists = fs.existsSync(receiptPath);

      res.json({
        success: true,
        data: {
          paymentId,
          paymentNumber: payment.paymentNumber,
          paymentStatus: payment.status,
          receiptAvailable: payment.status === 'completed',
          receiptGenerated: receiptExists,
          receiptFileName: receiptExists ? receiptFileName : null,
          completedAt: payment.timeline?.completedAt
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Error checking receipt status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to check receipt status',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * List all generated receipts
   */
  async listReceipts(req, res) {
    try {
      const { page = 1, limit = 10, search = '' } = req.query;

      // Build query for completed payments
      const query = { status: 'completed' };
      
      if (search) {
        const searchRegex = new RegExp(search, 'i');
        query.$or = [
          { paymentNumber: searchRegex }
        ];
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const payments = await Payment.find(query)
        .populate('beneficiary', 'name')
        .populate('application', 'applicationNumber')
        .select('paymentNumber amount timeline beneficiary application')
        .sort({ 'timeline.completedAt': -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await Payment.countDocuments(query);

      // Check which receipts exist
      const receiptsDir = path.join(__dirname, '../services/../../receipts');
      const receipts = payments.map(payment => {
        const receiptFileName = `receipt-${payment.paymentNumber}.pdf`;
        const receiptPath = path.join(receiptsDir, receiptFileName);
        const receiptExists = fs.existsSync(receiptPath);

        return {
          paymentId: payment._id,
          paymentNumber: payment.paymentNumber,
          beneficiaryName: payment.beneficiary?.name,
          applicationNumber: payment.application?.applicationNumber,
          amount: payment.amount,
          completedAt: payment.timeline?.completedAt,
          receiptGenerated: receiptExists,
          receiptFileName: receiptExists ? receiptFileName : null,
          downloadUrl: receiptExists ? `/api/payments/${payment._id}/receipt/download` : null
        };
      });

      res.json({
        success: true,
        message: 'Receipts list retrieved successfully',
        data: {
          receipts,
          pagination: {
            current: parseInt(page),
            pages: Math.ceil(total / parseInt(limit)),
            total,
            limit: parseInt(limit),
            hasNext: parseInt(page) * parseInt(limit) < total,
            hasPrev: parseInt(page) > 1
          }
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Error listing receipts:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to list receipts',
        timestamp: new Date().toISOString()
      });
    }
  }
}

module.exports = new PDFReceiptController();