import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { Loader2, FileText, Clock, CheckCircle, XCircle, Eye, BarChart3, RefreshCw } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { api, applications as applicationsApi } from "@/lib/api";
import { ApplicationViewModal } from "@/components/modals/ApplicationViewModal";
import { useAuth } from "@/hooks/useAuth";

interface ConsolidationStats {
  total: number;
  pending: number;
  under_review: number;
  field_verification: number;
  interview_scheduled: number;
  interview_completed: number;
  pending_committee_approval: number;
  approved: number;
  rejected: number;
  on_hold: number;
  cancelled: number;
  disbursed: number;
  completed: number;
  draft: number;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  under_review: "Under Review",
  field_verification: "Field Verification",
  interview_scheduled: "Interview Scheduled",
  interview_completed: "Interview Completed",
  pending_committee_approval: "Committee Approval",
  approved: "Approved",
  rejected: "Rejected",
  on_hold: "On Hold",
  cancelled: "Cancelled",
  disbursed: "Disbursed",
  completed: "Completed",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  under_review: "bg-blue-100 text-blue-800 border-blue-200",
  field_verification: "bg-sky-100 text-sky-800 border-sky-200",
  interview_scheduled: "bg-purple-100 text-purple-800 border-purple-200",
  approved: "bg-green-100 text-green-800 border-green-200",
  rejected: "bg-red-100 text-red-800 border-red-200",
  on_hold: "bg-orange-100 text-orange-800 border-orange-200",
  completed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  cancelled: "bg-gray-100 text-gray-800 border-gray-200",
  disbursed: "bg-teal-100 text-teal-800 border-teal-200",
};

const CARD_STATS = [
  { key: "total", label: "Total Applications", icon: BarChart3, color: "text-slate-600" },
  { key: "pending", label: "Pending", icon: Clock, color: "text-yellow-600" },
  { key: "approved", label: "Approved", icon: CheckCircle, color: "text-green-600" },
  { key: "rejected", label: "Rejected", icon: XCircle, color: "text-red-600" },
];

function getTodayString() {
  return new Date().toISOString().split("T")[0];
}
function getFirstDayOfMonth() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().split("T")[0];
}

