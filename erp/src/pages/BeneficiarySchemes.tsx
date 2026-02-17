import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Search, FileText, Calendar, IndianRupee, Users, Clock, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { beneficiaryApi } from "@/services/beneficiaryApi";
import logo from "@/assets/logo.png";

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
  hasFormConfiguration: boolean;
  isUrgent: boolean;
  isPopular: boolean;
  isNew: boolean;
}

export default function BeneficiarySchemes() {
  const navigate = useNavigate();
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [filteredSchemes, setFilteredSchemes] = useState<Scheme[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [isLoading, setIsLoading] = useState(true);

  const phoneNumber = localStorage.getItem("user_phone") || "";
  const categories = ["all", ...Array.from(new Set(schemes.map(s => s.category)))];



  // Load schemes on component mount
  useEffect(() => {
    loadSchemes();
  }, []);

  // Filter schemes when search or category changes
  useEffect(() => {
    let filtered = schemes;

    if (searchTerm) {
      filtered = filtered.filter(scheme =>
        scheme.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        scheme.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedCategory !== "all") {
      filtered = filtered.filter(scheme => scheme.category === selectedCategory);
    }

    setFilteredSchemes(filtered);
  }, [searchTerm, selectedCategory, schemes]);

  const loadSchemes = async () => {
    try {
      setIsLoading(true);
      const response = await beneficiaryApi.getAvailableSchemes();
      setSchemes(response.schemes);
      setFilteredSchemes(response.schemes);
      
      // Show summary toast
      if (response.summary) {
        const { totalActive, notApplied, urgent } = response.summary;
        toast({
          title: "Schemes Loaded",
          description: `${totalActive} active schemes found. ${notApplied} available to apply${urgent > 0 ? `, ${urgent} urgent` : ''}.`,
        });
      }
    } catch (error) {
      toast({
        title: "Failed to Load Schemes",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyScheme = (scheme: Scheme) => {
    if ((scheme as any).hasDraft) {
      // Has a draft - navigate to continue it
      navigate(`/beneficiary/apply/${scheme._id}?draftId=${(scheme as any).draftApplicationId}`, { state: { scheme } });
      return;
    }

    if (scheme.hasApplied) {
      // If already applied, navigate to application details instead
      toast({
        title: "Already Applied",
        description: "You have already applied for this scheme",
        variant: "destructive",
      });
      return;
    }

    if (!scheme.hasFormConfiguration) {
      toast({
        title: "Form Not Available",
        description: "The application form for this scheme is not ready yet",
        variant: "destructive",
      });
      return;
    }

    navigate(`/beneficiary/apply/${scheme._id}`, { state: { scheme } });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical": return "bg-red-600";
      case "high": return "bg-orange-600";
      case "medium": return "bg-blue-600";
      case "low": return "bg-gray-600";
      default: return "bg-gray-600";
    }
  };

  const getBenefitTypeIcon = (type: string) => {
    switch (type) {
      case "cash": return "₹";
      case "scholarship": return "🎓";
      case "loan": return "🏦";
      case "subsidy": return "💰";
      case "service": return "🛠️";
      case "kind": return "📦";
      default: return "💝";
    }
  };

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
              <h1 className="text-lg font-bold">Available Schemes</h1>
              <p className="text-xs text-muted-foreground hidden sm:block">+91 {phoneNumber}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-3 py-4 sm:px-4 sm:py-6">
        {/* Search and Filter */}
        <div className="space-y-3 mb-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search schemes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Category Filter */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {categories.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(category)}
                className="whitespace-nowrap"
              >
                {category === "all" ? "All Categories" : category}
              </Button>
            ))}
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading schemes...</span>
          </div>
        )}

        {/* Schemes Grid */}
        {!isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSchemes.map((scheme) => (
            <Card key={scheme._id} className={`hover:shadow-lg transition-shadow ${scheme.hasApplied ? 'border-blue-200 bg-blue-50/30' : ''}`}>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start gap-2 mb-2">
                  <div className="flex gap-1">
                    <Badge className={`${getPriorityColor(scheme.priority)} text-xs`}>
                      {scheme.priority}
                    </Badge>
                    {scheme.isUrgent && (
                      <Badge variant="outline" className="text-xs text-red-600 border-red-600">
                        <Clock className="h-3 w-3 mr-1" />
                        {scheme.daysRemaining} days left
                      </Badge>
                    )}
                    {scheme.isNew && (
                      <Badge variant="outline" className="text-xs text-green-600 border-green-600">
                        New
                      </Badge>
                    )}
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {scheme.category}
                  </Badge>
                </div>
                
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{scheme.name}</CardTitle>
                    <CardDescription className="text-sm line-clamp-2 mt-1">
                      {scheme.description}
                    </CardDescription>
                  </div>
                  <div className="text-2xl">{getBenefitTypeIcon(scheme.benefitType)}</div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Application Status */}
                {(scheme as any).hasDraft && (
                  <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                      <span className="text-sm font-medium text-amber-800">Draft Saved</span>
                    </div>
                    <p className="text-xs text-amber-600 mt-1">
                      You have a saved draft. Click "Continue Draft" to resume.
                    </p>
                  </div>
                )}
                {scheme.hasApplied && !(scheme as any).hasDraft && (
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-800">Already Applied</span>
                    </div>
                    <p className="text-xs text-blue-600 mt-1">
                      Status: {scheme.existingApplicationStatus?.replace('_', ' ').toUpperCase()}
                    </p>
                  </div>
                )}

                {/* Key Information */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <IndianRupee className="h-4 w-4 text-green-600" />
                    <span className="font-semibold">
                      {scheme.benefitFrequency === 'one_time' ? 'Up to' : 'Per ' + scheme.benefitFrequency.replace('_', ' ')} ₹{scheme.maxAmount?.toLocaleString() || 'Amount varies'}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>{scheme.beneficiariesCount} beneficiaries</span>
                    {scheme.successRate > 0 && (
                      <span className="text-green-600">• {scheme.successRate}% success rate</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4" />
                    <span className={scheme.isUrgent ? "text-red-600 font-semibold" : ""}>
                      Deadline: {new Date(scheme.applicationDeadline).toLocaleDateString()}
                    </span>
                  </div>

                  {scheme.requiresInterview && (
                    <div className="flex items-center gap-2 text-sm text-orange-600">
                      <FileText className="h-4 w-4" />
                      <span>Interview required</span>
                    </div>
                  )}
                </div>

                {/* Eligibility Preview */}
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">Key Eligibility:</h4>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    {scheme.eligibilityCriteria.slice(0, 2).map((criteria, index) => (
                      <li key={index} className="flex items-start gap-1">
                        <span className="text-green-600 mt-0.5">•</span>
                        <span>{criteria}</span>
                      </li>
                    ))}
                    {scheme.eligibilityCriteria.length > 2 && (
                      <li className="text-xs text-muted-foreground">
                        +{scheme.eligibilityCriteria.length - 2} more criteria
                      </li>
                    )}
                  </ul>
                </div>

                {/* Apply Button */}
                <Button
                  className={`w-full ${(scheme as any).hasDraft ? 'bg-amber-600 hover:bg-amber-700' : ''}`}
                  onClick={() => handleApplyScheme(scheme)}
                  disabled={scheme.hasApplied && !(scheme as any).hasDraft || !scheme.hasFormConfiguration}
                  variant={scheme.hasApplied && !(scheme as any).hasDraft ? "outline" : "default"}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  {(scheme as any).hasDraft
                    ? "Continue Draft"
                    : scheme.hasApplied 
                      ? "Already Applied" 
                      : !scheme.hasFormConfiguration 
                        ? "Form Not Available" 
                        : "Apply Now"
                  }
                </Button>
              </CardContent>
            </Card>
            ))}
          </div>
        )}

        {!isLoading && filteredSchemes.length === 0 && (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No schemes found</h3>
            <p className="text-muted-foreground">
              Try adjusting your search or filter criteria
            </p>
          </div>
        )}
      </div>
    </div>
  );
}