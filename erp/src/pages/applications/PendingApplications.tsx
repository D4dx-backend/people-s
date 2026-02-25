import { useState, useEffect, useCallback } from "react";
import { ShortlistModal } from "@/components/modals/ShortlistModal";
import { ReportsModal } from "@/components/modals/ReportsModal";
import { Eye, CheckCircle, XCircle, Clock, FileText, Loader2, UserCheck, Grid, List, Filter } from "lucide-react";
import { useRBAC } from "@/hooks/useRBAC";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ApplicationDetailModal } from "@/components/modals/ApplicationDetailModal";
import { GenericFilters } from "@/components/filters/GenericFilters";
import { useApplicationFilters } from "@/hooks/useApplicationFilters";
import { useExport } from '@/hooks/useExport';
import ExportButton from '@/components/common/ExportButton';
import { applicationExportColumns } from '@/utils/exportColumns';
import { toast } from "@/hooks/use-toast";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { applications } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

interface Application {
  _id: string;
  applicationNumber: string;
  beneficiary: { _id: string; name: string; phone: string; };
  scheme: { 
    _id: string; 
    name: string; 
    code: string; 
    requiresInterview?: boolean;
    applicationSettings?: {
      requiresInterview?: boolean;
    };
  };
  project?: { _id: string; name: string; code: string; };
  status: string;
  requestedAmount: number;
  state: { _id: string; name: string; code: string; };
  district: { _id: string; name: string; code: string; };
  area: { _id: string; name: string; code: string; };
  unit: { _id: string; name: string; code: string; };
  createdAt: string;
  interview?: any;
  eligibilityScore?: {
    totalPoints: number;
    maxPoints: number;
    percentage: number;
    meetsThreshold: boolean;
    autoRejected: boolean;
  };
}

