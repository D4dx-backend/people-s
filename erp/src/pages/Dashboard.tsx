import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Users, FolderKanban, FileCheck, IndianRupee, TrendingUp, TrendingDown, Loader2, AlertCircle, LayoutDashboard } from "lucide-react";
import { StatsCard } from "@/components/ui/stats-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { dashboard, budgetApi, donationsApi } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { useRBAC } from "@/hooks/useRBAC";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const statusColors = {
  pending: "bg-warning/10 text-warning border-warning/20",
  approved: "bg-success/10 text-success border-success/20",
  review: "bg-info/10 text-info border-info/20",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { getUserRole, isLoading: rbacLoading } = useRBAC();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [overview, setOverview] = useState<any>(null);
  const [recentApplications, setRecentApplications] = useState<any[]>([]);
  const [budgetOverview, setBudgetOverview] = useState<any>(null);
  const [donationStats, setDonationStats] = useState<any>(null);
  const [projectPerformance, setProjectPerformance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Check if user is a beneficiary and redirect
  useEffect(() => {
    const userRole = getUserRole();
    const beneficiaryToken = localStorage.getItem('beneficiary_token');
    
    if (userRole?.name === 'beneficiary' || beneficiaryToken) {
      navigate('/beneficiary/dashboard', { replace: true });
      return;
    }
  }, [navigate, getUserRole]);

  useEffect(() => {
    // Wait for auth and RBAC to finish loading before making API calls
    if (authLoading || rbacLoading) {
      return;
    }
    
    // Ensure user is authenticated before loading data
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    
    // Only load dashboard data if not a beneficiary
    const userRole = getUserRole();
    const beneficiaryToken = localStorage.getItem('beneficiary_token');
    
    if (userRole?.name !== 'beneficiary' && !beneficiaryToken) {
      loadDashboardData();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, authLoading, rbacLoading, getUserRole]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('📊 Dashboard: Loading data from API...');
      const startTime = Date.now();

      const [overviewRes, applicationsRes, budgetRes, donationRes, projectRes] = await Promise.all([
        dashboard.getOverview(),
        dashboard.getRecentApplications(5),
        budgetApi.getOverview(),
        donationsApi.getStats(),
        budgetApi.getProjects()
      ]);

      const loadTime = Date.now() - startTime;
      console.log(`✅ Dashboard: Data loaded from API in ${loadTime}ms`);

      // Log API responses to verify they're real data
      console.log('📈 API Response - Overview:', overviewRes);
      console.log('📋 API Response - Recent Applications:', applicationsRes);
      console.log('💰 API Response - Budget Overview:', budgetRes);
      console.log('💵 API Response - Donation Stats:', donationRes);
      console.log('📁 API Response - Projects:', projectRes);

      if (overviewRes.success && overviewRes.data) {
        const overviewData = overviewRes.data as any;
        console.log('✅ Overview data loaded:', overviewData.overview);
        setOverview(overviewData.overview);
      }
      if (applicationsRes.success && applicationsRes.data) {
        const applicationsData = applicationsRes.data as any;
        console.log('✅ Recent applications loaded:', applicationsData.applications);
        setRecentApplications(applicationsData.applications);
      }
      if (budgetRes.success && budgetRes.data) {
        const budgetData = budgetRes.data as any;
        console.log('✅ Budget overview loaded:', budgetData.overview);
        setBudgetOverview(budgetData.overview);
      }
      if (donationRes.success && donationRes.data) {
        const donationData = donationRes.data as any;
        console.log('✅ Donation stats loaded:', donationData.stats);
        setDonationStats(donationData.stats);
      }
      if (projectRes.success && projectRes.data) {
        const projectData = projectRes.data as any;
        console.log('✅ Projects loaded:', projectData.projects);
        setProjectPerformance(projectData.projects.slice(0, 3));
      }

    } catch (err: any) {
      // Check if it's an authentication error
      if (err.message?.includes('401') || err.message?.includes('403') || err.message?.includes('Authentication') || err.message?.includes('Unauthorized') || (err as any).status === 401 || (err as any).status === 403) {
        setError('Authentication failed. Please login again.');
        toast({
          title: "Authentication Error",
          description: "Your session may have expired. Please login again.",
          variant: "destructive",
        });
        // Don't logout immediately - let user see the error and login again
      } else {
        setError(err.message || 'Failed to load dashboard data');
        toast({
          title: "Error",
          description: "Failed to load dashboard data",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return `₹${(amount / 100000).toFixed(1)}L`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading dashboard...</p>
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
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="relative overflow-hidden rounded-3xl border border-border/40 bg-gradient-to-r from-primary/10 via-background to-secondary/10 p-6 md:p-8 shadow-elegant">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
        <div className="flex items-center gap-4">
          <div className="rounded-2xl bg-gradient-primary p-3 shadow-elegant">
            <LayoutDashboard className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Dashboard</h1>
            <p className="text-muted-foreground mt-1">Welcome back! Here's an overview of your NGO operations.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Projects"
          value={overview?.totalProjects?.toString() || "0"}
          icon={FolderKanban}
          trend={{ value: 12, isPositive: true }}
        />
        <StatsCard
          title="Total Applications"
          value={overview?.totalApplications?.toString() || "0"}
          icon={FileCheck}
          trend={{ value: overview?.recentActivity?.applications || 0, isPositive: true }}
        />
        <StatsCard
          title="Total Beneficiaries"
          value={overview?.totalBeneficiaries?.toString() || "0"}
          icon={Users}
          trend={{ value: overview?.recentActivity?.beneficiaries || 0, isPositive: true }}
        />
        <StatsCard
          title="Budget Utilization"
          value={formatCurrency(overview?.totalSpent || 0)}
          icon={IndianRupee}
          trend={{ value: overview?.totalBudget > 0 ? Math.round((overview.totalSpent / overview.totalBudget) * 100) : 0, isPositive: false }}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="hover:shadow-glow transition-all duration-300">
          <CardHeader>
            <CardTitle>Recent Applications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentApplications.map((app) => (
                <div
                  key={app.id}
                  className="flex items-center justify-between rounded-2xl border border-border/40 bg-muted/30 px-4 py-3 transition-colors hover:bg-muted/50"
                >
                  <div className="space-y-1">
                    <p className="font-medium">{app.applicant}</p>
                    <p className="text-sm text-muted-foreground">{app.scheme}</p>
                    <p className="text-xs text-muted-foreground">{app.id} • {app.date}</p>
                  </div>
                  <Badge variant="outline" className={cn("rounded-full", statusColors[app.status as keyof typeof statusColors])}>
                    {app.status}
                  </Badge>
                </div>
              ))}
            </div>
            <Button variant="outline" className="w-full mt-4 rounded-full">
              View All Applications
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-glow transition-all duration-300">
          <CardHeader>
            <CardTitle>Financial Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Budget</p>
                  <p className="text-xl font-bold">{formatCurrency(budgetOverview?.totalBudget || 0)}</p>
                </div>
                <div className="rounded-2xl bg-gradient-secondary p-3 shadow-elegant">
                  <TrendingUp className="h-6 w-6 text-secondary-foreground" />
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Allocated</span>
                  <span className="font-medium">{formatCurrency(budgetOverview?.totalAllocated || 0)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Disbursed</span>
                  <span className="font-medium">{formatCurrency(budgetOverview?.totalDisbursed || 0)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Pending Payments</span>
                  <span className="font-medium text-warning">{formatCurrency(budgetOverview?.totalPending || 0)}</span>
                </div>
                <div className="flex justify-between text-sm border-t pt-2">
                  <span className="text-muted-foreground">Total Donations</span>
                  <span className="font-medium text-success">{formatCurrency(donationStats?.overall?.totalAmount || 0)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold border-t pt-2">
                  <span>Available Balance</span>
                  <span className="text-success">{formatCurrency(budgetOverview?.availableBalance || 0)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="hover:shadow-glow transition-all duration-300">
        <CardHeader>
          <CardTitle>Top Projects by Budget</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {projectPerformance.map((project) => (
              <div
                key={project.id}
                className="rounded-2xl border border-border/40 bg-muted/30 p-4 space-y-2 hover:shadow-elegant transition-all hover:-translate-y-0.5"
              >
                <h4 className="font-semibold">{project.name}</h4>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Budget</span>
                  <span className="font-medium">{formatCurrency(project.totalBudget)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Utilization</span>
                  <span className="font-medium">{project.utilizationRate?.toFixed(1) || 0}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Applications</span>
                  <span className="font-medium">{project.applicationsCount || 0}</span>
                </div>
              </div>
            ))}
            {projectPerformance.length === 0 && (
              <div className="col-span-3 text-center text-muted-foreground py-8">
                No project data available
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
