import { useState, useEffect } from "react";
import { Calendar, Clock, MapPin, Users, FileText, CheckCircle, XCircle, CalendarCheck, Loader2, AlertCircle, Link as LinkIcon, Edit, Grid, List, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ReportsModal } from "@/components/modals/ReportsModal";
import { ApplicationViewModal } from "@/components/modals/ApplicationViewModal";
import { GenericFilters } from "@/components/filters/GenericFilters";
import { useInterviewFilters } from "@/hooks/useInterviewFilters";
import { useExport } from '@/hooks/useExport';
import ExportButton from '@/components/common/ExportButton';
import { applicationExportColumns } from '@/utils/exportColumns';
import { toast } from "@/hooks/use-toast";
import { useRBAC } from "@/hooks/useRBAC";
import { interviews, applications } from "@/lib/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";

interface Interview {
  id: string;
  applicationId: string;
  applicationNumber?: string;
  applicantName: string;
  applicantPhone: string;
  projectName: string;
  schemeName: string;
  date: string;
  time: string;
  type: "offline" | "online";
  location?: string;
  meetingLink?: string;
  interviewers: string[];
  status: "scheduled" | "completed" | "cancelled";
  notes?: string;
  result?: "pending" | "passed" | "failed";
  scheduledBy?: string;
  scheduledAt?: string;
  completedAt?: string;
  state: string;
  district: string;
  area: string;
  unit: string;
}

