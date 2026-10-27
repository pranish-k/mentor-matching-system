// Labeled search cases. Labels never come from the search engine or the
// enriched tags it indexes, so the eval can't grade the engine with its own
// answers:
// - name, organization and title cases are labeled by rules over the raw
//   site record (title, company, bio);
// - need cases are judged by hand from the full profiles, and reviewed.
// Grades: 2 = strong fit, 1 = partial fit.

import type { MentorFilters } from "@/lib/assistant/engine";
import type { SourceMentor } from "@/lib/assistant/types";
import type { Grades } from "../lib/metrics";

export type SearchCase = {
  id: string;
  category: "name" | "organization" | "title" | "need";
  query: string;
  filters?: MentorFilters;
  labels: Grades | ((m: SourceMentor) => number);
};

const name = (query: string, slug: string): SearchCase => ({
  id: `name:${query}`,
  category: "name",
  query,
  labels: { [slug]: 2 },
});

// Strong if it is their current company, partial if only in their history.
const organization = (query: string, pattern: RegExp): SearchCase => ({
  id: `org:${query}`,
  category: "organization",
  query,
  labels: (m) => (pattern.test(m.company) ? 2 : pattern.test(`${m.title} ${m.bio}`) ? 1 : 0),
});

const title = (query: string, pattern: RegExp): SearchCase => ({
  id: `title:${query}`,
  category: "title",
  query,
  labels: (m) => (pattern.test(m.title) ? 2 : 0),
});

const need = (query: string, strong: string[], partial: string[] = []): SearchCase => ({
  id: `need:${query}`,
  category: "need",
  query,
  labels: Object.fromEntries([...partial.map((s) => [s, 1]), ...strong.map((s) => [s, 2])]),
});

export const CASES: SearchCase[] = [
  name("Dana Deasy", "dana-deasy"),
  name("dana deasey", "dana-deasy"),
  name("Wendy Pfeiffer", "wendy-pfeiffer"),
  name("sherry aholm", "sherry-aaholm"),
  name("Melissa Hathaway", "melissa-hathaway"),
  name("Ursula Soritsch-Renier", "ursula-soritsch-renier"),
  name("phiroz darukanavala", "phiroz-darukhanavala"),
  name("Atti Riazi", "atefeh-%28atti%29-riazi"),
  name("Andre Meillassoux", "andr%c3%a9-meillassoux"),
  name("Graham O'Sullivan", "graham-osullivan"),

  organization("JPMorgan", /JPMorgan|J\.\s?P\.\s?Morgan/i),
  organization("IBM", /\bIBM\b/),
  organization("Microsoft", /Microsoft/i),
  organization("Goldman Sachs", /Goldman/i),
  organization("McKinsey", /McKinsey/i),
  organization("Accenture", /Accenture/i),
  organization("Citigroup", /\bCiti(group|bank)?\b/i),
  organization("Deloitte", /Deloitte/i),

  title("CISO", /\bCISO\b|Chief Information Security|Chief Security Officer/i),
  title("Chief Digital Officer", /Chief Digital/i),
  title("CTO", /\bCTO\b|Chief Technology/i),
  title("professor", /professor|lecturer|\bdean\b/i),

  need("CIO at a law firm", ["ash-banerjee"]),
  need(
    "moving from CIO to a board seat",
    ["wendy-pfeiffer", "patrick-naef", "laura-miller", "piyush-singh", "james-mcglennon", "eash-sundaram", "inder-koul", "margaret-miller", "allan-hackney"],
    ["virginia-gambale", "nicholas-donofrio", "jay-leek", "sarah-diamond", "leslie-brun"],
  ),
  need(
    "cybersecurity leader in financial services",
    ["matt-mccormack", "charles-blauner", "tami-hudson", "anthony-johnson", "jay-leek", "graham-osullivan"],
    ["edward-ganom", "joel-molinoff"],
  ),
  need(
    "digital transformation in healthcare",
    ["ted-dellavecchia", "doug-torre", "victoria-hildebrand", "tim-conway", "bruce-r-lee", "john-walsh"],
    ["brian-johnson", "alejandro-martinez", "luc-lafontan", "larry-fried", "tsvi-gal", "vita-cassese"],
  ),
  need(
    "starting my own tech company",
    ["giri-devanur", "garrett-vargas", "landon-pollack", "eric-brown", "ashifi-gogo", "aju-koshy", "james-oliver", "piyush-singh", "fola-ogunsiakan", "monica-ruffo", "michael-saffitz", "renzo-scacco", "omar-khaled", "carr-bettis"],
    ["leesa-soulodre", "james-daquino", "greg-puschnigg", "kurt-kratchman", "yvonne-hyland", "josh-lewis", "rasul-damji"],
  ),
  need(
    "AI strategy for the enterprise",
    ["regina-salazar", "tej-anand", "subroto-mukherjee", "bruce-hedin", "nicolas-economou", "yvonne-hyland", "andrew-stricker", "jason-keith"],
    ["rocky-martinez"],
  ),
  need(
    "government and public sector technology",
    ["dana-deasy", "rafail-portnoy", "robert-galvin", "margaret-miller", "melissa-hathaway", "diana-beecher"],
    ["edward-ganom", "ken-haertling", "david-cole", "harry-silver", "toni-hawkins-scribner", "andrew-stricker"],
  ),
  need(
    "becoming a CTO",
    ["conal-thompson", "miles-braffett", "mark-polansky", "nicole-valentine", "tsvi-gal", "joseph-eng", "adam-noble", "frederick-kauber"],
    ["peter-richards", "dirk-manelski", "balaji-kumar", "david-kelly", "bruce-r-lee", "philip-wiser", "parag-karnik", "jaap-van-riel", "chad-kapadia", "phiroz-darukhanavala", "rafail-portnoy", "carol-clements", "john-walsh", "michael-golz", "sundi-balu", "jane-aboyoun", "shawn-banerji"],
  ),
  need("cloud transformation strategy", ["trisha-rozas", "peter-richards", "james-mcglennon", "mark-filer"], ["balaji-kumar", "parag-karnik", "chad-kapadia", "joe-simon", "michael-golz"]),
];

// Resolves rule-based labels against the data. Throws if a hand label names
// a mentor that no longer exists, so labels can't silently rot.
export function resolveLabels(c: SearchCase, mentors: SourceMentor[]): Grades {
  if (typeof c.labels === "function") {
    const fn = c.labels;
    return Object.fromEntries(mentors.map((m) => [m.slug, fn(m)]).filter(([, g]) => (g as number) > 0));
  }
  const known = new Set(mentors.map((m) => m.slug));
  const missing = Object.keys(c.labels).filter((s) => !known.has(s));
  if (missing.length) throw new Error(`Case "${c.id}" labels unknown mentors: ${missing.join(", ")}`);
  return c.labels;
}
