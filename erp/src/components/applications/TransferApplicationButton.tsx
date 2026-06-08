import { useState } from "react";
import { ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { canTransferApplication } from "@/utils/transferEligibility";
import { TransferApplicationModal, TransferApplicationTarget } from "@/components/modals/TransferApplicationModal";

interface TransferApplicationButtonProps {
  application: (TransferApplicationTarget & { status?: string | null }) | null;
  onTransferred?: () => void;
  /** "icon" = compact icon-only button (tables), "default" = labelled button (cards). */
  variant?: "icon" | "default";
  className?: string;
}

/**
 * Self-contained transfer action: renders nothing unless the current user is
 * allowed to transfer the given application. Encapsulates the modal so any list
 * view can drop it into its row/card actions with a single line.
 */
export function TransferApplicationButton({
  application,
  onTransferred,
  variant = "icon",
  className,
}: TransferApplicationButtonProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  if (!application || !canTransferApplication(user, application)) return null;

  return (
    <>
      {variant === "icon" ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
          title="Transfer Application"
          className={className}
        >
          <ArrowRightLeft className="h-4 w-4" />
        </Button>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)} className={className}>
          <ArrowRightLeft className="mr-2 h-4 w-4" />
          Transfer
        </Button>
      )}

      <TransferApplicationModal
        isOpen={open}
        onClose={() => setOpen(false)}
        application={application}
        onTransferred={onTransferred}
      />
    </>
  );
}
