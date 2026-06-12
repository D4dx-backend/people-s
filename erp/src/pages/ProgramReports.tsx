import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Search, Trash2, Eye, RefreshCw, Loader2, AlertCircle, ImageIcon,
  BookOpen, MapPin, User, Calendar, Download, LayoutGrid, Layers,
  ChevronLeft, ChevronRight, Plus, Pencil, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { programReports, schemes } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProgramPhoto {
  _id: string;
  url: string;
  fileName?: string;
  mimetype?: string;
  size?: number;
}

interface ProgramReport {
  _id: string;
  title: string;
  news?: string;
  scheme?: { _id: string; name: string } | null;
  location?: { _id: string; name: string; type?: string; code?: string } | null;
  photos: ProgramPhoto[];
  submittedBy?: { _id: string; name: string; email?: string } | null;
  submitterRole?: string;
  createdAt: string;
  updatedAt: string;
}

interface SchemeOption {
  _id: string;
  name: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  unit_admin: "Unit Admin",
  area_admin: "Area Admin",
  district_admin: "District Admin",
  area_president: "Area President",
};

/** Roles allowed to upload/edit program reports (mirrors backend COORDINATORS). */
const COORDINATOR_ROLES = [
  "district_admin",
  "area_admin",
  "unit_admin",
  "area_president",
];

const MAX_PHOTOS = 5;
const NO_SCHEME_KEY = "__none__";

// ── Helpers ─────────────────────────────────────────────────────────────────

const formatDate = (iso?: string) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
};

const downloadImage = async (photo: ProgramPhoto, fallbackName: string) => {
  try {
    const res = await fetch(photo.url);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = photo.fileName || fallbackName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
  } catch {
    // Fallback: open in a new tab if direct download fails (e.g. CORS).
    window.open(photo.url, "_blank", "noopener,noreferrer");
  }
};

// ── Component ─────────────────────────────────────────────────────────────────

