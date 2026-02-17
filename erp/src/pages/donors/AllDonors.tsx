import { useState } from "react";
import { Plus, Users, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DonorModal } from "@/components/modals/DonorModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DonorList } from "@/components/donors/DonorList";
import { DonorDetails } from "@/components/donors/DonorDetails";
import { useRBAC } from "@/hooks/useRBAC";
import { Donor } from "@/types/donor";

export default function AllDonors() {
  const { hasPermission, hasAnyPermission } = useRBAC();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedDonor, setSelectedDonor] = useState<Donor | null>(null);
  const [selectedDonors, setSelectedDonors] = useState<string[]>([]);

  // Check if user has any donor read permission
  const canViewDonors = hasAnyPermission(['donors.read', 'donors.read.regional', 'donors.read.all']);

  if (!canViewDonors) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
          <p className="text-muted-foreground">
            You don't have permission to view donor information.
          </p>
        </div>
      </div>
    );
  }

  const handleEdit = (donor: Donor) => {
    setSelectedDonor(donor);
    setShowEditModal(true);
  };

  const handleView = (donor: Donor) => {
    setSelectedDonor(donor);
    setShowDetailsModal(true);
  };

  const handleCreateSuccess = () => {
    setShowCreateModal(false);
  };

  const handleEditSuccess = () => {
    setShowEditModal(false);
    setSelectedDonor(null);
  };

  const handleCloseDetails = () => {
    setShowDetailsModal(false);
    setSelectedDonor(null);
  };

  return (
    <div className="space-y-6">
      {/* Modals */}
      <DonorModal 
        open={showCreateModal} 
        onOpenChange={setShowCreateModal}
        mode="create"
      />
      
      {selectedDonor && (
        <DonorModal 
          open={showEditModal} 
          onOpenChange={setShowEditModal}
          donor={selectedDonor}
          mode="edit"
        />
      )}

      {selectedDonor && (
        <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
          <DialogContent className="max-w-[95vw] sm:max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Donor Details</DialogTitle>
            </DialogHeader>
            <DonorDetails 
              donorId={selectedDonor.id || selectedDonor._id} 
              onEdit={handleEdit}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold">All Donors</h1>
          <p className="text-muted-foreground mt-1">
            View and manage donor information (no transactions shown here)
          </p>
        </div>
        <div className="flex gap-2">
          {hasPermission('donors.create') && (
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Donor
            </Button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <CardTitle>Donor List</CardTitle>
        </CardHeader>
        <CardContent>
          <DonorList
            onEdit={handleEdit}
            onView={handleView}
            selectedDonors={selectedDonors}
            onSelectionChange={setSelectedDonors}
          />
        </CardContent>
      </Card>
    </div>
  );
}