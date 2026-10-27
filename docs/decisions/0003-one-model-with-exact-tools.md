# 0003. One model conversation with exact code tools

Date: 2026-10-26
Status: Accepted

## Context

Visitors ask vague questions ("who could help me move into a board role?") and exact ones ("how many mentors are in Europe?").
Multi-stage pipelines of several model calls are slow, and each stage is another place to go wrong.

## Decision

Each question is handled by one Claude Sonnet 5.5 conversation.
It starts with a cached system prompt containing the rules, a compact roster of every mentor, and the site's page text.
It can call three tools that are plain TypeScript over the in-memory index: `search_mentors`, `get_mentors` and `count_mentors`.
Tool inputs are validated with zod before running, because they are model output.

## Consequences

- The model does judgment (what the visitor needs, who fits, why); code does facts (filtering, counting, looking people up).
- Most answers need zero or one round of tool calls, which keeps latency low.
- Caching the large, stable prompt prefix keeps cost and time-to-first-token down.
