import { useState, useEffect } from "react";
import {
  Eye, Save, Download, Settings2, ArrowLeft, Loader2, MoreVertical,
  FileText, Target
} from "lucide-react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FieldTypeSelector } from "@/components/formbuilder/FieldTypeSelector";
import { FormCanvas } from "@/components/formbuilder/FormCanvas";
import { FormPreview } from "@/components/formbuilder/FormPreview";
import { useToast } from "@/hooks/use-toast";
import { programReports } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { type FormScoringConfig } from "@/types/formBuilder";

// ── Types (mirrors AdminReportFormBuilder.tsx) ────────────────────────────────

interface Field {
  id: number;
  label: string;
  type: string;
  required: boolean;
  enabled: boolean;
  placeholder?: string;
  options?: string[];
  validation?: string;
  columns?: number;
  conditionalLogic?: {
    field: number;
    operator: string;
    value: string;
  };
  scoring?: {
    enabled: boolean;
    maxPoints: number;
    scoringRules: { condition: string; value: string; value2?: string; points: number }[];
  };
}

interface Page {
  id: number;
  title: string;
  fields: Field[];
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ProgramReportFormBuilder() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const isSuper = user?.isSuperAdmin || user?.role === "super_admin";

  const reportId = searchParams.get("reportId");
  const reportTitle = searchParams.get("reportTitle");