export default function PendingApplications() {
  const { user } = useAuth();
  const { hasAnyPermission, hasPermission } = useRBAC();
  
  const filterHook = useApplicationFilters('pending');
  const { exportCSV, exportPDF, printData, exporting } = useExport({
    apiCall: (params) => applications.export(params),
    filenamePrefix: 'applications',
    pdfTitle: 'Pending Applications Report',
    pdfColumns: applicationExportColumns,
    getFilterParams: () => filterHook.getExportParams(),
  });
  
  const [applicationList, setApplicationList] = useState<Application[]>([]);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showShortlistModal, setShowShortlistModal] = useState(false);
  const [showReportsModal, setShowReportsModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ current: 1, pages: 1, total: 0, limit: 10 });
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table');
  const [showFilters, setShowFilters] = useState(false);

  const canViewApplications = hasAnyPermission(['applications.read.all', 'applications.read.regional', 'applications.read.own']);
  const canApproveApplications = hasPermission('applications.approve');
  const hasAdminAccess = user && ['super_admin', 'state_admin', 'district_admin', 'area_admin', 'unit_admin', 'project_coordinator', 'scheme_coordinator'].includes(user.role);

  useEffect(() => {
    if (!hasAdminAccess) {
      setLoading(false);
      return;
    }

    const loadApplications = async () => {
      try {
        setLoading(true);
        const params = filterHook.getApiParams(filterHook.filters.currentPage, pagination.limit);
        const response = await applications.getAll(params);
        
        if (response.success) {
          setApplicationList(response.data.applications);
          setPagination(response.data.pagination);
        }
      } catch (error) {
        toast({ title: "Error", description: "Failed to load applications", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };

    loadApplications();
  }, [
    hasAdminAccess,
    filterHook.filters.currentPage,
    filterHook.filters.searchTerm,
    filterHook.filters.statusFilter,
    filterHook.filters.projectFilter,
    filterHook.filters.districtFilter,
    filterHook.filters.areaFilter,
    filterHook.filters.schemeFilter,
    filterHook.filters.fromDate,
    filterHook.filters.toDate,
    filterHook.filters.quickDateFilter,
    pagination.limit,
  ]);

  const loadApplications = useCallback(async () => {
    const params = filterHook.getApiParams(filterHook.filters.currentPage, pagination.limit);
    const response = await applications.getAll(params);
    
    if (response.success) {
      setApplicationList(response.data.applications);
      setPagination(response.data.pagination);
    }
  }, [filterHook.filters.currentPage, filterHook.filters.searchTerm, filterHook.filters.statusFilter, filterHook.filters.projectFilter, filterHook.filters.districtFilter, filterHook.filters.areaFilter, filterHook.filters.schemeFilter, filterHook.filters.fromDate, filterHook.filters.toDate, filterHook.filters.quickDateFilter, pagination.limit]);

  if (!canViewApplications) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
          <p className="text-muted-foreground">You don't have permission to view applications.</p>
        </div>
      </div>
    );
  }

  const handleViewApplication = (app: Application, mode: "view" | "approve" | "reject" = "view") => {
    setSelectedApplicationId(app._id);
    setShowDetailModal(true);
  };

  const handleApprove = async (id: string, remarks: string, _distributionTimeline?: any[], _forwardToCommittee?: boolean, _interviewReport?: string, _isRecurring?: boolean, _recurringConfig?: any, approvedAmountFromModal?: number) => {
    try {
      const response = await applications.approve(id, { approvedAmount: approvedAmountFromModal || selectedApp?.requestedAmount, comments: remarks });
      if (response.success) {
        await loadApplications();
        toast({ title: "Application Approved", description: `Application ${id} has been approved successfully.` });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to approve application", variant: "destructive" });
    }
  };

  const handleReject = async (id: string, remarks: string) => {
    try {
      const response = await applications.review(id, { status: 'rejected', comments: remarks });
      if (response.success) {
        await loadApplications();
        toast({ title: "Application Rejected", description: `Application ${id} has been rejected.`, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to reject application", variant: "destructive" });
    }
  };

  const getActionButton = (app: Application, isTableView: boolean = false) => {
    const requiresInterview = app.scheme?.requiresInterview || app.scheme?.applicationSettings?.requiresInterview || false;
    const hasInterviewScheduled = app.interview?.scheduledDate != null;
    
    // Don't show schedule interview button for approved, rejected, or completed applications
    if (app.status === 'approved' || app.status === 'rejected' || app.status === 'completed') {
      return null;
    }
    
    // Only show Schedule Interview button for schemes requiring interview
    if (requiresInterview) {
      // Check if interview is already scheduled
      if (hasInterviewScheduled || app.status === 'interview_scheduled') {
        // Interview is scheduled, show reschedule button
        return isTableView ? (
          <Button variant="outline" size="sm" onClick={() => { setSelectedApp(app); setShowShortlistModal(true); }}>
            <UserCheck className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={() => { setSelectedApp(app); setShowShortlistModal(true); }} className="flex-1">
            <UserCheck className="mr-2 h-4 w-4" />Reschedule
          </Button>
        );
      }
      
      // Interview not scheduled yet, show schedule button
      return isTableView ? (
        <Button variant="outline" size="sm" onClick={() => { setSelectedApp(app); setShowShortlistModal(true); }}>
          <UserCheck className="h-4 w-4" />
        </Button>
      ) : (
        <Button variant="outline" size="sm" onClick={() => { setSelectedApp(app); setShowShortlistModal(true); }} className="flex-1">
          <UserCheck className="mr-2 h-4 w-4" />Schedule Interview
        </Button>
      );
    }
    
    // For schemes NOT requiring interview - no action buttons in list view
    // Users should approve/reject from the Details modal
    return null;
  };

  return (
    <div className="space-y-6">
      <ApplicationDetailModal 
        isOpen={showDetailModal} 
        applicationId={selectedApplicationId}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedApplicationId(null);
        }}
        canApprove={canApproveApplications}
      />
      
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold">Pending Applications</h1>
          <p className="text-muted-foreground mt-1">Review and process pending applications</p>
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
        searchPlaceholder="Search by name or ID..."
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

      <Card>
        <CardContent className="p-6 pt-6">
          {loading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /><span className="ml-2">Loading...</span></div>
          ) : applicationList.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No pending applications found</p>
          ) : viewMode === 'cards' ? (
            <div className="space-y-4">
              {applicationList.map((app) => (
                <div key={app._id} className="border rounded-lg p-4 hover:shadow-elegant transition-shadow">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold">{app.beneficiary.name}</h3>
                        <Badge variant="outline" className="text-xs">{app.applicationNumber}</Badge>
                        <div className="text-sm text-muted-foreground"><span className="font-medium">Amount:</span> ₹{app.requestedAmount.toLocaleString()}</div>
                      </div>
                      <div className="grid md:grid-cols-2 gap-2 text-sm text-muted-foreground">
                        <div><span className="font-medium">Scheme:</span> {app.scheme.name}</div>
                        <div><span className="font-medium">Project:</span> {app.project?.name || 'N/A'}</div>
                        <div><span className="font-medium">District:</span> {app.district.name}</div>
                        <div><span className="font-medium">Area:</span> {app.area.name}</div>
                        <div><span className="font-medium">Applied:</span> {new Date(app.createdAt).toLocaleDateString()}</div>
                        <div><span className="font-medium">Phone:</span> {app.beneficiary.phone}</div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 items-end">
                      <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20"><Clock className="mr-1 h-3 w-3" />PENDING</Badge>
                      <div className="flex flex-col gap-2 w-full">
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleViewApplication(app, "view")} className="flex-1"><Eye className="mr-2 h-4 w-4" />View</Button>
                          {getActionButton(app)}
                        </div>
                        <Button variant="secondary" size="sm" onClick={() => { setSelectedApp(app); setShowReportsModal(true); }} className="w-full"><FileText className="mr-2 h-4 w-4" />Reports</Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Applicant</TableHead>
                  <TableHead>Application #</TableHead>
                  <TableHead>Scheme</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applicationList.map((app) => (
                  <TableRow key={app._id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{app.beneficiary.name}</div>
                        <div className="text-sm text-muted-foreground">{app.beneficiary.phone}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-mono text-sm">{app.applicationNumber}</div>
                      <div className="text-xs text-muted-foreground">{new Date(app.createdAt).toLocaleDateString()}</div>
                      <div className="text-sm font-medium mt-1">₹{app.requestedAmount.toLocaleString()}</div>
                    </TableCell>
                    <TableCell>{app.scheme.name}</TableCell>
                    <TableCell>{app.project?.name || 'N/A'}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{app.district.name}</div>
                        <div className="text-muted-foreground">{app.area.name}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {app.eligibilityScore && app.eligibilityScore.maxPoints > 0 ? (
                        <Badge variant="outline" className={`${
                          app.eligibilityScore.percentage >= 70 ? 'bg-green-50 text-green-700 border-green-200' :
                          app.eligibilityScore.percentage >= 40 ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                          'bg-red-50 text-red-700 border-red-200'
                        }`}>
                          {app.eligibilityScore.percentage}%
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="outline" size="sm" onClick={() => handleViewApplication(app, "view")}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => { setSelectedApp(app); setShowReportsModal(true); }}>
                          <FileText className="h-4 w-4" />
                        </Button>
                        {getActionButton(app, true)}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}

          {pagination.pages > 1 && (
            <div className="mt-6">
              <Pagination>
                <PaginationContent>
                  <PaginationItem><PaginationPrevious onClick={() => filterHook.setCurrentPage(Math.max(1, filterHook.filters.currentPage - 1))} className={filterHook.filters.currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"} /></PaginationItem>
                  {[...Array(pagination.pages)].map((_, i) => (<PaginationItem key={i}><PaginationLink onClick={() => filterHook.setCurrentPage(i + 1)} isActive={filterHook.filters.currentPage === i + 1} className="cursor-pointer">{i + 1}</PaginationLink></PaginationItem>))}
                  <PaginationItem><PaginationNext onClick={() => filterHook.setCurrentPage(Math.min(pagination.pages, filterHook.filters.currentPage + 1))} className={filterHook.filters.currentPage === pagination.pages ? "pointer-events-none opacity-50" : "cursor-pointer"} /></PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedApp && (
        <>
          <ShortlistModal 
            isOpen={showShortlistModal} 
            onClose={() => { setShowShortlistModal(false); setSelectedApp(null); }} 
            applicationId={selectedApp.applicationNumber} 
            applicantName={selectedApp.beneficiary.name} 
            mode={selectedApp.status === 'interview_scheduled' ? 'reschedule' : 'schedule'} 
            existingInterview={selectedApp.status === 'interview_scheduled' ? selectedApp.interview : undefined}
            onSuccess={() => { loadApplications(); }} 
          />
          <ReportsModal isOpen={showReportsModal} onClose={() => { setShowReportsModal(false); setSelectedApp(null); }} applicationId={selectedApp.applicationNumber} applicantName={selectedApp.beneficiary.name} />
        </>
      )}
    </div>
  );
}
