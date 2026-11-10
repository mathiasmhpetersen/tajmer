import { useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckSquare,
  ExternalLink,
  Play,
  Square,
} from "lucide-react";
import {
  PREVIEW_STATUS_LABEL,
  type PreviewAd,
  type PreviewStatus,
  type Role,
} from "@shared/types";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ctaLabel } from "@/lib/cta";

const FRAME_WIDTH = 335;
const FRAME_HEIGHT = 620;

const STATUS_TONE: Record<PreviewStatus, "neutral" | "success" | "warning"> = {
  afventer: "neutral",
  godkendt: "success",
  rettelser: "warning",
};

export function roleLabel(role: Role): string {
  return role === "admin" ? "Marketingly" : "Kunde";
}

function PreviewFrame({ ad }: { ad: PreviewAd }) {
  const { preview } = ad;
  const [failed, setFailed] = useState(false);

  if (preview.iframeSrc && !failed) {
    return (
      <div
        className="relative mx-auto overflow-hidden rounded-tile bg-white"
        style={{ width: "100%", maxWidth: FRAME_WIDTH, height: FRAME_HEIGHT }}
      >
        <iframe
          title={ad.adName}
          src={preview.iframeSrc}
          width={FRAME_WIDTH}
          height={FRAME_HEIGHT}
          scrolling="no"
          allow="autoplay; encrypted-media"
          loading="lazy"
          onError={() => setFailed(true)}
          className="no-scrollbar block h-full w-full border-0"
        />
      </div>
    );
  }

  // Fallback: media + text if the Graph preview fails.
  return (
    <div
      className="mx-auto flex flex-col overflow-hidden rounded-tile border border-black/10 bg-white text-[#050505]"
      style={{ width: "100%", maxWidth: FRAME_WIDTH }}
    >
      {preview.body && (
        <p className="px-3 pb-2 pt-3 text-[13px] leading-snug line-clamp-3">{preview.body}</p>
      )}
      <div className="relative aspect-[4/5] w-full bg-[#e9eaed]">
        {preview.thumbnailUrl && (
          <img src={preview.thumbnailUrl} alt="" className="h-full w-full object-cover" />
        )}
        {preview.isVideo && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-black/45">
              <Play className="size-6 translate-x-0.5 fill-white text-white" />
            </span>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 bg-[#f0f2f5] px-3 py-2.5">
        <div className="truncate text-[13px] font-semibold">{preview.title ?? "tajmer.dk"}</div>
        {preview.ctaType && (
          <span className="shrink-0 rounded-md bg-[#e4e6eb] px-3 py-1.5 text-[13px] font-medium">
            {ctaLabel(preview.ctaType)}
          </span>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-faint">{label}</div>
      <p className="mt-0.5 whitespace-pre-line text-[13px] leading-snug text-ink">{value}</p>
    </div>
  );
}

export interface PreviewAdCardProps {
  ad: PreviewAd;
  isClient: boolean;
  onApprove: (ad: PreviewAd, approved: boolean) => Promise<void>;
  onFeedback: (ad: PreviewAd, text: string) => Promise<void>;
  onResolve: (
    ad: PreviewAd,
    feedbackId: string,
    opts: { note?: string; fixedAdId?: string },
  ) => Promise<void>;
}

export function PreviewAdCard({ ad, isClient, onApprove, onFeedback, onResolve }: PreviewAdCardProps) {
  const [approving, setApproving] = useState(false);
  const [sending, setSending] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolveFormId, setResolveFormId] = useState<string | null>(null);
  const [resolveNote, setResolveNote] = useState("");
  const [resolveFixedAdId, setResolveFixedAdId] = useState("");
  const [text, setText] = useState("");

  const submitResolve = async (feedbackId: string) => {
    setResolvingId(feedbackId);
    try {
      await onResolve(ad, feedbackId, {
        note: resolveNote.trim() || undefined,
        fixedAdId: resolveFixedAdId.trim() || undefined,
      });
      setResolveFormId(null);
      setResolveNote("");
      setResolveFixedAdId("");
    } finally {
      setResolvingId(null);
    }
  };

  const approved = ad.status === "godkendt";
  const corrections = ad.status === "rettelser";
  const openCount = ad.feedback.filter((f) => !f.resolved).length;
  const dateRange = [formatDate(ad.startTime), formatDate(ad.endTime)].filter(Boolean);

  const toggleApprove = async () => {
    setApproving(true);
    try {
      await onApprove(ad, !approved);
    } finally {
      setApproving(false);
    }
  };

  const submitFeedback = async () => {
    const value = text.trim();
    if (!value) return;
    setSending(true);
    try {
      await onFeedback(ad, value);
      setText("");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-card border border-hairline bg-card p-4">
      {/* Name + status */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 truncate text-[13px] font-semibold text-ink">{ad.adName}</div>
        <Badge tone={STATUS_TONE[ad.status]} className="shrink-0">
          {PREVIEW_STATUS_LABEL[ad.status]}
        </Badge>
      </div>

      <PreviewFrame ad={ad} />

      {/* Creative fields */}
      <div className="flex flex-col gap-2.5">
        <Field label="Primærtekst" value={ad.preview.body} />
        <Field label="Overskrift" value={ad.preview.title} />
        <Field label="Beskrivelse" value={ad.preview.description} />
        {dateRange.length > 0 && (
          <Field
            label="Annoncesæt"
            value={
              dateRange.length === 2
                ? `${dateRange[0]} – ${dateRange[1]}`
                : `Starter ${dateRange[0]}`
            }
          />
        )}
      </div>

      {/* Approval */}
      <div className="flex flex-col gap-1 border-t border-hairline pt-3">
        <button
          type="button"
          onClick={toggleApprove}
          disabled={approving || corrections}
          className={cn(
            "inline-flex items-center gap-2 self-start rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
            "disabled:opacity-60",
            approved
              ? "border-success/40 bg-success/10 text-success"
              : "border-hairline bg-card-2 text-ink hover:bg-card",
          )}
        >
          {approved ? <CheckSquare className="size-4" /> : <Square className="size-4" />}
          {approved ? "Godkendt" : "Godkend"}
        </button>
        {approved && ad.approvedBy && ad.approvedAt && (
          <span className="text-[12px] text-muted">
            Godkendt af {roleLabel(ad.approvedBy)} · {formatDateTime(ad.approvedAt)}
          </span>
        )}
        {corrections && (
          <span className="text-[12px] text-warning">
            Løs {openCount} {openCount === 1 ? "rettelse" : "rettelser"} før godkendelse
          </span>
        )}
      </div>

      {/* Feedback thread */}
      <div className="flex flex-col gap-2 border-t border-hairline pt-3">
        {ad.feedback.length > 0 && (
          <div className="flex flex-col gap-2">
            {ad.feedback.map((f) => (
              <div
                key={f.id}
                className={cn(
                  "rounded-xl border border-hairline bg-card-2 p-2.5 text-[13px]",
                  f.resolved && "opacity-70",
                )}
              >
                <p className={cn("text-ink", f.resolved && "line-through")}>{f.text}</p>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-muted">
                    {roleLabel(f.role)} · {formatDateTime(f.createdAt)}
                  </span>
                  {f.resolved ? (
                    <Badge tone="success">
                      <Check className="size-3" /> Løst
                    </Badge>
                  ) : (
                    !isClient &&
                    resolveFormId !== f.id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setResolveFormId(f.id);
                          setResolveNote("");
                          setResolveFixedAdId("");
                        }}
                      >
                        Markér som løst
                      </Button>
                    )
                  )}
                </div>

                {/* Resolution note / replacement shown to everyone, incl. the client. */}
                {f.resolved && (f.resolvedNote || f.fixedAdId) && (
                  <div className="mt-2 rounded-lg border border-success/25 bg-success/10 p-2 text-[12px] text-ink">
                    {f.resolvedNote && <p>{f.resolvedNote}</p>}
                    {f.fixedAdId && (
                      <p className="mt-0.5 text-muted">Ny annonce: {f.fixedAdId}</p>
                    )}
                  </div>
                )}

                {/* Admin resolve form (optional note + replacement ad id). */}
                {!isClient && !f.resolved && resolveFormId === f.id && (
                  <div className="mt-2 flex flex-col gap-2">
                    <textarea
                      value={resolveNote}
                      onChange={(e) => setResolveNote(e.target.value)}
                      rows={2}
                      placeholder="Note til kunden (valgfri), fx 'Ny annonce oprettet, afventer ny godkendelse'"
                      className="w-full resize-y rounded-lg border border-hairline bg-card px-2.5 py-1.5 text-[12px] text-ink outline-none placeholder:text-faint focus:border-accent/60"
                    />
                    <input
                      value={resolveFixedAdId}
                      onChange={(e) => setResolveFixedAdId(e.target.value)}
                      placeholder="Nyt annonce-ID (valgfri)"
                      className="w-full rounded-lg border border-hairline bg-card px-2.5 py-1.5 text-[12px] text-ink outline-none placeholder:text-faint focus:border-accent/60"
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        loading={resolvingId === f.id}
                        onClick={() => submitResolve(f.id)}
                      >
                        Bekræft løst
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setResolveFormId(null)}
                      >
                        Annuller
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder="Tilføj rettelse…"
          className="w-full resize-y rounded-xl border border-hairline bg-card-2 px-3 py-2 text-[13px] text-ink outline-none transition-colors placeholder:text-faint focus:border-accent/60"
        />
        <div className="flex items-center justify-between gap-2">
          {!isClient && ad.adsManagerUrl ? (
            <a
              href={ad.adsManagerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[12px] text-muted hover:text-ink"
            >
              <ExternalLink className="size-3.5" /> Ads Manager
            </a>
          ) : (
            <span />
          )}
          <Button
            variant="secondary"
            size="sm"
            loading={sending}
            disabled={!text.trim()}
            onClick={submitFeedback}
          >
            <AlertTriangle className="size-3.5" /> Send rettelse
          </Button>
        </div>
      </div>
    </div>
  );
}
