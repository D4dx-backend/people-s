/**
 * Export Column Configurations
 * 
 * Centralized column definitions and filter builders for all exportable resources.
 * Used by the generic export handler middleware.
 */

// ==================== PAYMENTS ====================
const paymentColumns = [
  { header: 'Payment Number', accessor: 'paymentNumber' },
  { header: 'Beneficiary Name', accessor: 'beneficiary.name' },
  { header: 'Beneficiary Phone', accessor: 'beneficiary.phone' },
  { header: 'Application Number', accessor: 'application.applicationNumber' },
  { header: 'Scheme', accessor: 'scheme.name' },
  { header: 'Project', accessor: 'project.name' },
  { header: 'Amount', accessor: 'amount', type: 'currency' },
  { header: 'Net Amount', accessor: 'financial.netAmount', type: 'currency' },
  { header: 'Currency', accessor: 'currency' },
  { header: 'Type', accessor: 'type' },
  { header: 'Method', accessor: 'method' },
  { header: 'Status', accessor: 'status' },
  { header: 'Installment', accessor: 'installment.number', transform: (val, row) => {
    if (!val) return '';
    return `${val}/${row.installment?.totalInstallments || ''}`;
  }},
  { header: 'Transaction ID', accessor: 'bankTransfer.transactionId' },
  { header: 'UTR Number', accessor: 'bankTransfer.utrNumber' },
  { header: 'Cheque Number', accessor: 'cheque.chequeNumber' },
  { header: 'Priority', accessor: 'metadata.priority' },
  { header: 'Verification Status', accessor: 'verification.status' },
  { header: 'Initiated At', accessor: 'timeline.initiatedAt', type: 'date' },
  { header: 'Completed At', accessor: 'timeline.completedAt', type: 'date' },
  { header: 'Created At', accessor: 'createdAt', type: 'date' }
];

const paymentPopulate = [
  { path: 'beneficiary', select: 'name phone' },
  { path: 'application', select: 'applicationNumber' },
  { path: 'scheme', select: 'name code' },
  { path: 'project', select: 'name code' }
];

function paymentFilterBuilder(filters) {
  const query = {};
  if (filters.status && filters.status !== 'all') query.status = filters.status;
  if (filters.type) query.type = filters.type;
  if (filters.method) query.method = filters.method;
  if (filters.scheme) query.scheme = filters.scheme;
  if (filters.project) query.project = filters.project;
  if (filters.startDate || filters.endDate) {
    query.createdAt = {};
    if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
    if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
  }
  if (filters.search) {
    query.$or = [
      { paymentNumber: { $regex: filters.search, $options: 'i' } }
    ];
  }
  return query;
}

// ==================== APPLICATIONS ====================
const applicationColumns = [
  { header: 'Application Number', accessor: 'applicationNumber' },
  { header: 'Beneficiary Name', accessor: 'beneficiary.name' },
  { header: 'Beneficiary Phone', accessor: 'beneficiary.phone' },
  { header: 'Scheme', accessor: 'scheme.name' },
  { header: 'Project', accessor: 'project.name' },
  { header: 'Status', accessor: 'status' },
  { header: 'Current Stage', accessor: 'currentStage' },
  { header: 'Requested Amount', accessor: 'requestedAmount', type: 'currency' },
  { header: 'Approved Amount', accessor: 'approvedAmount', type: 'currency' },
  { header: 'District', accessor: 'district.name' },
  { header: 'Area', accessor: 'area.name' },
  { header: 'Unit', accessor: 'unit.name' },
  { header: 'Is Recurring', accessor: 'isRecurring', type: 'boolean' },
  { header: 'Renewal Status', accessor: 'renewalStatus' },
  { header: 'Applied Date', accessor: 'createdAt', type: 'date' },
  { header: 'Updated Date', accessor: 'updatedAt', type: 'date' }
];

const applicationPopulate = [
  { path: 'beneficiary', select: 'name phone' },
  { path: 'scheme', select: 'name code' },
  { path: 'project', select: 'name code' },
  { path: 'district', select: 'name' },
  { path: 'area', select: 'name' },
  { path: 'unit', select: 'name' }
];

function applicationFilterBuilder(filters) {
  const query = {};
  if (filters.status && filters.status !== 'all') query.status = filters.status;
  if (filters.scheme) query.scheme = filters.scheme;
  if (filters.project) query.project = filters.project;
  if (filters.district) query.district = filters.district;
  if (filters.area) query.area = filters.area;
  if (filters.unit) query.unit = filters.unit;
  if (filters.startDate || filters.endDate) {
    query.createdAt = {};
    if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
    if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
  }
  if (filters.search) {
    query.$or = [
      { applicationNumber: { $regex: filters.search, $options: 'i' } }
    ];
  }
  return query;
}

