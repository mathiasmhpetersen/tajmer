import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { ARTISTS } from "@shared/artists";
import type { PlanRowInput, TiltagRowInput } from "@shared/budget";
import { fetchBudgetPlan, saveBudgetPlan } from "@/lib/api";
import { useIsClient } from "@/lib/session";
import { BC } from "@/lib/budget";
import { AdminOnly } from "./BudgetOverview";

const EMPTY_PLAN: PlanRowInput = { artist: "", fra: "", til: "", dagsbudget: "", type: "hoved", periode: "", periodebudget: "", note: "" };
const EMPTY_TILTAG: TiltagRowInput = { artist: "", fra: "", til: "", gentagelse: "ingen", titel: "", kilde: "" };

const inputStyle = {
  background: "rgba(255,255,255,0.04)",
  border: `1px solid ${BC.border}`,
  color: BC.text,
} as const;

function Cell({
  value,
  onChange,
  placeholder,
  width,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  width: number;
}) {
  return (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-[8px] px-2.5 py-1.5 text-[13px] outline-none focus:border-[#E8833A]"
      style={{ ...inputStyle, width }}
    />
  );
}

function ArtistSelect({
  value,
  onChange,
  withAll,
}: {
  value: string;
  onChange: (v: string) => void;
  withAll?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-[8px] px-2.5 py-1.5 text-[13px] outline-none"
      style={{ ...inputStyle, width: 150 }}
    >
      <option value="">—</option>
      {withAll && <option value="Alle">Alle</option>}
      {ARTISTS.map((a) => (
        <option key={a.slug} value={a.name}>
          {a.name}
        </option>
      ))}
    </select>
  );
}

function DeleteBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Fjern række"
      className="flex size-7 items-center justify-center rounded-[8px]"
      style={{ border: `1px solid ${BC.border}`, color: BC.textGrey }}
    >
      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
        <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M5 12h14" />
      </svg>
    </button>
  );
}

function Th({ children, w }: { children: React.ReactNode; w?: number }) {
  return (
    <th
      scope="col"
      className="px-2 pb-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em]"
      style={{ color: BC.textGrey, width: w }}
    >
      {children}
    </th>
  );
}

function AddRowBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-3 inline-flex items-center gap-2 rounded-[8px] px-3 py-1.5 text-[13px] font-medium"
      style={{ border: `1px dashed ${BC.border}`, color: BC.textDim }}
    >
      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
        <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M12 5v14M5 12h14" />
      </svg>
      {label}
    </button>
  );
}