const ProgramReports = () => {
  const { user } = useAuth();
  const canCreate = !!user?.role && COORDINATOR_ROLES.includes(user.role);

  const [reports, setReports] = useState<ProgramReport[]>([]);
  const [schemeOptions, setSchemeOptions] = useState<SchemeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [schemeFilter, setSchemeFilter] = useState<string>("all");
  const [groupByScheme, setGroupByScheme] = useState(false);

  const [selected, setSelected] = useState<ProgramReport | null>(null);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<ProgramReport | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Create / edit dialog
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ProgramReport | null>(null);

  const canEditReport = useCallback(
    (r: ProgramReport) =>
      canCreate && !!user && r.submittedBy?._id === user.id,
    [canCreate, user]
  );

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = { limit: "200" };
      if (schemeFilter !== "all" && schemeFilter !== NO_SCHEME_KEY) {
        params.scheme = schemeFilter;
      }
      if (search.trim()) params.search = search.trim();

      const res: any = await programReports.getAll(params);
      const list: ProgramReport[] = res?.data?.reports || [];
      setReports(list);
    } catch (err: any) {
      setError(err?.message || "Failed to load program reports");
    } finally {
      setLoading(false);
    }
  }, [schemeFilter, search]);

  const loadSchemes = useCallback(async () => {
    try {
      const res: any = await schemes.getActive();
      const list: any[] = res?.data?.schemes || res?.data || [];
      setSchemeOptions(list.map((s: any) => ({ _id: s._id, name: s.name })));
    } catch {
      // Non-fatal: filter by scheme just won't be available.
    }
  }, []);

  useEffect(() => {
    loadSchemes();
  }, [loadSchemes]);

  useEffect(() => {
    const t = setTimeout(loadReports, 300);
    return () => clearTimeout(t);
  }, [loadReports]);

  // Client-side "no scheme" filter (the API filters by a specific scheme id).
  const visibleReports = useMemo(() => {
    if (schemeFilter === NO_SCHEME_KEY) {
      return reports.filter((r) => !r.scheme);
    }
    return reports;
  }, [reports, schemeFilter]);

  const grouped = useMemo(() => {
    if (!groupByScheme) return null;
    const map = new Map<string, { name: string; reports: ProgramReport[] }>();
    for (const r of visibleReports) {
      const key = r.scheme?._id || NO_SCHEME_KEY;
      const name = r.scheme?.name || "No Scheme";
      if (!map.has(key)) map.set(key, { name, reports: [] });
      map.get(key)!.reports.push(r);
    }
    return Array.from(map.entries()).sort((a, b) =>
      a[1].name.localeCompare(b[1].name)
    );
  }, [groupByScheme, visibleReports]);

  const openDetail = (report: ProgramReport) => {
    setSelected(report);
    setPhotoIndex(0);
  };

  const openCreate = () => {
    setEditTarget(null);
    setFormOpen(true);
  };

  const openEdit = (report: ProgramReport) => {
    setSelected(null);
    setEditTarget(report);
    setFormOpen(true);
  };

  const handleSaved = () => {
    setFormOpen(false);
    setEditTarget(null);
    loadReports();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await programReports.delete(deleteTarget._id);
      toast({ title: "Deleted", description: "Program report removed." });
      setReports((prev) => prev.filter((r) => r._id !== deleteTarget._id));
      if (selected?._id === deleteTarget._id) setSelected(null);
      setDeleteTarget(null);
    } catch (err: any) {
      toast({
        title: "Delete failed",
        description: err?.message || "Could not delete report",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Program Reports</h1>
          <p className="text-sm text-muted-foreground">
            Programs and events uploaded by area coordinators.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadReports} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          {canCreate && (
            <Button size="sm" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              New Report
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search title or news…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={schemeFilter} onValueChange={setSchemeFilter}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder="All schemes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All schemes</SelectItem>
            <SelectItem value={NO_SCHEME_KEY}>No scheme</SelectItem>
            {schemeOptions.map((s) => (
              <SelectItem key={s._id} value={s._id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant={groupByScheme ? "default" : "outline"}
          size="sm"
          onClick={() => setGroupByScheme((v) => !v)}
        >
          {groupByScheme ? (
            <Layers className="mr-2 h-4 w-4" />
          ) : (
            <LayoutGrid className="mr-2 h-4 w-4" />
          )}
          {groupByScheme ? "Grouped by scheme" : "Group by scheme"}
        </Button>
      </div>

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Body */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading reports…
        </div>
      ) : visibleReports.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-20 text-muted-foreground">
          <ImageIcon className="h-10 w-10 opacity-40" />
          <p>No program reports found.</p>
        </div>
      ) : grouped ? (
        <div className="space-y-8">
          {grouped.map(([key, group]) => (
            <div key={key} className="space-y-3">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
                <h2 className="text-lg font-semibold">{group.name}</h2>
                <Badge variant="secondary">{group.reports.length}</Badge>
              </div>
              <ReportGrid
                reports={group.reports}
                onView={openDetail}
                onDelete={setDeleteTarget}
                onEdit={openEdit}
                canEdit={canEditReport}
              />
            </div>
          ))}
        </div>
      ) : (
        <ReportGrid
          reports={visibleReports}
          onView={openDetail}
          onDelete={setDeleteTarget}
          onEdit={openEdit}
          canEdit={canEditReport}
        />
      )}

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="pr-6">{selected.title}</DialogTitle>
              </DialogHeader>

              {canEditReport(selected) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-fit"
                  onClick={() => openEdit(selected)}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </Button>
              )}

              <div className="space-y-4">
                {/* Meta */}
                <div className="flex flex-wrap gap-2">
                  {selected.scheme && (
                    <Badge variant="secondary" className="gap-1">
                      <BookOpen className="h-3 w-3" />
                      {selected.scheme.name}
                    </Badge>
                  )}
                  {selected.location && (
                    <Badge variant="outline" className="gap-1">
                      <MapPin className="h-3 w-3" />
                      {selected.location.name}
                    </Badge>
                  )}
                  {selected.submitterRole && (
                    <Badge variant="outline" className="gap-1">
                      <User className="h-3 w-3" />
                      {ROLE_LABELS[selected.submitterRole] || selected.submitterRole}
                    </Badge>
                  )}
                  <Badge variant="outline" className="gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(selected.createdAt)}
                  </Badge>
                </div>

                {selected.submittedBy?.name && (
                  <p className="text-sm text-muted-foreground">
                    Submitted by{" "}
                    <span className="font-medium">{selected.submittedBy.name}</span>
                  </p>
                )}

                {/* News */}
                {selected.news && (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">
                    {selected.news}
                  </p>
                )}

                {/* Photo viewer */}
                {selected.photos.length > 0 && (
                  <div className="space-y-3">
                    <div className="relative overflow-hidden rounded-lg border bg-muted">
                      <img
                        src={selected.photos[photoIndex]?.url}
                        alt={`${selected.title} ${photoIndex + 1}`}
                        className="max-h-[50vh] w-full object-contain"
                      />
                      {selected.photos.length > 1 && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              setPhotoIndex(
                                (i) =>
                                  (i - 1 + selected.photos.length) %
                                  selected.photos.length
                              )
                            }
                            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-1 shadow hover:bg-background"
                          >
                            <ChevronLeft className="h-5 w-5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setPhotoIndex((i) => (i + 1) % selected.photos.length)
                            }
                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-1 shadow hover:bg-background"
                          >
                            <ChevronRight className="h-5 w-5" />
                          </button>
                        </>
                      )}
                      <div className="absolute bottom-2 right-2 flex gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            downloadImage(
                              selected.photos[photoIndex],
                              `${selected.title}-${photoIndex + 1}.jpg`
                            )
                          }
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Download
                        </Button>
                      </div>
                    </div>

                    {/* Thumbnails */}
                    {selected.photos.length > 1 && (
                      <div className="flex flex-wrap gap-2">
                        {selected.photos.map((p, idx) => (
                          <button
                            key={p._id || idx}
                            type="button"
                            onClick={() => setPhotoIndex(idx)}
                            className={`h-16 w-16 overflow-hidden rounded border-2 ${
                              idx === photoIndex
                                ? "border-primary"
                                : "border-transparent"
                            }`}
                          >
                            <img
                              src={p.url}
                              alt={`thumb ${idx + 1}`}
                              className="h-full w-full object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    )}

                    {selected.photos.length > 1 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          for (let i = 0; i < selected.photos.length; i++) {
                            await downloadImage(
                              selected.photos[i],
                              `${selected.title}-${i + 1}.jpg`
                            );
                          }
                        }}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Download all ({selected.photos.length})
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this program report?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.title}" and its photos will be permanently removed.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting…
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create / edit dialog */}
      {canCreate && (
        <ReportFormDialog
          open={formOpen}
          report={editTarget}
          schemeOptions={schemeOptions}
          onClose={() => {
            setFormOpen(false);
            setEditTarget(null);
          }}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
};

// ── Grid + Card ───────────────────────────────────────────────────────────────

interface GridProps {
  reports: ProgramReport[];
  onView: (r: ProgramReport) => void;
  onDelete: (r: ProgramReport) => void;
  onEdit: (r: ProgramReport) => void;
  canEdit: (r: ProgramReport) => boolean;
}

const ReportGrid = ({ reports, onView, onDelete, onEdit, canEdit }: GridProps) => (
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {reports.map((report) => (
      <ReportCard
        key={report._id}
        report={report}
        onView={onView}
        onDelete={onDelete}
        onEdit={onEdit}
        canEdit={canEdit(report)}
      />
    ))}
  </div>
);

interface CardProps {
  report: ProgramReport;
  onView: (r: ProgramReport) => void;
  onDelete: (r: ProgramReport) => void;
  onEdit: (r: ProgramReport) => void;
  canEdit: boolean;
}

const ReportCard = ({ report, onView, onDelete, onEdit, canEdit }: CardProps) => {
  const cover = report.photos?.[0];
  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-md">
      <button
        type="button"
        onClick={() => onView(report)}
        className="relative block h-40 w-full bg-muted"
      >
        {cover ? (
          <img
            src={cover.url}
            alt={report.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <ImageIcon className="h-8 w-8 opacity-40" />
          </div>
        )}
        {report.photos.length > 1 && (
          <Badge className="absolute right-2 top-2 gap-1 bg-black/60 text-white">
            <ImageIcon className="h-3 w-3" />
            {report.photos.length}
          </Badge>
        )}
      </button>
      <CardContent className="space-y-2 p-4">
        <h3 className="line-clamp-1 font-semibold">{report.title}</h3>
        {report.news && (
          <p className="line-clamp-2 text-sm text-muted-foreground">{report.news}</p>
        )}
        <div className="flex flex-wrap gap-1.5">
          {report.scheme && (
            <Badge variant="secondary" className="gap-1 text-xs">
              <BookOpen className="h-3 w-3" />
              {report.scheme.name}
            </Badge>
          )}
          {report.location && (
            <Badge variant="outline" className="gap-1 text-xs">
              <MapPin className="h-3 w-3" />
              {report.location.name}
            </Badge>
          )}
        </div>
        <div className="flex items-center justify-between pt-1">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {formatDate(report.createdAt)}
          </span>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={() => onView(report)}>
              <Eye className="h-4 w-4" />
            </Button>
            {canEdit && (
              <Button size="sm" variant="ghost" onClick={() => onEdit(report)}>
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => onDelete(report)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// ── Create / Edit dialog ──────────────────────────────────────────────────────

interface FormDialogProps {
  open: boolean;
  report: ProgramReport | null;
  schemeOptions: SchemeOption[];
  onClose: () => void;
  onSaved: () => void;
}

const ReportFormDialog = ({
  open,
  report,
  schemeOptions,
  onClose,
  onSaved,
}: FormDialogProps) => {
  const isEdit = !!report;

  const [title, setTitle] = useState("");
  const [news, setNews] = useState("");
  const [schemeId, setSchemeId] = useState<string>(NO_SCHEME_KEY);
  const [existingPhotos, setExistingPhotos] = useState<ProgramPhoto[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset form whenever the dialog opens.
  useEffect(() => {
    if (!open) return;
    setTitle(report?.title || "");
    setNews(report?.news || "");
    setSchemeId(report?.scheme?._id || NO_SCHEME_KEY);
    setExistingPhotos(report?.photos ? [...report.photos] : []);
    setNewFiles([]);
    setSaving(false);
  }, [open, report]);

  const totalPhotos = existingPhotos.length + newFiles.length;

  const previews = useMemo(
    () => newFiles.map((f) => ({ file: f, url: URL.createObjectURL(f) })),
    [newFiles]
  );
  useEffect(
    () => () => previews.forEach((p) => URL.revokeObjectURL(p.url)),
    [previews]
  );

  const handlePickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter((f) =>
      f.type.startsWith("image/")
    );
    if (files.length === 0) return;

    const remaining = MAX_PHOTOS - totalPhotos;
    if (remaining <= 0) {
      toast({
        title: "Photo limit reached",
        description: `You can attach at most ${MAX_PHOTOS} photos.`,
        variant: "destructive",
      });
      return;
    }
    if (files.length > remaining) {
      toast({
        title: "Some photos skipped",
        description: `Only ${MAX_PHOTOS} photos allowed in total.`,
      });
    }
    setNewFiles((prev) => [...prev, ...files.slice(0, remaining)]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeNewFile = (idx: number) =>
    setNewFiles((prev) => prev.filter((_, i) => i !== idx));

  const removeExistingPhoto = async (photo: ProgramPhoto) => {
    if (!report) return;
    try {
      await programReports.deletePhoto(report._id, photo._id);
      setExistingPhotos((prev) => prev.filter((p) => p._id !== photo._id));
    } catch (err: any) {
      toast({
        title: "Failed to remove photo",
        description: err?.message || "Please try again",
        variant: "destructive",
      });
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast({
        title: "Title required",
        description: "Please enter a title for the report.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const scheme = schemeId === NO_SCHEME_KEY ? undefined : schemeId;
      if (isEdit && report) {
        await programReports.update(report._id, {
          title: title.trim(),
          news: news.trim(),
          scheme: scheme ?? null,
        });
        if (newFiles.length > 0) {
          await programReports.addPhotos(report._id, newFiles);
        }
        toast({ title: "Updated", description: "Program report updated." });
      } else {
        await programReports.create({
          title: title.trim(),
          news: news.trim() || undefined,
          scheme,
          photos: newFiles,
        });
        toast({ title: "Uploaded", description: "Program report uploaded." });
      }
      onSaved();
    } catch (err: any) {
      toast({
        title: isEdit ? "Update failed" : "Upload failed",
        description: err?.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Program Report" : "New Program Report"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pr-title">Title *</Label>
            <Input
              id="pr-title"
              placeholder="Program / event title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pr-news">News / Description</Label>
            <Textarea
              id="pr-news"
              placeholder="What happened at this program?"
              value={news}
              onChange={(e) => setNews(e.target.value)}
              rows={5}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Scheme (optional)</Label>
            <Select value={schemeId} onValueChange={setSchemeId}>
              <SelectTrigger>
                <SelectValue placeholder="No scheme" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_SCHEME_KEY}>No scheme</SelectItem>
                {schemeOptions.map((s) => (
                  <SelectItem key={s._id} value={s._id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>
                Photos ({totalPhotos}/{MAX_PHOTOS})
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={totalPhotos >= MAX_PHOTOS || saving}
                onClick={() => fileInputRef.current?.click()}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add photos
              </Button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handlePickFiles}
            />

            {(existingPhotos.length > 0 || previews.length > 0) && (
              <div className="flex flex-wrap gap-2 pt-1">
                {existingPhotos.map((p) => (
                  <div key={p._id} className="relative h-20 w-20">
                    <img
                      src={p.url}
                      alt={p.fileName || "photo"}
                      className="h-full w-full rounded border object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeExistingPhoto(p)}
                      className="absolute -right-1.5 -top-1.5 rounded-full bg-destructive p-0.5 text-destructive-foreground shadow"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {previews.map((p, idx) => (
                  <div key={p.url} className="relative h-20 w-20">
                    <img
                      src={p.url}
                      alt={p.file.name}
                      className="h-full w-full rounded border object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeNewFile(idx)}
                      className="absolute -right-1.5 -top-1.5 rounded-full bg-destructive p-0.5 text-destructive-foreground shadow"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isEdit ? "Saving…" : "Uploading…"}
                </>
              ) : isEdit ? (
                "Save changes"
              ) : (
                "Upload report"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProgramReports;
