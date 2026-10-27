# Mentor Matching System

"Ask the Center" is a Q&A assistant about the mentors and programs of the Center for Strategic Learning and Leadership for the Digital Era (Teachers College, Columbia).
Visitors ask questions in plain language and get short, accurate answers with mentor cards embedded in the reply.

- [`docs/PRODUCT.md`](docs/PRODUCT.md): what visitors see and how it behaves.
- [`docs/arch.md`](docs/arch.md): system design and architecture map.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in values
npm run dev
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Run the app locally |
| `npm run data:update` | Sync mentors from new-center and crawl the deployed site, then re-enrich changed mentors |
| `npm test` | Unit tests |
| `npm run eval` | Run the question test suite against the live assistant |
| `npm run lint` / `npm run build` | Lint / production build |
