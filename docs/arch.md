# Architecture

This is the system design of the Mentor Matching System, the "Ask the Center" assistant.
Parts marked **(built)** exist in the repo today.
Parts marked **(planned)** are the design for build steps 4 to 7 and may change as we build them.

For what visitors see and example conversations, read [`PRODUCT.md`](PRODUCT.md).

---

## 1. The whole system on one page

The system has two halves.
The **offline** half turns the site's raw mentor data into clean, searchable JSON, and runs only when the data changes.
The **live** half answers visitor questions, using that JSON plus one Claude conversation per question.

```
 ╔═══════════════════════════════ OFFLINE  (npm run data:update) ═══════════════════════════════╗
 ║                                                                                               ║
 ║   new-center repo (local checkout)            deployed site                                   ║
 ║   proposed_center/data/mentors/mentors.json   https://new-center-pi.vercel.app                 ║
 ║            │                                          │                                       ║
 ║            │ 230 published mentors                    │ 19 pages (programs, about, ...)       ║
 ║            ▼                                          ▼                                       ║
 ║   ┌─────────────────────────────── scripts/sync-data.ts (built) ──────────────────────────┐  ║
 ║   │  drop published:false, decode HTML entities, split location into city/state/country, │  ║
 ║   │  map country to region, keep official focus areas; crawl each page's <main> text     │  ║
 ║   └───────────────┬──────────────────────────────────────────────────────┬────────────────┘  ║
 ║                   ▼                                                      ▼                   ║
 ║        data/mentors.source.json                                   data/pages.json            ║
 ║                   │                                                                          ║
 ║                   ▼                                                                          ║
 ║   ┌──────────────────────────────── scripts/enrich.ts (built) ────────────────────────────┐  ║
 ║   │  for each mentor whose input hash changed:                                            │  ║
 ║   │    Claude Sonnet 5.5 + structured output  ──►  summary, industries, expertise,        │  ║
 ║   │    (fixed vocabularies, 6 in parallel)          seniority, roles, organizations,      │  ║
 ║   │                                                 canHelpWith                           │  ║
 ║   └───────────────────────────────────────────┬───────────────────────────────────────────┘  ║
 ║                                               ▼                                              ║
 ║                                  data/mentors.enriched.json                                  ║
 ║                                  (slug -> {hash, profile})                                   ║
 ║                                                                                               ║
 ║   All three data files are committed to git, so every change is reviewable in a diff.        ║
 ╚═══════════════════════════════════════════════════════════════════════════════════════════════╝
                                               │
                                               │ imported at build time (no database)
                                               ▼
 ╔═══════════════════════════════════ LIVE  (every question) ════════════════════════════════════╗
 ║                                                                                               ║
 ║   Browser                                    Next.js server                                   ║
 ║  ┌──────────────────────────┐  POST        ┌──────────────────────────────────────────────┐  ║
 ║  │ ChatBubble / ChatPanel   │  messages    │ app/api/chat/route.ts (planned)              │  ║
 ║  │ (planned)                │ ───────────► │  1. validate + rate limit                    │  ║
 ║  │                          │              │  2. build request: cached system prompt      │  ║
 ║  │  renders streamed text,  │              │     + conversation                           │  ║
 ║  │  swaps [[mentor:slug]]   │  NDJSON      │  3. tool loop with Claude Sonnet 5.5 ──────┐ │  ║
 ║  │  markers for cards,      │ ◄─────────── │  4. stream events back                     │ │  ║
 ║  │  shows tool status       │  stream      └──────────────────────────────────────────┬─┘ │  ║
 ║  └──────────────────────────┘                                                         │   │  ║
 ║                                                     ┌─────────────────────────────────┘   │  ║
 ║                                                     ▼                                     │  ║
 ║                       ┌───────────────────────────────────────────────┐                   │  ║
 ║                       │ lib/assistant  (built)                        │                   │  ║
 ║                       │  data.ts    join source + enriched -> Mentor[]│                   │  ║
 ║                       │  engine.ts  MiniSearch index, filters, counts │                   │  ║
 ║                       │  tools.ts   3 tools + zod validation          │                   │  ║
 ║                       └───────────────────────────────────────────────┘                   │  ║
 ║                                                                                           │  ║
 ║                       Anthropic API  ◄────────────────────────────────────────────────────┘  ║
 ╚═══════════════════════════════════════════════════════════════════════════════════════════════╝
```

---

## 2. Offline: the data pipeline (built)

### 2.1 Why there is an offline step

Mentor bios are free text.
"Ex-FedEx EVP of IT, now CDO at Cummins" can't be filtered or counted.
So we ask Claude once per mentor to fill in a fixed form, and store the result.
At question time, filters and counts become plain code over clean fields, which makes them exact and fast.

### 2.2 Data flow

```
 mentors.json ──► sync-data.ts ──► mentors.source.json ──► enrich.ts ──► mentors.enriched.json
 (site repo)        (no AI)          (230 records)          (Claude)       (230 profiles)

 live site ─────► sync-data.ts ──► pages.json
 (19 routes)        (crawler)        (~33k chars of page text)
```

