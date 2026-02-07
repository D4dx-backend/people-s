import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { ArrowRight, Calendar, IndianRupee, Users, Loader2, AlertCircle, LogIn } from "lucide-react";
import logo from "@/assets/logo.png";
import { beneficiaryApi } from "@/services/beneficiaryApi";

interface Scheme {
  _id: string;
  name: string;
  description: string;
  category: string;
  benefits: {
    type: string;
    amount?: number;
    minAmount?: number;
    maxAmount?: number;
  };
  applicationSettings: {
    endDate: string;
  };
  statistics?: {
    totalBeneficiaries?: number;
  };
}

export default function PublicSchemes() {
  const navigate = useNavigate();
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isLoggedIn = localStorage.getItem("beneficiary_token");

  useEffect(() => {
    if (isLoggedIn) {
      loadSchemes();
    } else {
      setLoading(false);
    }
  }, [isLoggedIn]);

  const loadSchemes = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await beneficiaryApi.getAvailableSchemes();
      if (response.schemes && Array.isArray(response.schemes)) {
        setSchemes(response.schemes);
      } else {
        setSchemes([]);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load schemes");
      setSchemes([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSchemeClick = (schemeId: string) => {
    if (!isLoggedIn) {
      navigate("/beneficiary-login");
    } else {
      navigate(`/beneficiary/apply/${schemeId}`);
    }
  };

  const formatAmount = (scheme: Scheme) => {
    if (scheme.beneficiaries?.minAmount && scheme.beneficiaries?.maxAmount) {
      return `₹${scheme.beneficiaries.minAmount.toLocaleString()} - ₹${scheme.beneficiaries.maxAmount.toLocaleString()}`;
    }
    if (scheme.beneficiaries?.amount) {
      return `₹${scheme.beneficiaries.amount.toLocaleString()}`;
    }
    return "Amount varies";
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Logo" className="h-12 w-12 rounded-full" />
            <div>
              <h1 className="text-lg font-bold">People's Foundation ERP</h1>
              <p className="text-xs text-muted-foreground">Empowering Communities</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/")}>
              Home
            </Button>
            <Button onClick={() => navigate("/login")}>
              Login
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-primary py-12">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-primary-foreground mb-4">
            Available Schemes
          </h1>
          <p className="text-lg text-primary-foreground/90 max-w-2xl mx-auto">
            Browse and apply for various assistance programs designed to support our community
          </p>
        </div>
      </section>

      {/* Schemes Grid */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin mr-2" />
              <span className="text-muted-foreground">Loading schemes...</span>
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : !isLoggedIn ? (
            <EmptyState
              icon={LogIn}
              title="Login Required"
              description="Please log in to view available schemes and apply for assistance programs."
              action={{
                label: "Go to Login",
                onClick: () => navigate("/beneficiary-login"),
              }}
            />
          ) : schemes.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No Schemes Available"
              description="There are currently no active schemes available. Please check back later."
            />
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {schemes.map((scheme) => (
                <Card 
                  key={scheme._id} 
                  className="hover:shadow-elegant transition-all duration-300 hover:-translate-y-1 cursor-pointer"
                  onClick={() => handleSchemeClick(scheme._id)}
                >
                  <CardHeader>
                    <div className="flex justify-between items-start mb-2">
                      <CardTitle className="text-xl">{scheme.name}</CardTitle>
                      <Badge variant="default" className="bg-green-600">
                        Active
                      </Badge>
                    </div>
                    <CardDescription className="line-clamp-2">
                      {scheme.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <IndianRupee className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold">{formatAmount(scheme)}</span>
                    </div>
                    {scheme.applicationSettings?.endDate && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span>Deadline: {new Date(scheme.applicationSettings.endDate).toLocaleDateString()}</span>
                      </div>
                    )}
                    {scheme.statistics?.totalBeneficiaries && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span>{scheme.statistics.totalBeneficiaries} Beneficiaries</span>
                      </div>
                    )}
                    <Button className="w-full mt-4" variant="default">
                      Apply Now
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t py-8 mt-12">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>&copy; 2025 People's Foundation ERP. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
