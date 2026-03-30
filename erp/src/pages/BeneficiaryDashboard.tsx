import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogOut, FileText, Calendar, IndianRupee, Bell, Search, Loader2, User, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { beneficiaryApi } from "@/services/beneficiaryApi";
import { useConfig } from "@/contexts/ConfigContext";
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
  // Renewal fields
  isRenewal?: boolean;
  renewalNumber?: number;
  renewalStatus?: string;
  expiryDate?: string;
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
  const [searchId, setSearchId] = useState("");
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [interviewOpen, setInterviewOpen] = useState(false);
  const [applications, setApplications] = useState<Application[]>([]);
  const [renewalDueApps, setRenewalDueApps] = useState<any[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
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
        beneficiaryApi.getMyApplications({ limit: 10 }),
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

  const handleTrackApplication = () => {
    if (!searchId.trim()) {
      toast({ title: "Please enter an application ID", variant: "destructive" });
      return;
    }
    navigate(`/beneficiary/track/${searchId}`);
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "approved": return "bg-green-600";
      case "completed": return "bg-green-700";
      case "under_review": return "bg-yellow-600";
      case "submitted": return "bg-blue-600";
      case "draft": return "bg-amber-500";
      case "rejected": return "bg-red-600";
      case "cancelled": return "bg-gray-600";
      case "on_hold": return "bg-orange-600";
      default: return "bg-blue-600";
    }
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
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate("/beneficiary/profile-completion")}
              className="sm:hidden"
            >
              <User className="h-5 w-5" />
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

      <div className="container mx-auto px-3 py-4 sm:px-4 sm:py-6">
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

        {/* Track Application - Mobile Optimized */}
        <Card className="mb-4 shadow-sm">
          <CardHeader className="pb-3 px-3 pt-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Search className="h-4 w-4" />
              Track Application
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                placeholder="Enter Application ID"
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
                className="text-sm"
              />
              <Button onClick={handleTrackApplication} className="w-full sm:w-auto">Track</Button>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Button onClick={() => navigate("/beneficiary/schemes")} className="w-full">
            <FileText className="mr-2 h-4 w-4" />
            New Application
          </Button>
          
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => navigate("/beneficiary/schemes")}
          >
            <FileText className="mr-2 h-4 w-4" />
            Browse All Schemes
          </Button>
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

        {/* My Applications */}
        <div className="space-y-3">
          <h2 className="text-lg font-bold px-1">My Applications</h2>
          
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : applications.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {applications.map((app) => (
                <Card key={app._id} className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardHeader className="pb-2 px-3 pt-3">
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-sm truncate">{app.scheme?.name}</CardTitle>
                        <CardDescription className="text-xs">ID: {app.applicationId}</CardDescription>
                      </div>
                      <Badge className={`${getStatusColor(app.status)} text-xs flex-shrink-0`}>
                        {app.status.replace('_', ' ').toUpperCase()}
                      </Badge>
                    </div>
                    {app.isRenewal && (
                      <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200 mt-1">
                        <RefreshCw className="mr-1 h-3 w-3" />
                        Renewal #{app.renewalNumber || 1}
                      </Badge>
                    )}
                    {app.renewalStatus === 'due_for_renewal' && (
                      <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200 mt-1">
                        Renewal Due
                      </Badge>
                    )}
                    {app.renewalStatus === 'expired' && (
                      <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200 mt-1">
                        Expired
                      </Badge>
                    )}
                  </CardHeader>
                  <CardContent className="px-3 pb-3">
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <p>Applied: {new Date(app.submittedAt).toLocaleDateString()}</p>
                      {app.expiryDate && (
                        <p>Expires: {new Date(app.expiryDate).toLocaleDateString()}</p>
                      )}
                      <p className="font-semibold text-sm text-foreground">
                        {app.scheme.maxAmount ? `₹${app.scheme.maxAmount.toLocaleString()}` : 'Amount varies'}
                      </p>
                      <p className="text-xs">{app.scheme.category}</p>
                    </div>
                    <div className="flex gap-2 mt-3">
                      {app.status === 'draft' ? (
                        <Button 
                          size="sm" 
                          className="flex-1 text-xs h-8 bg-amber-600 hover:bg-amber-700"
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
        </div>

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
    </div>
  );
}
