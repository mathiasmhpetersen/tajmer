import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Check, ChevronDown, ExternalLink, Mic2, Layers, X } from "lucide-react";
import {
  CORRECTION_FIELD_LABEL,
  CORRECTION_METHOD_LABEL,
  type ApproveItem,
  type CorrectionField,
  type CorrectionMethod,
  type PreviewAd,
  type PreviewArtistGroup,
  type PreviewStatus,
  type Role,
} from "@shared/types";
import {
  approveAd,
  approveBulk,
  createBulkCorrection,
  fetchPreview,
  resolveFeedback,
  sendFeedback,
} from "@/lib/api";
import { useRole } from "@/lib/session";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { ScaledPreview } from "@/components/ScaledPreview";
import { BulkCorrectionDialog, type BulkInitial } from "@/components/preview/BulkCorrectionDialog";

const ACCENT = "#e07d2e";

function roleLabel(role: Role): string {
  return role === "admin" ? "Marketingly" : "Kunde";
}

const STATUS_STYLE: Record<PreviewStatus, { dot: string; text: string; bg: string }> = {
  afventer: { dot: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50" },
  godkendt: { dot: "bg-green-500", text: "text-green-700", bg: "bg-green-50" },
  rettelser: { dot: "bg-orange-500", text: "text-orange-700", bg: "bg-orange-50" },
};

const STATUS_SHORT: Record<PreviewStatus, string> = {
  afventer: "Afventer",
  godkendt: "Godkendt",
  rettelser: "Rettelser ønsket",
};

function artistAds(group: PreviewArtistGroup): PreviewAd[] {
  return group.campaigns.flatMap((c) => c.ads);
}

function pendingItems(ads: PreviewAd[]): ApproveItem[] {
  return ads
    .filter((a) => a.status === "afventer")
    .map((a) => ({ adId: a.adId, creativeId: a.creativeId }));
}

function StatusPill({ status }: { status: PreviewStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-medium",
        s.bg,
        s.text,
      )}
    >
      <span className={cn("size-1.5 rounded-full", s.dot)} />
      {STATUS_SHORT[status]}
    </span>
  );
}

