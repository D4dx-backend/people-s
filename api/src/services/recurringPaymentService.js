const { RecurringPayment, Application, Payment, Counter } = require('../models');
const mongoose = require('mongoose');

class RecurringPaymentService {
  
  /**
   * Calculate payment schedule dates based on start date and period
   * @param {Date} startDate - Starting date for recurring payments
   * @param {String} period - Period: monthly, quarterly, semi_annually, annually
   * @param {Number} numberOfPayments - Total number of payments
   * @returns {Array} Array of scheduled dates
   */
  calculatePaymentSchedule(startDate, period, numberOfPayments) {
    const dates = [];
    const start = new Date(startDate);
    
    // Define months for each period (use proper calendar months to prevent drift)
    const monthsPerPeriod = {
      'monthly': 1,
      'quarterly': 3,
      'semi_annually': 6,
      'annually': 12
    };
    
    const months = monthsPerPeriod[period];
    if (!months) {
      throw new Error(`Invalid period: ${period}`);
    }
    
    for (let i = 0; i < numberOfPayments; i++) {
      const paymentDate = new Date(start);
      // Use calendar month addition to prevent date drift
      paymentDate.setMonth(start.getMonth() + (i * months));
      dates.push(paymentDate);
    }
    
    return dates;
  }
  
  /**
   * Calculate end date based on start date, period, and number of payments
   * @param {Date} startDate - Starting date
   * @param {String} period - Recurring period
   * @param {Number} numberOfPayments - Total payments
   * @returns {Date} End date
   */
  calculateEndDate(startDate, period, numberOfPayments) {
    const dates = this.calculatePaymentSchedule(startDate, period, numberOfPayments);
    return dates[dates.length - 1];
  }
  
  /**
   * Generate recurring payment schedule for an application
   * @param {String} applicationId - Application ID
   * @returns {Array} Created recurring payment records
   */
  async generatePaymentSchedule(applicationId) {
    try {
      // Fetch application with full details
      const application = await Application.findById(applicationId)
        .populate('beneficiary', 'name phone email')
        .populate('scheme', 'name')
        .populate('project', 'name');

      if (!application) {
        throw new Error('Application not found');
      }

      if (!application.isRecurring || !application.recurringConfig) {
        throw new Error('Application is not configured for recurring payments');
      }

      const { 
        period, 
        numberOfPayments, 
        amountPerPayment, 
        startDate, 
        customAmounts,
        hasDistributionTimeline,
        distributionTimeline
      } = application.recurringConfig;

      // Calculate recurring cycle dates (when each cycle starts)
      const cycleDates = this.calculatePaymentSchedule(startDate, period, numberOfPayments);
      
      const recurringPayments = [];

      // If has distribution timeline, create payments for each phase in each cycle
      if (hasDistributionTimeline && distributionTimeline && distributionTimeline.length > 0) {
        // Timeline + Recurring: Create payments for each phase in each cycle
        for (let cycle = 0; cycle < numberOfPayments; cycle++) {
          const cycleStartDate = cycleDates[cycle];
          
          for (let phaseIndex = 0; phaseIndex < distributionTimeline.length; phaseIndex++) {
            const phase = distributionTimeline[phaseIndex];
            
            // Calculate phase date relative to cycle start
            const phaseDate = new Date(phase.expectedDate);
            const originalStart = new Date(startDate);
            const daysOffset = Math.floor((phaseDate - originalStart) / (1000 * 60 * 60 * 24));
            
            const scheduledDate = new Date(cycleStartDate);
            scheduledDate.setDate(scheduledDate.getDate() + daysOffset);
            
            const dueDate = new Date(scheduledDate);
            dueDate.setDate(dueDate.getDate() + 7);
            
            const description = `Cycle ${cycle + 1}/${numberOfPayments} - ${phase.description}`;
            
            recurringPayments.push({
              application: application._id,
              beneficiary: application.beneficiary._id,
              scheme: application.scheme?._id,
              project: application.project?._id,
              paymentNumber: (cycle * distributionTimeline.length) + phaseIndex + 1,
              totalPayments: numberOfPayments * distributionTimeline.length,
              cycleNumber: cycle + 1,
              totalCycles: numberOfPayments,
              phaseNumber: phaseIndex + 1,
              totalPhases: distributionTimeline.length,
              scheduledDate,
              dueDate,
              amount: phase.amount,
              description,
              status: 'scheduled',
              state: application.location?.state,
              district: application.location?.district,
              area: application.location?.area,
              unit: application.location?.unit
            });
          }
        }
      } else {
        // Simple recurring: One payment per cycle
        for (let i = 0; i < numberOfPayments; i++) {
          const paymentNumber = i + 1;
          const scheduledDate = cycleDates[i];
          
          // Check if there's a custom amount for this payment
          const customAmount = customAmounts?.find(ca => ca.paymentNumber === paymentNumber);
          const amount = customAmount ? customAmount.amount : amountPerPayment;
          const description = customAmount?.description || 
            `Recurring payment ${paymentNumber} of ${numberOfPayments} - ${period}`;
          
          // Calculate due date (7 days after scheduled date by default)
          const dueDate = new Date(scheduledDate);
          dueDate.setDate(dueDate.getDate() + 7);
          
          recurringPayments.push({
            application: application._id,
            beneficiary: application.beneficiary._id,
            scheme: application.scheme?._id,
            project: application.project?._id,
            paymentNumber,
            totalPayments: numberOfPayments,
            cycleNumber: paymentNumber,
            totalCycles: numberOfPayments,
            scheduledDate,
            dueDate,
            amount,
            description,
            status: 'scheduled',
            state: application.location?.state,
            district: application.location?.district,
            area: application.location?.area,
            unit: application.location?.unit
          });
        }
      }
      
      // Insert all recurring payments
      const createdPayments = await RecurringPayment.insertMany(recurringPayments);
      
      // Update application with next payment date
      const nextPayment = recurringPayments[0];
      await Application.findByIdAndUpdate(applicationId, {
        'recurringConfig.nextPaymentDate': nextPayment.scheduledDate,
        'recurringConfig.completedPayments': 0
      });
      
      console.log(`✅ Generated ${createdPayments.length} recurring payment records for application ${application.applicationNumber}`);
      
      return createdPayments;
    } catch (error) {
      console.error('Error generating payment schedule:', error);
      throw error;
    }
  }
  
