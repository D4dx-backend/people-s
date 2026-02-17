/**
 * Export Column Definitions
 *
 * Frontend column configs for PDF/Print export, mirroring api/src/config/exportConfigs.js.
 * Used by useExport hook across all pages.
 */

import type { ExportColumn } from './export';

// ==================== PAYMENTS ====================
export const paymentExportColumns: ExportColumn[] = [
  { header: 'Payment Number', accessor: 'paymentNumber' },
  { header: 'Beneficiary Name', accessor: 'beneficiary.name' },
  { header: 'Beneficiary Phone', accessor: 'beneficiary.phone' },
  { header: 'Scheme', accessor: 'scheme.name' },
  { header: 'Project', accessor: 'project.name' },
  { header: 'Amount', accessor: 'amount' },
  { header: 'Status', accessor: 'status' },
  { header: 'Method', accessor: 'method' },
  { header: 'Type', accessor: 'type' },
  { header: 'Created At', accessor: 'createdAt' },
];

// ==================== APPLICATIONS ====================
export const applicationExportColumns: ExportColumn[] = [
  { header: 'Application Number', accessor: 'applicationNumber' },
  { header: 'Beneficiary Name', accessor: 'beneficiary.name' },
  { header: 'Phone', accessor: 'beneficiary.phone' },
  { header: 'Scheme', accessor: 'scheme.name' },
  { header: 'Project', accessor: 'project.name' },
  { header: 'Status', accessor: 'status' },
  { header: 'Stage', accessor: 'currentStage' },
  { header: 'Requested Amount', accessor: 'requestedAmount' },
  { header: 'Approved Amount', accessor: 'approvedAmount' },
  { header: 'District', accessor: 'district.name' },
  { header: 'Area', accessor: 'area.name' },
  { header: 'Unit', accessor: 'unit.name' },
  { header: 'Applied Date', accessor: 'createdAt' },
];

// ==================== DONORS ====================
export const donorExportColumns: ExportColumn[] = [
  { header: 'Name', accessor: 'name' },
  { header: 'Email', accessor: 'email' },
  { header: 'Phone', accessor: 'phone' },
  { header: 'Type', accessor: 'type' },
  { header: 'Category', accessor: 'category' },
  { header: 'Status', accessor: 'status' },
  { header: 'City', accessor: 'address.city' },
  { header: 'Total Donated', accessor: 'donationStats.totalDonated' },
  { header: 'Donation Count', accessor: 'donationStats.donationCount' },
  { header: 'Last Donation', accessor: 'donationStats.lastDonation' },
  { header: 'Verified', accessor: 'isVerified' },
  { header: 'Created At', accessor: 'createdAt' },
];

// ==================== DONATIONS ====================
export const donationExportColumns: ExportColumn[] = [
  { header: 'Donation Number', accessor: 'donationNumber' },
  { header: 'Donor Name', accessor: 'donor.name' },
  { header: 'Donor Phone', accessor: 'donor.phone' },
  { header: 'Amount', accessor: 'amount' },
  { header: 'Currency', accessor: 'currency' },
  { header: 'Method', accessor: 'method' },
  { header: 'Status', accessor: 'status' },
  { header: 'Purpose', accessor: 'purpose' },
  { header: 'Project', accessor: 'project.name' },
  { header: 'Receipt Number', accessor: 'receipt.receiptNumber' },
  { header: 'Created At', accessor: 'createdAt' },
];

// ==================== USERS ====================
export const userExportColumns: ExportColumn[] = [
  { header: 'Name', accessor: 'name' },
  { header: 'Email', accessor: 'email' },
  { header: 'Phone', accessor: 'phone' },
  { header: 'Role', accessor: 'role' },
  { header: 'Scope Level', accessor: 'adminScope.level' },
  { header: 'Active', accessor: 'isActive' },
  { header: 'Verified', accessor: 'isVerified' },
  { header: 'Last Login', accessor: 'lastLogin' },
  { header: 'Created At', accessor: 'createdAt' },
];

// ==================== ROLES ====================
export const roleExportColumns: ExportColumn[] = [
  { header: 'Name', accessor: 'name' },
  { header: 'Display Name', accessor: 'displayName' },
  { header: 'Description', accessor: 'description' },
  { header: 'Type', accessor: 'type' },
  { header: 'Category', accessor: 'category' },
  { header: 'Level', accessor: 'level' },
  { header: 'Active', accessor: 'isActive' },
  { header: 'Total Users', accessor: 'stats.totalUsers' },
  { header: 'Created At', accessor: 'createdAt' },
];

// ==================== BENEFICIARIES ====================
export const beneficiaryExportColumns: ExportColumn[] = [
  { header: 'Name', accessor: 'name' },
  { header: 'Phone', accessor: 'phone' },
  { header: 'Status', accessor: 'status' },
  { header: 'Verified', accessor: 'isVerified' },
  { header: 'District', accessor: 'district.name' },
  { header: 'Area', accessor: 'area.name' },
  { header: 'Unit', accessor: 'unit.name' },
  { header: 'Created At', accessor: 'createdAt' },
];

// ==================== LOCATIONS ====================
export const locationExportColumns: ExportColumn[] = [
  { header: 'Name', accessor: 'name' },
  { header: 'Type', accessor: 'type' },
  { header: 'Code', accessor: 'code' },
  { header: 'Parent', accessor: 'parent.name' },
  { header: 'Population', accessor: 'population' },
  { header: 'Contact Person', accessor: 'contactPerson.name' },
  { header: 'Contact Phone', accessor: 'contactPerson.phone' },
  { header: 'Active', accessor: 'isActive' },
  { header: 'Created At', accessor: 'createdAt' },
];

// ==================== SCHEMES ====================
export const schemeExportColumns: ExportColumn[] = [
  { header: 'Name', accessor: 'name' },
  { header: 'Code', accessor: 'code' },
  { header: 'Category', accessor: 'category' },
  { header: 'Priority', accessor: 'priority' },
  { header: 'Description', accessor: 'description' },
  { header: 'Active', accessor: 'isActive' },
  { header: 'Created At', accessor: 'createdAt' },
];

// ==================== PROJECTS ====================
export const projectExportColumns: ExportColumn[] = [
  { header: 'Name', accessor: 'name' },
  { header: 'Code', accessor: 'code' },
  { header: 'Category', accessor: 'category' },
  { header: 'Priority', accessor: 'priority' },
  { header: 'Scope', accessor: 'scope' },
  { header: 'Start Date', accessor: 'startDate' },
  { header: 'Active', accessor: 'isActive' },
  { header: 'Created At', accessor: 'createdAt' },
];

// ==================== PARTNERS ====================
export const partnerExportColumns: ExportColumn[] = [
  { header: 'Name', accessor: 'name' },
  { header: 'Link', accessor: 'link' },
  { header: 'Order', accessor: 'order' },
  { header: 'Status', accessor: 'status' },
  { header: 'Created At', accessor: 'createdAt' },
];
