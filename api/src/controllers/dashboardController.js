const { Project, Scheme, Application, Payment, User, Beneficiary, RecurringPayment } = require('../models');
const ResponseHelper = require('../utils/responseHelper');

/**
 * Build scope-based filters for the current user.
 * Returns { applicationFilter, projectFilter, schemeFilter, beneficiaryFilter, paymentFilter }
 */
async function buildScopeFilters(user) {
  const role = user.role;

  // Super admin sees everything
  if (role === 'super_admin') {
    return { applicationFilter: {}, projectFilter: {}, schemeFilter: {}, beneficiaryFilter: {}, paymentFilter: {} };
  }

  const getId = (ref) => {
    if (!ref) return null;
    if (typeof ref === 'object' && ref._id) return ref._id;
    return ref;
  };

  // State admin: scoped to their assigned state
  if (role === 'state_admin') {
    const stateId = getId(user.adminScope?.state);
    const regions = user.adminScope?.regions || [];
    const resolvedStateId = stateId || (regions.length > 0 ? getId(regions[0]) : null);
    if (resolvedStateId) {
      const stateFilter = { state: resolvedStateId };
      return {
        applicationFilter: stateFilter,
        projectFilter: {},
        schemeFilter: {},
        beneficiaryFilter: stateFilter,
        paymentFilter: {}
      };
    }
    // No state assigned – fail closed: return no records
    const noMatch = { _id: { $exists: false } };
    return { applicationFilter: noMatch, projectFilter: noMatch, schemeFilter: noMatch, beneficiaryFilter: noMatch, paymentFilter: noMatch };
  }

  // Project coordinator: scoped to assigned projects
  if (role === 'project_coordinator') {
    const projectIds = user.adminScope?.projects || [];
    const pFilter = projectIds.length > 0 ? { _id: { $in: projectIds } } : { _id: null };
    const appFilter = projectIds.length > 0 ? { project: { $in: projectIds } } : { _id: null };
    return {
      applicationFilter: appFilter,
      projectFilter: pFilter,
      schemeFilter: projectIds.length > 0 ? { project: { $in: projectIds } } : { _id: null },
      beneficiaryFilter: {}, // coordinators don't have beneficiary scope
      paymentFilter: projectIds.length > 0 ? { project: { $in: projectIds } } : { _id: null }
    };
  }

  // Scheme coordinator: scoped to assigned schemes
  if (role === 'scheme_coordinator') {
    const schemeIds = user.adminScope?.schemes || [];
    const sFilter = schemeIds.length > 0 ? { _id: { $in: schemeIds } } : { _id: null };
    const appFilter = schemeIds.length > 0 ? { scheme: { $in: schemeIds } } : { _id: null };
    return {
      applicationFilter: appFilter,
      projectFilter: {}, // scheme coordinators don't filter projects directly
      schemeFilter: sFilter,
      beneficiaryFilter: {},
      paymentFilter: schemeIds.length > 0 ? { scheme: { $in: schemeIds } } : { _id: null }
    };
  }

  // Regional admins: district, area, unit
  const noMatch = { _id: { $exists: false } };
  const applicationFilter = {};
  const beneficiaryFilter = {};
  let regionalScopeFound = false;

  if (role === 'district_admin') {
    const districtId = getId(user.adminScope?.district);
    if (districtId) {
      applicationFilter.district = districtId;
      beneficiaryFilter.district = districtId;
      regionalScopeFound = true;
    }
  } else if (role === 'area_admin') {
    const areaId = getId(user.adminScope?.area);
    if (areaId) {
      applicationFilter.area = areaId;
      beneficiaryFilter.area = areaId;
      regionalScopeFound = true;
    }
  } else if (role === 'unit_admin') {
    const unitId = getId(user.adminScope?.unit);
    if (unitId) {
      applicationFilter.unit = unitId;
      beneficiaryFilter.unit = unitId;
      regionalScopeFound = true;
    }
  } else {
    // Unknown role with regional scope - fail closed
    return { applicationFilter: noMatch, projectFilter: noMatch, schemeFilter: noMatch, beneficiaryFilter: noMatch, paymentFilter: noMatch };
  }

  // If scope id was missing, deny access entirely
  if (!regionalScopeFound) {
    return { applicationFilter: noMatch, projectFilter: noMatch, schemeFilter: noMatch, beneficiaryFilter: noMatch, paymentFilter: noMatch };
  }

  // Regional admins see projects/schemes in their regions
  const userRegions = user.adminScope?.regions || [];
  const projectFilter = userRegions.length > 0 ? { targetRegions: { $in: userRegions } } : {};
  const schemeFilter = userRegions.length > 0 ? {
    $or: [{ targetRegions: { $size: 0 } }, { targetRegions: { $in: userRegions } }]
  } : {};

  // Payment model doesn't have district/area/unit fields directly,
  // so filter payments by projects in the user's regions
  let paymentFilter = {};
  if (userRegions.length > 0) {
    const regionProjects = await Project.find({ targetRegions: { $in: userRegions } }).select('_id').lean();
    const regionProjectIds = regionProjects.map(p => p._id);
    paymentFilter = regionProjectIds.length > 0 ? { project: { $in: regionProjectIds } } : { _id: null };
  }

  return { applicationFilter, projectFilter, schemeFilter, beneficiaryFilter, paymentFilter };
}

