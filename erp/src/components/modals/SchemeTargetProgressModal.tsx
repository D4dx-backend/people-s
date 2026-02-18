import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Target,
  Loader2,
  TrendingUp,
  Calendar,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  schemes as schemesApi,
  type Scheme,
  type SchemeTargetProgress,
} from "@/lib/api";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface SchemeTargetProgressModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scheme: Scheme | null;
}

export function SchemeTargetProgressModal({
  open,
  onOpenChange,
  scheme,
}: SchemeTargetProgressModalProps) {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<SchemeTargetProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && scheme) {
      loadProgress();
    }
  }, [open, scheme]);

  useEffect(() => {
    if (!open) {
      setProgress(null);
      setError(null);
    }
  }, [open]);

  const loadProgress = async () => {
    if (!scheme) return;
    try {
      setLoading(true);
      setError(null);
      const response = await schemesApi.getTargetProgress(scheme.id) as any;
      if (response.success && response.data?.progress) {
        setProgress(response.data.progress);
      } else {
        setError("No targets configured for this scheme");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load progress");
    } finally {
      setLoading(false);
    }
  };

  if (!scheme) return null;

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return "text-green-600";
    if (percentage >= 75) return "text-blue-600";
    if (percentage >= 50) return "text-yellow-600";
    return "text-red-600";
  };

  const getProgressBarColor = (percentage: number) => {
    if (percentage >= 100) return "[&>div]:bg-green-500";
    if (percentage >= 75) return "[&>div]:bg-blue-500";
    if (percentage >= 50) return "[&>div]:bg-yellow-500";
    return "[&>div]:bg-red-500";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            Target Progress — {scheme.name}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading progress...</span>
          </div>
        ) : error ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : progress ? (
          <div className="space-y-6">
            {/* Overall Summary */}
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-4 pb-4 text-center">
                  <Target className="h-6 w-6 mx-auto mb-1 text-purple-600" />
                  <p className="text-2xl font-bold">{progress.totalTarget}</p>
                  <p className="text-xs text-muted-foreground">Total Target</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4 text-center">
                  <CheckCircle2 className="h-6 w-6 mx-auto mb-1 text-green-600" />
                  <p className="text-2xl font-bold">{progress.totalAchieved}</p>
                  <p className="text-xs text-muted-foreground">Achieved</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4 text-center">
                  <TrendingUp className={`h-6 w-6 mx-auto mb-1 ${getProgressColor(progress.totalPercentage)}`} />
                  <p className={`text-2xl font-bold ${getProgressColor(progress.totalPercentage)}`}>
                    {progress.totalPercentage}%
                  </p>
                  <p className="text-xs text-muted-foreground">Progress</p>
                </CardContent>
              </Card>
            </div>

            {/* Overall Progress Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Overall Progress</span>
                <span className="font-medium">
                  {progress.totalAchieved} / {progress.totalTarget}
                </span>
              </div>
              <Progress
                value={Math.min(progress.totalPercentage, 100)}
                className={`h-3 ${getProgressBarColor(progress.totalPercentage)}`}
              />
            </div>

            {/* Monthly Breakdown */}
            {progress.monthlyProgress.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Monthly Breakdown
                </h3>
                <Accordion type="multiple" className="space-y-2">
                  {progress.monthlyProgress.map((mp, idx) => (
                    <AccordionItem
                      key={idx}
                      value={`month-${idx}`}
                      className="border rounded-lg"
                    >
                      <AccordionTrigger className="px-4 py-3 hover:no-underline">
                        <div className="flex items-center justify-between w-full mr-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {MONTHS[mp.month - 1]} {mp.year}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm">
                              {mp.achieved}/{mp.target}
                            </span>
                            <Badge
                              className={`text-xs ${
                                mp.percentage >= 100
                                  ? "bg-green-100 text-green-800"
                                  : mp.percentage >= 50
                                  ? "bg-yellow-100 text-yellow-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {mp.percentage}%
                            </Badge>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4">
                        <div className="space-y-4">
                          {/* Monthly Progress Bar */}
                          <div className="space-y-1">
                            <Progress
                              value={Math.min(mp.percentage, 100)}
                              className={`h-2 ${getProgressBarColor(mp.percentage)}`}
                            />
                          </div>

                          {/* Criteria Breakdown */}
                          {mp.criteriaProgress.length > 0 &&
                            mp.criteriaProgress.map((cp, cpIdx) => (
                              <div
                                key={cpIdx}
                                className="p-3 bg-gray-50 rounded-lg space-y-2"
                              >
                                <div className="flex items-center gap-2">
                                  <Badge variant="secondary" className="text-xs">
                                    {cp.formFieldLabel}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    ({cp.formFieldType})
                                  </span>
                                </div>
                                <div className="space-y-2">
                                  {cp.valueProgress.map((vp, vpIdx) => (
                                    <div key={vpIdx} className="space-y-1">
                                      <div className="flex items-center justify-between text-xs">
                                        <span className="font-medium">
                                          {vp.value}
                                        </span>
                                        <span>
                                          {vp.achieved}/{vp.target}{" "}
                                          <span
                                            className={getProgressColor(
                                              vp.percentage
                                            )}
                                          >
                                            ({vp.percentage}%)
                                          </span>
                                        </span>
                                      </div>
                                      <Progress
                                        value={Math.min(vp.percentage, 100)}
                                        className={`h-1.5 ${getProgressBarColor(
                                          vp.percentage
                                        )}`}
                                      />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}

                          {mp.criteriaProgress.length === 0 && (
                            <p className="text-xs text-muted-foreground">
                              No criteria targets set for this month.
                            </p>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            )}

            {progress.monthlyProgress.length === 0 && (
              <div className="text-center py-6 text-muted-foreground">
                <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No monthly targets configured.</p>
              </div>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
