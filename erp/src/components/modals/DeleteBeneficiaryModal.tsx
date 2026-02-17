import React, { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/button';
import { beneficiaries } from '../../lib/api';
import { useToast } from '@/hooks/use-toast';

interface Beneficiary {
  _id: string;
  name: string;
  phone: string;
  applications: string[];
}

interface DeleteBeneficiaryModalProps {
  isOpen: boolean;
  beneficiary: Beneficiary | null;
  onClose: (shouldRefresh?: boolean) => void;
}

export const DeleteBeneficiaryModal: React.FC<DeleteBeneficiaryModalProps> = ({
  isOpen,
  beneficiary,
  onClose
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  if (!isOpen || !beneficiary) {
    return null;
  }

  const handleDelete = async () => {
    setLoading(true);
    try {
      await beneficiaries.delete(beneficiary._id);
      toast({
        title: "Success",
        description: "Beneficiary deleted successfully"
      });
      onClose(true);
    } catch (error: any) {
      console.error('Error deleting beneficiary:', error);
      toast({
        title: "Error",
        description: error.message || error.response?.data?.message || "Failed to delete beneficiary",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const hasApplications = beneficiary.applications && beneficiary.applications.length > 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full min-w-[60vw]">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Delete Beneficiary</h2>
          <button
            onClick={() => onClose()}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                Are you sure you want to delete this beneficiary?
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                This action cannot be undone.
              </p>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <div className="text-sm">
              <div className="font-medium text-gray-900">{beneficiary.name}</div>
              <div className="text-gray-500">{beneficiary.phone}</div>
              {hasApplications && (
                <div className="text-red-600 mt-2">
                  ⚠️ This beneficiary has {beneficiary.applications.length} application(s)
                </div>
              )}
            </div>
          </div>

          {hasApplications && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <div className="text-sm text-red-800">
                <strong>Warning:</strong> This beneficiary cannot be deleted because they have existing applications. 
                Please remove or transfer the applications first.
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onClose()}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={loading || hasApplications}
            >
              {loading ? 'Deleting...' : 'Delete Beneficiary'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};