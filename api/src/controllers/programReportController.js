const { ProgramReport, ProgramReportFormConfig, ProgramReportSubmission } = require('../models');
const ResponseHelper = require('../utils/responseHelper');
const {
  buildFranchiseReadFilter,
  getWriteFranchiseId
} = require('../utils/franchiseFilterHelper');
const fileUploadService = require('../services/fileUploadService');
const { isImageMime, compressImageBuffer } = require('../services/imageCompressionService');
const path = require('path');

// ── Helpers ───────────────────────────────────────────────────────────────────

const isSuperAdmin = (req) =>
  req.user?.isSuperAdmin || req.userRole === 'super_admin' || req.user?.role === 'super_admin';

const isStateAdmin = (req) =>
  effectiveRole(req) === 'state_admin';

const effectiveRole = (req) =>
  req.userRole || req.user?.role;

const SUBMITTER_ROLES = ['unit_admin', 'area_admin', 'district_admin'];

/**
 * Derive the attachment "kind" from a mimetype string.
 */
function resolveKind(mimetype) {
  const m = (mimetype || '').toLowerCase();
  if (m.startsWith('image/')) return 'image';
  if (m.startsWith('video/')) return 'video';
  if (m === 'application/pdf') return 'pdf';
  return 'other';
}

// ── Report CRUD ───────────────────────────────────────────────────────────────

/**
 * GET /api/program-reports
 * super_admin / state_admin: all (with filters).
 * unit/area/district admin: only active + published reports targeting their role.
 */
