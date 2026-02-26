const { SchemeTarget, Scheme, Application, FormConfiguration } = require('../models');
const ResponseHelper = require('../utils/responseHelper');
const mongoose = require('mongoose');

class SchemeTargetController {

  /**
   * Get the target configuration for a scheme
   * GET /api/scheme-targets/:schemeId
   */
  async getTargets(req, res) {
    try {
      const { schemeId } = req.params;

      const scheme = await Scheme.findOne({ _id: schemeId, franchise: req.franchiseId });
      if (!scheme) {
        return ResponseHelper.error(res, 'Scheme not found', 404);
      }

      const target = await SchemeTarget.findOne({ scheme: schemeId, franchise: req.franchiseId })
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email');

      if (!target) {
        return ResponseHelper.success(res, { target: null }, 'No targets configured for this scheme');
      }

      return ResponseHelper.success(res, { target }, 'Scheme targets retrieved successfully');
    } catch (error) {
      console.error('Error fetching scheme targets:', error);
      return ResponseHelper.error(res, error.message || 'Failed to fetch scheme targets', 500);
    }
  }

  /**
   * Create or update target configuration for a scheme (upsert)
   * PUT /api/scheme-targets/:schemeId
   */
  async upsertTargets(req, res) {
    try {
      const { schemeId } = req.params;
      const { totalTarget, description, monthlyTargets } = req.body;

      // Validate scheme exists
      const scheme = await Scheme.findOne({ _id: schemeId, franchise: req.franchiseId });
      if (!scheme) {
        return ResponseHelper.error(res, 'Scheme not found', 404);
      }

      // Validate total target
      if (!totalTarget || totalTarget < 1) {
        return ResponseHelper.error(res, 'Total target must be at least 1', 400);
      }

      // Validate monthly targets don't exceed total
      if (monthlyTargets && monthlyTargets.length > 0) {
        const monthlySum = monthlyTargets.reduce((sum, mt) => sum + (mt.target || 0), 0);
        if (monthlySum > totalTarget) {
          return ResponseHelper.error(res, 
            `Sum of monthly targets (${monthlySum}) exceeds total target (${totalTarget})`, 400);
        }

        // Validate no duplicate month/year
        const keys = monthlyTargets.map(mt => `${mt.year}-${mt.month}`);
        if (keys.length !== new Set(keys).size) {
          return ResponseHelper.error(res, 'Duplicate month/year combinations found', 400);
        }

        // Validate criteria targets if present
        for (const monthly of monthlyTargets) {
          if (monthly.criteriaTargets && monthly.criteriaTargets.length > 0) {
            for (const criteria of monthly.criteriaTargets) {
              const criteriaSum = (criteria.valueTargets || [])
                .reduce((sum, vt) => sum + (vt.target || 0), 0);
              if (criteriaSum > monthly.target) {
                return ResponseHelper.error(res,
                  `Criteria targets sum (${criteriaSum}) for field "${criteria.formFieldLabel}" exceeds monthly target (${monthly.target}) for ${monthly.month}/${monthly.year}`, 400);
              }
            }
          }
        }
      }

      // Upsert the target configuration
      const target = await SchemeTarget.findOneAndUpdate(
        { scheme: schemeId, franchise: req.franchiseId },
        {
          scheme: schemeId,
          franchise: req.franchiseId,
          totalTarget,
          description: description || '',
          monthlyTargets: monthlyTargets || [],
          updatedBy: req.user._id,
          ...(!await SchemeTarget.exists({ scheme: schemeId, franchise: req.franchiseId }) && { createdBy: req.user._id })
        },
        { 
          new: true, 
          upsert: true, 
          runValidators: true,
          setDefaultsOnInsert: true
        }
      );

      return ResponseHelper.success(res, { target }, 'Scheme targets saved successfully');
    } catch (error) {
      console.error('Error saving scheme targets:', error);
      if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map(e => e.message);
        return ResponseHelper.error(res, messages.join(', '), 400);
      }
      return ResponseHelper.error(res, error.message || 'Failed to save scheme targets', 500);
    }
  }

  /**
   * Delete target configuration for a scheme
   * DELETE /api/scheme-targets/:schemeId
   */
  async deleteTargets(req, res) {
    try {
      const { schemeId } = req.params;

      const result = await SchemeTarget.findOneAndDelete({ scheme: schemeId, franchise: req.franchiseId });
      if (!result) {
        return ResponseHelper.error(res, 'No targets found for this scheme', 404);
      }

      return ResponseHelper.success(res, null, 'Scheme targets deleted successfully');
    } catch (error) {
      console.error('Error deleting scheme targets:', error);
      return ResponseHelper.error(res, error.message || 'Failed to delete scheme targets', 500);
    }
  }

  /**
   * Get target progress — auto-tracked from approved applications
   * GET /api/scheme-targets/:schemeId/progress
   */
  async getProgress(req, res) {
    try {
      const { schemeId } = req.params;

      // Fetch the target configuration
      const target = await SchemeTarget.findOne({ scheme: schemeId, franchise: req.franchiseId });
      if (!target) {
        return ResponseHelper.error(res, 'No targets configured for this scheme', 404);
      }

      // Count total approved/completed applications for this scheme
      const totalAchieved = await Application.countDocuments({
        scheme: schemeId,
        franchise: req.franchiseId,
        status: { $in: ['approved', 'disbursed', 'completed'] }
      });

      // Build monthly progress using aggregation
      const monthlyAggregation = await Application.aggregate([
        {
          $match: {
            scheme: new mongoose.Types.ObjectId(schemeId),
            franchise: new mongoose.Types.ObjectId(req.franchiseId),
            status: { $in: ['approved', 'disbursed', 'completed'] }
          }
        },
        {
          $group: {
            _id: {
              month: { $month: '$createdAt' },
              year: { $year: '$createdAt' }
            },
            count: { $sum: 1 },
            // Collect all formData for criteria analysis
            formDataList: { $push: '$formData' }
          }
        },
        {
          $sort: { '_id.year': 1, '_id.month': 1 }
        }
      ]);

      // Build a lookup map: "year-month" → { count, formDataList }
      const monthlyMap = {};
      for (const agg of monthlyAggregation) {
        const key = `${agg._id.year}-${agg._id.month}`;
        monthlyMap[key] = {
          count: agg.count,
          formDataList: agg.formDataList || []
        };
      }

      // Build progress for each monthly target
      const monthlyProgress = target.monthlyTargets.map(mt => {
        const key = `${mt.year}-${mt.month}`;
        const actual = monthlyMap[key] || { count: 0, formDataList: [] };

        // Build criteria progress
        const criteriaProgress = (mt.criteriaTargets || []).map(criteria => {
          const fieldKey = `field_${criteria.formFieldId}`;

          // Count occurrences of each option value in formData
          const valueCounts = {};
          for (const formData of actual.formDataList) {
            if (!formData) continue;
            const fieldValue = formData[fieldKey];
            if (fieldValue === undefined || fieldValue === null) continue;

            // Handle multiselect (array values)
            if (Array.isArray(fieldValue)) {
              for (const v of fieldValue) {
                valueCounts[v] = (valueCounts[v] || 0) + 1;
              }
            } else {
              const v = String(fieldValue);
              valueCounts[v] = (valueCounts[v] || 0) + 1;
            }
          }

          // Map to value targets with achieved counts
          const valueProgress = (criteria.valueTargets || []).map(vt => ({
            value: vt.value,
            target: vt.target,
            achieved: valueCounts[vt.value] || 0,
            percentage: vt.target > 0 
              ? Math.round(((valueCounts[vt.value] || 0) / vt.target) * 100) 
              : 0
          }));

          return {
            formFieldId: criteria.formFieldId,
            formFieldLabel: criteria.formFieldLabel,
            formFieldType: criteria.formFieldType,
            valueProgress
          };
        });

        return {
          month: mt.month,
          year: mt.year,
          target: mt.target,
          achieved: actual.count,
          percentage: mt.target > 0 ? Math.round((actual.count / mt.target) * 100) : 0,
          criteriaProgress
        };
      });

      const progress = {
        scheme: schemeId,
        totalTarget: target.totalTarget,
        totalAchieved,
        totalPercentage: target.totalTarget > 0 
          ? Math.round((totalAchieved / target.totalTarget) * 100) 
          : 0,
        monthlyProgress
      };

      return ResponseHelper.success(res, { progress }, 'Target progress retrieved successfully');
    } catch (error) {
      console.error('Error fetching target progress:', error);
      return ResponseHelper.error(res, error.message || 'Failed to fetch target progress', 500);
    }
  }

  /**
   * Get form fields eligible for criteria mapping (select/dropdown/radio/multiselect/yesno)
   * GET /api/scheme-targets/:schemeId/form-fields
   */
  async getFormFields(req, res) {
    try {
      const { schemeId } = req.params;

      // Validate scheme exists
      const scheme = await Scheme.findOne({ _id: schemeId, franchise: req.franchiseId });
      if (!scheme) {
        return ResponseHelper.error(res, 'Scheme not found', 404);
      }

      // Fetch the form configuration for this scheme
      const formConfig = await FormConfiguration.findOne({ 
        scheme: schemeId, 
        franchise: req.franchiseId,
        isRenewalForm: false 
      });

      if (!formConfig) {
        return ResponseHelper.success(res, { fields: [] }, 'No form configuration found for this scheme');
      }

      // Extract fields with discrete option values
      const eligibleTypes = ['select', 'dropdown', 'radio', 'multiselect', 'yesno', 'checkbox'];
      const fields = [];

      for (const page of (formConfig.pages || [])) {
        for (const field of (page.fields || [])) {
          if (eligibleTypes.includes(field.type)) {
            // Build options list
            let options = [];
            if (field.type === 'yesno') {
              options = [{ label: 'Yes', value: 'Yes' }, { label: 'No', value: 'No' }];
            } else if (field.type === 'checkbox') {
              options = [{ label: 'True', value: 'true' }, { label: 'False', value: 'false' }];
            } else {
              options = (field.options || []).map(opt => ({
                label: typeof opt === 'string' ? opt : (opt.label || opt.value || String(opt)),
                value: typeof opt === 'string' ? opt : (opt.value || opt.label || String(opt))
              }));
            }

            if (options.length > 0) {
              fields.push({
                id: field.id,
                label: field.label,
                type: field.type,
                options,
                pageTitle: page.title || `Page ${page.id}`
              });
            }
          }
        }
      }

      return ResponseHelper.success(res, { fields }, 'Form fields retrieved successfully');
    } catch (error) {
      console.error('Error fetching form fields:', error);
      return ResponseHelper.error(res, error.message || 'Failed to fetch form fields', 500);
    }
  }
}

module.exports = new SchemeTargetController();
