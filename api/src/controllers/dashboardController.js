const { Project, Scheme, Application, Payment, User, Beneficiary, RecurringPayment } = require('../models');
const ResponseHelper = require('../utils/responseHelper');

class DashboardController {
  /**
   * Get dashboard overview statistics
   * GET /api/dashboard/overview
   */
  async getOverview(req, res) {
    try {
      const user = req.user;
      
      // Build location-based filter for area/district admins
      let locationFilter = {};
      if (user.role === 'area_admin' && user.adminScope?.area) {
        locationFilter = { 'location.area': user.adminScope.area };
      } else if (user.role === 'district_admin' && user.adminScope?.district) {
        locationFilter = { 'location.district': user.adminScope.district };
      }
      // super_admin and state_admin can see all data (no filter)

      // Franchise scope
      if (req.franchiseId) locationFilter.franchise = req.franchiseId;
      
      // Get counts for main entities with location filter
      const [
        totalProjects,
        totalSchemes,
        totalApplications,
        totalBeneficiaries,
        totalUsers
      ] = await Promise.all([
        Project.countDocuments(req.franchiseId ? { franchise: req.franchiseId } : {}),
        Scheme.countDocuments(req.franchiseId ? { franchise: req.franchiseId } : {}),
        Application.countDocuments(locationFilter),
        Beneficiary.countDocuments(locationFilter),
        User.countDocuments()
      ]);

      // Get application status breakdown with location filter
      const applicationStats = await Application.aggregate([
        { $match: locationFilter },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      // Get scheme-based application count by status
      const schemeBasedStats = await Application.aggregate([
        { $match: locationFilter },
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

      // Get total budget and spending
      const budgetStats = await Project.aggregate([
        ...(req.franchiseId ? [{ $match: { franchise: req.franchiseId } }] : []),
        {
          $group: {
            _id: null,
            totalBudget: { $sum: '$budget.total' },
            totalSpent: { $sum: '$budget.spent' }
          }
        }
      ]);

      // Get recent activity counts
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const [
        recentApplications,
        recentPayments,
        recentRecurringPayments,
        recentBeneficiaries
      ] = await Promise.all([
        Application.countDocuments({ ...locationFilter, createdAt: { $gte: thirtyDaysAgo } }),
        Payment.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
        RecurringPayment.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
        Beneficiary.countDocuments({ ...locationFilter, createdAt: { $gte: thirtyDaysAgo } })
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
      
      // Build location-based filter for area/district admins
      let locationFilter = {};
      if (user.role === 'area_admin' && user.adminScope?.area) {
        locationFilter = { 'location.area': user.adminScope.area };
      } else if (user.role === 'district_admin' && user.adminScope?.district) {
        locationFilter = { 'location.district': user.adminScope.district };
      }

      // Franchise scope
      if (req.franchiseId) locationFilter.franchise = req.franchiseId;

      const applications = await Application.find(locationFilter)
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

      // Fetch both regular and recurring payments
      const paymentFilter = req.franchiseId ? { franchise: req.franchiseId } : {};
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
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - months);

      // Get application trends
      const applicationTrends = await Application.aggregate([
        {
          $match: { createdAt: { $gte: startDate }, ...(req.franchiseId ? { franchise: req.franchiseId } : {}) }
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

      // Get payment trends
      const paymentTrends = await Payment.aggregate([
        {
          $match: { 
            createdAt: { $gte: startDate },
            status: 'completed',
            ...(req.franchiseId ? { franchise: req.franchiseId } : {})
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
      const projectFilter = { status: 'active' };
      if (req.franchiseId) projectFilter.franchise = req.franchiseId;
      const projects = await Project.find(projectFilter)
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