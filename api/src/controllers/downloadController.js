const { Download } = require('../models');
const fileUploadService = require('../services/fileUploadService');
const ResponseHelper = require('../utils/responseHelper');
const { buildFranchiseReadFilter, getWriteFranchiseId } = require('../utils/franchiseFilterHelper');

// Roles that can see every download regardless of targeting
const SUPER_ROLES = ['super_admin', 'state_admin'];

/**
 * Collect the location ids the current user is scoped to.
 */
function getUserLocationIds(req) {
  const scope = req.userFranchise?.adminScope;
  if (!scope) return [];
  const ids = [];
  if (scope.district) ids.push(scope.district);
  if (scope.area) ids.push(scope.area);
  if (scope.unit) ids.push(scope.unit);
  if (Array.isArray(scope.regions)) ids.push(...scope.regions);
  return ids.filter(Boolean);
}

class DownloadController {
  /**
   * Create a download entry (file already uploaded via /api/upload)
   * POST /api/downloads
   */
  async create(req, res) {
    try {
      const {
        title,
        description,
        category,
        fileUrl,
        fileKey,
        fileName,
        mimetype,
        size,
        targeting
      } = req.body;

      if (!title || !title.trim()) {
        return ResponseHelper.error(res, 'Title is required', 400);
      }
      if (!fileUrl || !fileKey || !fileName) {
        return ResponseHelper.error(res, 'A file must be uploaded', 400);
      }

      const download = await Download.create({
        title: title.trim(),
        description: description || '',
        category: category || 'general',
        fileUrl,
        fileKey,
        fileName,
        mimetype: mimetype || '',
        size: size || 0,
        targeting: {
          userRoles: Array.isArray(targeting?.userRoles) ? targeting.userRoles : [],
          locationIds: Array.isArray(targeting?.locationIds) ? targeting.locationIds : []
        },
        createdBy: req.user._id,
        franchise: getWriteFranchiseId(req)
      });

      return ResponseHelper.success(res, { download }, 'File added to downloads', 201);
    } catch (error) {
      return ResponseHelper.error(res, error.message || 'Failed to create download', 500);
    }
  }

  /**
   * Admin list of all downloads in the franchise
   * GET /api/downloads
   */
  async list(req, res) {
    try {
      const filter = { ...buildFranchiseReadFilter(req) };
      const downloads = await Download.find(filter)
        .sort({ createdAt: -1 })
        .populate('createdBy', 'name');
      return ResponseHelper.success(res, { downloads }, 'Downloads retrieved');
    } catch (error) {
      return ResponseHelper.error(res, error.message || 'Failed to fetch downloads', 500);
    }
  }

  /**
   * Files available to the current user (role + location gated)
   * GET /api/downloads/available
   */
  async available(req, res) {
    try {
      const filter = {
        isActive: true,
        ...buildFranchiseReadFilter(req)
      };

      const isSuper = SUPER_ROLES.includes(req.userRole) || req.user?.isSuperAdmin;
      if (!isSuper) {
        const role = req.userRole;
        const locationIds = getUserLocationIds(req);

        filter.$and = [
          // role gate: empty targeting roles = available to all
          { $or: [{ 'targeting.userRoles': { $size: 0 } }, { 'targeting.userRoles': role }] },
          // location gate: empty targeting locations = no location restriction
          {
            $or: [
              { 'targeting.locationIds': { $size: 0 } },
              ...(locationIds.length ? [{ 'targeting.locationIds': { $in: locationIds } }] : [])
            ]
          }
        ];
      }

      const downloads = await Download.find(filter)
        .sort({ createdAt: -1 })
        .select('-__v');
      return ResponseHelper.success(res, { downloads }, 'Available downloads retrieved');
    } catch (error) {
      return ResponseHelper.error(res, error.message || 'Failed to fetch downloads', 500);
    }
  }

  /**
   * Get a single download
   * GET /api/downloads/:id
   */
  async getById(req, res) {
    try {
      const filter = { _id: req.params.id, ...buildFranchiseReadFilter(req) };
      const download = await Download.findOne(filter).populate('createdBy', 'name');
      if (!download) {
        return ResponseHelper.error(res, 'Download not found', 404);
      }
      return ResponseHelper.success(res, { download }, 'Download retrieved');
    } catch (error) {
      return ResponseHelper.error(res, error.message || 'Failed to fetch download', 500);
    }
  }

  /**
   * Update a download's metadata / targeting
   * PUT /api/downloads/:id
   */
  async update(req, res) {
    try {
      const filter = { _id: req.params.id, ...buildFranchiseReadFilter(req) };
      const download = await Download.findOne(filter);
      if (!download) {
        return ResponseHelper.error(res, 'Download not found', 404);
      }

      const { title, description, category, isActive, targeting } = req.body;
      if (title !== undefined) download.title = title;
      if (description !== undefined) download.description = description;
      if (category !== undefined) download.category = category;
      if (isActive !== undefined) download.isActive = isActive;
      if (targeting) {
        download.targeting = {
          userRoles: Array.isArray(targeting.userRoles) ? targeting.userRoles : [],
          locationIds: Array.isArray(targeting.locationIds) ? targeting.locationIds : []
        };
      }
      download.updatedBy = req.user._id;
      await download.save();

      return ResponseHelper.success(res, { download }, 'Download updated');
    } catch (error) {
      return ResponseHelper.error(res, error.message || 'Failed to update download', 500);
    }
  }

  /**
   * Record a download (increment counter)
   * POST /api/downloads/:id/track
   */
  async track(req, res) {
    try {
      const filter = { _id: req.params.id, ...buildFranchiseReadFilter(req) };
      await Download.updateOne(filter, { $inc: { downloadCount: 1 } });
      return ResponseHelper.success(res, null, 'Download tracked');
    } catch (error) {
      return ResponseHelper.error(res, error.message || 'Failed to track download', 500);
    }
  }

  /**
   * Delete a download (and remove the file from storage)
   * DELETE /api/downloads/:id
   */
  async remove(req, res) {
    try {
      const filter = { _id: req.params.id, ...buildFranchiseReadFilter(req) };
      const download = await Download.findOne(filter);
      if (!download) {
        return ResponseHelper.error(res, 'Download not found', 404);
      }

      if (download.fileKey) {
        try {
          await fileUploadService.deleteFile(download.fileKey);
        } catch (e) {
          console.error('⚠️ Failed to delete file from storage:', e.message);
        }
      }

      await Download.deleteOne({ _id: download._id });
      return ResponseHelper.success(res, null, 'Download deleted');
    } catch (error) {
      return ResponseHelper.error(res, error.message || 'Failed to delete download', 500);
    }
  }
}

module.exports = new DownloadController();
