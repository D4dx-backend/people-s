import { useState, useEffect, useCallback } from "react";
import { ShortlistModal } from "@/components/modals/ShortlistModal";
import { ReportsModal } from "@/components/modals/ReportsModal";
import { Filter, Download, Eye, CheckCircle, XCircle, Clock, CalendarIcon, X, History, UserCheck, FileText, Loader2, FileCheck, Search, RefreshCw } from "lucide-react";
import { useRBAC } from "@/hooks/useRBAC";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApplicationViewModal } from "@/components/modals/ApplicationViewModal";
import { toast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import { 
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { applications, dashboard, projects, schemes, locations } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

// Interface for application data
interface Application {
  _id: string;
  applicationNumber: string;
  beneficiary: {
    _id: string;
    name: string;
    phone: string;
  };
  scheme: {
    _id: string;
    name: string;
    code: string;
    distributionTimeline?: Array<{
      description: string;
      percentage: number;
      daysFromApproval: number;
      requiresVerification: boolean;
      notes?: string;
    }>;
  };
  project?: {
    _id: string;
    name: string;
    code: string;
  };
  status: 'pending' | 'under_review' | 'field_verification' | 'interview_scheduled' | 'interview_completed' | 'approved' | 'rejected' | 'on_hold' | 'cancelled' | 'disbursed' | 'completed';
  requestedAmount: number;
  approvedAmount?: number;
  state: {
    _id: string;
    name: string;
    code: string;
  };
  district: {
    _id: string;
    name: string;
    code: string;
  };
  area: {
    _id: string;
    name: string;
    code: string;
  };
  unit: {
    _id: string;
    name: string;
    code: string;
  };
  createdAt: string;
  updatedAt: string;
  createdBy: {
    _id: string;
    name: string;
  };
  reviewedBy?: {
    _id: string;
    name: string;
  };
  approvedBy?: {
    _id: string;
    name: string;
  };
  interview?: {
    scheduledDate?: string;
    scheduledTime?: string;
    type?: 'offline' | 'online';
    location?: string;
    meetingLink?: string;
    notes?: string;
    result?: 'pending' | 'passed' | 'failed';
  };
  // Renewal fields
  isRenewal?: boolean;
  renewalNumber?: number;
  renewalStatus?: 'not_applicable' | 'active' | 'due_for_renewal' | 'expired' | 'renewed';
  expiryDate?: string;
}

interface DashboardStats {
  totalApplications: number;
  applicationStats: {
    pending: number;
    approved: number;
    rejected: number;
    review: number;
  };
}

const statusConfig = {
  pending: { color: "bg-warning/10 text-warning border-warning/20", icon: Clock },
  under_review: { color: "bg-info/10 text-info border-info/20", icon: Eye },
  field_verification: { color: "bg-blue-500/10 text-blue-500 border-blue-500/20", icon: FileText },
  interview_scheduled: { color: "bg-purple-500/10 text-purple-500 border-purple-500/20", icon: CalendarIcon },
  interview_completed: { color: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20", icon: CheckCircle },
  approved: { color: "bg-success/10 text-success border-success/20", icon: CheckCircle },
  rejected: { color: "bg-destructive/10 text-destructive border-destructive/20", icon: XCircle },
  on_hold: { color: "bg-orange-500/10 text-orange-500 border-orange-500/20", icon: Clock },
  cancelled: { color: "bg-gray-500/10 text-gray-500 border-gray-500/20", icon: XCircle },
  disbursed: { color: "bg-green-600/10 text-green-600 border-green-600/20", icon: CheckCircle },
  completed: { color: "bg-success/10 text-success border-success/20", icon: CheckCircle },
};

const priorityConfig = {
  urgent: "bg-destructive/10 text-destructive border-destructive/20",
  high: "bg-warning/10 text-warning border-warning/20",
  medium: "bg-info/10 text-info border-info/20",
  low: "bg-muted text-muted-foreground border-muted",
};

export default function Applications() {
  const { user } = useAuth();
  const { hasAnyPermission, hasPermission } = useRBAC();
  
  // All useState hooks must be declared before any conditional logic
  const [applicationList, setApplicationList] = useState<Application[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showShortlistModal, setShowShortlistModal] = useState(false);
  const [showReportsModal, setShowReportsModal] = useState(false);
  const [modalMode, setModalMode] = useState<"view" | "approve" | "reject">("view");
  const [activeTab, setActiveTab] = useState("all");
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    current: 1,
    pages: 1,
    total: 0,
    limit: 10
  });

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [districtFilter, setDistrictFilter] = useState("all");
  const [areaFilter, setAreaFilter] = useState("all");
  const [schemeFilter, setSchemeFilter] = useState("all");
  const [fromDate, setFromDate] = useState<Date | undefined>();
  const [toDate, setToDate] = useState<Date | undefined>();
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Dynamic dropdown data
  const [projectsList, setProjectsList] = useState<any[]>([]);
  const [districts, setDistricts] = useState<any[]>([]);
  const [areas, setAreas] = useState<any[]>([]);
  const [schemesList, setSchemesList] = useState<any[]>([]);

  // Permission checks
  const canViewApplications = hasAnyPermission(['applications.read.all', 'applications.read.regional', 'applications.read.own']);
  const canUpdateApplications = hasPermission('applications.update.regional');
  const canApproveApplications = hasPermission('applications.approve');
  
  // Only area_admin, state_admin, and super_admin can review/approve applications
  const canReviewApplications = user && ['super_admin', 'state_admin', 'area_admin'].includes(user.role);

  // Check if user has admin permissions
  const hasAdminAccess = user && ['super_admin', 'state_admin', 'district_admin', 'area_admin', 'unit_admin'].includes(user.role);

  // Define functions using useCallback
  const loadApplications = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = {
        page: currentPage,
        limit: itemsPerPage,
      };

      if (searchTerm) params.search = searchTerm;
      if (statusFilter !== "all") params.status = statusFilter;
      if (projectFilter !== "all") params.project = projectFilter;
      if (districtFilter !== "all") params.district = districtFilter;
      if (areaFilter !== "all") params.area = areaFilter;
      if (schemeFilter !== "all") params.scheme = schemeFilter;

      console.log('🔍 DEBUG INFO:');
      console.log('- User object:', user);
      console.log('- User role:', user?.role);
      console.log('- Has admin access:', hasAdminAccess);
      console.log('- Auth token exists:', !!localStorage.getItem('auth_token'));
      console.log('- Auth token preview:', localStorage.getItem('auth_token')?.substring(0, 30) + '...');
      console.log('- API params:', params);
      
      const response = await applications.getAll(params);
      console.log('✅ Applications response:', response);
      
      if (response.success) {
        setApplicationList(response.data.applications);
        setPagination(response.data.pagination);
      } else {
        console.error('Applications API error:', response);
        toast({
          title: "Error",
          description: response.message || "Failed to load applications",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error loading applications:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load applications",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, searchTerm, statusFilter, projectFilter, districtFilter, areaFilter, schemeFilter, user, hasAdminAccess]);

  const loadDashboardStats = useCallback(async () => {
    try {
      const response = await dashboard.getOverview();
      if (response.success) {
        setDashboardStats(response.data.overview);
      }
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
    }
  }, []);

  const loadDropdownData = useCallback(async () => {
    try {
      console.log('🔄 Loading dropdown data...');
      
      // Load projects
      const projectsResponse = await projects.getAll({ limit: 100 });
      console.log('📋 Projects response:', projectsResponse);
      if (projectsResponse.success) {
        setProjectsList(Array.isArray(projectsResponse.data.projects) ? projectsResponse.data.projects : []);
        console.log('✅ Projects loaded:', projectsResponse.data.projects?.length || 0);
      }

      // Load schemes
      const schemesResponse = await schemes.getAll({ limit: 100 });
      console.log('📋 Schemes response:', schemesResponse);
      if (schemesResponse.success) {
        setSchemesList(Array.isArray(schemesResponse.data.schemes) ? schemesResponse.data.schemes : []);
        console.log('✅ Schemes loaded:', schemesResponse.data.schemes?.length || 0);
      }

      // Load districts (type: district)
      const districtsResponse = await locations.getByType('district', { active: true });
      console.log('📋 Districts response:', districtsResponse);
      if (districtsResponse.success) {
        setDistricts(Array.isArray(districtsResponse.data.locations) ? districtsResponse.data.locations : []);
        console.log('✅ Districts loaded:', districtsResponse.data.locations?.length || 0);
      }

      // Load areas (type: area)
      const areasResponse = await locations.getByType('area', { active: true });
      console.log('📋 Areas response:', areasResponse);
      if (areasResponse.success) {
        setAreas(Array.isArray(areasResponse.data.locations) ? areasResponse.data.locations : []);
        console.log('✅ Areas loaded:', areasResponse.data.locations?.length || 0);
      }
    } catch (error) {
      console.error('❌ Error loading dropdown data:', error);
    }
  }, []);

  // Load applications and dashboard stats
  useEffect(() => {
    if (hasAdminAccess) {
      loadApplications();
      loadDashboardStats();
    } else {
      setLoading(false);
    }
  }, [hasAdminAccess, loadApplications, loadDashboardStats]);

  // Load dropdown data separately
  useEffect(() => {
    loadDropdownData();
  }, [loadDropdownData]);

  // Access denied check
  if (!canViewApplications) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <FileCheck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
          <p className="text-muted-foreground">
            You don't have permission to view applications.
          </p>
        </div>
      </div>
    );
  }

  // Debug current user (hooks fixed - v7, separate Interview model + history tracking)
  console.log('Current user:', user);
  console.log('User role:', user?.role);
  console.log('Has admin access:', hasAdminAccess);
  console.log('Auth token exists:', !!localStorage.getItem('auth_token'));



  const handleViewApplication = (app: Application, mode: "view" | "approve" | "reject" = "view") => {
    setSelectedApp(app);
    setModalMode(mode);
    setShowViewModal(true);
  };

  const handleApprove = async (id: string, remarks: string) => {
    try {
      const response = await applications.approve(id, { 
        approvedAmount: selectedApp?.requestedAmount,
        comments: remarks 
      });
      
      if (response.success) {
        await loadApplications(); // Reload applications
        toast({
          title: "Application Approved",
          description: `Application ${id} has been approved successfully.`,
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to approve application",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error approving application:', error);
      toast({
        title: "Error",
        description: "Failed to approve application",
        variant: "destructive",
      });
    }
  };

  const handleReject = async (id: string, remarks: string) => {
    try {
      const response = await applications.review(id, { 
        status: 'rejected',
        comments: remarks 
      });
      
      if (response.success) {
        await loadApplications(); // Reload applications
        toast({
          title: "Application Rejected",
          description: `Application ${id} has been rejected.`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to reject application",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error rejecting application:', error);
      toast({
        title: "Error",
        description: "Failed to reject application",
        variant: "destructive",
      });
    }
  };

  const clearAllFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setProjectFilter("all");
    setDistrictFilter("all");
    setAreaFilter("all");
    setSchemeFilter("all");
    setFromDate(undefined);
    setToDate(undefined);
    setCurrentPage(1);
  };

  // Function to get the appropriate action button based on application status and scheme requirements
  const getActionButton = (app: Application) => {
    // Unit Admin and District Admin can only view - no action buttons
    if (!canReviewApplications) {
      return null;
    }

    // Check if scheme requires interview
    const requiresInterview = app.scheme?.requiresInterview || false;

    switch (app.status) {
      case 'pending':
      case 'under_review':
      case 'field_verification':
        if (requiresInterview) {
          // Show schedule interview button for schemes that require interviews
          return (
            <Button variant="outline" size="sm" onClick={() => {
              setSelectedApp(app);
              setShowShortlistModal(true);
            }} className="flex-1">
              <UserCheck className="mr-2 h-4 w-4" />
              Schedule Interview
            </Button>
          );
        } else {
          // Show direct approve/reject buttons for schemes that don't require interviews
          return (
            <>
              <Button variant="outline" size="sm" onClick={() => handleViewApplication(app, "approve")} className="flex-1">
                <CheckCircle className="mr-2 h-4 w-4" />
                Approve
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleViewApplication(app, "reject")} className="flex-1">
                <XCircle className="mr-2 h-4 w-4" />
                Reject
              </Button>
            </>
          );
        }
      
      case 'interview_scheduled':
        // Show reschedule button for scheduled interviews
        return (
          <Button variant="outline" size="sm" onClick={() => {
            setSelectedApp(app);
            setShowShortlistModal(true);
          }} className="flex-1">
            <CalendarIcon className="mr-2 h-4 w-4" />
            Reschedule Interview
          </Button>
        );
      
      case 'interview_completed':
        // Show approve/reject buttons for completed interviews
        return (
          <>
            <Button variant="outline" size="sm" onClick={() => handleViewApplication(app, "approve")} className="flex-1">
              <CheckCircle className="mr-2 h-4 w-4" />
              Approve
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleViewApplication(app, "reject")} className="flex-1">
              <XCircle className="mr-2 h-4 w-4" />
              Reject
            </Button>
          </>
        );
      
      case 'approved':
      case 'rejected':
      case 'completed':
      case 'disbursed':
        // No action buttons for final states
        return null;
      
      default:
        // Default action based on interview requirement
        if (requiresInterview) {
          return (
            <Button variant="outline" size="sm" onClick={() => {
              setSelectedApp(app);
              setShowShortlistModal(true);
            }} className="flex-1">
              <UserCheck className="mr-2 h-4 w-4" />
              Schedule Interview
            </Button>
          );
        } else {
          return (
            <>
              <Button variant="outline" size="sm" onClick={() => handleViewApplication(app, "approve")} className="flex-1">
                <CheckCircle className="mr-2 h-4 w-4" />
                Approve
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleViewApplication(app, "reject")} className="flex-1">
                <XCircle className="mr-2 h-4 w-4" />
                Reject
              </Button>
            </>
          );
        }
    }
  };

  // Filter applications for tabs (client-side filtering for tabs)
  const getFilteredApplicationsForTab = (tabStatus: string) => {
    if (tabStatus === "all") return applicationList;
    
    const statusMap: { [key: string]: string } = {
      "pending": "pending",
      "review": "under_review",
      "field_verification": "field_verification",
      "interview_scheduled": "interview_scheduled",
      "interview_completed": "interview_completed",
      "approved": "approved",
      "rejected": "rejected",
      "on_hold": "on_hold",
      "cancelled": "cancelled",
      "disbursed": "disbursed",
      "completed": "completed"
    };
    
    return applicationList.filter(app => app.status === statusMap[tabStatus]);
  };

  const filteredApplicationsForCurrentTab = getFilteredApplicationsForTab(activeTab);

  // Dynamic dropdown options
  const projectOptions = [
    { value: "all", label: "All Projects" },
    ...projectsList.map(project => ({
      value: project._id || project.id,
      label: project.name
    }))
  ];

  const districtOptions = [
    { value: "all", label: "All Districts" },
    ...districts.map(district => ({
      value: district._id || district.id,
      label: district.name
    }))
  ];

  const areaOptions = [
    { value: "all", label: "All Areas" },
    ...areas.map(area => ({
      value: area._id || area.id,
      label: area.name
    }))
  ];

  const schemeOptions = [
    { value: "all", label: "All Schemes" },
    ...schemesList.map(scheme => ({
      value: scheme._id || scheme.id,
      label: scheme.name
    }))
  ];

  // Debug dropdown options
  console.log('🔍 Dropdown options:', {
    projects: projectsList.length,
    districts: districts.length,
    areas: areas.length,
    schemes: schemesList.length,
    projectOptions: projectOptions.length,
    districtOptions: districtOptions.length,
    areaOptions: areaOptions.length,
    schemeOptions: schemeOptions.length
  });

  return (
    <div className="space-y-6">
      <ApplicationViewModal
        open={showViewModal}
        onOpenChange={setShowViewModal}
        application={selectedApp}
        mode={modalMode}
        onApprove={handleApprove}
        onReject={handleReject}
      />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">Applications</h1>
          <p className="text-muted-foreground mt-1">Manage and track scheme applications</p>
          {user && (
            <p className="text-sm text-muted-foreground mt-1">
              Logged in as: {user.name} ({user.role})
            </p>
          )}
        </div>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export Report
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {(dashboardStats ? [
          { label: "Total Applications", value: dashboardStats.totalApplications.toLocaleString(), color: "bg-primary" },
          { label: "Pending Review", value: (dashboardStats.applicationStats.pending + dashboardStats.applicationStats.review).toLocaleString(), color: "bg-warning" },
          { label: "Approved", value: dashboardStats.applicationStats.approved.toLocaleString(), color: "bg-success" },
          { label: "Rejected", value: dashboardStats.applicationStats.rejected.toLocaleString(), color: "bg-destructive" },
        ] : [
          { label: "Total Applications", value: "Loading...", color: "bg-primary" },
          { label: "Pending Review", value: "Loading...", color: "bg-warning" },
          { label: "Approved", value: "Loading...", color: "bg-success" },
          { label: "Rejected", value: "Loading...", color: "bg-destructive" },
        ]).map((stat, idx) => (
          <Card key={idx}>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className="text-xl font-bold mt-2">{stat.value}</p>
              <div className={`h-1 ${stat.color} rounded-full mt-3`} />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters - Row 1: Search (50%), Status (25%), Projects (25%) */}
      <div className="flex items-center gap-3">
        <div className="relative flex-[2]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input 
            placeholder="Search by name or ID..." 
            className="pl-10 w-full" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="under_review">Under Review</SelectItem>
            <SelectItem value="field_verification">Field Verification</SelectItem>
            <SelectItem value="interview_scheduled">Interview Scheduled</SelectItem>
            <SelectItem value="interview_completed">Interview Completed</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="on_hold">On Hold</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="disbursed">Disbursed</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="All Projects" />
          </SelectTrigger>
          <SelectContent>
            {projectOptions.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Filters - Row 2: District, Area, Scheme, Dates, Clear */}
      <div className="flex items-center gap-3 flex-wrap">
        <Combobox
          value={districtFilter}
          onValueChange={setDistrictFilter}
          options={districtOptions}
          placeholder="District"
          searchPlaceholder="Search..."
          className="w-44"
        />
        <Combobox
          value={areaFilter}
          onValueChange={setAreaFilter}
          options={areaOptions}
          placeholder="Area"
          searchPlaceholder="Search..."
          className="w-40"
        />
        <Combobox
          value={schemeFilter}
          onValueChange={setSchemeFilter}
          options={schemeOptions}
          placeholder="Scheme"
          searchPlaceholder="Search..."
          className="w-48"
        />
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "w-36 justify-start text-left font-normal",
                !fromDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {fromDate ? format(fromDate, "dd/MM/yy") : "From"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={fromDate}
              onSelect={setFromDate}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "w-36 justify-start text-left font-normal",
                !toDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {toDate ? format(toDate, "dd/MM/yy") : "To"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={toDate}
              onSelect={setToDate}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
        <Button variant="outline" size="sm" onClick={clearAllFilters}>
          <X className="mr-2 h-4 w-4" />
          Clear Filters
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Application List</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid w-full grid-cols-8">
              <TabsTrigger value="all">All ({applicationList.length})</TabsTrigger>
              <TabsTrigger value="pending">
                Pending ({applicationList.filter(a => a.status === "pending").length})
              </TabsTrigger>
              <TabsTrigger value="review">
                Review ({applicationList.filter(a => a.status === "under_review").length})
              </TabsTrigger>
              <TabsTrigger value="field_verification">
                Verification ({applicationList.filter(a => a.status === "field_verification").length})
              </TabsTrigger>
              <TabsTrigger value="interview_scheduled">
                Interview ({applicationList.filter(a => a.status === "interview_scheduled").length})
              </TabsTrigger>
              <TabsTrigger value="approved">
                Approved ({applicationList.filter(a => a.status === "approved").length})
              </TabsTrigger>
              <TabsTrigger value="rejected">
                Rejected ({applicationList.filter(a => a.status === "rejected").length})
              </TabsTrigger>
              <TabsTrigger value="completed">
                Completed ({applicationList.filter(a => a.status === "completed").length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="space-y-4">
              {!hasAdminAccess ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Access denied. You need admin permissions to view applications.</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Current role: {user?.role || 'Not logged in'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Required roles: super_admin, state_admin, district_admin, area_admin, or unit_admin
                  </p>
                  <div className="mt-4">
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        console.log('Full user object:', user);
                        console.log('Available roles check:', ['super_admin', 'state_admin', 'district_admin', 'area_admin', 'unit_admin'].includes(user?.role || ''));
                      }}
                    >
                      Debug User Info
                    </Button>
                  </div>
                </div>
              ) : loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <span className="ml-2">Loading applications...</span>
                </div>
              ) : filteredApplicationsForCurrentTab.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title="No Applications Found"
                  description="No applications match your current filters. Try adjusting your search criteria."
                />
              ) : (
                filteredApplicationsForCurrentTab.map((app) => {
                const statusInfo = statusConfig[app.status as keyof typeof statusConfig] || statusConfig.pending;
                const StatusIcon = statusInfo.icon;
                
                return (
                  <div
                    key={app._id}
                    className="border rounded-lg p-4 hover:shadow-elegant transition-shadow"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold">{app.beneficiary.name}</h3>
                          <Badge variant="outline" className="text-xs">
                            {app.applicationNumber}
                          </Badge>
                          {app.isRenewal && (
                            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                              <RefreshCw className="mr-1 h-3 w-3" />
                              Renewal #{app.renewalNumber || 1}
                            </Badge>
                          )}
                          {app.renewalStatus === 'due_for_renewal' && (
                            <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                              Renewal Due
                            </Badge>
                          )}
                          {app.renewalStatus === 'expired' && (
                            <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                              Expired
                            </Badge>
                          )}
                          <div className="text-sm text-muted-foreground">
                            <span className="font-medium">Amount:</span> ₹{app.requestedAmount.toLocaleString()}
                          </div>
                        </div>
                        
                        <div className="grid md:grid-cols-2 gap-2 text-sm text-muted-foreground">
                          <div>
                            <span className="font-medium">Scheme:</span> {app.scheme.name}
                          </div>
                          <div>
                            <span className="font-medium">Project:</span> {app.project?.name || 'N/A'}
                          </div>
                          <div>
                            <span className="font-medium">District:</span> {app.district.name}
                          </div>
                          <div>
                            <span className="font-medium">Area:</span> {app.area.name}
                          </div>
                          <div>
                            <span className="font-medium">Applied:</span> {new Date(app.createdAt).toLocaleDateString()}
                          </div>
                          {app.expiryDate && (
                            <div>
                              <span className="font-medium">Expires:</span> {new Date(app.expiryDate).toLocaleDateString()}
                            </div>
                          )}
                          <div>
                            <span className="font-medium">Phone:</span> {app.beneficiary.phone}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 items-end">
                        <Badge 
                          variant="outline" 
                          className={statusInfo.color}
                        >
                          <StatusIcon className="mr-1 h-3 w-3" />
                          {app.status.replace('_', ' ').toUpperCase()}
                        </Badge>
                        <div className="flex flex-col gap-2 w-full">
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => handleViewApplication(app, "view")} className="flex-1">
                              <Eye className="mr-2 h-4 w-4" />
                              View
                            </Button>
                            {getActionButton(app)}
                          </div>
                          <Button variant="secondary" size="sm" onClick={() => {
                            setSelectedApp(app);
                            setShowReportsModal(true);
                          }} className="w-full">
                            <FileText className="mr-2 h-4 w-4" />
                            Reports
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                  );
                })
              )}
            </TabsContent>
          </Tabs>

          {pagination.pages > 1 && (
            <div className="mt-6">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                  {[...Array(pagination.pages)].map((_, i) => (
                    <PaginationItem key={i}>
                      <PaginationLink
                        onClick={() => setCurrentPage(i + 1)}
                        isActive={currentPage === i + 1}
                        className="cursor-pointer"
                      >
                        {i + 1}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <PaginationNext 
                      onClick={() => setCurrentPage(Math.min(pagination.pages, currentPage + 1))}
                      className={currentPage === pagination.pages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
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
            onClose={() => {
              setShowShortlistModal(false);
              setSelectedApp(null);
            }}
            applicationId={selectedApp.applicationNumber}
            applicantName={selectedApp.beneficiary.name}
            mode={selectedApp.status === 'interview_scheduled' ? 'reschedule' : 'schedule'}
            existingInterview={selectedApp.status === 'interview_scheduled' ? selectedApp.interview : undefined}
            onSuccess={() => {
              loadApplications(); // Reload applications to reflect status change
            }}
          />
          <ReportsModal
            isOpen={showReportsModal}
            onClose={() => {
              setShowReportsModal(false);
              setSelectedApp(null);
            }}
            applicationId={selectedApp.applicationNumber}
            applicantName={selectedApp.beneficiary.name}
          />
        </>
      )}
    </div>
  );
}
