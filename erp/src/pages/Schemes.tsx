import { useState, useEffect } from "react";
import { Plus, Calendar, IndianRupee, Target, Users, Loader2, AlertCircle, Clock, Edit, Trash2, Eye, Settings, GitBranch, ChevronDown, ChevronUp, FileText, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { schemes as schemesApi, type Scheme } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { SchemeModal } from "@/components/modals/SchemeModal";
import { SchemeDetailsModal } from "@/components/modals/SchemeDetailsModal";
import { TimelineConfigModal } from "@/components/modals/TimelineConfigModal";
import { StagesConfigModal } from "@/components/modals/StagesConfigModal";
import { SchemeTargetsModal } from "@/components/modals/SchemeTargetsModal";
import { SchemeTargetProgressModal } from "@/components/modals/SchemeTargetProgressModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useNavigate } from "react-router-dom";
import { useRBAC } from "@/hooks/useRBAC";
import { useExport } from "@/hooks/useExport";
import ExportButton from "@/components/common/ExportButton";
import { schemeExportColumns } from "@/utils/exportColumns";

// Status color mapping
const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800 border-gray-200",
  active: "bg-green-100 text-green-800 border-green-200",
  suspended: "bg-yellow-100 text-yellow-800 border-yellow-200",
  closed: "bg-red-100 text-red-800 border-red-200",
  completed: "bg-purple-100 text-purple-800 border-purple-200",
};

// Priority color mapping
const priorityColors: Record<string, string> = {
  low: "bg-gray-100 text-gray-800",
  medium: "bg-blue-100 text-blue-800",
  high: "bg-orange-100 text-orange-800",
  critical: "bg-red-100 text-red-800",
};

// Category icons mapping
const categoryIcons: Record<string, string> = {
  education: "🎓",
  healthcare: "🏥",
  housing: "🏠",
  livelihood: "💼",
  emergency_relief: "🚨",
  infrastructure: "🏗️",
  social_welfare: "🤝",
  other: "📋",
};

