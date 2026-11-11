import { parseCsv } from "./budget-csv.js";
import type { BudgetPlanDoc, PlanRowInput, TiltagRowInput } from "../../shared/budget.js";

// Budget plan + tiltag now live in the app (no Google Sheets). Edit these here;
// each is the same simple layout the parsers already understand. Amounts are
// whole kroner. One row per period with Periodebudget filled and Dagsbudget left
// blank — the daily shaping is suggested by the app, not fixed here.
//
// Plan columns:   Artist | Fra | Til | Dagsbudget | Type | Periode | Periodebudget | Note
// Tiltag columns: Artist | Fra | Til | Gentagelse | Titel | Kilde   ("Alle" = every artist)

export const PLAN_CSV = `Artist,Fra,Til,Dagsbudget,Type,Periode,Periodebudget,Note
Nikolaj Stokholm,01/11/2026,25/12/2026,,hoved,Nov-25/12,60000,
Mark Le Fevre,01/10/2026,10/12/2026,,hoved,Okt-10/12,27000,Sidste show 10/12
r8Dio,01/11/2026,25/12/2026,,hoved,Nov-25/12,50000,
r8Dio,26/12/2026,15/02/2027,,hoved,25/12-15/2,10000,
r8Dio,16/02/2027,30/04/2027,,hoved,15/2-30/4,60000,
Linda P,01/11/2026,25/12/2026,,hoved,Nov-25/12,100000,
Linda P,01/01/2027,28/02/2027,,hoved,Jan-Feb,50000,
Thomas Warberg,01/10/2026,25/12/2026,,hoved,Okt-25/12,75000,
Thomas Warberg,01/01/2027,28/02/2027,,hoved,Jan-28/2,16000,
Thomas Warberg,01/03/2027,31/03/2027,,hoved,Marts,12000,
Jakob Thrane,01/09/2026,25/12/2026,,hoved,Sep-25/12,100000,
Jakob Thrane,01/01/2027,15/02/2027,,hoved,Jan-15/2,15000,
Jakob Thrane,16/02/2027,31/03/2027,,hoved,15/2-31/3,50000,
`;

export const TILTAG_CSV = `Artist,Fra,Til,Gentagelse,Titel,Kilde
Alle,16/11/2026,24/12/2026,ingen,Julekampagne på tværs af artister,Mathias
Mark Le Fevre,10/12/2026,10/12/2026,ingen,Sidste show i turnéen,Kundeprofil
Linda P,14/01/2027,14/01/2027,ingen,Premiere - Stand-up Tour 2027,Annoncetekst
Jakob Thrane,13/03/2027,13/03/2027,ingen,Premiere - Står bare og blomstrer,Annoncetekst
`;

const PLAN_HEADER = ["Artist", "Fra", "Til", "Dagsbudget", "Type", "Periode", "Periodebudget", "Note"];
const TILTAG_HEADER = ["Artist", "Fra", "Til", "Gentagelse", "Titel", "Kilde"];

/** Editable rows (BudgetPlanDoc) → the string[][] grid the parsers consume. */
export function planRowsToGrid(rows: PlanRowInput[]): string[][] {
  return [
    PLAN_HEADER,
    ...rows.map((r) => [r.artist, r.fra, r.til, r.dagsbudget, r.type, r.periode, r.periodebudget, r.note]),
  ];
}

export function tiltagRowsToGrid(rows: TiltagRowInput[]): string[][] {
  return [TILTAG_HEADER, ...rows.map((r) => [r.artist, r.fra, r.til, r.gentagelse, r.titel, r.kilde])];
}

function gridToPlanRows(grid: string[][]): PlanRowInput[] {
  return grid.slice(1).map((r) => ({
    artist: r[0] ?? "",
    fra: r[1] ?? "",
    til: r[2] ?? "",
    dagsbudget: r[3] ?? "",
    type: r[4] ?? "",
    periode: r[5] ?? "",
    periodebudget: r[6] ?? "",
    note: r[7] ?? "",
  }));
}

function gridToTiltagRows(grid: string[][]): TiltagRowInput[] {
  return grid.slice(1).map((r) => ({
    artist: r[0] ?? "",
    fra: r[1] ?? "",
    til: r[2] ?? "",
    gentagelse: r[3] ?? "",
    titel: r[4] ?? "",
    kilde: r[5] ?? "",
  }));
}

/** The committed defaults as an editable doc (used when KV is empty). */
export function seedDoc(): BudgetPlanDoc {
  return {
    plan: gridToPlanRows(parseCsv(PLAN_CSV)),
    tiltag: gridToTiltagRows(parseCsv(TILTAG_CSV)),
  };
}