export function ClientPreview() {
  const qc = useQueryClient();
  const isAdmin = useRole() === "admin";
  const query = useQuery({ queryKey: ["preview"], queryFn: fetchPreview });
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [busyAd, setBusyAd] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [retAd, setRetAd] = useState<PreviewAd | null>(null);
  const [bulk, setBulk] = useState<{ initial?: BulkInitial } | null>(null);

  const data = query.data;
  const artists = data?.artists ?? [];
  const allAds = useMemo(() => artists.flatMap(artistAds), [artists]);
  const total = allAds.length;
  const approved = allAds.filter((a) => a.status === "godkendt").length;
  const globalPending = pendingItems(allAds);

  const active =
    artists.find((a) => a.slug === activeSlug) ??
    artists.find((a) => a.pendingCount > 0) ??
    artists[0] ??
    null;
  const activeAds = active ? artistAds(active) : [];
  // Keep the freshest copy of whichever ad the Ret panel is showing.
  const retAdLive = retAd ? allAds.find((a) => a.adId === retAd.adId) ?? retAd : null;

  const invalidate = () => qc.invalidateQueries({ queryKey: ["preview"] });

  const onApprove = async (ad: PreviewAd, approve: boolean) => {
    setBusyAd(ad.adId);
    try {
      await approveAd(ad.adId, ad.creativeId, approve);
      await invalidate();
    } finally {
      setBusyAd(null);
    }
  };

  const onApproveAll = async () => {
    if (globalPending.length === 0) return;
    setBulkBusy(true);
    try {
      await approveBulk(globalPending, true);
      await invalidate();
    } finally {
      setBulkBusy(false);
    }
  };

  const onSendCorrection = async (
    ad: PreviewAd,
    input: { field: CorrectionField; method: CorrectionMethod; text: string },
  ) => {
    await sendFeedback(ad.adId, ad.creativeId, input.text, {
      field: input.field,
      method: input.field === "other" ? undefined : input.method,
    });
    await invalidate();
  };

  const onResolve = async (
    ad: PreviewAd,
    feedbackId: string,
    opts: { note?: string; fixedAdId?: string },
  ) => {
    await resolveFeedback(ad.adId, feedbackId, opts);
    await invalidate();
  };

  const onBulkSubmit = async (
    artistSlug: string,
    input: {
      field: CorrectionField;
      method: CorrectionMethod;
      text: string;
      items: ApproveItem[];
    },
  ) => {
    setBulkBusy(true);
    try {
      await createBulkCorrection({ artistSlug, ...input });
      await invalidate();
      setBulk(null);
      setRetAd(null);
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa] text-neutral-900">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-black/[0.06] bg-[#fafafa]/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1200px] items-center gap-4 px-4 py-3 sm:px-6">
          <div className="flex flex-1 items-center gap-2">
            <Link
              href="/"
              className="flex size-8 items-center justify-center rounded-lg text-white"
              style={{ background: ACCENT }}
              aria-label="Til dashboard"
            >
              <Mic2 className="size-4" />
            </Link>
            {isAdmin && (
              <Link href="/" className="text-[13px] text-neutral-500 hover:text-neutral-800">
                ← Dashboard
              </Link>
            )}
          </div>
          <div className="text-[15px] font-semibold tracking-tight">Tajmer · Preview</div>
          <div className="flex flex-1 justify-end">
            <button
              type="button"
              onClick={onApproveAll}
              disabled={globalPending.length === 0 || bulkBusy}
              className="hidden rounded-full px-4 py-2 text-[14px] font-semibold text-white transition-colors disabled:opacity-40 sm:inline-flex sm:items-center sm:gap-2"
              style={{ background: ACCENT }}
            >
              <Check className="size-4" />
              Godkend alle ({globalPending.length})
            </button>
          </div>
        </div>
        {/* Progress */}
        {total > 0 && (
          <div className="mx-auto max-w-[1200px] px-4 pb-3 sm:px-6">
            <div className="mb-1.5 flex items-center justify-between text-[13px] text-neutral-500">
              <span>
                {approved} af {total} godkendt
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/[0.07]">
              <div
                className="h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none"
                style={{ width: `${total ? (approved / total) * 100 : 0}%`, background: ACCENT }}
              />
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-[1200px] px-4 pb-28 pt-5 sm:px-6 sm:pb-12">
        {query.isError ? (
          <ErrorBox message={(query.error as Error).message} onRetry={invalidate} />
        ) : query.isLoading || !data ? (
          <GridSkeleton />
        ) : artists.length === 0 ? (
          <EmptyBox />
        ) : (
          <>
            {/* Artist tabs */}
            <div className="no-scrollbar -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              {artists.map((a) => {
                const isActive = active?.slug === a.slug;
                return (
                  <button
                    key={a.slug}
                    type="button"
                    onClick={() => setActiveSlug(a.slug)}
                    className={cn(
                      "flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-[14px] font-medium transition-colors",
                      isActive
                        ? "border-transparent bg-neutral-900 text-white"
                        : "border-black/[0.08] bg-white text-neutral-700 hover:bg-neutral-50",
                    )}
                  >
                    {a.name}
                    {a.pendingCount > 0 && (
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-[11px] font-semibold",
                          isActive ? "bg-white/20 text-white" : "bg-amber-100 text-amber-700",
                        )}
                      >
                        {a.pendingCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {active && (
              <>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h1 className="text-[20px] font-semibold tracking-tight">{active.name}</h1>
                  {activeAds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setBulk({})}
                      className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.1] bg-white px-3.5 py-2 text-[13px] font-medium text-neutral-700 hover:bg-neutral-50"
                    >
                      <Layers className="size-4" />
                      Ret på flere annoncer
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {activeAds.map((ad, i) => (
                    <ClientAdCard
                      key={ad.adId}
                      ad={ad}
                      index={i + 1}
                      total={activeAds.length}
                      isAdmin={isAdmin}
                      busy={busyAd === ad.adId}
                      onApprove={onApprove}
                      onRet={() => setRetAd(ad)}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </main>

      {/* Mobile sticky approve-all bar */}
      {total > 0 && globalPending.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-black/[0.08] bg-white p-3 sm:hidden">
          <button
            type="button"
            onClick={onApproveAll}
            disabled={bulkBusy}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl text-[15px] font-semibold text-white disabled:opacity-50"
            style={{ background: ACCENT }}
          >
            <Check className="size-5" />
            Godkend alle ({globalPending.length})
          </button>
        </div>
      )}

      {/* Ret side panel */}
      {retAdLive && (
        <RetPanel
          ad={retAdLive}
          isAdmin={isAdmin}
          onClose={() => setRetAd(null)}
          onSend={(input) => onSendCorrection(retAdLive, input)}
          onResolve={(feedbackId, opts) => onResolve(retAdLive, feedbackId, opts)}
          onBulk={(initial) => {
            setBulk({ initial });
          }}
        />
      )}

      {/* Bulk correction dialog */}
      {bulk && active && (
        <BulkCorrectionDialog
          open
          artistName={active.name}
          ads={activeAds}
          initial={bulk.initial}
          submitting={bulkBusy}
          onClose={() => setBulk(null)}
          onSubmit={(input) => onBulkSubmit(active.slug, input)}
        />
      )}
    </div>
  );
}

function ClientAdCard({
  ad,
  index,
  total,
  isAdmin,
  busy,
  onApprove,
  onRet,
}: {
  ad: PreviewAd;
  index: number;
  total: number;
  isAdmin: boolean;
  busy: boolean;
  onApprove: (ad: PreviewAd, approve: boolean) => void;
  onRet: () => void;
}) {
  const [details, setDetails] = useState(false);
  const approved = ad.status === "godkendt";
  const corrections = ad.status === "rettelser";
  const dateRange = [formatDate(ad.startTime), formatDate(ad.endTime)].filter(Boolean);

  return (
    <div
      className={cn(
        "group flex flex-col rounded-xl border bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-transform duration-150 hover:-translate-y-0.5 motion-reduce:transform-none",
        approved ? "border-transparent ring-[1.5px] ring-green-500" : "border-black/[0.08]",
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0 truncate text-[14px] font-semibold">{ad.adName}</div>
        <StatusPill status={ad.status} />
      </div>

      {ad.preview.iframeSrc || ad.preview.videoUrl ? (
        <ScaledPreview
          src={ad.preview.iframeSrc ?? ""}
          title={ad.adName}
          vertical={ad.preview.vertical}
          poster={ad.preview.thumbnailUrl}
          videoUrl={ad.preview.videoUrl}
          nativeWidth={ad.preview.previewWidth}
          nativeHeight={ad.preview.previewHeight}
        />
      ) : (
        <div className="flex aspect-[400/640] w-full items-center justify-center rounded-xl bg-neutral-100 text-[13px] text-neutral-400">
          Forhåndsvisning ikke tilgængelig
        </div>
      )}

      <div className="my-2.5 flex items-center gap-2 text-[11px] uppercase tracking-wide text-neutral-400">
        <span className="h-px flex-1 bg-black/[0.06]" />
        Annonce {index} af {total}
        <span className="h-px flex-1 bg-black/[0.06]" />
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onApprove(ad, !approved)}
          disabled={busy || corrections}
          className={cn(
            "flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl text-[14px] font-semibold transition-colors disabled:opacity-50",
            approved
              ? "bg-green-50 text-green-700 ring-1 ring-inset ring-green-500/40"
              : "text-white",
          )}
          style={approved ? undefined : { background: ACCENT }}
        >
          {approved ? <Check className="size-4" /> : null}
          {approved ? "Godkendt" : "Godkend"}
        </button>
        <button
          type="button"
          onClick={onRet}
          className="min-h-[44px] flex-1 rounded-xl border border-black/[0.12] bg-white text-[14px] font-medium text-neutral-700 hover:bg-neutral-50"
        >
          Ret
        </button>
      </div>

      {approved && ad.approvedBy && ad.approvedAt && (
        <p className="mt-2 text-[12px] text-neutral-400">
          Godkendt · {formatDateTime(ad.approvedAt)}
        </p>
      )}

      <button
        type="button"
        onClick={() => setDetails((v) => !v)}
        className="mt-2 flex items-center gap-1 self-start text-[13px] text-neutral-500 hover:text-neutral-800"
        aria-expanded={details}
      >
        <ChevronDown className={cn("size-4 transition-transform", details && "rotate-180")} />
        Detaljer
      </button>
      {details && (
        <dl className="mt-2 space-y-1 text-[13px]">
          {dateRange.length > 0 && (
            <Detail label="Datoer" value={dateRange.join(" – ")} />
          )}
          <Detail label="Annoncesæt" value={ad.adsetName || "—"} />
          <Detail label="Kampagne" value={ad.displayName || "—"} />
          {isAdmin && ad.adsManagerUrl && (
            <a
              href={ad.adsManagerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 pt-1 text-[13px] text-neutral-500 hover:text-neutral-800"
            >
              <ExternalLink className="size-3.5" /> Ads Manager
            </a>
          )}
        </dl>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-neutral-400">{label}</dt>
      <dd className="truncate text-right text-neutral-700">{value}</dd>
    </div>
  );
}

function RetPanel({
  ad,
  isAdmin,
  onClose,
  onSend,
  onResolve,
  onBulk,
}: {
  ad: PreviewAd;
  isAdmin: boolean;
  onClose: () => void;
  onSend: (input: {
    field: CorrectionField;
    method: CorrectionMethod;
    text: string;
  }) => Promise<void>;
  onResolve: (feedbackId: string, opts: { note?: string; fixedAdId?: string }) => Promise<void>;
  onBulk: (initial: BulkInitial) => void;
}) {
  const [field, setField] = useState<CorrectionField>("headline");
  const [method, setMethod] = useState<CorrectionMethod>("replace");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [resolveFormId, setResolveFormId] = useState<string | null>(null);
  const [resolveNote, setResolveNote] = useState("");
  const [resolveFixedAdId, setResolveFixedAdId] = useState("");
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  // Admin sees every correction; clients only their own.
  const myCorrections = isAdmin ? ad.feedback : ad.feedback.filter((f) => f.role === "client");

  const submitResolve = async (feedbackId: string) => {
    setResolvingId(feedbackId);
    try {
      await onResolve(feedbackId, {
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

  const submit = async () => {
    const value = text.trim();
    if (!value) return;
    setSending(true);
    try {
      await onSend({ field, method, text: value });
      setText("");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" aria-label="Luk" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-md flex-col bg-white text-neutral-900 shadow-xl">
        <div className="flex items-start justify-between gap-2 border-b border-black/[0.08] px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-[16px] font-semibold">Rettelser</h2>
            <p className="truncate text-[13px] text-neutral-500">{ad.adName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-neutral-500 hover:bg-neutral-100"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {myCorrections.length > 0 && (
            <div className="space-y-2">
              {myCorrections.map((f) => (
                <div
                  key={f.id}
                  className={cn(
                    "rounded-xl border border-black/[0.08] bg-neutral-50 p-3 text-[13px]",
                    f.resolved && "opacity-70",
                  )}
                >
                  {(f.field || f.batchId) && (
                    <div className="mb-1 flex flex-wrap gap-1.5">
                      {f.batchId && (
                        <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-[11px] font-medium text-neutral-600">
                          Samlet rettelse
                        </span>
                      )}
                      {f.field && (
                        <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-[11px] font-medium text-neutral-600">
                          {CORRECTION_FIELD_LABEL[f.field]}
                          {f.method ? ` · ${CORRECTION_METHOD_LABEL[f.method]}` : ""}
                        </span>
                      )}
                    </div>
                  )}
                  <p className={cn(f.resolved && "line-through")}>{f.text}</p>
                  <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-neutral-400">
                    <span>
                      {isAdmin ? `${roleLabel(f.role)} · ` : ""}
                      {formatDateTime(f.createdAt)}
                    </span>
                    {f.resolved && (
                      <span className="inline-flex items-center gap-1 text-green-600">
                        <Check className="size-3" /> Løst
                      </span>
                    )}
                  </div>
                  {f.resolved && (f.resolvedNote || f.fixedAdId) && (
                    <div className="mt-2 rounded-lg bg-green-50 p-2 text-[12px] text-neutral-700">
                      {f.resolvedNote && <p>{f.resolvedNote}</p>}
                      {f.fixedAdId && <p className="mt-0.5 text-neutral-500">Ny annonce: {f.fixedAdId}</p>}
                    </div>
                  )}
                  {!f.resolved && (
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          onBulk({ field: f.field, method: f.method, text: f.text })
                        }
                        className="text-[12px] font-medium"
                        style={{ color: ACCENT }}
                      >
                        Gentag på alle andre annoncer
                      </button>
                      {isAdmin && resolveFormId !== f.id && (
                        <button
                          type="button"
                          onClick={() => {
                            setResolveFormId(f.id);
                            setResolveNote("");
                            setResolveFixedAdId("");
                          }}
                          className="text-[12px] font-medium text-neutral-600 hover:text-neutral-900"
                        >
                          Markér som løst
                        </button>
                      )}
                    </div>
                  )}

                  {isAdmin && !f.resolved && resolveFormId === f.id && (
                    <div className="mt-2 flex flex-col gap-2">
                      <textarea
                        value={resolveNote}
                        onChange={(e) => setResolveNote(e.target.value)}
                        rows={2}
                        placeholder="Note til kunden (valgfri)"
                        className="w-full resize-y rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-[12px] outline-none focus:border-[#e07d2e]"
                      />
                      <input
                        value={resolveFixedAdId}
                        onChange={(e) => setResolveFixedAdId(e.target.value)}
                        placeholder="Nyt annonce-ID (valgfri)"
                        className="w-full rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-[12px] outline-none focus:border-[#e07d2e]"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={resolvingId === f.id}
                          onClick={() => submitResolve(f.id)}
                          className="rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
                          style={{ background: ACCENT }}
                        >
                          {resolvingId === f.id ? "…" : "Bekræft løst"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setResolveFormId(null)}
                          className="text-[12px] font-medium text-neutral-500"
                        >
                          Annuller
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Correction form */}
          <div className="space-y-3 rounded-xl border border-black/[0.08] p-3">
            <div>
              <div className="mb-1.5 text-[12px] font-medium uppercase tracking-wide text-neutral-500">
                Felt
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(["headline", "primary_text", "description", "other"] as CorrectionField[]).map(
                  (o) => (
                    <button
                      key={o}
                      type="button"
                      onClick={() => setField(o)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors",
                        field === o
                          ? "border-transparent bg-neutral-900 text-white"
                          : "border-black/10 bg-white text-neutral-600 hover:bg-neutral-50",
                      )}
                    >
                      {CORRECTION_FIELD_LABEL[o]}
                    </button>
                  ),
                )}
              </div>
            </div>
            {field !== "other" && (
              <div>
                <div className="mb-1.5 text-[12px] font-medium uppercase tracking-wide text-neutral-500">
                  Metode
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(["replace", "append", "prepend"] as CorrectionMethod[]).map((o) => (
                    <button
                      key={o}
                      type="button"
                      onClick={() => setMethod(o)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors",
                        method === o
                          ? "border-transparent bg-neutral-900 text-white"
                          : "border-black/10 bg-white text-neutral-600 hover:bg-neutral-50",
                      )}
                    >
                      {CORRECTION_METHOD_LABEL[o]}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              placeholder="Skriv rettelsen…"
              className="w-full resize-y rounded-xl border border-black/10 bg-white px-3 py-2 text-[14px] outline-none focus:border-[#e07d2e] focus:ring-2 focus:ring-[#e07d2e]/30"
            />
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => onBulk({ field, method, text: text.trim() || undefined })}
                className="text-[13px] font-medium text-neutral-600 hover:text-neutral-900"
              >
                Ret på flere annoncer
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={!text.trim() || sending}
                className="rounded-xl px-4 py-2.5 text-[14px] font-semibold text-white disabled:opacity-50"
                style={{ background: ACCENT }}
              >
                {sending ? "Sender…" : "Send rettelse"}
              </button>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function ErrorBox({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-black/[0.08] bg-white px-6 py-16 text-center">
      <h3 className="text-[16px] font-semibold">Kunne ikke hente annoncer</h3>
      <p className="mt-1.5 text-[14px] text-neutral-500">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 rounded-xl border border-black/[0.1] px-4 py-2 text-[14px] font-medium hover:bg-neutral-50"
      >
        Prøv igen
      </button>
    </div>
  );
}

function EmptyBox() {
  return (
    <div className="rounded-2xl border border-dashed border-black/[0.12] bg-white px-6 py-20 text-center">
      <p className="text-[15px] text-neutral-500">Ingen annoncer venter på godkendelse lige nu.</p>
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-black/[0.08] bg-white p-3">
          <div className="mb-2 h-4 w-32 animate-pulse rounded bg-black/[0.06]" />
          <div className="aspect-[400/640] w-full animate-pulse rounded-xl bg-black/[0.05]" />
          <div className="mt-3 flex gap-2">
            <div className="h-11 flex-1 animate-pulse rounded-xl bg-black/[0.05]" />
            <div className="h-11 flex-1 animate-pulse rounded-xl bg-black/[0.05]" />
          </div>
        </div>
      ))}
    </div>
  );
}
