import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { beneficiaryApi } from "@/services/beneficiaryApi";

interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DeleteAccountModal({ isOpen, onClose }: DeleteAccountModalProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleClose = () => {
    if (isDeleting) return;
    setStep(1);
    onClose();
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      await beneficiaryApi.deleteAccount();
      toast({
        title: "Account Deleted",
        description: "Your account has been removed. You can register again with the same number.",
      });
      navigate("/beneficiary-login", { replace: true });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete account. Please try again.",
        variant: "destructive",
      });
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        {step === 1 && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                <DialogTitle className="text-destructive">Delete Account</DialogTitle>
              </div>
              <DialogDescription className="space-y-3 pt-2">
                <p>Are you sure you want to delete your account? Here's what will happen:</p>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  <li>You will be logged out immediately.</li>
                  <li>Your account will be removed from the portal.</li>
                  <li>
                    If you register again with the same mobile number, it will open a{" "}
                    <strong>fresh registration</strong> — no previous data will be visible.
                  </li>
                  <li className="text-muted-foreground">
                    Your historical records are retained by the organisation for internal
                    reports and analysis as required by NGO compliance guidelines.
                  </li>
                </ul>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex gap-2 sm:justify-end">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={() => setStep(2)}>
                Continue
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 2 && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                <DialogTitle className="text-destructive">Confirm Deletion</DialogTitle>
              </div>
              <DialogDescription className="pt-2">
                This action <strong>cannot be undone</strong>. You will be logged out and
                your account access will be permanently removed.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex gap-2 sm:justify-end">
              <Button variant="outline" onClick={() => setStep(1)} disabled={isDeleting}>
                Go Back
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Yes, Delete My Account"
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
