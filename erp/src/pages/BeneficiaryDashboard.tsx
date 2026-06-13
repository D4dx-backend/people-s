import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogOut, FileText, IndianRupee, Loader2, User, RefreshCw, MapPin, Search, Sparkles, ListFilter, Bell, FileEdit, XCircle, ArrowRight, PauseCircle, Headset } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { beneficiaryApi, type BeneficiaryNotification } from "@/services/beneficiaryApi";
import { useOrgLogoUrl } from "@/hooks/useOrgLogoUrl";
import defaultLogo from "@/assets/logo.png";
import { toast } from "@/hooks/use-toast";

// Interfaces for API data
interface Application {
  _id: string;
  applicationId: string;
  scheme: {
    _id: string;
    name: string;
    category: string;
    maxAmount: number;
  };
  status: string;
  submittedAt: string;
  formData: any;
  location?: {
    district: string | null;
    area: string | null;
    unit: string | null;
  };
  // Renewal fields
  isRenewal?: boolean;
  renewalNumber?: number;
  renewalStatus?: string;
  expiryDate?: string;
}

interface SchemeItem {
  _id: string;
  name: string;
  description: string;
  category: string;
  maxAmount: number;
  benefitDescription?: string;
  hasApplied: boolean;
  hasFormConfiguration: boolean;
  daysRemaining?: number;
  isUrgent?: boolean;
  isNew?: boolean;
}

interface Stats {
  total: number;
  submitted: number;
  under_review: number;
  approved: number;
  rejected: number;
  completed: number;
  cancelled: number;
  totalApprovedAmount: number;
}