export default function UpcomingInterviews() {
  const { hasAnyPermission } = useRBAC();
  const filterHook = useInterviewFilters();
  const { exportCSV, exportPDF, printData, exporting } = useExport({
    apiCall: (params) => applications.export(params),
    filenamePrefix: 'interviews',
    pdfTitle: 'Upcoming Interviews Report',
    pdfColumns: applicationExportColumns,
    getFilterParams: () => filterHook.getExportParams(),
  });
  
  const canViewInterviews = hasAnyPermission(['interviews.read', 'applications.read.all', 'applications.read.regional']);
  
  const [interviewList, setInterviewList] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ current: 1, pages: 1, total: 0, limit: 10 });
  const [showReportsModal, setShowReportsModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [modalMode, setModalMode] = useState<"view" | "approve" | "reject">("view");
  const [selectedInterview, setSelectedInterview] = useState<Interview | null>(null);
  const [selectedApplication, setSelectedApplication] = useState<any>(null);
  const [loadingApplication, setLoadingApplication] = useState(false);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [showFilters, setShowFilters] = useState(true);

  // Load interviews with filters
  useEffect(() => {
    if (!canViewInterviews) {
      setLoading(false);
      return;
    }

    const loadInterviews = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const params = filterHook.getApiParams(filterHook.filters.currentPage, pagination.limit);
        const response = await interviews.getAll(params);
        
        if (response.success) {
          setInterviewList(response.data.interviews || []);
          setPagination(response.data.pagination || { current: 1, pages: 1, total: 0, limit: 10 });
        } else {
          setError(response.message || "Failed to load interviews");
        }
      } catch (err: any) {
        setError(err.message || "Failed to load interviews");
        toast({
          title: "Error",
          description: "Failed to load interviews",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadInterviews();
  }, [
    canViewInterviews,
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

  if (!canViewInterviews) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <CalendarCheck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
          <p className="text-muted-foreground">You don't have permission to view upcoming interviews.</p>
        </div>
      </div>
    );
  }

  const handleViewForApproval = async (interview: Interview) => {
    setSelectedInterview(interview);
    setModalMode("view");
    setLoadingApplication(true);
    setShowViewModal(true);
    
    try {
      const response = await applications.getById(interview.applicationId);
      if (response.success) {
        const applicationData = {
          ...response.data,
          status: interview.status === "scheduled" ? "pending" : 
                  interview.status === "completed" ? 
                    (interview.result === "passed" ? "approved" : "rejected") : 
                    interview.status === "cancelled" ? "rejected" : response.data.status
        };
        setSelectedApplication(applicationData);
      } else {
        toast({
          title: "Error",
          description: "Failed to load application details",
          variant: "destructive",
        });
        setSelectedApplication(getApplicationFromInterview(interview));
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load application details",
        variant: "destructive",
      });
      setSelectedApplication(getApplicationFromInterview(interview));
    } finally {
      setLoadingApplication(false);
    }
  };

  const handleApprove = async (applicationId: string, remarks: string, distributionTimeline?: any[], forwardToCommittee?: boolean, interviewReport?: string, isRecurring?: boolean, recurringConfig?: any) => {
    try {
      const interview = interviewList.find(i => i.applicationId === applicationId);
      if (!interview) {
        toast({ title: "Error", description: "Interview not found", variant: "destructive" });
        return;
      }

      const response = await interviews.complete(interview.applicationId, { 
        result: 'passed',
        notes: remarks,
        distributionTimeline: !forwardToCommittee ? distributionTimeline : undefined,
        forwardToCommittee: forwardToCommittee || false,
        interviewReport: interviewReport || '',
        isRecurring: !forwardToCommittee ? isRecurring : false,
        recurringConfig: !forwardToCommittee ? recurringConfig : undefined
      });
      
      if (response.success) {
        setShowViewModal(false);
        if (forwardToCommittee) {
          toast({ 
            title: "Forwarded to Committee", 
            description: `Application has been forwarded to committee for approval.` 
          });
        } else {
          const message = isRecurring 
            ? `Application approved with ${recurringConfig?.numberOfPayments || ''} recurring payments`
            : 'Application approved successfully';
          toast({ 
            title: "Interview Completed", 
            description: message
          });
        }
      } else {
        toast({ title: "Error", description: "Failed to complete interview", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to complete interview", variant: "destructive" });
    }
  };

  const handleReject = async (applicationId: string, remarks: string) => {
    try {
      const interview = interviewList.find(i => i.applicationId === applicationId);
      if (!interview) {
        toast({ title: "Error", description: "Interview not found", variant: "destructive" });
        return;
      }

      const response = await interviews.complete(interview.applicationId, { 
        result: 'failed',
        notes: remarks 
      });
      
      if (response.success) {
        setShowViewModal(false);
        toast({ title: "Interview Completed", description: `Interview has been marked as failed.`, variant: "destructive" });
      } else {
        toast({ title: "Error", description: "Failed to complete interview", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to complete interview", variant: "destructive" });
    }
  };

  const handleEditCompleted = async (interview: Interview) => {
    setSelectedInterview(interview);
    setModalMode("edit");
    setLoadingApplication(true);
    setShowViewModal(true);
    
    try {
      const response = await applications.getById(interview.applicationId);
      if (response.success) {
        setSelectedApplication({ ...response.data, status: response.data.status });
      } else {
        toast({ title: "Error", description: "Failed to load application details", variant: "destructive" });
        setSelectedApplication(getApplicationFromInterview(interview));
      }
    } catch (error: any) {
      toast({ title: "Error", description: "Failed to load application details", variant: "destructive" });
      setSelectedApplication(getApplicationFromInterview(interview));
    } finally {
      setLoadingApplication(false);
    }
  };

  const getApplicationFromInterview = (interview: Interview) => {
    return {
      _id: interview.applicationId,
      applicationNumber: interview.applicationNumber || interview.applicationId,
      beneficiary: {
        name: interview.applicantName,
        phone: interview.applicantPhone,
        email: `${interview.applicantName.toLowerCase().replace(/\s+/g, '.')}@email.com`,
      },
      scheme: { name: interview.schemeName },
      project: { name: interview.projectName },
      state: { name: interview.state },
      district: { name: interview.district },
      area: { name: interview.area },
      unit: { name: interview.unit },
      requestedAmount: 50000,
      status: interview.status === "completed" ? 
        (interview.result === "passed" ? "approved" : "rejected") : 
        interview.status === "cancelled" ? "rejected" : 
        interview.status === "scheduled" ? "pending" : "under_review",
      createdAt: interview.date,
      notes: interview.notes,
    };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "scheduled":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "completed":
        return "bg-success/10 text-success border-success/20";
      case "cancelled":
        return "bg-destructive/10 text-destructive border-destructive/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading interviews...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <ApplicationViewModal
        open={showViewModal}
        onOpenChange={(open) => {
          setShowViewModal(open);
          if (!open) {
            setSelectedApplication(null);
            setSelectedInterview(null);
          }
        }}
        application={selectedApplication}
        mode={modalMode}
        onApprove={handleApprove}
        onReject={handleReject}
      />
      
      <ReportsModal
        isOpen={showReportsModal}
        onClose={() => setShowReportsModal(false)}
        applicationId={selectedInterview?.applicationId || ""}
        applicantName={selectedInterview?.applicantName || ""}
      />
      
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-lg font-bold">Upcoming Interviews</h1>
          <p className="text-muted-foreground mt-1">Schedule and manage applicant interviews</p>
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
            <Filter className="h-4 w-4 mr-2" />
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </Button>
        </div>
      </div>

      {showFilters && (
        <GenericFilters
        searchTerm={filterHook.filters.searchTerm}
        onSearchChange={filterHook.setSearchTerm}
        searchPlaceholder="Search by applicant name or ID..."
        showStatusFilter={true}
        statusFilter={filterHook.filters.statusFilter}
        onStatusChange={filterHook.setStatusFilter}
        statusOptions={[
          { value: "all", label: "All Status" },
          { value: "scheduled", label: "Scheduled" },
          { value: "completed", label: "Completed" },
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
        showSchemeFilter={true}
        schemeFilter={filterHook.filters.schemeFilter}
        onSchemeChange={filterHook.setSchemeFilter}
        schemeOptions={filterHook.dropdownOptions.schemeOptions}
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

      {/* Interview Cards or Table */}
      {viewMode === 'cards' ? (
        <div className="grid gap-4">
          {interviewList.map((interview) => (
          <Card key={interview.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-xl">{interview.applicantName}</CardTitle>
                  <p className="text-sm text-muted-foreground">{interview.applicationNumber || interview.applicationId}</p>
                  <p className="text-xs text-muted-foreground">📞 {interview.applicantPhone}</p>
                </div>
                <Badge className={getStatusColor(interview.status)}>
                  {interview.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Project:</span>
                    <span className="text-muted-foreground">{interview.projectName}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Scheme:</span>
                    <span className="text-muted-foreground">{interview.schemeName}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Date:</span>
                    <span className="text-muted-foreground">{new Date(interview.date).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Time:</span>
                    <span className="text-muted-foreground">{interview.time}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 border-t pt-4">
                <div className="flex items-start gap-2 text-sm">
                  <span className="font-medium">Type:</span>
                  <Badge variant="outline" className="text-xs">
                    {interview.type === "offline" ? "In-Person" : "Online"}
                  </Badge>
                </div>
                {interview.type === "offline" && interview.location && (
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <span className="font-medium">Location:</span>
                    <span className="text-muted-foreground">{interview.location}</span>
                  </div>
                )}
                {interview.type === "online" && interview.meetingLink && (
                  <div className="flex items-start gap-2 text-sm">
                    <LinkIcon className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <span className="font-medium">Meeting Link:</span>
                    <a href={interview.meetingLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      Join Meeting
                    </a>
                  </div>
                )}
                {interview.interviewers.length > 0 && (
                  <div className="flex items-start gap-2 text-sm">
                    <Users className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <span className="font-medium">Interviewers:</span>
                    <span className="text-muted-foreground">{interview.interviewers.join(", ")}</span>
                  </div>
                )}
                <div className="flex items-start gap-2 text-sm">
                  <span className="font-medium">Location:</span>
                  <span className="text-muted-foreground">{interview.district}, {interview.area}</span>
                </div>
                {interview.notes && (
                  <div className="flex items-start gap-2 text-sm">
                    <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <span className="font-medium">Notes:</span>
                    <span className="text-muted-foreground">{interview.notes}</span>
                  </div>
                )}
                {interview.status === "completed" && interview.result && (
                  <div className="flex items-start gap-2 text-sm">
                    <span className="font-medium">Result:</span>
                    <Badge variant="outline" className={interview.result === "passed" ? "text-green-600 border-green-600" : "text-red-600 border-red-600"}>
                      {interview.result.toUpperCase()}
                    </Badge>
                  </div>
                )}
              </div>

              {interview.status === "scheduled" && (
                <div className="flex gap-2 pt-2">
                  <Button size="sm" className="flex-1" onClick={() => handleViewForApproval(interview)}>
                    <CheckCircle className="mr-2 h-4 w-4" />Forward
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => { setSelectedInterview(interview); setShowReportsModal(true); }}>
                    <FileText className="mr-2 h-4 w-4" />Add Notes
                  </Button>
                </div>
              )}

              {interview.status === "completed" && (
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => handleEditCompleted(interview)}>
                    <Edit className="mr-2 h-4 w-4" />Edit Decision
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => { setSelectedInterview(interview); setShowReportsModal(true); }}>
                    <FileText className="mr-2 h-4 w-4" />Add Notes
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Applicant</TableHead>
                  <TableHead>Application #</TableHead>
                  <TableHead>Project / Scheme</TableHead>
                  <TableHead>Interview Details</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {interviewList.map((interview) => (
                  <TableRow key={interview.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{interview.applicantName}</div>
                        <div className="text-sm text-muted-foreground">{interview.applicantPhone}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-mono text-sm">{interview.applicationNumber || interview.applicationId}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div className="font-medium">{interview.projectName}</div>
                        <div className="text-muted-foreground">{interview.schemeName}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          <span>{new Date(interview.date).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span>{interview.time}</span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {interview.type === "offline" ? "In-Person" : "Online"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {interview.type === "offline" && interview.location ? (
                          <div className="flex items-start gap-1">
                            <MapPin className="h-3 w-3 text-muted-foreground mt-0.5" />
                            <span className="text-muted-foreground">{interview.location}</span>
                          </div>
                        ) : interview.type === "online" && interview.meetingLink ? (
                          <a href={interview.meetingLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline">
                            <LinkIcon className="h-3 w-3" />
                            <span>Join Meeting</span>
                          </a>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                        <div className="text-xs text-muted-foreground mt-1">{interview.district}, {interview.area}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Badge className={getStatusColor(interview.status)}>
                          {interview.status}
                        </Badge>
                        {interview.status === "completed" && interview.result && (
                          <Badge variant="outline" className={interview.result === "passed" ? "text-green-600 border-green-600" : "text-red-600 border-red-600"}>
                            {interview.result}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {interview.status === "scheduled" && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => handleViewForApproval(interview)}>
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => { setSelectedInterview(interview); setShowReportsModal(true); }}>
                              <FileText className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {interview.status === "completed" && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => handleEditCompleted(interview)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => { setSelectedInterview(interview); setShowReportsModal(true); }}>
                              <FileText className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {interviewList.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium">No interviews found</p>
            <p className="text-sm text-muted-foreground mt-1">Try adjusting your search or filters</p>
          </CardContent>
        </Card>
      )}

      {pagination.pages > 1 && (
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
    </div>
  );
}
