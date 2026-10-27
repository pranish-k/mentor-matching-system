// Turns each synced mentor into a structured profile (industries, expertise,
// seniority, roles, organizations, summary, can-help-with) using Claude.
//
// Results are cached in data/mentors.enriched.json by a hash of the source
// record and the prompt version, so only new or changed mentors are sent.
//
// Usage:
//   npm run data:enrich                    all mentors that need it
//   npm run data:enrich -- --limit 10      at most 10 (for spot checks)
//   npm run data:enrich -- --only a,b      just these slugs (forces re-run)

import { createHash } from "crypto";
import { existsSync, readFileSync, writeFileSync } from "fs";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { EXPERTISE, INDUSTRIES, ROLES, SENIORITY } from "../lib/assistant/vocab";
import type { MentorProfile, SourceMentor } from "../lib/assistant/types";

process.loadEnvFile(".env.local");

const MODEL = "claude-sonnet-5-5";
// Prompt edits re-enrich automatically (the prompt is part of the hash). Bump
// this for changes that alter output without touching the prompt, such as
// the schema or normalize().
const PROMPT_VERSION = "2";
const CONCURRENCY = 6;
const SOURCE_PATH = "data/mentors.source.json";
const OUTPUT_PATH = "data/mentors.enriched.json";
// Sonnet 5.5 list prices, USD per million tokens.
const PRICE = { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.2 };

const ProfileSchema = z.object({
  summary: z.string(),
  industries: z.array(z.enum(INDUSTRIES)),
  expertise: z.array(z.enum(EXPERTISE)),
  seniority: z.enum(SENIORITY),
  roles: z.array(z.enum(ROLES)),
  organizations: z.array(z.string()),
  canHelpWith: z.array(z.string()),
});

// The schema above is sent to the API to steer Claude toward the fixed lists,
// but on rare occasions a value outside them still comes back. Parsing with
// this looser shape lets normalize() drop just that value instead of losing
// the whole profile.
const LooseProfileSchema = z.object({
  summary: z.string(),
  industries: z.array(z.string()),
  expertise: z.array(z.string()),
  seniority: z.enum(SENIORITY),
  roles: z.array(z.string()),
  organizations: z.array(z.string()),
  canHelpWith: z.array(z.string()),
});

type CacheEntry = { hash: string; profile: MentorProfile };
type Cache = Record<string, CacheEntry>;

const SYSTEM_PROMPT = `You turn a mentor's directory record into a structured profile for a mentor search tool.
The mentors are senior industry leaders who mentor executives in a Teachers College, Columbia University program on digital leadership.

Use only facts stated in the record. Do not add knowledge from outside it, and do not guess.

The program was formerly hosted at Northeastern University and has no ties to it now.
Leave out any role at Northeastern University's former Center for Technology Management and Digital Leadership (mentor, Executive in Residence, advisor there) from every field.
Other jobs or degrees at Northeastern University are ordinary facts and can be used like any other.

Fields:
- summary: one sentence, at most 25 words, third person, not starting with the person's name. Lead with their current role and add their most notable prior experience.
- industries: 1 to 4 industries where they have substantial experience, current or past. Choose from the allowed list only. The record's "site industries" are coarse hints and may be wrong.
  Tag the industry of the organizations they worked for, not their job function: a CIO at a hospital is "Healthcare & Life Sciences", a CTO at a bank is "Banking & Capital Markets".
  Definitions for the easily confused ones:
  - "Software & Internet": companies whose product is software, SaaS or internet services (Microsoft, Oracle, Google, software startups).
  - "IT Services & Hardware": companies that sell IT services, outsourcing or computer and network hardware (IBM, Infosys, Cisco, Dell). Never for an IT role inside a company in another industry.
  - "Consulting & Professional Services": management, strategy, technology and accounting advisory firms (McKinsey, Deloitte, Accenture, PwC) and the mentor's own consulting practice.
  - "Fintech & Payments": payment networks and financial technology companies (Visa, Mastercard, PayPal, fintech startups), not technology roles at a bank.
  - "Banking & Capital Markets": banks, brokerages and exchanges. "Investment & Asset Management": asset and wealth managers, hedge funds. "Venture Capital & Private Equity": VC and PE firms, including operating partners.
- expertise: 2 to 8 areas their record clearly shows they are strong in. Choose from the allowed list only.
- seniority: the highest level they have reached. "C-Suite" includes CEO, CIO, CTO, CDO, CFO, CISO, managing partner, president, or equivalent. "Academic" only if their main career is academic.
- roles: roles the record says they hold or have held besides their main job (founded a company, sits on a board, invests, advises, teaches as a professor, wrote a book, coaches executives, served in government). Empty if none.
- organizations: up to 6 notable organizations they have worked for or served on boards of, current first, using short common names (e.g. "JPMorgan Chase", "Deloitte").
- canHelpWith: 3 to 5 short phrases (at most 8 words each) describing what a mentee could get help with, grounded in this person's actual experience. Concrete, not generic: "Moving from CIO to a board seat" rather than "Leadership".`;

// Hashes exactly what Claude sees, so derived fields added to SourceMentor
// later don't trigger a needless re-run.
function hashSource(mentor: SourceMentor): string {
  return createHash("sha256")
    .update(PROMPT_VERSION)
    .update(SYSTEM_PROMPT)
    .update(recordText(mentor))
    .digest("hex")
    .slice(0, 16);
}

