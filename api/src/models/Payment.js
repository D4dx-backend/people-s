const mongoose = require('mongoose');
const Counter = require('./Counter');

const paymentSchema = new mongoose.Schema({
  // Basic Information
  paymentNumber: {
    type: String,
    unique: true,
    required: [true, 'Payment number is required']
  },
  
  // References
  application: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Application',
    required: [true, 'Application is required']
  },
  beneficiary: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Beneficiary',
    required: [true, 'Beneficiary is required']
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: [true, 'Project is required']
  },
  scheme: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Scheme',
    required: [true, 'Scheme is required']
  },
  
  // Payment Details
  amount: {
    type: Number,
    required: [true, 'Payment amount is required'],
    min: [1, 'Payment amount must be at least 1'],
    max: [100000000, 'Payment amount exceeds maximum limit']
  },
  currency: {
    type: String,
    default: 'INR'
  },
  
  // Payment Type and Method
  type: {
    type: String,
    enum: ['full_payment', 'installment', 'advance', 'refund', 'adjustment'],
    required: [true, 'Payment type is required']
  },
  method: {
    type: String,
    enum: ['bank_transfer', 'cheque', 'cash', 'digital_wallet', 'upi'],
    required: [true, 'Payment method is required']
  },
  
  // Installment Information (if applicable)
  installment: {
    number: {
      type: Number,
      min: 1
    },
    totalInstallments: {
      type: Number,
      min: 1
    },
    description: String
  },
  
  // Bank Transfer Details
  bankTransfer: {
    beneficiaryAccount: {
      accountNumber: String,
      ifscCode: String,
      bankName: String,
      branchName: String,
      accountHolderName: String
    },
    senderAccount: {
      accountNumber: String,
      ifscCode: String,
      bankName: String,
      branchName: String
    },
    transactionId: String,
    utrNumber: String,
    transferDate: Date,
    transferMode: {
      type: String,
      enum: ['neft', 'rtgs', 'imps', 'upi']
    }
  },
  
  // Cheque Details
  cheque: {
    chequeNumber: String,
    bankName: String,
    branchName: String,
    issueDate: Date,
    clearanceDate: Date,
    status: {
      type: String,
      enum: ['issued', 'deposited', 'cleared', 'bounced', 'cancelled']
    },
    bouncedReason: String
  },
  
  // Cash Details
  cash: {
    receivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    receiptNumber: String,
    witnessName: String,
    witnessPhone: String,
    location: String,
    handoverDate: Date
  },
  
  // Digital Wallet/UPI Details
  digitalPayment: {
    provider: {
      type: String,
      enum: ['paytm', 'phonepe', 'googlepay', 'amazonpay', 'bhim_upi', 'other']
    },
    transactionId: String,
    upiId: String,
    walletNumber: String,
    transactionDate: Date
  },
  
  // Status and Workflow
  status: {
    type: String,
    enum: ['pending', 'approved', 'processing', 'completed', 'failed', 'cancelled', 'refunded'],
    default: 'pending'
  },
  
  // Approval Workflow
  approvals: [{
    level: {
      type: String,
      enum: ['unit', 'area', 'district', 'state', 'finance']
    },
    approver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    comments: String,
    approvedAt: Date,
    requiredAmount: Number,
    approvedAmount: Number
  }],
  
  // Timeline
  timeline: {
    initiatedAt: {
      type: Date,
      default: Date.now
    },
    approvedAt: Date,
    processedAt: Date,
    completedAt: Date,
    failedAt: Date,
    expectedCompletionDate: Date,
    actualProcessingDays: Number
  },
  
  // Financial Tracking
  financial: {
    processingFee: {
      type: Number,
      default: 0
    },
    bankCharges: {
      type: Number,
      default: 0
    },
    taxes: {
      tds: {
        applicable: Boolean,
        rate: Number,
        amount: Number
      },
      gst: {
        applicable: Boolean,
        rate: Number,
        amount: Number
      }
    },
    netAmount: Number, // Amount after deductions
    totalDeductions: Number
  },
  
  // Documents and Receipts
  documents: [{
    type: {
      type: String,
      enum: ['payment_voucher', 'bank_receipt', 'cheque_copy', 'acknowledgment', 'tax_certificate', 'other']
    },
    name: String,
    url: String,
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Verification and Reconciliation
  verification: {
    status: {
      type: String,
      enum: ['pending', 'verified', 'discrepancy', 'rejected'],
      default: 'pending'
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    verifiedAt: Date,
    verificationNotes: String,
    bankStatementMatched: Boolean,
    beneficiaryConfirmed: Boolean,
    confirmationDate: Date,
    confirmationMethod: {
      type: String,
      enum: ['sms', 'call', 'email', 'in_person']
    }
  },
  
  // Failure and Error Handling
  failure: {
    reason: String,
    errorCode: String,
    errorMessage: String,
    retryCount: {
      type: Number,
      default: 0
    },
    maxRetries: {
      type: Number,
      default: 3
    },
    nextRetryAt: Date,
    canRetry: {
      type: Boolean,
      default: true
    }
  },
  
  // Refund Information (if applicable)
  refund: {
    reason: String,
    refundAmount: Number,
    refundMethod: String,
    refundDate: Date,
    refundTransactionId: String,
    refundedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  
  // Notifications
  notifications: [{
    type: {
      type: String,
      enum: ['sms', 'email', 'push']
    },
    recipient: String,
    message: String,
    status: {
      type: String,
      enum: ['pending', 'sent', 'delivered', 'failed']
    },
    sentAt: Date,
    deliveredAt: Date
  }],
  
  // Audit Trail
  initiatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Additional Metadata
  metadata: {
    batchId: String, // For bulk payments
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium'
    },
    tags: [String],
    notes: String,
    externalReference: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
paymentSchema.index({ paymentNumber: 1 });
paymentSchema.index({ application: 1 });
paymentSchema.index({ beneficiary: 1 });
paymentSchema.index({ project: 1, scheme: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ method: 1 });
paymentSchema.index({ 'timeline.initiatedAt': 1 });
paymentSchema.index({ 'bankTransfer.transactionId': 1 });
paymentSchema.index({ 'cheque.chequeNumber': 1 });
paymentSchema.index({ 'verification.status': 1 });
paymentSchema.index({ 'metadata.batchId': 1 });

// Virtual for processing days
paymentSchema.virtual('processingDays').get(function() {
  if (!this.timeline.initiatedAt) return 0;
  
  const endDate = this.timeline.completedAt || new Date();
  const startDate = this.timeline.initiatedAt;
  
  return Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
});

// Virtual for net payable amount
paymentSchema.virtual('netPayableAmount').get(function() {
  let netAmount = this.amount;
  
  // Subtract processing fee and bank charges
  netAmount -= (this.financial.processingFee || 0);
  netAmount -= (this.financial.bankCharges || 0);
  
  // Subtract taxes
  if (this.financial.taxes.tds.applicable) {
    netAmount -= (this.financial.taxes.tds.amount || 0);
  }
  
  if (this.financial.taxes.gst.applicable) {
    netAmount -= (this.financial.taxes.gst.amount || 0);
  }
  
  return Math.max(0, netAmount);
});

// Virtual for approval status
paymentSchema.virtual('approvalStatus').get(function() {
  if (!this.approvals || this.approvals.length === 0) return 'not_required';
  
  const pendingApprovals = this.approvals.filter(approval => approval.status === 'pending');
  const rejectedApprovals = this.approvals.filter(approval => approval.status === 'rejected');
  
  if (rejectedApprovals.length > 0) return 'rejected';
  if (pendingApprovals.length > 0) return 'pending';
  return 'approved';
});

// Pre-save middleware to generate payment number (atomic via Counter model)
paymentSchema.pre('save', async function(next) {
  if (this.isNew && !this.paymentNumber) {
    try {
      const year = new Date().getFullYear();
      const month = String(new Date().getMonth() + 1).padStart(2, '0');
      
      // Atomic counter-based sequence generation (no race conditions)
      const counterKey = `payment_${year}_${month}`;
      const seq = await Counter.getNextSequence(counterKey);
      
      // Format: PAY_YYYY_MM_SEQUENCE
      const sequence = String(seq).padStart(5, '0');
      this.paymentNumber = `PAY_${year}_${month}_${sequence}`;
      
      next();
    } catch (error) {
      next(error);
    }
  } else {
    next();
  }
});

// Pre-save middleware to calculate financial details
paymentSchema.pre('save', function(next) {
  // Calculate total deductions
  let totalDeductions = 0;
  totalDeductions += (this.financial.processingFee || 0);
  totalDeductions += (this.financial.bankCharges || 0);
  
  if (this.financial.taxes.tds.applicable) {
    totalDeductions += (this.financial.taxes.tds.amount || 0);
  }
  
  if (this.financial.taxes.gst.applicable) {
    totalDeductions += (this.financial.taxes.gst.amount || 0);
  }
  
  this.financial.totalDeductions = totalDeductions;
  this.financial.netAmount = Math.max(0, this.amount - totalDeductions);
  
  // Update processing days
  if (this.timeline.initiatedAt && this.timeline.completedAt) {
    this.timeline.actualProcessingDays = Math.ceil(
      (this.timeline.completedAt - this.timeline.initiatedAt) / (1000 * 60 * 60 * 24)
    );
  }
  
  next();
});

// Method to add approval
paymentSchema.methods.addApproval = function(level, approver, requiredAmount) {
  this.approvals.push({
    level,
    approver,
    status: 'pending',
    requiredAmount,
    approvedAmount: 0
  });
  
  return this.save();
};

// Method to approve payment
paymentSchema.methods.approve = function(approvalId, approver, approvedAmount, comments) {
  const approval = this.approvals.id(approvalId);
  if (!approval) throw new Error('Approval not found');
  
  approval.status = 'approved';
  approval.approver = approver;
  approval.approvedAmount = approvedAmount;
  approval.comments = comments;
  approval.approvedAt = new Date();
  
  // Check if all approvals are complete
  const pendingApprovals = this.approvals.filter(app => app.status === 'pending');
  if (pendingApprovals.length === 0) {
    this.status = 'approved';
    this.timeline.approvedAt = new Date();
  }
  
  return this.save();
};

// Method to reject payment
paymentSchema.methods.reject = function(approvalId, approver, comments) {
  const approval = this.approvals.id(approvalId);
  if (!approval) throw new Error('Approval not found');
  
  approval.status = 'rejected';
  approval.approver = approver;
  approval.comments = comments;
  approval.approvedAt = new Date();
  
  this.status = 'cancelled';
  
  return this.save();
};

// Method to process payment
paymentSchema.methods.process = function(processedBy, transactionDetails) {
  this.status = 'processing';
  this.processedBy = processedBy;
  this.timeline.processedAt = new Date();
  
  // Update transaction details based on payment method
  if (this.method === 'bank_transfer' && transactionDetails.transactionId) {
    this.bankTransfer.transactionId = transactionDetails.transactionId;
    this.bankTransfer.utrNumber = transactionDetails.utrNumber;
    this.bankTransfer.transferDate = new Date();
  }
  
  return this.save();
};

// Method to complete payment
paymentSchema.methods.complete = function(completionDetails = {}) {
  this.status = 'completed';
  this.timeline.completedAt = new Date();
  
  // Update verification status
  this.verification.status = 'verified';
  this.verification.verifiedAt = new Date();
  this.verification.bankStatementMatched = completionDetails.bankStatementMatched || false;
  this.verification.beneficiaryConfirmed = completionDetails.beneficiaryConfirmed || false;
  
  return this.save();
};

// Method to fail payment
paymentSchema.methods.fail = function(reason, errorCode, errorMessage) {
  this.status = 'failed';
  this.timeline.failedAt = new Date();
  
  this.failure.reason = reason;
  this.failure.errorCode = errorCode;
  this.failure.errorMessage = errorMessage;
  this.failure.retryCount++;
  
  // Set next retry time if retries are available
  if (this.failure.retryCount < this.failure.maxRetries) {
    this.failure.nextRetryAt = new Date(Date.now() + (this.failure.retryCount * 60 * 60 * 1000)); // Exponential backoff
  } else {
    this.failure.canRetry = false;
  }
  
  return this.save();
};

// Static method to get payments by status
paymentSchema.statics.getByStatus = function(status, filters = {}) {
  return this.find({ status, ...filters })
    .populate('application', 'applicationNumber')
    .populate('beneficiary', 'personalInfo contact')
    .populate('project', 'name code')
    .populate('scheme', 'name code')
    .sort({ 'timeline.initiatedAt': -1 });
};

// Static method to get pending approvals
paymentSchema.statics.getPendingApprovals = function(userId, level) {
  return this.find({
    'approvals.approver': userId,
    'approvals.status': 'pending',
    'approvals.level': level
  })
    .populate('application', 'applicationNumber')
    .populate('beneficiary', 'personalInfo')
    .sort({ 'timeline.initiatedAt': 1 });
};

// Static method to get payments for reconciliation
paymentSchema.statics.getForReconciliation = function(filters = {}) {
  return this.find({
    status: { $in: ['completed', 'processing'] },
    'verification.status': 'pending',
    ...filters
  })
    .populate('beneficiary', 'personalInfo contact financial.bankAccount')
    .sort({ 'timeline.completedAt': 1 });
};

module.exports = mongoose.model('Payment', paymentSchema);