class DashboardController {
  /**
   * Get dashboard overview statistics
   * GET /api/dashboard/overview
   */
  async getOverview(req, res) {
    try {
      const user = req.user;
      const { applicationFilter, projectFilter, schemeFilter, beneficiaryFilter, paymentFilter } = await buildScopeFilters(user);

      // Get counts for main entities with scope filters
      const [
        totalProjects,
        totalSchemes,
        totalApplications,
        totalBeneficiaries,
        totalUsers
      ] = await Promise.all([
        Project.countDocuments(projectFilter),
        Scheme.countDocuments(schemeFilter),
        Application.countDocuments(applicationFilter),
        Beneficiary.countDocuments(beneficiaryFilter),
        // Only super/state admins see total users; others see 0
        (user.role === 'super_admin' || user.role === 'state_admin') ? User.countDocuments() : Promise.resolve(0)
      ]);

      // Get application status breakdown with scope filter
      const applicationStats = await Application.aggregate([
        { $match: applicationFilter },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      // Get scheme-based application count by status
      const schemeBasedStats = await Application.aggregate([
        { $match: applicationFilter },
        {
          $group: {
            _id: {
              scheme: '$scheme',
              status: '$status'
            },
            count: { $sum: 1 }
          }
        },
        {
          $lookup: {
            from: 'schemes',
            localField: '_id.scheme',
            foreignField: '_id',
            as: 'schemeDetails'
          }
        },
        {
          $project: {
            schemeName: { $arrayElemAt: ['$schemeDetails.name', 0] },
            status: '$_id.status',
            count: 1
          }
        },
        {
          $group: {
            _id: '$_id.scheme',
            schemeName: { $first: '$schemeName' },
            statusBreakdown: {
              $push: {
                status: '$status',
                count: '$count'
              }
            },
            totalCount: { $sum: '$count' }
          }
        },
        {
          $sort: { totalCount: -1 }
        }
      ]);

      // Get total budget and spending (scoped to accessible projects)
      const budgetStats = await Project.aggregate([
        { $match: projectFilter },
        {
          $group: {
            _id: null,
            totalBudget: { $sum: '$budget.total' },
            totalSpent: { $sum: '$budget.spent' }
          }
        }
      ]);

      // Get recent activity counts (scoped)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const [
        recentApplications,
        recentPayments,
        recentRecurringPayments,
        recentBeneficiaries
      ] = await Promise.all([
        Application.countDocuments({ ...applicationFilter, createdAt: { $gte: thirtyDaysAgo } }),
        Payment.countDocuments({ ...paymentFilter, createdAt: { $gte: thirtyDaysAgo } }),
        RecurringPayment.countDocuments({ ...paymentFilter, createdAt: { $gte: thirtyDaysAgo } }),
        Beneficiary.countDocuments({ ...beneficiaryFilter, createdAt: { $gte: thirtyDaysAgo } })
      ]);

      const budget = budgetStats[0] || { totalBudget: 0, totalSpent: 0 };
      const appStatusMap = applicationStats.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {});

      // Format scheme-based statistics
      const schemeStats = schemeBasedStats.map(scheme => {
        const statusMap = {};
        scheme.statusBreakdown.forEach(item => {
          statusMap[item.status] = item.count;
        });
        return {
          schemeId: scheme._id,
          schemeName: scheme.schemeName || 'Unknown Scheme',
          totalApplications: scheme.totalCount,
          pending: statusMap.pending || 0,
          approved: statusMap.approved || 0,
          rejected: statusMap.rejected || 0,
          review: statusMap.review || 0,
          'under-review': statusMap['under-review'] || 0,
          'field-verification': statusMap['field-verification'] || 0,
          'interview-scheduled': statusMap['interview-scheduled'] || 0,
          completed: statusMap.completed || 0
        };
      });

      const overview = {
        totalProjects,
        totalSchemes,
        totalApplications, // Cumulative count
        totalBeneficiaries,
        totalUsers,
        totalBudget: budget.totalBudget,
        totalSpent: budget.totalSpent,
        availableBudget: budget.totalBudget - budget.totalSpent,
        applicationStats: {
          pending: appStatusMap.pending || 0,
          approved: appStatusMap.approved || 0,
          rejected: appStatusMap.rejected || 0,
          review: appStatusMap.review || 0,
          'under-review': appStatusMap['under-review'] || 0,
          'field-verification': appStatusMap['field-verification'] || 0,
          'interview-scheduled': appStatusMap['interview-scheduled'] || 0,
          completed: appStatusMap.completed || 0
        },
        schemeBasedStats: schemeStats, // Scheme-based application count by status
        recentActivity: {
          applications: recentApplications,
          payments: recentPayments + recentRecurringPayments,
          beneficiaries: recentBeneficiaries
        },
        userScope: {
          role: user.role,
          area: user.adminScope?.area,
          district: user.adminScope?.district
        }
      };

      return ResponseHelper.success(res, { overview });
    } catch (error) {
      console.error('❌ Get Dashboard Overview Error:', error);
      return ResponseHelper.error(res, 'Failed to fetch dashboard overview', 500);
    }
  }

