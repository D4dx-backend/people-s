import { useState, useEffect, useCallback } from "react";
import { ShortlistModal } from "@/components/modals/ShortlistModal";
import { ReportsModal } from "@/components/modals/ReportsModal";
import { Eye, FileText, Loader2, CalendarIcon, Grid, List, History, Clock, Filter } from "lucide-react";
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
import { applications, interviews } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { getApplicationDisplay } from "@/utils/applicationDisplay";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Application {
  _id: string;
  applicationNumber: string;
  beneficiary: { _id: string; name: string; phone: string; };
  scheme: { _id: string; name: string; code: string; };
  project?: { _id: string; name: string; code: string; };
  status: string;
  requestedAmount: number;
  district: { _id: string; name: string; code: string; };
  area: { _id: string; name: string; code: string; };
  unit: { _id: string; name: string; code: string; };
  createdAt: string;
  interview?: { scheduledDate?: string; scheduledTime?: string; type?: string; location?: string; };
  eligibilityScore?: {
    totalPoints: number;
    maxPoints: number;
    percentage: number;
    meetsThreshold: boolean;
    autoRejected: boolean;
  };
}

export default function InterviewScheduledApplications() {
  const { user } = useAuth();
  const { hasAnyPermission } = useRBAC();
  
  const filterHook = useApplicationFilters('interview_scheduled');
  const { exportCSV, exportPDF, printData, exporting } = useExport({
    apiCall: (params) => applications.export(params),
    filenamePrefix: 'applications',
    pdfTitle: 'Interview Scheduled Applications Report',
    pdfColumns: applicationExportColumns,
    getFilterParams: () => filterHook.getExportParams(),
  });
  
  const [applicationList, setApplicationList] = useState<Application[]>([]);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showShortlistModal, setShowShortlistModal] = useState(false);
  const [showReportsModal, setShowReportsModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [interviewHistory, setInterviewHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ current: 1, pages: 1, total: 0, limit: 10 });
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table');
  const [showRescheduledOnly, setShowRescheduledOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const canViewApplications = hasAnyPermission(['applications.read.all', 'applications.read.regional', 'applications.read.own']);
  const hasAdminAccess = user && ['super_admin', 'state_admin', 'district_admin', 'area_admin', 'unit_admin', 'project_coordinator', 'scheme_coordinator'].includes(user.role);
  // Only area_admin, state_admin, and super_admin can review/approve applications
  const canReviewApplications = user && ['super_admin', 'state_admin', 'area_admin'].includes(user.role);

  useEffect(() => {
    if (!hasAdminAccess) {
      setLoading(false);
      return;
    }

    const loadData = async () => {
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

    loadData();
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

  const handleViewApplication = (app: Application) => {
    setSelectedApplicationId(app._id);
    setShowDetailModal(true);
  };

  const handleViewHistory = async (app: Application) => {
    setSelectedApp(app);
    setShowHistoryModal(true);
    setLoadingHistory(true);
    
    try {
      console.log('📋 Fetching interview history for:', app.applicationNumber);
      const response = await interviews.getHistory(app.applicationNumber);
      console.log('📋 Interview history response:', response);
      
      if (response.success) {
        const historyData = (response.data as any)?.history;
        console.log('✅ History data:', historyData);
        if (Array.isArray(historyData)) {
          setInterviewHistory(historyData);
        } else if (Array.isArray(response.data)) {
          setInterviewHistory(response.data);
        } else {
          setInterviewHistory([]);
        }
      } else {
        // If no history found, just set empty array without showing error toast
        console.log('ℹ️ No interview history found');
        setInterviewHistory([]);
      }
    } catch (error: any) {
      console.error('❌ Error loading interview history:', error);
      // Only show error toast for actual errors, not for "no history found"
      if (!error.message?.includes('Failed to fetch interview history')) {
        toast({ 
          title: "Error", 
          description: error.message || "Failed to load interview history", 
          variant: "destructive" 
        });
      }
      setInterviewHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };


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

  const handleApprove = async (id: string, remarks: string, distributionTimeline?: any[]) => {
    try {
      const response = await interviews.complete(id, {
        result: 'passed',
        notes: remarks,
        distributionTimeline
      });
      
      if (response.success) {
        toast({ 
          title: "Success", 
          description: "Interview accepted and application approved successfully" 
        });
        loadApplications();
      }
    } catch (error: any) {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to approve application", 
        variant: "destructive" 
      });
    }
  };

  const handleReject = async (id: string, remarks: string) => {
    try {
      const response = await interviews.complete(id, {
        result: 'failed',
        notes: remarks
      });
      
      if (response.success) {
        toast({ 
          title: "Success", 
          description: "Interview rejected and application declined successfully" 
        });
        loadApplications();
      }
    } catch (error: any) {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to reject application", 
        variant: "destructive" 
      });
    }
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
        onActionComplete={() => {
          loadApplications();
        }}
        canApprove={!!canReviewApplications}
      />
      
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold">Interview Scheduled Applications</h1>
          <p className="text-muted-foreground mt-1">Applications with scheduled interviews</p>
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
            onClick={() => setShowFilters((v) => !v)}
          >
            <Filter className="mr-2 h-4 w-4" />
            {showFilters ? "Hide Filters" : "Show Filters"}
          </Button>
        </div>
      </div>

      {showFilters && (
      <div className="space-y-4">
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
        
        <div className="flex items-center gap-2 text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showRescheduledOnly}
              onChange={(e) => setShowRescheduledOnly(e.target.checked)}
              className="rounded border-gray-300"
            />
            <span>Show only rescheduled interviews</span>
          </label>
        </div>
      </div>
      )}

      <Card>
        <CardContent className="p-6 pt-6">
          {loading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /><span className="ml-2">Loading...</span></div>
          ) : (() => {
            const filteredList = showRescheduledOnly 
              ? applicationList.filter(app => app.interview?.scheduledDate && new Date(app.interview.scheduledDate) < new Date(app.createdAt))
              : applicationList;
            
            return filteredList.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                {showRescheduledOnly ? "No rescheduled interviews found" : "No applications with scheduled interviews"}
              </p>
            ) : viewMode === 'cards' ? (
            <div className="space-y-4">
              {filteredList.map((app) => (
                <div key={app._id} className="border rounded-lg p-4 hover:shadow-elegant transition-shadow">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold">{getApplicationDisplay(app).beneficiaryName}</h3>
                        <Badge variant="outline" className="text-xs">{app.applicationNumber}</Badge>
                        {app.interview?.scheduledDate && new Date(app.interview.scheduledAt) > new Date(app.createdAt) && (
                          <Badge variant="outline" className="text-xs bg-orange-500/10 text-orange-500 border-orange-500/20">Rescheduled</Badge>
                        )}
                        <div className="text-sm text-muted-foreground"><span className="font-medium">Amount:</span> ₹{app.requestedAmount.toLocaleString()}</div>
                      </div>
                      <div className="grid md:grid-cols-2 gap-2 text-sm text-muted-foreground">
                        <div><span className="font-medium">Scheme:</span> {getApplicationDisplay(app).schemeName}</div>
                        <div><span className="font-medium">Project:</span> {getApplicationDisplay(app).projectName}</div>
                        <div><span className="font-medium">District:</span> {getApplicationDisplay(app).districtName}</div>
                        <div><span className="font-medium">Area:</span> {getApplicationDisplay(app).areaName}</div>
                        {app.interview?.scheduledDate && (
                          <div><span className="font-medium">Interview Date:</span> {new Date(app.interview.scheduledDate).toLocaleDateString()}</div>
                        )}
                        <div><span className="font-medium">Phone:</span> {getApplicationDisplay(app).beneficiaryPhone}</div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 items-end">
                      <Badge variant="outline" className="bg-purple-500/10 text-purple-500 border-purple-500/20"><CalendarIcon className="mr-1 h-3 w-3" />INTERVIEW SCHEDULED</Badge>
                      <div className="flex flex-col gap-2 w-full">
                        <Button variant="outline" size="sm" onClick={() => handleViewApplication(app)} className="w-full"><Eye className="mr-2 h-4 w-4" />Forward</Button>
                        <div className="flex gap-1">
                          <Button variant="secondary" size="sm" className="text-xs px-2 py-1 h-7 flex-1" onClick={() => { setSelectedApp(app); setShowShortlistModal(true); }}><CalendarIcon className="mr-1 h-3 w-3" />Reschedule</Button>
                          <Button variant="secondary" size="sm" className="text-xs px-2 py-1 h-7 flex-1" onClick={() => handleViewHistory(app)}><History className="mr-1 h-3 w-3" />History</Button>
                        </div>
                        <Button variant="secondary" size="sm" className="text-xs px-2 py-1 h-7 w-full" onClick={() => { setSelectedApp(app); setShowReportsModal(true); }}><FileText className="mr-1 h-3 w-3" />Reports</Button>
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
                  <TableHead>Interview Date</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredList.map((app) => (
                  <TableRow key={app._id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{getApplicationDisplay(app).beneficiaryName}</div>
                        <div className="text-sm text-muted-foreground">{getApplicationDisplay(app).beneficiaryPhone}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="font-mono text-sm">{app.applicationNumber}</div>
                        {app.interview?.scheduledDate && new Date(app.interview.scheduledAt) > new Date(app.createdAt) && (
                          <Badge variant="outline" className="text-xs bg-orange-500/10 text-orange-500 border-orange-500/20">Rescheduled</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">{new Date(app.createdAt).toLocaleDateString()}</div>
                      <div className="text-sm font-medium mt-1">₹{app.requestedAmount.toLocaleString()}</div>
                    </TableCell>
                    <TableCell>{getApplicationDisplay(app).schemeName}</TableCell>
                    <TableCell>{getApplicationDisplay(app).projectName}</TableCell>
                    <TableCell>
                      {app.interview?.scheduledDate ? (
                        <div className="text-sm font-medium">{new Date(app.interview.scheduledDate).toLocaleDateString()}</div>
                      ) : (
                        <div className="text-sm text-muted-foreground">Not set</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{getApplicationDisplay(app).districtName}</div>
                        <div className="text-muted-foreground">{getApplicationDisplay(app).areaName}</div>
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
                        <Button variant="outline" size="sm" onClick={() => handleViewApplication(app)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => { setSelectedApp(app); setShowShortlistModal(true); }}>
                          <CalendarIcon className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleViewHistory(app)}>
                          <History className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => { setSelectedApp(app); setShowReportsModal(true); }}>
                          <FileText className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          );
          })()}

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
          <ShortlistModal isOpen={showShortlistModal} onClose={() => { setShowShortlistModal(false); setSelectedApp(null); }} applicationId={selectedApp.applicationNumber} applicantName={getApplicationDisplay(selectedApp).beneficiaryName} mode="reschedule" existingInterview={selectedApp.interview} onSuccess={() => { loadApplications(); }} />
          <ReportsModal isOpen={showReportsModal} onClose={() => { setShowReportsModal(false); setSelectedApp(null); }} applicationId={selectedApp.applicationNumber} applicantName={getApplicationDisplay(selectedApp).beneficiaryName} />
        </>
      )}

      <Dialog open={showHistoryModal} onOpenChange={setShowHistoryModal}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Interview History - {selectedApp?.beneficiary?.name}</DialogTitle>
            <p className="text-sm text-muted-foreground">Application: {selectedApp?.applicationNumber}</p>
          </DialogHeader>
          
          {loadingHistory ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Loading history...</span>
            </div>
          ) : interviewHistory.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No interview history found</p>
          ) : (
            <div className="space-y-4">
              {interviewHistory.map((history, index) => (
                <Card key={history.id} className={index === 0 ? "border-purple-500/50" : ""}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Badge variant={history.status === 'scheduled' ? 'default' : history.status === 'completed' ? 'secondary' : 'outline'}>
                          {history.status.toUpperCase()}
                        </Badge>
                        {index === 0 && <Badge variant="outline" className="bg-purple-500/10 text-purple-500">Current</Badge>}
                        {history.status === 'rescheduled' && <Badge variant="outline" className="bg-orange-500/10 text-orange-500">Rescheduled</Badge>}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {history.interviewNumber}
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">Scheduled Date:</span>
                          <span>{new Date(history.scheduledDate).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">Time:</span>
                          <span>{history.scheduledTime}</span>
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-medium">Type:</span>
                          <Badge variant="outline">{history.type}</Badge>
                        </div>
                      </div>

                      <div>
                        {history.type === 'offline' && history.location && (
                          <div className="mb-2">
                            <span className="font-medium">Location:</span>
                            <p className="text-muted-foreground">{history.location}</p>
                          </div>
                        )}
                        {history.type === 'online' && history.meetingLink && (
                          <div className="mb-2">
                            <span className="font-medium">Meeting Link:</span>
                            <p className="text-muted-foreground truncate">{history.meetingLink}</p>
                          </div>
                        )}
                        {history.result && history.result !== 'pending' && (
                          <div className="mb-2">
                            <span className="font-medium">Result:</span>
                            <Badge variant={history.result === 'passed' ? 'default' : 'destructive'} className="ml-2">
                              {history.result.toUpperCase()}
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>

                    {history.notes && (
                      <div className="mt-4 p-3 bg-muted rounded-md">
                        <p className="text-sm font-medium mb-1">Notes:</p>
                        <p className="text-sm text-muted-foreground">{history.notes}</p>
                      </div>
                    )}

                    {history.rescheduleReason && (
                      <div className="mt-4 p-3 bg-orange-500/10 rounded-md border border-orange-500/20">
                        <p className="text-sm font-medium mb-1 text-orange-700">Reschedule Reason:</p>
                        <p className="text-sm text-orange-600">{history.rescheduleReason}</p>
                      </div>
                    )}

                    <div className="mt-4 pt-4 border-t text-xs text-muted-foreground flex justify-between">
                      <div>
                        <span>Scheduled by: {history.scheduledBy || 'N/A'}</span>
                        {history.scheduledAt && <span className="ml-2">on {new Date(history.scheduledAt).toLocaleString()}</span>}
                      </div>
                      {history.completedAt && (
                        <div>
                          <span>Completed by: {history.completedBy || 'N/A'}</span>
                          <span className="ml-2">on {new Date(history.completedAt).toLocaleString()}</span>
                        </div>
                      )}
                    </div>

                    {history.rescheduleCount > 0 && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        Reschedule count: {history.rescheduleCount}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
