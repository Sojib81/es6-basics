import { describe, expect, it } from "vitest";
import { centsToCsv, csvCell, toCsv } from "./csv";

describe("csv", () => {
  it("quotes commas, quotes and newlines", () => {
    expect(csvCell('He said "hi", then left\nok')).toBe('"He said ""hi"", then left\nok"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(42)).toBe("42");
  });

  it("neutralises spreadsheet formulas typed by customers", () => {
    expect(csvCell('=HYPERLINK("http://evil")')).toBe('"\'=HYPERLINK(""http://evil"")"');
    expect(csvCell("+61412345678")).toBe("'+61412345678");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvCell(-5)).toBe("-5"); // real numbers untouched
  });

  it("builds a UTF-8 CSV with CRLF rows", () => {
    expect(toCsv(["a", "b"], [[1, "x"]])).toBe("﻿a,b\r\n1,x\r\n");
    expect(centsToCsv(42050)).toBe("420.50");
  });
});