  const [formTitle, setFormTitle] = useState("Program Report Form");
  const [formDescription, setFormDescription] = useState("");
  const [formEnabled, setFormEnabled] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(false);
  const [allowDrafts, setAllowDrafts] = useState(true);
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isPublished, setIsPublished] = useState(false);
  const [formVersion, setFormVersion] = useState(1);
  const [scoringConfig, setScoringConfig] = useState<FormScoringConfig>({
    enabled: false,
    minimumThreshold: 0,
    autoRejectBelowThreshold: false,
    showScoreToAdmin: true,
  });

  // Dialog states
  const [showPreview, setShowPreview] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showScoringOverview, setShowScoringOverview] = useState(false);

  // ── Load configuration ──────────────────────────────────────────────────────

  useEffect(() => {
    const load = async () => {
      if (!reportId) {
        setInitialLoad(false);
        return;
      }
      setLoading(true);
      try {
        const res = await programReports.getFormConfig(reportId);
        if (res.data?.hasConfiguration) {
          const config = res.data.formConfiguration;
          setFormTitle(config.title);
          setFormDescription(config.description || "");
          setFormEnabled(config.enabled);
          setEmailNotifications(config.emailNotifications || false);
          setAllowDrafts(config.allowDrafts !== false);
          setPages(config.pages || []);
          setIsPublished(config.isPublished || false);
          setFormVersion(config.version || 1);
          if (config.scoringConfig) setScoringConfig(config.scoringConfig);
          if (config.lastModified) setLastSaved(new Date(config.lastModified));
          toast({ title: "Form configuration loaded" });
        } else {
          // New form — pre-fill title from report (default fields are seeded by backend)
          if (reportTitle) {
            setFormTitle(`${decodeURIComponent(reportTitle)} Form`);
          }
          setPages([]);
          toast({ title: "New form", description: "Start adding pages and fields." });
        }
      } catch {
        toast({ title: "Failed to load form configuration", variant: "destructive" });
        setPages([]);
      } finally {
        setLoading(false);
        setInitialLoad(false);
      }
    };
    if (initialLoad) load();
  }, [reportId, reportTitle, initialLoad, toast]);

  // ── Field / page helpers ────────────────────────────────────────────────────

  const addFirstPage = () => {
    setPages([{ id: 1, title: "Page 1", fields: [] }]);
    setHasUnsavedChanges(true);
  };

  const addFieldToCurrentPage = (type: string) => {
    if (pages.length === 0) { addFirstPage(); return; }
    const newField: Field = {
      id: Math.max(...pages.flatMap(p => p.fields.map(f => f.id)), 0) + 1,
      label: `New ${type} Field`,
      type,
      required: false,
      enabled: true,
    };
    setPages(prev =>
      prev.map((page, i) =>
        i === 0 ? { ...page, fields: [...page.fields, newField] } : page
      )
    );
    setHasUnsavedChanges(true);
  };

  const addField = (pageId: number, field: Field) => {
    setPages(prev =>
      prev.map(page =>
        page.id === pageId ? { ...page, fields: [...page.fields, field] } : page
      )
    );
    setHasUnsavedChanges(true);
  };

  const getTotalFields = () => pages.reduce((s, p) => s + p.fields.length, 0);
  const getRequiredFields = () => pages.reduce((s, p) => s + p.fields.filter(f => f.required).length, 0);

  // ── Save ────────────────────────────────────────────────────────────────────

  const saveFormConfiguration = async () => {
    if (!reportId) {
      toast({ title: "No report context. Navigate from the Program Reports page.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await programReports.updateFormConfig(reportId, {
        title: formTitle,
        description: formDescription,
        enabled: formEnabled,
        emailNotifications,
        allowDrafts,
        pages,
        scoringConfig,
      });
      setLastSaved(new Date());
      setHasUnsavedChanges(false);
      toast({ title: "Form saved successfully!" });
    } catch {
      toast({ title: "Failed to save form configuration", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const publishForm = async () => {
    if (!reportId) return;
    setSaving(true);
    try {
      await programReports.publishFormConfig(reportId, { isPublished: !isPublished });
      setIsPublished(!isPublished);
      toast({ title: `Form ${isPublished ? "unpublished" : "published"} successfully!` });
    } catch {
      toast({ title: "Failed to update publish status", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const exportFormJSON = () => {
    const blob = new Blob(
      [JSON.stringify({ title: formTitle, description: formDescription, pages }, null, 2)],
      { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "program-report-form-config.json";
    a.click();
    toast({ title: "Form configuration exported!" });
  };

  // ── Access guard ────────────────────────────────────────────────────────────

  if (!isSuper) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
          <p className="text-muted-foreground">Only super admins can configure program report forms.</p>
        </div>
      </div>
    );
  }

  if (loading && initialLoad) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading form configuration...</p>
        </div>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/program-reports")} className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back to Program Reports</span>
          </Button>
          <div>
            <h1 className="text-lg font-bold">Program Report Form Builder</h1>
            {reportTitle && (
              <p className="text-muted-foreground text-sm mt-0.5">{decodeURIComponent(reportTitle)}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isPublished && (
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">Published</Badge>
          )}
          {lastSaved && (
            <span className="text-xs text-muted-foreground hidden lg:block">
              Saved {lastSaved.toLocaleTimeString()}
              {hasUnsavedChanges && <span className="text-amber-600 ml-1">• Unsaved</span>}
            </span>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPreview(true)}
            disabled={pages.length === 0}
            className="hidden sm:flex"
          >
            <Eye className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Preview</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowScoringOverview(true)}
            disabled={pages.length === 0}
            className={`hidden sm:flex ${scoringConfig.enabled ? "border-green-500 text-green-700 bg-green-50" : ""}`}
          >
            <Target className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Scoring</span>
          </Button>

          <Button
            size="sm"
            onClick={saveFormConfiguration}
            disabled={saving || !reportId || pages.length === 0}
          >
            {saving ? <Loader2 className="h-4 w-4 sm:mr-2 animate-spin" /> : <Save className="h-4 w-4 sm:mr-2" />}
            <span className="hidden sm:inline">{saving ? "Saving..." : hasUnsavedChanges ? "Save Changes" : "Save"}</span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm"><MoreVertical className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setShowSettings(true)}>
                <Settings2 className="mr-2 h-4 w-4" /> Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowPreview(true)} disabled={pages.length === 0} className="sm:hidden">
                <Eye className="mr-2 h-4 w-4" /> Preview
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowScoringOverview(true)} disabled={pages.length === 0}>
                <Target className="mr-2 h-4 w-4" /> Scoring Overview
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportFormJSON}>
                <Download className="mr-2 h-4 w-4" /> Export JSON
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={publishForm}
                disabled={saving || hasUnsavedChanges || pages.length === 0}
                className={isPublished ? "text-orange-600" : "text-green-600"}
              >
                <span className="mr-2">{isPublished ? "🔒" : "🚀"}</span>
                {isPublished ? "Unpublish Form" : "Publish Form"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* No-report-id warning */}
      {!reportId && (
        <Alert>
          <AlertDescription>
            No report context. Navigate here from the <strong>Program Reports</strong> page using "Configure Form".
          </AlertDescription>
        </Alert>
      )}

      {/* Stats row */}
      {pages.length > 0 && (
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span>{pages.length} page{pages.length !== 1 ? "s" : ""}</span>
          <span>{getTotalFields()} field{getTotalFields() !== 1 ? "s" : ""}</span>
          <span>{getRequiredFields()} required</span>
          <span>v{formVersion}</span>
        </div>
      )}

      {/* Main builder layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left: Field type selector */}
        <div className="lg:col-span-1">
          <FieldTypeSelector onAddField={addFieldToCurrentPage} />
        </div>

        {/* Centre: Canvas */}
        <div className="lg:col-span-3">
          {pages.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No pages yet</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Start building by adding a field from the panel on the left, or add a page manually.
                </p>
                <Button onClick={addFirstPage}>Add First Page</Button>
              </CardContent>
            </Card>
          ) : (
            <FormCanvas
              pages={pages}
              onUpdatePages={(p) => { setPages(p); setHasUnsavedChanges(true); }}
              onAddField={addField}
            />
          )}
        </div>
      </div>

      {/* ── Preview Dialog ──────────────────────────────────────────────────── */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Form Preview — {formTitle}</DialogTitle>
          </DialogHeader>
          <FormPreview pages={pages} formTitle={formTitle} formDescription={formDescription} />
        </DialogContent>
      </Dialog>

      {/* ── Settings Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Form Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="space-y-1">
              <Label>Form Title</Label>
              <Input value={formTitle} onChange={(e) => { setFormTitle(e.target.value); setHasUnsavedChanges(true); }} />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea
                value={formDescription}
                onChange={(e) => { setFormDescription(e.target.value); setHasUnsavedChanges(true); }}
                rows={3}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Form Enabled</Label>
              <Switch
                checked={formEnabled}
                onCheckedChange={(v) => { setFormEnabled(v); setHasUnsavedChanges(true); }}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Allow Drafts</Label>
              <Switch
                checked={allowDrafts}
                onCheckedChange={(v) => { setAllowDrafts(v); setHasUnsavedChanges(true); }}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Email Notifications</Label>
              <Switch
                checked={emailNotifications}
                onCheckedChange={(v) => { setEmailNotifications(v); setHasUnsavedChanges(true); }}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Scoring Overview Dialog ─────────────────────────────────────────── */}
      <Dialog open={showScoringOverview} onOpenChange={setShowScoringOverview}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Scoring Configuration</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between">
              <Label>Enable Scoring</Label>
              <Switch
                checked={scoringConfig.enabled}
                onCheckedChange={(v) =>
                  setScoringConfig((prev) => ({ ...prev, enabled: v }))
                }
              />
            </div>
            {scoringConfig.enabled && (
              <>
                <div className="space-y-1">
                  <Label>Minimum Threshold (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={scoringConfig.minimumThreshold}
                    onChange={(e) =>
                      setScoringConfig((prev) => ({
                        ...prev,
                        minimumThreshold: Number(e.target.value),
                      }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Auto-reject Below Threshold</Label>
                  <Switch
                    checked={scoringConfig.autoRejectBelowThreshold}
                    onCheckedChange={(v) =>
                      setScoringConfig((prev) => ({ ...prev, autoRejectBelowThreshold: v }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Show Score to Admin</Label>
                  <Switch
                    checked={scoringConfig.showScoreToAdmin}
                    onCheckedChange={(v) =>
                      setScoringConfig((prev) => ({ ...prev, showScoreToAdmin: v }))
                    }
                  />
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
