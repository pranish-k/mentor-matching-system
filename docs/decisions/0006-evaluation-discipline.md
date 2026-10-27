# 0006. Layered tests and evals with committed baselines

Date: 2026-10-27
Status: Accepted

## Context

This is a production product with a model in the loop.
Model output varies between runs, and changes to prompts, data or ranking can silently make answers worse.

## Decision

Quality is measured in layers, cheapest first:

1. Unit tests for deterministic code, run on every change and in CI.
2. A search eval: labeled queries scored with nDCG@10, recall@20, MRR and strong-hit@3.
   Free and deterministic, run in CI, and it fails on any drop versus the committed `eval/search/baseline.json`.
   Labels never come from the engine or its indexed tags.
3. An end-to-end eval through the real assistant: code-graded checks (exact counts, real mentors only, rule traps, latency, cost) plus a rubric graded by a model whose grades are checked against human labels on a sample.
   Each question runs several times, results are reported with their spread, and runs are compared against the last recorded run.
   It costs money, so it runs on demand for changes that affect answers and before every release.

Work goes straight to `main`, with CI on every push.
An intended score change is accepted by updating the baseline in the same commit.

## Consequences

- Every claim that a change "helped" is backed by a number in the repository history.
- Labels and baselines must be maintained as the data changes; the eval fails loudly when a labeled mentor disappears.