function recordText(m: SourceMentor): string {
  return [
    `Name: ${m.name}`,
    `Title: ${m.title}`,
    `Company: ${m.company}`,
    `Location: ${m.location}`,
    `Site industries: ${m.siteIndustries.join(", ") || "none"}`,
    `Site focus areas: ${m.focusAreas.join(", ") || "none"}`,
    `Bio: ${m.bio || "(no bio)"}`,
  ].join("\n");
}

// Keeps only values from a fixed list, collecting the rest for logging.
function keepKnown<T extends string>(values: string[], allowed: readonly T[], dropped: string[]): T[] {
  const known = new Set<string>(allowed);
  return values.filter((v): v is T => known.has(v) || (dropped.push(v), false));
}

// The schema can't express array lengths, so enforce the prompt's limits here
// and drop duplicates the model may repeat.
function normalize(p: z.infer<typeof LooseProfileSchema>, dropped: string[]): MentorProfile {
  const uniq = <T>(xs: T[]) => [...new Set(xs)];
  return {
    summary: p.summary.trim(),
    industries: uniq(keepKnown(p.industries, INDUSTRIES, dropped)).slice(0, 4),
    expertise: uniq(keepKnown(p.expertise, EXPERTISE, dropped)).slice(0, 8),
    seniority: p.seniority,
    roles: uniq(keepKnown(p.roles, ROLES, dropped)),
    organizations: uniq(p.organizations.map((o) => o.trim()).filter(Boolean)).slice(0, 6),
    canHelpWith: uniq(p.canHelpWith.map((c) => c.trim()).filter(Boolean)).slice(0, 5),
  };
}

function parseArgs() {
  const args = process.argv.slice(2);
  const limitIdx = args.indexOf("--limit");
  const onlyIdx = args.indexOf("--only");
  return {
    limit: limitIdx >= 0 ? Number(args[limitIdx + 1]) : Infinity,
    only: onlyIdx >= 0 ? new Set(args[onlyIdx + 1].split(",")) : null,
  };
}

async function main() {
  const { limit, only } = parseArgs();
  const mentors = JSON.parse(readFileSync(SOURCE_PATH, "utf-8")) as SourceMentor[];
  const cache: Cache = existsSync(OUTPUT_PATH) ? JSON.parse(readFileSync(OUTPUT_PATH, "utf-8")) : {};

  // Drop mentors that are no longer published.
  const current = new Set(mentors.map((m) => m.slug));
  for (const slug of Object.keys(cache)) if (!current.has(slug)) delete cache[slug];

  const todo = mentors
    .filter((m) => (only ? only.has(m.slug) : cache[m.slug]?.hash !== hashSource(m)))
    .slice(0, limit);
  console.log(`${mentors.length} mentors, ${todo.length} to enrich, ${mentors.length - todo.length} cached`);

  const client = new Anthropic({ maxRetries: 4 });
  const usage = { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 };
  const failures: string[] = [];
  let done = 0;

  // Written after every mentor so an interrupted run loses nothing; keys are
  // sorted so the committed file diffs cleanly.
  const save = () => {
    const sorted = Object.fromEntries(Object.entries(cache).sort(([a], [b]) => a.localeCompare(b)));
    writeFileSync(OUTPUT_PATH, JSON.stringify(sorted, null, 2) + "\n");
  };

  async function enrichOne(m: SourceMentor) {
    try {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 8000,
        output_config: { effort: "medium", format: zodOutputFormat(ProfileSchema) },
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: recordText(m) }],
      });
      usage.input += response.usage.input_tokens;
      usage.output += response.usage.output_tokens;
      usage.cacheWrite += response.usage.cache_creation_input_tokens ?? 0;
      usage.cacheRead += response.usage.cache_read_input_tokens ?? 0;

      if (response.stop_reason !== "end_turn") {
        throw new Error(`stop_reason=${response.stop_reason}`);
      }
      const text = response.content.find((b) => b.type === "text")?.text ?? "";
      const dropped: string[] = [];
      const profile = normalize(LooseProfileSchema.parse(JSON.parse(text)), dropped);
      cache[m.slug] = { hash: hashSource(m), profile };
      save();
      const note = dropped.length ? `  (dropped unknown values: ${dropped.join(", ")})` : "";
      console.log(`  [${++done}/${todo.length}] ${m.slug}${note}`);
    } catch (err) {
      failures.push(m.slug);
      const reason = err instanceof Anthropic.APIError ? `API ${err.status}: ${err.message}` : String(err);
      console.error(`  FAILED ${m.slug}: ${reason}`);
    }
  }

  const queue = [...todo];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let m = queue.shift(); m; m = queue.shift()) await enrichOne(m);
    }),
  );
  save();

  const cost =
    (usage.input * PRICE.input +
      usage.output * PRICE.output +
      usage.cacheWrite * PRICE.cacheWrite +
      usage.cacheRead * PRICE.cacheRead) /
    1e6;
  console.log(
    `done: ${done} enriched, ${failures.length} failed. ` +
      `tokens in=${usage.input} out=${usage.output} cacheW=${usage.cacheWrite} cacheR=${usage.cacheRead}, cost ~$${cost.toFixed(2)}`,
  );
  if (failures.length) {
    console.error(`failed: ${failures.join(",")}  (re-run to retry)`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
