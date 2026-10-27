// In-memory mentor search, filtering and counting. Pure and synchronous: the
// whole directory is a few hundred records, so every call takes milliseconds
// and the results are exact.

import MiniSearch from "minisearch";
import type { Mentor } from "./types";
import type { Expertise, FocusArea, Industry, Region, Role, Seniority } from "./vocab";

// Within a field, a mentor matches if they have ANY of the listed values;
// across fields, ALL given fields must match. Location values match
// case-insensitively.
export type MentorFilters = {
  focusAreas?: FocusArea[];
  industries?: Industry[];
  expertise?: Expertise[];
  roles?: Role[];
  seniority?: Seniority[];
  regions?: Region[];
  countries?: string[];
  states?: string[];
  cities?: string[];
};

export const GROUP_BY_FIELDS = [
  "focusAreas",
  "industries",
  "expertise",
  "roles",
  "seniority",
  "region",
  "country",
  "state",
  "city",
] as const;
export type GroupByField = (typeof GROUP_BY_FIELDS)[number];

// `matchingFilters` is the exact number of mentors passing the filters (the
// pool the ranking draws from); keyword hits are not counted, since sharing a
// word with the query does not make someone a match.
export type SearchResult = { matchingFilters: number; mentors: Mentor[] };
export type CountResult = { total: number; groups?: { value: string; count: number }[] };

const STOP_WORDS = new Set(
  "a an and are as at be by can could for from has have help i in is me mentor mentors my of on or someone that the their them to who with would".split(
    " ",
  ),
);

const lower = (values: string[] | undefined) => (values?.length ? new Set(values.map((v) => v.toLowerCase())) : null);

export function createEngine(mentors: Mentor[]) {
  const bySlug = new Map(mentors.map((m) => [m.slug, m]));

  const index = new MiniSearch<Mentor>({
    idField: "slug",
    fields: ["name", "title", "company", "organizations", "summary", "canHelpWith", "expertise", "industries", "bio"],
    extractField: (doc, field) => {
      const value = doc[field as keyof Mentor];
      return Array.isArray(value) ? value.join(" ") : String(value ?? "");
    },
    processTerm: (term) => {
      const t = term.toLowerCase();
      return STOP_WORDS.has(t) ? null : t;
    },
    searchOptions: {
      boost: { name: 4, title: 2, company: 2, organizations: 2, summary: 1.5, canHelpWith: 1.5, expertise: 1.5, industries: 1.5 },
      // Typo tolerance only on longer words: on short ones it turns "cio"
      // into "ciso"/"ceo" and "law" into "lam".
      fuzzy: (term) => (term.length >= 5 ? 0.2 : false),
      prefix: (term) => term.length >= 4,
      combineWith: "OR",
    },
  });
  index.addAll(mentors);

  function matches(m: Mentor, f: MentorFilters): boolean {
    const anyOf = <T>(wanted: T[] | undefined, has: T[]) => !wanted?.length || wanted.some((w) => has.includes(w));
    const countries = lower(f.countries);
    const states = lower(f.states);
    const cities = lower(f.cities);
    return (
      anyOf(f.focusAreas, m.focusAreas) &&
      anyOf(f.industries, m.industries) &&
      anyOf(f.expertise, m.expertise) &&
      anyOf(f.roles, m.roles) &&
      anyOf(f.seniority, [m.seniority]) &&
      anyOf(f.regions, [m.region]) &&
      (!countries || countries.has(m.country.toLowerCase())) &&
      (!states || states.has(m.state.toLowerCase())) &&
      (!cities || cities.has(m.city.toLowerCase()))
    );
  }

  // With a query: ranked by relevance among mentors passing the filters.
  // Without one: every mentor passing the filters, alphabetically.
  function search({ query, filters = {}, limit = 8 }: { query?: string; filters?: MentorFilters; limit?: number }): SearchResult {
    const pool = mentors.filter((m) => matches(m, filters));
    if (!query?.trim()) {
      const sorted = [...pool].sort((a, b) => a.name.localeCompare(b.name));
      return { matchingFilters: pool.length, mentors: sorted.slice(0, limit) };
    }
    const inPool = new Set(pool.map((m) => m.slug));
    const ranked = index
      .search(query, { filter: (r) => inPool.has(r.id) })
      .slice(0, limit)
      .map((r) => bySlug.get(r.id)!);
    return { matchingFilters: pool.length, mentors: ranked };
  }

  function count({ filters = {}, groupBy }: { filters?: MentorFilters; groupBy?: GroupByField }): CountResult {
    const matched = mentors.filter((m) => matches(m, filters));
    if (!groupBy) return { total: matched.length };

    const counts = new Map<string, number>();
    for (const m of matched) {
      const raw = m[groupBy];
      const values = Array.isArray(raw) ? raw : [raw];
      for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    const groups = [...counts]
      .map(([value, n]) => ({ value, count: n }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
    return { total: matched.length, groups };
  }

  function get(slugs: string[]): { found: Mentor[]; missing: string[] } {
    const found: Mentor[] = [];
    const missing: string[] = [];
    for (const slug of slugs) {
      const m = bySlug.get(slug);
      if (m) found.push(m);
      else missing.push(slug);
    }
    return { found, missing };
  }

  return { search, count, get, has: (slug: string) => bySlug.has(slug) };
}

export type Engine = ReturnType<typeof createEngine>;