// ==================== DONORS ====================
const donorColumns = [
  { header: 'Name', accessor: 'name' },
  { header: 'Email', accessor: 'email' },
  { header: 'Phone', accessor: 'phone' },
  { header: 'Type', accessor: 'type' },
  { header: 'Category', accessor: 'category' },
  { header: 'Status', accessor: 'status' },
  { header: 'City', accessor: 'address.city' },
  { header: 'State', accessor: 'address.state' },
  { header: 'Total Donated', accessor: 'donationStats.totalDonated', type: 'currency' },
  { header: 'Donation Count', accessor: 'donationStats.donationCount', type: 'number' },
  { header: 'Average Donation', accessor: 'donationStats.averageDonation', type: 'currency' },
  { header: 'Last Donation', accessor: 'donationStats.lastDonation', type: 'date' },
  { header: 'Follow-up Status', accessor: 'followUpStatus' },
  { header: 'Engagement Score', accessor: 'engagementScore', type: 'number' },
  { header: 'PAN Number', accessor: 'taxDetails.panNumber' },
  { header: 'Source', accessor: 'source' },
  { header: 'Verified', accessor: 'isVerified', type: 'boolean' },
  { header: 'Created At', accessor: 'createdAt', type: 'date' }
];

const donorPopulate = [
  { path: 'assignedTo', select: 'name' }
];

function donorFilterBuilder(filters) {
  const query = {};
  if (filters.status && filters.status !== 'all') query.status = filters.status;
  if (filters.type) query.type = filters.type;
  if (filters.category) query.category = filters.category;
  if (filters.followUpStatus) query.followUpStatus = filters.followUpStatus;
  if (filters.search) {
    query.$or = [
      { name: { $regex: filters.search, $options: 'i' } },
      { email: { $regex: filters.search, $options: 'i' } },
      { phone: { $regex: filters.search, $options: 'i' } }
    ];
  }
  if (filters.startDate || filters.endDate) {
    query.createdAt = {};
    if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
    if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
  }
  return query;
}

// ==================== DONATIONS ====================
const donationColumns = [
  { header: 'Donation Number', accessor: 'donationNumber' },
  { header: 'Donor Name', accessor: 'donor.name', transform: (val, row) => {
    if (val) return val;
    return row.anonymousDonor?.name || 'Anonymous';
  }},
  { header: 'Donor Email', accessor: 'donor.email', transform: (val, row) => {
    return val || row.anonymousDonor?.email || '';
  }},
  { header: 'Donor Phone', accessor: 'donor.phone', transform: (val, row) => {
    return val || row.anonymousDonor?.phone || '';
  }},
  { header: 'Amount', accessor: 'amount', type: 'currency' },
  { header: 'Currency', accessor: 'currency' },
  { header: 'Method', accessor: 'method' },
  { header: 'Status', accessor: 'status' },
  { header: 'Purpose', accessor: 'purpose' },
  { header: 'Project', accessor: 'project.name' },
  { header: 'Scheme', accessor: 'scheme.name' },
  { header: 'Receipt Number', accessor: 'receipt.receiptNumber' },
  { header: 'PAN Number', accessor: 'tax.panNumber' },
  { header: 'Is Recurring', accessor: 'preferences.isRecurring', type: 'boolean' },
  { header: 'Is Anonymous', accessor: 'preferences.isAnonymous', type: 'boolean' },
  { header: 'Campaign', accessor: 'campaign.campaignName' },
  { header: 'Source', accessor: 'campaign.source' },
  { header: 'Created At', accessor: 'createdAt', type: 'date' },
  { header: 'Completed At', accessor: 'timeline.completedAt', type: 'date' }
];

const donationPopulate = [
  { path: 'donor', select: 'name email phone type' },
  { path: 'project', select: 'name code' },
  { path: 'scheme', select: 'name code' }
];

function donationFilterBuilder(filters) {
  const query = {};
  if (filters.status && filters.status !== 'all') query.status = filters.status;
  if (filters.method) query.method = filters.method;
  if (filters.purpose) query.purpose = filters.purpose;
  if (filters.donor) query.donor = filters.donor;
  if (filters.project) query.project = filters.project;
  if (filters.scheme) query.scheme = filters.scheme;
  if (filters.search) {
    query.$or = [
      { donationNumber: { $regex: filters.search, $options: 'i' } }
    ];
  }
  if (filters.startDate || filters.endDate) {
    query.createdAt = {};
    if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
    if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
  }
  return query;
}

// ==================== USERS ====================
const userColumns = [
  { header: 'Name', accessor: 'name' },
  { header: 'Email', accessor: 'email' },
  { header: 'Phone', accessor: 'phone' },
  { header: 'Role', accessor: 'role' },
  { header: 'Scope Level', accessor: 'adminScope.level' },
  { header: 'Active', accessor: 'isActive', type: 'boolean' },
  { header: 'Verified', accessor: 'isVerified', type: 'boolean' },
  { header: 'Last Login', accessor: 'lastLogin', type: 'datetime' },
  { header: 'Gender', accessor: 'profile.gender' },
  { header: 'District', accessor: 'profile.address.district' },
  { header: 'State', accessor: 'profile.address.state' },
  { header: 'Created At', accessor: 'createdAt', type: 'date' }
];

