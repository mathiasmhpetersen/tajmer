import { useState } from "react";
import { Button, type ButtonProps } from "@/components/ui/Button";

/**
 * A button that swaps to an inline "Bekræft? [Ja] [Annuller]" step before firing
 * its action — used for the bulk approvals (§2).
 */
export function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
  loading,
  disabled,
  variant = "secondary",
  size = "sm",
}: {
  label: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
}) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button
        variant={variant}
        size={size}
        disabled={disabled}
        loading={loading}
        onClick={() => setConfirming(true)}
      >
        {label}
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-[13px] text-muted">{confirmLabel}</span>
      <Button
        variant="primary"
        size={size}
        loading={loading}
        onClick={() => {
          setConfirming(false);
          onConfirm();
        }}
      >
        Ja
      </Button>
      <Button variant="ghost" size={size} onClick={() => setConfirming(false)}>
        Annuller
      </Button>
    </div>
  );
}
