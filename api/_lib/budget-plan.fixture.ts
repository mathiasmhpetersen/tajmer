// Committed fixtures for the Plan/Tiltag parsers, matching the real column
// layout and deliberately reproducing every "DATA PROBLEM" from the spec:
// daily-sum mismatch, a copy-pasted template day-series shared across artists,
// PAUSE, a text amount ("10000+3000 geo"), an invalid date, an unknown artist,
// and blank rows. Rows are string[][] exactly as the Sheets API returns them
// (row 0 = header; trailing empty cells omitted on some rows).

export const PLAN_FIXTURE: string[][] = [
  ["Artist", "Fra", "Til", "Periodebudget", "Dagsbudget", "Type", "Note"],

  // Thomas Warberg — the 1.245 / 1.533 / 1.916 template block (3 clean periods).
  ["Thomas Warberg", "01/11/2025", "07/11/2025", "8.715", "1.245", "hoved", ""],
  ["Thomas Warberg", "08/11/2025", "14/11/2025", "10.731", "1.533", "hoved", ""],
  ["Thomas Warberg", "15/11/2025", "21/11/2025", "13.412", "1.916", "geo", ""],

  // blank row in the middle — must be skipped.
  ["", "", "", "", "", "", ""],

  // Jakob Thrane — identical day-series → "mistænkt skabelon" duplicate.
  ["Jakob Thrane", "01/11/2025", "07/11/2025", "8.715", "1.245", "hoved", ""],
  ["Jakob Thrane", "08/11/2025", "14/11/2025", "10.731", "1.533", "hoved", ""],
  ["Jakob Thrane", "15/11/2025", "21/11/2025", "13.412", "1.916", "hoved", ""],

  // Nikolaj Stokholm — daily-sum mismatch (1.396 × 37 = 51.652 ≠ 50.000).
  ["Nikolaj Stokholm", "17/11/2025", "23/12/2025", "50.000", "1.396", "hoved", ""],
  // PAUSE period — report as pause, never 0.
  ["Nikolaj Stokholm", "24/12/2025", "31/12/2025", "", "PAUSE", "hoved", "jul"],
  // text amount — keep as note, never 0.
  ["Nikolaj Stokholm", "01/01/2026", "07/01/2026", "", "10000+3000 geo", "hoved", ""],
  // invalid Fra date.
  ["Nikolaj Stokholm", "31/02/2026", "05/03/2026", "5.000", "1.000", "hoved", ""],

  // unknown artist — not in shared/artists.ts.
  ["Ukendt Kunstner", "01/11/2025", "07/11/2025", "5.000", "700", "hoved", ""],
];

export const TILTAG_FIXTURE: string[][] = [
  ["Artist", "Fra", "Til", "Gentagelse", "Titel", "Kilde"],
  ["Jakob Thrane", "01/11/2025", "", "ingen", "TV 2 interview", "TV 2"],
  ["Thomas Warberg", "03/11/2025", "01/12/2025", "hver mandag i 4 uger", "Radioklip", "P3"],
  ["Nikolaj Stokholm", "10/11/2025", "", "hver torsdag i 3 uger", "Podcast", "Egen"],
  ["", "", "", "", "", ""],
  // recurrence we don't understand → single marker + a warning.
  ["Mark Le Fevre", "12/11/2025", "", "hver 2. dag", "Noget", "X"],
];
