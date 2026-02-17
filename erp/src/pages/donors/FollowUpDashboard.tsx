import { useState, useEffect, useCallback } from "react";
import {
  Bell,
  Clock,
  AlertTriangle,
  CheckCircle,
  Users,
  Send,
  UserPlus,
  Calendar,
  Phone,
  MessageSquare,
  RefreshCw,
  ChevronRight,
  Filter,
  IndianRupee,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useRBAC } from "@/hooks/useRBAC";
import { donorFollowUpService } from "@/services/donorFollowUpService";
import type {
  DonorFollowUp,
  FollowUpDashboardStats,
} from "@/types/donorFollowUp";

const statusConfig: Record<
  string,
  { label: string; color: string; icon: React.ReactNode }
> = {
  scheduled: {
    label: "Scheduled",
    color: "bg-blue-100 text-blue-800 border-blue-200",
    icon: <Clock className="h-3 w-3" />,
  },
  sent_first_reminder: {
    label: "1st Reminder Sent",
    color: "bg-cyan-100 text-cyan-800 border-cyan-200",
    icon: <Bell className="h-3 w-3" />,
  },
  sent_final_reminder: {
    label: "Final Reminder Sent",
    color: "bg-yellow-100 text-yellow-800 border-yellow-200",
    icon: <Bell className="h-3 w-3" />,
  },
  completed: {
    label: "Completed",
    color: "bg-green-100 text-green-800 border-green-200",
    icon: <CheckCircle className="h-3 w-3" />,
  },
  overdue: {
    label: "Overdue",
    color: "bg-orange-100 text-orange-800 border-orange-200",
    icon: <AlertTriangle className="h-3 w-3" />,
  },
  lapsed: {
    label: "Lapsed",
    color: "bg-red-100 text-red-800 border-red-200",
    icon: <XCircle className="h-3 w-3" />,
  },
  cancelled: {
    label: "Cancelled",
    color: "bg-gray-100 text-gray-800 border-gray-200",
    icon: <XCircle className="h-3 w-3" />,
  },
};