const userPopulate = [];

function userFilterBuilder(filters) {
  const query = {};
  if (filters.role) query.role = filters.role;
  if (filters.isActive !== undefined) query.isActive = filters.isActive === 'true';
  if (filters.search) {
    query.$or = [
      { name: { $regex: filters.search, $options: 'i' } },
      { email: { $regex: filters.search, $options: 'i' } },
      { phone: { $regex: filters.search, $options: 'i' } }
    ];
  }
  if (filters.startDate || filters.endDate) {
    query.createdAt = {};
    if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
    if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
  }
  return query;
}

// ==================== ROLES ====================
const roleColumns = [
  { header: 'Name', accessor: 'name' },
  { header: 'Display Name', accessor: 'displayName' },
  { header: 'Description', accessor: 'description' },
  { header: 'Type', accessor: 'type' },
  { header: 'Category', accessor: 'category' },
  { header: 'Level', accessor: 'level', type: 'number' },
  { header: 'Active', accessor: 'isActive', type: 'boolean' },
  { header: 'Default', accessor: 'isDefault', type: 'boolean' },
  { header: 'Total Users', accessor: 'stats.totalUsers', type: 'number' },
  { header: 'Active Users', accessor: 'stats.activeUsers', type: 'number' },
  { header: 'Created At', accessor: 'createdAt', type: 'date' }
];

const rolePopulate = [];

function roleFilterBuilder(filters) {
  const query = {};
  if (filters.type) query.type = filters.type;
  if (filters.category) query.category = filters.category;
  if (filters.isActive !== undefined) query.isActive = filters.isActive === 'true';
  if (filters.search) {
    query.$or = [
      { name: { $regex: filters.search, $options: 'i' } },
      { displayName: { $regex: filters.search, $options: 'i' } }
    ];
  }
  return query;
}

// ==================== BENEFICIARIES ====================
const beneficiaryColumns = [
  { header: 'Name', accessor: 'name' },
  { header: 'Phone', accessor: 'phone' },
  { header: 'Status', accessor: 'status' },
  { header: 'Verified', accessor: 'isVerified', type: 'boolean' },
  { header: 'State', accessor: 'state.name' },
  { header: 'District', accessor: 'district.name' },
  { header: 'Area', accessor: 'area.name' },
  { header: 'Unit', accessor: 'unit.name' },
  { header: 'Verified At', accessor: 'verifiedAt', type: 'date' },
  { header: 'Created At', accessor: 'createdAt', type: 'date' }
];

const beneficiaryPopulate = [
  { path: 'state', select: 'name' },
  { path: 'district', select: 'name' },
  { path: 'area', select: 'name' },
  { path: 'unit', select: 'name' }
];

function beneficiaryFilterBuilder(filters) {
  const query = {};
  if (filters.status && filters.status !== 'all') query.status = filters.status;
  if (filters.isVerified !== undefined) query.isVerified = filters.isVerified === 'true';
  if (filters.district) query.district = filters.district;
  if (filters.area) query.area = filters.area;
  if (filters.unit) query.unit = filters.unit;
  if (filters.search) {
    query.$or = [
      { name: { $regex: filters.search, $options: 'i' } },
      { phone: { $regex: filters.search, $options: 'i' } }
    ];
  }
  if (filters.startDate || filters.endDate) {
    query.createdAt = {};
    if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
    if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
  }
  return query;
}

// ==================== LOCATIONS ====================
const locationColumns = [
  { header: 'Name', accessor: 'name' },
  { header: 'Type', accessor: 'type' },
  { header: 'Code', accessor: 'code' },
  { header: 'Parent', accessor: 'parent.name' },
  { header: 'Population', accessor: 'population', type: 'number' },
  { header: 'Area (sq km)', accessor: 'area', type: 'number' },
  { header: 'Contact Person', accessor: 'contactPerson.name' },
  { header: 'Contact Phone', accessor: 'contactPerson.phone' },
  { header: 'Active', accessor: 'isActive', type: 'boolean' },
  { header: 'Created At', accessor: 'createdAt', type: 'date' }
];

const locationPopulate = [
  { path: 'parent', select: 'name type' }
];

function locationFilterBuilder(filters) {
  const query = {};
  if (filters.type) query.type = filters.type;
  if (filters.parent) query.parent = filters.parent;
  if (filters.isActive !== undefined) query.isActive = filters.isActive === 'true';
  if (filters.search) {
    query.$or = [
      { name: { $regex: filters.search, $options: 'i' } },
      { code: { $regex: filters.search, $options: 'i' } }
    ];
  }
  return query;
}

