import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Users, FileCheck, Loader2, AlertCircle, LayoutDashboard } from "lucide-react";
import { StatsCard } from "@/components/ui/stats-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { dashboard } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

const statusColors: Record<string, string> = {
  pending:  "bg-warning/10 text-warning border-warning/20",
  approved: "bg-success/10 text-success border-success/20",
  review:   "bg-info/10 text-info border-info/20",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
};

export default function AreaPresidentDashboard() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [overview, setOverview] = useState<any>(null);
  const [recentApplications, setRecentApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [overviewData, recentData] = await Promise.all([
          dashboard.getOverview().catch(() => null),
          dashboard.getRecentApplications(8).catch(() => null),
        ]);

        if (overviewData?.data) setOverview(overviewData.data);
        if (recentData?.data?.recentApplications) setRecentApplications(recentData.data.recentApplications);
      } catch (err: any) {
        const msg = err?.message || 'Failed to load dashboard data';
        setError(msg);
        toast({ title: 'Dashboard Error', description: msg, variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [authLoading, isAuthenticated]);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <LayoutDashboard className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Area President Dashboard</h1>
            <p className="text-sm text-muted-foreground">Welcome back, {user?.name}</p>
          </div>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatsCard
          title="Total Applications"
          value={overview?.totalApplications ?? 0}
          icon={FileCheck}
          description="In your unit"
        />
        <StatsCard
          title="Beneficiaries"
          value={overview?.totalBeneficiaries ?? 0}
          icon={Users}
          description="Registered"
        />
        <StatsCard
          title="Pending Review"
          value={overview?.pendingApplications ?? 0}
          icon={AlertCircle}
          description="Awaiting action"
        />
      </div>

      {/* Recent Applications */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base font-semibold">Recent Applications</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => navigate('/applications/all')}>
            View All
          </Button>
        </CardHeader>
        <CardContent>
          {recentApplications.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No recent applications.</p>
          ) : (
            <div className="divide-y">
              {recentApplications.map((app: any, idx: number) => (
                <div key={app.id ?? idx} className="flex items-center justify-between py-3 cursor-pointer hover:bg-muted/30 rounded px-2 -mx-2 transition-colors" onClick={() => navigate('/applications')}>
                  <div>
                    <p className="text-sm font-medium">{app.applicant}</p>
                    <p className="text-xs text-muted-foreground">{app.scheme}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className={statusColors[app.status] ?? ''}
                  >
                    {app.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
