import { useState, useEffect } from "react";
import { IndianRupee, Calendar, Download, Eye, Wallet, Loader2, Edit, Save, X, Grid, List, AlertCircle, Clock, CheckCircle2, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { useRBAC } from "@/hooks/useRBAC";
import { payments } from "@/lib/api";
import { GenericFilters } from "@/components/filters/GenericFilters";
import { usePaymentFilters } from "@/hooks/usePaymentFilters";
import { useExport } from '@/hooks/useExport';
import ExportButton from '@/components/common/ExportButton';
import { paymentExportColumns } from '@/utils/exportColumns';
import { Input } from "@/components/ui/input";

interface PaymentSchedule {
  id: string;
  paymentNumber: string;
  beneficiaryId: string;
  beneficiaryName: string;
  beneficiaryGender?: string;
  scheme: string;
  schemeId?: string;
  project: string;
  projectId?: string;
  phase: string;
  percentage: number;
  amount: number;
  dueDate: string;
  status: string;
  approvedAmount: number;
  type: string;
  method: string;
  source?: 'direct' | 'interview'; // Track if payment came from approved interview
  interviewId?: string; // Reference to interview if applicable
  applicationId?: string; // Reference to original application
  approvalRemarks?: string; // Approval remarks/comments
  approvedBy?: string; // Who approved the payment
  approvedAt?: string; // When it was approved
  distributionTimeline?: Array<{
    description: string;
    percentage: number;
    daysFromApproval: number;
    requiresVerification: boolean;
    notes?: string;
  }>; // Money distribution timeline from scheme
  isRecurring?: boolean; // Flag to indicate if this is a recurring payment
  recurringPaymentNumber?: number; // Which installment this is (1, 2, 3, etc.)
  totalRecurringPayments?: number; // Total number of recurring payments
  recurringPeriod?: 'monthly' | 'quarterly' | 'semi_annually' | 'annually'; // Payment frequency
}

const statusConfig = {
  pending: { color: "bg-warning/10 text-warning border-warning/20", label: "Pending", icon: Clock },
  processing: { color: "bg-blue/10 text-blue border-blue/20", label: "Processing", icon: Loader2 },
  completed: { color: "bg-success/10 text-success border-success/20", label: "Completed", icon: CheckCircle2 },
  failed: { color: "bg-destructive/10 text-destructive border-destructive/20", label: "Failed", icon: AlertCircle },
  cancelled: { color: "bg-muted/10 text-muted border-muted/20", label: "Cancelled", icon: X },
  overdue: { color: "bg-destructive/10 text-destructive border-destructive/20", label: "Overdue", icon: AlertCircle },
  due: { color: "bg-warning/10 text-warning border-warning/20", label: "Due Soon", icon: Clock },
  upcoming: { color: "bg-info/10 text-info border-info/20", label: "Upcoming", icon: Calendar },
};

export default function BeneficiaryPayments() {
  const { hasAnyPermission, hasPermission } = useRBAC();
  const filterHook = usePaymentFilters();
  const { exportCSV, exportPDF, printData, exporting } = useExport({
    apiCall: (params) => payments.export(params),
    filenamePrefix: 'payments',
    pdfTitle: 'Payments Report',
    pdfColumns: paymentExportColumns,
    getFilterParams: () => filterHook.getExportParams(),
  });
  
  // Permission checks
  const canViewPayments = hasAnyPermission(['finances.read.all', 'finances.read.regional', 'super_admin', 'state_admin']);
  const canManagePayments = hasAnyPermission(['finances.manage', 'finances.read.regional', 'finances.read.all', 'super_admin', 'state_admin']);
  
  const [paymentSchedules, setPaymentSchedules] = useState<PaymentSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<PaymentSchedule | null>(null);
  const [editingSchedule, setEditingSchedule] = useState<PaymentSchedule | null>(null);
  const [pagination, setPagination] = useState({ current: 1, pages: 1, total: 0, limit: 10 });
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [activeTab, setActiveTab] = useState("all");

  // Load payments data with filters
  useEffect(() => {
    if (canViewPayments) {
      loadPayments();
    } else {
      setLoading(false);
    }
  }, [
    canViewPayments,
    filterHook.filters.currentPage,
    filterHook.filters.searchTerm,
    filterHook.filters.statusFilter,
    filterHook.filters.projectFilter,
    filterHook.filters.districtFilter,
    filterHook.filters.areaFilter,
    filterHook.filters.unitFilter,
    filterHook.filters.schemeFilter,
    filterHook.filters.genderFilter,
    filterHook.filters.methodFilter,
    filterHook.filters.fromDate,
    filterHook.filters.toDate,
    filterHook.filters.quickDateFilter,
    pagination.limit,
  ]);

  const loadPayments = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = filterHook.getApiParams(filterHook.filters.currentPage, pagination.limit);
      const response = await payments.getAll(params);
      
      if (response.success) {
        setPaymentSchedules(response.data.payments);
        setPagination(response.data.pagination);
      } else {
        setError(response.message || "Failed to load payments");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load payments");
      toast({
        title: "Error",
        description: "Failed to load payment data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Access denied check
  if (!canViewPayments) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Wallet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
          <p className="text-muted-foreground">
            You don't have permission to view payment distributions.
          </p>
        </div>
      </div>
    );
  }



  const handleViewDetails = (schedule: PaymentSchedule) => {
    setSelectedSchedule(schedule);
    setShowViewModal(true);
  };

  const handleDownloadReceipt = (schedule: PaymentSchedule) => {
    // Generate beautiful HTML content for PDF receipt with People's Foundation ERP branding
    const receiptHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>People's Foundation ERP Payment Receipt</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
          line-height: 1.6; 
          color: #2c3e50;
          background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
          min-height: 100vh;
          padding: 20px;
        }
        .receipt-container {
          max-width: 800px;
          margin: 0 auto;
          background: white;
          border-radius: 15px;
          box-shadow: 0 20px 40px rgba(0,0,0,0.1);
          overflow: hidden;
        }
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 30px;
          text-align: center;
          position: relative;
        }
        .header::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grain" width="100" height="100" patternUnits="userSpaceOnUse"><circle cx="25" cy="25" r="1" fill="rgba(255,255,255,0.1)"/><circle cx="75" cy="75" r="1" fill="rgba(255,255,255,0.1)"/><circle cx="50" cy="10" r="0.5" fill="rgba(255,255,255,0.1)"/></pattern></defs><rect width="100" height="100" fill="url(%23grain)"/></svg>');
          opacity: 0.3;
        }
        .logo-section {
          position: relative;
          z-index: 2;
          margin-bottom: 20px;
        }
        .logo {
          width: 80px;
          height: 80px;
          background: white;
          border-radius: 50%;
          margin: 0 auto 15px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          font-weight: bold;
          color: #667eea;
          box-shadow: 0 8px 25px rgba(0,0,0,0.15);
        }
        .org-name {
          font-size: 28px;
          font-weight: 700;
          margin-bottom: 5px;
          text-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }
        .org-tagline {
          font-size: 14px;
          opacity: 0.9;
          font-weight: 300;
        }
        .receipt-title {
          background: #34495e;
          color: white;
          padding: 15px 30px;
          font-size: 20px;
          font-weight: 600;
          text-align: center;
          letter-spacing: 1px;
        }
        .content {
          padding: 30px;
        }
        .receipt-info {
          display: flex;
          justify-content: space-between;
          margin-bottom: 30px;
          padding: 20px;
          background: #f8f9fa;
          border-radius: 10px;
          border-left: 5px solid #667eea;
        }
        .receipt-number {
          font-size: 18px;
          font-weight: 600;
          color: #2c3e50;
        }
        .receipt-date {
          color: #7f8c8d;
          font-size: 14px;
        }
        .section {
          margin-bottom: 25px;
          background: white;
          border-radius: 10px;
          overflow: hidden;
          box-shadow: 0 2px 10px rgba(0,0,0,0.05);
        }
        .section-header {
          background: linear-gradient(135deg, #74b9ff 0%, #0984e3 100%);
          color: white;
          padding: 15px 20px;
          font-size: 16px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .section-content {
          padding: 20px;
        }
        .detail-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 0;
          border-bottom: 1px solid #ecf0f1;
        }
        .detail-row:last-child {
          border-bottom: none;
        }
        .detail-label {
          font-weight: 600;
          color: #2c3e50;
          flex: 1;
        }
        .detail-value {
          flex: 2;
          text-align: right;
          color: #34495e;
        }
        .amount-highlight {
          font-size: 24px;
          font-weight: 700;
          color: #27ae60;
          text-shadow: 0 1px 2px rgba(0,0,0,0.1);
        }
        .status-badge {
          display: inline-block;
          padding: 6px 15px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .status-completed {
          background: #d4edda;
          color: #155724;
          border: 1px solid #c3e6cb;
        }
        .status-cancelled {
          background: #f8d7da;
          color: #721c24;
          border: 1px solid #f5c6cb;
        }
        .footer {
          background: #2c3e50;
          color: white;
          padding: 25px 30px;
          text-align: center;
        }
        .footer-note {
          font-size: 14px;
          margin-bottom: 10px;
          opacity: 0.9;
        }
        .footer-timestamp {
          font-size: 12px;
          opacity: 0.7;
        }
        .watermark {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(-45deg);
          font-size: 120px;
          color: rgba(102, 126, 234, 0.05);
          font-weight: 900;
          z-index: 0;
          pointer-events: none;
        }
        @media print {
          body { background: white; padding: 0; }
          .receipt-container { box-shadow: none; }
          .watermark { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="watermark">PEOPLE'S FOUNDATION ERP</div>
      <div class="receipt-container">
        <!-- Header with Logo and Organization Info -->
        <div class="header">
          <div class="logo-section">
            <div class="logo">BZ</div>
            <div class="org-name">PEOPLE'S FOUNDATION ERP</div>
            <div class="org-tagline">Empowering Communities Through Compassionate Support</div>
          </div>
        </div>
        
        <div class="receipt-title">PAYMENT RECEIPT</div>
        
        <div class="content">
          <!-- Receipt Information -->
          <div class="receipt-info">
            <div>
              <div class="receipt-number">Receipt #${schedule.paymentNumber}</div>
              <div class="receipt-date">Generated on ${new Date().toLocaleDateString('en-IN', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}</div>
            </div>
            <div style="text-align: right;">
              <div class="status-badge status-${schedule.status}">${schedule.status.toUpperCase()}</div>
            </div>
          </div>

          <!-- Beneficiary Details -->
          <div class="section">
            <div class="section-header">👤 Beneficiary Information</div>
            <div class="section-content">
              <div class="detail-row">
                <span class="detail-label">Full Name</span>
                <span class="detail-value">${schedule.beneficiaryName}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Beneficiary ID</span>
                <span class="detail-value">${schedule.beneficiaryId}</span>
              </div>
            </div>
          </div>

          <!-- Program Details -->
          <div class="section">
            <div class="section-header">📋 Program Information</div>
            <div class="section-content">
              <div class="detail-row">
                <span class="detail-label">Scheme</span>
                <span class="detail-value">${schedule.scheme}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Project</span>
                <span class="detail-value">${schedule.project}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Phase</span>
                <span class="detail-value">${schedule.phase}</span>
              </div>
            </div>
          </div>

          <!-- Payment Details -->
          <div class="section">
            <div class="section-header">💰 Payment Details</div>
            <div class="section-content">
              <div class="detail-row">
                <span class="detail-label">Amount</span>
                <span class="detail-value amount-highlight">₹${schedule.amount?.toLocaleString('en-IN')}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Payment Method</span>
                <span class="detail-value">${schedule.method || 'Bank Transfer'}</span>
              </div>
              ${schedule.chequeNumber ? `
              <div class="detail-row">
                <span class="detail-label">Cheque Number</span>
                <span class="detail-value">${schedule.chequeNumber}</span>
              </div>
              ` : ''}
              <div class="detail-row">
                <span class="detail-label">Payment Date</span>
                <span class="detail-value">${schedule.paymentDate ? new Date(schedule.paymentDate).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN')}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="footer">
          <div class="footer-note">
            This is a computer-generated receipt and does not require a signature.
          </div>
          <div class="footer-note">
            For any queries, please contact People's Foundation ERP Support Team
          </div>
          <div class="footer-timestamp">
            Document generated on ${new Date().toLocaleString('en-IN')} | Receipt ID: ${schedule.paymentNumber}
          </div>
        </div>
      </div>
    </body>
    </html>
    `;

    // Create a new window and print as PDF
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(receiptHTML);
      printWindow.document.close();
      
      // Wait for content to load then trigger print
      printWindow.onload = () => {
        printWindow.print();
        // Close the window after printing
        setTimeout(() => {
          printWindow.close();
        }, 1000);
      };
    }

    toast({
      title: "Receipt Generated",
      description: `Receipt for payment ${schedule.paymentNumber} is ready for download.`,
    });
  };

  const handleEditSchedule = (schedule: PaymentSchedule) => {
    setEditingSchedule({ ...schedule, status: "completed" });
    setShowEditModal(true);
  };

  const validateEditForm = () => {
    if (!editingSchedule) return false;
    
    if (!editingSchedule.beneficiaryName?.trim()) {
      toast({
        title: "Validation Error",
        description: "Beneficiary name is required",
        variant: "destructive",
      });
      return false;
    }
    
    if (editingSchedule.amount <= 0) {
      toast({
        title: "Validation Error",
        description: "Amount must be greater than 0",
        variant: "destructive",
      });
      return false;
    }
    
    if (editingSchedule.percentage < 0 || editingSchedule.percentage > 100) {
      toast({
        title: "Validation Error",
        description: "Percentage must be between 0 and 100",
        variant: "destructive",
      });
      return false;
    }
    
    return true;
  };

  const handleSaveEdit = async () => {
    if (!editingSchedule || !validateEditForm()) return;

    try {
      const updateData = {
        amount: editingSchedule.amount,
        dueDate: editingSchedule.dueDate,
        method: editingSchedule.method,
        phase: editingSchedule.phase,
        percentage: editingSchedule.percentage,
        status: editingSchedule.status
      };

      const response = await payments.update(editingSchedule.id, updateData);
      
      if (response.success) {
        // Reload the payments to get the updated data
        await loadPayments();
        
        toast({
          title: "Payment Updated",
          description: "Payment schedule has been updated successfully.",
        });
        
        setShowEditModal(false);
        setEditingSchedule(null);
      } else {
        throw new Error(response.message || 'Failed to update payment');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update payment schedule",
        variant: "destructive",
      });
    }
  };

  const handleCancelEdit = () => {
    setShowEditModal(false);
    setEditingSchedule(null);
  };

  const getStatusColor = (status: string) => {
    return statusConfig[status as keyof typeof statusConfig]?.color || "bg-muted";
  };

  const getStatusLabel = (status: string) => {
    return statusConfig[status as keyof typeof statusConfig]?.label || status;
  };

  const getStatusIcon = (status: string) => {
    return statusConfig[status as keyof typeof statusConfig]?.icon || Clock;
  };

  // Function to determine timeline-based status for pending payments
  const getTimelineStatus = (schedule: PaymentSchedule) => {
    if (schedule.status !== 'pending') {
      return schedule.status; // Return actual status if not pending
    }

    if (!schedule.dueDate) {
      return 'pending';
    }

    const today = new Date();
    const dueDate = new Date(schedule.dueDate);
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return 'overdue'; // Past due date
    } else if (diffDays <= 7) {
      return 'due'; // Due within 7 days
    } else {
      return 'upcoming'; // Future payment
    }
  };

  const getDaysDifference = (dateString: string) => {
    const today = new Date();
    const dueDate = new Date(dateString);
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Filter payments based on active tab (client-side for tab filtering only)
  const getFilteredPayments = () => {
    const baseData = paymentSchedules;
    
    if (activeTab === "all") {
      return baseData;
    }
    
    return baseData.filter(schedule => {
      const timelineStatus = getTimelineStatus(schedule);
      return timelineStatus === activeTab;
    });
  };

  const filteredPayments = getFilteredPayments();

  // Calculate counts for each tab (based on current page data)
  const baseData = paymentSchedules;
  const allCount = baseData.length;
  const overdueCount = baseData.filter(p => getTimelineStatus(p) === "overdue").length;
  const dueCount = baseData.filter(p => getTimelineStatus(p) === "due").length;
  const upcomingCount = baseData.filter(p => getTimelineStatus(p) === "upcoming").length;
  const completedCount = baseData.filter(p => p.status === "completed").length;
  const processingCount = baseData.filter(p => p.status === "processing").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-lg font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
            Payment Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Comprehensive payment tracking, processing, and distribution management
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton
            onExportCSV={() => exportCSV()}
            onExportPDF={() => exportPDF()}
            onPrint={() => printData()}
            exporting={exporting}
          />
          {/* View Mode Toggle */}
          <div className="flex items-center border rounded-lg p-1">
            <Button
              variant={viewMode === 'cards' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('cards')}
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'table' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('table')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <GenericFilters
        searchTerm={filterHook.filters.searchTerm}
        onSearchChange={filterHook.setSearchTerm}
        searchPlaceholder="Search by name, ID, or payment number..."
        showStatusFilter={true}
        statusFilter={filterHook.filters.statusFilter}
        onStatusChange={filterHook.setStatusFilter}
        statusOptions={[
          { value: "all", label: "All Status" },
          { value: "pending", label: "Pending" },
          { value: "processing", label: "Processing" },
          { value: "completed", label: "Completed" },
          { value: "failed", label: "Failed" },
          { value: "cancelled", label: "Cancelled" },
        ]}
        showProjectFilter={true}
        projectFilter={filterHook.filters.projectFilter}
        onProjectChange={filterHook.setProjectFilter}
        projectOptions={filterHook.dropdownOptions.projectOptions}
        showDistrictFilter={true}
        districtFilter={filterHook.filters.districtFilter}
        onDistrictChange={filterHook.setDistrictFilter}
        districtOptions={filterHook.dropdownOptions.districtOptions}
        showAreaFilter={true}
        areaFilter={filterHook.filters.areaFilter}
        onAreaChange={filterHook.setAreaFilter}
        areaOptions={filterHook.dropdownOptions.areaOptions}
        showUnitFilter={true}
        unitFilter={filterHook.filters.unitFilter}
        onUnitChange={filterHook.setUnitFilter}
        unitOptions={filterHook.dropdownOptions.unitOptions}
        showSchemeFilter={true}
        schemeFilter={filterHook.filters.schemeFilter}
        onSchemeChange={filterHook.setSchemeFilter}
        schemeOptions={filterHook.dropdownOptions.schemeOptions}
        showGenderFilter={true}
        genderFilter={filterHook.filters.genderFilter}
        onGenderChange={filterHook.setGenderFilter}
        showMethodFilter={true}
        methodFilter={filterHook.filters.methodFilter}
        onMethodChange={filterHook.setMethodFilter}
        showDateFilters={true}
        fromDate={filterHook.filters.fromDate}
        onFromDateChange={filterHook.setFromDate}
        toDate={filterHook.filters.toDate}
        onToDateChange={filterHook.setToDate}
        showQuickDateFilter={true}
        quickDateFilter={filterHook.filters.quickDateFilter}
        onQuickDateFilterChange={filterHook.setQuickDateFilter}
        onClearFilters={filterHook.clearAllFilters}
      />

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading payment data...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Wallet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Error Loading Payments</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={loadPayments}>Try Again</Button>
          </div>
        </div>
      )}

      {/* Results Summary */}
      {!loading && !error && paymentSchedules.length > 0 && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div>
                Showing {paymentSchedules.length} payments on page {pagination.current} of {pagination.pages} (Total: {pagination.total})
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment Management Tabs */}
      {!loading && !error && (
        <Card>
          <CardHeader>
            <CardTitle>Payment Management</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList className="grid w-full grid-cols-6">
                <TabsTrigger value="all">All ({allCount})</TabsTrigger>
                <TabsTrigger value="overdue">Overdue ({overdueCount})</TabsTrigger>
                <TabsTrigger value="due">Due Soon ({dueCount})</TabsTrigger>
                <TabsTrigger value="upcoming">Upcoming ({upcomingCount})</TabsTrigger>
                <TabsTrigger value="processing">Processing ({processingCount})</TabsTrigger>
                <TabsTrigger value="completed">Completed ({completedCount})</TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab} className="space-y-4">
                {filteredPayments.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No payments found for this category</p>
                  </div>
                ) : viewMode === 'cards' ? (
                  /* Cards View */
                  <div className="grid gap-4">
                    {filteredPayments.map((schedule) => {
                      const timelineStatus = getTimelineStatus(schedule);
                      const StatusIcon = getStatusIcon(timelineStatus);
                      const daysDiff = schedule.dueDate ? getDaysDifference(schedule.dueDate) : null;
                      
                      return (
                        <Card key={schedule.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-xl">{schedule.beneficiaryName}</CardTitle>
                      {schedule.source === 'interview' && (
                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-600 border-blue-200">
                          From Interview
                        </Badge>
                      )}
                      {schedule.isRecurring && (
                        <Badge variant="outline" className="text-xs bg-purple-50 text-purple-600 border-purple-200">
                          <Repeat className="h-3 w-3 mr-1" />
                          Recurring {schedule.recurringPaymentNumber}/{schedule.totalRecurringPayments}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{schedule.paymentNumber}</p>
                    <p className="text-xs text-muted-foreground">ID: {schedule.beneficiaryId}</p>
                  </div>
                      <Badge className={getStatusColor(timelineStatus)}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {getStatusLabel(timelineStatus)}
                        {daysDiff !== null && timelineStatus !== 'completed' && (
                          <span className="ml-1 text-xs">
                            ({daysDiff > 0 ? `${daysDiff}d` : `${Math.abs(daysDiff)}d overdue`})
                          </span>
                        )}
                      </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <IndianRupee className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Amount:</span>
                      <span className="text-muted-foreground">₹{schedule.amount.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">Phase:</span>
                      <span className="text-muted-foreground">{schedule.phase}</span>
                    </div>
                    {schedule.isRecurring && schedule.recurringPeriod && (
                      <div className="flex items-center gap-2 text-sm">
                        <Repeat className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Period:</span>
                        <span className="text-muted-foreground capitalize">
                          {schedule.recurringPeriod.replace('_', ' ')}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">Percentage:</span>
                      <span className="text-muted-foreground">{schedule.percentage}%</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">Gender:</span>
                      <span className="text-muted-foreground">
                        {schedule.beneficiaryGender ? 
                          schedule.beneficiaryGender.charAt(0).toUpperCase() + schedule.beneficiaryGender.slice(1) : 
                          'N/A'
                        }
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Due Date:</span>
                      <span className="text-muted-foreground">
                        {new Date(schedule.dueDate).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">Project:</span>
                      <span className="text-muted-foreground">{schedule.project || 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">Scheme:</span>
                      <span className="text-muted-foreground">{schedule.scheme}</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleViewDetails(schedule)}
                    title="View Details"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  {canManagePayments && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleEditSchedule(schedule)}
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      Process Payment
                    </Button>
                  )}
                  {schedule.status === "completed" && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleDownloadReceipt(schedule)}
                      title="Download Receipt"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
                        </Card>
                      );
                    })}
                  </div>
          ) : (
            /* Table View */
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Beneficiary</TableHead>
                      <TableHead>Payment Number</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Scheme</TableHead>
                      <TableHead>Gender</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPayments.map((schedule) => {
                      const timelineStatus = getTimelineStatus(schedule);
                      const StatusIcon = getStatusIcon(timelineStatus);
                      const daysDiff = schedule.dueDate ? getDaysDifference(schedule.dueDate) : null;
                      
                      return (
                      <TableRow key={schedule.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium flex items-center gap-2">
                              {schedule.beneficiaryName}
                              {schedule.source === 'interview' && (
                                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-600 border-blue-200">
                                  Interview
                                </Badge>
                              )}
                              {schedule.isRecurring && (
                                <Badge variant="outline" className="text-xs bg-purple-50 text-purple-600 border-purple-200">
                                  <Repeat className="h-3 w-3 mr-1" />
                                  {schedule.recurringPaymentNumber}/{schedule.totalRecurringPayments}
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground">ID: {schedule.beneficiaryId}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-mono text-sm">{schedule.paymentNumber}</div>
                          <div className="text-xs text-muted-foreground">
                            ({getStatusLabel(getTimelineStatus(schedule))})
                          </div>
                        </TableCell>
                        <TableCell>{schedule.project || 'N/A'}</TableCell>
                        <TableCell>{schedule.scheme}</TableCell>
                        <TableCell>
                          {schedule.beneficiaryGender ? 
                            schedule.beneficiaryGender.charAt(0).toUpperCase() + schedule.beneficiaryGender.slice(1) : 
                            'N/A'
                          }
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">₹{schedule.amount.toLocaleString()}</div>
                          <div className="text-xs text-muted-foreground">({schedule.phase})</div>
                        </TableCell>
                        <TableCell>
                          <div>{new Date(schedule.dueDate).toLocaleDateString()}</div>
                          {daysDiff !== null && timelineStatus !== 'completed' && (
                            <div className="text-xs text-muted-foreground">
                              {daysDiff > 0 ? `Due in ${daysDiff}d` : `${Math.abs(daysDiff)}d overdue`}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleViewDetails(schedule)}
                              title="View Details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {canManagePayments && (
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => handleEditSchedule(schedule)}
                                title="Process Payment"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                            {schedule.status === "completed" && (
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => handleDownloadReceipt(schedule)}
                                title="Download Receipt"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                </div>
              </CardContent>
            </Card>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!loading && !error && paymentSchedules.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Wallet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium">No payment schedules found</p>
            <p className="text-sm text-muted-foreground mt-1">
              Try adjusting your search or filters
            </p>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {!loading && !error && pagination.pages > 1 && (
        <div className="mt-6">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => filterHook.setCurrentPage(Math.max(1, filterHook.filters.currentPage - 1))}
                  className={filterHook.filters.currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
              {[...Array(pagination.pages)].map((_, i) => (
                <PaginationItem key={i}>
                  <PaginationLink
                    onClick={() => filterHook.setCurrentPage(i + 1)}
                    isActive={filterHook.filters.currentPage === i + 1}
                    className="cursor-pointer"
                  >
                    {i + 1}
                  </PaginationLink>
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext 
                  onClick={() => filterHook.setCurrentPage(Math.min(pagination.pages, filterHook.filters.currentPage + 1))}
                  className={filterHook.filters.currentPage === pagination.pages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      {/* View Details Modal */}
      <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Payment Details</DialogTitle>
          </DialogHeader>
          {selectedSchedule && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Payment Number</Label>
                  <p className="text-sm text-muted-foreground">{selectedSchedule.paymentNumber}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Status</Label>
                  <Badge className={getStatusColor(selectedSchedule.status)}>
                    {getStatusLabel(selectedSchedule.status)}
                  </Badge>
                </div>
                <div>
                  <Label className="text-sm font-medium">Beneficiary</Label>
                  <p className="text-sm text-muted-foreground">{selectedSchedule.beneficiaryName}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Amount</Label>
                  <p className="text-sm text-muted-foreground">₹{selectedSchedule.amount.toLocaleString()}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Scheme</Label>
                  <p className="text-sm text-muted-foreground">{selectedSchedule.scheme}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Project</Label>
                  <p className="text-sm text-muted-foreground">{selectedSchedule.project}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Due Date</Label>
                  <p className="text-sm text-muted-foreground">
                    {new Date(selectedSchedule.dueDate).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Payment Method</Label>
                  <p className="text-sm text-muted-foreground">{selectedSchedule.method}</p>
                </div>
              </div>
              
              {/* Approval Information */}
              {(selectedSchedule.approvalRemarks || selectedSchedule.approvedBy) && (
                <div className="space-y-3 border-t pt-4">
                  <Label className="text-base font-semibold">Approval Information</Label>
                  {selectedSchedule.approvalRemarks && (
                    <div>
                      <Label className="text-sm font-medium">Approval Remarks</Label>
                      <p className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-md">
                        {selectedSchedule.approvalRemarks}
                      </p>
                    </div>
                  )}
                  {selectedSchedule.approvedBy && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium">Approved By</Label>
                        <p className="text-sm text-muted-foreground">{selectedSchedule.approvedBy}</p>
                      </div>
                      {selectedSchedule.approvedAt && (
                        <div>
                          <Label className="text-sm font-medium">Approved At</Label>
                          <p className="text-sm text-muted-foreground">
                            {new Date(selectedSchedule.approvedAt).toLocaleDateString()}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Money Distribution Timeline */}
              <div className="space-y-3 border-t pt-4">
                <Label className="text-base font-semibold">Money Distribution Timeline</Label>
                {selectedSchedule.distributionTimeline && selectedSchedule.distributionTimeline.length > 0 ? (
                  <div className="space-y-3">
                    {selectedSchedule.distributionTimeline.map((phase: any, index: number) => (
                      <div key={index} className="border rounded-lg p-3 bg-muted/20">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-medium">
                              {index + 1}
                            </div>
                            <span className="font-medium">{phase.description}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {phase.percentage}%
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              ₹{Math.round((selectedSchedule.amount * phase.percentage) / 100).toLocaleString()}
                            </Badge>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                          <div>
                            <span className="font-medium">Due:</span> {phase.daysFromApproval} days from approval
                          </div>
                          <div>
                            <span className="font-medium">Verification:</span> {phase.requiresVerification ? 'Required' : 'Not Required'}
                          </div>
                        </div>
                        {phase.notes && (
                          <div className="mt-2 text-sm text-muted-foreground">
                            <span className="font-medium">Notes:</span> {phase.notes}
                          </div>
                        )}
                      </div>
                    ))}
                    <div className="bg-blue-50 p-3 rounded-md">
                      <div className="flex items-center gap-2 text-sm text-blue-800">
                        <IndianRupee className="h-4 w-4" />
                        <span className="font-medium">Total Distribution:</span>
                        <span>
                          {selectedSchedule.distributionTimeline.reduce((sum: number, phase: any) => sum + phase.percentage, 0)}% 
                          = ₹{selectedSchedule.amount.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    <p>No distribution timeline available for this payment.</p>
                    <p className="text-sm">This payment may not have a configured distribution schedule.</p>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowViewModal(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Payment Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Process Payment</DialogTitle>
          </DialogHeader>
          {editingSchedule && (
            <div className="space-y-4">
              {/* Display-only information */}
              <div className="bg-muted/30 p-4 rounded-md space-y-2">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Beneficiary:</span> {editingSchedule.beneficiaryName}
                  </div>
                  <div>
                    <span className="font-medium">Amount:</span> ₹{editingSchedule.amount?.toLocaleString()}
                  </div>
                  <div>
                    <span className="font-medium">Phase:</span> {editingSchedule.phase}
                  </div>
                  <div>
                    <span className="font-medium">Scheme:</span> {editingSchedule.scheme}
                  </div>
                </div>
              </div>

              {/* Editable fields for payment processing */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Status</Label>
                  <Select
                    value={editingSchedule.status}
                    onValueChange={(value) => setEditingSchedule({
                      ...editingSchedule,
                      status: value
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium">Payment Date</Label>
                  <Input
                    type="date"
                    value={editingSchedule.paymentDate ? new Date(editingSchedule.paymentDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}
                    onChange={(e) => setEditingSchedule({
                      ...editingSchedule,
                      paymentDate: e.target.value
                    })}
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">Payment Method</Label>
                  <Select
                    value={editingSchedule.method}
                    onValueChange={(value) => setEditingSchedule({
                      ...editingSchedule,
                      method: value,
                      chequeNumber: value === 'cheque' ? editingSchedule.chequeNumber : '' // Clear cheque number if not cheque
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="digital_wallet">Digital Wallet</SelectItem>
                      <SelectItem value="upi">UPI</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {editingSchedule.method === 'cheque' && (
                  <div>
                    <Label className="text-sm font-medium">Cheque Number</Label>
                    <Input
                      value={editingSchedule.chequeNumber || ''}
                      onChange={(e) => setEditingSchedule({
                        ...editingSchedule,
                        chequeNumber: e.target.value
                      })}
                      placeholder="Enter cheque number"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelEdit}>
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            <Button onClick={handleSaveEdit}>
              <Save className="mr-2 h-4 w-4" />
              Mark as Payment Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}