  /**
   * Get recurring payment schedule for an application
   * @param {String} applicationId - Application ID
   * @returns {Array} Recurring payments
   */
  async getPaymentSchedule(applicationId) {
    return await RecurringPayment.find({ application: applicationId })
      .populate('beneficiary', 'name phone email')
      .populate('scheme', 'name')
      .populate('project', 'name')
      .populate('payment')
      .populate('processedBy', 'name email')
      .sort({ paymentNumber: 1 });
  }
  
  /**
   * Get all applications with recurring payments
   * @param {Object} filters - Filter options
   * @returns {Array} Applications
   */
  async getRecurringApplications(filters = {}) {
    const query = { isRecurring: true };
    
    if (filters.scheme) query.scheme = filters.scheme;
    if (filters.project) query.project = filters.project;
    if (filters.status) query['recurringConfig.status'] = filters.status;
    if (filters.state) query.state = filters.state;
    if (filters.district) query.district = filters.district;
    if (filters.area) query.area = filters.area;
    if (filters.unit) query.unit = filters.unit;
    
    const apps = await Application.find(query)
      .populate('beneficiary', 'name phone email applicationNumber')
      .populate('scheme', 'name')
      .populate('project', 'name')
      .populate('state district area unit', 'name')
      .sort({ 'recurringConfig.nextPaymentDate': 1 });
    
    return apps;
  }
  
  /**
   * Get upcoming recurring payments
   * @param {Number} days - Number of days to look ahead
   * @param {Object} filters - Additional filters
   * @returns {Array} Upcoming payments
   */
  async getUpcomingPayments(days = 30, filters = {}) {
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);
    
    const query = {
      status: { $in: ['scheduled', 'due'] },
      scheduledDate: { $gte: now, $lte: futureDate }
    };
    
    if (filters.scheme) query.scheme = filters.scheme;
    if (filters.project) query.project = filters.project;
    if (filters.state) query.state = filters.state;
    if (filters.district) query.district = filters.district;
    