export default function BeneficiaryDashboard() {
  const navigate = useNavigate();
  const orgLogoUrl = useOrgLogoUrl();
  const [applications, setApplications] = useState<Application[]>([]);
  const [renewalDueApps, setRenewalDueApps] = useState<any[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("applications");

  // Browse schemes tab state
  const [schemes, setSchemes] = useState<SchemeItem[]>([]);
  const [schemesLoaded, setSchemesLoaded] = useState(false);
  const [schemesLoading, setSchemesLoading] = useState(false);
  const [schemeSearch, setSchemeSearch] = useState("");
  const [schemeCategory, setSchemeCategory] = useState("all");

  // Notifications tab state
  const [notifications, setNotifications] = useState<BeneficiaryNotification[]>([]);
  const [notificationsLoaded, setNotificationsLoaded] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);

  const phoneNumber = localStorage.getItem("user_phone") || "";

  // Load dashboard data on component mount
  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      
      // Debug: Check if token exists
      const token = localStorage.getItem('beneficiary_token');
      console.log('🔍 Dashboard - Loading data');
      console.log('- Token exists:', !!token);
      console.log('- Token (first 20 chars):', token ? token.substring(0, 20) + '...' : 'null');
      console.log('- User role:', localStorage.getItem('user_role'));
      
      if (!token) {
        console.error('❌ No token found! Redirecting to login...');
        toast({
          title: "Authentication Required",
          description: "Please login again",
          variant: "destructive",
        });
        navigate('/beneficiary-login', { replace: true });
        return;
      }
      
      // Load applications, stats, and renewal-due apps in parallel
      const [applicationsResponse, statsResponse] = await Promise.all([
        beneficiaryApi.getMyApplications({ limit: 50 }),
        beneficiaryApi.getApplicationStats()
      ]);

      // Load renewal due separately (non-blocking)
      try {
        const renewalResponse = await beneficiaryApi.getRenewalDueApplications();
        if (renewalResponse?.applications) {
          setRenewalDueApps(renewalResponse.applications);
        }
      } catch (e) {
        // Non-critical - renewal feature may not be active
      }

      setApplications(Array.isArray(applicationsResponse.applications) ? applicationsResponse.applications : []);
      setStats(statsResponse.stats);
    } catch (error: any) {
      console.error('Failed to load dashboard data:', error);
      
      // Check if it's an authentication error
      if (error.message && error.message.includes('permissions')) {
        toast({
          title: "Authentication Error",
          description: "Your session may have expired. Please login again.",
          variant: "destructive",
        });
        // Clear invalid token and redirect
        localStorage.removeItem('beneficiary_token');
        localStorage.removeItem('beneficiary_user');
        navigate('/beneficiary-login', { replace: true });
        return;
      }
      
      // Only show error toast if it's an actual error (not empty data)
      if (error.message && !error.message.includes('No applications found')) {
        toast({
          title: "Failed to Load Data",
          description: error.message || "Could not load your applications. Please try again.",
          variant: "destructive",
        });
      } else {
        // No applications is a normal state, just set empty arrays
        setApplications([]);
        setStats({
          total: 0,
          submitted: 0,
          under_review: 0,
          approved: 0,
          rejected: 0,
          completed: 0,
          cancelled: 0,
          totalApprovedAmount: 0
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    beneficiaryApi.logout();
    toast({ title: "Logged out successfully" });
    navigate("/");
  };

  // Load available schemes lazily when the Browse tab is first opened
  const loadSchemes = async () => {
    if (schemesLoaded || schemesLoading) return;
    try {
      setSchemesLoading(true);
      const response = await beneficiaryApi.getAvailableSchemes();
      setSchemes(Array.isArray(response.schemes) ? (response.schemes as any) : []);
      setSchemesLoaded(true);
    } catch (error: any) {
      toast({
        title: "Failed to Load Schemes",
        description: error?.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setSchemesLoading(false);
    }
  };

  const loadNotifications = async () => {
    if (notificationsLoading) return;
    try {
      setNotificationsLoading(true);
      const response = await beneficiaryApi.getMyNotifications();
      setNotifications(Array.isArray(response.notifications) ? response.notifications : []);
      setNotificationsLoaded(true);
    } catch (error: any) {
      // Non-critical — show empty state on failure
      setNotificationsLoaded(true);
    } finally {
      setNotificationsLoading(false);
    }
  };

  const handleNotificationClick = async (n: BeneficiaryNotification) => {
    const isUnread = (n.recipients || []).some(r => r.status !== 'read' && !r.readAt);
    if (isUnread) {
      try {
        await beneficiaryApi.markNotificationRead(n._id);
        setNotifications(prev =>
          prev.map(item =>
            item._id === n._id
              ? { ...item, recipients: (item.recipients || []).map(r => ({ ...r, status: 'read', readAt: new Date().toISOString() })) }
              : item
          )
        );
      } catch {
        // ignore mark-read failure
      }
    }
    const appId = n.relatedEntities?.application?._id;
    if (appId) {
      navigate(`/beneficiary/track/${appId}`);
    }
  };

  const handleApplyScheme = (scheme: SchemeItem) => {
    if (scheme.hasApplied) {
      toast({
        title: "Already Applied",
        description: "You have already applied for this scheme",
        variant: "destructive",
      });
      return;
    }
    if (!scheme.hasFormConfiguration) {
      toast({
        title: "Form Not Available",
        description: "The application form for this scheme is not ready yet",
        variant: "destructive",
      });
      return;
    }
    navigate(`/beneficiary/apply/${scheme._id}`, { state: { scheme } });
  };

  // Distinct, soft-colored badge styles per status for clear visual separation
  const getStatusBadgeClass = (status: string) => {
    switch (status.toLowerCase()) {
      case "approved":
        return "bg-green-100 text-green-700 border border-green-200";
      case "completed":
        return "bg-emerald-100 text-emerald-700 border border-emerald-200";
      case "under_review":
        return "bg-amber-100 text-amber-700 border border-amber-200";
      case "submitted":
      case "pending_committee_approval":
        return "bg-blue-100 text-blue-700 border border-blue-200";
      case "draft":
        return "bg-slate-100 text-slate-600 border border-slate-300";
      case "rejected":
        return "bg-red-100 text-red-700 border border-red-200";
      case "cancelled":
        return "bg-gray-100 text-gray-500 border border-gray-200";
      case "on_hold":
        return "bg-orange-100 text-orange-700 border border-orange-200";
      default:
        return "bg-blue-100 text-blue-700 border border-blue-200";
    }
  };

  // Left accent bar color for the card based on status
  const getStatusAccent = (status: string) => {
    switch (status.toLowerCase()) {
      case "approved": return "border-l-green-500";
      case "completed": return "border-l-emerald-500";
      case "under_review": return "border-l-amber-500";
      case "submitted":
      case "pending_committee_approval": return "border-l-blue-500";
      case "draft": return "border-l-slate-400";
      case "rejected": return "border-l-red-500";
      case "cancelled": return "border-l-gray-400";
      case "on_hold": return "border-l-orange-500";
      default: return "border-l-blue-500";
    }
  };

  // Human-friendly explanation of what each status means
  const getStatusDescription = (status: string) => {
    switch (status.toLowerCase()) {
      case "draft": return "Not submitted yet \u2014 continue to finish and submit.";
      case "submitted": return "Received. Waiting for the team to start review.";
      case "under_review": return "Our team is reviewing your application.";
      case "pending_committee_approval": return "Awaiting committee approval.";
      case "approved": return "Approved! Benefit will be processed.";
      case "completed": return "Completed \u2014 benefit has been disbursed.";
      case "rejected": return "Not approved this time.";
      case "cancelled": return "This application was cancelled.";
      case "on_hold": return "On hold \u2014 we may need more information.";
      default: return "Your application is being processed.";
    }
  };

  // Progress step for the application lifecycle (1-based; 0 = draft, -1 = terminal)
  const getStatusStep = (status: string) => {
    switch (status.toLowerCase()) {
      case "draft": return 0;
      case "submitted": return 1;
      case "under_review": return 2;
      case "pending_committee_approval": return 3;
      case "approved":
      case "completed": return 4;
      default: return -1;
    }
  };

  const APPLICATION_STEPS = ["Submitted", "Review", "Committee", "Approved"];

  // Compact, easy-to-understand process visualization for an application
  const renderStatusProgress = (status: string) => {
    const s = status.toLowerCase();
    const step = getStatusStep(status);

    // Terminal / non-linear states get a clear single-line explanation
    if (s === "rejected") {
      return (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-red-600">
          <XCircle className="h-3.5 w-3.5 flex-shrink-0" />
          <span>{getStatusDescription(status)}</span>
        </div>
      );
    }
    if (s === "cancelled") {
      return (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-500">
          <XCircle className="h-3.5 w-3.5 flex-shrink-0" />
          <span>{getStatusDescription(status)}</span>
        </div>
      );
    }
    if (s === "on_hold") {
      return (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-orange-600">
          <PauseCircle className="h-3.5 w-3.5 flex-shrink-0" />
          <span>{getStatusDescription(status)}</span>
        </div>
      );
    }

    return (
      <div className="mt-2.5">
        <div className="flex items-center gap-1">
          {APPLICATION_STEPS.map((label, i) => {
            const reached = step >= i + 1;
            return (
              <div
                key={label}
                className={`h-1.5 flex-1 rounded-full transition-colors ${reached ? "bg-green-500" : "bg-muted"}`}
              />
            );
          })}
        </div>
        <div className="mt-1 flex justify-between">
          {APPLICATION_STEPS.map((label, i) => {
            const reached = step >= i + 1;
            return (
              <span
                key={label}
                className={`text-[9px] ${reached ? "text-green-600 font-medium" : "text-muted-foreground"}`}
              >
                {label}
              </span>
            );
          })}
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground leading-snug">
          {getStatusDescription(status)}
        </p>
      </div>
    );
  };

  // Status options for the filter dropdown
  const statusOptions = [
    { value: "all", label: "All Statuses" },
    { value: "draft", label: "Draft" },
    { value: "submitted", label: "Submitted" },
    { value: "under_review", label: "Under Review" },
    { value: "pending_committee_approval", label: "Pending Approval" },
    { value: "approved", label: "Approved" },
    { value: "completed", label: "Completed" },
    { value: "rejected", label: "Rejected" },
    { value: "cancelled", label: "Cancelled" },
  ];

  const filteredApplications = statusFilter === "all"
    ? applications
    : applications.filter((app) => app.status?.toLowerCase() === statusFilter);

  // Draft applications that the user can resume
  const draftApplications = applications.filter((app) => app.status?.toLowerCase() === "draft");

  const schemeCategories = ["all", ...Array.from(new Set(schemes.map((s) => s.category).filter(Boolean)))];
  const filteredSchemes = schemes.filter((s) => {
    const matchesSearch = !schemeSearch ||
      s.name?.toLowerCase().includes(schemeSearch.toLowerCase()) ||
      s.description?.toLowerCase().includes(schemeSearch.toLowerCase());
    const matchesCategory = schemeCategory === "all" || s.category === schemeCategory;
    return matchesSearch && matchesCategory;
  });

  const renderLocation = (app: Application) => {
    const parts = [app.location?.district, app.location?.area, app.location?.unit].filter(Boolean);
    if (parts.length === 0) return null;
    return (
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <MapPin className="h-3 w-3 flex-shrink-0" />
        <span className="truncate">{parts.join(" \u203A ")}</span>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-3 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <img src={orgLogoUrl} alt="Logo" className="h-10 w-10 rounded-full" onError={(e) => { (e.target as HTMLImageElement).src = defaultLogo; }} />
            <div>
              <h1 className="text-lg font-bold">Beneficiary Portal</h1>
              <p className="text-xs text-muted-foreground hidden sm:block">+91 {phoneNumber}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Contact Coordinator */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/beneficiary/coordinators")}
            >
              <Headset className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Contact</span>
            </Button>

            {/* Update Profile */}
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate("/beneficiary/profile-completion")}
              className="hidden sm:flex"
            >
              <User className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Profile</span>
            </Button>

            {/* Logout */}
            <Button variant="ghost" size="sm" onClick={handleLogout} className="hidden sm:flex">
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="sm:hidden">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-3 py-4 sm:px-4 sm:py-6 pb-20 md:pb-6">
        {/* Quick Stats - Mobile Optimized */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <Card className="shadow-sm">
            <CardHeader className="pb-2 px-3 pt-3">
              <CardTitle className="text-xs font-medium text-muted-foreground">Applications</CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="text-xl sm:text-2xl font-bold">
                {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : stats?.total || 0}
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardHeader className="pb-2 px-3 pt-3">
              <CardTitle className="text-xs font-medium text-muted-foreground">Approved</CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="text-xl sm:text-2xl font-bold text-green-600">
                {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : stats?.approved || 0}
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardHeader className="pb-2 px-3 pt-3">
              <CardTitle className="text-xs font-medium text-muted-foreground">Received</CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="text-xl sm:text-2xl font-bold">
                {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : `₹${(stats?.totalApprovedAmount || 0).toLocaleString()}`}
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardHeader className="pb-2 px-3 pt-3">
              <CardTitle className="text-xs font-medium text-muted-foreground">Under Review</CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="text-xl sm:text-2xl font-bold text-orange-600">
                {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : stats?.under_review || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Renewal Alerts */}
        {renewalDueApps.length > 0 && (
          <Card className="mb-4 shadow-sm border-amber-200 bg-amber-50">
            <CardHeader className="pb-2 px-3 pt-3">
              <CardTitle className="flex items-center gap-2 text-base text-amber-800">
                <RefreshCw className="h-4 w-4" />
                Renewal Required ({renewalDueApps.length})
              </CardTitle>
              <CardDescription className="text-amber-700 text-xs">
                The following applications need to be renewed
              </CardDescription>
            </CardHeader>
            <CardContent className="px-3 pb-3 space-y-2">
              {renewalDueApps.map((app: any) => (
                <div key={app._id} className="flex items-center justify-between p-2 bg-white rounded-lg border border-amber-100">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{app.scheme?.name || 'Scheme'}</p>
                    <p className="text-xs text-muted-foreground">
                      {app.expiryDate ? `Expires: ${new Date(app.expiryDate).toLocaleDateString()}` : 'Renewal due'}
                    </p>
                  </div>
                  <Button 
                    size="sm" 
                    className="ml-2 text-xs h-7 bg-amber-600 hover:bg-amber-700"
                    onClick={() => navigate(`/beneficiary/apply?renew=${app._id}`)}
                  >
                    Renew Now
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Draft Applications - Resume Highlight */}
        {!isLoading && draftApplications.length > 0 && (
          <Card className="mb-4 border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 shadow-sm overflow-hidden">
            <CardHeader className="pb-2 px-3 pt-3">
              <CardTitle className="flex items-center gap-2 text-base text-amber-900">
                <FileEdit className="h-4 w-4" />
                Continue where you left off
                <span className="ml-auto rounded-full bg-amber-200 text-amber-900 px-2 py-0.5 text-[11px] font-semibold">
                  {draftApplications.length} draft{draftApplications.length > 1 ? "s" : ""}
                </span>
              </CardTitle>
              <CardDescription className="text-amber-800 text-xs">
                You have unfinished application{draftApplications.length > 1 ? "s" : ""}. Resume and submit before the deadline.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-3 pb-3 space-y-2">
              {draftApplications.map((app) => (
                <div
                  key={app._id}
                  className="flex items-center justify-between gap-2 p-2.5 bg-white rounded-lg border border-amber-200"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{app.scheme?.name || "Scheme"}</p>
                    <p className="text-xs text-amber-700 capitalize">{app.scheme?.category}</p>
                  </div>
                  <Button
                    size="sm"
                    className="flex-shrink-0 text-xs h-8 bg-amber-600 hover:bg-amber-700"
                    onClick={() => navigate(`/beneficiary/apply/${app.scheme?._id || app.scheme}?draftId=${app._id}`)}
                  >
                    Continue
                    <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Main Tabs: Applied vs Browse Schemes */}
        <Tabs
          value={activeTab}
          className="w-full"
          onValueChange={(v) => { setActiveTab(v); if (v === "schemes") loadSchemes(); if (v === "notifications") loadNotifications(); }}
        >
          <TabsList className="hidden md:grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="applications" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              My Applications
              {applications.length > 0 && (
                <span className="ml-1 rounded-full bg-primary/10 text-primary px-1.5 py-0.5 text-[10px] font-semibold">
                  {applications.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="schemes" className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Browse Schemes
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Notifications
            </TabsTrigger>
          </TabsList>

          {/* ---------- Applied / My Applications ---------- */}
          <TabsContent value="applications" className="space-y-3 mt-0">
            {/* Header row with status filter */}
            <div className="flex items-center justify-between gap-2 px-1">
              <h2 className="text-base sm:text-lg font-bold">My Applications</h2>
              <div className="flex items-center gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[150px] h-9 text-xs">
                    <ListFilter className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                    <SelectValue placeholder="Filter status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="text-xs">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : filteredApplications.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredApplications.map((app) => (
                  <Card
                    key={app._id}
                    className={`hover:shadow-md transition-shadow border-l-4 ${getStatusAccent(app.status)}`}
                  >
                    <CardHeader className="pb-2 px-3 pt-3">
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <CardTitle className="text-sm truncate">{app.scheme?.name}</CardTitle>
                          <CardDescription className="text-xs">ID: {app.applicationId}</CardDescription>
                        </div>
                        <Badge className={`${getStatusBadgeClass(app.status)} text-[10px] font-semibold flex-shrink-0 shadow-none hover:${getStatusBadgeClass(app.status)}`}>
                          {app.status.replace(/_/g, ' ').toUpperCase()}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {app.isRenewal && (
                          <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                            <RefreshCw className="mr-1 h-3 w-3" />
                            Renewal #{app.renewalNumber || 1}
                          </Badge>
                        )}
                        {app.renewalStatus === 'due_for_renewal' && (
                          <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                            Renewal Due
                          </Badge>
                        )}
                        {app.renewalStatus === 'expired' && (
                          <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200">
                            Expired
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="px-3 pb-3">
                      <div className="space-y-1.5 text-xs text-muted-foreground">
                        {renderLocation(app)}
                        <p>Applied: {new Date(app.submittedAt).toLocaleDateString()}</p>
                        {app.expiryDate && (
                          <p>Expires: {new Date(app.expiryDate).toLocaleDateString()}</p>
                        )}
                        <p className="font-semibold text-sm text-foreground">
                          {app.scheme.maxAmount ? `₹${app.scheme.maxAmount.toLocaleString()}` : 'Amount varies'}
                        </p>
                        <p className="text-xs capitalize">{app.scheme.category}</p>
                      </div>
                      {/* Easy-to-understand status process */}
                      {renderStatusProgress(app.status)}
                      <div className="flex gap-2 mt-3">
                        {app.status === 'draft' ? (
                          <Button 
                            size="sm" 
                            className="flex-1 text-xs h-8 bg-slate-700 hover:bg-slate-800"
                            onClick={() => navigate(`/beneficiary/apply/${app.scheme?._id || app.scheme}?draftId=${app._id}`)}
                          >
                            Continue Application
                          </Button>
                        ) : (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="flex-1 text-xs h-8"
                            onClick={() => navigate(`/beneficiary/track/${app.applicationId}`)}
                          >
                            View Details
                          </Button>
                        )}
                        {app.renewalStatus === 'due_for_renewal' && (
                          <Button 
                            size="sm" 
                            className="flex-1 text-xs h-8 bg-amber-600 hover:bg-amber-700"
                            onClick={() => navigate(`/beneficiary/apply?renew=${app._id}`)}
                          >
                            <RefreshCw className="mr-1 h-3 w-3" />
                            Renew
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : applications.length > 0 ? (
              <Card className="text-center py-8">
                <CardContent>
                  <ListFilter className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <h3 className="text-base font-semibold mb-1">No matching applications</h3>
                  <p className="text-muted-foreground text-sm mb-4">
                    No applications found for the selected status.
                  </p>
                  <Button variant="outline" onClick={() => setStatusFilter("all")}>
                    Clear Filter
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card className="text-center py-8">
                <CardContent>
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Applications Yet</h3>
                  <p className="text-muted-foreground mb-4">
                    You haven't applied for any schemes yet. Start by browsing available schemes.
                  </p>
                  <Button onClick={() => navigate("/beneficiary/schemes")}>
                    Browse Schemes
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ---------- Browse Schemes ---------- */}
          <TabsContent value="schemes" className="space-y-3 mt-0">
            <h2 className="text-base sm:text-lg font-bold px-1">Browse All Schemes</h2>

            {/* Search + category filter */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search schemes..."
                  value={schemeSearch}
                  onChange={(e) => setSchemeSearch(e.target.value)}
                  className="pl-10 text-sm"
                />
              </div>
              {schemeCategories.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {schemeCategories.map((cat) => (
                    <Button
                      key={cat}
                      variant={schemeCategory === cat ? "default" : "outline"}
                      size="sm"
                      className="text-xs h-7 capitalize flex-shrink-0"
                      onClick={() => setSchemeCategory(cat)}
                    >
                      {cat}
                    </Button>
                  ))}
                </div>
              )}
            </div>

            {schemesLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : filteredSchemes.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredSchemes.map((scheme) => (
                  <Card key={scheme._id} className="hover:shadow-md transition-shadow flex flex-col">
                    <CardHeader className="pb-2 px-3 pt-3">
                      <div className="flex justify-between items-start gap-2">
                        <CardTitle className="text-sm leading-snug">{scheme.name}</CardTitle>
                        <div className="flex flex-col gap-1 items-end flex-shrink-0">
                          {scheme.isNew && (
                            <Badge className="bg-blue-100 text-blue-700 border border-blue-200 text-[10px] shadow-none">New</Badge>
                          )}
                          {scheme.isUrgent && (
                            <Badge className="bg-red-100 text-red-700 border border-red-200 text-[10px] shadow-none">Urgent</Badge>
                          )}
                        </div>
                      </div>
                      {scheme.description && (
                        <CardDescription className="text-xs line-clamp-2">{scheme.description}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="px-3 pb-3 flex flex-col flex-1">
                      <div className="space-y-1 text-xs text-muted-foreground flex-1">
                        <p className="font-semibold text-sm text-foreground">
                          {scheme.maxAmount ? `₹${scheme.maxAmount.toLocaleString()}` : 'Amount varies'}
                        </p>
                        <p className="capitalize">{scheme.category}</p>
                        {typeof scheme.daysRemaining === 'number' && scheme.daysRemaining >= 0 && (
                          <p>{scheme.daysRemaining} days remaining</p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        className="w-full text-xs h-8 mt-3"
                        variant={scheme.hasApplied ? "outline" : "default"}
                        disabled={scheme.hasApplied}
                        onClick={() => handleApplyScheme(scheme)}
                      >
                        {scheme.hasApplied ? "Already Applied" : "Apply Now"}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="text-center py-8">
                <CardContent>
                  <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Schemes Found</h3>
                  <p className="text-muted-foreground text-sm">
                    {schemesLoaded ? "No schemes match your search." : "Loading available schemes..."}
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ---------- Notifications ---------- */}
          <TabsContent value="notifications" className="space-y-3 mt-0">
            <h2 className="text-base sm:text-lg font-bold px-1">Notifications</h2>
            {notificationsLoading && !notificationsLoaded ? (
              <Card className="text-center py-10">
                <CardContent>
                  <Loader2 className="h-8 w-8 mx-auto text-muted-foreground animate-spin" />
                </CardContent>
              </Card>
            ) : notifications.length === 0 ? (
              <Card className="text-center py-10">
                <CardContent>
                  <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No notifications yet</h3>
                  <p className="text-muted-foreground text-sm">
                    Updates about your applications and announcements will appear here.
                  </p>
                </CardContent>
              </Card>
            ) : (
              notifications.map((n) => {
                const isUnread = (n.recipients || []).some(r => r.status !== "read" && !r.readAt);
                const hasApplication = !!n.relatedEntities?.application?._id;
                return (
                  <Card
                    key={n._id}
                    className={`shadow-sm transition-colors ${hasApplication ? "cursor-pointer hover:bg-muted/50" : ""} ${isUnread ? "border-l-4 border-l-primary" : ""}`}
                    onClick={() => handleNotificationClick(n)}
                  >
                    <CardContent className="py-4">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">
                          <Bell className={`h-5 w-5 ${isUnread ? "text-primary" : "text-muted-foreground"}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className={`text-sm sm:text-base ${isUnread ? "font-bold" : "font-semibold"}`}>{n.title}</h3>
                            {isUnread && <Badge className="bg-primary text-[10px] flex-shrink-0">New</Badge>}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1 whitespace-pre-line">{n.message}</p>
                          <div className="flex items-center justify-between gap-2 mt-2">
                            <p className="text-xs text-muted-foreground">{new Date(n.createdAt).toLocaleString()}</p>
                            {hasApplication && (
                              <span className="text-xs font-medium text-primary inline-flex items-center gap-1">
                                View Application <ArrowRight className="h-3 w-3" />
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>
        </Tabs>

        {/* Payment History - Show only if there are approved applications */}
        {stats && stats.totalApprovedAmount > 0 && (
          <div className="space-y-3 mt-6">
            <h2 className="text-lg font-bold px-1">Payment Summary</h2>
            
            <Card className="shadow-sm">
              <CardHeader className="pb-2 px-3 pt-3">
                <CardTitle className="text-sm">Total Approved Amount</CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <div className="flex items-center gap-1.5 text-xl font-bold text-green-600">
                  <IndianRupee className="h-5 w-5" />
                  {stats.totalApprovedAmount.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  From {stats.approved + stats.completed} approved applications
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 shadow-[0_-1px_8px_rgba(0,0,0,0.06)]">
        <div className="grid grid-cols-4 h-16">
          <button
            type="button"
            onClick={() => { setActiveTab("applications"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${activeTab === "applications" ? "text-primary" : "text-muted-foreground"}`}
            aria-label="My Applications"
          >
            <div className="relative">
              <FileText className="h-5 w-5" />
              {applications.length > 0 && (
                <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-semibold flex items-center justify-center">
                  {applications.length}
                </span>
              )}
            </div>
            <span className="text-[10px] font-medium">Applications</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab("schemes"); loadSchemes(); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${activeTab === "schemes" ? "text-primary" : "text-muted-foreground"}`}
            aria-label="Browse Schemes"
          >
            <Sparkles className="h-5 w-5" />
            <span className="text-[10px] font-medium">Schemes</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab("notifications"); loadNotifications(); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${activeTab === "notifications" ? "text-primary" : "text-muted-foreground"}`}
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            <span className="text-[10px] font-medium">Notifications</span>
          </button>

          <button
            type="button"
            onClick={() => navigate("/beneficiary/profile-completion")}
            className="flex flex-col items-center justify-center gap-0.5 text-muted-foreground transition-colors"
            aria-label="Profile"
          >
            <User className="h-5 w-5" />
            <span className="text-[10px] font-medium">Profile</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
