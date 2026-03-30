import { useState, useEffect } from "react";
import { Scale, User, IndianRupee, Calendar, FileText, CheckCircle, XCircle, Loader2, AlertCircle, MapPin, Filter, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import VoiceToTextButton from '@/components/ui/VoiceToTextButton';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { useRBAC } from "@/hooks/useRBAC";
import { GenericFilters } from "@/components/filters/GenericFilters";
import { useApplicationFilters } from "@/hooks/useApplicationFilters";
import { applications } from "@/lib/api";

interface Application {
  _id: string;
  applicationNumber: string;
  beneficiary: {
    name: string;
    phone: string;
    email?: string;
    location?: any;
    age?: number;
    gender?: string;
    occupation?: string;
    monthlyIncome?: number;
  };
  scheme: {
    name: string;
    category: string;
    type?: string;
  };
  project?: {
    name: string;
  };
  state?: { name: string };
  district?: { name: string };
  area?: { name: string };
  unit?: { name: string };
  requestedAmount: number;
  purpose?: string;
  interviewReport?: string;
  distributionTimeline?: Array<{
    description: string;
    percentage: number;
    amount: number;
    expectedDate: string;
  }>;
  interview?: {
    result: string;
    notes?: string;
    completedAt?: string;
  };
  createdAt: string;
}

export default function CommitteeApproval() {
  const { hasAnyPermission } = useRBAC();
  const canApprove = hasAnyPermission(['applications.approve', 'committee.approve']);

  const filterHook = useApplicationFilters('pending_committee_approval');

  const [applicationList, setApplicationList] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 10 });
  const [showFilters, setShowFilters] = useState(false);
  const [showInfoBanner, setShowInfoBanner] = useState(false);
  
  const [showDecisionModal, setShowDecisionModal] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [decision, setDecision] = useState<'approved' | 'rejected' | null>(null);
  const [comments, setComments] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [approvedAmount, setApprovedAmount] = useState(0);
  const [showFullDetails, setShowFullDetails] = useState(false);
  
  // Recurring payment state
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringPeriod, setRecurringPeriod] = useState<'monthly' | 'quarterly' | 'semi_annually' | 'annually'>('monthly');
  const [numberOfPayments, setNumberOfPayments] = useState(12);
  const [amountPerPayment, setAmountPerPayment] = useState(0);
  const [recurringStartDate, setRecurringStartDate] = useState('');
  
  // Distribution timeline state
  const [distributionTimeline, setDistributionTimeline] = useState([
    { id: 1, phase: "First Installment", percentage: 40, date: "" },
  ]);

  useEffect(() => {
    if (canApprove) {
      loadApplications();
    }
  }, [
    canApprove,
    filterHook.filters.currentPage,
    filterHook.filters.searchTerm,
    filterHook.filters.projectFilter,
    filterHook.filters.districtFilter,
    filterHook.filters.areaFilter,
    filterHook.filters.unitFilter,
    filterHook.filters.schemeFilter,
    filterHook.filters.fromDate,
    filterHook.filters.toDate,
    filterHook.filters.quickDateFilter,
    pagination.limit
  ]);

  if (!canApprove) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Scale className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
          <p className="text-muted-foreground">
            You don't have permission to access committee approval.
          </p>
        </div>
      </div>
    );
  }

  const loadApplications = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = filterHook.getApiParams(filterHook.filters.currentPage, pagination.limit);
      const response = await applications.getPendingCommitteeApprovals(params);
      
      if (response.success) {
        const apps = (response.data as any)?.applications;
        setApplicationList(Array.isArray(apps) ? apps : []);
        setPagination((response.data as any)?.pagination || { page: 1, pages: 1, total: 0, limit: 10 });
      } else {
        setError(response.message || "Failed to load applications");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load applications");
      toast({
        title: "Error",
        description: "Failed to load applications",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDecision = (application: Application, decisionType: 'approved' | 'rejected') => {
    setSelectedApplication(application);
    setDecision(decisionType);
    setComments("");
    setApprovedAmount(application.requestedAmount); // Initialize with requested amount
    
    // Reset recurring payment fields
    setIsRecurring(false);
    setRecurringPeriod('monthly');
    setNumberOfPayments(12);
    setAmountPerPayment(0);
    // Default to 7 days from today
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    setRecurringStartDate(sevenDaysFromNow.toISOString().split('T')[0]);
    
    // Set distribution timeline for approval
    if (decisionType === 'approved') {
      // Load the distribution timeline from interview (should always exist when forwarded)
      if (application.distributionTimeline && application.distributionTimeline.length > 0) {
        // Convert backend format to UI format
        const existingTimeline = application.distributionTimeline.map((timeline, index) => ({
          id: index + 1,
          phase: timeline.description,
          percentage: timeline.percentage,
          date: timeline.expectedDate ? new Date(timeline.expectedDate).toISOString().split('T')[0] : ""
        }));
        
        console.log('📋 Loading distribution timeline from interview:', existingTimeline);
        setDistributionTimeline(existingTimeline);
      } else {
        // This shouldn't happen if application was properly forwarded from interview
        console.warn('⚠️ No distribution timeline found from interview - application may not have been properly forwarded');
        // Set empty timeline with single phase
        setDistributionTimeline([
          { id: 1, phase: "First Installment", percentage: 100, date: "" }
        ]);
      }
    }
    
    setShowDecisionModal(true);
  };

  const handleSubmitDecision = async () => {
    if (!selectedApplication || !decision) return;

    // Validation for recurring payments
    if (decision === 'approved' && isRecurring) {
      if (!recurringStartDate) {
        toast({
          title: "Validation Error",
          description: "Please select a start date for recurring payments",
          variant: "destructive",
        });
        return;
      }
      if (numberOfPayments < 1 || numberOfPayments > 60) {
        toast({
          title: "Validation Error",
          description: "Number of cycles must be between 1 and 60",
          variant: "destructive",
        });
        return;
      }
    }

    try {
      setSubmitting(true);

      // Distribution timeline data (used for both one-time and recurring)
      const hasDistributionTimeline = distributionTimeline && distributionTimeline.length > 0 && distributionTimeline[0].phase;
      
      const timelineData = decision === 'approved' && hasDistributionTimeline ? distributionTimeline.map(phase => ({
        description: phase.phase,
        percentage: phase.percentage,
        amount: Math.round(approvedAmount * (phase.percentage / 100)),
        expectedDate: phase.date
      })) : undefined;

      // Recurring config (can be with or without timeline)
      const recurringConfig = decision === 'approved' && isRecurring ? {
        period: recurringPeriod,
        numberOfPayments: numberOfPayments,
        // If timeline exists, amount per payment will be calculated from timeline phases
        // Otherwise use the single amount
        amountPerPayment: hasDistributionTimeline ? approvedAmount : (amountPerPayment || Math.round(approvedAmount / numberOfPayments)),
        startDate: recurringStartDate,
        customAmounts: [],
        // Include timeline if both are set
        hasDistributionTimeline: hasDistributionTimeline,
        distributionTimeline: hasDistributionTimeline ? timelineData : undefined
      } : undefined;

      const response = await applications.committeeDecision(selectedApplication._id, {
        decision,
        comments,
        distributionTimeline: !isRecurring ? timelineData : undefined, // Only send timeline if not recurring (to avoid duplication)
        isRecurring: isRecurring,
        recurringConfig: recurringConfig
      });

      if (response.success) {
        const message = isRecurring && hasDistributionTimeline
          ? `Application approved with ${distributionTimeline.length}-phase timeline recurring ${numberOfPayments} times`
          : isRecurring
          ? `Application approved with ${numberOfPayments} recurring payments`
          : `Application ${decision} successfully`;
          
        toast({
          title: "Success",
          description: message,
        });
        setShowDecisionModal(false);
        loadApplications(); // Reload the list
      } else {
        toast({
          title: "Error",
          description: response.message || "Failed to process decision",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to process decision",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const addDistributionPhase = () => {
    const calculateDate = (daysFromApproval: number) => {
      const today = new Date();
      const futureDate = new Date(today);
      futureDate.setDate(today.getDate() + daysFromApproval);
      return futureDate.toISOString().split('T')[0];
    };

    setDistributionTimeline([
      ...distributionTimeline,
      { 
        id: distributionTimeline.length + 1, 
        phase: `Installment ${distributionTimeline.length + 1}`, 
        percentage: 0, 
        date: calculateDate(30)
      },
    ]);
  };

  const removeDistributionPhase = (id: number) => {
    if (distributionTimeline.length > 1) {
      setDistributionTimeline(distributionTimeline.filter(item => item.id !== id));
    }
  };

  const updateDistributionPhase = (id: number, field: string, value: any) => {
    setDistributionTimeline(distributionTimeline.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold flex items-center gap-2">
              <Scale className="h-8 w-8" />
              Final Approval
            </h1>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setShowInfoBanner(!showInfoBanner)}
              className="h-8 w-8 p-0 rounded-full hover:bg-blue-100"
            >
              <AlertCircle className={`h-5 w-5 ${showInfoBanner ? 'text-blue-600' : 'text-muted-foreground'}`} />
            </Button>
          </div>
          <p className="text-muted-foreground mt-1">Review applications from interviews - Committee approval or Direct decision</p>
          <div className="flex gap-2 mt-2">
            <Badge variant="outline" className="text-xs">
              <CheckCircle className="h-3 w-3 mr-1" />
              Committee Forwarded
            </Badge>
            <Badge variant="secondary" className="text-xs">
              <FileText className="h-3 w-3 mr-1" />
              Direct Approval
            </Badge>
          </div>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-xl font-bold">{pagination.total}</p>
              <p className="text-sm text-muted-foreground">Pending Applications</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Information Banner - Shows on icon click or Direct Approval hover */}
      {showInfoBanner && (
        <Alert className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
          <AlertCircle className="h-5 w-5 text-blue-600" />
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-semibold text-base">📋 About This Page</p>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div className="flex gap-2">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">1</div>
                  <div>
                    <p className="font-medium text-blue-900">Committee Approval Workflow</p>
                    <p className="text-muted-foreground">Applications forwarded from interviews require committee review and approval. Distribution timeline and recurring payments can be configured.</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold text-xs">2</div>
                  <div>
                    <p className="font-medium text-purple-900">Direct Approval Workflow</p>
                    <p className="text-muted-foreground">Some applications are approved directly after interview without committee review. Payments are auto-created based on the distribution timeline.</p>
                  </div>
                </div>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading applications...</span>
        </div>
      ) : error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : applicationList.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Scale className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Pending Applications</h3>
              <p className="text-muted-foreground">
                There are no applications pending committee approval at the moment.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Applications Pending Committee Review</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Application #</TableHead>
                    <TableHead>Beneficiary</TableHead>
                    <TableHead>Scheme</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Applied Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {applicationList.map((application) => (
                    <TableRow key={application._id}>
                      <TableCell className="font-medium">{application.applicationNumber}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{application.beneficiary?.name}</p>
                          <p className="text-sm text-muted-foreground">{application.beneficiary?.phone}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{application.scheme?.name}</p>
                          <p className="text-xs text-muted-foreground">{application.scheme.category}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <IndianRupee className="h-3 w-3" />
                          {application.requestedAmount.toLocaleString('en-IN')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1.5">
                          <Badge className="bg-success/10 text-success border-success/20 w-fit text-xs">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Interview Passed
                          </Badge>
                          {application.interviewReport && (
                            <Badge variant="outline" className="text-xs w-fit">
                              📋 Committee Review
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {new Date(application.createdAt).toLocaleDateString('en-IN')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenDecision(application, 'approved')}
                          >
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive"
                            onClick={() => handleOpenDecision(application, 'rejected')}
                          >
                            <XCircle className="mr-1 h-3 w-3" />
                            Reject
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>

          {pagination.pages > 1 && (
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious 
                    onClick={() => setPagination({...pagination, page: Math.max(1, pagination.page - 1)})}
                    className={pagination.page === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>
                {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((page) => (
                  <PaginationItem key={page}>
                    <PaginationLink
                      onClick={() => setPagination({...pagination, page})}
                      isActive={pagination.page === page}
                      className="cursor-pointer"
                    >
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext
                    onClick={() => setPagination({...pagination, page: Math.min(pagination.pages, pagination.page + 1)})}
                    className={pagination.page === pagination.pages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </>
      )}

      {/* Decision Modal */}
      <Dialog open={showDecisionModal} onOpenChange={setShowDecisionModal}>
        <DialogContent className="w-[95vw] md:w-[50vw] max-w-none md:max-w-[50vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{decision === 'approved' ? 'Approve Application' : 'Reject Application'}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFullDetails(!showFullDetails)}
              >
                <FileText className="h-4 w-4 mr-2" />
                {showFullDetails ? 'Hide' : 'View'} Full Details
              </Button>
            </DialogTitle>
          </DialogHeader>
          
          {selectedApplication && (
            <div className="space-y-4">
              {/* Quick Application Summary */}
              <div className="rounded-lg border p-4 bg-muted/30">
                <h3 className="font-semibold mb-3">Application Summary</h3>
                <div className="grid md:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Application #:</span>
                    <p className="font-medium">{selectedApplication.applicationNumber}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Beneficiary:</span>
                    <p className="font-medium">{selectedApplication.beneficiary?.name}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Scheme:</span>
                    <p className="font-medium">{selectedApplication.scheme?.name}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Requested Amount:</span>
                    <p className="font-medium">₹{selectedApplication.requestedAmount.toLocaleString('en-IN')}</p>
                  </div>
                </div>
              </div>

              {/* Full Application Details - Collapsible */}
              {showFullDetails && (
                <div className="rounded-lg border-2 border-blue-200 p-4 bg-blue-50/30 space-y-4">
                  <h3 className="font-semibold text-base flex items-center gap-2">
                    <User className="h-5 w-5 text-blue-600" />
                    Complete Application Details
                  </h3>
                  
                  {/* Beneficiary Details */}
                  <div className="space-y-3 rounded-lg bg-white p-3 border">
                    <h4 className="font-semibold text-sm text-blue-700">👤 Beneficiary Information</h4>
                    <div className="grid md:grid-cols-3 gap-3 text-sm">
                      {Object.entries(selectedApplication.beneficiary || {}).map(([key, value]) => {
                        if (!value || key === '_id' || key === 'id' || key === '__v' || key === 'location' || key === 'createdBy' || key === 'updatedBy' || key === 'currentStage') return null;
                        const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                        return (
                          <div key={key}>
                            <span className="text-muted-foreground text-xs">{label}</span>
                            <p className="font-medium">
                              {key === 'monthlyIncome' ? `₹${Number(value).toLocaleString('en-IN')}` : 
                               key === 'age' ? `${value} years` : 
                               String(value)}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Location Details - Only if location data exists */}
                  {(selectedApplication.state || selectedApplication.district || selectedApplication.area || selectedApplication.unit) && (
                    <div className="space-y-3 rounded-lg bg-white p-3 border">
                      <h4 className="font-semibold text-sm text-blue-700">📍 Location Information</h4>
                      <div className="grid md:grid-cols-4 gap-3 text-sm">
                        {selectedApplication.state?.name && (
                          <div>
                            <span className="text-muted-foreground text-xs">State</span>
                            <p className="font-medium">{selectedApplication.state.name}</p>
                          </div>
                        )}
                        {selectedApplication.district?.name && (
                          <div>
                            <span className="text-muted-foreground text-xs">District</span>
                            <p className="font-medium">{selectedApplication.district?.name}</p>
                          </div>
                        )}
                        {selectedApplication.area?.name && (
                          <div>
                            <span className="text-muted-foreground text-xs">Area</span>
                            <p className="font-medium">{selectedApplication.area?.name}</p>
                          </div>
                        )}
                        {selectedApplication.unit?.name && (
                          <div>
                            <span className="text-muted-foreground text-xs">Unit</span>
                            <p className="font-medium">{selectedApplication.unit.name}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Scheme & Project Details */}
                  <div className="space-y-3 rounded-lg bg-white p-3 border">
                    <h4 className="font-semibold text-sm text-blue-700">📋 Scheme & Project Information</h4>
                    <div className="grid md:grid-cols-3 gap-3 text-sm">
                      {selectedApplication.scheme?.name && (
                        <div>
                          <span className="text-muted-foreground text-xs">Scheme Name</span>
                          <p className="font-medium">{selectedApplication.scheme?.name}</p>
                        </div>
                      )}
                      {selectedApplication.scheme?.category && (
                        <div>
                          <span className="text-muted-foreground text-xs">Category</span>
                          <p className="font-medium">{selectedApplication.scheme.category}</p>
                        </div>
                      )}
                      {selectedApplication.scheme?.type && (
                        <div>
                          <span className="text-muted-foreground text-xs">Type</span>
                          <p className="font-medium capitalize">{selectedApplication.scheme.type}</p>
                        </div>
                      )}
                      {selectedApplication.project?.name && (
                        <div>
                          <span className="text-muted-foreground text-xs">Project</span>
                          <p className="font-medium">{selectedApplication.project.name}</p>
                        </div>
                      )}
                      {selectedApplication.requestedAmount && (
                        <div>
                          <span className="text-muted-foreground text-xs">Requested Amount</span>
                          <p className="font-medium text-blue-700">₹{selectedApplication.requestedAmount.toLocaleString('en-IN')}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Application Purpose */}
                  {selectedApplication.purpose && (
                    <div className="space-y-2 rounded-lg bg-white p-3 border">
                      <h4 className="font-semibold text-sm text-blue-700">💡 Application Purpose</h4>
                      <p className="text-sm">{selectedApplication.purpose}</p>
                    </div>
                  )}

                  {/* Additional Fields - Show any other data dynamically */}
                  {(() => {
                    const additionalFields = Object.entries(selectedApplication || {}).filter(([key, value]) => {
                      const excludeKeys = ['_id', 'id', '__v', 'beneficiary', 'scheme', 'project', 'state', 'district', 'area', 'unit', 
                                          'requestedAmount', 'purpose', 'createdAt', 'updatedAt', 'interview', 'interviewReport',
                                          'distributionTimeline', 'applicationNumber', 'status', 'createdBy', 'updatedBy', 'currentStage'];
                      return !excludeKeys.includes(key) && value && typeof value !== 'object';
                    });
                    
                    if (additionalFields.length === 0) return null;
                    
                    return (
                      <div className="space-y-3 rounded-lg bg-white p-3 border">
                        <h4 className="font-semibold text-sm text-blue-700">📝 Additional Information</h4>
                        <div className="grid md:grid-cols-3 gap-3 text-sm">
                          {additionalFields.map(([key, value]) => {
                            const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                            return (
                              <div key={key}>
                                <span className="text-muted-foreground text-xs">{label}</span>
                                <p className="font-medium">{String(value)}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Timeline */}
                  <div className="space-y-3 rounded-lg bg-white p-3 border">
                    <h4 className="font-semibold text-sm text-blue-700">📅 Timeline</h4>
                    <div className="grid md:grid-cols-2 gap-3 text-sm">
                      {selectedApplication.createdAt && (
                        <div>
                          <span className="text-muted-foreground text-xs">Applied On</span>
                          <p className="font-medium">{new Date(selectedApplication.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                        </div>
                      )}
                      {selectedApplication.interview?.completedAt && (
                        <div>
                          <span className="text-muted-foreground text-xs">Interview Completed</span>
                          <p className="font-medium">{new Date(selectedApplication.interview.completedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                        </div>
                      )}
                      {selectedApplication.interview?.result && (
                        <div>
                          <span className="text-muted-foreground text-xs">Interview Result</span>
                          <p className="font-medium">
                            <Badge variant={selectedApplication.interview.result === 'passed' ? 'default' : 'destructive'} className="text-xs">
                              {selectedApplication.interview.result}
                            </Badge>
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Interview Report/Notes - Show whichever is available */}
              {(selectedApplication.interviewReport || selectedApplication.interview?.notes) && (
                <div className="rounded-lg border p-4 bg-blue-50/50">
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Interview Report
                  </h3>
                  <p className="text-sm whitespace-pre-wrap">
                    {selectedApplication.interviewReport || selectedApplication.interview?.notes}
                  </p>
                </div>
              )}

              {/* Approved Amount - Only for Approval */}
              {decision === 'approved' && (
                <div className="space-y-2">
                  <Label className="font-semibold">Approved Amount <span className="text-destructive">*</span></Label>
                  <div className="relative">
                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="number"
                      placeholder="Enter approved amount"
                      value={approvedAmount}
                      onChange={(e) => {
                        const amount = Number(e.target.value);
                        setApprovedAmount(amount);
                        // Auto-calculate amount per payment if recurring is enabled
                        if (isRecurring && numberOfPayments > 0) {
                          setAmountPerPayment(Math.round(amount / numberOfPayments));
                        }
                      }}
                      className="pl-10"
                      min={0}
                      max={selectedApplication.requestedAmount}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Enter the amount approved by committee (max: ₹{selectedApplication.requestedAmount.toLocaleString('en-IN')})
                  </p>
                </div>
              )}

              {/* Recurring Payment Configuration - Only for Approval */}
              {decision === 'approved' && (
                <div className="rounded-lg border-2 border-blue-200 p-5 space-y-4 bg-gradient-to-br from-blue-50 to-blue-50/30">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Repeat className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <Label htmlFor="recurring" className="text-base font-semibold cursor-pointer flex items-center gap-2">
                          Recurring Payments
                        </Label>
                        <p className="text-xs text-muted-foreground mt-1">Enable for monthly, quarterly, or yearly payments</p>
                      </div>
                    </div>
                    <Checkbox
                      id="recurring"
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
                    <div className="space-y-4 pt-4 border-t-2 border-blue-200">
                      <Alert className="bg-blue-50 border-blue-200">
                        <AlertCircle className="h-4 w-4 text-blue-600" />
                        <AlertDescription className="text-sm">
                          <div className="font-semibold text-blue-900 mb-2">💡 Recurring Payment Modes:</div>
                          <div className="space-y-2">
                            <div className="flex items-start gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-1.5"></div>
                              <div>
                                <strong>Simple Recurring:</strong> <span className="text-muted-foreground">Same amount repeated (e.g., ₹5,000/month for ration)</span>
                              </div>
                            </div>
                            <div className="flex items-start gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-1.5"></div>
                              <div>
                                <strong>With Timeline:</strong> <span className="text-muted-foreground">Phase pattern repeats (e.g., 3-term education fees recurring yearly)</span>
                              </div>
                            </div>
                          </div>
                        </AlertDescription>
                      </Alert>

                      <div className="grid md:grid-cols-2 gap-4">
                        {/* Recurring Period */}
                        <div className="space-y-2">
                          <Label className="font-medium flex items-center gap-2">
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-xs">1</span>
                            Recurring Period <span className="text-destructive">*</span>
                          </Label>
                          <Select value={recurringPeriod} onValueChange={(value: any) => setRecurringPeriod(value)}>
                            <SelectTrigger className="h-11">
                              <SelectValue placeholder="Select frequency" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="monthly">📅 Monthly (12 payments/year)</SelectItem>
                              <SelectItem value="quarterly">📅 Quarterly (4 payments/year)</SelectItem>
                              <SelectItem value="semi_annually">📅 Semi-Annually (2 payments/year)</SelectItem>
                              <SelectItem value="annually">📅 Annually (1 payment/year)</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">How often should payments repeat?</p>
                        </div>

                        {/* Number of Payments */}
                        <div className="space-y-2">
                          <Label className="font-medium flex items-center gap-2">
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-xs">2</span>
                            Number of Cycles <span className="text-destructive">*</span>
                          </Label>
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
                            placeholder="e.g., 12 for 12 months"
                            className="h-11"
                          />
                          <p className="text-xs text-muted-foreground">
                            <strong>Max 60 cycles.</strong> How many times to repeat?
                          </p>
                        </div>

                        {/* Amount Per Payment - Only show if no distribution timeline */}
                        {distributionTimeline.length === 0 && (
                          <div className="space-y-2">
                            <Label className="font-medium">Amount Per Cycle</Label>
                            <div className="relative">
                              <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input
                                type="number"
                                value={amountPerPayment}
                                onChange={(e) => setAmountPerPayment(Number(e.target.value))}
                                className="pl-10"
                                min={0}
                                placeholder="Auto-calculated"
                              />
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {approvedAmount > 0 && numberOfPayments > 0 
                                ? `Default: ₹${Math.round(approvedAmount / numberOfPayments).toLocaleString('en-IN')}`
                                : 'Will be auto-calculated'}
                            </p>
                          </div>
                        )}

                        {/* Start Date */}
                        <div className="space-y-2">
                          <Label className="font-medium flex items-center gap-2">
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-xs">3</span>
                            Start Date <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            type="date"
                            value={recurringStartDate}
                            onChange={(e) => setRecurringStartDate(e.target.value)}
                            min={new Date().toISOString().split('T')[0]}
                            className="h-11"
                          />
                          <p className="text-xs text-muted-foreground">📅 When should the first cycle start?</p>
                        </div>
                      </div>

                      {/* Summary */}
                      <div className="bg-gradient-to-br from-white to-blue-50 rounded-lg p-4 space-y-2 text-sm border-2 border-blue-200 shadow-sm">
                        <div className="font-semibold text-blue-700 text-base flex items-center gap-2">
                          <CheckCircle className="h-4 w-4" />
                          Summary
                        </div>
                        {distributionTimeline.length > 0 ? (
                          <>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Pattern:</span>
                              <span className="font-medium">{distributionTimeline.length} phase timeline</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Amount per cycle:</span>
                              <span className="font-medium">₹{approvedAmount.toLocaleString('en-IN')}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Repeats:</span>
                              <span className="font-medium">{numberOfPayments} times ({recurringPeriod})</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Total Amount:</span>
                              <span className="font-bold text-blue-700">₹{(approvedAmount * numberOfPayments).toLocaleString('en-IN')}</span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-2 p-2 bg-blue-50 rounded">
                              Example: Each year will have {distributionTimeline.length} payments following the timeline below, repeated {numberOfPayments} times.
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Amount per payment:</span>
                              <span className="font-medium">₹{(amountPerPayment || Math.round(approvedAmount / numberOfPayments)).toLocaleString('en-IN')}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Payments:</span>
                              <span className="font-medium">{numberOfPayments} payments ({recurringPeriod})</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Total Amount:</span>
                              <span className="font-bold text-blue-700">₹{(approvedAmount * numberOfPayments).toLocaleString('en-IN')}</span>
                            </div>
                          </>
                        )}
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Starts:</span>
                          <span className="font-medium">{recurringStartDate ? new Date(recurringStartDate).toLocaleDateString('en-IN') : 'Not set'}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Distribution Timeline - Only for Approval (can work with or without recurring) */}
              {decision === 'approved' && (
                <div className="space-y-3 rounded-lg border-2 border-purple-200 p-5 bg-gradient-to-br from-purple-50 to-purple-50/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <Calendar className="h-5 w-5 text-purple-600" />
                      </div>
                      <div>
                        <Label className="text-base font-semibold">Distribution Timeline (Optional)</Label>
                        <p className="text-xs text-muted-foreground mt-1">
                          {isRecurring 
                            ? `⚡ This timeline will repeat ${numberOfPayments} times (${recurringPeriod})` 
                            : 'Break down payment into phases with dates'}
                        </p>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={addDistributionPhase}>
                      Add Phase
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {distributionTimeline.map((phase, index) => (
                      <div key={phase.id} className="grid grid-cols-12 gap-2 items-center">
                        <Input
                          className="col-span-4"
                          value={phase.phase}
                          onChange={(e) => updateDistributionPhase(phase.id, 'phase', e.target.value)}
                          placeholder="Phase name"
                        />
                        <Input
                          className="col-span-2"
                          type="number"
                          value={phase.percentage}
                          onChange={(e) => updateDistributionPhase(phase.id, 'percentage', Number(e.target.value))}
                          placeholder="%"
                          min="0"
                          max="100"
                        />
                        <div className="col-span-2 flex items-center px-3 py-2 border rounded-md bg-muted text-sm font-medium">
                          ₹{Math.round(approvedAmount * ((phase.percentage || 0) / 100)).toLocaleString('en-IN')}
                        </div>
                        <Input
                          className="col-span-3"
                          type="date"
                          value={phase.date}
                          onChange={(e) => updateDistributionPhase(phase.id, 'date', e.target.value)}
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="col-span-1"
                          onClick={() => removeDistributionPhase(phase.id)}
                          disabled={distributionTimeline.length === 1}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  
                  {/* Distribution Total Validation */}
                  {(() => {
                    const total = distributionTimeline.reduce((sum, phase) => sum + (phase.percentage || 0), 0);
                    const isValid = total === 100;
                    return (
                      <div className={`text-sm font-medium p-3 rounded-lg border ${isValid ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                        Total Distribution: {total}% {isValid ? '✓' : '(Must be 100%)'} = ₹{Math.round(approvedAmount * (total / 100)).toLocaleString('en-IN')}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Committee Comments */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">
                  Committee Comments <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Textarea
                    placeholder={`Enter committee ${decision} comments...`}
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    rows={4}
                    className="resize-none pr-12"
                  />
                  <div className="absolute right-2 top-2">
                    <VoiceToTextButton
                      onTranscript={(text) => setComments(prev => prev ? prev + ' ' + text : text)}
                      size="icon"
                      className="h-8 w-8"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDecisionModal(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmitDecision}
              disabled={
                submitting || 
                !comments.trim() || 
                (decision === 'approved' && 
                  distributionTimeline.reduce((sum, phase) => sum + (phase.percentage || 0), 0) !== 100)
              }
              className={decision === 'approved' ? "bg-success hover:bg-success/90" : ""}
              variant={decision === 'rejected' ? "destructive" : "default"}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {decision === 'approved' ? <CheckCircle className="mr-2 h-4 w-4" /> : <XCircle className="mr-2 h-4 w-4" />}
              Confirm {decision === 'approved' ? 'Approval' : 'Rejection'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
