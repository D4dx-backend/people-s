import { useState, useEffect } from "react";
import { Plus, Calendar, IndianRupee, Target, Loader2, AlertCircle, FolderKanban, Activity, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProjectModal } from "@/components/modals/ProjectModal";
import { ProjectDetailsModal } from "@/components/modals/ProjectDetailsModal";
import { DeleteConfirmModal } from "@/components/modals/DeleteConfirmModal";
import { ProjectStatusUpdatesModal } from "@/components/modals/ProjectStatusUpdatesModal";
import { ProjectStagesConfigModal } from "@/components/modals/ProjectStagesConfigModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { projects as projectsApi, type Project } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { useRBAC } from "@/hooks/useRBAC";
import { useExport } from "@/hooks/useExport";
import ExportButton from "@/components/common/ExportButton";
import { projectExportColumns } from "@/utils/exportColumns";

// Project category images mapping
const categoryImages: Record<string, string> = {
  education: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&q=80",
  healthcare: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&q=80",
  housing: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80",
  livelihood: "https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=800&q=80",
  emergency_relief: "https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?w=800&q=80",
  infrastructure: "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=800&q=80",
  social_welfare: "https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=800&q=80",
  other: "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=800&q=80",
};

// Status color mapping
const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800 border-gray-200",
  approved: "bg-blue-100 text-blue-800 border-blue-200",
  active: "bg-green-100 text-green-800 border-green-200",
  on_hold: "bg-yellow-100 text-yellow-800 border-yellow-200",
  completed: "bg-purple-100 text-purple-800 border-purple-200",
  cancelled: "bg-red-100 text-red-800 border-red-200",
};

