import { useState, useEffect, useCallback } from "react";
import {
  Plus, Search, Filter, Settings, Trash2,
  Edit, Eye, FileText, Users, CheckCircle2, Clock, XCircle, Loader2,
  AlertCircle, RefreshCw, Send, CheckCircle, BookOpen, MapPin, User
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { adminReports } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AdminReport {
  _id: string;
  title: string;
  description?: string;
  targetUserType: string;
  targetLocations: Array<{ _id: string; name: string; type: string }>;
  hasFormConfiguration: boolean;
  isFormPublished: boolean;
  status: "draft" | "active" | "closed";
  createdAt: string;
  updatedAt: string;
  createdBy?: { name: string; email: string };
}

// ── Constants ─────────────────────────────────────────────────────────────────

const USER_TYPE_LABELS: Record<string, string> = {
  unit_admin: "Unit Admin",
  area_admin: "Area Admin",
  district_admin: "District Admin",
  state_admin: "State Admin",
};

const STATUS_CONFIG: Record<string, { color: string; icon: React.ReactNode }> = {
  draft: {
    color: "bg-gray-100 text-gray-700 border-gray-200",
    icon: <Clock className="h-3 w-3" />,
  },
  active: {
    color: "bg-green-100 text-green-700 border-green-200",
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  closed: {
    color: "bg-red-100 text-red-700 border-red-200",
    icon: <XCircle className="h-3 w-3" />,
  },
};

// ── Create / Edit Modal ───────────────────────────────────────────────────────

interface ReportFormModalProps {
  open: boolean;
  mode: "create" | "edit";
  report: AdminReport | null;
  onClose: () => void;
  onSaved: () => void;
}

function ReportFormModal({ open, mode, report, onClose, onSaved }: ReportFormModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetUserType, setTargetUserType] = useState("unit_admin");
  const [status, setStatus] = useState("draft");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (mode === "edit" && report) {
        setTitle(report.title);
        setDescription(report.description || "");
        setTargetUserType(report.targetUserType);
        setStatus(report.status);
      } else {
        setTitle("");
        setDescription("");
        setTargetUserType("unit_admin");
        setStatus("draft");
      }
    }
  }, [open, mode, report]);

  const handleSave = async () => {
    if (!title.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (mode === "create") {
        await adminReports.create({ title, description, targetUserType, status });
        toast({ title: "Report created successfully" });
      } else if (report) {
        await adminReports.update(report._id, { title, description, targetUserType, status });
        toast({ title: "Report updated successfully" });
      }
      onSaved();
      onClose();
    } catch {
      toast({ title: "Failed to save report", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Create Report" : "Edit Report"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="title">Title <span className="text-red-500">*</span></Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter report title"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the purpose of this report"
              rows={3}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="targetUserType">Target User Type <span className="text-red-500">*</span></Label>
            <Select value={targetUserType} onValueChange={setTargetUserType}>
              <SelectTrigger id="targetUserType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(USER_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "create" ? "Create" : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminReports() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isSuper = user?.isSuperAdmin || user?.role === "super_admin";

  const [reports, setReports] = useState<AdminReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState("");
  const [filterUserType, setFilterUserType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modals
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [selectedReport, setSelectedReport] = useState<AdminReport | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [reportToDelete, setReportToDelete] = useState<AdminReport | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [submissionsDialogOpen, setSubmissionsDialogOpen] = useState(false);
  const [submissionsReport, setSubmissionsReport] = useState<AdminReport | null>(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = { page, limit: 15 };
      if (search) params.search = search;
      if (isSuper) {
        if (filterUserType !== "all") params.targetUserType = filterUserType;
        if (filterStatus !== "all") params.status = filterStatus;
      }
      const res = await adminReports.getAll(params);
      setReports(res.data?.reports || []);
      setTotalPages(res.data?.pagination?.totalPages || 1);
    } catch {
      setError("Failed to load reports");
    } finally {
      setLoading(false);
    }
  }, [search, filterUserType, filterStatus, page, isSuper]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleDelete = async () => {
    if (!reportToDelete) return;
    setDeleting(true);
    try {
      await adminReports.delete(reportToDelete._id);
      toast({ title: "Report deleted" });
      setDeleteDialogOpen(false);
      setReportToDelete(null);
      fetchReports();
    } catch (err: any) {
      toast({
        title: "Cannot delete report",
        description: err?.message || "Failed to delete",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold">Reports</h1>
          <p className="text-muted-foreground mt-1">
            {isSuper ? "Create and manage report forms for admins" : "Fill and submit reports assigned to you"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchReports}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          <Button
            variant={showFilters ? "default" : "outline"}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="mr-2 h-4 w-4" />
            {showFilters ? "Hide Filters" : "Show Filters"}
          </Button>
          {isSuper && (
            <Button onClick={() => { setModalMode("create"); setSelectedReport(null); setModalOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Create Report
            </Button>
          )}
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Search</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search reports..."
                    className="pl-8 h-8"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  />
                </div>
              </div>
              {isSuper && (
                <>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">User Type</Label>
                    <Select value={filterUserType} onValueChange={(v) => { setFilterUserType(v); setPage(1); }}>
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="All types" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All User Types</SelectItem>
                        {Object.entries(USER_TYPE_LABELS).map(([v, l]) => (
                          <SelectItem key={v} value={v}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(1); }}>
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-6 pt-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Loading reports...</span>
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : reports.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <FileText className="mx-auto h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm">
                {isSuper ? "No reports found. Create your first report." : "No reports are assigned to you."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>User Type</TableHead>
                    <TableHead>Form</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((report) => {
                    const statusCfg = STATUS_CONFIG[report.status] || STATUS_CONFIG.draft;
                    return (
                      <TableRow key={report._id}>
                        <TableCell>
                          <div className="text-sm font-mono">{new Date(report.createdAt).toLocaleDateString()}</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(report.updatedAt).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" })}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{report.title}</div>
                          {report.description && (
                            <div className="text-xs text-muted-foreground line-clamp-1 max-w-xs">
                              {report.description}
                            </div>
                          )}
                          {report.createdBy && (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              by {report.createdBy.name}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-xs ${statusCfg.color}`}>
                            <span className="mr-1 inline-flex">{statusCfg.icon}</span>
                            <span className="capitalize">{report.status}</span>
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            <Users className="h-3 w-3 mr-1" />
                            {USER_TYPE_LABELS[report.targetUserType] || report.targetUserType}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {report.isFormPublished ? (
                            <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                              Published
                            </Badge>
                          ) : report.hasFormConfiguration ? (
                            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                              Configured
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {isSuper ? (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => { setSubmissionsReport(report); setSubmissionsDialogOpen(true); }}
                                  title="View Submissions"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => navigate(`/admin-reports/form-builder?reportId=${report._id}&reportTitle=${encodeURIComponent(report.title)}`)}
                                  title="Configure Form"
                                >
                                  <Settings className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => { setSelectedReport(report); setModalMode("edit"); setModalOpen(true); }}
                                  title="Edit"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-red-600 hover:text-red-700 hover:border-red-300"
                                  onClick={() => { setReportToDelete(report); setDeleteDialogOpen(true); }}
                                  title="Delete"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            ) : (
                              report.status === "active" && report.isFormPublished && (
                                <Button
                                  size="sm"
                                  onClick={() => navigate(`/admin-reports/fill?reportId=${report._id}&reportTitle=${encodeURIComponent(report.title)}`)}
                                >
                                  <Send className="h-3.5 w-3.5 mr-1" /> Fill Report
                                </Button>
                              )
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 pt-4 mt-2 border-t">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              <span className="flex items-center text-sm text-muted-foreground px-2">
                Page {page} of {totalPages}
              </span>
              <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(page + 1)}>
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Submissions Dialog */}
      <SubmissionsDialog
        open={submissionsDialogOpen}
        report={submissionsReport}
        onClose={() => { setSubmissionsDialogOpen(false); setSubmissionsReport(null); }}
      />

      {/* Create / Edit Modal */}
      <ReportFormModal
        open={modalOpen}
        mode={modalMode}
        report={selectedReport}
        onClose={() => setModalOpen(false)}
        onSaved={fetchReports}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Report</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{reportToDelete?.title}</strong>?
              This will also remove its form configuration and any draft submissions.
              Submitted responses will block deletion.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700">
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Submissions Dialog ────────────────────────────────────────────────────────

interface SubmissionsDialogProps {
  open: boolean;
  report: AdminReport | null;
  onClose: () => void;
}

function SubmissionsDialog({ open, report, onClose }: SubmissionsDialogProps) {
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedSub, setSelectedSub] = useState<any | null>(null);
  const [fieldMap, setFieldMap] = useState<Record<string, { label: string; type: string }>>({});

  useEffect(() => {
    if (!open || !report) return;
    setPage(1);
    setSubmissions([]);
    setSelectedSub(null);
    adminReports.getFormConfig(report._id).then((res) => {
      const pages: any[] = res.data?.formConfiguration?.pages || [];
      const map: Record<string, { label: string; type: string }> = {};
      pages.forEach((pg: any) => {
        (pg.fields || []).forEach((f: any) => {
          map[`field_${f.id}`] = { label: f.label, type: f.type };
        });
      });
      setFieldMap(map);
    }).catch(() => {});
  }, [open, report]);

  useEffect(() => {
    if (!open || !report) return;
    const fetch = async () => {
      setLoading(true);
      try {
        const params: any = { page, limit: 15 };
        if (filterStatus !== "all") params.status = filterStatus;
        const res = await adminReports.getSubmissions(report._id, params);
        setSubmissions(res.data?.submissions || []);
        setTotalPages(res.data?.pagination?.totalPages || 1);
      } catch {
        toast({ title: "Failed to load submissions", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [open, report, page, filterStatus]);

  return (
    <>
      {/* List dialog */}
      <Dialog open={open && !selectedSub} onOpenChange={onClose}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Submissions — {report?.title}
            </DialogTitle>
          </DialogHeader>

          {/* Filter bar */}
          <div className="flex gap-2 mb-2">
            <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(1); }}>
              <SelectTrigger className="h-8 w-40">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="draft">Drafts</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table of submissions */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : submissions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                <FileText className="mx-auto h-8 w-8 mb-2 opacity-40" />
                No submissions yet.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Submitted By</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {submissions.map((sub) => (
                    <TableRow key={sub._id}>
                      <TableCell>
                        <div className="font-medium">{sub.submittedBy?.name || "Unknown"}</div>
                        <div className="text-xs text-muted-foreground capitalize">
                          {sub.submitterRole?.replace(/_/g, " ")}
                        </div>
                      </TableCell>
                      <TableCell>
                        {sub.location ? (
                          <div className="text-sm">
                            <div>{sub.location.name}</div>
                            <div className="text-xs text-muted-foreground capitalize">{sub.location.type}</div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {sub.status === "submitted" ? (
                          <Badge variant="outline" className="text-xs bg-green-100 text-green-700 border-green-200">
                            <CheckCircle className="h-3 w-3 mr-1" /> Submitted
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs bg-yellow-100 text-yellow-700 border-yellow-200">
                            <Clock className="h-3 w-3 mr-1" /> Draft
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {new Date(sub.submittedAt || sub.updatedAt).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedSub(sub)}
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 pt-3 border-t mt-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
              <span className="flex items-center text-xs text-muted-foreground px-2">Page {page} of {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Submission detail dialog */}
      {selectedSub && (
        <SubmissionDetailDialog
          open={!!selectedSub}
          submission={selectedSub}
          reportTitle={report?.title || ""}
          fieldMap={fieldMap}
          onBack={() => setSelectedSub(null)}
          onClose={() => { setSelectedSub(null); onClose(); }}
        />
      )}
    </>
  );
}

// ── Submission Detail Dialog ──────────────────────────────────────────────────

interface SubmissionDetailDialogProps {
  open: boolean;
  submission: any;
  reportTitle: string;
  fieldMap: Record<string, { label: string; type: string }>;
  onBack: () => void;
  onClose: () => void;
}

function SubmissionDetailDialog({ open, submission, reportTitle, fieldMap, onBack, onClose }: SubmissionDetailDialogProps) {
  const sub = submission;
  const formEntries = sub.formData ? Object.entries(sub.formData) : [];

  const getDisplayValue = (value: any): string => {
    if (Array.isArray(value)) return value.join(", ");
    if (value === true) return "Yes";
    if (value === false) return "No";
    if (value == null || value === "") return "—";
    return String(value);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Submission Details
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Submitter Information */}
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center gap-2 font-semibold text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              Submitter Information
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Report</p>
                <p className="font-medium">{reportTitle}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Status</p>
                <div className="mt-0.5">
                  {sub.status === "submitted" ? (
                    <Badge variant="outline" className="text-xs bg-green-100 text-green-700 border-green-200">
                      <CheckCircle className="h-3 w-3 mr-1" /> Submitted
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs bg-yellow-100 text-yellow-700 border-yellow-200">
                      <Clock className="h-3 w-3 mr-1" /> Draft
                    </Badge>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Name</p>
                <p>{sub.submittedBy?.name || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Role</p>
                <p className="capitalize">{sub.submitterRole?.replace(/_/g, " ") || "—"}</p>
              </div>
              {sub.submittedBy?.email && (
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground font-medium">Email</p>
                  <p>{sub.submittedBy.email}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground font-medium">Submitted Date</p>
                <p>{sub.submittedAt
                  ? new Date(sub.submittedAt).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })
                  : new Date(sub.updatedAt).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })
                }</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Last Updated</p>
                <p>{new Date(sub.updatedAt).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })}</p>
              </div>
            </div>
          </div>

          {/* Location */}
          {sub.location && (
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center gap-2 font-semibold text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                Location
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Name</p>
                  <p>{sub.location.name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Type</p>
                  <p className="capitalize">{sub.location.type}</p>
                </div>
              </div>
            </div>
          )}

          {/* Form Data */}
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center gap-2 font-semibold text-sm">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Form Data
            </div>
            <Separator />
            {formEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No form data recorded.</p>
            ) : (
              <div className="divide-y divide-border/60">
                {formEntries.map(([key, value]) => {
                  const info = fieldMap[key];
                  const label = info?.label || key;
                  const displayValue = getDisplayValue(value);
                  return (
                    <div key={key} className="flex gap-4 py-2.5 text-sm">
                      <span className="text-muted-foreground font-medium min-w-[160px] max-w-[200px] shrink-0">
                        {label}
                      </span>
                      <span className="text-foreground break-words flex-1">{displayValue}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onBack}>← Back to List</Button>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
