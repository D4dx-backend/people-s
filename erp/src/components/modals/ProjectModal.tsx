import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, Loader2, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { type Project, projects as projectsApi } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

interface ProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: Project | null;
  mode: "create" | "edit";
}

export function ProjectModal({ open, onOpenChange, project, mode }: ProjectModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    category: "",
    priority: "medium",
    budget: "",
    status: "draft",
  });
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize form data when project changes
  useEffect(() => {
    if (project && mode === "edit") {
      setFormData({
        name: project.name || "",
        code: project.code || "",
        description: project.description || "",
        category: project.category || "",
        priority: project.priority || "medium",
        budget: project.budget?.total?.toString() || "",
        status: project.status || "draft",
      });
      
      if (project.startDate) {
        setStartDate(new Date(project.startDate));
      }
      if (project.endDate) {
        setEndDate(new Date(project.endDate));
      }
    } else {
      // Reset form for create mode
      setFormData({
        name: "",
        code: "",
        description: "",
        category: "",
        priority: "medium",
        budget: "",
        status: "draft",
      });
      setStartDate(undefined);
      setEndDate(undefined);
    }
  }, [project, mode, open]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);

      // Validate required fields
      if (!formData.name || !formData.code || !formData.description || !formData.category) {
        toast({
          title: "Validation Error",
          description: "Please fill in all required fields",
          variant: "destructive",
        });
        return;
      }

      if (!startDate || !endDate) {
        toast({
          title: "Validation Error",
          description: "Please select start and end dates",
          variant: "destructive",
        });
        return;
      }

      const projectData = {
        name: formData.name,
        code: formData.code.toUpperCase().replace(/\s+/g, "_"),
        description: formData.description,
        category: formData.category,
        priority: formData.priority,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        budget: {
          total: parseFloat(formData.budget) || 0,
          allocated: parseFloat(formData.budget) || 0,
          spent: project?.budget?.spent || 0,
          currency: "INR",
        },
      };

      // Include status for edit mode
      if (mode === "edit" && formData.status) {
        (projectData as any).status = formData.status;
      }

      if (mode === "create") {
        const response = await projectsApi.create(projectData as any);
        if (response.success) {
          toast({
            title: "Success",
            description: "Project created successfully",
          });
          onOpenChange(false);
        } else {
          throw new Error(response.message || "Failed to create project");
        }
      } else if (mode === "edit" && project) {
        const response = await projectsApi.update(project.id, projectData as any);
        if (response.success) {
          toast({
            title: "Success",
            description: "Project updated successfully",
          });
          onOpenChange(false);
        } else {
          throw new Error(response.message || "Failed to update project");
        }
      }
    } catch (error: any) {
      console.error('Project save error:', error);
      let errorMessage = error.message || `Failed to ${mode === "create" ? "create" : "update"} project`;
      
      // Show detailed validation errors if available
      if (error.validationErrors && Array.isArray(error.validationErrors)) {
        const validationMessages = error.validationErrors.map((err: any) => 
          `${err.field}: ${err.message}`
        ).join('\n');
        errorMessage = `Validation failed:\n${validationMessages}`;
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 2;

  const stepLabels = [
    "Basic Information",
    "Schedule & Budget",
  ];

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        if (!formData.name || !formData.code || !formData.description || !formData.category) {
          toast({ title: "Validation Error", description: "Please fill in all required fields", variant: "destructive" });
          return false;
        }
        return true;
      case 2:
        if (!startDate || !endDate) {
          toast({ title: "Validation Error", description: "Please select start and end dates", variant: "destructive" });
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, totalSteps));
    }
  };

  const handlePrev = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  // Reset step when modal opens/closes
  useEffect(() => {
    if (open) {
      setCurrentStep(1);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" style={{ display: "flex" }}>
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>{mode === "create" ? "Create New Project" : "Edit Project"}</DialogTitle>
          {/* Step Indicator */}
          <div className="flex items-center justify-center gap-2 pt-4">
            {stepLabels.map((label, index) => {
              const stepNum = index + 1;
              const isActive = currentStep === stepNum;
              const isCompleted = currentStep > stepNum;
              return (
                <div key={stepNum} className="flex items-center">
                  <button
                    onClick={() => {
                      if (isCompleted) setCurrentStep(stepNum);
                    }}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
                      isActive && "bg-primary text-primary-foreground",
                      isCompleted && "bg-primary/20 text-primary cursor-pointer hover:bg-primary/30",
                      !isActive && !isCompleted && "bg-muted text-muted-foreground"
                    )}
                  >
                    <span className={cn(
                      "flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold",
                      isActive && "bg-primary-foreground text-primary",
                      isCompleted && "bg-primary text-primary-foreground",
                      !isActive && !isCompleted && "bg-muted-foreground/30 text-muted-foreground"
                    )}>
                      {isCompleted ? <Check className="h-3 w-3" /> : stepNum}
                    </span>
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                  {index < stepLabels.length - 1 && (
                    <div className={cn("w-8 h-0.5 mx-1", isCompleted ? "bg-primary" : "bg-muted")} />
                  )}
                </div>
              );
            })}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4 px-1">
          {/* Step 1: Basic Information */}
          {currentStep === 1 && (
          <>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Project Title *</Label>
              <Input 
                placeholder="Enter project title" 
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Project Code *</Label>
              <Input 
                placeholder="e.g., PROJ-2025-001" 
                value={formData.code}
                onChange={(e) => handleInputChange("code", e.target.value)}
                className="uppercase"
              />
              <p className="text-xs text-muted-foreground">
                Uppercase letters, numbers, hyphens, and underscores only
              </p>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>Description *</Label>
            <Textarea 
              placeholder="Project description" 
              rows={3} 
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Category *</Label>
              <Select value={formData.category} onValueChange={(value) => handleInputChange("category", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="education">Education</SelectItem>
                  <SelectItem value="healthcare">Healthcare</SelectItem>
                  <SelectItem value="housing">Housing</SelectItem>
                  <SelectItem value="livelihood">Livelihood</SelectItem>
                  <SelectItem value="emergency_relief">Emergency Relief</SelectItem>
                  <SelectItem value="infrastructure">Infrastructure</SelectItem>
                  <SelectItem value="social_welfare">Social Welfare</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={formData.priority} onValueChange={(value) => handleInputChange("priority", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>

          </div>
          </>
          )}

          {/* Step 2: Schedule & Budget */}
          {currentStep === 2 && (
          <>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Start Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus className="pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>End Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !endDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus className="pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Budget (₹)</Label>
              <Input 
                type="number" 
                placeholder="0.00" 
                value={formData.budget}
                onChange={(e) => handleInputChange("budget", e.target.value)}
              />
              {project && (
                <div className="text-sm text-muted-foreground">
                  Current: ₹{(project.budget.total / 100000).toFixed(1)}L | 
                  Spent: ₹{(project.budget.spent / 100000).toFixed(1)}L | 
                  Remaining: ₹{(project.remainingBudget / 100000).toFixed(1)}L
                </div>
              )}
            </div>
          </div>

          {project && mode === "edit" && (
            <div className="space-y-2">
              <Label>Current Status & Progress</Label>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-sm text-muted-foreground">Status</Label>
                  <Select value={formData.status} onValueChange={(value) => handleInputChange("status", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="on_hold">On Hold</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="p-3 border rounded-lg">
                  <p className="text-sm text-muted-foreground">Progress</p>
                  <p className="font-medium">{project.progress.percentage}%</p>
                </div>
              </div>
            </div>
          )}
          </>
          )}
        </div>

        <DialogFooter className="flex-shrink-0 flex items-center justify-between sm:justify-between border-t pt-4">
          <div className="text-sm text-muted-foreground">
            Step {currentStep} of {totalSteps}
          </div>
          <div className="flex gap-2">
            {currentStep > 1 && (
              <Button variant="outline" onClick={handlePrev} disabled={isSubmitting}>
                <ChevronLeft className="mr-1 h-4 w-4" />
                Previous
              </Button>
            )}
            {currentStep === 1 && (
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                Cancel
              </Button>
            )}
            {currentStep < totalSteps ? (
              <Button onClick={handleNext} className="bg-gradient-primary">
                Next
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button 
                className="bg-gradient-primary" 
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === "create" ? "Create Project" : "Save Changes"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
