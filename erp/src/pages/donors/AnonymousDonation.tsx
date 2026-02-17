import { useState } from "react";
import { Gift, Heart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DonationModal } from "@/components/modals/DonationModal";
import { Button } from "@/components/ui/button";

export default function AnonymousDonation() {
  const [showDonationModal, setShowDonationModal] = useState(false);

  const handleAnonymousDonation = () => {
    setShowDonationModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Donation Modal */}
      <DonationModal
        open={showDonationModal}
        onOpenChange={setShowDonationModal}
        donor={null}
        isAnonymous={true}
      />

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold">Anonymous Donation</h1>
          <p className="text-muted-foreground mt-1">
            Record anonymous donations without donor details
          </p>
        </div>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5" />
            Anonymous Donation Entry
          </CardTitle>
          <p className="text-muted-foreground">
            Record donations from donors who wish to remain anonymous
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center py-8">
            <Heart className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Record Anonymous Donation</h3>
            <p className="text-muted-foreground mb-6">
              No donor details will be recorded - only the donation amount and purpose
            </p>
            <Button 
              onClick={handleAnonymousDonation}
              className="bg-gradient-primary"
              size="lg"
            >
              <Gift className="mr-2 h-5 w-5" />
              Record Anonymous Donation
            </Button>
          </div>
          
          <div className="bg-muted/50 p-4 rounded-lg">
            <h4 className="font-medium mb-2">Anonymous Donation Benefits:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Complete privacy for the donor</li>
              <li>• Quick and simple recording process</li>
              <li>• No personal information stored</li>
              <li>• Still tracks donation amounts and purposes</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}