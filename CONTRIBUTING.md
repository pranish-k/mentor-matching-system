# Contributing

This is a production product.
Every change is measured before and after, and nothing ships on a gut feeling.

## The loop for every change

1. **State the goal and how you will know it worked.**
   Name the metric or test that should move, for example "need-query nDCG@10 goes up" or "the pricing trap stops failing".
2. **Reproduce first.**
   For a bug, write a failing unit test or eval case before fixing it.
3. **Make the change.**
4. **Run the checks locally:** `npm run check` (lint, typecheck, unit tests, search eval).
5. **If the change can affect answers** (prompt, tools, engine, data, model or effort), run the end-to-end eval and compare against the last recorded run.
6. **Commit the evidence with the change.**
   If a baseline moved on purpose, its updated file goes in the same commit, and the commit message says what moved and why.
7. **Write a decision record** in `docs/decisions/` when the change is a design choice someone could later ask "why?" about.

CI runs the same checks on every push to `main` and on every pull request.
A red CI is fixed before anything else.

## Test layers

| Layer | Command | Cost | When | What it guards |
|---|---|---|---|---|
| Unit tests | `npm test` | free | every change, CI | parsing, engine semantics, tool validation, data integrity, metrics |
| Search eval | `npm run eval:search` | free | every change, CI | ranking quality on labeled queries; fails on any drop vs `eval/search/baseline.json` |
| End-to-end eval | planned | a few dollars per run | changes that affect answers, and before every release | answer accuracy, rule violations, latency, cost |

### Search eval labels

Labels never come from the search engine or the tags it indexes, so the eval can't grade the engine with its own answers.
Name, organization and title cases are labeled by rules over the raw site record.
Need cases are judged by hand from full profiles, and reviewed.
See `eval/search/cases.ts`.

To accept an intended change in scores, run `npm run eval:search -- --update-baseline` and commit `baseline.json` with the change.
The diff shows exactly which cases moved.

## What may be committed

This repository is public.
Commit only what is already public on the Center's site, plus code and data derived from it.
Never commit secrets (`.env.local` is ignored), personal contact details, or anything about mentors not shown on the site.

## Data updates

Run `npm run data:update`, review the diff of `data/`, run `npm run check`, and commit.
Enrichment only re-runs mentors whose input changed, and prints its cost.
A change to the enrichment prompt re-runs every mentor, so measure it on a sample first.
