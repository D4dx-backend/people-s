const mongoose = require('mongoose');

const donorFollowUpSchema = new mongoose.Schema({
  // References
  donor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Donor',
    required: true
  },
  donation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Donation',
    default: null
  },

  // Follow-up type
  type: {
    type: String,
    enum: ['recurring_reminder', 'annual_reminder', 'lapsed_followup', 'thank_you', 'custom'],
    required: true
  },

  // Status tracking
  status: {
    type: String,
    enum: [
      'scheduled',           // Waiting for reminder dates
      'sent_first_reminder', // 7-day reminder sent
      'sent_final_reminder', // Due-date reminder sent
      'completed',           // Donor made the donation or manually completed
      'overdue',             // Past due date but within lapse window
      'lapsed',              // 30+ days past due
      'cancelled'            // Manually cancelled
    ],
    default: 'scheduled'
  },

  // Scheduling
  nextDueDate: {
    type: Date,
    required: true,
    index: true
  },
  frequency: {
    type: String,
    enum: ['monthly', 'quarterly', 'half_yearly', 'yearly', 'custom', 'one_time'],
    required: true
  },
  customIntervalDays: {
    type: Number,
    min: 1,
    default: null
  },

  // Reminder dates (pre-calculated for efficient querying)
  firstReminderDate: {
    type: Date,
    index: true
  },
  finalReminderDate: {
    type: Date,
    index: true
  },
  lapsedDate: {
    type: Date,
    index: true
  },

  // Expected amount (from donor preferences or last donation)
  expectedAmount: {
    type: Number,
    min: 0,
    default: 0
  },

  // Reminder history
  reminders: [{
    sentAt: {
      type: Date,
      default: Date.now
    },
    channel: {
      type: String,
      enum: ['whatsapp', 'sms', 'in_app', 'push', 'manual_call', 'manual_visit']
    },
    messageId: String,
    status: {
      type: String,
      enum: ['sent', 'delivered', 'read', 'failed'],
      default: 'sent'
    },
    reminderType: {
      type: String,
      enum: ['first_reminder', 'final_reminder', 'lapsed_notice', 'custom'],
      default: 'first_reminder'
    },
    sentBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    notes: String
  }],

  // Staff assignment
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  assignedAt: Date,
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // Notes and follow-up details
  notes: String,
  staffNotes: [{
    note: String,
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Tracking
  lastReminderSent: Date,
  completedAt: Date,
  completedDonation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Donation'
  },

  // Audit
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for efficient querying by the reminder service
donorFollowUpSchema.index({ status: 1, firstReminderDate: 1 });
donorFollowUpSchema.index({ status: 1, finalReminderDate: 1 });
donorFollowUpSchema.index({ status: 1, lapsedDate: 1 });
donorFollowUpSchema.index({ donor: 1, status: 1 });
donorFollowUpSchema.index({ assignedTo: 1, status: 1 });
donorFollowUpSchema.index({ nextDueDate: 1, status: 1 });
donorFollowUpSchema.index({ createdAt: -1 });

// Virtual for days until due
donorFollowUpSchema.virtual('daysUntilDue').get(function() {
  if (!this.nextDueDate) return null;
  const now = new Date();
  const diff = this.nextDueDate.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

// Virtual for is overdue
donorFollowUpSchema.virtual('isOverdue').get(function() {
  if (!this.nextDueDate) return false;
  return new Date() > this.nextDueDate && !['completed', 'cancelled', 'lapsed'].includes(this.status);
});

// Pre-save: calculate reminder dates
donorFollowUpSchema.pre('save', function(next) {
  if (this.isModified('nextDueDate') || this.isNew) {
    const dueDate = new Date(this.nextDueDate);
    
    // First reminder: 7 days before due date
    this.firstReminderDate = new Date(dueDate.getTime() - (7 * 24 * 60 * 60 * 1000));
    
    // Final reminder: on the due date
    this.finalReminderDate = new Date(dueDate);
    
    // Lapsed date: 30 days after due date
    this.lapsedDate = new Date(dueDate.getTime() + (30 * 24 * 60 * 60 * 1000));
  }
  next();
});

/**
 * Calculate the next due date based on frequency
 * @param {Date} fromDate - Base date to calculate from
 * @param {string} frequency - Frequency type
 * @param {number} customDays - Custom interval in days (for 'custom' frequency)
 * @returns {Date} Next due date
 */
donorFollowUpSchema.statics.calculateNextDueDate = function(fromDate, frequency, customDays = null) {
  const date = new Date(fromDate);
  
  switch (frequency) {
    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      break;
    case 'quarterly':
      date.setMonth(date.getMonth() + 3);
      break;
    case 'half_yearly':
      date.setMonth(date.getMonth() + 6);
      break;
    case 'yearly':
    case 'one_time': // One-time donors get an annual reminder
      date.setFullYear(date.getFullYear() + 1);
      break;
    case 'custom':
      if (customDays && customDays > 0) {
        date.setDate(date.getDate() + customDays);
      } else {
        date.setFullYear(date.getFullYear() + 1); // Default to yearly
      }
      break;
    default:
      date.setFullYear(date.getFullYear() + 1);
  }
  
  return date;
};

/**
 * Get follow-ups that need first reminder (7 days before due)
 */
donorFollowUpSchema.statics.getFirstReminderDue = function() {
  const now = new Date();
  return this.find({
    status: 'scheduled',
    firstReminderDate: { $lte: now },
    nextDueDate: { $gt: now } // Not yet past due
  })
    .populate('donor', 'name email phone communicationPreferences donationStats')
    .populate('donation', 'amount method donationNumber')
    .populate('assignedTo', 'name email phone');
};

/**
 * Get follow-ups that need final reminder (on due date)
 */
donorFollowUpSchema.statics.getFinalReminderDue = function() {
  const now = new Date();
  return this.find({
    status: 'sent_first_reminder',
    finalReminderDate: { $lte: now }
  })
    .populate('donor', 'name email phone communicationPreferences donationStats')
    .populate('donation', 'amount method donationNumber')
    .populate('assignedTo', 'name email phone');
};

/**
 * Get follow-ups that should be marked as lapsed (30 days overdue)
 */
donorFollowUpSchema.statics.getLapsedDue = function() {
  const now = new Date();
  return this.find({
    status: { $in: ['sent_first_reminder', 'sent_final_reminder', 'overdue'] },
    lapsedDate: { $lte: now }
  })
    .populate('donor', 'name email phone communicationPreferences donationStats')
    .populate('donation', 'amount method donationNumber')
    .populate('assignedTo', 'name email phone');
};

/**
 * Get overdue follow-ups (past due but not yet lapsed)
 */
donorFollowUpSchema.statics.getOverdue = function() {
  const now = new Date();
  return this.find({
    status: { $in: ['sent_first_reminder', 'sent_final_reminder'] },
    nextDueDate: { $lt: now },
    lapsedDate: { $gt: now }
  })
    .populate('donor', 'name email phone communicationPreferences donationStats')
    .populate('donation', 'amount method donationNumber')
    .populate('assignedTo', 'name email phone');
};

module.exports = mongoose.model('DonorFollowUp', donorFollowUpSchema);
