import { describe, expect, it } from "vitest";
import { parseCsv } from "./budget-csv.js";

describe("parseCsv", () => {
  it("parses rows and columns", () => {
    expect(parseCsv("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("handles quoted fields with commas and escaped quotes", () => {
    expect(parseCsv('x,"a, b","c ""d"""\n')).toEqual([["x", "a, b", 'c "d"']]);
  });

  it("handles CRLF and a BOM, and drops a trailing newline", () => {
    expect(parseCsv('﻿a,b\r\n1,2\r\n')).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("keeps blank middle rows (parser stays row-aligned)", () => {
    expect(parseCsv("a,b\n\n1,2")).toEqual([["a", "b"], [""], ["1", "2"]]);
  });

  it("preserves newlines inside quoted cells", () => {
    expect(parseCsv('note\n"line1\nline2"')).toEqual([["note"], ["line1\nline2"]]);
  });
});
