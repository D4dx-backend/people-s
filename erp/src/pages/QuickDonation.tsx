import { useState } from "react";
import { Plus, Heart, Users, TrendingUp, IndianRupee } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QuickDonationModal } from "@/components/modals/QuickDonationModal";
import { PermissionGate } from "@/components/rbac/PermissionGate";
import { toast } from "@/hooks/use-toast";

export default function QuickDonation() {
  const [showQuickDonationModal, setShowQuickDonationModal] = useState(false);

  const handleDonationSuccess = () => {
    toast({
      title: "Success",
      description: "Donor information has been saved. You can now proceed with payment processing.",
    });
  };

  return (
    <PermissionGate permission="donors.create">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-lg font-bold">Quick Donation</h1>
          <p className="text-muted-foreground mt-1">
            Capture minimal donor information for quick donation processing
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Today's Donations</CardTitle>
              <IndianRupee className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">₹25,430</div>
              <p className="text-xs text-muted-foreground">
                +12% from yesterday
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">New Donors</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">8</div>
              <p className="text-xs text-muted-foreground">
                +3 from yesterday
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Donation</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">₹3,179</div>
              <p className="text-xs text-muted-foreground">
                +5% from last week
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Donors</CardTitle>
              <Heart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">1,247</div>
              <p className="text-xs text-muted-foreground">
                Active donors
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Action Card */}
        <Card className="border-2 border-dashed border-primary/20 hover:border-primary/40 transition-colors">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-primary/10 p-6 mb-4">
              <Heart className="h-12 w-12 text-primary" />
            </div>
            
            <h3 className="text-xl font-semibold mb-2">
              Start Quick Donation Process
            </h3>
            
            <p className="text-muted-foreground mb-6 max-w-md">
              Capture essential donor information with minimal fields. Perfect for walk-in donations, 
              events, or when you need to quickly register a new donor.
            </p>
            
            <Button 
              onClick={() => setShowQuickDonationModal(true)}
              className="bg-gradient-primary"
              size="lg"
            >
              <Plus className="mr-2 h-5 w-5" />
              New Quick Donation
            </Button>
          </CardContent>
        </Card>

        {/* Information Cards */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">What Information is Collected?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
                <div>
                  <p className="font-medium">Basic Contact Details</p>
                  <p className="text-sm text-muted-foreground">Name, phone number, and optional email</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
                <div>
                  <p className="font-medium">Donation Information</p>
                  <p className="text-sm text-muted-foreground">Amount, payment method, and purpose</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
                <div>
                  <p className="font-medium">Privacy Preferences</p>
                  <p className="text-sm text-muted-foreground">Anonymous donation and communication consent</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Benefits of Quick Donation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0" />
                <div>
                  <p className="font-medium">Faster Processing</p>
                  <p className="text-sm text-muted-foreground">Minimal fields mean quicker data entry</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0" />
                <div>
                  <p className="font-medium">Better Experience</p>
                  <p className="text-sm text-muted-foreground">Donors don't need to fill lengthy forms</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0" />
                <div>
                  <p className="font-medium">Complete Records</p>
                  <p className="text-sm text-muted-foreground">All donations are properly tracked and recorded</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Donation Modal */}
        <QuickDonationModal
          open={showQuickDonationModal}
          onOpenChange={setShowQuickDonationModal}
          onSuccess={handleDonationSuccess}
        />
      </div>
    </PermissionGate>
  );
}