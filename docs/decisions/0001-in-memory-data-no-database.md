# 0001. In-memory data, no database

Date: 2026-10-26
Status: Accepted

## Context

The directory has a few hundred mentors, and it changes a few times a year when the site is updated.
Visitors need exact filters and counts, and fast answers.

## Decision

Mentor data is generated into JSON files under `data/`, committed to git, and imported at build time.
Search, filters and counts run over an in-memory index (MiniSearch, BM25) inside the server process.

## Consequences

- Every query takes milliseconds and every count is exact.
- No database or vector service to run, pay for, secure or keep warm.
- Every data change is a reviewable git diff.
- This stops being the right choice at roughly tens of thousands of records, or if data must change without a deploy.
  Neither is expected.