export default function Schemes() {
  const navigate = useNavigate();
  const { hasAnyPermission, hasPermission } = useRBAC();
  const [schemeList, setSchemeList] = useState<Scheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [selectedScheme, setSelectedScheme] = useState<Scheme | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [schemeToDelete, setSchemeToDelete] = useState<Scheme | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [schemeForDetails, setSchemeForDetails] = useState<Scheme | null>(null);
  const [timelineModalOpen, setTimelineModalOpen] = useState(false);
  const [stagesModalOpen, setStagesModalOpen] = useState(false);
  const [targetsModalOpen, setTargetsModalOpen] = useState(false);
  const [progressModalOpen, setProgressModalOpen] = useState(false);
  const [expandedSchemes, setExpandedSchemes] = useState<Set<string>>(new Set());

  const { exportCSV, exportPDF, printData, exporting } = useExport({
    apiCall: (params) => schemesApi.export(params),
    filenamePrefix: 'schemes',
    pdfTitle: 'Schemes Report',
    pdfColumns: schemeExportColumns,
  });

  // Check permissions
  const canViewSchemes = hasAnyPermission(['schemes.read.all', 'schemes.read.assigned']);
  const canCreateSchemes = hasPermission('schemes.create');
  const canUpdateSchemes = hasAnyPermission(['schemes.update.assigned', 'schemes.manage']);
  const canManageSchemes = hasPermission('schemes.manage');

  // Load schemes on component mount
  useEffect(() => {
    if (canViewSchemes) {
      loadSchemes();
    }
  }, [canViewSchemes]);

  if (!canViewSchemes) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
          <p className="text-muted-foreground">
            You don't have permission to view schemes.
          </p>
        </div>
      </div>
    );
  }

  const loadSchemes = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await schemesApi.getAll();
      
      if (response.success && response.data) {
        setSchemeList(response.data.schemes);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load schemes');
      toast({
        title: "Error",
        description: "Failed to load schemes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };



  const formatCurrency = (amount: number) => {
    return `₹${(amount / 100000).toFixed(1)}L`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const handleCreateScheme = () => {
    setSelectedScheme(null);
    setModalMode("create");
    setModalOpen(true);
  };

  const handleEditScheme = (scheme: Scheme) => {
    setSelectedScheme(scheme);
    setModalMode("edit");
    setModalOpen(true);
  };

  const handleDeleteScheme = (scheme: Scheme) => {
    setSchemeToDelete(scheme);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!schemeToDelete) return;

    try {
      setDeleting(true);
      const response = await schemesApi.delete(schemeToDelete.id);
      
      if (response.success) {
        toast({
          title: "Success",
          description: "Scheme deleted successfully",
        });
        loadSchemes(); // Reload the list
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete scheme",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setSchemeToDelete(null);
    }
  };

  const handleModalSuccess = () => {
    loadSchemes(); // Reload the list after create/edit
  };

  const toggleSchemeExpansion = (schemeId: string) => {
    const newExpanded = new Set(expandedSchemes);
    if (newExpanded.has(schemeId)) {
      newExpanded.delete(schemeId);
    } else {
      newExpanded.add(schemeId);
    }
    setExpandedSchemes(newExpanded);
  };

  const handleViewDetails = (scheme: Scheme) => {
    setSchemeForDetails(scheme);
    setDetailsModalOpen(true);
  };

  const handleConfigureTimeline = (scheme: Scheme) => {
    // Open timeline configuration modal
    setSelectedScheme(scheme);
    setTimelineModalOpen(true);
  };

  const handleConfigureStages = (scheme: Scheme) => {
    // Open stages configuration modal
    setSelectedScheme(scheme);
    setStagesModalOpen(true);
  };

  const handleConfigureTargets = (scheme: Scheme) => {
    setSelectedScheme(scheme);
    setTargetsModalOpen(true);
  };

  const handleViewProgress = (scheme: Scheme) => {
    setSelectedScheme(scheme);
    setProgressModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold">Schemes</h1>
          <p className="text-muted-foreground mt-1">Manage welfare schemes and programs</p>
        </div>
        <div className="flex gap-2">
          <ExportButton
            onExportCSV={() => exportCSV()}
            onExportPDF={() => exportPDF()}
            onPrint={() => printData()}
            exporting={exporting}
          />
          {canCreateSchemes && (
            <Button onClick={handleCreateScheme} className="bg-gradient-primary shadow-glow">
              <Plus className="mr-2 h-4 w-4" />
              New Scheme
            </Button>
          )}
        </div>
      </div>



      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading schemes...</span>
        </div>
      ) : error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : schemeList.length === 0 ? (
        <Card className="p-12 text-center">
          <CardContent>
            <p className="text-muted-foreground">No schemes found. Create your first scheme to get started.</p>
            <Button onClick={handleCreateScheme} className="mt-4 bg-gradient-primary shadow-glow">
              <Plus className="mr-2 h-4 w-4" />
              Create First Scheme
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {schemeList.map((scheme) => {
            const isExpanded = expandedSchemes.has(scheme.id);
            return (
              <Card key={scheme.id} className="overflow-hidden hover:shadow-elegant transition-shadow">
                <Collapsible open={isExpanded} onOpenChange={() => toggleSchemeExpansion(scheme.id)}>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{categoryIcons[scheme.category] || categoryIcons.other}</span>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <CardTitle className="text-xl">{scheme.name}</CardTitle>
                                {isExpanded ? (
                                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">{scheme.description}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className="text-xs">
                              {scheme.code}
                            </Badge>
                            <Badge variant="outline" className="text-xs capitalize">
                              {scheme.category.replace('_', ' ')}
                            </Badge>
                            <Badge className={priorityColors[scheme.priority]} variant="outline">
                              {scheme.priority}
                            </Badge>
                          </div>
                          
                          {/* Quick Stats - Always Visible */}
                          <div className="grid gap-3 grid-cols-2 md:grid-cols-4 mt-3">
                            <div className="flex items-center gap-2">
                              <IndianRupee className="h-4 w-4 text-green-600" />
                              <div>
                                <p className="text-xs text-muted-foreground">Budget</p>
                                <p className="text-sm font-medium">{formatCurrency(scheme.budget.total)}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4 text-blue-600" />
                              <div>
                                <p className="text-xs text-muted-foreground">Beneficiaries</p>
                                <p className="text-sm font-medium">{scheme.statistics.totalBeneficiaries.toLocaleString()}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Target className="h-4 w-4 text-purple-600" />
                              <div>
                                <p className="text-xs text-muted-foreground">Applications</p>
                                <p className="text-sm font-medium">{scheme.statistics.totalApplications}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-orange-600" />
                              <div>
                                <p className="text-xs text-muted-foreground">Days Left</p>
                                <p className="text-sm font-medium">{scheme.daysRemainingForApplication}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                        <Badge className={statusColors[scheme.status] || statusColors.draft}>
                          {scheme.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent>
                    <CardContent className="space-y-6 pt-0">
                      {/* Detailed Statistics */}
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="p-3 bg-blue-50 rounded-lg">
                          <h4 className="font-medium text-blue-800 mb-2">Application Statistics</h4>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-blue-700">Total:</span>
                              <span className="font-medium">{scheme.statistics.totalApplications}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-green-700">Approved:</span>
                              <span className="font-medium">{scheme.statistics.approvedApplications}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-yellow-700">Pending:</span>
                              <span className="font-medium">{scheme.statistics.pendingApplications}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-red-700">Rejected:</span>
                              <span className="font-medium">{scheme.statistics.rejectedApplications}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="p-3 bg-green-50 rounded-lg">
                          <h4 className="font-medium text-green-800 mb-2">Budget Details</h4>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-green-700">Total:</span>
                              <span className="font-medium">{formatCurrency(scheme.budget.total)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-blue-700">Allocated:</span>
                              <span className="font-medium">{formatCurrency(scheme.budget.allocated)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-orange-700">Spent:</span>
                              <span className="font-medium">{formatCurrency(scheme.budget.spent)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-purple-700">Remaining:</span>
                              <span className="font-medium">{formatCurrency(scheme.remainingBudget)}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="p-3 bg-purple-50 rounded-lg">
                          <h4 className="font-medium text-purple-800 mb-2">Performance Metrics</h4>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-purple-700">Success Rate:</span>
                              <span className="font-medium">{scheme.successRate}%</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-blue-700">Budget Utilization:</span>
                              <span className="font-medium">{scheme.budgetUtilization}%</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-green-700">Total Beneficiaries:</span>
                              <span className="font-medium">{scheme.statistics.totalBeneficiaries.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-orange-700">Amount Disbursed:</span>
                              <span className="font-medium">{formatCurrency(scheme.statistics.totalAmountDisbursed)}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Progress Indicators */}
                      <div className="grid gap-4 md:grid-cols-2">
                        {/* Budget Utilization */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Budget Utilization</span>
                            <span className="font-medium">{scheme.budgetUtilization}%</span>
                          </div>
                          <Progress value={scheme.budgetUtilization} className="h-2" />
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Spent: {formatCurrency(scheme.budget.spent)}</span>
                            <span>Remaining: {formatCurrency(scheme.remainingBudget)}</span>
                          </div>
                        </div>

                        {/* Application Success Rate */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Success Rate</span>
                            <span className="font-medium">{scheme.successRate}%</span>
                          </div>
                          <Progress value={scheme.successRate} className="h-2" />
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Approved: {scheme.statistics.approvedApplications}</span>
                            <span>Pending: {scheme.statistics.pendingApplications}</span>
                          </div>
                        </div>
                      </div>

                      {/* Benefits & Eligibility */}
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="p-3 bg-green-50 rounded-lg">
                          <h4 className="font-medium text-green-800 mb-1">Benefits</h4>
                          <p className="text-sm text-green-700">
                            {scheme.benefits.type === 'cash' && scheme.benefits.amount 
                              ? `₹${scheme.benefits.amount.toLocaleString()} ${scheme.benefits.frequency.replace('_', ' ')}`
                              : scheme.benefits.description
                            }
                          </p>
                        </div>
                        <div className="p-3 bg-blue-50 rounded-lg">
                          <h4 className="font-medium text-blue-800 mb-1">Eligibility</h4>
                          <p className="text-sm text-blue-700">
                            {scheme.eligibility.ageRange?.min && scheme.eligibility.ageRange?.max
                              ? `Age: ${scheme.eligibility.ageRange.min}-${scheme.eligibility.ageRange.max} years`
                              : 'Age: Any'
                            }
                            {scheme.eligibility.incomeLimit && `, Income: ≤₹${scheme.eligibility.incomeLimit.toLocaleString()}`}
                          </p>
                        </div>
                      </div>

                      {/* Application Timeline */}
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-gray-600" />
                          <div>
                            <p className="text-sm font-medium">Application Period</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(scheme.applicationSettings.startDate)} - {formatDate(scheme.applicationSettings.endDate)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">Max Applications</p>
                          <p className="text-xs text-muted-foreground">{scheme.applicationSettings.maxApplications}</p>
                        </div>
                      </div>

                      {/* Project & Coverage */}
                      <div className="flex items-center justify-between text-sm">
                        <div>
                          <span className="text-muted-foreground">Project: </span>
                          <span className="font-medium">{scheme.project.name}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Coverage: </span>
                          <span className="font-medium">
                            {scheme.targetRegions && scheme.targetRegions.length > 0 
                              ? `${scheme.targetRegions.length} regions` 
                              : "All regions"
                            }
                          </span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-wrap gap-2 pt-2 border-t">
                        <Button variant="outline" size="sm" onClick={() => handleViewDetails(scheme)}>
                          <Eye className="mr-1 h-3 w-3" />
                          View Details
                        </Button>
                        {canUpdateSchemes && (
                          <Button variant="outline" size="sm" onClick={() => handleEditScheme(scheme)}>
                            <Edit className="mr-1 h-3 w-3" />
                            Edit
                          </Button>
                        )}
                        {canManageSchemes && (
                          <>
                            <Button variant="outline" size="sm" onClick={() => navigate(`/form-builder?schemeId=${scheme.id}&schemeName=${encodeURIComponent(scheme.name)}`)}>
                              <FileText className="mr-1 h-3 w-3" />
                              Configure Form
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleConfigureTimeline(scheme)}>
                              <GitBranch className="mr-1 h-3 w-3" />
                              Timeline
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleConfigureStages(scheme)}>
                              <Settings className="mr-1 h-3 w-3" />
                              Stages
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleConfigureTargets(scheme)}>
                              <Target className="mr-1 h-3 w-3" />
                              Targets
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleViewProgress(scheme)}>
                              <BarChart3 className="mr-1 h-3 w-3" />
                              Progress
                            </Button>
                          </>
                        )}
                        <Button variant="outline" size="sm" onClick={() => navigate(`/applications?scheme=${scheme.id}`)}>
                          Applications
                        </Button>
                        {canManageSchemes && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                            onClick={() => handleDeleteScheme(scheme)}
                          >
                            <Trash2 className="mr-1 h-3 w-3" />
                            Delete
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}
        </div>
      )}

      {/* Scheme Modal */}
      <SchemeModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        scheme={selectedScheme}
        mode={modalMode}
        onSuccess={handleModalSuccess}
      />

      {/* Scheme Details Modal */}
      <SchemeDetailsModal
        open={detailsModalOpen}
        onOpenChange={setDetailsModalOpen}
        scheme={schemeForDetails}
      />

      {/* Timeline Configuration Modal */}
      <TimelineConfigModal
        open={timelineModalOpen}
        onOpenChange={setTimelineModalOpen}
        scheme={selectedScheme}
        onSuccess={handleModalSuccess}
      />

      {/* Stages Configuration Modal */}
      <StagesConfigModal
        open={stagesModalOpen}
        onOpenChange={setStagesModalOpen}
        scheme={selectedScheme}
        onSuccess={handleModalSuccess}
      />

      {/* Scheme Targets Modal */}
      <SchemeTargetsModal
        open={targetsModalOpen}
        onOpenChange={setTargetsModalOpen}
        scheme={selectedScheme}
        onSuccess={handleModalSuccess}
      />

      {/* Scheme Target Progress Modal */}
      <SchemeTargetProgressModal
        open={progressModalOpen}
        onOpenChange={setProgressModalOpen}
        scheme={selectedScheme}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Scheme</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{schemeToDelete?.name}"? This action cannot be undone.
              {schemeToDelete?.statistics.totalApplications > 0 && (
                <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-yellow-800">
                  Warning: This scheme has {schemeToDelete.statistics.totalApplications} applications.
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Scheme
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}