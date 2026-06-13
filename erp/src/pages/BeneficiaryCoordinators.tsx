import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Phone, RefreshCw, Loader2, Headset, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { beneficiaryApi, type BeneficiaryCoordinator } from "@/services/beneficiaryApi";
import { useOrgLogoUrl } from "@/hooks/useOrgLogoUrl";
import defaultLogo from "@/assets/logo.png";
import { toast } from "@/hooks/use-toast";

const ROLE_ACCENT: Record<string, string> = {
  unit_admin: "bg-emerald-100 text-emerald-700",
  area_admin: "bg-blue-100 text-blue-700",
  district_admin: "bg-orange-100 text-orange-700",
};

export default function BeneficiaryCoordinators() {
  const navigate = useNavigate();
  const orgLogoUrl = useOrgLogoUrl();
  const phoneNumber = localStorage.getItem("user_phone") || "";

  const [coordinators, setCoordinators] = useState<BeneficiaryCoordinator[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCoordinators = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await beneficiaryApi.getCoordinators();
      const list = (res.coordinators || []).filter(
        (c) => (c.name && c.name.trim()) || (c.phone && c.phone.trim())
      );
      setCoordinators(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load coordinators");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCoordinators();
  }, [loadCoordinators]);

  const handleCall = (phone: string) => {
    const sanitized = phone.replace(/[^0-9+]/g, "");
    if (!sanitized) {
      toast({
        title: "No phone number",
        description: "This coordinator does not have a contact number on file.",
        variant: "destructive",
      });
      return;
    }
    window.location.href = `tel:${sanitized}`;
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
            <img
              src={orgLogoUrl}
              alt="Logo"
              className="h-8 w-8 rounded-full"
              onError={(e) => {
                (e.target as HTMLImageElement).src = defaultLogo;
              }}
            />
            <div>
              <h1 className="text-lg font-bold">Contact Coordinator</h1>
              <p className="text-xs text-muted-foreground hidden sm:block">
                +91 {phoneNumber}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadCoordinators}
            disabled={isLoading}
            className="hidden sm:flex"
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-3 py-6 sm:px-4 max-w-2xl">
        <div className="mb-6">
          <h2 className="text-xl font-bold">Your Coordinators</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Reach out to the team handling your area for any help.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Loading your coordinators...</span>
            </div>
          </div>
        ) : error ? (
          <Card>
            <CardContent className="py-12 text-center space-y-4">
              <Headset className="h-12 w-12 text-muted-foreground mx-auto opacity-40" />
              <div>
                <p className="font-medium">Something went wrong</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Unable to load your coordinators. Please try again.
                </p>
              </div>
              <Button variant="outline" onClick={loadCoordinators}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : coordinators.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center space-y-4">
              <Headset className="h-12 w-12 text-muted-foreground mx-auto opacity-40" />
              <div>
                <p className="font-medium">No coordinators found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  We could not find coordinators for your location yet.
                </p>
              </div>
              <Button variant="outline" onClick={loadCoordinators}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {coordinators.map((c, idx) => (
              <Card key={`${c.role}-${idx}`} className="shadow-sm">
                <CardContent className="p-4 flex items-center gap-4">
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-semibold ${
                      ROLE_ACCENT[c.role] || "bg-muted text-foreground"
                    }`}
                  >
                    {(c.name || c.roleLabel || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{c.name || c.roleLabel}</p>
                    <p className="text-xs text-muted-foreground">{c.roleLabel}</p>
                    {c.location && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {c.location}
                      </p>
                    )}
                    {c.phone && (
                      <p className="mt-0.5 text-sm font-medium">{c.phone}</p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleCall(c.phone)}
                    disabled={!c.phone}
                  >
                    <Phone className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Call</span>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
