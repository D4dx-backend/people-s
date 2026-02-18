import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, XCircle, User, MapPin, Calendar, IndianRupee, FileText, Phone, Mail, Download, Plus, Trash2, Clock, AlertCircle, Repeat } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useState, useEffect } from "react";

// Previous applications will be passed as prop or fetched from API

interface ApplicationViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  application: any;
  mode?: "view" | "approve" | "reject" | "edit";
  onApprove?: (id: string, remarks: string, distributionTimeline?: any[], forwardToCommittee?: boolean, interviewReport?: string, isRecurring?: boolean, recurringConfig?: any) => void;
  onReject?: (id: string, remarks: string) => void;
  previousApplications?: any[];
  /** Whether the current user has permission to approve/reject applications */
  canApprove?: boolean;
}

export function ApplicationViewModal({ 
  open, 
  onOpenChange, 
  application,
  mode = "view",
  onApprove,
  onReject,
  previousApplications = [],
  canApprove = false
}: ApplicationViewModalProps) {
  const [remarks, setRemarks] = useState("");
  const [forwardToCommittee, setForwardToCommittee] = useState(false);
  const [interviewReport, setInterviewReport] = useState("");
  const [approvedAmount, setApprovedAmount] = useState(0);
  const [showAction, setShowAction] = useState<"approve" | "reject" | null>(
    mode === "approve" ? "approve" : mode === "reject" ? "reject" : null
  );
  
  // Helper function to calculate date based on days from approval
  const calculateDate = (daysFromApproval: number) => {
    const today = new Date();
    const futureDate = new Date(today);
    futureDate.setDate(today.getDate() + daysFromApproval);
    return futureDate.toISOString().split('T')[0];
  };
  
  const [distributionTimeline, setDistributionTimeline] = useState([
    { id: 1, phase: "First Installment", percentage: 40, date: calculateDate(1) },
  ]);
  
  // Recurring payment state
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringPeriod, setRecurringPeriod] = useState<'monthly' | 'quarterly' | 'semi_annually' | 'annually'>('monthly');
  const [numberOfPayments, setNumberOfPayments] = useState(12);
  const [amountPerPayment, setAmountPerPayment] = useState(0);
  const [recurringStartDate, setRecurringStartDate] = useState('');

  // Initialize approved amount when application changes
  useEffect(() => {
    if (application) {
      setApprovedAmount(application.requestedAmount);
    }
  }, [application]);

  // Set default recurring start date when recurring is enabled
  useEffect(() => {
    if (isRecurring && !recurringStartDate) {
      // Default to 7 days from now
      setRecurringStartDate(calculateDate(7));
    }
  }, [isRecurring]);

  // Load distribution timeline from application or scheme defaults
  useEffect(() => {
    if (application) {
      // If application already has a distribution timeline, use it
      if (application.distributionTimeline && application.distributionTimeline.length > 0) {
        const existingTimeline = application.distributionTimeline.map((item: any, index: number) => ({
          id: index + 1,
          phase: item.description || item.phase || `Phase ${index + 1}`,
          percentage: item.percentage || 0,
          date: item.expectedDate ? new Date(item.expectedDate).toISOString().split('T')[0] : ""
        }));
        setDistributionTimeline(existingTimeline);
      } 
      // Otherwise, load default phases from the scheme with calculated dates
      else if (application.scheme?.distributionTimeline && application.scheme.distributionTimeline.length > 0) {
        const schemeDefaults = application.scheme.distributionTimeline.map((item: any, index: number) => ({
          id: index + 1,
          phase: item.description || `Phase ${index + 1}`,
          percentage: item.percentage || 0,
          date: calculateDate(item.daysFromApproval || 0) // Calculate date based on daysFromApproval
        }));
        setDistributionTimeline(schemeDefaults);
      }
      // Fallback to basic default if no scheme timeline exists
      else {
        setDistributionTimeline([
          { id: 1, phase: "First Installment", percentage: 50, date: calculateDate(7) },
          { id: 2, phase: "Second Installment", percentage: 30, date: calculateDate(60) },
          { id: 3, phase: "Final Installment", percentage: 20, date: calculateDate(120) }
        ]);
      }
    }
  }, [application]);

  const addDistributionPhase = () => {
    setDistributionTimeline([
      ...distributionTimeline,
      { 
        id: distributionTimeline.length + 1, 
        phase: `Installment ${distributionTimeline.length + 1}`, 
        percentage: 0, 
        date: calculateDate(30) // Default to 30 days from today for new phases
      },
    ]);
  };

  const loadSchemeDefaults = () => {
    if (application?.scheme?.distributionTimeline && application.scheme.distributionTimeline.length > 0) {
      const schemeDefaults = application.scheme.distributionTimeline.map((item: any, index: number) => ({
        id: index + 1,
        phase: item.description || `Phase ${index + 1}`,
        percentage: item.percentage || 0,
        date: calculateDate(item.daysFromApproval || 0) // Calculate dates when loading defaults
      }));
      setDistributionTimeline(schemeDefaults);
    }
  };

  const removeDistributionPhase = (id: number) => {
    setDistributionTimeline(distributionTimeline.filter(item => item.id !== id));
  };

  const updateDistributionPhase = (id: number, field: string, value: any) => {
    setDistributionTimeline(distributionTimeline.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const handleDownload = () => {
    const content = `
APPLICATION DETAILS
===================
Application ID: ${application?.applicationNumber || 'N/A'}
Applied Date: ${application?.createdAt ? new Date(application.createdAt).toLocaleDateString('en-IN') : 'N/A'}

APPLICANT INFORMATION
---------------------
Name: ${application?.beneficiary?.name || 'N/A'}
Contact: ${application?.beneficiary?.phone || 'N/A'}
Email: ${application?.beneficiary?.email || (application?.beneficiary?.name ? `${application.beneficiary.name.toLowerCase().replace(/\s+/g, '.')}@email.com` : 'N/A')}
Location: ${[application?.area?.name, application?.district?.name, application?.state?.name].filter(Boolean).join(', ') || 'N/A'}

SCHEME DETAILS
--------------
Scheme: ${application?.scheme?.name || 'N/A'}
Project: ${application?.project?.name || 'N/A'}
Requested Amount: ₹${application?.requestedAmount?.toLocaleString('en-IN') || '0'}
Status: ${application?.status || 'N/A'}
    `.trim();

    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Application_${application?.applicationNumber || 'unknown'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  if (!application) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Loading Application Details...</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading application details...</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const handleApprove = () => {
    if (onApprove) {
      // Validate recurring payment configuration if enabled and not forwarding to committee
      if (!forwardToCommittee && isRecurring && !recurringStartDate) {
        alert('Please select a start date for recurring payments');
        return;
      }

      // Convert distribution timeline to the format expected by the backend
      const timelineData = !forwardToCommittee ? distributionTimeline.map(phase => ({
        description: phase.phase,
        percentage: phase.percentage,
        amount: Math.round(approvedAmount * (phase.percentage / 100)),
        expectedDate: phase.date
      })) : undefined;
      
      // Prepare recurring config if enabled
      const recurringConfig = !forwardToCommittee && isRecurring ? {
        period: recurringPeriod,
        numberOfPayments: numberOfPayments,
        amountPerPayment: distributionTimeline.length === 0 ? (amountPerPayment || Math.round(approvedAmount / numberOfPayments)) : approvedAmount,
        startDate: recurringStartDate,
        customAmounts: [],
        hasDistributionTimeline: distributionTimeline.length > 0,
        distributionTimeline: distributionTimeline.length > 0 ? timelineData : undefined
      } : undefined;
      
      onApprove(application?._id || '', remarks, timelineData, forwardToCommittee, interviewReport, isRecurring, recurringConfig);
      setRemarks("");
      setForwardToCommittee(false);
      setInterviewReport("");
      setIsRecurring(false);
      setShowAction(null);
      onOpenChange(false);
    }
  };

  const handleReject = () => {
    if (onReject) {
      onReject(application?._id || '', remarks);
      setRemarks("");
      setShowAction(null);
      onOpenChange(false);
    }
  };

  const statusConfig = {
    pending: { color: "bg-warning/10 text-warning border-warning/20", label: "Pending Review" },
    approved: { color: "bg-success/10 text-success border-success/20", label: "Approved" },
    under_review: { color: "bg-info/10 text-info border-info/20", label: "Under Review" },
    rejected: { color: "bg-destructive/10 text-destructive border-destructive/20", label: "Rejected" },
    completed: { color: "bg-success/10 text-success border-success/20", label: "Completed" },
    review: { color: "bg-info/10 text-info border-info/20", label: "In Review" },
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>
              {showAction === "approve" ? (mode === "edit" ? "Change to Approved" : "Approve Application") : 
               showAction === "reject" ? (mode === "edit" ? "Change to Rejected" : "Reject Application") : 
               mode === "edit" ? "Edit Interview Decision" : "Application Details"}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="h-4 w-4" />
              </Button>
              <Badge variant="outline" className={statusConfig[application?.status as keyof typeof statusConfig]?.color || ''}>
                {statusConfig[application?.status as keyof typeof statusConfig]?.label || application?.status}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Application ID and Date */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Application ID</p>
              <p className="text-lg font-semibold">{application?.applicationNumber || 'N/A'}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Applied Date</p>
              <p className="font-medium">{application?.createdAt ? new Date(application.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}</p>
            </div>
          </div>

          {/* Eligibility Score Badge */}
          {application?.eligibilityScore && application.eligibilityScore.maxPoints > 0 && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
              <div className={`text-lg font-bold px-3 py-1 rounded-md ${
                application.eligibilityScore.percentage >= 70 ? 'bg-green-100 text-green-700' :
                application.eligibilityScore.percentage >= 40 ? 'bg-yellow-100 text-yellow-700' :
                'bg-red-100 text-red-700'
              }`}>
                {application.eligibilityScore.percentage}%
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Eligibility Score</p>
                <p className="text-xs text-muted-foreground">
                  {application.eligibilityScore.totalPoints} / {application.eligibilityScore.maxPoints} points
                  {application.eligibilityScore.threshold > 0 && (
                    <> · Threshold: {application.eligibilityScore.threshold}% {application.eligibilityScore.meetsThreshold ? '✓' : '✗'}</>
                  )}
                </p>
              </div>
              {application.eligibilityScore.autoRejected && (
                <Badge variant="destructive" className="text-xs">Auto-Rejected</Badge>
              )}
            </div>
          )}

          <Separator />

          {/* Applicant Details */}
          <div>
            <h3 className="font-semibold text-lg mb-3">Applicant Information</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Full Name</p>
                  <p className="font-medium">{application?.beneficiary?.name || 'N/A'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Contact Number</p>
                  <p className="font-medium">{application?.beneficiary?.phone || 'N/A'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{application?.beneficiary?.email || (application?.beneficiary?.name ? `${application.beneficiary.name.toLowerCase().replace(/\s+/g, '.')}@email.com` : 'N/A')}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Location</p>
                  <p className="font-medium">{[application?.area?.name, application?.district?.name, application?.state?.name].filter(Boolean).join(', ') || 'N/A'}</p>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Administrative Details */}
          <div>
            <h3 className="font-semibold text-lg mb-3">Administrative Details</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">State</p>
                  <p className="font-medium">{application?.state?.name || 'N/A'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">District</p>
                  <p className="font-medium">{application?.district?.name || 'N/A'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Area</p>
                  <p className="font-medium">{application?.area?.name || 'N/A'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Unit</p>
                  <p className="font-medium">{application?.unit?.name || 'N/A'}</p>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Application Details */}
          <div>
            <h3 className="font-semibold text-lg mb-3">Scheme Details</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Scheme Name</p>
                  <p className="font-medium">{application?.scheme?.name || 'N/A'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Project</p>
                  <p className="font-medium">{application?.project?.name || 'N/A'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <IndianRupee className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Requested Amount</p>
                  <p className="font-medium text-lg">₹{application?.requestedAmount?.toLocaleString('en-IN') || '0'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Current Status</p>
                  <p className="font-medium">{application?.status?.replace('_', ' ').toUpperCase() || 'N/A'}</p>
                </div>
              </div>
              {application?.approvedAmount && (
                <div className="flex items-start gap-3">
                  <IndianRupee className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Approved Amount</p>
                    <p className="font-medium text-lg text-success">₹{application.approvedAmount.toLocaleString('en-IN')}</p>
                  </div>
                </div>
              )}
              {application?.createdBy && (
                <div className="flex items-start gap-3">
                  <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Created By</p>
                    <p className="font-medium">{application.createdBy.name}</p>
                  </div>
                </div>
              )}
              {application?.reviewedBy && (
                <div className="flex items-start gap-3">
                  <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Reviewed By</p>
                    <p className="font-medium">{application.reviewedBy.name}</p>
                  </div>
                </div>
              )}
              {application?.approvedBy && (
                <div className="flex items-start gap-3">
                  <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Approved By</p>
                    <p className="font-medium">{application.approvedBy.name}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Money Distribution Timeline - Show only for approve */}
          {showAction === "approve" && (
            <>
              <Separator />
              
              {/* Approved Amount Input */}
              <div className="space-y-2">
                <Label className="font-semibold">Approved Amount <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number"
                    placeholder="Enter approved amount"
                    value={approvedAmount}
                    onChange={(e) => setApprovedAmount(Number(e.target.value))}
                    className="pl-10"
                    min={0}
                    max={application?.requestedAmount}
                    disabled={forwardToCommittee}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {forwardToCommittee 
                    ? "Approved amount will be determined by committee" 
                    : `Enter the approved amount (max: ₹${application?.requestedAmount?.toLocaleString('en-IN')})`
                  }
                </p>
              </div>

              {/* Forward to Committee Option */}
              <div className="flex items-start space-x-3 rounded-lg border p-4 bg-blue-50/50">
                <Checkbox
                  id="forwardToCommittee"
                  checked={forwardToCommittee}
                  onCheckedChange={(checked) => setForwardToCommittee(checked as boolean)}
                />
                <div className="grid gap-1.5 leading-none">
                  <label
                    htmlFor="forwardToCommittee"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    Forward to Committee Approval
                  </label>
                  <p className="text-sm text-muted-foreground">
                    Send this application to committee for final approval decision instead of approving directly
                  </p>
                </div>
              </div>

              {/* Recurring Payment Configuration - Can be configured for both direct approval and committee review */}
              <div className="rounded-lg border-2 border-blue-200 p-4 space-y-4 bg-gradient-to-br from-blue-50 to-blue-50/30">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Repeat className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <Label htmlFor="recurring-interview" className="text-base font-semibold cursor-pointer">
                          Recurring Payments
                        </Label>
                        <p className="text-xs text-muted-foreground mt-1">
                          {forwardToCommittee 
                            ? "Configure recurring payments for committee review (committee can modify)" 
                            : "Enable for monthly, quarterly, or yearly payments"}
                        </p>
                      </div>
                    </div>
                    <Checkbox
                      id="recurring-interview"
                      checked={isRecurring}
                      onCheckedChange={(checked) => {
                        setIsRecurring(checked as boolean);
                        if (checked && approvedAmount > 0 && numberOfPayments > 0) {
                          setAmountPerPayment(Math.round(approvedAmount / numberOfPayments));
                        }
                      }}
                      className="mt-1"
                    />
                  </div>

                  {isRecurring && (
                    <div className="space-y-4 pt-3 border-t-2 border-blue-200">
                      <div className="grid md:grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label className="font-medium">Recurring Period *</Label>
                          <Select value={recurringPeriod} onValueChange={(value: any) => setRecurringPeriod(value)}>
                            <SelectTrigger className="h-10">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="monthly">📅 Monthly (12/year)</SelectItem>
                              <SelectItem value="quarterly">📅 Quarterly (4/year)</SelectItem>
                              <SelectItem value="semi_annually">📅 Semi-Annually (2/year)</SelectItem>
                              <SelectItem value="annually">📅 Annually (1/year)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label className="font-medium">Number of Cycles *</Label>
                          <Input
                            type="number"
                            value={numberOfPayments}
                            onChange={(e) => {
                              const num = Number(e.target.value);
                              setNumberOfPayments(num);
                              if (approvedAmount > 0 && num > 0) {
                                setAmountPerPayment(Math.round(approvedAmount / num));
                              }
                            }}
                            min={1}
                            max={60}
                            placeholder="e.g., 12"
                            className="h-10"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label className="font-medium">Start Date *</Label>
                          <Input
                            type="date"
                            value={recurringStartDate}
                            onChange={(e) => setRecurringStartDate(e.target.value)}
                            min={new Date().toISOString().split('T')[0]}
                            className="h-10"
                          />
                        </div>
                      </div>

                      <div className="bg-white rounded p-3 text-sm space-y-1 border">
                        <div className="font-semibold text-blue-700">Summary:</div>
                        <div className="flex justify-between">
                          <span>Total Payments:</span>
                          <span className="font-medium">{numberOfPayments} × {recurringPeriod}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Total Amount:</span>
                          <span className="font-bold text-blue-700">₹{(approvedAmount * numberOfPayments).toLocaleString('en-IN')}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Money Distribution Timeline</Label>
                  <div className="flex gap-2">
                    {application?.scheme?.distributionTimeline && application.scheme.distributionTimeline.length > 0 && (
                      <Button variant="outline" size="sm" onClick={loadSchemeDefaults}>
                        <Calendar className="h-4 w-4 mr-2" />
                        Load Defaults
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={addDistributionPhase}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Phase
                    </Button>
                  </div>
                </div>
                {application?.scheme?.distributionTimeline && application.scheme.distributionTimeline.length > 0 && (
                  <div className="text-sm text-muted-foreground bg-blue-50 p-2 rounded border">
                    <Clock className="h-4 w-4 inline mr-1" />
                    Default phases from scheme "{application.scheme.name}" are loaded. You can modify them as needed.
                  </div>
                )}
                <div className="space-y-3">
                  {distributionTimeline.map((phase, index) => (
                    <div key={phase.id} className="grid grid-cols-12 gap-2 items-start">
                      <div className="col-span-5">
                        <Label className="text-xs text-muted-foreground">Phase Name</Label>
                        <Input
                          placeholder="Phase name"
                          value={phase.phase}
                          onChange={(e) => updateDistributionPhase(phase.id, "phase", e.target.value)}
                        />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs text-muted-foreground">%</Label>
                        <Input
                          type="number"
                          placeholder="40"
                          value={phase.percentage}
                          onChange={(e) => updateDistributionPhase(phase.id, "percentage", parseInt(e.target.value) || 0)}
                        />
                      </div>
                      <div className="col-span-4">
                        <Label className="text-xs text-muted-foreground">Due Date</Label>
                        <Input
                          type="date"
                          value={phase.date}
                          onChange={(e) => updateDistributionPhase(phase.id, "date", e.target.value)}
                        />
                      </div>
                      <div className="col-span-1 flex items-end">
                        {distributionTimeline.length > 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeDistributionPhase(phase.id)}
                            className="text-destructive h-10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Total: {distributionTimeline.reduce((sum, p) => sum + p.percentage, 0)}% of ₹{approvedAmount?.toLocaleString('en-IN') || '0'} = ₹{Math.round(approvedAmount * distributionTimeline.reduce((sum, p) => sum + p.percentage, 0) / 100).toLocaleString('en-IN')}
                </p>
              </div>
            </>
          )}

          {/* Remarks Section - Show if approve or reject mode */}
          {showAction && (
            <>
              <Separator />

              {/* Interview Report - Show when forwarding to committee */}
              {showAction === "approve" && forwardToCommittee && (
                <div className="space-y-3">
                  <Label className="text-base font-semibold">
                    Interview Report
                    <span className="text-destructive ml-1">*</span>
                  </Label>
                  <Textarea 
                    placeholder="Enter detailed interview report for committee review..."
                    value={interviewReport}
                    onChange={(e) => setInterviewReport(e.target.value)}
                    rows={5}
                    className="resize-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    Provide a comprehensive report of the interview for committee members to review.
                  </p>
                </div>
              )}
              
              <div className="space-y-3">
                <Label className="text-base font-semibold">
                  {showAction === "approve" ? (forwardToCommittee ? "Interview Notes" : "Approval Remarks / Comments") : "Rejection Remarks / Comments"}
                  <span className="text-destructive ml-1">*</span>
                </Label>
                <Textarea 
                  placeholder={`Enter ${showAction === "approve" ? (forwardToCommittee ? "interview notes" : "approval") : "rejection"} remarks...`}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={4}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  Please provide detailed comments for this {showAction === "approve" && forwardToCommittee ? "interview" : showAction}.
                </p>
              </div>
            </>
          )}

          {/* Previous Applications History */}
          {previousApplications.length > 0 && (
            <>
              <Separator />
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Previous Application History</h3>
                {previousApplications.map((prevApp, idx) => (
                  <div key={idx} className="border rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{prevApp.applicationNumber || prevApp.id}</p>
                        <p className="text-sm text-muted-foreground">{prevApp.scheme?.name || prevApp.scheme}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className={statusConfig[prevApp.status as keyof typeof statusConfig]?.color || "bg-muted"}>
                          {statusConfig[prevApp.status as keyof typeof statusConfig]?.label || prevApp.status}
                        </Badge>
                        <p className="text-sm text-muted-foreground mt-1">
                          Applied: {prevApp.createdAt ? new Date(prevApp.createdAt).toLocaleDateString('en-IN') : new Date(prevApp.appliedDate).toLocaleDateString('en-IN')}
                        </p>
                      </div>
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Amount:</span> ₹{(prevApp.requestedAmount || prevApp.amount)?.toLocaleString('en-IN') || '0'}
                      </div>
                      <div>
                        <span className="font-medium">Project:</span> {prevApp.project?.name || prevApp.project || 'N/A'}
                      </div>
                      <div>
                        <span className="font-medium">District:</span> {prevApp.district?.name || 'N/A'}
                      </div>
                      <div>
                        <span className="font-medium">Status:</span> {statusConfig[prevApp.status as keyof typeof statusConfig]?.label || prevApp.status}
                      </div>
                    </div>
                    
                    {prevApp.distributionTimeline && prevApp.distributionTimeline.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2">Money Distribution Timeline</p>
                        <div className="space-y-2">
                          {prevApp.distributionTimeline.map((timeline: any, tidx: number) => (
                            <div key={tidx} className="border rounded p-3 bg-muted/30">
                              <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                  <p className="font-medium text-sm">{timeline.phase}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {timeline.percentage}% - ₹{timeline.amount?.toLocaleString() || '0'}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Due: {timeline.dueDate ? new Date(timeline.dueDate).toLocaleDateString('en-IN') : 'N/A'}
                                    {timeline.paidDate && ` | Paid: ${new Date(timeline.paidDate).toLocaleDateString('en-IN')}`}
                                  </p>
                                </div>
                                <Badge 
                                  variant="outline" 
                                  className={timeline.status === "paid" ? "bg-success/10 text-success border-success/20" : "bg-warning/10 text-warning border-warning/20"}
                                >
                                  {timeline.status === "paid" ? "Paid" : "Pending"}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Action Buttons - Only shown to users with approve permission */}
          {canApprove && (((application?.status === "pending" || application?.status === "interview_scheduled") && mode === "view") || mode === "edit") && !showAction && (
            <>
              <Separator />
              {mode === "edit" && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-center gap-2 text-amber-800">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">Editing Completed Interview</span>
                  </div>
                  <p className="text-xs text-amber-700 mt-1">
                    You can modify the decision and update the Money Distribution Timeline if needed.
                  </p>
                </div>
              )}
              <div className="flex gap-3">
                <Button 
                  className="flex-1 bg-success hover:bg-success/90"
                  onClick={() => setShowAction("approve")}
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  {mode === "edit" ? "Change to Approved" : "Approve Application"}
                </Button>
                <Button 
                  className="flex-1"
                  variant="destructive"
                  onClick={() => setShowAction("reject")}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  {mode === "edit" ? "Change to Rejected" : "Reject Application"}
                </Button>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          {showAction ? (
            <>
              <Button variant="outline" onClick={() => {
                setShowAction(null);
                setRemarks("");
                if (mode !== "view") onOpenChange(false);
              }}>
                Cancel
              </Button>
              <Button 
                className={showAction === "approve" ? "bg-success hover:bg-success/90" : ""}
                variant={showAction === "reject" ? "destructive" : "default"}
                onClick={showAction === "approve" ? handleApprove : handleReject}
                disabled={showAction === "approve" 
                  ? (!remarks.trim() || (forwardToCommittee && !interviewReport.trim())) 
                  : !remarks.trim()
                }
              >
                {showAction === "approve" ? <CheckCircle className="mr-2 h-4 w-4" /> : <XCircle className="mr-2 h-4 w-4" />}
                {mode === "edit" 
                  ? "Update Decision" 
                  : forwardToCommittee 
                    ? "Forward to Committee" 
                    : `Confirm ${showAction === "approve" ? "Approval" : "Rejection"}`
                }
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