exports.getProgramReports = async (req, res) => {
  try {
    const {
      targetUserType, status, search,
      district, area, unit,
      sortBy = 'createdAt', sortOrder = 'desc',
      page = 1, limit = 20
    } = req.query;

    const filter = { ...buildFranchiseReadFilter(req) };
    const userRole = effectiveRole(req);
    const skip = (parseInt(page) - 1) * parseInt(limit);

    if (isSuperAdmin(req) || isStateAdmin(req)) {
      // Full visibility
      if (targetUserType) filter.targetUserType = targetUserType;
      if (status) filter.status = status;
    } else {
      // Field admins: only active published reports for their role
      filter.targetUserType = userRole;
      filter.status = 'active';
      filter.isFormPublished = true;
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    if (isSuperAdmin(req) || isStateAdmin(req)) {
      const locationIds = [district, area, unit].filter(Boolean);
      if (locationIds.length > 0) {
        filter.$or = [
          ...(filter.$or || []),
          { targetLocations: { $in: locationIds } },
          { targetLocations: { $size: 0 } },
          { targetLocations: { $exists: false } }
        ];
      }
    }

    const sortDir = sortOrder === 'asc' ? 1 : -1;
    const allowedSortFields = ['createdAt', 'updatedAt', 'title', 'status', 'targetUserType'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';

    const [reports, total] = await Promise.all([
      ProgramReport.find(filter)
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email')
        .populate('targetLocations', 'name type code')
        .sort({ [sortField]: sortDir })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      ProgramReport.countDocuments(filter)
    ]);

    return ResponseHelper.success(res, {
      reports,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('getProgramReports error:', error);
    return ResponseHelper.error(res, 'Failed to fetch program reports', 500);
  }
};

/**
 * GET /api/program-reports/:id
 */
exports.getProgramReportById = async (req, res) => {
  try {
    const report = await ProgramReport.findOne({
      _id: req.params.id,
      ...buildFranchiseReadFilter(req)
    })
      .populate('createdBy', 'name email')
      .populate('targetLocations', 'name type code')
      .lean();

    if (!report) return ResponseHelper.error(res, 'Program report not found', 404);

    // Field admins: only active reports for their role
    if (!isSuperAdmin(req) && !isStateAdmin(req)) {
      const userRole = effectiveRole(req);
      if (report.status !== 'active' || report.targetUserType !== userRole) {
        return ResponseHelper.error(res, 'Program report not found', 404);
      }
    }

    return ResponseHelper.success(res, { report });
  } catch (error) {
    console.error('getProgramReportById error:', error);
    return ResponseHelper.error(res, 'Failed to fetch program report', 500);
  }
};

/**
 * POST /api/program-reports  (super_admin only)
 */
exports.createProgramReport = async (req, res) => {
  try {
    if (!isSuperAdmin(req)) {
      return ResponseHelper.error(res, 'Access denied', 403);
    }

    const { title, description, targetUserType, targetLocations, status } = req.body;

    if (!title || !targetUserType) {
      return ResponseHelper.error(res, 'Title and target user type are required', 400);
    }

    if (!SUBMITTER_ROLES.includes(targetUserType)) {
      return ResponseHelper.error(
        res,
        `targetUserType must be one of: ${SUBMITTER_ROLES.join(', ')}`,
        400
      );
    }

    const franchiseId = getWriteFranchiseId(req);

    const report = await ProgramReport.create({
      title: title.trim(),
      description: description?.trim(),
      targetUserType,
      targetLocations: targetLocations || [],
      status: status || 'draft',
      createdBy: req.user._id,
      franchise: franchiseId
    });

    return ResponseHelper.success(res, { report }, 'Program report created successfully', 201);
  } catch (error) {
    console.error('createProgramReport error:', error);
    return ResponseHelper.error(res, 'Failed to create program report', 500);
  }
};

/**
 * PUT /api/program-reports/:id  (super_admin only)
 */
exports.updateProgramReport = async (req, res) => {
  try {
    if (!isSuperAdmin(req)) {
      return ResponseHelper.error(res, 'Access denied', 403);
    }

    const report = await ProgramReport.findOne({
      _id: req.params.id,
      ...buildFranchiseReadFilter(req)
    });

    if (!report) return ResponseHelper.error(res, 'Program report not found', 404);

    const { title, description, targetUserType, targetLocations, status } = req.body;

    if (targetUserType !== undefined && !SUBMITTER_ROLES.includes(targetUserType)) {
      return ResponseHelper.error(
        res,
        `targetUserType must be one of: ${SUBMITTER_ROLES.join(', ')}`,
        400
      );
    }

    if (title !== undefined) report.title = title.trim();
    if (description !== undefined) report.description = description?.trim();
    if (targetUserType !== undefined) report.targetUserType = targetUserType;
    if (targetLocations !== undefined) report.targetLocations = targetLocations;
    if (status !== undefined) report.status = status;
    report.updatedBy = req.user._id;

    await report.save();

    return ResponseHelper.success(res, { report }, 'Program report updated successfully');
  } catch (error) {
    console.error('updateProgramReport error:', error);
    return ResponseHelper.error(res, 'Failed to update program report', 500);
  }
};

/**
 * DELETE /api/program-reports/:id  (super_admin only)
 * Blocked if any submitted submissions exist.
 */
exports.deleteProgramReport = async (req, res) => {
  try {
    if (!isSuperAdmin(req)) {
      return ResponseHelper.error(res, 'Access denied', 403);
    }

    const report = await ProgramReport.findOne({
      _id: req.params.id,
      ...buildFranchiseReadFilter(req)
    });

    if (!report) return ResponseHelper.error(res, 'Program report not found', 404);

    const submissionCount = await ProgramReportSubmission.countDocuments({
      programReport: report._id,
      status: 'submitted'
    });

    if (submissionCount > 0) {
      return ResponseHelper.error(
        res,
        `Cannot delete program report: ${submissionCount} submission(s) already exist.`,
        400
      );
    }

    // Gather all attachment keys for cleanup
    const draftSubmissions = await ProgramReportSubmission.find({
      programReport: report._id
    }).lean();

    const attachmentKeys = draftSubmissions.flatMap(s =>
      (s.attachments || []).map(a => a.key)
    ).filter(Boolean);

    if (attachmentKeys.length > 0) {
      await fileUploadService.deleteMultipleFiles(attachmentKeys).catch(err =>
        console.error('Attachment cleanup error during program report delete:', err)
      );
    }

    await Promise.all([
      ProgramReportSubmission.deleteMany({ programReport: report._id }),
      ProgramReportFormConfig.deleteMany({ programReport: report._id }),
      report.deleteOne()
    ]);

    return ResponseHelper.success(res, null, 'Program report deleted successfully');
  } catch (error) {
    console.error('deleteProgramReport error:', error);
    return ResponseHelper.error(res, 'Failed to delete program report', 500);
  }
};

// ── Form Configuration ────────────────────────────────────────────────────────

/**
 * GET /api/program-reports/:id/form-config
 */
exports.getFormConfig = async (req, res) => {
  try {
    const report = await ProgramReport.findOne({
      _id: req.params.id,
      ...buildFranchiseReadFilter(req)
    }).lean();

    if (!report) return ResponseHelper.error(res, 'Program report not found', 404);

    // Field admins can only view form config for active reports targeting them
    if (!isSuperAdmin(req) && !isStateAdmin(req)) {
      const userRole = effectiveRole(req);
      if (report.status !== 'active' || report.targetUserType !== userRole) {
        return ResponseHelper.error(res, 'Access denied', 403);
      }
    }

    let formConfig = await ProgramReportFormConfig.findOne({
      programReport: req.params.id,
      ...buildFranchiseReadFilter(req)
    })
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

    // If no form config exists yet, auto-create one with pre-seeded default fields
    if (!formConfig && isSuperAdmin(req)) {
      const franchiseId = getWriteFranchiseId(req);
      formConfig = await ProgramReportFormConfig.create({
        programReport: report._id,
        title: report.title,
        description: report.description || '',
        pages: ProgramReportFormConfig.buildDefaultPages(report.title),
        isPublished: false,
        version: 1,
        lastModified: new Date(),
        createdBy: req.user._id,
        franchise: franchiseId
      });
    }

    if (!formConfig) {
      return ResponseHelper.success(res, { formConfiguration: null, hasConfiguration: false });
    }

    return ResponseHelper.success(res, { formConfiguration: formConfig, hasConfiguration: true });
  } catch (error) {
    console.error('getFormConfig error:', error);
    return ResponseHelper.error(res, 'Failed to fetch form configuration', 500);
  }
};

/**
 * PUT /api/program-reports/:id/form-config  (super_admin only)
 * Upserts the form configuration.
 */
exports.updateFormConfig = async (req, res) => {
  try {
    if (!isSuperAdmin(req)) {
      return ResponseHelper.error(res, 'Access denied', 403);
    }

    const report = await ProgramReport.findOne({
      _id: req.params.id,
      ...buildFranchiseReadFilter(req)
    });

    if (!report) return ResponseHelper.error(res, 'Program report not found', 404);

    const { title, description, pages, enabled, emailNotifications,
            allowDrafts, theme, submissionSettings, scoringConfig } = req.body;

    if (!title) return ResponseHelper.error(res, 'Form title is required', 400);
    if (!pages || !Array.isArray(pages)) {
      return ResponseHelper.error(res, 'Pages array is required', 400);
    }

    const franchiseId = getWriteFranchiseId(req);

    let formConfig = await ProgramReportFormConfig.findOne({
      programReport: report._id,
      ...buildFranchiseReadFilter(req)
    });

    if (formConfig) {
      formConfig.title = title.trim();
      if (description !== undefined) formConfig.description = description;
      formConfig.pages = pages;
      if (enabled !== undefined) formConfig.enabled = enabled;
      if (emailNotifications !== undefined) formConfig.emailNotifications = emailNotifications;
      if (allowDrafts !== undefined) formConfig.allowDrafts = allowDrafts;
      if (theme) formConfig.theme = { ...formConfig.theme.toObject?.() || formConfig.theme, ...theme };
      if (submissionSettings) formConfig.submissionSettings = submissionSettings;
      if (scoringConfig) formConfig.scoringConfig = scoringConfig;
      formConfig.version = (formConfig.version || 1) + 1;
      formConfig.lastModified = new Date();
      formConfig.updatedBy = req.user._id;
      await formConfig.save();
    } else {
      formConfig = await ProgramReportFormConfig.create({
        programReport: report._id,
        title: title.trim(),
        description,
        pages,
        enabled: enabled !== undefined ? enabled : true,
        emailNotifications: emailNotifications !== undefined ? emailNotifications : false,
        allowDrafts: allowDrafts !== undefined ? allowDrafts : true,
        theme,
        submissionSettings,
        scoringConfig,
        isPublished: false,
        version: 1,
        lastModified: new Date(),
        createdBy: req.user._id,
        franchise: franchiseId
      });
    }

    return ResponseHelper.success(res, { formConfiguration: formConfig }, 'Form configuration saved');
  } catch (error) {
    console.error('updateFormConfig error:', error);
    return ResponseHelper.error(res, 'Failed to save form configuration', 500);
  }
};

/**
 * PATCH /api/program-reports/:id/form-config/publish  (super_admin only)
 */
exports.publishFormConfig = async (req, res) => {
  try {
    if (!isSuperAdmin(req)) {
      return ResponseHelper.error(res, 'Access denied', 403);
    }

    const formConfig = await ProgramReportFormConfig.findOne({
      programReport: req.params.id,
      ...buildFranchiseReadFilter(req)
    });

    if (!formConfig) {
      return ResponseHelper.error(res, 'Form configuration not found', 404);
    }

    const { isPublished } = req.body;
    formConfig.isPublished = typeof isPublished === 'boolean' ? isPublished : !formConfig.isPublished;
    if (formConfig.isPublished) formConfig.publishedAt = new Date();
    formConfig.updatedBy = req.user._id;
    await formConfig.save();

    await ProgramReport.findByIdAndUpdate(req.params.id, {
      isFormPublished: formConfig.isPublished
    });

    return ResponseHelper.success(
      res,
      { isPublished: formConfig.isPublished, publishedAt: formConfig.publishedAt },
      `Form ${formConfig.isPublished ? 'published' : 'unpublished'} successfully`
    );
  } catch (error) {
    console.error('publishFormConfig error:', error);
    return ResponseHelper.error(res, 'Failed to update publish status', 500);
  }
};

// ── Submissions ───────────────────────────────────────────────────────────────

/**
 * GET /api/program-reports/:id/submissions
 * super_admin / state_admin: all with filters.
 * Field admins: only their own.
 */
exports.getSubmissions = async (req, res) => {
  try {
    const { district, area, unit, status, page = 1, limit = 20 } = req.query;

    const report = await ProgramReport.findOne({
      _id: req.params.id,
      ...buildFranchiseReadFilter(req)
    }).lean();

    if (!report) return ResponseHelper.error(res, 'Program report not found', 404);

    const filter = {
      programReport: req.params.id,
      ...buildFranchiseReadFilter(req)
    };

    if (isSuperAdmin(req) || isStateAdmin(req)) {
      if (status) filter.status = status;
      const locationIds = [district, area, unit].filter(Boolean);
      if (locationIds.length > 0) filter.location = { $in: locationIds };
    } else {
      filter.submittedBy = req.user._id;
      if (status) filter.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [submissions, total] = await Promise.all([
      ProgramReportSubmission.find(filter)
        .populate('submittedBy', 'name email role')
        .populate('location', 'name type code')
        .sort({ submittedAt: -1, updatedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      ProgramReportSubmission.countDocuments(filter)
    ]);

    return ResponseHelper.success(res, {
      submissions,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('getSubmissions error:', error);
    return ResponseHelper.error(res, 'Failed to fetch submissions', 500);
  }
};

/**
 * POST /api/program-reports/:id/submissions
 * Create or update a draft submission (upsert, one draft per user per report).
 * state_admin cannot submit.
 */
exports.saveSubmission = async (req, res) => {
  try {
    const { formData, location } = req.body;
    const userRole = effectiveRole(req);

    if (isStateAdmin(req)) {
      return ResponseHelper.error(res, 'State admin cannot submit program reports', 403);
    }

    const report = await ProgramReport.findOne({
      _id: req.params.id,
      ...buildFranchiseReadFilter(req)
    }).lean();

    if (!report) return ResponseHelper.error(res, 'Program report not found', 404);

    if (!isSuperAdmin(req)) {
      if (report.status !== 'active') {
        return ResponseHelper.error(res, 'This program report is not accepting submissions', 400);
      }
      if (report.targetUserType !== userRole) {
        return ResponseHelper.error(res, 'You are not authorised to submit this report', 403);
      }
    }

    const franchiseId = getWriteFranchiseId(req);

    if (!isSuperAdmin(req)) {
      const alreadySubmitted = await ProgramReportSubmission.findOne({
        programReport: req.params.id,
        submittedBy: req.user._id,
        status: 'submitted',
        ...buildFranchiseReadFilter(req)
      });
      if (alreadySubmitted) {
        return ResponseHelper.error(res, 'You have already submitted this program report', 400);
      }
    }

    const submission = await ProgramReportSubmission.findOneAndUpdate(
      {
        programReport: req.params.id,
        submittedBy: req.user._id,
        status: 'draft',
        ...buildFranchiseReadFilter(req)
      },
      {
        $set: {
          formData: formData || {},
          submitterRole: userRole,
          location: location || undefined,
          franchise: franchiseId
        },
        $setOnInsert: {
          programReport: req.params.id,
          submittedBy: req.user._id
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return ResponseHelper.success(res, { submission }, 'Draft saved');
  } catch (error) {
    console.error('saveSubmission error:', error);
    return ResponseHelper.error(res, 'Failed to save submission', 500);
  }
};

/**
 * PATCH /api/program-reports/:id/submissions/:submissionId/submit
 * Finalise a submission.
 */
exports.submitSubmission = async (req, res) => {
  try {
    const { submissionId } = req.params;

    if (isStateAdmin(req)) {
      return ResponseHelper.error(res, 'State admin cannot submit program reports', 403);
    }

    const submission = await ProgramReportSubmission.findOne({
      _id: submissionId,
      programReport: req.params.id,
      submittedBy: req.user._id,
      ...buildFranchiseReadFilter(req)
    });

    if (!submission) {
      return ResponseHelper.error(res, 'Submission not found', 404);
    }

    if (submission.status === 'submitted') {
      return ResponseHelper.error(res, 'This submission has already been submitted', 400);
    }

    const otherSubmitted = await ProgramReportSubmission.findOne({
      programReport: req.params.id,
      submittedBy: req.user._id,
      status: 'submitted',
      _id: { $ne: submission._id },
      ...buildFranchiseReadFilter(req)
    });
    if (otherSubmitted) {
      return ResponseHelper.error(res, 'You have already submitted this program report', 400);
    }

    if (req.body.formData) {
      submission.formData = req.body.formData;
    }

    submission.status = 'submitted';
    submission.submittedAt = new Date();
    await submission.save();

    await ProgramReportFormConfig.findOneAndUpdate(
      { programReport: req.params.id },
      { $inc: { 'analytics.totalSubmissions': 1 } }
    );

    return ResponseHelper.success(res, { submission }, 'Program report submitted successfully');
  } catch (error) {
    console.error('submitSubmission error:', error);
    return ResponseHelper.error(res, 'Failed to submit program report', 500);
  }
};

/**
 * PATCH /api/program-reports/:id/submissions/:submissionId
 * Update formData on an existing submission. Owner only.
 */
exports.updateSubmission = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const { formData } = req.body;

    const submission = await ProgramReportSubmission.findOne({
      _id: submissionId,
      programReport: req.params.id,
      submittedBy: req.user._id,
      ...buildFranchiseReadFilter(req)
    });

    if (!submission) {
      return ResponseHelper.error(res, 'Submission not found', 404);
    }

    if (formData !== undefined) {
      submission.formData = formData;
    }
    if (submission.status === 'submitted') {
      submission.submittedAt = new Date();
    }
    await submission.save();

    return ResponseHelper.success(res, { submission }, 'Submission updated successfully');
  } catch (error) {
    console.error('updateSubmission error:', error);
    return ResponseHelper.error(res, 'Failed to update submission', 500);
  }
};

/**
 * DELETE /api/program-reports/:id/submissions/:submissionId
 * Delete a submission and clean up its attachments. Owner only.
 */
exports.deleteSubmission = async (req, res) => {
  try {
    const { submissionId } = req.params;

    const submission = await ProgramReportSubmission.findOne({
      _id: submissionId,
      programReport: req.params.id,
      submittedBy: req.user._id,
      ...buildFranchiseReadFilter(req)
    });

    if (!submission) {
      return ResponseHelper.error(res, 'Submission not found', 404);
    }

    const wasSubmitted = submission.status === 'submitted';

    // Delete CDN attachments
    const keys = (submission.attachments || []).map(a => a.key).filter(Boolean);
    if (keys.length > 0) {
      await fileUploadService.deleteMultipleFiles(keys).catch(err =>
        console.error('Attachment cleanup error on submission delete:', err)
      );
    }

    await submission.deleteOne();

    if (wasSubmitted) {
      await ProgramReportFormConfig.findOneAndUpdate(
        { programReport: req.params.id },
        { $inc: { 'analytics.totalSubmissions': -1 } }
      );
    }

    return ResponseHelper.success(res, null, 'Submission deleted successfully');
  } catch (error) {
    console.error('deleteSubmission error:', error);
    return ResponseHelper.error(res, 'Failed to delete submission', 500);
  }
};

// ── Attachments ───────────────────────────────────────────────────────────────

/**
 * POST /api/program-reports/:id/submissions/:submissionId/attachments
 * Upload one or more files.  Images are compressed via sharp before upload.
 * Videos and PDFs are uploaded as-is.
 * Uses multer memory storage (req.files[] is populated before this handler is called).
 */
exports.uploadAttachments = async (req, res) => {
  try {
    const { submissionId } = req.params;

    const submission = await ProgramReportSubmission.findOne({
      _id: submissionId,
      programReport: req.params.id,
      submittedBy: req.user._id,
      ...buildFranchiseReadFilter(req)
    });

    if (!submission) {
      return ResponseHelper.error(res, 'Submission not found', 404);
    }

    if (!req.files || req.files.length === 0) {
      return ResponseHelper.error(res, 'No files provided', 400);
    }

    const folder = `program-reports/${req.params.id}/${submissionId}`;

    const uploadResults = await Promise.all(
      req.files.map(async (file) => {
        let buffer = file.buffer;
        let mimetype = file.mimetype;
        let ext = path.extname(file.originalname).replace('.', '').toLowerCase() || 'bin';

        if (isImageMime(mimetype)) {
          const compressed = await compressImageBuffer(buffer, mimetype);
          buffer = compressed.buffer;
          mimetype = compressed.mimetype;
          ext = compressed.ext;
        }

        const result = await fileUploadService.uploadFileFromBuffer(
          buffer,
          file.originalname,
          mimetype,
          ext,
          folder,
          file.size
        );

        return {
          url: result.url,
          key: result.key,
          fileName: result.fileName,
          mimetype: result.mimetype,
          size: result.size,
          kind: resolveKind(result.mimetype),
          uploadedAt: new Date()
        };
      })
    );

    // Append to existing attachments
    submission.attachments.push(...uploadResults);
    await submission.save();

    // Return the saved subdocs (with _id) from the end of the array
    const savedAttachments = submission.attachments.slice(-uploadResults.length);

    return ResponseHelper.success(
      res,
      { attachments: savedAttachments, total: submission.attachments.length },
      `${uploadResults.length} file(s) uploaded successfully`
    );
  } catch (error) {
    console.error('uploadAttachments error:', error);
    return ResponseHelper.error(res, 'Failed to upload attachments', 500);
  }
};

/**
 * DELETE /api/program-reports/:id/submissions/:submissionId/attachments/:attachmentId
 * Remove a single attachment by its _id, also deletes from CDN.
 */
exports.deleteAttachment = async (req, res) => {
  try {
    const { submissionId, attachmentId } = req.params;

    const submission = await ProgramReportSubmission.findOne({
      _id: submissionId,
      programReport: req.params.id,
      submittedBy: req.user._id,
      ...buildFranchiseReadFilter(req)
    });

    if (!submission) {
      return ResponseHelper.error(res, 'Submission not found', 404);
    }

    const attachment = submission.attachments.id(attachmentId);
    if (!attachment) {
      return ResponseHelper.error(res, 'Attachment not found', 404);
    }

    // Delete from CDN
    if (attachment.key) {
      await fileUploadService.deleteFile(attachment.key).catch(err =>
        console.error('CDN delete error for attachment:', err)
      );
    }

    attachment.deleteOne();
    await submission.save();

    return ResponseHelper.success(res, null, 'Attachment deleted successfully');
  } catch (error) {
    console.error('deleteAttachment error:', error);
    return ResponseHelper.error(res, 'Failed to delete attachment', 500);
  }
};
