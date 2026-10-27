import { FOCUS_AREAS, type FocusArea } from "./vocab";

// The site's extracted data is HTML-encoded. Same decoding as the site's
// lib/mentor-utils.ts, plus numeric entities.
export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

// Industry and focus are comma-separated. Decode after splitting is unsafe
// for numeric entities, so decode first: no decoded value contains a comma.
export function splitValues(val: string): string[] {
  return decodeEntities(val)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// Locations come as "City, ST, Country", "City, Country" or "Country".
export function parseLocation(location: string): { city: string; state: string; country: string } {
  const parts = decodeEntities(location)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return { city: "", state: "", country: "" };
  const country = parts[parts.length - 1];
  const city = parts.length > 1 ? parts[0] : "";
  const state = parts.length > 2 ? parts[1] : "";
  return { city, state, country };
}

// Keeps only values from the site's official focus taxonomy. One-off values
// still reach enrichment through the raw record.
export function parseFocusAreas(focus: string): FocusArea[] {
  const official = new Set<string>(FOCUS_AREAS);
  return splitValues(focus).filter((v): v is FocusArea => official.has(v));
}