export function BudgetEditor() {
  const isClient = useIsClient();
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["budget-plan"], queryFn: fetchBudgetPlan, enabled: !isClient });

  const [plan, setPlan] = useState<PlanRowInput[]>([]);
  const [tiltag, setTiltag] = useState<TiltagRowInput[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (query.data) {
      setPlan(query.data.plan);
      setTiltag(query.data.tiltag);
      setDirty(false);
    }
  }, [query.data]);

  const save = useMutation({
    mutationFn: () => saveBudgetPlan({ plan, tiltag }),
    onSuccess: () => {
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["budget-overview"] });
      qc.invalidateQueries({ queryKey: ["budget-artist"] });
      qc.invalidateQueries({ queryKey: ["budget-plan"] });
    },
  });

  if (isClient) return <AdminOnly />;

  const setPlanCell = (i: number, key: keyof PlanRowInput, v: string) => {
    setPlan((rows) => rows.map((r, j) => (j === i ? { ...r, [key]: v } : r)));
    setDirty(true);
  };
  const setTiltagCell = (i: number, key: keyof TiltagRowInput, v: string) => {
    setTiltag((rows) => rows.map((r, j) => (j === i ? { ...r, [key]: v } : r)));
    setDirty(true);
  };
  const mut = (fn: () => void) => {
    fn();
    setDirty(true);
  };

  return (
    <div className="mx-auto w-full" style={{ maxWidth: 1248, color: BC.text }}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href="/okonomi" className="inline-flex items-center gap-1 text-[13px] hover:underline" style={{ color: BC.textGrey }}>
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
              <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="m15 18-6-6 6-6" />
            </svg>
            Økonomi
          </Link>
          <h1 className="mt-1.5 text-[32px] font-semibold leading-none" style={{ letterSpacing: "-0.025em" }}>
            Rediger budgetter
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {save.isError && (
            <span className="text-[13px]" style={{ color: BC.red }}>
              {(save.error as Error).message}
            </span>
          )}
          {!dirty && save.isSuccess && (
            <span className="text-[13px]" style={{ color: BC.green }}>
              Gemt
            </span>
          )}
          <button
            type="button"
            disabled={!dirty || save.isPending}
            onClick={() => save.mutate()}
            className="rounded-[10px] px-4 py-2 text-[14px] font-medium"
            style={{ background: dirty ? BC.orange : BC.card, color: dirty ? "#1A0F06" : BC.textFaint, border: `1px solid ${dirty ? BC.orange : BC.border}` }}
          >
            {save.isPending ? "Gemmer…" : "Gem ændringer"}
          </button>
        </div>
      </div>

      {query.isLoading ? (
        <div className="mt-10 h-64 animate-pulse rounded-[14px]" style={{ background: BC.card, border: `1px solid ${BC.border}` }} />
      ) : query.isError ? (
        <div className="mt-6 text-[14px]" style={{ color: BC.red }}>
          {(query.error as Error).message}
        </div>
      ) : (
        <div className="mt-8 flex flex-col" style={{ gap: 40 }}>
          {query.data?.source === "seed" && (
            <div className="rounded-[12px] p-3.5 text-[13px]" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${BC.borderFaint}`, color: BC.textGrey }}>
              Viser standardbudgetterne. Gem for at gøre dem redigerbare i appen (herefter ligger de i databasen, ikke i koden).
            </div>
          )}

          {/* Plan */}
          <section>
            <h2 className="mb-4 text-[17px] font-semibold">Budgetperioder</h2>
            <div className="overflow-x-auto rounded-[14px] p-4" style={{ background: BC.card, border: `1px solid ${BC.border}` }}>
              <table style={{ borderSpacing: "6px 4px", borderCollapse: "separate" }}>
                <thead>
                  <tr>
                    <Th>Kunstner</Th>
                    <Th>Periode</Th>
                    <Th>Fra</Th>
                    <Th>Til</Th>
                    <Th>Periodebudget</Th>
                    <Th>Dagsbudget</Th>
                    <Th>Type</Th>
                    <Th>Note</Th>
                    <Th> </Th>
                  </tr>
                </thead>
                <tbody>
                  {plan.map((r, i) => (
                    <tr key={i}>
                      <td><ArtistSelect value={r.artist} onChange={(v) => setPlanCell(i, "artist", v)} /></td>
                      <td><Cell value={r.periode} onChange={(v) => setPlanCell(i, "periode", v)} placeholder="Nov-25/12" width={120} /></td>
                      <td><Cell value={r.fra} onChange={(v) => setPlanCell(i, "fra", v)} placeholder="dd/mm/yyyy" width={110} /></td>
                      <td><Cell value={r.til} onChange={(v) => setPlanCell(i, "til", v)} placeholder="dd/mm/yyyy" width={110} /></td>
                      <td><Cell value={r.periodebudget} onChange={(v) => setPlanCell(i, "periodebudget", v)} placeholder="60000" width={100} /></td>
                      <td><Cell value={r.dagsbudget} onChange={(v) => setPlanCell(i, "dagsbudget", v)} placeholder="valgfri" width={90} /></td>
                      <td><Cell value={r.type} onChange={(v) => setPlanCell(i, "type", v)} width={80} /></td>
                      <td><Cell value={r.note} onChange={(v) => setPlanCell(i, "note", v)} width={200} /></td>
                      <td><DeleteBtn onClick={() => mut(() => setPlan((rows) => rows.filter((_, j) => j !== i)))} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <AddRowBtn label="Tilføj periode" onClick={() => mut(() => setPlan((rows) => [...rows, { ...EMPTY_PLAN }]))} />
            </div>
            <p className="mt-2 text-[12px]" style={{ color: BC.textFaint }}>
              Flere rækker med samme Periode-etiket hører til samme periode. Periodebudget tælles kun fra den første række. Lad Dagsbudget stå tomt for kun at angive periodebudgettet.
            </p>
          </section>

          {/* Tiltag */}
          <section>
            <h2 className="mb-4 text-[17px] font-semibold">Tiltag</h2>
            <div className="overflow-x-auto rounded-[14px] p-4" style={{ background: BC.card, border: `1px solid ${BC.border}` }}>
              <table style={{ borderSpacing: "6px 4px", borderCollapse: "separate" }}>
                <thead>
                  <tr>
                    <Th>Kunstner</Th>
                    <Th>Fra</Th>
                    <Th>Til</Th>
                    <Th>Gentagelse</Th>
                    <Th>Titel</Th>
                    <Th>Kilde</Th>
                    <Th> </Th>
                  </tr>
                </thead>
                <tbody>
                  {tiltag.map((r, i) => (
                    <tr key={i}>
                      <td><ArtistSelect value={r.artist} onChange={(v) => setTiltagCell(i, "artist", v)} withAll /></td>
                      <td><Cell value={r.fra} onChange={(v) => setTiltagCell(i, "fra", v)} placeholder="dd/mm/yyyy" width={110} /></td>
                      <td><Cell value={r.til} onChange={(v) => setTiltagCell(i, "til", v)} placeholder="dd/mm/yyyy" width={110} /></td>
                      <td><Cell value={r.gentagelse} onChange={(v) => setTiltagCell(i, "gentagelse", v)} placeholder="ingen" width={160} /></td>
                      <td><Cell value={r.titel} onChange={(v) => setTiltagCell(i, "titel", v)} width={220} /></td>
                      <td><Cell value={r.kilde} onChange={(v) => setTiltagCell(i, "kilde", v)} width={120} /></td>
                      <td><DeleteBtn onClick={() => mut(() => setTiltag((rows) => rows.filter((_, j) => j !== i)))} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <AddRowBtn label="Tilføj tiltag" onClick={() => mut(() => setTiltag((rows) => [...rows, { ...EMPTY_TILTAG }]))} />
            </div>
            <p className="mt-2 text-[12px]" style={{ color: BC.textFaint }}>
              "Alle" gælder alle kunstnere. Gentagelse understøtter "ingen" og "hver &lt;ugedag&gt; i N uger".
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