export default function ApplicationConsolidation() {
  const { user } = useAuth();
  const [startDate, setStartDate] = useState(getFirstDayOfMonth());
  const [endDate, setEndDate] = useState(getTodayString());
  const [selectedScheme, setSelectedScheme] = useState<string>("all");
  const [schemes, setSchemes] = useState<Array<{ _id: string; name: string }>>([]);
  const [stats, setStats] = useState<ConsolidationStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Application list for selected status
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [applicationList, setApplicationList] = useState<any[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pages: 1, total: 0 });

  // View modal
  const [viewApp, setViewApp] = useState<any | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);

  // Load schemes for filter
  useEffect(() => {
    api.request("/schemes?limit=200&status=active")
      .then((res: any) => {
        const list = res?.data?.schemes || res?.schemes || [];
        setSchemes(list);
      })
      .catch(() => {});
  }, []);

  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      if (selectedScheme && selectedScheme !== "all") params.set("scheme", selectedScheme);
      const res = await api.request(`/applications/consolidation?${params.toString()}`);
      setStats((res as any)?.data || null);
    } catch {
      toast({ title: "Failed to load consolidation data", variant: "destructive" });
    } finally {
      setLoadingStats(false);
    }
  }, [startDate, endDate, selectedScheme]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const fetchApplicationsByStatus = useCallback(async (status: string, page = 1) => {
    setLoadingList(true);
    setSelectedStatus(status);
    try {
      const params: Record<string, any> = {
        page,
        limit: 10,
        startDate,
        endDate,
      };
      if (status !== "total") params.status = status;
      if (selectedScheme && selectedScheme !== "all") params.scheme = selectedScheme;

      const res = await applicationsApi.getAll(params);
      setApplicationList(res.data?.applications || []);
      setPagination(res.data?.pagination || { current: 1, pages: 1, total: 0 });
    } catch {
      toast({ title: "Failed to load applications", variant: "destructive" });
    } finally {
      setLoadingList(false);
    }
  }, [startDate, endDate, selectedScheme]);

  const handleCardClick = (key: string) => {
    fetchApplicationsByStatus(key);
  };

  const handleViewApplication = async (appId: string) => {
    try {
      const res = await api.getApplication(appId);
      setViewApp((res as any)?.data?.application || (res as any)?.application || null);
      setShowViewModal(true);
    } catch {
      toast({ title: "Failed to load application details", variant: "destructive" });
    }
  };

  const roleLabel = user?.role
    ? user.role.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())
    : "Admin";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">Application Consolidation</h1>
          <p className="text-sm text-muted-foreground">{roleLabel} — Application summary by time period</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchStats} disabled={loadingStats}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loadingStats ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div className="space-y-1">
              <Label className="text-xs">From Date</Label>
              <Input
                type="date"
                value={startDate}
                max={endDate}
                onChange={e => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">To Date</Label>
              <Input
                type="date"
                value={endDate}
                min={startDate}
                max={getTodayString()}
                onChange={e => setEndDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Scheme (optional)</Label>
              <Select value={selectedScheme} onValueChange={setSelectedScheme}>
                <SelectTrigger>
                  <SelectValue placeholder="All Schemes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Schemes</SelectItem>
                  {schemes.map(s => (
                    <SelectItem key={s._id} value={s._id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={fetchStats} disabled={loadingStats} className="bg-gradient-primary">
              {loadingStats ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Apply Filter
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      {loadingStats && !stats ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : stats ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {CARD_STATS.map(({ key, label, icon: Icon, color }) => (
              <Card
                key={key}
                className="cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-primary/30"
                onClick={() => handleCardClick(key)}
              >
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-muted`}>
                      <Icon className={`h-5 w-5 ${color}`} />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="text-2xl font-bold">{stats[key as keyof ConsolidationStats] ?? 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Detailed breakdown */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Status Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {Object.entries(STATUS_LABELS).map(([key, label]) => {
                  const count = stats[key as keyof ConsolidationStats] ?? 0;
                  if (count === 0) return null;
                  return (
                    <button
                      key={key}
                      onClick={() => handleCardClick(key)}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left"
                    >
                      <span className="text-xs text-muted-foreground">{label}</span>
                      <Badge className={`text-xs ${STATUS_COLORS[key] || "bg-gray-100 text-gray-800"}`}>
                        {count}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}

      {/* Applications List */}
      {selectedStatus && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                {selectedStatus === "total"
                  ? "All Applications"
                  : `${STATUS_LABELS[selectedStatus] || selectedStatus} Applications`}
                {!loadingList && (
                  <Badge variant="outline" className="ml-1">{pagination.total}</Badge>
                )}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setSelectedStatus(null)}>
                ✕
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loadingList ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : applicationList.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">No applications found.</p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>App No.</TableHead>
                        <TableHead>Beneficiary</TableHead>
                        <TableHead className="hidden sm:table-cell">Scheme</TableHead>
                        <TableHead className="hidden md:table-cell">Applied</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {applicationList.map((app: any) => (
                        <TableRow key={app._id}>
                          <TableCell className="font-mono text-xs">{app.applicationNumber || "—"}</TableCell>
                          <TableCell className="text-sm">
                            <div className="font-medium">{app.beneficiary?.name || "—"}</div>
                            <div className="text-xs text-muted-foreground">{app.beneficiary?.phone}</div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-sm">{app.scheme?.name || "—"}</TableCell>
                          <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                            {app.createdAt ? new Date(app.createdAt).toLocaleDateString("en-IN") : "—"}
                          </TableCell>
                          <TableCell>
                            <Badge className={`text-xs ${STATUS_COLORS[app.status] || "bg-gray-100 text-gray-800"}`}>
                              {STATUS_LABELS[app.status] || app.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewApplication(app._id)}
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {pagination.pages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-xs text-muted-foreground">
                      Page {pagination.current} of {pagination.pages} ({pagination.total} total)
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pagination.current <= 1}
                        onClick={() => fetchApplicationsByStatus(selectedStatus, pagination.current - 1)}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pagination.current >= pagination.pages}
                        onClick={() => fetchApplicationsByStatus(selectedStatus, pagination.current + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Application View Modal */}
      <ApplicationViewModal
        open={showViewModal}
        onOpenChange={setShowViewModal}
        application={viewApp}
        mode="view"
      />
    </div>
  );
}
