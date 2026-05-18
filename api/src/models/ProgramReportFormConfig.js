const mongoose = require('mongoose');
const franchisePlugin = require('../utils/franchisePlugin');

// ── Field & Page sub-schemas (mirrors AdminReportFormConfig.js) ───────────────

const fieldSchema = new mongoose.Schema({
  id: { type: Number, required: true },
  label: {
    type: String,
    required: [true, 'Field label is required'],
    trim: true,
    maxlength: [200, 'Field label cannot exceed 200 characters']
  },
  type: {
    type: String,
    required: [true, 'Field type is required'],
    enum: ['text', 'email', 'phone', 'number', 'date', 'datetime', 'textarea',
           'select', 'radio', 'checkbox', 'file', 'url', 'password',
           'title', 'html', 'group', 'page', 'row', 'column',
           'dropdown', 'multiselect', 'yesno', 'time']
  },
  required: { type: Boolean, default: false },
  enabled: { type: Boolean, default: true },
  placeholder: { type: String, maxlength: [500, 'Placeholder cannot exceed 500 characters'] },
  helpText: { type: String, maxlength: [1000, 'Help text cannot exceed 1000 characters'] },
  options: [{ type: String, maxlength: [200, 'Option text cannot exceed 200 characters'] }],
  validation: {
    pattern: String,
    minLength: Number,
    maxLength: Number,
    min: Number,
    max: Number,
    customMessage: String
  },
  columns: { type: Number, min: 1, default: 12 },
  columnTitles: [{ type: String, maxlength: [200, 'Column title cannot exceed 200 characters'] }],
  rows: { type: Number, min: 1 },
  rowTitles: [{ type: String, maxlength: [200, 'Row title cannot exceed 200 characters'] }],
  firstColumnHeader: {
    type: String,
    maxlength: [200, 'First column header cannot exceed 200 characters'],
    default: ''
  },
  conditionalLogic: {
    field: Number,
    operator: {
      type: String,
      enum: ['equals', 'not_equals', 'contains', 'not_contains', 'greater_than', 'less_than', 'is_empty', 'is_not_empty']
    },
    value: String,
    action: {
      type: String,
      enum: ['show', 'hide', 'require', 'optional'],
      default: 'show'
    }
  },
  scoring: {
    enabled: { type: Boolean, default: false },
    maxPoints: { type: Number, min: 0, default: 0 },
    scoringRules: [{
      condition: {
        type: String,
        enum: ['equals', 'not_equals', 'greater_than', 'less_than', 'between',
               'contains', 'is_not_empty', 'is_uploaded', 'before', 'after', 'includes'],
        required: true
      },
      value: { type: String, default: '' },
      value2: String,
      points: { type: Number, required: true, min: 0 }
    }]
  }
}, { _id: false });

const pageSchema = new mongoose.Schema({
  id: { type: Number, required: true },
  title: {
    type: String,
    required: [true, 'Page title is required'],
    trim: true,
    maxlength: [200, 'Page title cannot exceed 200 characters']
  },
  description: { type: String, maxlength: [1000, 'Page description cannot exceed 1000 characters'] },
  fields: [fieldSchema],
  order: { type: Number, default: 0 },
  conditionalLogic: {
    field: Number,
    operator: {
      type: String,
      enum: ['equals', 'not_equals', 'contains', 'not_contains', 'greater_than', 'less_than', 'is_empty', 'is_not_empty']
    },
    value: String
  }
}, { _id: false });

// ── Main schema ───────────────────────────────────────────────────────────────

const programReportFormConfigSchema = new mongoose.Schema({
  programReport: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProgramReport',
    required: [true, 'ProgramReport reference is required']
  },
  title: {
    type: String,
    required: [true, 'Form title is required'],
    trim: true,
    maxlength: [300, 'Form title cannot exceed 300 characters']
  },
  description: {
    type: String,
    maxlength: [2000, 'Form description cannot exceed 2000 characters']
  },
  enabled: { type: Boolean, default: true },
  emailNotifications: { type: Boolean, default: false },
  allowDrafts: { type: Boolean, default: true },
  pages: [pageSchema],
  theme: {
    primaryColor: { type: String, default: '#3b82f6' },
    backgroundColor: { type: String, default: '#ffffff' },
    fontFamily: { type: String, default: 'Inter' },
    customCSS: String
  },
  submissionSettings: {
    confirmationMessage: {
      type: String,
      default: 'Thank you for submitting the program report.'
    },
    notificationEmails: [String]
  },
  analytics: {
    totalViews: { type: Number, default: 0 },
    totalSubmissions: { type: Number, default: 0 }
  },
  scoringConfig: {
    enabled: { type: Boolean, default: false },
    minimumThreshold: { type: Number, min: 0, max: 100, default: 0 },
    autoRejectBelowThreshold: { type: Boolean, default: false },
    showScoreToAdmin: { type: Boolean, default: true }
  },
  version: { type: Number, default: 1 },
  isPublished: { type: Boolean, default: false },
  publishedAt: Date,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  lastModified: { type: Date, default: Date.now }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

programReportFormConfigSchema.plugin(franchisePlugin);
programReportFormConfigSchema.index({ programReport: 1, franchise: 1 }, { unique: true });
programReportFormConfigSchema.index({ isPublished: 1 });
programReportFormConfigSchema.index({ lastModified: -1 });

// After saving, mark the parent ProgramReport.hasFormConfiguration = true
programReportFormConfigSchema.post('save', async function () {
  try {
    const ProgramReport = mongoose.model('ProgramReport');
    await ProgramReport.findByIdAndUpdate(this.programReport, { hasFormConfiguration: true });
  } catch (err) {
    console.error('ProgramReportFormConfig post-save hook error:', err);
  }
});

// Virtuals
programReportFormConfigSchema.virtual('totalFields').get(function () {
  return this.pages.reduce((total, page) => total + page.fields.length, 0);
});

programReportFormConfigSchema.virtual('requiredFields').get(function () {
  return this.pages.reduce((total, page) =>
    total + page.fields.filter(f => f.required).length, 0);
});

const ProgramReportFormConfig = mongoose.model('ProgramReportFormConfig', programReportFormConfigSchema);

/**
 * Build the 4 pre-seeded default fields for a new form config.
 * Admins can edit or remove these via the form builder.
 */
ProgramReportFormConfig.buildDefaultPages = function (reportTitle) {
  return [
    {
      id: 1,
      title: 'Program Details',
      description: '',
      order: 0,
      fields: [
        { id: 1, type: 'text',     label: 'Program Title',       required: true,  enabled: true, columns: 12 },
        { id: 2, type: 'textarea', label: 'Program Description',  required: true,  enabled: true, columns: 12 },
        { id: 3, type: 'date',     label: 'Program Date',         required: true,  enabled: true, columns: 12 },
        { id: 4, type: 'text',     label: 'Program Venue',        required: true,  enabled: true, columns: 12 }
      ]
    }
  ];
};

module.exports = ProgramReportFormConfig;
