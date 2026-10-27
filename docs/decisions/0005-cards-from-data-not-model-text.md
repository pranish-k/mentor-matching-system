# 0005. Mentor cards come from data, not model text

Date: 2026-10-26
Status: Accepted

## Context

Showing a wrong title, a wrong photo, or a person who does not exist would break visitor trust.

## Decision

When the model refers to a mentor, it writes a marker such as `[[mentor:sherry-aaholm]]`.
The chat panel replaces each marker with a card rendered from our data.
A marker with an unknown slug renders nothing.

## Consequences

- Names, titles, photos and links on cards are always correct, and invented mentors cannot appear as cards.
- The eval checks that every marker refers to a real, published mentor.