    return await RecurringPayment.find(query)
      .populate('application', 'applicationNumber')
      .populate('beneficiary', 'name phone email')
      .populate('scheme', 'name')
      .populate('project', 'name')
      .sort({ scheduledDate: 1 });
  }
  
  /**
   * Get overdue recurring payments
   * @param {Object} filters - Filter options
   * @returns {Array} Overdue payments
   */
  async getOverduePayments(filters = {}) {
    const now = new Date();
    
    const query = {
      status: { $in: ['scheduled', 'due', 'overdue'] },
      $or: [
        { dueDate: { $lt: now } },
        { $and: [{ dueDate: null }, { scheduledDate: { $lt: now } }] }
      ]
    };
    
    if (filters.scheme) query.scheme = filters.scheme;
    if (filters.project) query.project = filters.project;
    if (filters.state) query.state = filters.state;
    if (filters.district) query.district = filters.district;
    
    // Update statuses to overdue
    await RecurringPayment.updateMany(query, { $set: { status: 'overdue' } });
    
    return await RecurringPayment.find(query)
      .populate('application', 'applicationNumber')
      .populate('beneficiary', 'name phone email')
      .populate('scheme', 'name')
      .populate('project', 'name')
      .sort({ scheduledDate: 1 });
  }
  
  /**
   * Record a recurring payment as completed
   * @param {String} recurringPaymentId - Recurring payment ID
   * @param {Object} paymentData - Payment details
   * @param {String} userId - User processing the payment
   * @returns {Object} Updated recurring payment
   */
  async recordPayment(recurringPaymentId, paymentData, userId) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const recurringPayment = await RecurringPayment.findById(recurringPaymentId)
        .populate('application')
        .session(session);
      
      if (!recurringPayment) {
        throw new Error('Recurring payment not found');
      }
      
      if (recurringPayment.status === 'completed') {
        throw new Error('Payment already completed');
      }
      
      // Generate proper payment number using atomic Counter
      const year = new Date().getFullYear();
      const month = String(new Date().getMonth() + 1).padStart(2, '0');
      const counterKey = `payment_${year}_${month}`;
      const seq = await Counter.getNextSequence(counterKey);
      const paymentNumber = `PAY_${year}_${month}_${String(seq).padStart(5, '0')}`;
      
      // Create actual payment record
      const payment = new Payment({
        paymentNumber,
        application: recurringPayment.application._id,
        beneficiary: recurringPayment.beneficiary,
        project: recurringPayment.project,
        scheme: recurringPayment.scheme,
        amount: paymentData.amount || recurringPayment.amount,
        type: 'installment',
        method: paymentData.method,
        installment: {
          number: recurringPayment.paymentNumber,
          totalInstallments: recurringPayment.totalPayments,
          description: recurringPayment.description
        },
        status: 'completed',
        timeline: {
          completedAt: new Date(),
          processedAt: new Date()
        },
        initiatedBy: userId,
        processedBy: userId
      });
      
      await payment.save({ session });
      
      // Update recurring payment
      await recurringPayment.markAsCompleted(
        payment._id,
        paymentData.amount || recurringPayment.amount,
        paymentData.method,
        paymentData.transactionReference,
        userId
      );
      await recurringPayment.save({ session });
      
      // Update application recurring config
      const application = recurringPayment.application;
      const completedCount = (application.recurringConfig?.completedPayments || 0) + 1;
      const nextPayment = await RecurringPayment.findOne({
        application: application._id,
        status: { $in: ['scheduled', 'due'] }
      }).sort({ scheduledDate: 1 }).session(session);
      
      const updateData = {
        'recurringConfig.completedPayments': completedCount,
        'recurringConfig.lastPaymentDate': new Date()
      };
      
      if (nextPayment) {
        updateData['recurringConfig.nextPaymentDate'] = nextPayment.scheduledDate;
      } else {
        // All payments completed
        updateData['recurringConfig.status'] = 'completed';
        updateData['recurringConfig.nextPaymentDate'] = null;
      }
      
      await Application.findByIdAndUpdate(application._id, updateData, { session });
      
      await session.commitTransaction();
      session.endSession();
      
      return await RecurringPayment.findById(recurringPaymentId)
        .populate('payment')
        .populate('application')
        .populate('beneficiary');
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }
  
  /**
   * Calculate budget forecast based on recurring payments
   * @param {Object} filters - Filter options
   * @param {Number} months - Number of months to forecast
   * @returns {Object} Budget forecast data
   */
  async getBudgetForecast(filters = {}, months = 12) {
    const now = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + months);
    
    const query = {
      status: { $in: ['scheduled', 'due', 'overdue'] },
      scheduledDate: { $lte: endDate },
      // Explicitly exclude cancelled and skipped to ensure forecast accuracy
    };
    
    if (filters.scheme) query.scheme = filters.scheme;
    if (filters.project) query.project = filters.project;
    if (filters.state) query.state = filters.state;
    if (filters.district) query.district = filters.district;
    
    const payments = await RecurringPayment.find(query)
      .populate('scheme', 'name')
      .populate('project', 'name')
      .sort({ scheduledDate: 1 });
    
    // Group by month
    const monthlyForecast = {};
    const schemeBreakdown = {};
    const projectBreakdown = {};
    
    payments.forEach(payment => {
      const monthKey = `${payment.scheduledDate.getFullYear()}-${String(payment.scheduledDate.getMonth() + 1).padStart(2, '0')}`;
      
      // Monthly total
      if (!monthlyForecast[monthKey]) {
        monthlyForecast[monthKey] = {
          month: monthKey,
          totalAmount: 0,
          paymentCount: 0,
          overdueCount: 0,
          scheduledCount: 0
        };
      }
      
      monthlyForecast[monthKey].totalAmount += payment.amount;
      monthlyForecast[monthKey].paymentCount += 1;
      
      if (payment.status === 'overdue') {
        monthlyForecast[monthKey].overdueCount += 1;
      } else {
        monthlyForecast[monthKey].scheduledCount += 1;
      }
      
      // Scheme breakdown
      const schemeName = payment.scheme?.name || 'Unknown';
      if (!schemeBreakdown[schemeName]) {
        schemeBreakdown[schemeName] = { totalAmount: 0, count: 0 };
      }
      schemeBreakdown[schemeName].totalAmount += payment.amount;
      schemeBreakdown[schemeName].count += 1;
      
      // Project breakdown
      const projectName = payment.project?.name || 'No Project';
      if (!projectBreakdown[projectName]) {
        projectBreakdown[projectName] = { totalAmount: 0, count: 0 };
      }
      projectBreakdown[projectName].totalAmount += payment.amount;
      projectBreakdown[projectName].count += 1;
    });
    
    // Calculate totals
    const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);
    const overdueAmount = payments
      .filter(p => p.status === 'overdue')
      .reduce((sum, p) => sum + p.amount, 0);
    
    return {
      summary: {
        totalAmount,
        totalPayments: payments.length,
        overdueAmount,
        overduePayments: payments.filter(p => p.status === 'overdue').length,
        averagePayment: payments.length > 0 ? totalAmount / payments.length : 0
      },
      monthlyForecast: Object.values(monthlyForecast).sort((a, b) => a.month.localeCompare(b.month)),
      schemeBreakdown: Object.entries(schemeBreakdown).map(([name, data]) => ({
        scheme: name,
        ...data
      })),
      projectBreakdown: Object.entries(projectBreakdown).map(([name, data]) => ({
        project: name,
        ...data
      }))
    };
  }
  
  /**
   * Update recurring payment schedule
   * @param {String} recurringPaymentId - Payment ID
   * @param {Object} updateData - Data to update
   * @param {String} userId - User making the update
   * @returns {Object} Updated payment
   */
  async updateRecurringPayment(recurringPaymentId, updateData, userId) {
    const allowedUpdates = ['scheduledDate', 'dueDate', 'amount', 'description', 'notes'];
    const updates = {};
    
    allowedUpdates.forEach(field => {
      if (updateData[field] !== undefined) {
        updates[field] = updateData[field];
      }
    });
    
    updates.updatedBy = userId;
    
    return await RecurringPayment.findByIdAndUpdate(
      recurringPaymentId,
      updates,
      { new: true }
    ).populate('application beneficiary scheme project');
  }
  
  /**
   * Cancel a recurring payment
   * @param {String} recurringPaymentId - Payment ID
   * @param {String} reason - Cancellation reason
   * @param {String} userId - User cancelling
   * @returns {Object} Cancelled payment
   */
  async cancelRecurringPayment(recurringPaymentId, reason, userId) {
    const recurringPayment = await RecurringPayment.findById(recurringPaymentId);
    
    if (!recurringPayment) {
      throw new Error('Recurring payment not found');
    }
    
    if (recurringPayment.status === 'completed') {
      throw new Error('Cannot cancel completed payment');
    }
    
    await recurringPayment.cancel(reason, userId);
    
    return await RecurringPayment.findById(recurringPaymentId)
      .populate('application beneficiary scheme project');
  }
  
  /**
   * Get dashboard statistics for recurring payments
   * @param {Object} filters - Filter options
   * @returns {Object} Dashboard statistics
   */
  async getDashboardStats(filters = {}) {
    const query = {};
    
    if (filters.scheme) query.scheme = filters.scheme;
    if (filters.project) query.project = filters.project;
    if (filters.state) query.state = filters.state;
    if (filters.district) query.district = filters.district;
    
    const [
      totalRecurring,
      scheduled,
      overdue,
      completed,
      upcoming7Days,
      upcoming30Days
    ] = await Promise.all([
      RecurringPayment.countDocuments(query),
      RecurringPayment.countDocuments({ ...query, status: 'scheduled' }),
      RecurringPayment.countDocuments({ ...query, status: 'overdue' }),
      RecurringPayment.countDocuments({ ...query, status: 'completed' }),
      this.getUpcomingPayments(7, filters),
      this.getUpcomingPayments(30, filters)
    ]);
    
    const overduePayments = await this.getOverduePayments(filters);
    
    const totalAmount = await RecurringPayment.aggregate([
      { $match: query },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    
    const completedAmount = await RecurringPayment.aggregate([
      { $match: { ...query, status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$paidAmount' } } }
    ]);
    
    return {
      totalPayments: totalRecurring,
      scheduled,
      overdue: overdue,
      completed,
      upcoming: {
        next7Days: upcoming7Days.length,
        next30Days: upcoming30Days.length
      },
      amounts: {
        total: totalAmount[0]?.total || 0,
        completed: completedAmount[0]?.total || 0,
        pending: (totalAmount[0]?.total || 0) - (completedAmount[0]?.total || 0)
      },
      overdueList: overduePayments.slice(0, 10) // Top 10 overdue
    };
  }
}

module.exports = new RecurringPaymentService();