### 2.3 What each record looks like

```
 SourceMentor (from the site, cleaned up)          MentorProfile (from Claude, fixed vocab)
 ─────────────────────────────────────────         ───────────────────────────────────────
 slug, name, title, company                        summary        one sentence
 bio, linkedin, image                              industries     up to 4, from 23 values
 location, city, state, country, region            expertise      up to 8, from 33 values
 focusAreas      (the site's 6 official ones)      seniority      C-Suite | VP | Director |
 siteIndustries  (raw, from the site)                             Professional | Academic
                                                   roles          from 8 values
                                                   organizations  up to 6
                                                   canHelpWith    up to 5 short phrases

                    Mentor = SourceMentor + MentorProfile
```

The fixed vocabularies live in `lib/assistant/vocab.ts`.
They are why "Financial Services" is always spelled one way, so a count is a count.

### 2.4 Enrichment safety

```
 for each mentor:
    hash = sha256(prompt version + system prompt + the record text Claude sees)
    if hash == stored hash  ──► skip  (costs nothing)
    else ──► Claude call ──► loose parse ──► drop any value not in the vocab (logged)
                                        ──► apply caps ──► save immediately
```

- Changing one mentor re-runs only that mentor.
- Changing the prompt re-runs everyone, on purpose.
- Adding a field Claude doesn't see (like `state`) re-runs no one.
- Saving after every mentor means a crash loses at most one call.
- The prompt sets the rules: use only facts in the record, tag the employer's industry rather than the job function, and leave out the former Northeastern Center role while keeping other Northeastern jobs and degrees as plain facts.

---

## 3. Live: answering a question

### 3.1 The engine and tools (built)

`lib/assistant/engine.ts` is pure, synchronous code over 230 records in memory.
Every call takes milliseconds and returns exact results.

```
                      ┌────────────────────────────── engine ──────────────────────────────┐
                      │                                                                     │
 filters ────────────►│  matches(mentor, filters)                                           │
 (OR within a field,  │    focusAreas, industries, expertise, roles, seniority, regions:   │
  AND across fields)  │    exact vocab match; countries, states, cities: case-insensitive  │
                      │                                                                     │
                      │  search({query, filters, limit})                                    │
 query ──────────────►│    pool = mentors passing filters                                   │
                      │    no query  -> pool alphabetically                                 │
                      │    query     -> MiniSearch BM25 ranking inside the pool             │
                      │                 boosts: name 4, title/company/orgs 2, profile 1.5   │
                      │                 typo tolerance only on words of 5+ letters          │
                      │                                                                     │
                      │  count({filters, groupBy})  -> total + breakdown by any field       │
                      │  get(slugs)                 -> full records + slugs not found       │
                      └─────────────────────────────────────────────────────────────────────┘
```

`lib/assistant/tools.ts` exposes the engine to Claude as three tools.
Every tool input is checked with zod first, because tool inputs are model output.
Bad input comes back to Claude as an error result instead of crashing.

| Tool | Answers | Returns |
|---|---|---|
| `search_mentors` | "Who can help with X?", "List the people in Y" | exact count passing filters + up to 20 brief profiles |
| `get_mentors` | "Tell me about Z", comparisons | up to 6 full profiles with bios |
| `count_mentors` | "How many...?", "What industries are covered?" | exact total + optional breakdown |

### 3.2 The chat request (planned, step 4)

```
 Browser                 route.ts                         Claude Sonnet 5.5           engine
    │                       │                                    │                       │
    │ POST {messages}       │                                    │                       │
    │──────────────────────►│ check size, length, rate limit     │                       │
    │                       │                                    │                       │
    │                       │ system prompt (cached) + messages  │                       │
    │                       │───────────────────────────────────►│                       │
    │  {tool_status}        │◄──── tool_use: count_mentors ──────│                       │
    │◄──────────────────────│                                    │                       │
    │                       │ runTool ──────────────────────────────────────────────────►│
    │                       │◄──────────────────────────────────────────────── exact JSON│
    │                       │ tool_result ──────────────────────►│                       │
    │  {text} {text} ...    │◄──── streamed answer text ─────────│                       │
    │◄──────────────────────│                                    │                       │
    │  {done}               │                                    │                       │
    │◄──────────────────────│                                    │                       │
```

The loop repeats until Claude stops calling tools, with a cap on rounds per answer.
Most questions need zero or one round of tool calls.

**The cached system prompt** (`lib/assistant/prompt.ts`) is built the same way every time, so the API can cache it:

```
 ┌──────────────────────────────────────────────┐
 │ instructions + answer style + guardrails     │
 │ roster: one line per mentor (deterministic)  │  ◄── cache breakpoint: reused across
 │ site page text from pages.json               │      all visitors, read at ~10% cost
 └──────────────────────────────────────────────┘
 │ the conversation so far                      │  ◄── changes per request
 └──────────────────────────────────────────────┘
```

