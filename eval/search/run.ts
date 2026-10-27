// Search eval: runs every labeled case through the engine and scores the
// ranking. Free and deterministic, so it runs in CI on every push.
//
//   npm run eval:search                      compare against the baseline, exit 1 on any drop
//   npm run eval:search -- --update-baseline accept the current scores as the new baseline
//
// Updating the baseline is a deliberate act: the diff of baseline.json shows
// exactly which cases got better or worse, and goes into the same commit as
// the change that caused it.

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getMentors } from "@/lib/assistant/data";
import { createEngine } from "@/lib/assistant/engine";
import { mean, mrr, ndcg, recall, strongHit } from "../lib/metrics";
import { CASES, resolveLabels } from "./cases";

const K = 20; // the most results the search tool ever returns
const BASELINE = path.join(import.meta.dirname, "baseline.json");
const METRICS = ["ndcg@10", "recall@20", "mrr", "strongHit@3"] as const;
type Scores = Record<(typeof METRICS)[number], number>;
type Baseline = { cases: Record<string, Scores>; categories: Record<string, Scores> };

const round = (x: number) => Math.round(x * 1e4) / 1e4;

const mentors = getMentors();
const engine = createEngine(mentors);

const cases: Record<string, Scores> = {};
for (const c of CASES) {
  const grades = resolveLabels(c, mentors);
  if (!Object.keys(grades).length) throw new Error(`Case "${c.id}" has no relevant mentors`);
  const ranked = engine.search({ query: c.query, filters: c.filters, limit: K }).mentors.map((m) => m.slug);
  cases[c.id] = {
    "ndcg@10": round(ndcg(ranked, grades, 10)),
    "recall@20": round(recall(ranked, grades, K)),
    mrr: round(mrr(ranked, grades, K)),
    "strongHit@3": strongHit(ranked, grades, 3),
  };
}

const aggregate = (ids: string[]) =>
  Object.fromEntries(METRICS.map((m) => [m, round(mean(ids.map((id) => cases[id][m])))])) as Scores;
const groups = [...new Set(CASES.map((c) => c.category))];
const categories: Record<string, Scores> = {
  ...Object.fromEntries(groups.map((g) => [g, aggregate(CASES.filter((c) => c.category === g).map((c) => c.id))])),
  overall: aggregate(CASES.map((c) => c.id)),
};
const current: Baseline = { cases, categories };

console.log(`Search eval: ${CASES.length} cases over ${mentors.length} mentors\n`);
console.table(Object.fromEntries(Object.entries(categories).map(([g, s]) => [`${g} (${g === "overall" ? CASES.length : CASES.filter((c) => c.category === g).length})`, s])));

const weakest = Object.entries(cases)
  .sort((a, b) => a[1]["ndcg@10"] - b[1]["ndcg@10"])
  .slice(0, 5);
console.log("\nWeakest cases by ndcg@10:");
for (const [id, s] of weakest) console.log(`  ${s["ndcg@10"].toFixed(3)}  ${id}`);

if (process.argv.includes("--update-baseline")) {
  writeFileSync(BASELINE, JSON.stringify(current, null, 2) + "\n");
  console.log(`\nBaseline updated: ${path.relative(process.cwd(), BASELINE)}`);
  process.exit(0);
}

let baseline: Baseline;
try {
  baseline = JSON.parse(readFileSync(BASELINE, "utf8"));
} catch {
  console.error("\nNo baseline yet. Run with --update-baseline to create one.");
  process.exit(1);
}

const changes: string[] = [];
let regressed = false;
for (const [scope, table] of [["category", categories], ["case", cases]] as const) {
  const before = scope === "category" ? baseline.categories : baseline.cases;
  for (const [id, scores] of Object.entries(table)) {
    for (const m of METRICS) {
      const was = before[id]?.[m];
      if (was === undefined || was === scores[m]) continue;
      const worse = scores[m] < was;
      if (worse) regressed = true;
      changes.push(`  ${worse ? "WORSE" : "better"}  ${scope} ${id}  ${m}: ${was} -> ${scores[m]}`);
    }
  }
}
const added = Object.keys(cases).filter((id) => !(id in baseline.cases));
const removed = Object.keys(baseline.cases).filter((id) => !(id in cases));

console.log(changes.length ? `\nChanges vs baseline:\n${changes.join("\n")}` : "\nNo changes vs baseline.");
if (added.length) console.log(`New cases (not in baseline): ${added.join(", ")}`);
if (removed.length) console.log(`Cases missing since baseline: ${removed.join(", ")}`);

if (regressed || added.length || removed.length) {
  console.error(
    "\nFAIL: search quality changed in a way the baseline does not reflect.\n" +
      "If the change is intended, run `npm run eval:search -- --update-baseline` and commit baseline.json with it.",
  );
  process.exit(1);
}
console.log("\nPASS");