export default function Projects() {
  const { hasAnyPermission, hasPermission } = useRBAC();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showStatusUpdatesModal, setShowStatusUpdatesModal] = useState(false);
  const [showConfigureStagesModal, setShowConfigureStagesModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectList, setProjectList] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { exportCSV, exportPDF, printData, exporting } = useExport({
    apiCall: (params) => projectsApi.export(params),
    filenamePrefix: 'projects',
    pdfTitle: 'Projects Report',
    pdfColumns: projectExportColumns,
  });

  // Check permissions
  const canViewProjects = hasAnyPermission(['projects.read.all', 'projects.read.assigned']);
  const canCreateProjects = hasPermission('projects.create');
  const canUpdateProjects = hasAnyPermission(['projects.update.all', 'projects.update.assigned']);
  const canManageProjects = hasPermission('projects.manage');

  // Load projects on component mount
  useEffect(() => {
    if (canViewProjects) {
      loadProjects();
    }
  }, [canViewProjects]);

  if (!canViewProjects) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <FolderKanban className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
          <p className="text-muted-foreground">
            You don't have permission to view projects.
          </p>
        </div>
      </div>
    );
  }

  const loadProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await projectsApi.getAll();
      
      if (response.success && response.data) {
        setProjectList(response.data.projects);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load projects');
      toast({
        title: "Error",
        description: "Failed to load projects",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (project: Project) => {
    setSelectedProject(project);
    setShowDetailsModal(true);
  };

  const handleEdit = (project: Project) => {
    setSelectedProject(project);
    setShowEditModal(true);
  };

  const handleDeleteClick = (project: Project) => {
    setSelectedProject(project);
    setShowDeleteModal(true);
  };

  const handleStatusUpdates = (project: Project) => {
    setSelectedProject(project);
    setShowStatusUpdatesModal(true);
  };

  const handleConfigureStages = (project: Project) => {
    setSelectedProject(project);
    setShowConfigureStagesModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (selectedProject) {
      try {
        await projectsApi.delete(selectedProject.id);
        setProjectList(projectList.filter(p => p.id !== selectedProject.id));
        setShowDeleteModal(false);
        setSelectedProject(null);
        toast({
          title: "Success",
          description: "Project deleted successfully",
        });
      } catch (err: any) {
        toast({
          title: "Error",
          description: err.message || "Failed to delete project",
          variant: "destructive",
        });
      }
    }
  };

  const handleSave = () => {
    setShowCreateModal(false);
    setShowEditModal(false);
    setShowDetailsModal(false);
    setSelectedProject(null);
    loadProjects(); // Reload projects after save
  };
  
  return (
    <div className="space-y-6">
      <ProjectModal 
        open={showCreateModal} 
        onOpenChange={(open) => {
          setShowCreateModal(open);
          if (!open) handleSave();
        }}
        mode="create"
      />
      <ProjectModal 
        open={showEditModal} 
        onOpenChange={(open) => {
          setShowEditModal(open);
          if (!open) handleSave();
        }}
        project={selectedProject}
        mode="edit"
      />
      <ProjectDetailsModal
        open={showDetailsModal}
        onOpenChange={setShowDetailsModal}
        project={selectedProject}
      />
      <DeleteConfirmModal
        open={showDeleteModal}
        onOpenChange={setShowDeleteModal}
        onConfirm={handleDeleteConfirm}
        title="Delete Project"
        description="This will permanently delete this project and all associated data. This action cannot be undone."
        itemName={selectedProject?.title}
      />
      <ProjectStatusUpdatesModal
        open={showStatusUpdatesModal}
        onOpenChange={setShowStatusUpdatesModal}
        project={selectedProject}
        onSuccess={handleSave}
      />
      <ProjectStagesConfigModal
        open={showConfigureStagesModal}
        onOpenChange={setShowConfigureStagesModal}
        project={selectedProject}
        onSuccess={handleSave}
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold">Projects</h1>
          <p className="text-muted-foreground mt-1">Manage and track all NGO projects</p>
        </div>
        <div className="flex gap-2">
          <ExportButton
            onExportCSV={() => exportCSV()}
            onExportPDF={() => exportPDF()}
            onPrint={() => printData()}
            exporting={exporting}
          />
          <Button className="bg-gradient-primary shadow-glow" onClick={() => setShowCreateModal(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Project
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading projects...</span>
        </div>
      ) : error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : projectList.length === 0 ? (
        <Card className="p-12 text-center">
          <CardContent>
            <p className="text-muted-foreground">No projects found. Create your first project to get started.</p>
            <Button 
              className="mt-4 bg-gradient-primary shadow-glow" 
              onClick={() => setShowCreateModal(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create First Project
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {projectList.map((project) => {
            const progress = project.budgetUtilization || 0;
          
            return (
              <Card key={project.id} className="overflow-hidden hover:shadow-elegant transition-shadow">
                <div className="md:flex">
                  <div className="md:w-1/3">
                    <img
                      src={categoryImages[project.category] || categoryImages.other}
                      alt={project.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="md:w-2/3">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-2xl">{project.name}</CardTitle>
                          <p className="text-sm text-muted-foreground">{project.description}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className="text-xs">
                              {project.code}
                            </Badge>
                            <Badge variant="outline" className="text-xs capitalize">
                              {project.category.replace('_', ' ')}
                            </Badge>
                            <Badge variant="outline" className="text-xs capitalize">
                              {project.priority}
                            </Badge>
                          </div>
                        </div>
                        <Badge className={statusColors[project.status] || statusColors.draft}>
                          {project.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-xs text-muted-foreground">Duration</p>
                            <p className="text-sm font-medium">
                              {new Date(project.startDate).toLocaleDateString()} - {new Date(project.endDate).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <IndianRupee className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-xs text-muted-foreground">Budget</p>
                            <p className="text-sm font-medium">₹{(project.budget.total / 100000).toFixed(1)}L</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Target className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-xs text-muted-foreground">Beneficiaries</p>
                            <p className="text-sm font-medium">{(project.targetBeneficiaries?.actual || 0).toLocaleString()}</p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Budget Utilization</span>
                          <span className="font-medium">{progress}%</span>
                        </div>
                        <Progress value={progress} className="h-2" />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Spent: ₹{((project.budget?.spent || 0) / 100000).toFixed(1)}L</span>
                          <span>Remaining: ₹{((project.remainingBudget || 0) / 100000).toFixed(1)}L</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="font-medium">{project.progress?.percentage || 0}%</span>
                        </div>
                        <Progress value={project.progress?.percentage || 0} className="h-2" />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Coordinator: {project.coordinator?.name || 'Not assigned'}</span>
                          <span>Days Remaining: {project.daysRemaining}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleViewDetails(project)}>View Details</Button>
                        <Button variant="outline" size="sm" onClick={() => handleEdit(project)}>Edit</Button>
                        <Button variant="outline" size="sm" onClick={() => handleStatusUpdates(project)}>
                          <Activity className="mr-1 h-3 w-3" />
                          Status Updates
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleConfigureStages(project)}>
                          <Settings className="mr-1 h-3 w-3" />
                          Configure
                        </Button>
                        <Button variant="outline" size="sm" className="text-destructive" onClick={() => handleDeleteClick(project)}>Delete</Button>
                      </div>
                    </CardContent>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
