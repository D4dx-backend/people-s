import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckCircle, Clock, XCircle, FileText, Loader2, IndianRupee, Calendar, User, Phone } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { beneficiaryApi } from "@/services/beneficiaryApi";
import logo from "@/assets/logo.png";

interface ApplicationData {
  _id: string;
  applicationId: string;
  scheme: {
    _id: string;
    name: string;
    category: string;
  };
  status: string;
  submittedAt: string;
  reviewedAt?: string;
  approvedAt?: string;
  requestedAmount: number;
  approvedAmount?: number;
}

export default function ApplicationTracking() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [application, setApplication] = useState<ApplicationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const phoneNumber = localStorage.getItem("user_phone") || "";
  const currentUser = beneficiaryApi.getCurrentUser();

  useEffect(() => {
    if (id) {
      loadApplicationData();
    }
  }, [id]);

  const loadApplicationData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await beneficiaryApi.trackApplication(id!);
      setApplication(response.application);
    } catch (error) {
      console.error('Failed to load application:', error);
      setError(error instanceof Error ? error.message : 'Failed to load application');
      toast({
        title: "Failed to Load Application",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading application details...</span>
        </div>
      </div>
    );
  }

  if (error || !application) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Application Not Found</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>{error || `No application found with ID: ${id}`}</p>
            <Button onClick={() => navigate("/beneficiary/dashboard")}>
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-6 w-6 text-green-600" />;
      case "current":
        return <Clock className="h-6 w-6 text-yellow-600" />;
      case "pending":
        return <Clock className="h-6 w-6 text-gray-400" />;
      default:
        return <XCircle className="h-6 w-6 text-red-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "approved":
        return "bg-green-600";
      case "completed":
        return "bg-green-700";
      case "under_review":
        return "bg-yellow-600";
      case "pending":
        return "bg-blue-600";
      case "rejected":
        return "bg-red-600";
      case "cancelled":
        return "bg-gray-600";
      default:
        return "bg-blue-600";
    }
  };

  const getStatusDisplayName = (status: string) => {
    switch (status.toLowerCase()) {
      case "under_review":
        return "Under Review";
      case "pending":
        return "Pending";
      case "approved":
        return "Approved";
      case "completed":
        return "Completed";
      case "rejected":
        return "Rejected";
      case "cancelled":
        return "Cancelled";
      default:
        return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  // Generate timeline based on application status
  const generateTimeline = (application: ApplicationData) => {
    const timeline = [
      {
        step: "Application Submitted",
        date: application.submittedAt,
        status: "completed"
      }
    ];

    const currentStatus = application.status.toLowerCase();

    // Add verification step for all applications
    if (["under_review", "approved", "completed", "rejected"].includes(currentStatus)) {
      timeline.push({
        step: "Initial Verification",
        date: application.submittedAt, // Use submitted date as placeholder
        status: "completed"
      });
    }

    // Add review step
    if (["under_review", "approved", "completed", "rejected"].includes(currentStatus)) {
      timeline.push({
        step: "Document Review",
        date: application.reviewedAt || application.submittedAt,
        status: currentStatus === "under_review" ? "current" : "completed"
      });
    }

    // Add approval/rejection step
    if (["approved", "completed"].includes(currentStatus)) {
      timeline.push({
        step: "Application Approved",
        date: application.approvedAt || application.submittedAt,
        status: "completed"
      });
    } else if (currentStatus === "rejected") {
      timeline.push({
        step: "Application Rejected",
        date: application.reviewedAt || application.submittedAt,
        status: "completed"
      });
    }

    // Add completion step for completed applications
    if (currentStatus === "completed") {
      timeline.push({
        step: "Payment Processed",
        date: application.approvedAt || application.submittedAt,
        status: "completed"
      });
    }

    // Add pending steps for applications still in progress
    if (currentStatus === "pending") {
      timeline.push({
        step: "Initial Verification",
        date: "Pending",
        status: "pending"
      });
      timeline.push({
        step: "Document Review",
        date: "Pending",
        status: "pending"
      });
      timeline.push({
        step: "Final Approval",
        date: "Pending",
        status: "pending"
      });
    } else if (currentStatus === "under_review") {
      timeline.push({
        step: "Final Approval",
        date: "Pending",
        status: "pending"
      });
    }

    return timeline;
  };

  const timeline = generateTimeline(application);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-3 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/beneficiary/dashboard")}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <img src={logo} alt="Logo" className="h-8 w-8 rounded-full" />
            <div>
              <h1 className="text-lg font-bold">Application Tracking</h1>
              <p className="text-xs text-muted-foreground hidden sm:block">+91 {phoneNumber}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-3 py-4 sm:px-4 sm:py-6 max-w-4xl">
        {/* Application Details Card */}
        <Card className="mb-6 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
              <div className="flex-1">
                <CardTitle className="text-lg sm:text-xl mb-2">{application.scheme.name}</CardTitle>
                <p className="text-sm text-muted-foreground">Application ID: {application.applicationId}</p>
                <p className="text-xs text-muted-foreground mt-1">Category: {application.scheme.category}</p>
              </div>
              <Badge className={`${getStatusColor(application.status)} flex-shrink-0`}>
                {getStatusDisplayName(application.status)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Applicant</p>
                <p className="font-semibold">{currentUser?.name || 'Beneficiary'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Contact</p>
                <p className="font-semibold">+91 {phoneNumber}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <IndianRupee className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Amount Requested</p>
                <p className="font-semibold text-lg">₹{application.requestedAmount?.toLocaleString() || 'N/A'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Applied Date</p>
                <p className="font-semibold">{new Date(application.submittedAt).toLocaleDateString()}</p>
              </div>
            </div>
            
            {/* Show approved amount if available */}
            {application.approvedAmount && application.approvedAmount > 0 && (
              <div className="flex items-center gap-2 sm:col-span-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Approved Amount</p>
                  <p className="font-semibold text-lg text-green-600">₹{application.approvedAmount.toLocaleString()}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Timeline */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-5 w-5" />
              Application Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 sm:space-y-6">
              {timeline.map((item, index) => (
                <div key={index} className="flex gap-3 sm:gap-4">
                  <div className="flex flex-col items-center">
                    {getStatusIcon(item.status)}
                    {index < timeline.length - 1 && (
                      <div className={`w-0.5 h-12 sm:h-16 mt-2 ${item.status === "completed" ? "bg-green-600" : "bg-gray-300"}`} />
                    )}
                  </div>
                  <div className="flex-1 pb-6 sm:pb-8">
                    <h3 className={`font-semibold text-sm sm:text-base ${item.status === "current" ? "text-yellow-600" : ""}`}>
                      {item.step}
                    </h3>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                      {item.date === "Pending" ? "Pending" : new Date(item.date).toLocaleDateString()}
                    </p>
                    {item.status === "current" && (
                      <Badge className="mt-2 bg-yellow-600 text-xs">In Progress</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <Button 
            variant="outline" 
            onClick={() => navigate("/beneficiary/dashboard")}
            className="w-full sm:w-auto"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          
          <Button 
            variant="outline" 
            onClick={() => navigate("/beneficiary/schemes")}
            className="w-full sm:w-auto"
          >
            <FileText className="h-4 w-4 mr-2" />
            Browse More Schemes
          </Button>
          
          {/* Refresh button */}
          <Button 
            variant="outline" 
            onClick={loadApplicationData}
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Clock className="h-4 w-4 mr-2" />
            )}
            Refresh Status
          </Button>
        </div>
      </div>
    </div>
  );
}
