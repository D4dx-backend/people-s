const mongoose = require('mongoose');
const franchisePlugin = require('../utils/franchisePlugin');

const interviewSchema = new mongoose.Schema({
  // Application Reference
  application: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Application',
    required: true
  },
  
  // Interview Details
  interviewNumber: {
    type: String
  },
  
  // Scheduling Information
  scheduledDate: {
    type: Date,
    required: true
  },
  scheduledTime: {
    type: String,
    required: true
  },
  
  // Interview Type and Location
  type: {
    type: String,
    enum: ['offline', 'online'],
    required: true,
    default: 'offline'
  },
  location: {
    type: String
  },
  meetingLink: {
    type: String
  },
  
  // Interview Status
  status: {
    type: String,
    enum: ['scheduled', 'completed', 'cancelled', 'rescheduled'],
    default: 'scheduled'
  },
  
  // Interviewers
  interviewers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  // Interview Results
  result: {
    type: String,
    enum: ['pending', 'passed', 'failed'],
    default: 'pending'
  },
  
  // Notes and Comments
  notes: {
    type: String
  },
  interviewerComments: {
    type: String
  },
  
  // Completion Information
  completedAt: {
    type: Date
  },
  completedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Rescheduling Information
  originalInterview: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Interview'
  },
  rescheduleReason: {
    type: String
  },
  rescheduleCount: {
    type: Number,
    default: 0
  },
  
  // Scheduling Information
  scheduledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  scheduledAt: {
    type: Date,
    default: Date.now
  },
  
  // Metadata
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
  timestamps: true
});

// Indexes for better performance
interviewSchema.index({ application: 1 });
interviewSchema.index({ interviewNumber: 1 });
interviewSchema.index({ scheduledDate: 1 });
interviewSchema.index({ status: 1 });
interviewSchema.index({ result: 1 });
interviewSchema.index({ scheduledBy: 1 });
interviewSchema.index({ createdAt: -1 });

// Pre-save middleware to generate interview number
interviewSchema.pre('save', async function(next) {
  if (this.isNew && !this.interviewNumber) {
    try {
      const count = await this.constructor.countDocuments();
      const year = new Date().getFullYear();
      this.interviewNumber = `INT${year}${String(count + 1).padStart(6, '0')}`;
    } catch (error) {
      console.error('Error generating interview number:', error);
      // Fallback to timestamp-based number
      const timestamp = Date.now().toString().slice(-6);
      this.interviewNumber = `INT${new Date().getFullYear()}${timestamp}`;
    }
  }
  next();
});

// Virtual for getting interview history
interviewSchema.virtual('history', {
  ref: 'Interview',
  localField: '_id',
  foreignField: 'originalInterview'
});

// Method to reschedule interview
interviewSchema.methods.reschedule = async function(newData, rescheduleReason, userId) {
  // Mark current interview as rescheduled
  this.status = 'rescheduled';
  this.rescheduleReason = rescheduleReason;
  this.updatedBy = userId;
  await this.save();
  
  // Create new interview with updated details
  const newInterview = new this.constructor({
    application: this.application,
    franchise: this.franchise,
    scheduledDate: newData.scheduledDate,
    scheduledTime: newData.scheduledTime,
    type: newData.type || this.type,
    location: newData.location,
    meetingLink: newData.meetingLink,
    interviewers: newData.interviewers || this.interviewers,
    notes: newData.notes,
    originalInterview: this._id,
    rescheduleCount: this.rescheduleCount + 1,
    scheduledBy: userId,
    createdBy: userId
  });
  
  return await newInterview.save();
};

// Method to complete interview
interviewSchema.methods.complete = async function(result, comments, userId) {
  this.status = 'completed';
  this.result = result;
  this.interviewerComments = comments;
  this.completedAt = new Date();
  this.completedBy = userId;
  this.updatedBy = userId;
  
  return await this.save();
};

// Method to cancel interview
interviewSchema.methods.cancel = async function(reason, userId) {
  this.status = 'cancelled';
  this.rescheduleReason = reason;
  this.updatedBy = userId;
  
  return await this.save();
};

// Static method to get interview history for an application
interviewSchema.statics.getApplicationHistory = function(applicationId) {
  return this.find({ application: applicationId })
    .populate('scheduledBy', 'name')
    .populate('completedBy', 'name')
    .populate('interviewers', 'name')
    .populate('originalInterview', 'interviewNumber scheduledDate')
    .sort({ createdAt: -1 });
};

// Static method to get active interview for an application
interviewSchema.statics.getActiveInterview = function(applicationId) {
  return this.findOne({ 
    application: applicationId, 
    status: 'scheduled' 
  })
    .populate('scheduledBy', 'name')
    .populate('interviewers', 'name');
};

// Franchise multi-tenancy — compound unique per franchise
interviewSchema.plugin(franchisePlugin);
interviewSchema.index({ interviewNumber: 1, franchise: 1 }, { unique: true });

module.exports = mongoose.model('Interview', interviewSchema);