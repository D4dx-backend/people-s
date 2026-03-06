const recurringPaymentService = require('../services/recurringPaymentService');
const { Application, RecurringPayment } = require('../models');
const { validationResult } = require('express-validator');
const { buildFranchiseReadFilter, buildFranchiseMatchStage, getWriteFranchiseId } = require('../utils/franchiseFilterHelper');

/**
 * Generate recurring payment schedule for an application
 */
exports.generateSchedule = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { applicationId } = req.params;
    const { recurringConfig } = req.body;
    
    // Check if application exists
    const application = await Application.findOne({ _id: applicationId, franchise: req.franchiseId })
      .populate('beneficiary scheme project state district area unit');
    
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }
    
    // Check if already has recurring payments
    const existingPayments = await RecurringPayment.countDocuments({ application: applicationId });
    if (existingPayments > 0) {
      return res.status(400).json({ 
        message: 'Recurring payment schedule already exists for this application' 
      });
    }
    
    // Generate schedule
    const schedule = await recurringPaymentService.generatePaymentSchedule(
      application,
      recurringConfig,
      req.user._id
    );
    
    res.status(201).json({
      message: 'Recurring payment schedule generated successfully',
      schedule,
      count: schedule.length
    });
    
  } catch (error) {
    console.error('Error generating recurring schedule:', error);
    res.status(500).json({ 
      message: 'Error generating recurring payment schedule',
      error: error.message 
    });
  }
};

/**
 * Get all applications with recurring payments
 */
exports.getRecurringApplications = async (req, res) => {
  try {
    const filters = {
      scheme: req.query.scheme,
      project: req.query.project,
      status: req.query.status,
      state: req.query.state,
      district: req.query.district,
      area: req.query.area,
      unit: req.query.unit
    };
    
    // Remove undefined filters
    Object.keys(filters).forEach(key => filters[key] === undefined && delete filters[key]);

    // Multi-tenant: scope to franchise
    Object.assign(filters, buildFranchiseReadFilter(req));
    
    const applications = await recurringPaymentService.getRecurringApplications(filters);
    
    res.json({
      applications,
      count: applications.length
    });
    
  } catch (error) {
    console.error('Error fetching recurring applications:', error);
    res.status(500).json({ 
      message: 'Error fetching recurring applications',
      error: error.message 
    });
  }
};

/**
 * Get recurring payment schedule for a specific application
 */
exports.getApplicationSchedule = async (req, res) => {
  try {
    const { applicationId } = req.params;
    
    const schedule = await recurringPaymentService.getPaymentSchedule(applicationId);
    
    if (!schedule || schedule.length === 0) {
      return res.status(404).json({ 
        message: 'No recurring payment schedule found for this application' 
      });
    }
    
    // Get application details
    const application = await Application.findOne({ _id: applicationId, ...buildFranchiseReadFilter(req) })
      .populate('beneficiary scheme project')
      .select('applicationNumber recurringConfig status');
    
    res.json({
      application,
      schedule,
      count: schedule.length,
      summary: {
        total: schedule.length,
        completed: schedule.filter(p => p.status === 'completed').length,
        scheduled: schedule.filter(p => p.status === 'scheduled').length,
        overdue: schedule.filter(p => p.status === 'overdue').length,
        totalAmount: schedule.reduce((sum, p) => sum + p.amount, 0),
        paidAmount: schedule.filter(p => p.status === 'completed').reduce((sum, p) => sum + (p.paidAmount || 0), 0)
      }
    });
    
  } catch (error) {
    console.error('Error fetching application schedule:', error);
    res.status(500).json({ 
      message: 'Error fetching payment schedule',
      error: error.message 
    });
  }
};

/**
 * Get upcoming recurring payments
 */
exports.getUpcomingPayments = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const filters = {
      scheme: req.query.scheme,
      project: req.query.project,
      state: req.query.state,
      district: req.query.district
    };
    
    Object.keys(filters).forEach(key => filters[key] === undefined && delete filters[key]);
    Object.assign(filters, buildFranchiseReadFilter(req));
    
    const payments = await recurringPaymentService.getUpcomingPayments(days, filters);
    
    res.json({
      payments,
      count: payments.length,
      days
    });
    
  } catch (error) {
    console.error('Error fetching upcoming payments:', error);
    res.status(500).json({ 
      message: 'Error fetching upcoming payments',
      error: error.message 
    });
  }
};

/**
 * Get overdue recurring payments
 */
exports.getOverduePayments = async (req, res) => {
  try {
    const filters = {
      scheme: req.query.scheme,
      project: req.query.project,
      state: req.query.state,
      district: req.query.district
    };
    
    Object.keys(filters).forEach(key => filters[key] === undefined && delete filters[key]);
    Object.assign(filters, buildFranchiseReadFilter(req));
    
    const payments = await recurringPaymentService.getOverduePayments(filters);
    
    res.json({
      payments,
      count: payments.length
    });
    
  } catch (error) {
    console.error('Error fetching overdue payments:', error);
    res.status(500).json({ 
      message: 'Error fetching overdue payments',
      error: error.message 
    });
  }
};

