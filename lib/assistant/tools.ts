// The tools Claude can call while answering, and their executor. Inputs are
// validated with zod before running (tool inputs are model output); results
// are compact JSON strings sized for the model's context.

import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { GROUP_BY_FIELDS, type Engine } from "./engine";
import type { Mentor } from "./types";
import { EXPERTISE, FOCUS_AREAS, INDUSTRIES, REGIONS, ROLES, SENIORITY } from "./vocab";

const MAX_SEARCH_LIMIT = 20;
const MAX_GET = 6;

const FiltersSchema = z
  .object({
    focusAreas: z.array(z.enum(FOCUS_AREAS)).optional().describe("The site's official mentor focus areas."),
    industries: z.array(z.enum(INDUSTRIES)).optional().describe("Industries they have worked in, current or past."),
    expertise: z.array(z.enum(EXPERTISE)).optional(),
    roles: z.array(z.enum(ROLES)).optional().describe("Roles held besides their main job, e.g. Board Member, Founder."),
    seniority: z.array(z.enum(SENIORITY)).optional().describe("Highest level reached."),
    regions: z.array(z.enum(REGIONS)).optional(),
    countries: z.array(z.string()).optional().describe('Country names as in the roster, e.g. "United States", "United Kingdom".'),
    states: z.array(z.string()).optional().describe('US state or province codes as in the roster, e.g. "NY", "NJ".'),
    cities: z.array(z.string()).optional().describe('City names as in the roster, e.g. "New York", "London".'),
  })
  .describe("Within one field a mentor matches ANY listed value; across fields ALL given fields must match.");

const SearchInput = z.object({
  query: z
    .string()
    .optional()
    .describe("Free-text description of who is wanted, e.g. 'moving from CIO to a board seat'. Omit to list everyone matching the filters."),
  filters: FiltersSchema.optional(),
  limit: z.number().int().optional().describe(`How many mentors to return (default 8, max ${MAX_SEARCH_LIMIT}).`),
});

const GetInput = z.object({
  slugs: z.array(z.string()).describe(`Mentor slugs from the roster, at most ${MAX_GET}.`),
});

const CountInput = z.object({
  filters: FiltersSchema.optional(),
  groupBy: z.enum(GROUP_BY_FIELDS).optional().describe("Also break the matching mentors down by this field."),
});

function inputSchema(schema: z.ZodType): Anthropic.Tool.InputSchema {
  const json = z.toJSONSchema(schema) as Record<string, unknown>;
  delete json.$schema;
  return json as Anthropic.Tool.InputSchema;
}

export const TOOLS: Anthropic.Tool[] = [
  {
    name: "search_mentors",
    description:
      "Find mentors who fit a need. With `query`, returns the most relevant mentors among those passing `filters` (ranked by keyword relevance, so judge fit yourself from their profiles). Without `query`, lists mentors passing `filters` alphabetically. `mentorsPassingFilters` is exact; the number of relevant results is not a count of matches, so use count_mentors for 'how many' questions.",
    input_schema: inputSchema(SearchInput),
  },
  {
    name: "get_mentors",
    description:
      "Get full profiles, including the complete bio and notable organizations, for specific mentors by slug. Use for questions about particular people, comparisons, or details not in the roster.",
    input_schema: inputSchema(GetInput),
  },
  {
    name: "count_mentors",
    description:
      "Exact number of mentors matching `filters`, optionally broken down by a field (e.g. groupBy 'city' within a region, or groupBy 'industries' with no filters to see what the network covers). Always use this for 'how many' questions; never estimate counts from the roster.",
    input_schema: inputSchema(CountInput),
  },
];

function brief(m: Mentor) {
  return {
    slug: m.slug,
    name: m.name,
    title: m.title,
    company: m.company,
    location: m.location,
    focusAreas: m.focusAreas,
    industries: m.industries,
    expertise: m.expertise,
    roles: m.roles,
    summary: m.summary,
    canHelpWith: m.canHelpWith,
  };
}

function full(m: Mentor) {
  return { ...brief(m), seniority: m.seniority, organizations: m.organizations, bio: m.bio };
}

export type ToolOutput = { content: string; isError: boolean };

const error = (message: string): ToolOutput => ({ content: JSON.stringify({ error: message }), isError: true });

export function runTool(engine: Engine, name: string, input: unknown): ToolOutput {
  switch (name) {
    case "search_mentors": {
      const parsed = SearchInput.safeParse(input);
      if (!parsed.success) return error(`Invalid input: ${parsed.error.message}`);
      const { query, filters, limit } = parsed.data;
      const n = Math.min(Math.max(limit ?? 8, 1), MAX_SEARCH_LIMIT);
      const { matchingFilters, mentors } = engine.search({ query, filters, limit: n });
      const result = query?.trim()
        ? { mentorsPassingFilters: matchingFilters, mostRelevant: mentors.map(brief) }
        : { mentorsPassingFilters: matchingFilters, showing: mentors.length, mentors: mentors.map(brief) };
      return { content: JSON.stringify(result), isError: false };
    }
    case "get_mentors": {
      const parsed = GetInput.safeParse(input);
      if (!parsed.success) return error(`Invalid input: ${parsed.error.message}`);
      const { found, missing } = engine.get(parsed.data.slugs.slice(0, MAX_GET));
      return { content: JSON.stringify({ mentors: found.map(full), notFound: missing }), isError: false };
    }
    case "count_mentors": {
      const parsed = CountInput.safeParse(input);
      if (!parsed.success) return error(`Invalid input: ${parsed.error.message}`);
      return { content: JSON.stringify(engine.count(parsed.data)), isError: false };
    }
    default:
      return error(`Unknown tool "${name}".`);
  }
}
