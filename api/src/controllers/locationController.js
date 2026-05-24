const { Location, User } = require('../models');
const ResponseHelper = require('../utils/responseHelper');

class LocationController {
    /**
     * Get all locations with hierarchy
     * GET /api/locations
     */
    async getLocations(req, res) {
        try {
            const {
                type,
                parent,
                search,
                isActive = true,
                page = 1,
                limit = 10, // Default to 10 items per page
                sort = 'name',
                order = 'asc',
                withPath = 'false'
            } = req.query;

            // Build query based on user's access level
            let query = {};
            const currentUser = req.user;

            // Apply filters
            if (type) query.type = type;
            if (parent) query.parent = parent;
            if (typeof isActive === 'boolean') query.isActive = isActive;

            // Search functionality
            if (search) {
                query.$or = [
                    { name: { $regex: search, $options: 'i' } },
                    { code: { $regex: search, $options: 'i' } }
                ];
            }

            // Regional filtering based on user's admin scope
            if (currentUser.role !== 'super_admin' && currentUser.role !== 'state_admin') {
                if (currentUser.adminScope?.regions?.length > 0) {
                    // Get all children of user's regions
                    const userRegions = await Location.find({
                        _id: { $in: currentUser.adminScope.regions }
                    });

                    const allAccessibleRegions = [];
                    for (const region of userRegions) {
                        allAccessibleRegions.push(region._id);
                        const children = await region.getAllChildren();
                        allAccessibleRegions.push(...children.map(c => c._id));
                    }

                    query._id = { $in: allAccessibleRegions };
                }
            }

            // Pagination
            const skip = (page - 1) * limit;
            const sortOrder = order === 'desc' ? -1 : 1;

            const locations = await Location.find(query)
                .populate('parent', 'name type code')
                .populate('createdBy', 'name')
                .populate('updatedBy', 'name')
                .sort({ [sort]: sortOrder })
                .skip(skip)
                .limit(parseInt(limit));

            const total = await Location.countDocuments(query);

            // Add full path to each location — only when explicitly requested or for small result sets.
            // Skipped by default for large limit queries (e.g. dropdowns with limit=2000) to avoid N+1 slowness.
            const shouldIncludePath = withPath === 'true' || parseInt(limit) <= 50;
            if (shouldIncludePath) {
                for (const location of locations) {
                    location._fullPath = await location.getFullPath();
                }
            }

            res.status(200).json({
                success: true,
                data: {
                    locations,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total,
                        pages: Math.ceil(total / limit)
                    }
                }
            });
        } catch (error) {
            console.error('❌ Get Locations Error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch locations'
            });
        }
    }

    /**
     * Get location hierarchy tree
     * GET /api/locations/hierarchy
     */
    async getHierarchy(req, res) {
        try {
            const { parentId = null } = req.query;
            const currentUser = req.user;

            let tree;

            // If user is not super admin or state admin, filter by their regions
            if (currentUser.role !== 'super_admin' && currentUser.role !== 'state_admin') {
                if (currentUser.adminScope?.regions?.length > 0) {
                    // Get hierarchy starting from user's regions
                    tree = [];
                    for (const regionId of currentUser.adminScope.regions) {
                        const region = await Location.findById(regionId);
                        if (region) {
                            const subtree = await Location.getHierarchyTree(regionId);
                            tree.push({
                                ...region.toObject(),
                                children: subtree
                            });
                        }
                    }
                } else {
                    tree = [];
                }
            } else {
                tree = await Location.getHierarchyTree(parentId);
            }

            res.status(200).json({
                success: true,
                data: { hierarchy: tree }
            });
        } catch (error) {
            console.error('❌ Get Hierarchy Error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch location hierarchy'
            });
        }
    }

    /**
     * Get location by ID
     * GET /api/locations/:id
     */
    async getLocationById(req, res) {
        try {
            const { id } = req.params;
            const currentUser = req.user;

            const location = await Location.findById(id)
                .populate('parent', 'name type code')
                .populate('createdBy', 'name email')
                .populate('updatedBy', 'name email');

            if (!location) {
                return res.status(404).json({
                    success: false,
                    message: 'Location not found'
                });
            }

            // Check access permissions
            if (currentUser.role !== 'super_admin' && currentUser.role !== 'state_admin') {
                const hasAccess = await LocationController.prototype.checkLocationAccess(currentUser, location);
                if (!hasAccess) {
                    return res.status(403).json({
                        success: false,
                        message: 'Access denied. You cannot view this location.'
                    });
                }
            }

            // Add full path
            location._fullPath = await location.getFullPath();

            // Get children count
            const childrenCount = await Location.countDocuments({ parent: id, isActive: true });

            res.status(200).json({
                success: true,
                data: {
                    location: {
                        ...location.toObject(),
                        childrenCount
                    }
                }
            });
        } catch (error) {
            console.error('❌ Get Location By ID Error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch location'
            });
        }
    }

    /**
     * Create new location
     * POST /api/locations
     */
    async createLocation(req, res) {
        try {
            const locationData = req.body;
            const currentUser = req.user;

            // Check permissions
            if (!LocationController.prototype.canManageLocations(currentUser)) {
                return res.status(403).json({
                    success: false,
                    message: 'You are not authorized to create locations'
                });
            }

            // Validate hierarchy if parent is provided
            if (locationData.parent) {
                const parent = await Location.findById(locationData.parent);
                if (!parent) {
                    return res.status(400).json({
                        success: false,
                        message: 'Parent location not found'
                    });
                }

                // Check if user has access to parent location
                if (currentUser.role !== 'super_admin' && currentUser.role !== 'state_admin') {
                    const hasAccess = await LocationController.prototype.checkLocationAccess(currentUser, parent);
                    if (!hasAccess) {
                        return res.status(403).json({
                            success: false,
                            message: 'You cannot create locations under this parent'
                        });
                    }
                }
            }

            // Auto-generate code for districts
            if (locationData.type === 'district' && !locationData.code) {
                locationData.code = locationData.name.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z_]/g, '');
            }

            // Check if code already exists
            if (locationData.code) {
                const existingLocation = await Location.findOne({ code: locationData.code });
                if (existingLocation) {
                    return res.status(400).json({
                        success: false,
                        message: 'Location code already exists'
                    });
                }
            }

            // Create location
            const location = new Location({
                ...locationData,
                createdBy: currentUser._id
            });

            await location.save();

            const newLocation = await Location.findById(location._id)
                .populate('parent', 'name type code')
                .populate('createdBy', 'name');

            res.status(201).json({
                success: true,
                message: 'Location created successfully',
                data: { location: newLocation }
            });
        } catch (error) {
            console.error('❌ Create Location Error:', error);

            if (error.code === 11000) {
                return res.status(400).json({
                    success: false,
                    message: 'Location code already exists'
                });
            }

            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Update location
     * PUT /api/locations/:id
     */
    async updateLocation(req, res) {
        try {
            const { id } = req.params;
            const updates = req.body;
            const currentUser = req.user;

            const location = await Location.findById(id);
            if (!location) {
                return res.status(404).json({
                    success: false,
                    message: 'Location not found'
                });
            }

            // Check permissions
            if (!LocationController.prototype.canManageLocations(currentUser)) {
                return res.status(403).json({
                    success: false,
                    message: 'You are not authorized to update locations'
                });
            }

            // Check access to this specific location
            if (currentUser.role !== 'super_admin' && currentUser.role !== 'state_admin') {
                const hasAccess = await LocationController.prototype.checkLocationAccess(currentUser, location);
                if (!hasAccess) {
                    return res.status(403).json({
                        success: false,
                        message: 'You are not authorized to update this location'
                    });
                }
            }

            // Validate parent change if provided
            if (updates.parent && updates.parent !== location.parent?.toString()) {
                const newParent = await Location.findById(updates.parent);
                if (!newParent) {
                    return res.status(400).json({
                        success: false,
                        message: 'New parent location not found'
                    });
                }

                // Check if user has access to new parent
                if (currentUser.role !== 'super_admin' && currentUser.role !== 'state_admin') {
                    const hasAccess = await LocationController.prototype.checkLocationAccess(currentUser, newParent);
                    if (!hasAccess) {
                        return res.status(403).json({
                            success: false,
                            message: 'You cannot move location to this parent'
                        });
                    }
                }
            }

            // Auto-generate code for districts if name is being updated
            if (location.type === 'district' && updates.name && !updates.code) {
                updates.code = updates.name.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z_]/g, '');
            }

            // Remove sensitive fields that shouldn't be updated
            delete updates.createdBy;
            delete updates.createdAt;

            const updatedLocation = await Location.findByIdAndUpdate(
                id,
                { ...updates, updatedBy: currentUser._id },
                { new: true, runValidators: true }
            )
                .populate('parent', 'name type code')
                .populate('updatedBy', 'name');

            res.status(200).json({
                success: true,
                message: 'Location updated successfully',
                data: { location: updatedLocation }
            });
        } catch (error) {
            console.error('❌ Update Location Error:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Delete location (soft delete)
     * DELETE /api/locations/:id
     */
    async deleteLocation(req, res) {
        try {
            const { id } = req.params;
            const currentUser = req.user;

            const location = await Location.findById(id);
            if (!location) {
                return res.status(404).json({
                    success: false,
                    message: 'Location not found'
                });
            }

            // Check permissions
            if (currentUser.role !== 'super_admin' && currentUser.role !== 'state_admin') {
                return res.status(403).json({
                    success: false,
                    message: 'Only super admin and state admin can delete locations'
                });
            }

            // Check if location has children
            const childrenCount = await Location.countDocuments({ parent: id, isActive: true });
            if (childrenCount > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot delete location with active children. Please delete or move children first.'
                });
            }

            // Soft delete by deactivating
            await Location.findByIdAndUpdate(id, {
                isActive: false,
                deletedAt: new Date(),
                updatedBy: currentUser._id
            });

            res.status(200).json({
                success: true,
                message: 'Location deleted successfully'
            });
        } catch (error) {
            console.error('❌ Delete Location Error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to delete location'
            });
        }
    }

    /**
     * Get location statistics
     * GET /api/locations/statistics
     */
    async getLocationStatistics(req, res) {
        try {
            const currentUser = req.user;

            // Build query based on user's access level
            let matchQuery = { isActive: true };

            if (currentUser.role !== 'super_admin' && currentUser.role !== 'state_admin') {
                if (currentUser.adminScope?.regions?.length > 0) {
                    const userRegions = await Location.find({
                        _id: { $in: currentUser.adminScope.regions }
                    });

                    const allAccessibleRegions = [];
                    for (const region of userRegions) {
                        allAccessibleRegions.push(region._id);
                        const children = await region.getAllChildren();
                        allAccessibleRegions.push(...children.map(c => c._id));
                    }

                    matchQuery._id = { $in: allAccessibleRegions };
                }
            }

            const stats = await Location.aggregate([
                { $match: matchQuery },
                {
                    $group: {
                        _id: '$type',
                        count: { $sum: 1 },
                        active: { $sum: { $cond: ['$isActive', 1, 0] } }
                    }
                }
            ]);

            const totalLocations = await Location.countDocuments(matchQuery);
            const recentLocations = await Location.countDocuments({
                ...matchQuery,
                createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
            });

            res.status(200).json({
                success: true,
                data: {
                    overview: {
                        total: totalLocations,
                        recentlyAdded: recentLocations
                    },
                    byType: stats,
                    lastUpdated: new Date()
                }
            });
        } catch (error) {
            console.error('❌ Get Location Statistics Error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch location statistics'
            });
        }
    }

    /**
     * Get locations by type
     * GET /api/locations/by-type/:type
     */
    async getLocationsByType(req, res) {
        try {
            const { type } = req.params;
            const { parent, active } = req.query;
            const currentUser = req.user;

            console.log('🔍 getLocationsByType called:', {
                type,
                parent,
                active,
                userRole: currentUser.role,
                userId: currentUser._id
            });

            let query = { type };

            // Handle active parameter (can be string "true"/"false" or boolean)
            if (active !== undefined) {
                if (typeof active === 'string') {
                    query.isActive = active.toLowerCase() === 'true';
                } else if (typeof active === 'boolean') {
                    query.isActive = active;
                }
            } else {
                // Default to active locations if not specified
                query.isActive = true;
            }

            if (parent) {
                query.parent = parent;
            }

            // Regional filtering - Allow district_admin, area_admin, unit_admin to see locations
            // They need to see locations for filtering applications
            if (currentUser.role !== 'super_admin' && currentUser.role !== 'state_admin') {
                // For regional admins, we still allow them to see locations
                // but we can optionally filter to their regions if needed
                // For now, let's allow them to see all locations for filtering purposes
                // The actual application filtering will handle regional restrictions
                console.log('🔍 Regional admin accessing locations - allowing access for filtering');
            }

            console.log('🔍 Final query for locations:', JSON.stringify(query, null, 2));

            const locations = await Location.find(query)
                .populate('parent', 'name type code')
                .select('name code type parent isActive contactPerson')
                .sort({ name: 1 });

            console.log('🔍 Locations found:', locations.length);
            console.log('🔍 Sample location:', locations.length > 0 ? {
                _id: locations[0]._id,
                name: locations[0].name,
                type: locations[0].type,
                isActive: locations[0].isActive
            } : 'No locations found');

            // Check total locations in database for this type
            const totalCount = await Location.countDocuments({ type });
            console.log('🔍 Total locations of type', type, 'in database:', totalCount);

            const response = {
                success: true,
                data: { 
                    locations,
                    count: locations.length,
                    totalInDatabase: totalCount
                }
            };

            console.log('✅ Sending response with', locations.length, 'locations');
            res.status(200).json(response);
        } catch (error) {
            console.error('❌ Get Locations By Type Error:', error);
            console.error('❌ Error stack:', error.stack);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch locations by type',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    /**
     * Helper method to check if user can manage locations
     */
    canManageLocations(user) {
        const allowedRoles = ['super_admin', 'state_admin', 'district_admin'];
        return allowedRoles.includes(user.role);
    }

    /**
     * Helper method to check if user has access to a location
     */
    async checkLocationAccess(user, location) {
        if (user.role === 'super_admin' || user.role === 'state_admin') {
            return true;
        }

        if (!user.adminScope?.regions?.length) {
            return false;
        }

        // Check if location is within user's administrative regions
        const userRegions = await Location.find({
            _id: { $in: user.adminScope.regions }
        });

        for (const region of userRegions) {
            // Check if location is the region itself or a child
            if (region._id.toString() === location._id.toString()) {
                return true;
            }

            const children = await region.getAllChildren();
            if (children.some(child => child._id.toString() === location._id.toString())) {
                return true;
            }
        }

        return false;
    }
}

module.exports = new LocationController();