  /**
   * Get recent applications
   * GET /api/dashboard/recent-applications
   */
  async getRecentApplications(req, res) {
    try {
      const { limit = 10 } = req.query;
      const user = req.user;
      const { applicationFilter } = await buildScopeFilters(user);

      const applications = await Application.find(applicationFilter)
        .populate('beneficiary', 'name phone')
        .populate('scheme', 'name')
        .populate('project', 'name')
        .sort({ createdAt: -1 })
        .limit(parseInt(limit));

      const recentApplications = applications.map(app => ({
        id: app.applicationNumber,
        applicant: app.beneficiary?.name || 'Unknown',
        scheme: app.scheme?.name || 'Unknown Scheme',
        project: app.project?.name || 'Unknown Project',
        status: app.status,
        date: app.createdAt,
        amount: app.requestedAmount
      }));

      return ResponseHelper.success(res, { applications: recentApplications });
    } catch (error) {
      console.error('❌ Get Recent Applications Error:', error);
      return ResponseHelper.error(res, 'Failed to fetch recent applications', 500);
    }
  }

  /**
   * Get recent payments
   * GET /api/dashboard/recent-payments
   */
  async getRecentPayments(req, res) {
    try {
      const { limit = 10 } = req.query;
      const { paymentFilter } = await buildScopeFilters(req.user);

      // Fetch both regular and recurring payments (scoped)
      const [payments, recurringPayments] = await Promise.all([
        Payment.find(paymentFilter)
          .populate('beneficiary', 'name')
          .populate('scheme', 'name')
          .populate('project', 'name')
          .sort({ createdAt: -1 })
          .limit(parseInt(limit)),
        RecurringPayment.find(paymentFilter)
          .populate('beneficiary', 'name')
          .populate('scheme', 'name')
          .populate('project', 'name')
          .sort({ createdAt: -1 })
          .limit(parseInt(limit))
      ]);

      const recentPayments = payments.map(payment => ({
        id: payment.paymentNumber,
        beneficiary: payment.beneficiary?.name || 'Unknown',
        scheme: payment.scheme?.name || 'Unknown Scheme',
        project: payment.project?.name || 'Unknown Project',
        amount: payment.amount,
        status: payment.status,
        date: payment.createdAt,
        method: payment.method,
        type: 'regular'
      }));

      const recentRecurringPayments = recurringPayments.map(payment => ({
        id: `RP-${payment.paymentNumber}`,
        beneficiary: payment.beneficiary?.name || 'Unknown',
        scheme: payment.scheme?.name || 'Unknown Scheme',
        project: payment.project?.name || 'Unknown Project',
        amount: payment.amount,
        status: payment.status,
        date: payment.createdAt,
        method: payment.paymentMethod || 'bank_transfer',
        type: 'recurring',
        cycle: payment.cycleNumber && payment.totalCycles ? `${payment.cycleNumber}/${payment.totalCycles}` : null,
        phase: payment.phaseNumber && payment.totalPhases ? `${payment.phaseNumber}/${payment.totalPhases}` : null
      }));

      // Merge and sort by date
      const allPayments = [...recentPayments, ...recentRecurringPayments]
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, parseInt(limit));

      return ResponseHelper.success(res, { payments: allPayments });
    } catch (error) {
      console.error('❌ Get Recent Payments Error:', error);
      return ResponseHelper.error(res, 'Failed to fetch recent payments', 500);
    }
  }

  /**
   * Get monthly trends
   * GET /api/dashboard/monthly-trends
   */
  async getMonthlyTrends(req, res) {
    try {
      const { months = 6 } = req.query;
      const { applicationFilter, paymentFilter } = await buildScopeFilters(req.user);
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - months);

      // Get application trends (scoped)
      const applicationTrends = await Application.aggregate([
        {
          $match: { ...applicationFilter, createdAt: { $gte: startDate } }
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            },
            applications: { $sum: 1 },
            approved: {
              $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] }
            }
          }
        },
        {
          $sort: { '_id.year': 1, '_id.month': 1 }
        }
      ]);

      // Get payment trends (scoped)
      const paymentTrends = await Payment.aggregate([
        {
          $match: {
            ...paymentFilter,
            createdAt: { $gte: startDate },
            status: 'completed'
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            },
            totalAmount: { $sum: '$amount' },
            paymentCount: { $sum: 1 }
          }
        },
        {
          $sort: { '_id.year': 1, '_id.month': 1 }
        }
      ]);

      const trends = {
        applications: applicationTrends.map(trend => ({
          month: `${trend._id.year}-${String(trend._id.month).padStart(2, '0')}`,
          applications: trend.applications,
          approved: trend.approved
        })),
        payments: paymentTrends.map(trend => ({
          month: `${trend._id.year}-${String(trend._id.month).padStart(2, '0')}`,
          amount: trend.totalAmount,
          count: trend.paymentCount
        }))
      };

      return ResponseHelper.success(res, { trends });
    } catch (error) {
      console.error('❌ Get Monthly Trends Error:', error);
      return ResponseHelper.error(res, 'Failed to fetch monthly trends', 500);
    }
  }

  /**
   * Get project performance
   * GET /api/dashboard/project-performance
   */
  async getProjectPerformance(req, res) {
    try {
      const { projectFilter } = await buildScopeFilters(req.user);
      const projects = await Project.find({ status: 'active', ...projectFilter })
        .select('name budget statistics')
        .sort({ 'budget.total': -1 })
        .limit(10);

      const performance = projects.map(project => ({
        id: project._id,
        name: project.name,
        budget: project.budget.total,
        spent: project.budget.spent,
        utilization: project.budget.total > 0 ? (project.budget.spent / project.budget.total) * 100 : 0,
        beneficiaries: project.statistics?.totalBeneficiaries || 0,
        applications: project.statistics?.totalApplications || 0
      }));

      return ResponseHelper.success(res, { projects: performance });
    } catch (error) {
      console.error('❌ Get Project Performance Error:', error);
      return ResponseHelper.error(res, 'Failed to fetch project performance', 500);
    }
  }
}

module.exports = new DashboardController();