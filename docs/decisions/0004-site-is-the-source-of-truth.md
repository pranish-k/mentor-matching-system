# 0004. The Center's site is the only source of truth

Date: 2026-10-26
Status: Accepted

## Context

The assistant must never say something the site does not, and must never reveal anything the site does not show.

## Decision

Mentor data comes from the site repository's `mentors.json`, skipping any mentor marked `published: false`.
Program knowledge comes from crawling the deployed site's pages, not from source files that may hold drafts or outdated text.
No other data source is used.

## Consequences

- Updating the site and running `npm run data:update` is the only way to change what the assistant knows.
- If the site is wrong, the assistant is wrong in the same way; fixes go to the site.
