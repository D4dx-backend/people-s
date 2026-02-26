const mongoose = require('mongoose');
const franchisePlugin = require('../utils/franchisePlugin');

const recurringPaymentSchema = new mongoose.Schema({
  // References
  application: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Application',
    required: [true, 'Application reference is required'],
    index: true
  },
  beneficiary: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Beneficiary',
    required: [true, 'Beneficiary reference is required'],
    index: true
  },
  scheme: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Scheme',
    required: [true, 'Scheme reference is required'],
    index: true
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    index: true
  },
  
  // Payment Schedule Information
  paymentNumber: {
    type: Number,
    required: [true, 'Payment number is required'],
    min: 1
  },
  totalPayments: {
    type: Number,
    required: [true, 'Total payments count is required'],
    min: 1
  },
  
  // Cycle and Phase Tracking (for timeline + recurring)
  cycleNumber: {
    type: Number,
    min: 1
  },
  totalCycles: {
    type: Number,
    min: 1
  },
  phaseNumber: {
    type: Number,
    min: 1
  },
  totalPhases: {
    type: Number,
    min: 1
  },
  
  // Dates
  scheduledDate: {
    type: Date,
    required: [true, 'Scheduled date is required'],
    index: true
  },
  dueDate: {
    type: Date,
    index: true
  },
  
  // Amount Information
  amount: {
    type: Number,
    required: [true, 'Payment amount is required'],
    min: 0
  },
  currency: {
    type: String,
    default: 'INR'
  },
  
  // Description
  description: {
    type: String,
    maxlength: 500
  },
  
  // Status Tracking
  status: {
    type: String,
    enum: ['scheduled', 'due', 'overdue', 'processing', 'completed', 'failed', 'skipped', 'cancelled'],
    default: 'scheduled',
    index: true
  },
  
  // Payment Details (when paid)
  actualPaymentDate: {
    type: Date
  },
  payment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment'
  },
  paidAmount: {
    type: Number,
    min: 0
  },
  paymentMethod: {
    type: String,
    enum: ['bank_transfer', 'cheque', 'cash', 'digital_wallet', 'upi']
  },
  transactionReference: {
    type: String
  },
  
  // Notes and Comments
  notes: {
    type: String,
    maxlength: 1000
  },
  
  // Cancellation/Skip Information
  cancellationReason: {
    type: String,
    maxlength: 500
  },
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  cancelledAt: {
    type: Date
  },
  
  // Processing Information
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  processedAt: {
    type: Date
  },
  
  // Reminders & Notifications
  remindersSent: [{
    date: {
      type: Date,
      required: true
    },
    type: {
      type: String,
      enum: ['email', 'sms', 'whatsapp', 'in_app'],
      required: true
    },
    status: {
      type: String,
      enum: ['sent', 'failed', 'delivered', 'read'],
      default: 'sent'
    },
    recipient: {
      type: String
    },
    errorMessage: {
      type: String
    }
  }],
  lastReminderDate: {
    type: Date
  },
  nextReminderDate: {
    type: Date
  },
  
  // Location Information (for filtering and reporting)
  state: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    index: true
  },
  district: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    index: true
  },
  area: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    index: true
  },
  unit: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    index: true
  },
  
  // Metadata
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Compound Indexes for better query performance
// Franchise multi-tenancy
recurringPaymentSchema.plugin(franchisePlugin);
recurringPaymentSchema.index({ application: 1, paymentNumber: 1, franchise: 1 }, { unique: true });
recurringPaymentSchema.index({ status: 1, scheduledDate: 1 });
recurringPaymentSchema.index({ status: 1, dueDate: 1 });
recurringPaymentSchema.index({ beneficiary: 1, status: 1 });
recurringPaymentSchema.index({ scheme: 1, scheduledDate: 1 });
recurringPaymentSchema.index({ project: 1, scheduledDate: 1 });

