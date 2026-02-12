import { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Upload, FileText, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
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

  const phoneNumber = localStorage.getItem("user_phone") || "";

  useEffect(() => {
    if (schemeId) {
      loadSchemeDetails();
    } else {
      toast({
        title: "Scheme not found",
        description: "Please select a scheme to apply",
        variant: "destructive",
      });
      navigate("/beneficiary/schemes");
    }
  }, [schemeId, navigate]);

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
      const applicationData = {
        schemeId: scheme._id,
        formData,
        documents: Object.keys(uploadedFiles).map(docType => ({
          type: docType,
          filename: uploadedFiles[docType].name,
          // In a real app, you would upload the file to a storage service first
          // and store the URL here
          url: `placeholder-url-for-${uploadedFiles[docType].name}`
        }))
      };

      const response = await beneficiaryApi.submitApplication(applicationData);
      
      toast({
        title: "Application Submitted Successfully!",
        description: `Your application ID is ${response.application.applicationId}`,
      });

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
              onClick={() => navigate("/beneficiary/schemes")}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <img src={logo} alt="Logo" className="h-8 w-8 rounded-full" />
            <div>
              <h1 className="text-sm font-bold">Apply for Scheme</h1>
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
              <FileText className="h-5 w-5" />
              {scheme.name}
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
                  onCheckedChange={setAgreedToTerms}
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

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-6">
          <Button
            variant="outline"
            onClick={handlePreviousSection}
            disabled={currentSection === 0}
          >
            Previous
          </Button>

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
  );
}