// ==================== SCHEMES ====================
const schemeColumns = [
  { header: 'Name', accessor: 'name' },
  { header: 'Code', accessor: 'code' },
  { header: 'Category', accessor: 'category' },
  { header: 'Priority', accessor: 'priority' },
  { header: 'Description', accessor: 'description' },
  { header: 'Active', accessor: 'isActive', type: 'boolean' },
  { header: 'Created At', accessor: 'createdAt', type: 'date' }
];

const schemePopulate = [];

function schemeFilterBuilder(filters) {
  const query = {};
  if (filters.category) query.category = filters.category;
  if (filters.priority) query.priority = filters.priority;
  if (filters.isActive !== undefined) query.isActive = filters.isActive === 'true';
  if (filters.search) {
    query.$or = [
      { name: { $regex: filters.search, $options: 'i' } },
      { code: { $regex: filters.search, $options: 'i' } }
    ];
  }
  return query;
}

// ==================== PROJECTS ====================
const projectColumns = [
  { header: 'Name', accessor: 'name' },
  { header: 'Code', accessor: 'code' },
  { header: 'Category', accessor: 'category' },
  { header: 'Priority', accessor: 'priority' },
  { header: 'Scope', accessor: 'scope' },
  { header: 'Description', accessor: 'description' },
  { header: 'Start Date', accessor: 'startDate', type: 'date' },
  { header: 'Active', accessor: 'isActive', type: 'boolean' },
  { header: 'Created At', accessor: 'createdAt', type: 'date' }
];

const projectPopulate = [];

function projectFilterBuilder(filters) {
  const query = {};
  if (filters.category) query.category = filters.category;
  if (filters.priority) query.priority = filters.priority;
  if (filters.scope) query.scope = filters.scope;
  if (filters.isActive !== undefined) query.isActive = filters.isActive === 'true';
  if (filters.search) {
    query.$or = [
      { name: { $regex: filters.search, $options: 'i' } },
      { code: { $regex: filters.search, $options: 'i' } }
    ];
  }
  return query;
}

// ==================== PARTNERS ====================
const partnerColumns = [
  { header: 'Name', accessor: 'name' },
  { header: 'Link', accessor: 'link' },
  { header: 'Order', accessor: 'order', type: 'number' },
  { header: 'Status', accessor: 'status' },
  { header: 'Created At', accessor: 'createdAt', type: 'date' }
];

const partnerPopulate = [];

function partnerFilterBuilder(filters) {
  const query = {};
  if (filters.status) query.status = filters.status;
  if (filters.search) {
    query.name = { $regex: filters.search, $options: 'i' };
  }
  return query;
}

module.exports = {
  payment: { columns: paymentColumns, populate: paymentPopulate, filterBuilder: paymentFilterBuilder, filenamePrefix: 'payments', defaultSort: { createdAt: -1 } },
  application: { columns: applicationColumns, populate: applicationPopulate, filterBuilder: applicationFilterBuilder, filenamePrefix: 'applications', defaultSort: { createdAt: -1 } },
  donor: { columns: donorColumns, populate: donorPopulate, filterBuilder: donorFilterBuilder, filenamePrefix: 'donors', defaultSort: { createdAt: -1 } },
  donation: { columns: donationColumns, populate: donationPopulate, filterBuilder: donationFilterBuilder, filenamePrefix: 'donations', defaultSort: { createdAt: -1 } },
  user: { columns: userColumns, populate: userPopulate, filterBuilder: userFilterBuilder, filenamePrefix: 'users', defaultSort: { createdAt: -1 } },
  role: { columns: roleColumns, populate: rolePopulate, filterBuilder: roleFilterBuilder, filenamePrefix: 'roles', defaultSort: { createdAt: -1 } },
  beneficiary: { columns: beneficiaryColumns, populate: beneficiaryPopulate, filterBuilder: beneficiaryFilterBuilder, filenamePrefix: 'beneficiaries', defaultSort: { createdAt: -1 } },
  location: { columns: locationColumns, populate: locationPopulate, filterBuilder: locationFilterBuilder, filenamePrefix: 'locations', defaultSort: { type: 1, name: 1 } },
  scheme: { columns: schemeColumns, populate: schemePopulate, filterBuilder: schemeFilterBuilder, filenamePrefix: 'schemes', defaultSort: { createdAt: -1 } },
  project: { columns: projectColumns, populate: projectPopulate, filterBuilder: projectFilterBuilder, filenamePrefix: 'projects', defaultSort: { createdAt: -1 } },
  partner: { columns: partnerColumns, populate: partnerPopulate, filterBuilder: partnerFilterBuilder, filenamePrefix: 'partners', defaultSort: { order: 1 } }
};