// Virtual for checking if payment is overdue
recurringPaymentSchema.virtual('isOverdue').get(function() {
  if (this.status === 'scheduled' || this.status === 'due') {
    const now = new Date();
    const dueDate = this.dueDate || this.scheduledDate;
    return now > dueDate;
  }
  return false;
});

// Virtual for days until due
recurringPaymentSchema.virtual('daysUntilDue').get(function() {
  if (this.status === 'scheduled' || this.status === 'due') {
    const now = new Date();
    const dueDate = this.dueDate || this.scheduledDate;
    const diffTime = dueDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }
  return null;
});

// Virtual for days overdue
recurringPaymentSchema.virtual('daysOverdue').get(function() {
  if (this.status === 'overdue') {
    const now = new Date();
    const dueDate = this.dueDate || this.scheduledDate;
    const diffTime = now - dueDate;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }
  return 0;
});

// Method to mark as completed
recurringPaymentSchema.methods.markAsCompleted = function(paymentId, paidAmount, paymentMethod, transactionRef, userId) {
  this.status = 'completed';
  this.actualPaymentDate = new Date();
  this.payment = paymentId;
  this.paidAmount = paidAmount;
  this.paymentMethod = paymentMethod;
  this.transactionReference = transactionRef;
  this.processedBy = userId;
  this.processedAt = new Date();
  this.updatedBy = userId;
  return this.save();
};

// Method to cancel payment
recurringPaymentSchema.methods.cancel = function(reason, userId) {
  this.status = 'cancelled';
  this.cancellationReason = reason;
  this.cancelledBy = userId;
  this.cancelledAt = new Date();
  this.updatedBy = userId;
  return this.save();
};

// Method to skip payment
recurringPaymentSchema.methods.skip = function(reason, userId) {
  this.status = 'skipped';
  this.notes = reason;
  this.updatedBy = userId;
  return this.save();
};

// Method to add reminder
recurringPaymentSchema.methods.addReminder = function(type, status, recipient, errorMessage = null) {
  this.remindersSent.push({
    date: new Date(),
    type,
    status,
    recipient,
    errorMessage
  });
  this.lastReminderDate = new Date();
  return this.save();
};

// Static method to get upcoming payments
recurringPaymentSchema.statics.getUpcomingPayments = function(days = 30) {
  const now = new Date();
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);
  
  return this.find({
    status: { $in: ['scheduled', 'due'] },
    scheduledDate: { $gte: now, $lte: futureDate }
  })
  .populate('application beneficiary scheme project')
  .sort({ scheduledDate: 1 });
};

// Static method to get overdue payments
recurringPaymentSchema.statics.getOverduePayments = function() {
  const now = new Date();
  
  return this.find({
    status: { $in: ['scheduled', 'due', 'overdue'] },
    $or: [
      { dueDate: { $lt: now } },
      { $and: [{ dueDate: null }, { scheduledDate: { $lt: now } }] }
    ]
  })
  .populate('application beneficiary scheme project')
  .sort({ scheduledDate: 1 });
};

// Static method to update overdue statuses
recurringPaymentSchema.statics.updateOverdueStatuses = async function() {
  const now = new Date();
  
  const result = await this.updateMany(
    {
      status: { $in: ['scheduled', 'due'] },
      $or: [
        { dueDate: { $lt: now } },
        { $and: [{ dueDate: null }, { scheduledDate: { $lt: now } }] }
      ]
    },
    {
      $set: { status: 'overdue' }
    }
  );
  
  return result;
};

// Pre-save middleware to calculate due date if not set
recurringPaymentSchema.pre('save', function(next) {
  if (!this.dueDate && this.scheduledDate) {
    // Set due date to 7 days after scheduled date by default
    const dueDate = new Date(this.scheduledDate);
    dueDate.setDate(dueDate.getDate() + 7);
    this.dueDate = dueDate;
  }
  next();
});

// Ensure virtuals are included in JSON
recurringPaymentSchema.set('toJSON', { virtuals: true });
recurringPaymentSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('RecurringPayment', recurringPaymentSchema);
