import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Upload, FileText, AlertCircle, CheckCircle, Loader2, RefreshCw, Save, Clock } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { beneficiaryApi } from "@/services/beneficiaryApi";
import logo from "@/assets/logo.png";

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
  conditionalLogic?: {
    field: number;
    operator: string;
    value: string;
    action: string;
  };
}

interface FormPage {
  id: number;
  title: string;
  description?: string;
  fields: FormField[];
  order: number;
  conditionalLogic?: {
    field: number;
    operator: string;
    value: string;
  };
}

interface Scheme {
  _id: string;
  name: string;
  description: string;
  category: string;
  priority: string;
  project: {
    _id: string;
    name: string;
  };
  benefitType: string;
  maxAmount: number;
  benefitFrequency: string;
  benefitDescription: string;
  applicationDeadline: string;
  daysRemaining: number;
  requiresInterview: boolean;
  allowMultipleApplications: boolean;
  eligibilityCriteria: string[];
  beneficiariesCount: number;
  totalApplications: number;
  successRate: number;
  hasApplied: boolean;
  existingApplicationId?: string;
  existingApplicationStatus?: string;
  formConfig: {
    title: string;
    description: string;
    pages: FormPage[];
    confirmationMessage: string;
  };
}

export default function BeneficiaryApplication() {
  const navigate = useNavigate();
  const { schemeId } = useParams();
  const location = useLocation();
  
  // Don't use the scheme from location.state as it doesn't have form configuration
  // Always load from API to get complete scheme details including form config
  const [scheme, setScheme] = useState<Scheme | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [currentSection, setCurrentSection] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, File>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  
  // Renewal mode
  const searchParams = new URLSearchParams(location.search);
  const renewApplicationId = searchParams.get('renew');
  const [isRenewalMode, setIsRenewalMode] = useState(false);
  const [parentApplicationId, setParentApplicationId] = useState<string | null>(null);

  // Draft mode
  const draftIdFromUrl = searchParams.get('draftId');
  const [draftId, setDraftId] = useState<string | null>(draftIdFromUrl);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isDraftLoaded, setIsDraftLoaded] = useState(false);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const formDataRef = useRef<Record<string, any>>({});
  const lastSavedDataRef = useRef<string>('');

  const phoneNumber = localStorage.getItem("user_phone") || "";

  // handleSaveDraft must be declared before any early returns (React hooks rule)
  const handleSaveDraft = useCallback(async (autoSave = false) => {
    if (!scheme || isRenewalMode || isSavingDraft) return;

    setIsSavingDraft(true);
    try {
      const draftData = {
        formData: formDataRef.current,
        documents: Object.keys(uploadedFiles).map(docType => ({
          type: docType,
          filename: uploadedFiles[docType].name,
          url: `placeholder-url-for-${uploadedFiles[docType].name}`
        })),
        currentPage: currentSection,
        autoSave
      };

      let response;
      if (draftId) {
        response = await beneficiaryApi.updateDraft(draftId, draftData);
      } else {
        response = await beneficiaryApi.saveDraft({
          schemeId: scheme._id,
          ...draftData
        });
        setDraftId(response.draft._id);
      }

      const now = new Date();
      setLastSaved(now);
      lastSavedDataRef.current = JSON.stringify(formDataRef.current);

      if (!autoSave) {
        toast({
          title: "Draft Saved",
          description: `Saved at ${now.toLocaleTimeString()}`,
        });
      }
    } catch (error) {
      if (!autoSave) {
        toast({
          title: "Failed to Save Draft",
          description: error instanceof Error ? error.message : "Please try again",
          variant: "destructive",
        });
      }
      console.error('Draft save error:', error);
    } finally {
      setIsSavingDraft(false);
    }
  }, [scheme, isRenewalMode, draftId, uploadedFiles, currentSection, isSavingDraft]);

  // Keep ref in sync with state
  useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);

  useEffect(() => {
    if (renewApplicationId) {
      // Renewal mode - load renewal form
      loadRenewalForm();
    } else if (schemeId) {
      loadSchemeDetails();
    } else {
      toast({
        title: "Scheme not found",
        description: "Please select a scheme to apply",
        variant: "destructive",
      });
      navigate("/beneficiary/schemes");
    }
  }, [schemeId, renewApplicationId, navigate]);

  // Auto-save every 30 seconds
  useEffect(() => {
    if (!scheme || isRenewalMode) return;

    autoSaveTimerRef.current = setInterval(() => {
      const currentData = JSON.stringify(formDataRef.current);
      if (currentData !== '{}' && currentData !== lastSavedDataRef.current) {
        handleSaveDraft(true);
      }
    }, 30000);

    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
      }
    };
  }, [scheme, isRenewalMode, draftId]);

  // Add error boundary effect
  useEffect(() => {
    const handleError = (error: ErrorEvent) => {
      console.error('Application error:', error);
      toast({
        title: "Application Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  const loadRenewalForm = async () => {
    if (!renewApplicationId) return;
    
    try {
      setIsLoading(true);
      const response = await beneficiaryApi.getRenewalForm(renewApplicationId);
      
      if (response.renewalForm) {
        setIsRenewalMode(true);
        setParentApplicationId(renewApplicationId);
        
        // Build scheme-like object from renewal form data
        const renewalData = response.renewalForm;
        setScheme({
          _id: renewalData.scheme._id,
          name: renewalData.scheme.name,
          description: renewalData.scheme.description || '',
          category: renewalData.scheme.category || '',
          priority: renewalData.scheme.priority || 'medium',
          project: renewalData.scheme.project || { _id: '', name: '' },
          benefitType: renewalData.scheme.benefitType || '',
          maxAmount: renewalData.scheme.maxAmount || 0,
          benefitFrequency: renewalData.scheme.benefitFrequency || '',
          benefitDescription: renewalData.scheme.benefitDescription || '',
          applicationDeadline: '',
          daysRemaining: 0,
          requiresInterview: false,
          allowMultipleApplications: true,
          eligibilityCriteria: [],
          beneficiariesCount: 0,
          totalApplications: 0,
          successRate: 0,
          hasApplied: false,
          formConfig: {
            title: renewalData.formConfig.title || 'Renewal Application',
            description: renewalData.formConfig.description || '',
            pages: renewalData.formConfig.pages || [],
            confirmationMessage: 'Your renewal application has been submitted successfully.',
          },
        });
        
        // Pre-fill form data from parent application
        if (renewalData.prefillData) {
          setFormData(renewalData.prefillData);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load renewal form';
      toast({
        title: 'Renewal Form Error',
        description: errorMessage,
        variant: 'destructive',
      });
      navigate('/beneficiary/dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  const loadSchemeDetails = async () => {
    if (!schemeId) return;
    
    try {
      setIsLoading(true);
      
      const response = await beneficiaryApi.getSchemeDetails(schemeId);
      
      if (response.scheme.hasApplied) {
        toast({
          title: "Already Applied",
          description: "You have already applied for this scheme",
          variant: "destructive",
        });
        navigate("/beneficiary/dashboard");
        return;
      }
      
      setScheme(response.scheme);

      // Check for existing draft
      try {
        const draftResponse = await beneficiaryApi.getDraftForScheme(schemeId);
        if (draftResponse.draft) {
          setDraftId(draftResponse.draft._id);
          if (draftResponse.draft.formData && Object.keys(draftResponse.draft.formData).length > 0) {
            setFormData(draftResponse.draft.formData);
            lastSavedDataRef.current = JSON.stringify(draftResponse.draft.formData);
          }
          if (draftResponse.draft.draftMetadata?.currentPage) {
            setCurrentSection(draftResponse.draft.draftMetadata.currentPage);
          }
          if (draftResponse.draft.draftMetadata?.lastSavedAt) {
            setLastSaved(new Date(draftResponse.draft.draftMetadata.lastSavedAt));
          }
          setIsDraftLoaded(true);
          toast({
            title: "Draft Loaded",
            description: "Your previous draft has been restored. Continue filling the form.",
          });
        }
      } catch {
        // No draft exists, that's fine
      }
    } catch (error) {
      
      const errorMessage = error instanceof Error ? error.message : "Please try again";
      
      toast({
        title: "Failed to Load Application Form",
        description: errorMessage,
        variant: "destructive",
      });
      
      // If it's a form not available error, show a specific message
      if (errorMessage.includes('not available')) {
        toast({
          title: "Form Not Ready",
          description: "The application form for this scheme is not configured yet. Please try another scheme or contact support.",
          variant: "destructive",
        });
      }
      
      navigate("/beneficiary/schemes");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading scheme details...</span>
        </div>
      </div>
    );
  }

  if (!scheme) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 mb-4">
            <FileText className="h-12 w-12 mx-auto mb-2" />
            <h2 className="text-xl font-semibold">Scheme Not Found</h2>
            <p className="text-muted-foreground mt-2">
              The requested scheme could not be found or is no longer available.
            </p>
          </div>
          <Button onClick={() => navigate("/beneficiary/schemes")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Schemes
          </Button>
        </div>
      </div>
    );
  }

  const handleInputChange = (fieldName: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [fieldName]: value
    }));

    // Clear error when user starts typing
    if (errors[fieldName]) {
      setErrors(prev => ({
        ...prev,
        [fieldName]: ""
      }));
    }
  };

  const handleFileUpload = (documentType: string, file: File) => {
    setUploadedFiles(prev => ({
      ...prev,
      [documentType]: file
    }));
    toast({
      title: "File uploaded",
      description: `${file.name} uploaded successfully`,
    });
  };

  const validateField = (field: FormField, value: any): string => {
    if (field.type === "checkbox") {
      if (field.required && !value) {
        return `${field.label} is required`;
      }
      return "";
    }

    // Table (row/column) validation: check that at least one cell has data
    if (field.type === "row" || field.type === "column") {
      if (field.required) {
        if (!Array.isArray(value) || !value.some((row: string[]) => row?.some((cell: string) => cell?.trim()))) {
          return `${field.label} is required — please fill in at least one cell`;
        }
      }
      return "";
    }

    if (field.required && (!value || value.toString().trim() === "")) {
      return `${field.label} is required`;
    }

    if (!value || value.toString().trim() === "") {
      return ""; // No validation for empty optional fields
    }

    // Use custom validation message if available
    const getValidationMessage = (defaultMessage: string) => 
      field.validation?.customMessage || defaultMessage;

    if (field.type === "email") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        return getValidationMessage("Please enter a valid email address");
      }
    }

    if (field.type === "phone") {
      const phoneRegex = /^[+]?[0-9]{10,15}$/;
      if (!phoneRegex.test(value.replace(/\s/g, ""))) {
        return getValidationMessage("Please enter a valid phone number");
      }
    }

    if (field.type === "number") {
      if (isNaN(value)) {
        return getValidationMessage("Please enter a valid number");
      }
      if (field.validation?.min && value < field.validation.min) {
        return getValidationMessage(`Minimum value is ${field.validation.min}`);
      }
      if (field.validation?.max && value > field.validation.max) {
        return getValidationMessage(`Maximum value is ${field.validation.max}`);
      }
    }

    if (field.type === "text" || field.type === "textarea") {
      if (field.validation?.minLength && value.length < field.validation.minLength) {
        return getValidationMessage(`Minimum length is ${field.validation.minLength} characters`);
      }
      if (field.validation?.maxLength && value.length > field.validation.maxLength) {
        return getValidationMessage(`Maximum length is ${field.validation.maxLength} characters`);
      }
    }

    if (field.validation?.pattern) {
      const regex = new RegExp(field.validation.pattern);
      if (!regex.test(value)) {
        return getValidationMessage("Please enter a valid value");
      }
    }

    return "";
  };

  const validateCurrentSection = (): boolean => {
    const currentPageData = scheme.formConfig.pages[currentSection];
    const newErrors: Record<string, string> = {};
    let isValid = true;

    currentPageData.fields.forEach(field => {
      if (!field.enabled) return; // Skip disabled fields
      
      const fieldKey = `field_${field.id}`;
      const error = validateField(field, formData[fieldKey]);
      if (error) {
        newErrors[fieldKey] = error;
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  };

  const handleNextSection = () => {
    if (validateCurrentSection()) {
      if (currentSection < scheme.formConfig.pages.length - 1) {
        setCurrentSection(currentSection + 1);
      }
    } else {
      toast({
        title: "Please fix the errors",
        description: "Complete all required fields before proceeding",
        variant: "destructive",
      });
    }
  };

  const handlePreviousSection = () => {
    if (currentSection > 0) {
      setCurrentSection(currentSection - 1);
    }
  };

  const handleSubmit = async () => {
    if (!scheme) return;
    
    if (!validateCurrentSection()) {
      toast({
        title: "Please fix the errors",
        description: "Complete all required fields before submitting",
        variant: "destructive",
      });
      return;
    }

    if (!agreedToTerms) {
      toast({
        title: "Terms and Conditions",
        description: "Please agree to the terms and conditions",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      if (isRenewalMode && parentApplicationId) {
        // Submit as renewal
        const response = await beneficiaryApi.submitRenewal(parentApplicationId, {
          formData,
          documents: Object.keys(uploadedFiles).map(docType => ({
            type: docType,
            filename: uploadedFiles[docType].name,
            url: `placeholder-url-for-${uploadedFiles[docType].name}`
          }))
        });
        
        toast({
          title: "Renewal Submitted Successfully!",
          description: `Your renewal application ID is ${response.application?.applicationId || 'generated'}`,
        });
      } else {
        const applicationData = {
          schemeId: scheme._id,
          formData,
          documents: Object.keys(uploadedFiles).map(docType => ({
            type: docType,
            filename: uploadedFiles[docType].name,
            url: `placeholder-url-for-${uploadedFiles[docType].name}`
          }))
        };

        const response = await beneficiaryApi.submitApplication(applicationData);
        
        toast({
          title: "Application Submitted Successfully!",
          description: `Your application ID is ${response.application.applicationId}`,
        });
      }

      // Clear auto-save timer
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
      }

      // Navigate to dashboard
      navigate("/beneficiary/dashboard");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Please try again later";
      
      // Check if it's a profile completion error
      if (errorMessage.includes('complete your profile') || errorMessage.includes('location information')) {
        toast({
          title: "Profile Incomplete",
          description: errorMessage,
          variant: "destructive",
        });
        
        // Navigate to profile completion after a short delay
        setTimeout(() => {
          navigate("/beneficiary/profile-completion");
        }, 2000);
      } else {
        toast({
          title: "Submission Failed",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderField = (field: FormField) => {
    const fieldKey = `field_${field.id}`;
    const value = formData[fieldKey] || "";
    const error = errors[fieldKey];

    if (!field.enabled) return null; // Don't render disabled fields

    switch (field.type) {
      case "text":
      case "email":
      case "phone":
      case "number":
      case "url":
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={fieldKey}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Input
              id={fieldKey}
              type={field.type === "phone" ? "tel" : field.type}
              value={value}
              onChange={(e) => handleInputChange(fieldKey, e.target.value)}
              placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
              className={error ? "border-red-500" : ""}
            />
            {field.helpText && <p className="text-xs text-muted-foreground">{field.helpText}</p>}
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
        );

      case "textarea":
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={fieldKey}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Textarea
              id={fieldKey}
              value={value}
              onChange={(e) => handleInputChange(fieldKey, e.target.value)}
              placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
              className={error ? "border-red-500" : ""}
              rows={3}
            />
            {field.helpText && <p className="text-xs text-muted-foreground">{field.helpText}</p>}
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
        );

      case "select":
      case "dropdown":
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={fieldKey}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Select value={value} onValueChange={(val) => handleInputChange(fieldKey, val)}>
              <SelectTrigger className={error ? "border-red-500" : ""}>
                <SelectValue placeholder={field.placeholder || `Select ${field.label.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                {field.options?.filter((option) => option !== "").map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {field.helpText && <p className="text-xs text-muted-foreground">{field.helpText}</p>}
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
        );

      case "yesno":
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={fieldKey}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Select value={value} onValueChange={(val) => handleInputChange(fieldKey, val)}>
              <SelectTrigger className={error ? "border-red-500" : ""}>
                <SelectValue placeholder={field.placeholder || "Select Yes or No"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Yes">Yes</SelectItem>
                <SelectItem value="No">No</SelectItem>
              </SelectContent>
            </Select>
            {field.helpText && <p className="text-xs text-muted-foreground">{field.helpText}</p>}
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
        );

      case "multiselect":
        return (
          <div key={field.id} className="space-y-2">
            <Label>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <div className="space-y-2 border rounded-md p-3">
              {field.options?.filter((option) => option !== "").map((option) => {
                const selected: string[] = Array.isArray(value) ? value : [];
                return (
                  <div key={option} className="flex items-center space-x-2">
                    <Checkbox
                      id={`${fieldKey}_${option}`}
                      checked={selected.includes(option)}
                      onCheckedChange={(checked) => {
                        const newValue = checked
                          ? [...selected, option]
                          : selected.filter((v: string) => v !== option);
                        handleInputChange(fieldKey, newValue);
                      }}
                    />
                    <Label htmlFor={`${fieldKey}_${option}`} className="text-sm font-normal">
                      {option}
                    </Label>
                  </div>
                );
              })}
            </div>
            {field.helpText && <p className="text-xs text-muted-foreground">{field.helpText}</p>}
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
        );

      // Layout field types - rendered as visual elements, not input fields
      case "title":
        return (
          <div key={field.id} className="pt-2">
            <h3 className="text-lg font-semibold">{field.label}</h3>
            {field.helpText && <p className="text-sm text-muted-foreground">{field.helpText}</p>}
          </div>
        );

      case "html":
        return (
          <div key={field.id} className="prose prose-sm max-w-none">
            <div dangerouslySetInnerHTML={{ __html: field.placeholder || field.label }} />
          </div>
        );

      case "row":
      case "column": {
        const colCount = field.columns || 2;
        const rowCount = field.rows || 3;
        const hasRowLabels = field.rowTitles?.some(t => t) ?? false;
        // Initialize table data as 2D array if not exists
        const tableData: string[][] = Array.isArray(value) ? value :
          Array.from({ length: rowCount }, () => Array(colCount).fill(""));

        return (
          <div key={field.id} className="space-y-2">
            <Label>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            {field.helpText && <p className="text-xs text-muted-foreground">{field.helpText}</p>}
            <div className="border rounded-md overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted">
                    {hasRowLabels && <th className="border-r border-b p-2 text-left font-medium text-xs"></th>}
                    {Array.from({ length: colCount }, (_, i) => (
                      <th key={i} className="border-r border-b p-2 text-left font-medium text-xs">
                        {field.columnTitles?.[i] || `Column ${i + 1}`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: rowCount }, (_, r) => (
                    <tr key={r} className={r % 2 === 0 ? "" : "bg-muted/30"}>
                      {hasRowLabels && (
                        <td className="border-r border-b p-2 font-medium text-xs text-muted-foreground bg-muted/50 whitespace-nowrap">
                          {field.rowTitles?.[r] || `Row ${r + 1}`}
                        </td>
                      )}
                      {Array.from({ length: colCount }, (_, c) => (
                        <td key={c} className="border-r border-b p-1">
                          <Input
                            value={tableData[r]?.[c] || ""}
                            onChange={(e) => {
                              const newData = tableData.map((row, ri) =>
                                ri === r
                                  ? row.map((cell, ci) => (ci === c ? e.target.value : cell))
                                  : [...row]
                              );
                              // Ensure all rows have correct number of columns
                              while (newData.length < rowCount) {
                                newData.push(Array(colCount).fill(""));
                              }
                              handleInputChange(fieldKey, newData);
                            }}
                            placeholder={field.placeholder || `Enter ${field.columnTitles?.[c] || 'value'}`}
                            className={`h-8 text-sm border-0 shadow-none focus-visible:ring-1 ${error ? "bg-red-50" : ""}`}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
        );
      }

      case "group":
      case "page":
        // Layout containers - skip rendering as input fields
        return null;

      case "date":
      case "datetime":
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={fieldKey}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Input
              id={fieldKey}
              type={field.type === "datetime" ? "datetime-local" : "date"}
              value={value}
              onChange={(e) => handleInputChange(fieldKey, e.target.value)}
              className={error ? "border-red-500" : ""}
            />
            {field.helpText && <p className="text-xs text-muted-foreground">{field.helpText}</p>}
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
        );

      case "checkbox":
        return (
          <div key={field.id} className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id={fieldKey}
                checked={!!value}
                onCheckedChange={(checked) => handleInputChange(fieldKey, checked)}
              />
              <Label htmlFor={fieldKey} className="text-sm font-medium leading-none">
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </Label>
            </div>
            {field.helpText && <p className="text-xs text-muted-foreground">{field.helpText}</p>}
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
        );

      case "radio":
        return (
          <div key={field.id} className="space-y-2">
            <Label>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <div className="space-y-2">
              {field.options?.filter((option) => option !== "").map((option) => (
                <div key={option} className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id={`${fieldKey}_${option}`}
                    name={fieldKey}
                    value={option}
                    checked={value === option}
                    onChange={(e) => handleInputChange(fieldKey, e.target.value)}
                    className="h-4 w-4"
                  />
                  <Label htmlFor={`${fieldKey}_${option}`} className="text-sm font-normal">
                    {option}
                  </Label>
                </div>
              ))}
            </div>
            {field.helpText && <p className="text-xs text-muted-foreground">{field.helpText}</p>}
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
        );

      case "time":
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={fieldKey}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Input
              id={fieldKey}
              type="time"
              value={value}
              onChange={(e) => handleInputChange(fieldKey, e.target.value)}
              className={error ? "border-red-500" : ""}
            />
            {field.helpText && <p className="text-xs text-muted-foreground">{field.helpText}</p>}
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
        );

      case "file":
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={fieldKey}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Input
              id={fieldKey}
              type="file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleInputChange(fieldKey, file.name);
                  // Handle file upload here
                }
              }}
              className={error ? "border-red-500" : ""}
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            />
            {field.helpText && <p className="text-xs text-muted-foreground">{field.helpText}</p>}
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
        );

      default:
        // Fallback: render as text input for any unrecognized field type
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={fieldKey}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Input
              id={fieldKey}
              type="text"
              value={value}
              onChange={(e) => handleInputChange(fieldKey, e.target.value)}
              placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
              className={error ? "border-red-500" : ""}
            />
            {field.helpText && <p className="text-xs text-muted-foreground">{field.helpText}</p>}
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
        );
    }
  };

  // Safety checks for scheme and formConfig
  if (!scheme || !scheme.formConfig || !scheme.formConfig.pages || scheme.formConfig.pages.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 mb-4">
            <FileText className="h-12 w-12 mx-auto mb-2" />
            <h2 className="text-xl font-semibold">Form Not Available</h2>
            <p className="text-muted-foreground mt-2">
              The application form for this scheme is not configured yet.
            </p>
          </div>
          <Button onClick={() => navigate("/beneficiary/schemes")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Schemes
          </Button>
        </div>
      </div>
    );
  }

  const currentPageData = scheme.formConfig.pages[currentSection];
  const progress = ((currentSection + 1) / scheme.formConfig.pages.length) * 100;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-3 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(isRenewalMode ? "/beneficiary/dashboard" : "/beneficiary/schemes")}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <img src={logo} alt="Logo" className="h-8 w-8 rounded-full" />
            <div>
              <h1 className="text-lg font-bold">
                {isRenewalMode ? 'Renew Application' : 'Apply for Scheme'}
              </h1>
              <p className="text-xs text-muted-foreground hidden sm:block">+91 {phoneNumber}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-3 py-4 sm:px-4 sm:py-6 max-w-4xl">
        {/* Scheme Info */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {isRenewalMode ? <RefreshCw className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
              {scheme.name}
              {isRenewalMode && (
                <Badge className="bg-blue-100 text-blue-800 border-blue-200">Renewal</Badge>
              )}
            </CardTitle>
            <CardDescription>{scheme.description}</CardDescription>
          </CardHeader>
        </Card>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">
              Step {currentSection + 1} of {scheme.formConfig.pages.length}
            </span>
            <span className="text-sm text-muted-foreground">{Math.round(progress)}% Complete</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Form Section */}
        <Card>
          <CardHeader>
            <CardTitle>{currentPageData.title}</CardTitle>
            {currentPageData.description && (
              <CardDescription>{currentPageData.description}</CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {currentPageData.fields.map(renderField)}
          </CardContent>
        </Card>

        {/* Note: Document upload fields are now handled within the form pages themselves
             as 'file' type fields in the FormConfiguration. No separate hardcoded section needed. */}

        {/* Terms and Conditions (on last step) */}
        {currentSection === scheme.formConfig.pages.length - 1 && (
          <Card className="mt-6">
            <CardContent className="pt-6">
              <div className="flex items-start space-x-2">
                <Checkbox
                  id="terms"
                  checked={agreedToTerms}
                  onCheckedChange={(checked) => setAgreedToTerms(checked === true)}
                />
                <div className="grid gap-1.5 leading-none">
                  <Label
                    htmlFor="terms"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    I agree to the terms and conditions
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    I declare that all information provided is true and accurate. I understand that
                    providing false information may result in rejection of my application.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Auto-save indicator */}
        {lastSaved && !isRenewalMode && (
          <div className="flex items-center justify-center gap-1.5 mt-3 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>Last saved: {lastSaved.toLocaleTimeString()}</span>
            {isSavingDraft && <Loader2 className="h-3 w-3 animate-spin ml-1" />}
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between items-center mt-4 gap-2">
          <Button
            variant="outline"
            onClick={handlePreviousSection}
            disabled={currentSection === 0}
          >
            Previous
          </Button>

          <div className="flex items-center gap-2">
            {!isRenewalMode && (
              <Button
                variant="outline"
                onClick={() => handleSaveDraft(false)}
                disabled={isSavingDraft || isSubmitting}
                className="border-amber-300 text-amber-700 hover:bg-amber-50"
              >
                {isSavingDraft ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-1" />
                )}
                {isSavingDraft ? "Saving..." : "Save Draft"}
              </Button>
            )}

            {currentSection < scheme.formConfig.pages.length - 1 ? (
              <Button onClick={handleNextSection}>
                Next
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="bg-green-600 hover:bg-green-700"
              >
                {isSubmitting ? "Submitting..." : "Submit Application"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}