# Mentor Matching System - Product

This document describes what a visitor experiences when using "Ask the Center", and the rules it follows.
For how it is built, read [`arch.md`](arch.md).

---

## 1. In one paragraph

"Ask the Center" is a small, fast assistant that lives on the Center's website (new-center-pi.vercel.app).
A visitor clicks a chat bubble, asks anything about the mentors or programs, and gets a short, correct answer within a second or two, with real mentor cards embedded right in the answer.
They can ask follow-ups ("only people in Europe", "tell me more about her") in the same conversation.
When they want to talk to a human, one click opens an email to the program coordinator.
There are no logins and no accounts.

---

## 2. Where it lives

- **A floating bubble** in the bottom-right corner of every page on the site.
- **An entry point on the /mentors page**, near the top of the mentor directory: "Ask about our mentors" with a few suggested questions.

Both open the same conversation panel.
On phones, the panel opens full screen.

---

## 3. The panel

```
┌──────────────────────────────────────────┐
│  ASK THE CENTER                       ✕   │
│  Mentors and programs                     │
├──────────────────────────────────────────┤
│                                           │
│  Try asking:                              │
│  ┌──────────────────────────────────────┐ │
│  │ Who has led digital transformation   │ │
│  │ in healthcare?                       │ │
│  └──────────────────────────────────────┘ │
│  ┌──────────────────────────────────────┐ │
│  │ How many mentors are based in Europe?│ │
│  └──────────────────────────────────────┘ │
│  ┌──────────────────────────────────────┐ │
│  │ What is the Digital Leadership       │ │
│  │ Experience?                          │ │
│  └──────────────────────────────────────┘ │
│                                           │
├──────────────────────────────────────────┤
│  Ask about mentors or programs...     ➤   │
└──────────────────────────────────────────┘
```

It follows the site's design system:
Columbia navy `#002868`, thin gold `#b9975b` rules, Georgia for headings, system sans for body text, warm off-white backgrounds, no drop shadows or glassy effects.
It should feel like part of the site, not a bolted-on widget.

---

## 4. Example conversations

These show the shape and tone of answers.
The specific numbers are illustrative.

**Finding mentors for a need**

```
You:  I'm a CIO thinking about moving into a board role.
      Who could help?

      ◦ Searching mentors...

AI:   Three mentors have made that move from technology
      leadership to boards:

      ┌────────────────────────────────────────────┐
      │ [photo]  Sherry Aaholm                     │
      │          Chief Digital Officer, Cummins    │
      │          Manufacturing · Indianapolis      │
      │          Why: former FedEx EVP of IT,      │
      │          now leads digital at Cummins      │
      │          View profile →   Email about her  │
      └────────────────────────────────────────────┘
      ┌────────────────────────────────────────────┐
      │ ...                                        │
      └────────────────────────────────────────────┘

      Want me to narrow this to a particular industry?
```

**A question about one person**

```
You:  Where did Dana Deasy work before the Pentagon?

AI:   Before serving as DoD CIO, Dana Deasy was Global CIO at
      JPMorgan Chase, and earlier held CIO roles at BP and
      Siemens Americas.
      [Dana Deasy card]
```

**A counting question** (answered by code, not guessed)

```
You:  How many mentors are based in Europe?

AI:   30 mentors are based in Europe, most in London (9) and
      Paris (8). Want to see them, or filter by industry?
```

**A follow-up that refines**

```
You:  Only the ones in financial services.

AI:   7 of them work in financial services. Here are the
      closest fits: [cards]
```

**A program question**

```
You:  How long is the Digital Leadership Experience?

AI:   It runs 6, 9, or 12 months, built around your goals,
      with one-on-one mentoring and an applied capstone
      project. Full details on the program page →
```

**Things it will not do**

```
You:  How much does the program cost?

AI:   I don't have pricing information. The program team can
      walk you through cost and admissions.
      [Email the program team]
```

```
You:  Can you guarantee I get matched with Dana Deasy?

AI:   I can't promise a specific match. The program pairs each
      participant with a mentor based on their goals. If Dana's
      background fits what you're looking for, mention it when
      you reach out. [Email the program team]
```

```
You:  Write me a poem about cats.

AI:   I'm here to help with the Center's mentors and programs.
      Is there something about those I can help you find?
```

---

## 5. Answer style

- Short: 1 to 4 sentences of text, then cards.
- Never a paragraph per mentor.
  The card carries the details, and the text says why these people fit.
- Every mentor card links to that mentor's page on the site (`/mentors/[slug]`).
- Every card has "Email about this mentor", which opens an email to the program coordinator with the mentor's name prefilled.

---

## 6. Rules it follows

- Only answers about the Center, its mentors, and its programs.
- Never states prices, deadlines, or admissions facts unless they are on the site.
  Otherwise it points to the program team.
- Never promises a specific mentor match.
- Only uses information already public on the site.
  Mentor contact details are never shown, and only mentors listed on the site are ever mentioned.
- Counts are computed by code from the mentor data, never estimated.
- Mentor cards are built from the data, so a mentor that does not exist cannot appear.

The chat endpoint is public, so it also has a per-visitor rate limit, a maximum message length, a maximum conversation length, and a cap on lookups per answer.

---

## 7. Quality targets

| | Target |
|---|---|
| Time until something appears | under 1s (status line), first words under 1.5s |
| Full answer | under 4s median |
| Count questions | 100% exact |
| Nonexistent mentors cited | impossible by design |
| Off-topic, pricing or guarantee violations | zero in the test suite |

A test suite of about 60 questions checks these.
It covers finding mentors for a need, questions about a specific mentor, counts and overviews, multi-turn follow-ups, program questions, off-topic requests, and guardrail traps.
Expected answers for counts and lists are computed from the data, and free-text answers are graded against a short rubric.

---

## 8. Keeping the data fresh

The mentor list and page text come from the Center's site.

1. Update the mentors or pages in the site and deploy.
2. Run `npm run data:update`.
   This re-reads the mentors, re-crawls the site, and re-cleans only the mentors that changed.
3. Review the diff, commit, and redeploy.

---

## 9. Roadmap

| Step | Status |
|---|---|
| Data pipeline: site sync and profile enrichment | Done |
| Search engine and tools, with unit tests | Done |
| Streaming chat endpoint | Next |
| Chat bubble, panel, mentor cards, /mentors entry point | Planned |
| Question test suite | Planned |
| Move into the Center site | Planned |
