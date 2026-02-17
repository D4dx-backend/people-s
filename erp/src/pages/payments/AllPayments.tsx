import { useState, useEffect } from "react";
import { IndianRupee, Calendar, Download, Eye, Wallet, Loader2, Edit, Grid, List, Clock, CheckCircle2, AlertCircle, X, Save, Filter, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { useRBAC } from "@/hooks/useRBAC";
import { payments } from "@/lib/api";
import { GenericFilters } from "@/components/filters/GenericFilters";
import { usePaymentFilters } from "@/hooks/usePaymentFilters";
import { useExport } from '@/hooks/useExport';
import ExportButton from '@/components/common/ExportButton';
import { paymentExportColumns } from '@/utils/exportColumns';

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

export default function AllPayments() {
  const { hasAnyPermission } = useRBAC();
  
  // Read URL parameters for initial filter
  const urlParams = new URLSearchParams(window.location.search);
  const urlFilter = urlParams.get('filter') || undefined;
  
  const filterHook = usePaymentFilters(urlFilter);
  const { exportCSV, exportPDF, printData, exporting } = useExport({
    apiCall: (params) => payments.export(params),
    filenamePrefix: 'payments',
    pdfTitle: 'Payments Report',
    pdfColumns: paymentExportColumns,
    getFilterParams: () => filterHook.getExportParams(),
  });
  
  const canViewPayments = hasAnyPermission(['finances.read.all', 'finances.read.regional', 'super_admin', 'state_admin']);
  const canManagePayments = hasAnyPermission(['finances.manage', 'finances.read.regional', 'finances.read.all', 'super_admin', 'state_admin']);
  
  const [paymentSchedules, setPaymentSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<any | null>(null);
  const [editingSchedule, setEditingSchedule] = useState<any | null>(null);
  const [pagination, setPagination] = useState({ current: 1, pages: 1, total: 0, limit: 10 });
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table');
  const [showFilters, setShowFilters] = useState(false);

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

  if (!canViewPayments) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Wallet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
          <p className="text-muted-foreground">You don't have permission to view payment distributions.</p>
        </div>
      </div>
    );
  }

  const handleViewDetails = (schedule: any) => {
    setSelectedSchedule(schedule);
    setShowViewModal(true);
  };

  const handleEditSchedule = (schedule: any) => {
    // Ensure we use _id if id is not present (MongoDB uses _id)
    const scheduleId = schedule._id || schedule.id;
    setEditingSchedule({ 
      ...schedule, 
      id: scheduleId, // Ensure id field is set
      status: schedule.status || "completed" // Preserve existing status or default to completed
    });
    setShowEditModal(true);
  };

  const handleDownloadReceipt = (schedule: any) => {
    toast({
      title: "Receipt Generated",
      description: `Receipt for payment ${schedule.paymentNumber} is ready for download.`,
    });
  };

  const handleSaveEdit = async () => {
    if (!editingSchedule) return;

    try {
      // Get the payment ID - prefer id, fallback to _id
      const paymentId = editingSchedule.id || editingSchedule._id;
      
      if (!paymentId) {
        toast({
          title: "Error",
          description: "Payment ID is missing. Cannot update payment.",
          variant: "destructive",
        });
        return;
      }

      const updateData = {
        amount: editingSchedule.amount,
        dueDate: editingSchedule.dueDate,
        method: editingSchedule.method,
        phase: editingSchedule.phase,
        percentage: editingSchedule.percentage,
        status: editingSchedule.status,
        paymentDate: editingSchedule.paymentDate,
        chequeNumber: editingSchedule.chequeNumber
      };

      console.log('Updating payment with ID:', paymentId, 'Data:', updateData);
      const response = await payments.update(paymentId, updateData);
      
      if (response.success) {
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

  const getTimelineStatus = (schedule: any) => {
    if (schedule.status !== 'pending') {
      return schedule.status;
    }
    if (!schedule.dueDate) {
      return 'pending';
    }
    const today = new Date();
    const dueDate = new Date(schedule.dueDate);
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays < 0) {
      return 'overdue';
    } else if (diffDays <= 7) {
      return 'due';
    } else {
      return 'upcoming';
    }
  };

  const getDaysDifference = (dateString: string) => {
    const today = new Date();
    const dueDate = new Date(dateString);
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-lg font-bold">All Payments</h1>
          <p className="text-muted-foreground mt-1">View and manage all payment schedules</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton
            onExportCSV={() => exportCSV()}
            onExportPDF={() => exportPDF()}
            onPrint={() => printData()}
            exporting={exporting}
          />
          <div className="flex items-center border rounded-lg p-1">
            <Button variant={viewMode === 'cards' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('cards')}>
              <Grid className="h-4 w-4" />
            </Button>
            <Button variant={viewMode === 'table' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('table')}>
              <List className="h-4 w-4" />
            </Button>
          </div>
          <Button
            variant={showFilters ? "default" : "outline"}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="mr-2 h-4 w-4" />
            {showFilters ? "Hide Filters" : "Show Filters"}
          </Button>
        </div>
      </div>

      {showFilters && (
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
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading payment data...</p>
          </div>
        </div>
      )}

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

      {!loading && !error && paymentSchedules.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Payment List</CardTitle>
          </CardHeader>
          <CardContent>
            {viewMode === 'cards' ? (
              <div className="grid gap-4">
                {paymentSchedules.map((schedule) => {
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
                          <Button size="sm" variant="outline" onClick={() => handleViewDetails(schedule)} title="View Details">
                            <Eye className="h-4 w-4" />
                          </Button>
                          {canManagePayments && schedule.status !== "completed" && (
                            <Button size="sm" variant="outline" onClick={() => handleEditSchedule(schedule)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Process Payment
                            </Button>
                          )}
                          {schedule.status === "completed" && (
                            <Button size="sm" variant="outline" onClick={() => handleDownloadReceipt(schedule)} title="Download Receipt">
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
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Beneficiary</TableHead>
                    <TableHead>Payment Number</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Scheme</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paymentSchedules.map((schedule) => {
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
                          <Badge className={getStatusColor(timelineStatus)} variant="outline">
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {getStatusLabel(timelineStatus)}
                          </Badge>
                        </TableCell>
                        <TableCell>{schedule.project || 'N/A'}</TableCell>
                        <TableCell>{schedule.scheme}</TableCell>
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
                            <Button size="sm" variant="outline" onClick={() => handleViewDetails(schedule)} title="View Details">
                              <Eye className="h-4 w-4" />
                            </Button>
                            {canManagePayments && schedule.status !== "completed" && (
                              <Button size="sm" variant="outline" onClick={() => handleEditSchedule(schedule)} title="Process Payment">
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                            {schedule.status === "completed" && (
                              <Button size="sm" variant="outline" onClick={() => handleDownloadReceipt(schedule)} title="Download Receipt">
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
            )}
          </CardContent>
        </Card>
      )}

      {!loading && !error && paymentSchedules.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Wallet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium">No payment schedules found</p>
            <p className="text-sm text-muted-foreground mt-1">Try adjusting your search or filters</p>
          </CardContent>
        </Card>
      )}

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
                      chequeNumber: value === 'cheque' ? editingSchedule.chequeNumber : ''
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
            <Button variant="outline" onClick={() => setShowEditModal(false)}>
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
