import { useState } from "react";
import { Plus, Gift, Zap, UserPlus, History, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DonationModal } from "@/components/modals/DonationModal";
import { DonorModal } from "@/components/modals/DonorModal";
import { DonorSearch } from "@/components/donors/DonorSearch";
import { useRecentDonations } from "@/hooks/useDonations";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useRBAC } from "@/hooks/useRBAC";
import { Donor } from "@/types/donor";

export default function Donations() {
  const { hasPermission } = useRBAC();
  const [showQuickDonationDialog, setShowQuickDonationDialog] = useState(false);
  const [showAnonymousDonationModal, setShowAnonymousDonationModal] = useState(false);
  const [showDonorModal, setShowDonorModal] = useState(false);
  const [showDonationModal, setShowDonationModal] = useState(false);
  const [selectedDonor, setSelectedDonor] = useState<Donor | null>(null);
  const [newlyCreatedDonor, setNewlyCreatedDonor] = useState<Donor | null>(null);
  const [newDonorStep, setNewDonorStep] = useState<'donor' | 'donation'>('donor');

  // Get recent donations (last 20)
  const { data: donationsData, isLoading } = useRecentDonations(20);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const handleNewDonorCreated = (donor: Donor) => {
    setNewlyCreatedDonor(donor);
    setNewDonorStep('donation'); // Move to donation step
  };

  const handleDonorSelect = (donor: Donor) => {
    setSelectedDonor(donor);
    setShowQuickDonationDialog(false);
    setShowDonationModal(true);
  };

  const resetNewDonorFlow = () => {
    setShowDonorModal(false);
    setNewlyCreatedDonor(null);
    setNewDonorStep('donor');
  };

  const resetQuickDonationFlow = () => {
    setShowQuickDonationDialog(false);
    setSelectedDonor(null);
    setShowDonationModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Modals */}
      
      {/* Quick Donation Dialog with Donor Search */}
      <Dialog open={showQuickDonationDialog} onOpenChange={setShowQuickDonationDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Quick Donation - Search Donor
            </DialogTitle>
          </DialogHeader>
          <DonorSearch
            onDonorSelect={handleDonorSelect}
            onCreateNew={() => {
              setShowQuickDonationDialog(false);
              setShowDonorModal(true);
            }}
            skipAnonymousChoice={true}
          />
        </DialogContent>
      </Dialog>

      {/* Anonymous Donation Modal */}
      <DonationModal
        open={showAnonymousDonationModal}
        onOpenChange={setShowAnonymousDonationModal}
        donor={null}
        isAnonymous={true}
      />

      {/* New Donor Modal (Step 1) */}
      <DonorModal
        open={showDonorModal && newDonorStep === 'donor'}
        onOpenChange={(open) => {
          if (!open) resetNewDonorFlow();
        }}
        mode="create"
        onSuccess={handleNewDonorCreated}
      />

      {/* New Donor Donation Modal (Step 2) */}
      <DonationModal
        open={newDonorStep === 'donation' && !!newlyCreatedDonor}
        onOpenChange={(open) => {
          if (!open) resetNewDonorFlow();
        }}
        donor={newlyCreatedDonor ? {
          id: newlyCreatedDonor.id,
          name: newlyCreatedDonor.name,
          phone: newlyCreatedDonor.phone,
          email: newlyCreatedDonor.email,
        } : null}
        isAnonymous={false}
      />

      {/* Selected Donor Donation Modal */}
      <DonationModal
        open={showDonationModal}
        onOpenChange={(open) => {
          setShowDonationModal(open);
          if (!open) {
            setSelectedDonor(null);
          }
        }}
        donor={selectedDonor ? {
          id: selectedDonor.id,
          name: selectedDonor.name,
          phone: selectedDonor.phone,
          email: selectedDonor.email,
        } : null}
        isAnonymous={false}
      />

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold">Donations</h1>
          <p className="text-muted-foreground mt-1">
            Record donations and view donation history
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setShowQuickDonationDialog(true)}>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 bg-blue-100 text-blue-600 rounded-lg">
                <Search className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold">Quick Donation</h3>
                <p className="text-sm text-muted-foreground">Search donor & record donation</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setShowAnonymousDonationModal(true)}>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 bg-purple-100 text-purple-600 rounded-lg">
                <Gift className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold">Anonymous Donation</h3>
                <p className="text-sm text-muted-foreground">Record without donor details</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setShowDonorModal(true)}>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 bg-green-100 text-green-600 rounded-lg">
                <UserPlus className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold">Add New Donor + Donation</h3>
                <p className="text-sm text-muted-foreground">2-step: Create donor → Record donation</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Donations List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Recent Donations
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Loading donations...</p>
            </div>
          ) : (donationsData?.donations?.length) ? (
            <div className="space-y-4">
              {(donationsData?.donations || []).map((donation) => (
                <div key={donation.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-gradient-to-r from-green-500 to-blue-600 text-white">
                          {donation.donor?.name ? donation.donor.name.charAt(0) : '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h4 className="font-medium">
                          {donation.donor?.name || 'Anonymous Donor'}
                        </h4>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>{new Date(donation.createdAt).toLocaleDateString()}</span>
                          <span>Method: {donation.method}</span>
                          <span>Purpose: {donation.purpose}</span>
                          {donation.donationNumber && <span>#{donation.donationNumber}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg text-green-600">
                        {formatCurrency(donation.amount)}
                      </p>
                      <Badge className={getStatusColor(donation.status)}>
                        {donation.status}
                      </Badge>
                    </div>
                  </div>
                  {donation.receiptNumber && (
                    <div className="mt-2 text-sm text-muted-foreground">
                      Receipt: {donation.receiptNumber}
                    </div>
                  )}
                  {donation.notes && (
                    <div className="mt-2 text-sm text-muted-foreground">
                      Notes: {donation.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Gift className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-medium mb-2">No donations yet</h3>
              <p className="text-muted-foreground mb-4">
                Start recording donations using the quick actions above.
              </p>
              <Button onClick={() => setShowQuickDonationDialog(true)} className="bg-gradient-primary">
                <Plus className="mr-2 h-4 w-4" />
                Record First Donation
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}