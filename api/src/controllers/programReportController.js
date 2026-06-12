const { ProgramReport, Scheme } = require('../models');
const ResponseHelper = require('../utils/responseHelper');
const {
  buildFranchiseReadFilter,
  getWriteFranchiseId
} = require('../utils/franchiseFilterHelper');
const fileUploadService = require('../services/fileUploadService');
const { isImageMime, compressImageBuffer } = require('../services/imageCompressionService');
const path = require('path');

const MAX_PHOTOS = ProgramReport.MAX_PHOTOS || 5;
const COORDINATOR_ROLES = ['unit_admin', 'area_admin', 'district_admin', 'area_president'];

// ── Helpers ───────────────────────────────────────────────────────────────────

const effectiveRole = (req) =>
  req.userRole || req.user?.role;

const isSuperAdmin = (req) =>
  req.user?.isSuperAdmin || req.userRole === 'super_admin' || req.user?.role === 'super_admin';

const isStateAdmin = (req) =>
  effectiveRole(req) === 'state_admin';

// Admin viewers can see every coordinator's report (super / state admin)
const isAdminViewer = (req) => isSuperAdmin(req) || isStateAdmin(req);

/**
 * Derive the coordinator's location (area/unit/district) from their
 * franchise-scoped admin scope. Returns an ObjectId or null.
 */
function deriveCoordinatorLocation(req) {
  const scope = req.userFranchise?.adminScope;
  if (!scope) return null;
  return scope.unit || scope.area || scope.district || null;
}

/**
 * Compress (if image) and upload a single multer memory file, returning a
 * photo subdocument ready to be pushed onto a ProgramReport.
 */
async function uploadPhoto(file, folder) {
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
    uploadedAt: new Date()
  };
}

/**
 * Validate that an optional scheme id exists within the caller's franchise.
 * Returns the scheme id or null. Throws (statusCode 400) on invalid id.
 */
async function resolveScheme(req, schemeId) {
  if (!schemeId) return null;
  const scheme = await Scheme.findOne({
    _id: schemeId,
    ...buildFranchiseReadFilter(req)
  }).select('_id').lean();
  if (!scheme) {
    const err = new Error('Selected scheme not found');
    err.statusCode = 400;
    throw err;
  }
  return scheme._id;
}

const POPULATE = [
  { path: 'scheme', select: 'name' },
  { path: 'location', select: 'name type code' },
  { path: 'submittedBy', select: 'name email role' }
];

// ── List / Read ─────────────────────────────────────────────────────────────

/**
 * GET /api/program-reports
 * super_admin / state_admin: every report (filters: scheme, location, search,
 *   submitterRole, date range).
 * coordinators (unit/area/district/area president admin): only their own reports.
 */
