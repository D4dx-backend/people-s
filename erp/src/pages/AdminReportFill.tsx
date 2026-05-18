import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Loader2, AlertCircle, Save, Send, CheckCircle, ChevronLeft, ChevronRight,
  Edit, Trash2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { adminReports } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

// ── Types ─────────────────────────────────────────────────────────────────────

interface FormField {
  id: number;
  label: string;
  type: string;
  required: boolean;
  enabled: boolean;
  placeholder?: string;
  helpText?: string;
  options?: string[];
  validation?: {
    pattern?: string;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    customMessage?: string;
  };
  columns?: number;
  columnTitles?: string[];
  rows?: number;
  rowTitles?: string[];
  firstColumnHeader?: string;
  conditionalLogic?: {
    field: number;
    operator: string;
    value: string;
    action?: string;
  };
}

interface FormPage {
  id: number;
  title: string;
  description?: string;
  fields: FormField[];
  order?: number;
  conditionalLogic?: { field: number; operator: string; value: string };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isFieldVisible(field: FormField, formData: Record<string, any>): boolean {
  if (!field.conditionalLogic?.field) return true;
  const depKey = `field_${field.conditionalLogic.field}`;
  const depValue = String(formData[depKey] ?? "");
  const condValue = field.conditionalLogic.value ?? "";
  const op = field.conditionalLogic.operator;
  let match = false;
  switch (op) {
    case "equals": match = depValue === condValue; break;
    case "not_equals": match = depValue !== condValue; break;
    case "contains": match = depValue.includes(condValue); break;
    case "not_contains": match = !depValue.includes(condValue); break;
    case "greater_than": match = Number(depValue) > Number(condValue); break;
    case "less_than": match = Number(depValue) < Number(condValue); break;
    case "is_empty": match = !depValue; break;
    case "is_not_empty": match = !!depValue; break;
    default: match = true;
  }
  const action = field.conditionalLogic.action || "show";
  return action === "hide" ? !match : match;
}

function validateField(field: FormField, value: any): string {
  if (["title", "html", "group", "page"].includes(field.type)) return "";
  if (field.type === "checkbox") {
    if (!field.required) return "";
    // Multi-option checkbox: at least one must be selected
    if (field.options && field.options.length > 0) {
      return Array.isArray(value) && value.length > 0 ? "" : `${field.label} is required — select at least one`;
    }
    // Single boolean checkbox
    return !value ? `${field.label} is required` : "";
  }
  if (field.type === "row" || field.type === "column") {
    if (field.required) {
      const t = Array.isArray(value) ? value : [];
      if (!t.some((row: string[]) => row?.some((c: string) => c?.trim()))) {
        return `${field.label} is required — fill at least one cell`;
      }
    }
    return "";
  }
  if (field.required && (!value || String(value).trim() === "")) {
    return `${field.label} is required`;
  }
  if (!value || String(value).trim() === "") return "";
  const msg = (def: string) => field.validation?.customMessage || def;
  if (field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return msg("Please enter a valid email address");
  }
  if (field.type === "phone" && !/^[+]?[0-9]{10,15}$/.test(value.replace(/\s/g, ""))) {
    return msg("Please enter a valid phone number");
  }
  if (field.type === "number") {
    if (isNaN(value)) return msg("Please enter a valid number");
    if (field.validation?.min !== undefined && Number(value) < field.validation.min)
      return msg(`Minimum value is ${field.validation.min}`);
    if (field.validation?.max !== undefined && Number(value) > field.validation.max)
      return msg(`Maximum value is ${field.validation.max}`);
  }
  if (["text", "textarea"].includes(field.type)) {
    if (field.validation?.minLength && value.length < field.validation.minLength)
      return msg(`Minimum length is ${field.validation.minLength} characters`);
    if (field.validation?.maxLength && value.length > field.validation.maxLength)
      return msg(`Maximum length is ${field.validation.maxLength} characters`);
  }
  if (field.validation?.pattern) {
    try {
      if (!new RegExp(field.validation.pattern).test(value)) return msg("Please enter a valid value");
    } catch { /* ignore invalid regex */ }
  }
  return "";
}

// ── Field Renderer ────────────────────────────────────────────────────────────

interface FieldProps {
  field: FormField;
  value: any;
  error?: string;
  onChange: (val: any) => void;
}

function FieldRenderer({ field, value, error, onChange }: FieldProps) {
  const { type, label, placeholder, helpText, options, required, enabled } = field;
  if (!enabled) return null;
  if (type === "title") return <h3 className="text-base font-semibold mt-2">{label}</h3>;
  if (type === "html") return <div className="text-sm text-muted-foreground" dangerouslySetInnerHTML={{ __html: label }} />;

  const inputClass = `${error ? "border-red-500" : ""}`;

  // Table / row / column field
  if (type === "row" || type === "column") {
    const cols = field.columns || 2;
    const rows = field.rows || 3;
    const colTitles = field.columnTitles || [];
    const rowTitles = field.rowTitles || [];
    const tableData: string[][] = Array.isArray(value)
      ? value
      : Array.from({ length: rows }, () => Array(cols).fill(""));

    const handleCell = (r: number, c: number, v: string) => {
      const copy = tableData.map((row: string[]) => [...row]);
      if (!copy[r]) copy[r] = Array(cols).fill("");
      copy[r][c] = v;
      onChange(copy);
    };

    return (
      <div className="space-y-1">
        <Label>{label}{required && <span className="text-red-500 ml-1">*</span>}</Label>
        {helpText && <p className="text-xs text-muted-foreground">{helpText}</p>}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {rowTitles.length > 0 && (
                  <th className="border border-border bg-muted px-2 py-1 text-left text-xs font-medium">
                    {field.firstColumnHeader || ""}
                  </th>
                )}
                {Array.from({ length: cols }).map((_, c) => (
                  <th key={c} className="border border-border bg-muted px-2 py-1 text-left text-xs font-medium">
                    {colTitles[c] || `Col ${c + 1}`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: rows }).map((_, r) => (
                <tr key={r}>
                  {rowTitles.length > 0 && (
                    <td className="border border-border bg-muted/50 px-2 py-1 text-xs font-medium whitespace-nowrap">
                      {rowTitles[r] || `Row ${r + 1}`}
                    </td>
                  )}
                  {Array.from({ length: cols }).map((_, c) => (
                    <td key={c} className="border border-border p-0.5">
                      <input
                        type="text"
                        value={tableData[r]?.[c] || ""}
                        onChange={(e) => handleCell(r, c, e.target.value)}
                        className="w-full px-2 py-1 text-xs bg-transparent outline-none"
                        placeholder="..."
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {!["checkbox", "yesno"].includes(type) && (
        <Label htmlFor={`field_${field.id}`}>
          {label}{required && <span className="text-red-500 ml-1">*</span>}
        </Label>
      )}
      {helpText && <p className="text-xs text-muted-foreground">{helpText}</p>}

      {(type === "text" || type === "email" || type === "phone" || type === "url" || type === "password" || type === "time") && (
        <Input
          id={`field_${field.id}`}
          type={type === "phone" ? "tel" : type}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={inputClass}
        />
      )}
      {type === "number" && (
        <Input
          id={`field_${field.id}`}
          type="number"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={inputClass}
          min={field.validation?.min}
          max={field.validation?.max}
        />
      )}
      {(type === "date" || type === "datetime") && (
        <Input
          id={`field_${field.id}`}
          type={type === "datetime" ? "datetime-local" : "date"}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      )}
      {type === "textarea" && (
        <Textarea
          id={`field_${field.id}`}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={inputClass}
          rows={4}
        />
      )}
      {(type === "select" || type === "dropdown") && options && options.length > 0 && (
        <Select value={value || ""} onValueChange={onChange}>
          <SelectTrigger className={inputClass}>
            <SelectValue placeholder={placeholder || `Select ${label}`} />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {type === "radio" && options && options.length > 0 && (
        <div className="space-y-2">
          {options.map((opt) => (
            <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name={`field_${field.id}`}
                value={opt}
                checked={value === opt}
                onChange={() => onChange(opt)}
                className="accent-primary"
              />
              {opt}
            </label>
          ))}
        </div>
      )}
      {type === "yesno" && (
        <div className="flex gap-4">
          {["Yes", "No"].map((opt) => (
            <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name={`field_${field.id}`}
                value={opt}
                checked={value === opt}
                onChange={() => onChange(opt)}
                className="accent-primary"
              />
              {opt}
            </label>
          ))}
        </div>
      )}
      {type === "checkbox" && options && options.length > 0 && (
        // Multi-option checkbox — each option is a separate checkbox
        <div className="space-y-2">
          {options.map((opt) => {
            const selected: string[] = Array.isArray(value) ? value : [];
            return (
              <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={selected.includes(opt)}
                  onCheckedChange={(checked) => {
                    const next = checked
                      ? [...selected, opt]
                      : selected.filter((s) => s !== opt);
                    onChange(next);
                  }}
                />
                {opt}
              </label>
            );
          })}
        </div>
      )}
      {type === "checkbox" && (!options || options.length === 0) && (
        // Single boolean checkbox (no options configured)
        <div className="flex items-center gap-2">
          <Checkbox
            id={`field_${field.id}`}
            checked={!!value}
            onCheckedChange={(checked) => onChange(checked)}
          />
          <Label htmlFor={`field_${field.id}`} className="cursor-pointer">
            {label}{required && <span className="text-red-500 ml-1">*</span>}
          </Label>
        </div>
      )}
      {(type === "multiselect") && options && options.length > 0 && (
        <div className="space-y-2">
          {options.map((opt) => {
            const selected: string[] = Array.isArray(value) ? value : [];
            return (
              <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={selected.includes(opt)}
                  onCheckedChange={(checked) => {
                    const next = checked
                      ? [...selected, opt]
                      : selected.filter((s) => s !== opt);
                    onChange(next);
                  }}
                />
                {opt}
              </label>
            );
          })}
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminReportFill() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const reportId = searchParams.get("reportId");
  const reportTitle = searchParams.get("reportTitle");

  const [pages, setPages] = useState<FormPage[]>([]);
  const [formConfig, setFormConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [viewMode, setViewMode] = useState(false);       // already submitted — read-only view
  const [viewedSubmission, setViewedSubmission] = useState<any>(null);

  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [currentPage, setCurrentPage] = useState(0);

  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);       // editing an existing submitted submission
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ── Load form config + existing draft ──────────────────────────────────────

  useEffect(() => {
    const load = async () => {
      if (!reportId) { setLoading(false); return; }
      try {
        const res = await adminReports.getFormConfig(reportId);
        if (!res.data?.hasConfiguration || !res.data?.formConfiguration?.isPublished) {
          setError("This report form is not available.");
          return;
        }
        const config = res.data.formConfiguration;
        setFormConfig(config);
        const sortedPages = [...(config.pages || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        setPages(sortedPages);

        // Check for an already-submitted submission first
        try {
          const subRes = await adminReports.getSubmissions(reportId, { status: "submitted" });
          const submitted = (subRes.data?.submissions || []).find((s: any) => s.status === "submitted");
          if (submitted) {
            setViewMode(true);
            setViewedSubmission(submitted);
            setFormData(submitted.formData || {});
            setLoading(false);
            return;
          }
        } catch { /* no submission yet, continue */ }

        // Load existing draft
        try {
          const subRes = await adminReports.getSubmissions(reportId, { status: "draft" });
          const drafts = subRes.data?.submissions || [];
          const myDraft = drafts.find((s: any) => s.status === "draft");
          if (myDraft) {
            setSubmissionId(myDraft._id);
            setFormData(myDraft.formData || {});
            toast({ title: "Draft restored", description: "Your previous draft has been loaded." });
          }
        } catch { /* no draft, that's fine */ }
      } catch {
        setError("Failed to load form. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [reportId, user]);

  // ── Validate current page ──────────────────────────────────────────────────

  const validatePage = useCallback((): boolean => {
    if (!pages[currentPage]) return true;
    const newErrors: Record<string, string> = {};
    let valid = true;
    pages[currentPage].fields.forEach((field) => {
      if (!field.enabled) return;
      if (!isFieldVisible(field, formData)) return;
      const key = `field_${field.id}`;
      const err = validateField(field, formData[key]);
      if (err) { newErrors[key] = err; valid = false; }
    });
    setErrors(newErrors);
    return valid;
  }, [pages, currentPage, formData]);

  // ── Field change ───────────────────────────────────────────────────────────

  const handleFieldChange = (fieldId: number, value: any) => {
    const key = `field_${fieldId}`;
    setFormData((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  // ── Save draft ─────────────────────────────────────────────────────────────

  const saveDraft = async (silent = false) => {
    if (!reportId) return;
    setSavingDraft(true);
    try {
      const res = await adminReports.saveDraft(reportId, { formData });
      const sub = res.data?.submission;
      if (sub?._id) setSubmissionId(sub._id);
      if (!silent) toast({ title: "Draft saved" });
    } catch {
      if (!silent) toast({ title: "Failed to save draft", variant: "destructive" });
    } finally {
      setSavingDraft(false);
    }
  };

  // ── Submit / Update ────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!validatePage()) {
      toast({ title: "Please fix all errors before submitting", variant: "destructive" });
      return;
    }
    if (!reportId) return;
    setSubmitting(true);
    try {
      if (isEditing && submissionId) {
        // Update an already-submitted submission
        await adminReports.updateSubmission(reportId, submissionId, { formData });
        toast({ title: "Report updated successfully" });
        setIsEditing(false);
        setViewMode(true);
      } else {
        // Normal first-time submit
        let sid = submissionId;
        if (!sid) {
          const draftRes = await adminReports.saveDraft(reportId, { formData });
          sid = draftRes.data?.submission?._id;
          if (sid) setSubmissionId(sid);
        }
        if (!sid) throw new Error("Could not create submission");
        await adminReports.submitForm(reportId, sid, { formData });
        setSubmitted(true);
      }
    } catch {
      toast({ title: "Failed to submit report", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Delete submission ──────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!reportId || !submissionId) return;
    setDeleting(true);
    try {
      await adminReports.deleteSubmission(reportId, submissionId);
      toast({ title: "Submission deleted" });
      navigate("/admin-reports");
    } catch {
      toast({ title: "Failed to delete submission", variant: "destructive" });
    } finally {
      setDeleting(false);
      setDeleteConfirmOpen(false);
    }
  };

  const handleNext = () => {
    if (!validatePage()) {
      toast({ title: "Please complete all required fields", variant: "destructive" });
      return;
    }
    setCurrentPage((p) => Math.min(p + 1, pages.length - 1));
    window.scrollTo(0, 0);
  };

  const handlePrev = () => {
    setCurrentPage((p) => Math.max(p - 1, 0));
    window.scrollTo(0, 0);
  };

  const progressPct = pages.length > 0 ? ((currentPage + 1) / pages.length) * 100 : 0;

  // ── Render: Loading ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Render: Already Submitted (view-only) ─────────────────────────────────

  if (viewMode && formConfig) {
    const submittedAt = viewedSubmission?.submittedAt || viewedSubmission?.updatedAt;
    return (
      <div className="container max-w-2xl mx-auto py-6 space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin-reports")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Reports
        </Button>

        <Card className="border-green-200 bg-green-50/40">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  {formConfig.title}
                </CardTitle>
                {formConfig.description && (
                  <CardDescription className="mt-1">{formConfig.description}</CardDescription>
                )}
              </div>
              <Badge className="text-xs bg-green-100 text-green-800 border-green-200 shrink-0" variant="outline">
                Submitted
              </Badge>
            </div>
            {submittedAt && (
              <p className="text-xs text-muted-foreground mt-2">
                Submitted on {new Date(submittedAt).toLocaleString()}
              </p>
            )}
            {/* Edit / Delete actions */}
            <div className="flex gap-2 mt-3">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setViewMode(false);
                  setIsEditing(true);
                  setCurrentPage(0);
                }}
              >
                <Edit className="h-4 w-4 mr-1" /> Edit Submission
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-red-600 hover:text-red-700 hover:border-red-300"
                onClick={() => setDeleteConfirmOpen(true)}
              >
                <Trash2 className="h-4 w-4 mr-1" /> Delete Submission
              </Button>
            </div>
          </CardHeader>
        </Card>

        {pages.map((page) => {
          const visibleFields = page.fields.filter((f) => f.enabled);
          if (visibleFields.length === 0) return null;
          return (
            <Card key={page.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{page.title}</CardTitle>
                {page.description && <CardDescription>{page.description}</CardDescription>}
              </CardHeader>
              <CardContent className="space-y-4">
                {visibleFields.map((field) => {
                  const key = `field_${field.id}`;
                  const value = formData[key];
                  const displayValue = Array.isArray(value)
                    ? value.join(", ")
                    : value === true ? "Yes" : value === false ? "No" : value != null ? String(value) : "—";
                  return (
                    <div key={field.id} className="space-y-0.5">
                      <p className="text-xs font-medium text-muted-foreground">{field.label}</p>
                      <p className="text-sm">{displayValue}</p>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}

        {/* Delete confirm dialog */}
        <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Submission</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete your submission for <strong>{formConfig.title}</strong>? This cannot be undone.
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

  // ── Render: Error ──────────────────────────────────────────────────────────

  if (error || !formConfig) {
    return (
      <div className="container max-w-2xl mx-auto py-10 space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin-reports")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Reports
        </Button>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || "Form configuration not found."}</AlertDescription>
        </Alert>
      </div>
    );
  }

  // ── Render: Success ────────────────────────────────────────────────────────

  if (submitted) {
    return (
      <div className="container max-w-2xl mx-auto py-16 text-center space-y-4">
        <div className="flex justify-center">
          <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
        </div>
        <h2 className="text-xl font-semibold">Report Submitted Successfully!</h2>
        <p className="text-muted-foreground text-sm">
          {formConfig.submissionSettings?.confirmationMessage || "Thank you for submitting the report."}
        </p>
        <Button onClick={() => navigate("/admin-reports")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Reports
        </Button>
      </div>
    );
  }

  // ── Render: Form ───────────────────────────────────────────────────────────

  const activePage = pages[currentPage];
  const isLastPage = currentPage === pages.length - 1;

  return (
    <div className="container max-w-2xl mx-auto py-6 space-y-6">
      {/* Back button */}
      <Button variant="ghost" size="sm" onClick={() => navigate("/admin-reports")}>
        <ArrowLeft className="h-4 w-4 mr-2" /> Back to Reports
      </Button>

      {/* Header card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-lg">{formConfig.title}</CardTitle>
              {formConfig.description && (
                <CardDescription className="mt-1">{formConfig.description}</CardDescription>
              )}
            </div>
            {isEditing ? (
              <Badge variant="outline" className="text-xs shrink-0 bg-blue-50 text-blue-700 border-blue-200">
                Editing
              </Badge>
            ) : submissionId ? (
              <Badge variant="outline" className="text-xs shrink-0">Draft saved</Badge>
            ) : null}
          </div>
          {/* Progress */}
          {pages.length > 1 && (
            <div className="mt-3 space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Page {currentPage + 1} of {pages.length}</span>
                <span>{Math.round(progressPct)}%</span>
              </div>
              <Progress value={progressPct} className="h-1.5" />
            </div>
          )}
        </CardHeader>
      </Card>

      {/* Active page */}
      {activePage && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{activePage.title}</CardTitle>
            {activePage.description && (
              <CardDescription>{activePage.description}</CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-5">
            {activePage.fields
              .filter((f) => f.enabled && isFieldVisible(f, formData))
              .map((field) => (
                <FieldRenderer
                  key={field.id}
                  field={field}
                  value={formData[`field_${field.id}`]}
                  error={errors[`field_${field.id}`]}
                  onChange={(v) => handleFieldChange(field.id, v)}
                />
              ))}
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="outline"
          onClick={handlePrev}
          disabled={currentPage === 0}
        >
          <ChevronLeft className="h-4 w-4 mr-1" /> Previous
        </Button>

        {!isEditing && (
          <Button
            variant="outline"
            onClick={() => saveDraft()}
            disabled={savingDraft}
          >
            {savingDraft ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            Save Draft
          </Button>
        )}

        {isEditing && (
          <Button
            variant="outline"
            onClick={() => { setIsEditing(false); setViewMode(true); setCurrentPage(0); }}
          >
            Cancel
          </Button>
        )}

        {isLastPage ? (
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
            {isEditing ? "Update Report" : "Submit Report"}
          </Button>
        ) : (
          <Button onClick={handleNext}>
            Next <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}