/**
 * Record a recurring payment as completed
 */
exports.recordPayment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { paymentId } = req.params;
    const paymentData = req.body;
    
    const updatedPayment = await recurringPaymentService.recordPayment(
      paymentId,
      paymentData,
      req.user._id
    );
    
    res.json({
      message: 'Payment recorded successfully',
      payment: updatedPayment
    });
    
  } catch (error) {
    console.error('Error recording payment:', error);
    res.status(500).json({ 
      message: 'Error recording payment',
      error: error.message 
    });
  }
};

/**
 * Update a recurring payment
 */
exports.updateRecurringPayment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { paymentId } = req.params;
    const updateData = req.body;
    
    const updatedPayment = await recurringPaymentService.updateRecurringPayment(
      paymentId,
      updateData,
      req.user._id
    );
    
    if (!updatedPayment) {
      return res.status(404).json({ message: 'Recurring payment not found' });
    }
    
    res.json({
      message: 'Recurring payment updated successfully',
      payment: updatedPayment
    });
    
  } catch (error) {
    console.error('Error updating recurring payment:', error);
    res.status(500).json({ 
      message: 'Error updating recurring payment',
      error: error.message 
    });
  }
};

/**
 * Cancel a recurring payment
 */
exports.cancelRecurringPayment = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { reason } = req.body;
    
    if (!reason) {
      return res.status(400).json({ message: 'Cancellation reason is required' });
    }
    
    const cancelledPayment = await recurringPaymentService.cancelRecurringPayment(
      paymentId,
      reason,
      req.user._id
    );
    
    res.json({
      message: 'Recurring payment cancelled successfully',
      payment: cancelledPayment
    });
    
  } catch (error) {
    console.error('Error cancelling recurring payment:', error);
    res.status(500).json({ 
      message: 'Error cancelling recurring payment',
      error: error.message 
    });
  }
};

/**
 * Get budget forecast based on recurring payments
 */
exports.getBudgetForecast = async (req, res) => {
  try {
    const months = parseInt(req.query.months) || 12;
    const filters = {
      scheme: req.query.scheme,
      project: req.query.project,
      state: req.query.state,
      district: req.query.district
    };
    
    Object.keys(filters).forEach(key => filters[key] === undefined && delete filters[key]);
    
    const forecast = await recurringPaymentService.getBudgetForecast(filters, months);
    
    res.json({
      forecast,
      months
    });
    
  } catch (error) {
    console.error('Error generating budget forecast:', error);
    res.status(500).json({ 
      message: 'Error generating budget forecast',
      error: error.message 
    });
  }
};

/**
 * Get dashboard statistics for recurring payments
 */
exports.getDashboardStats = async (req, res) => {
  try {
    const filters = {
      scheme: req.query.scheme,
      project: req.query.project,
      state: req.query.state,
      district: req.query.district
    };
    
    Object.keys(filters).forEach(key => filters[key] === undefined && delete filters[key]);
    
    const stats = await recurringPaymentService.getDashboardStats(filters);
    
    res.json(stats);
    
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ 
      message: 'Error fetching dashboard statistics',
      error: error.message 
    });
  }
};

/**
 * Get single recurring payment details
 */
exports.getRecurringPayment = async (req, res) => {
  try {
    const { paymentId } = req.params;
    
    const payment = await RecurringPayment.findOne({ _id: paymentId, ...buildFranchiseReadFilter(req) })
      .populate('application', 'applicationNumber status')
      .populate('beneficiary', 'name phone email applicationNumber')
      .populate('scheme', 'name')
      .populate('project', 'name')
      .populate('payment')
      .populate('processedBy', 'name email')
      .populate('cancelledBy', 'name email')
      .populate('state district area unit', 'name');
    
    if (!payment) {
      return res.status(404).json({ message: 'Recurring payment not found' });
    }
    
    res.json({ payment });
    
  } catch (error) {
    console.error('Error fetching recurring payment:', error);
    res.status(500).json({ 
      message: 'Error fetching recurring payment',
      error: error.message 
    });
  }
};

/**
 * Bulk update recurring payment statuses (for cron jobs)
 */
exports.updateOverdueStatuses = async (req, res) => {
  try {
    const result = await RecurringPayment.updateOverdueStatuses();
    
    res.json({
      message: 'Overdue statuses updated successfully',
      modifiedCount: result.modifiedCount
    });
    
  } catch (error) {
    console.error('Error updating overdue statuses:', error);
    res.status(500).json({ 
      message: 'Error updating overdue statuses',
      error: error.message 
    });
  }
};
