import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Search, Trash2, Eye, RefreshCw, Loader2, AlertCircle, ImageIcon,
  BookOpen, MapPin, User, Calendar, Download, LayoutGrid, Layers,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
        <Button variant="outline" size="sm" onClick={loadReports} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
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
              />
            </div>
          ))}
        </div>
      ) : (
        <ReportGrid
          reports={visibleReports}
          onView={openDetail}
          onDelete={setDeleteTarget}
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
    </div>
  );
};

// ── Grid + Card ───────────────────────────────────────────────────────────────

interface GridProps {
  reports: ProgramReport[];
  onView: (r: ProgramReport) => void;
  onDelete: (r: ProgramReport) => void;
}

const ReportGrid = ({ reports, onView, onDelete }: GridProps) => (
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {reports.map((report) => (
      <ReportCard
        key={report._id}
        report={report}
        onView={onView}
        onDelete={onDelete}
      />
    ))}
  </div>
);

interface CardProps {
  report: ProgramReport;
  onView: (r: ProgramReport) => void;
  onDelete: (r: ProgramReport) => void;
}

const ReportCard = ({ report, onView, onDelete }: CardProps) => {
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

export default ProgramReports;
