import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Target,
  Plus,
  Trash2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Calendar,
  BarChart3,
  Settings2,
  AlertCircle,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  schemes as schemesApi,
  type Scheme,
  type SchemeTarget,
  type SchemeTargetMonthly,
  type SchemeTargetCriteria,
  type SchemeTargetFormField,
} from "@/lib/api";
import { toast } from "@/hooks/use-toast";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const YEARS = Array.from({ length: 10 }, (_, i) => 2024 + i);

interface SchemeTargetsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scheme: Scheme | null;
  onSuccess?: () => void;
}

export function SchemeTargetsModal({
  open,
  onOpenChange,
  scheme,
  onSuccess,
}: SchemeTargetsModalProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formFields, setFormFields] = useState<SchemeTargetFormField[]>([]);
  const [loadingFields, setLoadingFields] = useState(false);

  // Step 1: Total target
  const [totalTarget, setTotalTarget] = useState<number>(0);
  const [description, setDescription] = useState("");

  // Step 2: Monthly targets
  const [monthlyTargets, setMonthlyTargets] = useState<SchemeTargetMonthly[]>([]);

  // Load existing targets and form fields when modal opens
  useEffect(() => {
    if (open && scheme) {
      loadExistingTargets();
      loadFormFields();
    }
  }, [open, scheme]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setStep(1);
    }
  }, [open]);

  const loadExistingTargets = async () => {
    if (!scheme) return;
    try {
      setLoading(true);
      const response = await schemesApi.getTargets(scheme.id) as any;
      if (response.success && response.data?.target) {
        const t = response.data.target;
        setTotalTarget(t.totalTarget || 0);
        setDescription(t.description || "");
        setMonthlyTargets(t.monthlyTargets || []);
      } else {
        // No existing targets
        setTotalTarget(0);
        setDescription("");
        setMonthlyTargets([]);
      }
    } catch (err) {
      console.error("Failed to load targets:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadFormFields = async () => {
    if (!scheme) return;
    try {
      setLoadingFields(true);
      const response = await schemesApi.getTargetFormFields(scheme.id) as any;
      if (response.success && response.data?.fields) {
        setFormFields(response.data.fields);
      }
    } catch (err) {
      console.error("Failed to load form fields:", err);
    } finally {
      setLoadingFields(false);
    }
  };

  // Monthly target helpers
  const addMonthlyTarget = () => {
    const now = new Date();
    setMonthlyTargets((prev) => [
      ...prev,
      {
        month: now.getMonth() + 1,
        year: now.getFullYear(),
        target: 0,
        criteriaTargets: [],
      },
    ]);
  };

  const removeMonthlyTarget = (idx: number) => {
    setMonthlyTargets((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateMonthlyTarget = (
    idx: number,
    field: keyof SchemeTargetMonthly,
    value: any
  ) => {
    setMonthlyTargets((prev) =>
      prev.map((mt, i) => (i === idx ? { ...mt, [field]: value } : mt))
    );
  };

  // Criteria helpers
  const addCriteria = (monthIdx: number) => {
    if (formFields.length === 0) {
      toast({
        title: "No Form Fields",
        description: "Configure a form with select/dropdown/radio fields first.",
        variant: "destructive",
      });
      return;
    }
    setMonthlyTargets((prev) =>
      prev.map((mt, i) =>
        i === monthIdx
          ? {
              ...mt,
              criteriaTargets: [
                ...mt.criteriaTargets,
                {
                  formFieldId: 0,
                  formFieldLabel: "",
                  formFieldType: "",
                  valueTargets: [],
                },
              ],
            }
          : mt
      )
    );
  };

  const removeCriteria = (monthIdx: number, critIdx: number) => {
    setMonthlyTargets((prev) =>
      prev.map((mt, i) =>
        i === monthIdx
          ? {
              ...mt,
              criteriaTargets: mt.criteriaTargets.filter((_, ci) => ci !== critIdx),
            }
          : mt
      )
    );
  };

  const selectCriteriaField = (
    monthIdx: number,
    critIdx: number,
    fieldId: string
  ) => {
    const field = formFields.find((f) => f.id === Number(fieldId));
    if (!field) return;

    setMonthlyTargets((prev) =>
      prev.map((mt, i) =>
        i === monthIdx
          ? {
              ...mt,
              criteriaTargets: mt.criteriaTargets.map((c, ci) =>
                ci === critIdx
                  ? {
                      formFieldId: field.id,
                      formFieldLabel: field.label,
                      formFieldType: field.type,
                      valueTargets: field.options.map((opt) => ({
                        value: opt.value,
                        target: 0,
                      })),
                    }
                  : c
              ),
            }
          : mt
      )
    );
  };

  const updateValueTarget = (
    monthIdx: number,
    critIdx: number,
    valIdx: number,
    target: number
  ) => {
    setMonthlyTargets((prev) =>
      prev.map((mt, i) =>
        i === monthIdx
          ? {
              ...mt,
              criteriaTargets: mt.criteriaTargets.map((c, ci) =>
                ci === critIdx
                  ? {
                      ...c,
                      valueTargets: c.valueTargets.map((vt, vi) =>
                        vi === valIdx ? { ...vt, target } : vt
                      ),
                    }
                  : c
              ),
            }
          : mt
      )
    );
  };

  // Validation
  const getMonthlySum = () =>
    monthlyTargets.reduce((sum, mt) => sum + (mt.target || 0), 0);

  const hasDuplicateMonths = () => {
    const keys = monthlyTargets.map((mt) => `${mt.year}-${mt.month}`);
    return keys.length !== new Set(keys).size;
  };

  // Save
  const handleSave = async () => {
    if (!scheme) return;

    if (totalTarget < 1) {
      toast({ title: "Error", description: "Total target must be at least 1", variant: "destructive" });
      return;
    }

    const monthlySum = getMonthlySum();
    if (monthlySum > totalTarget) {
      toast({
        title: "Error",
        description: `Monthly targets sum (${monthlySum}) exceeds total target (${totalTarget})`,
        variant: "destructive",
      });
      return;
    }

    if (hasDuplicateMonths()) {
      toast({ title: "Error", description: "Duplicate month/year entries found", variant: "destructive" });
      return;
    }

    // Filter out incomplete criteria
    const cleanedMonthly = monthlyTargets.map((mt) => ({
      ...mt,
      criteriaTargets: mt.criteriaTargets.filter(
        (c) => c.formFieldId > 0 && c.valueTargets.length > 0
      ),
    }));

    try {
      setSaving(true);
      const response = await schemesApi.upsertTargets(scheme.id, {
        totalTarget,
        description,
        monthlyTargets: cleanedMonthly,
      });

      if (response.success) {
        toast({ title: "Success", description: "Scheme targets saved successfully" });
        onSuccess?.();
        onOpenChange(false);
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to save targets",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!scheme) return null;

  const monthlySum = getMonthlySum();
  const remaining = totalTarget - monthlySum;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-purple-600" />
            Configure Targets — {scheme.name}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading targets...</span>
          </div>
        ) : (
          <>
            {/* Step Indicators */}
            <div className="flex items-center justify-center gap-2 mb-4">
              {[
                { num: 1, label: "Total Target", icon: Target },
                { num: 2, label: "Monthly Targets", icon: Calendar },
                { num: 3, label: "Criteria", icon: Settings2 },
              ].map(({ num, label, icon: Icon }) => (
                <div
                  key={num}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm cursor-pointer transition-colors ${
                    step === num
                      ? "bg-purple-100 text-purple-800 font-medium"
                      : step > num
                      ? "bg-green-100 text-green-800"
                      : "bg-gray-100 text-gray-500"
                  }`}
                  onClick={() => setStep(num)}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </div>
              ))}
            </div>

            {/* Step 1: Total Target */}
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="totalTarget">Total Target (Number of Beneficiaries)</Label>
                  <Input
                    id="totalTarget"
                    type="number"
                    min={1}
                    value={totalTarget || ""}
                    onChange={(e) => setTotalTarget(Number(e.target.value) || 0)}
                    placeholder="e.g., 1000"
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    The total number of beneficiaries to be targeted under this scheme
                  </p>
                </div>
                <div>
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Notes about targets..."
                    className="mt-1"
                    rows={3}
                  />
                </div>
              </div>
            )}

            {/* Step 2: Monthly Targets */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Monthly Breakdown</p>
                    <p className="text-xs text-muted-foreground">
                      Total: {totalTarget} | Allocated: {monthlySum} | Remaining:{" "}
                      <span className={remaining < 0 ? "text-red-600 font-medium" : "text-green-600"}>
                        {remaining}
                      </span>
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={addMonthlyTarget}>
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add Month
                  </Button>
                </div>

                {remaining < 0 && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Monthly targets exceed total target by {Math.abs(remaining)}
                    </AlertDescription>
                  </Alert>
                )}

                {monthlyTargets.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p>No monthly targets yet. Click "Add Month" to start.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {monthlyTargets.map((mt, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-3 p-3 border rounded-lg bg-gray-50"
                      >
                        <div className="flex-1 grid grid-cols-3 gap-2">
                          <div>
                            <Label className="text-xs">Month</Label>
                            <Select
                              value={String(mt.month)}
                              onValueChange={(v) =>
                                updateMonthlyTarget(idx, "month", Number(v))
                              }
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {MONTHS.map((m, i) => (
                                  <SelectItem key={i + 1} value={String(i + 1)}>
                                    {m}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">Year</Label>
                            <Select
                              value={String(mt.year)}
                              onValueChange={(v) =>
                                updateMonthlyTarget(idx, "year", Number(v))
                              }
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {YEARS.map((y) => (
                                  <SelectItem key={y} value={String(y)}>
                                    {y}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">Target</Label>
                            <Input
                              type="number"
                              min={0}
                              value={mt.target || ""}
                              onChange={(e) =>
                                updateMonthlyTarget(
                                  idx,
                                  "target",
                                  Number(e.target.value) || 0
                                )
                              }
                              className="h-9"
                            />
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive h-9"
                          onClick={() => removeMonthlyTarget(idx)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Criteria Mapping */}
            {step === 3 && (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium">Criteria-Based Targets</p>
                  <p className="text-xs text-muted-foreground">
                    Map form fields to set criteria-based targets within each monthly target.
                    Only fields with selectable options (dropdown, radio, etc.) are available.
                  </p>
                </div>

                {formFields.length === 0 && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {loadingFields
                        ? "Loading form fields..."
                        : "No eligible form fields found. Configure a form with select/dropdown/radio fields first."}
                    </AlertDescription>
                  </Alert>
                )}

                {monthlyTargets.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <BarChart3 className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p>Add monthly targets in Step 2 first.</p>
                  </div>
                ) : (
                  <Accordion type="multiple" className="space-y-2">
                    {monthlyTargets.map((mt, monthIdx) => (
                      <AccordionItem
                        key={monthIdx}
                        value={`month-${monthIdx}`}
                        className="border rounded-lg"
                      >
                        <AccordionTrigger className="px-4 py-2 hover:no-underline">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {MONTHS[mt.month - 1]} {mt.year}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              Target: {mt.target}
                            </span>
                            {mt.criteriaTargets.length > 0 && (
                              <Badge className="bg-purple-100 text-purple-800 text-xs">
                                {mt.criteriaTargets.length} criteria
                              </Badge>
                            )}
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-4 pb-4">
                          <div className="space-y-3">
                            {mt.criteriaTargets.map((criteria, critIdx) => (
                              <div
                                key={critIdx}
                                className="p-3 border rounded-lg bg-gray-50 space-y-3"
                              >
                                <div className="flex items-center gap-2">
                                  <div className="flex-1">
                                    <Label className="text-xs">Map to Form Field</Label>
                                    <Select
                                      value={
                                        criteria.formFieldId
                                          ? String(criteria.formFieldId)
                                          : ""
                                      }
                                      onValueChange={(v) =>
                                        selectCriteriaField(monthIdx, critIdx, v)
                                      }
                                    >
                                      <SelectTrigger className="h-9">
                                        <SelectValue placeholder="Select a form field..." />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {formFields.map((f) => (
                                          <SelectItem key={f.id} value={String(f.id)}>
                                            {f.label}{" "}
                                            <span className="text-xs text-muted-foreground">
                                              ({f.type} — {f.pageTitle})
                                            </span>
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive mt-4"
                                    onClick={() => removeCriteria(monthIdx, critIdx)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>

                                {/* Per-option value targets */}
                                {criteria.valueTargets.length > 0 && (
                                  <div className="space-y-2 ml-2">
                                    <Label className="text-xs text-muted-foreground">
                                      Set target per option value:
                                    </Label>
                                    {criteria.valueTargets.map((vt, valIdx) => (
                                      <div
                                        key={valIdx}
                                        className="flex items-center gap-2"
                                      >
                                        <span className="text-sm min-w-[120px] truncate">
                                          {vt.value}
                                        </span>
                                        <Input
                                          type="number"
                                          min={0}
                                          value={vt.target || ""}
                                          onChange={(e) =>
                                            updateValueTarget(
                                              monthIdx,
                                              critIdx,
                                              valIdx,
                                              Number(e.target.value) || 0
                                            )
                                          }
                                          className="h-8 w-24"
                                          placeholder="0"
                                        />
                                      </div>
                                    ))}
                                    <p className="text-xs text-muted-foreground">
                                      Criteria total:{" "}
                                      {criteria.valueTargets.reduce(
                                        (s, vt) => s + (vt.target || 0),
                                        0
                                      )}{" "}
                                      / Monthly target: {mt.target}
                                    </p>
                                  </div>
                                )}
                              </div>
                            ))}

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => addCriteria(monthIdx)}
                              disabled={formFields.length === 0}
                            >
                              <Plus className="h-3.5 w-3.5 mr-1" />
                              Add Criteria
                            </Button>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                )}
              </div>
            )}

            {/* Footer Navigation */}
            <DialogFooter className="flex items-center justify-between pt-4 border-t">
              <div className="flex gap-2">
                {step > 1 && (
                  <Button variant="outline" onClick={() => setStep(step - 1)}>
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Back
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                {step < 3 ? (
                  <Button
                    onClick={() => setStep(step + 1)}
                    disabled={step === 1 && totalTarget < 1}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                ) : (
                  <Button onClick={handleSave} disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                    Save Targets
                  </Button>
                )}
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
