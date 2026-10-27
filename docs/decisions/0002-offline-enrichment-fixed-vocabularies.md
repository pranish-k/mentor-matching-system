# 0002. Offline enrichment into fixed vocabularies

Date: 2026-10-26
Status: Accepted

## Context

Mentor bios are free text.
Questions like "who has worked in insurance?" need structured fields that are spelled the same way every time.

## Decision

`scripts/enrich.ts` asks Claude Sonnet 5.5, once per mentor, to fill a fixed schema: summary, industries, expertise, seniority, roles, organizations and "can help with".
Industries, expertise, seniority and roles must come from the lists in `lib/assistant/vocab.ts`, enforced by structured outputs and re-checked in code.
Location and the site's official focus areas are parsed by code, not by the model.
Results are cached by a hash of the prompt and the exact record text the model sees, so only changed mentors are re-run.

## Consequences

- Filters and counts over these fields are exact and consistent.
- The tags are model judgments; their quality is checked by spot reviews and, later, a labeled sample.
- A prompt change re-runs every mentor (a few dollars), so prompt changes are measured on a sample first.
