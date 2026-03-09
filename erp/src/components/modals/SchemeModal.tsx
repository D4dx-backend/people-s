import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import VoiceToTextButton from '@/components/ui/VoiceToTextButton';
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { CalendarIcon, Loader2, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { schemes, projects, type Scheme } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

interface SchemeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scheme?: Scheme | null;
  mode: "create" | "edit";
  onSuccess?: () => void;
}

export function SchemeModal({ open, onOpenChange, scheme, mode, onSuccess }: SchemeModalProps) {
  const [loading, setLoading] = useState(false);
  const [availableProjects, setAvailableProjects] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    category: "",
    priority: "medium",
    status: "draft",
    project: "",
    budgetTotal: "",
    benefitType: "",
    benefitAmount: "",
    benefitFrequency: "one_time",
    benefitDescription: "",
    maxApplications: "1000",
    maxBeneficiaries: "",
    requireFieldVerification: false,
    requiresInterview: false,
    allowMultipleApplications: false,
    // Eligibility
    minAge: "",
    maxAge: "",
    gender: "any",
    incomeLimit: "",
    educationLevel: "any",
    employmentStatus: "any",
    // Renewal Settings
    isRenewable: false,
    renewalPeriodDays: "365",
    maxRenewals: "0",
    autoNotifyBeforeDays: "30",
    requiresReapproval: true,
  });
  
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();

  // Load available projects
  useEffect(() => {
    if (open) {
      loadAvailableProjects();
    }
  }, [open]);

  // Initialize form data when scheme changes
  useEffect(() => {
    if (scheme && mode === "edit") {
      setFormData({
        name: scheme.name || "",
        code: scheme.code || "",
        description: scheme.description || "",
        category: scheme.category || "",
        priority: scheme.priority || "medium",
        status: scheme.status || "draft",
        project: scheme.project?.id || "",
        budgetTotal: scheme.budget?.total?.toString() || "",
        benefitType: scheme.benefits?.type || "",
        benefitAmount: scheme.benefits?.amount?.toString() || "",
        benefitFrequency: scheme.benefits?.frequency || "one_time",
        benefitDescription: scheme.benefits?.description || "",
        maxApplications: scheme.applicationSettings?.maxApplications?.toString() || "1000",
        maxBeneficiaries: scheme.applicationSettings?.maxBeneficiaries?.toString() || "",
        requireFieldVerification: scheme.applicationSettings?.requireFieldVerification || false,
        requiresInterview: scheme.applicationSettings?.requiresInterview || false,
        allowMultipleApplications: scheme.applicationSettings?.allowMultipleApplications || false,
        minAge: scheme.eligibility?.ageRange?.min?.toString() || "",
        maxAge: scheme.eligibility?.ageRange?.max?.toString() || "",
        gender: scheme.eligibility?.gender || "any",
        incomeLimit: scheme.eligibility?.incomeLimit?.toString() || "",
        educationLevel: scheme.eligibility?.educationLevel || "any",
        employmentStatus: scheme.eligibility?.employmentStatus || "any",
        // Renewal Settings
        isRenewable: scheme.renewalSettings?.isRenewable || false,
        renewalPeriodDays: scheme.renewalSettings?.renewalPeriodDays?.toString() || "365",
        maxRenewals: scheme.renewalSettings?.maxRenewals?.toString() || "0",
        autoNotifyBeforeDays: scheme.renewalSettings?.autoNotifyBeforeDays?.toString() || "30",
        requiresReapproval: scheme.renewalSettings?.requiresReapproval !== false,
      });
      
      if (scheme.applicationSettings?.startDate) {
        setStartDate(new Date(scheme.applicationSettings.startDate));
      }
      if (scheme.applicationSettings?.endDate) {
        setEndDate(new Date(scheme.applicationSettings.endDate));
      }
    } else {
      // Reset form for create mode
      setFormData({
        name: "",
        code: "",
        description: "",
        category: "",
        priority: "medium",
        status: "draft",
        project: "",
        budgetTotal: "",
        benefitType: "",
        benefitAmount: "",
        benefitFrequency: "one_time",
        benefitDescription: "",
        maxApplications: "1000",
        maxBeneficiaries: "",
        requireFieldVerification: false,
        requiresInterview: false,
        allowMultipleApplications: false,
        minAge: "",
        maxAge: "",
        gender: "any",
        incomeLimit: "",
        educationLevel: "any",
        employmentStatus: "any",
        // Renewal Settings
        isRenewable: false,
        renewalPeriodDays: "365",
        maxRenewals: "0",
        autoNotifyBeforeDays: "30",
        requiresReapproval: true,
      });
      setStartDate(undefined);
      setEndDate(undefined);
    }
  }, [scheme, mode, open]);

  const loadAvailableProjects = async () => {
    try {
      const response = await projects.getAll({ limit: 100 });
      if (response.success) {
        setAvailableProjects(response.data?.projects || []);
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  };



  const handleInputChange = (field: string, value: string | boolean | string[]) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };



  const handleSubmit = async () => {
    try {
      setLoading(true);

      // Validate required fields
      if (!formData.name || !formData.code || !formData.description || !formData.category || 
          !formData.project || !formData.budgetTotal || !formData.benefitType || 
          !startDate || !endDate) {
        toast({
          title: "Validation Error",
          description: "Please fill in all required fields",
          variant: "destructive",
        });
        return;
      }

      const schemeData = {
        name: formData.name,
        code: formData.code.toUpperCase(),
        description: formData.description,
        category: formData.category,
        priority: formData.priority,
        status: formData.status,
        project: formData.project,
        budget: {
          total: parseInt(formData.budgetTotal),
          currency: 'INR'
        },
        benefits: {
          type: formData.benefitType,
          amount: formData.benefitAmount ? parseInt(formData.benefitAmount) : undefined,
          frequency: formData.benefitFrequency,
          description: formData.benefitDescription
        },
        applicationSettings: {
          startDate: startDate?.toISOString(),
          endDate: endDate?.toISOString(),
          maxApplications: parseInt(formData.maxApplications),
          maxBeneficiaries: formData.maxBeneficiaries ? parseInt(formData.maxBeneficiaries) : undefined,
          requireFieldVerification: formData.requireFieldVerification,
          requiresInterview: formData.requiresInterview,
          allowMultipleApplications: formData.allowMultipleApplications
        },
        eligibility: {
          ageRange: {
            min: formData.minAge ? parseInt(formData.minAge) : undefined,
            max: formData.maxAge ? parseInt(formData.maxAge) : undefined
          },
          gender: formData.gender,
          incomeLimit: formData.incomeLimit ? parseInt(formData.incomeLimit) : undefined,
          educationLevel: formData.educationLevel === "any" ? undefined : formData.educationLevel,
          employmentStatus: formData.employmentStatus === "any" ? undefined : formData.employmentStatus,
          documents: []
        },
        renewalSettings: {
          isRenewable: formData.isRenewable,
          renewalPeriodDays: parseInt(formData.renewalPeriodDays) || 365,
          maxRenewals: parseInt(formData.maxRenewals) || 0,
          autoNotifyBeforeDays: parseInt(formData.autoNotifyBeforeDays) || 30,
          requiresReapproval: formData.requiresReapproval
        }
      };

      let response;
      if (mode === "create") {
        response = await schemes.create(schemeData);
      } else {
        response = await schemes.update(scheme!.id, schemeData);
      }

      if (response.success) {
        toast({
          title: "Success",
          description: `Scheme ${mode === "create" ? "created" : "updated"} successfully`,
        });
        onOpenChange(false);
        onSuccess?.();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || `Failed to ${mode} scheme`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 3;

  const stepLabels = [
    "Basic Information",
    "Budget & Settings",
    "Eligibility & Renewal",
  ];

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        if (!formData.name || !formData.code || !formData.description || !formData.category || !formData.project) {
          toast({ title: "Validation Error", description: "Please fill in all required fields in Basic Information", variant: "destructive" });
          return false;
        }
        return true;
      case 2:
        if (!formData.budgetTotal || !formData.benefitType || !startDate || !endDate) {
          toast({ title: "Validation Error", description: "Please fill in budget, benefit type, and application dates", variant: "destructive" });
          return false;
        }
        return true;
      case 3:
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" style={{ display: "flex" }}>
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>{mode === "create" ? "Create New Scheme" : "Edit Scheme"}</DialogTitle>
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
        
        <div className="flex-1 overflow-y-auto space-y-6 py-4 px-1">
          {/* Step 1: Basic Information */}
          {currentStep === 1 && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Basic Information</h3>
            
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Scheme Name *</Label>
                <Input 
                  placeholder="Enter scheme name" 
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Scheme Code *</Label>
                <Input 
                  placeholder="SCHEME_CODE" 
                  value={formData.code}
                  onChange={(e) => handleInputChange("code", e.target.value.toUpperCase())}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Description *</Label>
              <div className="relative">
                <Textarea 
                  placeholder="Scheme description" 
                  rows={3} 
                  value={formData.description}
                  onChange={(e) => handleInputChange("description", e.target.value)}
                  className="pr-12"
                />
                <div className="absolute right-2 top-2">
                  <VoiceToTextButton
                    onTranscript={(text) => handleInputChange("description", formData.description ? formData.description + ' ' + text : text)}
                    size="icon"
                    className="h-8 w-8"
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
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

              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(value) => handleInputChange("status", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Project *</Label>
                <Select value={formData.project} onValueChange={(value) => handleInputChange("project", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableProjects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          )}

          {/* Step 2: Budget & Benefits + Application Settings */}
          {currentStep === 2 && (
          <>
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Budget & Benefits</h3>
            
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Total Budget (₹) *</Label>
                <Input 
                  type="number" 
                  placeholder="0" 
                  value={formData.budgetTotal}
                  onChange={(e) => handleInputChange("budgetTotal", e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Benefit Type *</Label>
                <Select value={formData.benefitType} onValueChange={(value) => handleInputChange("benefitType", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select benefit type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="kind">Kind</SelectItem>
                    <SelectItem value="service">Service</SelectItem>
                    <SelectItem value="scholarship">Scholarship</SelectItem>
                    <SelectItem value="loan">Loan</SelectItem>
                    <SelectItem value="subsidy">Subsidy</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Benefit Amount (₹)</Label>
                <Input 
                  type="number" 
                  placeholder="0" 
                  value={formData.benefitAmount}
                  onChange={(e) => handleInputChange("benefitAmount", e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Frequency</Label>
                <Select value={formData.benefitFrequency} onValueChange={(value) => handleInputChange("benefitFrequency", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="one_time">One Time</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Benefit Description</Label>
              <div className="relative">
                <Textarea 
                  placeholder="Describe the benefits provided" 
                  rows={2} 
                  value={formData.benefitDescription}
                  onChange={(e) => handleInputChange("benefitDescription", e.target.value)}
                  className="pr-12"
                />
                <div className="absolute right-2 top-2">
                  <VoiceToTextButton
                    onTranscript={(text) => handleInputChange("benefitDescription", formData.benefitDescription ? formData.benefitDescription + ' ' + text : text)}
                    size="icon"
                    className="h-8 w-8"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium">Application Settings</h3>
            
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Application Start Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
              
              <div className="space-y-2">
                <Label>Application End Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !endDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Max Applications</Label>
                <Input 
                  type="number" 
                  placeholder="1000" 
                  value={formData.maxApplications}
                  onChange={(e) => handleInputChange("maxApplications", e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Max Beneficiaries</Label>
                <Input 
                  type="number" 
                  placeholder="Optional" 
                  value={formData.maxBeneficiaries}
                  onChange={(e) => handleInputChange("maxBeneficiaries", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Require Field Verification</Label>
                <Switch 
                  checked={formData.requireFieldVerification} 
                  onCheckedChange={(checked) => handleInputChange("requireFieldVerification", checked)}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label>Requires Interview</Label>
                <Switch 
                  checked={formData.requiresInterview} 
                  onCheckedChange={(checked) => handleInputChange("requiresInterview", checked)}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label>Allow Multiple Applications</Label>
                <Switch 
                  checked={formData.allowMultipleApplications} 
                  onCheckedChange={(checked) => handleInputChange("allowMultipleApplications", checked)}
                />
              </div>
            </div>
          </div>
          </>
          )}

          {/* Step 3: Eligibility & Renewal */}
          {currentStep === 3 && (
          <>
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Renewal Settings</h3>
            
            <div className="flex items-center justify-between">
              <div>
                <Label>Enable Renewal</Label>
                <p className="text-xs text-muted-foreground">Allow beneficiaries to renew their applications after the validity period</p>
              </div>
              <Switch 
                checked={formData.isRenewable} 
                onCheckedChange={(checked) => handleInputChange("isRenewable", checked)}
              />
            </div>

            {formData.isRenewable && (
              <>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Renewal Period (Days)</Label>
                    <Input 
                      type="number" 
                      placeholder="365" 
                      value={formData.renewalPeriodDays}
                      onChange={(e) => handleInputChange("renewalPeriodDays", e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Days after approval when renewal is due</p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Max Renewals</Label>
                    <Input 
                      type="number" 
                      placeholder="0 = Unlimited" 
                      value={formData.maxRenewals}
                      onChange={(e) => handleInputChange("maxRenewals", e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">0 = Unlimited renewals</p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Notify Before (Days)</Label>
                    <Input 
                      type="number" 
                      placeholder="30" 
                      value={formData.autoNotifyBeforeDays}
                      onChange={(e) => handleInputChange("autoNotifyBeforeDays", e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Days before expiry to send notification</p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Requires Re-approval</Label>
                    <p className="text-xs text-muted-foreground">If disabled, renewals are auto-approved</p>
                  </div>
                  <Switch 
                    checked={formData.requiresReapproval} 
                    onCheckedChange={(checked) => handleInputChange("requiresReapproval", checked)}
                  />
                </div>
              </>
            )}
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium">Eligibility Criteria</h3>
            
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label>Min Age</Label>
                <Input 
                  type="number" 
                  placeholder="0" 
                  value={formData.minAge}
                  onChange={(e) => handleInputChange("minAge", e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Max Age</Label>
                <Input 
                  type="number" 
                  placeholder="100" 
                  value={formData.maxAge}
                  onChange={(e) => handleInputChange("maxAge", e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Gender</Label>
                <Select value={formData.gender} onValueChange={(value) => handleInputChange("gender", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any</SelectItem>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Income Limit (₹)</Label>
                <Input 
                  type="number" 
                  placeholder="0" 
                  value={formData.incomeLimit}
                  onChange={(e) => handleInputChange("incomeLimit", e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Education Level</Label>
                <Select value={formData.educationLevel} onValueChange={(value) => handleInputChange("educationLevel", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select education level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any</SelectItem>
                    <SelectItem value="illiterate">Illiterate</SelectItem>
                    <SelectItem value="primary">Primary</SelectItem>
                    <SelectItem value="secondary">Secondary</SelectItem>
                    <SelectItem value="higher_secondary">Higher Secondary</SelectItem>
                    <SelectItem value="graduate">Graduate</SelectItem>
                    <SelectItem value="post_graduate">Post Graduate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Employment Status</Label>
                <Select value={formData.employmentStatus} onValueChange={(value) => handleInputChange("employmentStatus", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select employment status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any</SelectItem>
                    <SelectItem value="unemployed">Unemployed</SelectItem>
                    <SelectItem value="employed">Employed</SelectItem>
                    <SelectItem value="self_employed">Self Employed</SelectItem>
                    <SelectItem value="retired">Retired</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          </>
          )}
        </div>

        <DialogFooter className="flex-shrink-0 flex items-center justify-between sm:justify-between border-t pt-4">
          <div className="text-sm text-muted-foreground">
            Step {currentStep} of {totalSteps}
          </div>
          <div className="flex gap-2">
            {currentStep > 1 && (
              <Button variant="outline" onClick={handlePrev} disabled={loading}>
                <ChevronLeft className="mr-1 h-4 w-4" />
                Previous
              </Button>
            )}
            {currentStep === 1 && (
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                Cancel
              </Button>
            )}
            {currentStep < totalSteps ? (
              <Button onClick={handleNext} className="bg-gradient-primary">
                Next
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={loading} className="bg-gradient-primary">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === "create" ? "Create Scheme" : "Save Changes"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}