import { useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  CORRECTION_FIELD_LABEL,
  CORRECTION_METHOD_LABEL,
  type CorrectionField,
  type CorrectionMethod,
  type PreviewAd,
} from "@shared/types";
import { applyCorrection, currentFieldValue } from "@/lib/correction";
import { cn } from "@/lib/cn";

const FIELDS: CorrectionField[] = ["headline", "primary_text", "description", "other"];
const METHODS: CorrectionMethod[] = ["replace", "append", "prepend"];

export interface BulkInitial {
  field?: CorrectionField;
  method?: CorrectionMethod;
  text?: string;
  adIds?: string[];
}

/** Light segmented control used for field/method pickers. */
function Segmented<T extends string>({
  options,
  value,
  onChange,
  labels,
}: {
  options: T[];
  value: T;
  onChange: (v: T) => void;
  labels: Record<string, string>;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={cn(
            "rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors",
            value === o
              ? "border-transparent bg-neutral-900 text-white"
              : "border-black/10 bg-white text-neutral-600 hover:bg-neutral-50",
          )}
        >
          {labels[o]}
        </button>
      ))}
    </div>
  );
}

export function BulkCorrectionDialog({
  open,
  onClose,
  artistName,
  ads,
  initial,
  submitting,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  artistName: string;
  ads: PreviewAd[];
  initial?: BulkInitial;
  submitting?: boolean;
  onSubmit: (input: {
    field: CorrectionField;
    method: CorrectionMethod;
    text: string;
    items: { adId: string; creativeId: string | null }[];
  }) => void;
}) {
  const [field, setField] = useState<CorrectionField>(initial?.field ?? "headline");
  const [method, setMethod] = useState<CorrectionMethod>(initial?.method ?? "replace");
  const [text, setText] = useState(initial?.text ?? "");
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initial?.adIds ?? ads.map((a) => a.adId)),
  );

  useEffect(() => {
    if (open) {
      setField(initial?.field ?? "headline");
      setMethod(initial?.method ?? "replace");
      setText(initial?.text ?? "");
      setSelected(new Set(initial?.adIds ?? ads.map((a) => a.adId)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const isOther = field === "other";
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const canSend = text.trim().length > 0 && selected.size > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Luk"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div className="relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white text-neutral-900 shadow-xl sm:max-w-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-black/[0.08] px-5 py-4">
          <div>
            <h2 className="text-[17px] font-semibold">Ret på flere annoncer</h2>
            <p className="text-[13px] text-neutral-500">{artistName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-neutral-500 hover:bg-neutral-100"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="space-y-4">
            <div>
              <div className="mb-1.5 text-[12px] font-medium uppercase tracking-wide text-neutral-500">
                Felt
              </div>
              <Segmented
                options={FIELDS}
                value={field}
                onChange={setField}
                labels={CORRECTION_FIELD_LABEL}
              />
            </div>

            {!isOther && (
              <div>
                <div className="mb-1.5 text-[12px] font-medium uppercase tracking-wide text-neutral-500">
                  Metode
                </div>
                <Segmented
                  options={METHODS}
                  value={method}
                  onChange={setMethod}
                  labels={CORRECTION_METHOD_LABEL}
                />
              </div>
            )}

            <div>
              <div className="mb-1.5 text-[12px] font-medium uppercase tracking-wide text-neutral-500">
                {isOther ? "Rettelse" : "Ny tekst"}
              </div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={isOther ? 3 : field === "primary_text" ? 3 : 2}
                autoFocus
                placeholder={isOther ? "Beskriv rettelsen…" : "Skriv teksten…"}
                className="w-full resize-y rounded-xl border border-black/10 bg-white px-3 py-2 text-[14px] outline-none focus:border-[#e07d2e] focus:ring-2 focus:ring-[#e07d2e]/30"
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <div className="text-[12px] font-medium uppercase tracking-wide text-neutral-500">
                  Annoncer ({selected.size}/{ads.length})
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setSelected((prev) =>
                      prev.size === ads.length ? new Set() : new Set(ads.map((a) => a.adId)),
                    )
                  }
                  className="text-[13px] font-medium text-[#e07d2e] hover:underline"
                >
                  {selected.size === ads.length ? "Fravælg alle" : "Vælg alle"}
                </button>
              </div>
              <div className="divide-y divide-black/[0.06] overflow-hidden rounded-xl border border-black/[0.08]">
                {ads.map((ad) => {
                  const before = currentFieldValue(ad, field);
                  const after = isOther ? "" : applyCorrection(before, method, text.trim());
                  const checked = selected.has(ad.adId);
                  return (
                    <label
                      key={ad.adId}
                      className="flex cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-neutral-50"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(ad.adId)}
                        className="mt-0.5 size-4 accent-[#e07d2e]"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-medium">{ad.adName}</div>
                        {!isOther && (
                          <div className="mt-0.5 space-y-0.5 text-[12px]">
                            <div className="truncate text-neutral-400">
                              {before || <span className="italic">(tom)</span>}
                            </div>
                            {text.trim() && (
                              <div className="truncate font-medium text-neutral-800">
                                → {after}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-black/[0.08] px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-[14px] font-medium text-neutral-600 hover:bg-neutral-100"
          >
            Annuller
          </button>
          <button
            type="button"
            disabled={!canSend || submitting}
            onClick={() =>
              onSubmit({
                field,
                method: isOther ? "replace" : method,
                text: text.trim(),
                items: ads
                  .filter((a) => selected.has(a.adId))
                  .map((a) => ({ adId: a.adId, creativeId: a.creativeId })),
              })
            }
            className="rounded-xl bg-[#e07d2e] px-4 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-[#cf6f22] disabled:opacity-50"
          >
            {submitting ? "Sender…" : `Send rettelse (${selected.size})`}
          </button>
        </div>
      </div>
    </div>
  );
}
