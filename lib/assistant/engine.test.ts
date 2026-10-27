import { describe, expect, it } from "vitest";
import sourceJson from "@/data/mentors.source.json";
import { getMentors } from "./data";
import { createEngine } from "./engine";
import type { Mentor } from "./types";
import { EXPERTISE, FOCUS_AREAS, INDUSTRIES, REGIONS, ROLES, SENIORITY } from "./vocab";

function mentor(overrides: Partial<Mentor> & { slug: string }): Mentor {
  return {
    name: overrides.slug,
    title: "",
    company: "",
    bio: "",
    linkedin: "",
    image: "",
    location: "",
    city: "",
    state: "",
    country: "United States",
    region: "North America",
    focusAreas: [],
    siteIndustries: [],
    summary: "",
    industries: [],
    expertise: [],
    seniority: "C-Suite",
    roles: [],
    organizations: [],
    canHelpWith: [],
    ...overrides,
  };
}

describe("engine semantics (fixtures)", () => {
  const engine = createEngine([
    mentor({ slug: "ana", name: "Ana Lopez", industries: ["Insurance"], expertise: ["Cybersecurity"], city: "London", country: "United Kingdom", region: "Europe" }),
    mentor({ slug: "ben", name: "Ben Ito", industries: ["Insurance", "Legal"], expertise: ["Board Governance"], city: "New York", state: "NY" }),
    mentor({ slug: "cy", name: "Cy Park", industries: ["Legal"], expertise: ["Cybersecurity"], roles: ["Founder"], city: "Newark", state: "NJ" }),
  ]);

  it("ORs values within a field", () => {
    expect(engine.count({ filters: { industries: ["Insurance", "Legal"] } }).total).toBe(3);
  });

  it("ANDs across fields", () => {
    expect(engine.count({ filters: { industries: ["Legal"], expertise: ["Cybersecurity"] } }).total).toBe(1);
  });

  it("matches locations case-insensitively", () => {
    expect(engine.count({ filters: { states: ["ny", "nj"] } }).total).toBe(2);
    expect(engine.count({ filters: { cities: ["LONDON"] } }).total).toBe(1);
  });

  it("groups multi-valued fields by each value, sorted by count", () => {
    expect(engine.count({ groupBy: "industries" }).groups).toEqual([
      { value: "Insurance", count: 2 },
      { value: "Legal", count: 2 },
    ]);
  });

  it("lists filter matches alphabetically when there is no query", () => {
    const result = engine.search({ filters: { expertise: ["Cybersecurity"] } });
    expect(result.matchingFilters).toBe(2);
    expect(result.mentors.map((m) => m.slug)).toEqual(["ana", "cy"]);
  });

  it("only ranks mentors that pass the filters", () => {
    const result = engine.search({ query: "Ben Ito", filters: { regions: ["Europe"] } });
    expect(result.mentors.map((m) => m.slug)).not.toContain("ben");
  });

  it("reports unknown slugs instead of failing", () => {
    expect(engine.get(["ana", "nobody"])).toMatchObject({ found: [{ slug: "ana" }], missing: ["nobody"] });
  });
});

describe("real data integrity", () => {
  const mentors = getMentors();

  it("has an enriched profile for every published mentor", () => {
    expect(mentors).toHaveLength(sourceJson.length);
  });

  it("uses only fixed-vocabulary values", () => {
    const within = (values: string[], allowed: readonly string[]) => values.every((v) => allowed.includes(v));
    for (const m of mentors) {
      expect(within(m.focusAreas, FOCUS_AREAS), m.slug).toBe(true);
      expect(within(m.industries, INDUSTRIES), m.slug).toBe(true);
      expect(within(m.expertise, EXPERTISE), m.slug).toBe(true);
      expect(within(m.roles, ROLES), m.slug).toBe(true);
      expect(SENIORITY, m.slug).toContain(m.seniority);
      expect(REGIONS, m.slug).toContain(m.region);
    }
  });

  it("gives every mentor at least one industry and expertise", () => {
    for (const m of mentors) {
      expect(m.industries.length, m.slug).toBeGreaterThan(0);
      expect(m.expertise.length, m.slug).toBeGreaterThan(0);
    }
  });

  it("counts match an independent tally of the source data", () => {
    const engine = createEngine(mentors);
    for (const area of FOCUS_AREAS) {
      const expected = sourceJson.filter((m) => m.focusAreas.includes(area)).length;
      expect(engine.count({ filters: { focusAreas: [area] } }).total, area).toBe(expected);
    }
    const byRegion = engine.count({ groupBy: "region" }).groups!;
    expect(byRegion.reduce((sum, g) => sum + g.count, 0)).toBe(mentors.length);
  });
});

describe("search quality on real data", () => {
  const engine = createEngine(getMentors());
  const top = (query: string, n: number) => engine.search({ query, limit: n }).mentors.map((m) => m.slug);

  it("finds people by name, tolerating typos", () => {
    expect(top("Dana Deasy", 1)).toEqual(["dana-deasy"]);
    expect(top("dana deasey", 1)).toEqual(["dana-deasy"]);
  });

  it("does not fuzzy-match short words (CIO is not CISO, law is not Lam)", () => {
    expect(top("CIO at a law firm", 1)).toEqual(["ash-banerjee"]);
  });

  it("surfaces the obvious fit for specific needs", () => {
    expect(top("cloud transformation strategy", 3)).toContain("trisha-rozas");
    expect(top("moving from CIO to a board seat", 5)).toContain("wendy-pfeiffer");
  });
});
