// Central export file for all models
const User = require('./User');
const Location = require('./Location');
const Project = require('./Project');
const Scheme = require('./Scheme');
const Beneficiary = require('./Beneficiary');
const Application = require('./Application');
const Interview = require('./Interview');
const Report = require('./Report');
const EnquiryReport = require('./EnquiryReport');
const Notification = require('./Notification');
const Payment = require('./Payment');
const Dashboard = require('./Dashboard');
const FormConfiguration = require('./FormConfiguration');
const Donor = require('./Donor');
const Donation = require('./Donation');
const DonorFollowUp = require('./DonorFollowUp');
const ActivityLog = require('./ActivityLog');
const MasterData = require('./MasterData');
const RecurringPayment = require('./RecurringPayment');
const Counter = require('./Counter');
const LoginLog = require('./LoginLog');
const ErrorLog = require('./ErrorLog');
const SchemeTarget = require('./SchemeTarget');

// Website Management Models
const WebsiteSettings = require('./WebsiteSettings');
const NewsEvent = require('./NewsEvent');
const Brochure = require('./Brochure');
const Partner = require('./Partner');
const Banner = require('./Banner');

// RBAC Models
const Role = require('./Role');
const Permission = require('./Permission');
const UserRole = require('./UserRole');

// Multi-tenant / Franchise Models
const Franchise = require('./Franchise');
const UserFranchise = require('./UserFranchise');

module.exports = {
  User,
  Location,
  Project,
  Scheme,
  Beneficiary,
  Application,
  Interview,
  Report,
  EnquiryReport,
  Notification,
  Payment,
  Dashboard,
  FormConfiguration,
  Donor,
  Donation,
  DonorFollowUp,
  ActivityLog,
  MasterData,
  RecurringPayment,
  Counter,
  LoginLog,
  ErrorLog,
  SchemeTarget,

  WebsiteSettings,
  NewsEvent,
  Brochure,
  Partner,
  Banner,

  Role,
  Permission,
  UserRole,

  Franchise,
  UserFranchise
};