// The budget "Plan" and "Tiltag" tabs are read from their Google Sheets
// "Publish to web → CSV" URLs (env PLAN_CSV_URL / TILTAG_CSV_URL, server-side
// only). No service account, no credentials to store. Read-only.

export class CsvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CsvError";
  }
}

/** Minimal RFC-4180 CSV parser: quoted fields, "" escapes, CR/LF/CRLF rows. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0; // strip BOM
  const n = text.length;

  while (i < n) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
    } else if (c === ",") {
      row.push(field);
      field = "";
      i++;
    } else if (c === "\r") {
      i++;
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
    } else {
      field += c;
      i++;
    }
  }
  // Flush the final field/row when the file doesn't end in a newline.
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export async function fetchCsv(url: string): Promise<string[][]> {
  let res: Response;
  try {
    res = await fetch(url, { redirect: "follow" });
  } catch (e) {
    throw new CsvError(`Kunne ikke hente CSV: ${(e as Error).message}`);
  }
  if (!res.ok) throw new CsvError(`CSV-fejl (HTTP ${res.status})`);
  const text = await res.text();
  // A published sheet that isn't shared returns an HTML sign-in page, not CSV.
  if (/^\s*<(?:!doctype|html)/i.test(text)) {
    throw new CsvError("CSV-URL returnerede HTML, ikke CSV (er arket publiceret til web?)");
  }
  return parseCsv(text);
}
