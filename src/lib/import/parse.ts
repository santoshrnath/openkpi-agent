import Papa from "papaparse";
import { buildAliasMap } from "./schema";

export interface ParsedRow {
  rowIndex: number; // 1-based, matching the CSV row number (excluding header)
  /** Canonical-keyed dictionary built by mapping headers via aliases. */
  fields: Record<string, string>;
  /** Original raw row (post-Papa parse) — useful for error reporting. */
  raw: Record<string, string>;
}

export interface ParseResult {
  headers: string[];
  /** Header → canonical field key (or null if unmapped). */
  mapping: Record<string, string | null>;
  rows: ParsedRow[];
  unmappedHeaders: string[];
}

/**
 * Parse a CSV (string) into rows with canonical column names.
 *
 *  - headers are matched case-insensitively against the alias table
 *  - extra unmapped columns are returned in `unmappedHeaders` for UI display
 *  - empty rows are skipped
 */
export function parseCsv(text: string): ParseResult {
  // Strip BOM if present
  const cleaned = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  const result = Papa.parse<Record<string, string>>(cleaned, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });

  const headers = (result.meta.fields ?? []).map((h) => h.trim());
  const aliasMap = buildAliasMap();

  const mapping: Record<string, string | null> = {};
  const unmappedHeaders: string[] = [];
  for (const h of headers) {
    const canonical = aliasMap.get(h.toLowerCase().trim()) ?? null;
    mapping[h] = canonical;
    if (!canonical) unmappedHeaders.push(h);
  }

  const rows: ParsedRow[] = (result.data ?? []).map((raw, i) => {
    const fields: Record<string, string> = {};
    for (const [h, canonical] of Object.entries(mapping)) {
      if (!canonical) continue;
      const v = raw[h];
      if (v != null) fields[canonical] = String(v).trim();
    }
    return { rowIndex: i + 1, fields, raw };
  });

  return { headers, mapping, rows, unmappedHeaders };
}
