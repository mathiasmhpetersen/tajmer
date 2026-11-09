import { AlertCircle, Inbox, RefreshCw } from "lucide-react";
import { Button } from "./ui/Button";

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-card border border-hairline bg-card px-6 py-16 text-center">
      <div className="flex size-11 items-center justify-center rounded-full bg-[rgb(240,120,110)]/15 text-[rgb(240,120,110)]">
        <AlertCircle className="size-5" />
      </div>
      <h3 className="mt-4 text-base font-semibold">Kunne ikke hente data</h3>
      <p className="mt-1.5 max-w-md text-sm text-muted">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-5" onClick={onRetry}>
          <RefreshCw className="size-3.5" /> Prøv igen
        </Button>
      )}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-hairline bg-card/50 px-6 py-16 text-center">
      <div className="flex size-11 items-center justify-center rounded-full bg-card-2 text-faint">
        <Inbox className="size-5" />
      </div>
      <p className="mt-4 text-sm text-muted">{message}</p>
    </div>
  );
}