const frequencyLabels: Record<string, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  half_yearly: "Half-Yearly",
  yearly: "Yearly",
  custom: "Custom",
  one_time: "One-Time (Annual)",
};

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return "N/A";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function getDaysUntilDue(dateStr: string): number {
  const now = new Date();
  const due = new Date(dateStr);
  return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export default function FollowUpDashboard() {
  const { hasAnyPermission } = useRBAC();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("upcoming");
  const [stats, setStats] = useState<FollowUpDashboardStats | null>(null);
  const [followUps, setFollowUps] = useState<DonorFollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [frequencyFilter, setFrequencyFilter] = useState("all");
  const [selectedFollowUp, setSelectedFollowUp] =
    useState<DonorFollowUp | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const canView = hasAnyPermission([
    "donors.read",
    "donors.read.regional",
    "donors.read.all",
  ]);
  const canUpdate = hasAnyPermission([
    "donors.update",
    "donors.update.regional",
  ]);

  const loadStats = useCallback(async () => {
    try {
      const response = await donorFollowUpService.getDashboardStats();
      if (response && (response as any).stats) {
        setStats((response as any).stats);
      }
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  }, []);

  const loadFollowUps = useCallback(async () => {
    setLoading(true);
    try {
      let response;
      switch (activeTab) {
        case "upcoming":
          response = await donorFollowUpService.getUpcoming(30);
          setFollowUps(
            (response as any)?.followUps || []
          );
          break;
        case "overdue":
          response = await donorFollowUpService.getOverdue();
          setFollowUps(
            (response as any)?.followUps || []
          );
          break;
        case "lapsed":
          response = await donorFollowUpService.getLapsed();
          setFollowUps(
            (response as any)?.followUps || []
          );
          break;
        case "all":
          response = await donorFollowUpService.getAll({
            search: searchTerm,
            status: statusFilter !== "all" ? statusFilter : undefined,
            frequency:
              frequencyFilter !== "all" ? frequencyFilter : undefined,
            limit: 50,
            sortBy: "nextDueDate",
            sortOrder: "asc",
          });
          setFollowUps(
            (response as any)?.followUps || []
          );
          break;
      }
    } catch (error) {
      console.error("Error loading follow-ups:", error);
      toast({
        title: "Error",
        description: "Failed to load follow-ups",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [activeTab, searchTerm, statusFilter, frequencyFilter, toast]);

  useEffect(() => {
    if (canView) {
      loadStats();
      loadFollowUps();
    }
  }, [canView, loadStats, loadFollowUps]);

  const handleSendReminder = async (followUp: DonorFollowUp) => {
    setActionLoading(true);
    try {
      await donorFollowUpService.sendReminder(followUp._id);
      toast({
        title: "Reminder Sent",
        description: `WhatsApp reminder sent to ${followUp.donor?.name}`,
      });
      loadFollowUps();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send reminder",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleComplete = async (followUp: DonorFollowUp) => {
    setActionLoading(true);
    try {
      await donorFollowUpService.complete(followUp._id);
      toast({
        title: "Completed",
        description: `Follow-up for ${followUp.donor?.name} marked as completed`,
      });
      loadFollowUps();
      loadStats();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to complete follow-up",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async (followUp: DonorFollowUp) => {
    setActionLoading(true);
    try {
      await donorFollowUpService.cancel(followUp._id, "Manually cancelled");
      toast({
        title: "Cancelled",
        description: `Follow-up for ${followUp.donor?.name} cancelled`,
      });
      loadFollowUps();
      loadStats();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to cancel follow-up",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!selectedFollowUp || !noteText.trim()) return;
    setActionLoading(true);
    try {
      await donorFollowUpService.addNote(selectedFollowUp._id, noteText);
      toast({ title: "Note added" });
      setShowNoteModal(false);
      setNoteText("");
      loadFollowUps();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add note",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleTriggerProcessing = async () => {
    try {
      await donorFollowUpService.triggerProcessing();
      toast({
        title: "Processing Triggered",
        description:
          "Reminder processing has been triggered. Results will appear shortly.",
      });
      setTimeout(() => {
        loadStats();
        loadFollowUps();
      }, 5000);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to trigger processing",
        variant: "destructive",
      });
    }
  };

  if (!canView) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
          <p className="text-muted-foreground">
            You don't have permission to view follow-up data.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 px-2 py-6 sm:px-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold">Donor Follow-ups</h1>
          <p className="text-muted-foreground">
            Track reminders, overdue donors, and follow-up schedules
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              loadStats();
              loadFollowUps();
            }}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          {canUpdate && (
            <Button variant="outline" size="sm" onClick={handleTriggerProcessing}>
              <Bell className="h-4 w-4 mr-1" />
              Process Reminders Now
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Total Active</p>
                  <p className="text-2xl font-bold">{stats.totalActive}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-blue-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Scheduled</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {stats.totalScheduled}
                  </p>
                </div>
                <Calendar className="h-8 w-8 text-blue-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Due This Week</p>
                  <p className="text-2xl font-bold text-yellow-600">
                    {stats.dueThisWeek}
                  </p>
                </div>
                <Clock className="h-8 w-8 text-yellow-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-orange-200">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Overdue</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {stats.overdue}
                  </p>
                </div>
                <AlertTriangle className="h-8 w-8 text-orange-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-red-200">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Lapsed</p>
                  <p className="text-2xl font-bold text-red-600">
                    {stats.lapsed}
                  </p>
                </div>
                <XCircle className="h-8 w-8 text-red-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Expected</p>
                  <p className="text-lg font-bold text-green-600">
                    {formatAmount(stats.expectedAmount)}
                  </p>
                </div>
                <IndianRupee className="h-8 w-8 text-green-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-4"
      >
        <div className="flex items-center justify-between flex-wrap gap-3">
          <TabsList>
            <TabsTrigger value="upcoming" className="gap-1">
              <Clock className="h-3.5 w-3.5" />
              Upcoming
              {stats?.dueThisWeek ? (
                <Badge variant="secondary" className="ml-1 h-5">
                  {stats.dueThisWeek}
                </Badge>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="overdue" className="gap-1">
              <AlertTriangle className="h-3.5 w-3.5" />
              Overdue
              {stats?.overdue ? (
                <Badge variant="destructive" className="ml-1 h-5">
                  {stats.overdue}
                </Badge>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="lapsed" className="gap-1">
              <XCircle className="h-3.5 w-3.5" />
              Lapsed
              {stats?.lapsed ? (
                <Badge variant="destructive" className="ml-1 h-5">
                  {stats.lapsed}
                </Badge>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="all" className="gap-1">
              <Filter className="h-3.5 w-3.5" />
              All
            </TabsTrigger>
          </TabsList>

          {activeTab === "all" && (
            <div className="flex items-center gap-2">
              <Input
                placeholder="Search donor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-48"
              />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="sent_first_reminder">
                    1st Reminder
                  </SelectItem>
                  <SelectItem value="sent_final_reminder">
                    Final Reminder
                  </SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="lapsed">Lapsed</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={frequencyFilter}
                onValueChange={setFrequencyFilter}
              >
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Frequency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Freq</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="half_yearly">Half-Yearly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                  <SelectItem value="one_time">One-Time</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* All tabs share the same table */}
        {["upcoming", "overdue", "lapsed", "all"].map((tab) => (
          <TabsContent key={tab} value={tab}>
            <Card>
              <CardContent className="p-0">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-muted-foreground">
                      Loading...
                    </span>
                  </div>
                ) : followUps.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle className="h-12 w-12 text-green-300 mx-auto mb-3" />
                    <p className="text-muted-foreground">
                      {tab === "upcoming"
                        ? "No upcoming follow-ups in the next 30 days"
                        : tab === "overdue"
                          ? "No overdue follow-ups — great job!"
                          : tab === "lapsed"
                            ? "No lapsed donors"
                            : "No follow-ups found"}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Donor</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Last Donation</TableHead>
                        <TableHead>Expected Amount</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Frequency</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Assigned To</TableHead>
                        {canUpdate && (
                          <TableHead className="text-right">Actions</TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {followUps.map((fu) => {
                        const daysUntil = getDaysUntilDue(fu.nextDueDate);
                        const stCfg =
                          statusConfig[fu.status] || statusConfig.scheduled;

                        return (
                          <TableRow
                            key={fu._id}
                            className={`cursor-pointer hover:bg-muted/50 ${
                              fu.status === "overdue"
                                ? "bg-orange-50/50"
                                : fu.status === "lapsed"
                                  ? "bg-red-50/50"
                                  : daysUntil <= 3 && daysUntil >= 0
                                    ? "bg-yellow-50/50"
                                    : ""
                            }`}
                            onClick={() => {
                              setSelectedFollowUp(fu);
                              setShowDetailModal(true);
                            }}
                          >
                            <TableCell>
                              <div>
                                <p className="font-medium">
                                  {fu.donor?.name || "Unknown"}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {fu.donor?.email}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm">
                                {fu.donor?.phone || "N/A"}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="text-sm">
                                  {fu.donation
                                    ? formatAmount(fu.donation.amount)
                                    : "N/A"}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {fu.donor?.donationStats?.lastDonation
                                    ? formatDate(
                                        fu.donor.donationStats.lastDonation
                                      )
                                    : "N/A"}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">
                              {fu.expectedAmount
                                ? formatAmount(fu.expectedAmount)
                                : "N/A"}
                            </TableCell>
                            <TableCell>
                              <div>
                                <p
                                  className={`text-sm font-medium ${
                                    daysUntil < 0
                                      ? "text-red-600"
                                      : daysUntil <= 7
                                        ? "text-yellow-600"
                                        : ""
                                  }`}
                                >
                                  {formatDate(fu.nextDueDate)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {daysUntil > 0
                                    ? `${daysUntil} days left`
                                    : daysUntil === 0
                                      ? "Due today"
                                      : `${Math.abs(daysUntil)} days overdue`}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {frequencyLabels[fu.frequency] || fu.frequency}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={`text-xs gap-1 ${stCfg.color}`}
                              >
                                {stCfg.icon}
                                {stCfg.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {fu.assignedTo ? (
                                <div className="flex items-center gap-1">
                                  <UserPlus className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-xs">
                                    {fu.assignedTo.name}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  Unassigned
                                </span>
                              )}
                            </TableCell>
                            {canUpdate && (
                              <TableCell className="text-right">
                                <div
                                  className="flex items-center justify-end gap-1"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    disabled={
                                      actionLoading ||
                                      [
                                        "completed",
                                        "cancelled",
                                        "lapsed",
                                      ].includes(fu.status)
                                    }
                                    onClick={() => handleSendReminder(fu)}
                                    title="Send WhatsApp Reminder"
                                  >
                                    <MessageSquare className="h-3.5 w-3.5 text-green-600" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    disabled={
                                      actionLoading ||
                                      ["completed", "cancelled"].includes(
                                        fu.status
                                      )
                                    }
                                    onClick={() => handleComplete(fu)}
                                    title="Mark Completed"
                                  >
                                    <CheckCircle className="h-3.5 w-3.5 text-blue-600" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    disabled={
                                      actionLoading ||
                                      ["completed", "cancelled"].includes(
                                        fu.status
                                      )
                                    }
                                    onClick={() => handleCancel(fu)}
                                    title="Cancel"
                                  >
                                    <XCircle className="h-3.5 w-3.5 text-red-400" />
                                  </Button>
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>                  </div>                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* Frequency Breakdown */}
      {stats?.byFrequency && stats.byFrequency.length > 0 && (
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-medium">
              Active Follow-ups by Frequency
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {stats.byFrequency.map((item) => (
                <div
                  key={item.frequency}
                  className="rounded-lg border p-3 text-center"
                >
                  <p className="text-xs text-muted-foreground">
                    {frequencyLabels[item.frequency] || item.frequency}
                  </p>
                  <p className="text-lg font-bold">{item.count}</p>
                  <p className="text-xs text-green-600">
                    {formatAmount(item.totalExpected)}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Follow-up Details</DialogTitle>
          </DialogHeader>
          {selectedFollowUp && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Donor</p>
                  <p className="font-medium">
                    {selectedFollowUp.donor?.name || "Unknown"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Phone</p>
                  <p className="font-medium">
                    {selectedFollowUp.donor?.phone || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Due Date</p>
                  <p className="font-medium">
                    {formatDate(selectedFollowUp.nextDueDate)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Frequency</p>
                  <p className="font-medium">
                    {frequencyLabels[selectedFollowUp.frequency]}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Expected Amount</p>
                  <p className="font-medium">
                    {selectedFollowUp.expectedAmount
                      ? formatAmount(selectedFollowUp.expectedAmount)
                      : "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge
                    variant="outline"
                    className={`${statusConfig[selectedFollowUp.status]?.color || ""}`}
                  >
                    {statusConfig[selectedFollowUp.status]?.label ||
                      selectedFollowUp.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Engagement Score</p>
                  <p className="font-medium">
                    {selectedFollowUp.donor?.engagementScore ?? "N/A"}/100
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Assigned To</p>
                  <p className="font-medium">
                    {selectedFollowUp.assignedTo?.name || "Unassigned"}
                  </p>
                </div>
              </div>

              {/* Reminder History */}
              {selectedFollowUp.reminders &&
                selectedFollowUp.reminders.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">
                      Reminder History
                    </p>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {selectedFollowUp.reminders.map((r, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 text-xs border rounded px-2 py-1.5"
                        >
                          <Badge
                            variant="outline"
                            className={`text-xs ${r.status === "sent" || r.status === "delivered" ? "text-green-700" : "text-red-700"}`}
                          >
                            {r.channel}
                          </Badge>
                          <span className="text-muted-foreground">
                            {r.reminderType?.replace("_", " ")}
                          </span>
                          <span className="ml-auto text-muted-foreground">
                            {formatDate(r.sentAt)}
                          </span>
                          <Badge
                            variant={
                              r.status === "sent" || r.status === "delivered"
                                ? "default"
                                : "destructive"
                            }
                            className="text-xs"
                          >
                            {r.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Staff Notes */}
              {selectedFollowUp.staffNotes &&
                selectedFollowUp.staffNotes.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Staff Notes</p>
                    <div className="space-y-1.5 max-h-32 overflow-y-auto">
                      {selectedFollowUp.staffNotes.map((n, idx) => (
                        <div key={idx} className="text-xs border rounded p-2">
                          <p>{n.note}</p>
                          <p className="text-muted-foreground mt-1">
                            — {n.addedBy?.name || "Unknown"},{" "}
                            {formatDate(n.addedAt)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Quick Actions */}
              {canUpdate && (
                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={
                      actionLoading ||
                      ["completed", "cancelled"].includes(
                        selectedFollowUp.status
                      )
                    }
                    onClick={() => handleSendReminder(selectedFollowUp)}
                  >
                    <Send className="h-3.5 w-3.5 mr-1" />
                    Send Reminder
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setShowNoteModal(true);
                    }}
                  >
                    <MessageSquare className="h-3.5 w-3.5 mr-1" />
                    Add Note
                  </Button>
                  <Button
                    size="sm"
                    disabled={
                      actionLoading ||
                      ["completed", "cancelled"].includes(
                        selectedFollowUp.status
                      )
                    }
                    onClick={() => handleComplete(selectedFollowUp)}
                  >
                    <CheckCircle className="h-3.5 w-3.5 mr-1" />
                    Complete
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Note Modal */}
      <Dialog open={showNoteModal} onOpenChange={setShowNoteModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Note</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="Enter your note..."
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowNoteModal(false);
                setNoteText("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddNote}
              disabled={!noteText.trim() || actionLoading}
            >
              Save Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