**The stream** is newline-delimited JSON, one event per line:

| Event | Meaning |
|---|---|
| `{"type":"tool_status","label":"Searching mentors..."}` | show a status line right away |
| `{"type":"text","delta":"..."}` | append answer text |
| `{"type":"done"}` | answer finished |
| `{"type":"error","message":"..."}` | something failed, show a friendly fallback |

**Mentor cards.**
Claude writes `[[mentor:sherry-aaholm]]` in its text.
The panel replaces each marker with a card built from our own data.
An unknown slug renders nothing, so Claude can't invent a mentor or get a title wrong.

### 3.3 The UI (planned, step 5)

```
 every page                              /mentors page
 ┌───────────────────────────┐           ┌───────────────────────────┐
 │                           │           │ Ask about our mentors     │
 │                           │           │ [suggested question] ...  │──┐
 │                      (●)──┼──┐        │ mentor grid ...           │  │
 └───────────────────────────┘  │        └───────────────────────────┘  │
                                ▼                                       ▼
                        ┌──────────────────── ChatPanel ────────────────────┐
                        │ ASK THE CENTER                                ✕   │
                        │ messages: text + InlineMentorCard                 │
                        │   card: photo, name, title, location, why,        │
                        │         View profile -> /mentors/<slug>           │
                        │         Email about this mentor -> coordinator    │
                        │ input                                         ➤   │
                        └───────────────────────────────────────────────────┘
                        desktop: panel bottom-right   phone: full screen
```

It follows the site's `DESIGN.md`: navy `#002868`, gold `#b9975b` rules, Georgia headings, system sans body, off-white backgrounds, no shadows.
Conversation state lives only in the browser tab.
There are no accounts and nothing is stored server-side.

---

## 4. Guardrails and abuse limits

```
 request ──► [ body size + message length cap ] ──► [ conversation length cap ]
         ──► [ per-visitor rate limit ] ──► Claude ──► [ max tool rounds ] ──► answer
                                              │
                                              └── refusal fallback: friendly message
```

| Layer | Rule |
|---|---|
| Data | Only published mentors exist in the data files, and mentor emails are never synced. |
| Prompt | Only the Center, its mentors and programs. No prices, deadlines or admissions facts unless they are on the site. No promised matches. No ties to Northeastern. |
| Cards | Built from our data by slug, never from model text. |
| Endpoint | Rate limit, size caps and tool-round cap protect against abuse and runaway cost. |
| Tests | The eval suite (step 6) includes pricing, guarantee and off-topic traps, with a target of zero violations. |

---

## 5. Repository map

```
mentor-matching-system/
├── app/
│   ├── layout.tsx, page.tsx, globals.css   (built)  shell with the site's design tokens
│   └── api/chat/route.ts                   (planned) streaming chat endpoint
├── components/assistant/                   (planned) ChatBubble, ChatPanel, InlineMentorCard
├── lib/assistant/
│   ├── vocab.ts        (built)  fixed vocabularies, country -> region
│   ├── types.ts        (built)  SourceMentor, MentorProfile, Mentor, SitePage
│   ├── parse.ts        (built)  entity decoding, location and focus area parsing
│   ├── data.ts         (built)  loads and joins the data files
│   ├── engine.ts       (built)  search, filters, counts
│   ├── tools.ts        (built)  Claude tool definitions + executor
│   ├── prompt.ts       (planned) system prompt, roster, page text
│   └── *.test.ts       (built)  29 unit tests
├── scripts/
│   ├── sync-data.ts    (built)  site data + crawl -> data/
│   └── enrich.ts       (built)  Claude enrichment with hash cache
├── data/               (built)  mentors.source.json, mentors.enriched.json, pages.json
├── eval/               (planned) questions + runner (npm run eval)
└── docs/
    ├── PRODUCT.md      what visitors see and the rules it follows
    └── arch.md         this file
```

---

## 6. Where it ends up (step 7)

```
 today                                         after the port
 ┌───────────────────────┐                     ┌──────────────────────────────────────┐
 │ this repo             │                     │ new-center                           │
 │  reads new-center's   │   copy assistant    │  components/assistant/  lib/assistant│
 │  mentors.json via     │ ──────────────────► │  app/api/chat/  scripts/             │
 │  NEW_CENTER_PATH      │   folders + route   │  reads its own mentors.json directly │
 └───────────────────────┘                     │  one Vercel deployment               │
                                               └──────────────────────────────────────┘
```

The site and the assistant then deploy together, and the sync step no longer needs to copy files between repos.

---

## 7. Key numbers

| | Value |
|---|---|
| Published mentors | 230 |
| Site pages crawled | 19 |
| Tools | 3 |
| Engine call time | milliseconds |
| Model | Claude Sonnet 5.5 (enrichment and answers) |
| One-time enrichment cost | about $4 |
| Targets (step 6) | first words under 1.5s, median answer under 4s, exact counts, zero guardrail violations |