exports.getProgramReports = async (req, res) => {
  try {
    const {
      scheme, location, submitterRole, search,
      from, to,
      sortBy = 'createdAt', sortOrder = 'desc',
      page = 1, limit = 20
    } = req.query;

    const filter = { ...buildFranchiseReadFilter(req) };

    if (!isAdminViewer(req)) {
      // Coordinators only ever see what they uploaded
      filter.submittedBy = req.user._id;
    }

    if (scheme) {
      filter.scheme = scheme === 'none' ? { $exists: false } : scheme;
    }
    if (location) filter.location = location;
    if (submitterRole) filter.submitterRole = submitterRole;

    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { news: { $regex: search, $options: 'i' } }
      ];
    }

    const allowedSortFields = ['createdAt', 'updatedAt', 'title'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const sortDir = sortOrder === 'asc' ? 1 : -1;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [reports, total] = await Promise.all([
      ProgramReport.find(filter)
        .populate(POPULATE)
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
    const filter = { _id: req.params.id, ...buildFranchiseReadFilter(req) };
    if (!isAdminViewer(req)) filter.submittedBy = req.user._id;

    const report = await ProgramReport.findOne(filter).populate(POPULATE).lean();
    if (!report) return ResponseHelper.error(res, 'Program report not found', 404);

    return ResponseHelper.success(res, { report });
  } catch (error) {
    console.error('getProgramReportById error:', error);
    return ResponseHelper.error(res, 'Failed to fetch program report', 500);
  }
};

// ── Create / Update / Delete ──────────────────────────────────────────────────

/**
 * POST /api/program-reports
 * Coordinators upload a program report. Accepts multipart with up to
 * MAX_PHOTOS image files in the `photos` field plus text fields:
 *   title (required), news, scheme (optional), location (optional override).
 * Images are compressed via sharp before upload to the CDN.
 */
exports.createProgramReport = async (req, res) => {
  try {
    const userRole = effectiveRole(req);
    if (!COORDINATOR_ROLES.includes(userRole)) {
      return ResponseHelper.error(res, 'Only area coordinators can upload program reports', 403);
    }

    const { title, news, scheme, location } = req.body;

    if (!title || !title.trim()) {
      return ResponseHelper.error(res, 'Title is required', 400);
    }

    const files = req.files || [];
    if (files.length > MAX_PHOTOS) {
      return ResponseHelper.error(res, `You can upload at most ${MAX_PHOTOS} photos`, 400);
    }

    const schemeId = await resolveScheme(req, scheme);
    const locationId = location || deriveCoordinatorLocation(req) || undefined;
    const franchiseId = getWriteFranchiseId(req);

    // Compress + upload photos first so a failed upload doesn't leave a record
    const folder = `program-reports/${req.user._id}`;
    const photos = [];
    for (const file of files) {
      photos.push(await uploadPhoto(file, folder));
    }

    const report = await ProgramReport.create({
      title: title.trim(),
      news: news?.trim(),
      scheme: schemeId || undefined,
      location: locationId,
      photos,
      submittedBy: req.user._id,
      submitterRole: userRole,
      franchise: franchiseId
    });

    const populated = await ProgramReport.findById(report._id).populate(POPULATE).lean();

    return ResponseHelper.success(res, { report: populated }, 'Program report uploaded successfully', 201);
  } catch (error) {
    if (error.statusCode === 400) {
      return ResponseHelper.error(res, error.message, 400);
    }
    console.error('createProgramReport error:', error);
    return ResponseHelper.error(res, 'Failed to upload program report', 500);
  }
};

/**
 * PUT /api/program-reports/:id
 * Owner-only. Updates the text fields (title, news, scheme, location).
 * Photos are managed through the dedicated photo endpoints.
 */
exports.updateProgramReport = async (req, res) => {
  try {
    const report = await ProgramReport.findOne({
      _id: req.params.id,
      submittedBy: req.user._id,
      ...buildFranchiseReadFilter(req)
    });

    if (!report) return ResponseHelper.error(res, 'Program report not found', 404);

    const { title, news, scheme, location } = req.body;

    if (title !== undefined) {
      if (!title.trim()) return ResponseHelper.error(res, 'Title cannot be empty', 400);
      report.title = title.trim();
    }
    if (news !== undefined) report.news = news?.trim();
    if (scheme !== undefined) {
      report.scheme = (await resolveScheme(req, scheme)) || undefined;
    }
    if (location !== undefined) report.location = location || undefined;

    await report.save();

    const populated = await ProgramReport.findById(report._id).populate(POPULATE).lean();
    return ResponseHelper.success(res, { report: populated }, 'Program report updated successfully');
  } catch (error) {
    if (error.statusCode === 400) {
      return ResponseHelper.error(res, error.message, 400);
    }
    console.error('updateProgramReport error:', error);
    return ResponseHelper.error(res, 'Failed to update program report', 500);
  }
};

/**
 * DELETE /api/program-reports/:id
 * Owner OR admin viewer (super / state admin). Cleans up CDN photos.
 */
exports.deleteProgramReport = async (req, res) => {
  try {
    const filter = { _id: req.params.id, ...buildFranchiseReadFilter(req) };
    if (!isAdminViewer(req)) filter.submittedBy = req.user._id;

    const report = await ProgramReport.findOne(filter);
    if (!report) return ResponseHelper.error(res, 'Program report not found', 404);

    const keys = (report.photos || []).map(p => p.key).filter(Boolean);
    if (keys.length > 0) {
      await fileUploadService.deleteMultipleFiles(keys).catch(err =>
        console.error('Photo cleanup error on program report delete:', err)
      );
    }

    await report.deleteOne();

    return ResponseHelper.success(res, null, 'Program report deleted successfully');
  } catch (error) {
    console.error('deleteProgramReport error:', error);
    return ResponseHelper.error(res, 'Failed to delete program report', 500);
  }
};

// ── Photos ────────────────────────────────────────────────────────────────────

/**
 * POST /api/program-reports/:id/photos
 * Owner-only. Adds one or more photos (compressed via sharp), enforcing the
 * MAX_PHOTOS cap across the whole report.
 */
exports.addPhotos = async (req, res) => {
  try {
    const report = await ProgramReport.findOne({
      _id: req.params.id,
      submittedBy: req.user._id,
      ...buildFranchiseReadFilter(req)
    });

    if (!report) return ResponseHelper.error(res, 'Program report not found', 404);

    const files = req.files || [];
    if (files.length === 0) {
      return ResponseHelper.error(res, 'No photos provided', 400);
    }

    const remaining = MAX_PHOTOS - report.photos.length;
    if (files.length > remaining) {
      return ResponseHelper.error(
        res,
        `Only ${remaining} more photo(s) can be added (max ${MAX_PHOTOS} per report)`,
        400
      );
    }

    const folder = `program-reports/${req.user._id}`;
    const uploaded = [];
    for (const file of files) {
      uploaded.push(await uploadPhoto(file, folder));
    }

    report.photos.push(...uploaded);
    await report.save();

    const savedPhotos = report.photos.slice(-uploaded.length);

    return ResponseHelper.success(
      res,
      { photos: savedPhotos, total: report.photos.length },
      `${uploaded.length} photo(s) uploaded successfully`
    );
  } catch (error) {
    console.error('addPhotos error:', error);
    return ResponseHelper.error(res, 'Failed to upload photos', 500);
  }
};

/**
 * DELETE /api/program-reports/:id/photos/:photoId
 * Owner-only. Removes a single photo by its _id and deletes it from the CDN.
 */
exports.deletePhoto = async (req, res) => {
  try {
    const { photoId } = req.params;

    const report = await ProgramReport.findOne({
      _id: req.params.id,
      submittedBy: req.user._id,
      ...buildFranchiseReadFilter(req)
    });

    if (!report) return ResponseHelper.error(res, 'Program report not found', 404);

    const photo = report.photos.id(photoId);
    if (!photo) return ResponseHelper.error(res, 'Photo not found', 404);

    if (photo.key) {
      await fileUploadService.deleteFile(photo.key).catch(err =>
        console.error('CDN delete error for program report photo:', err)
      );
    }

    photo.deleteOne();
    await report.save();

    return ResponseHelper.success(res, { total: report.photos.length }, 'Photo deleted successfully');
  } catch (error) {
    console.error('deletePhoto error:', error);
    return ResponseHelper.error(res, 'Failed to delete photo', 500);
  }
};
