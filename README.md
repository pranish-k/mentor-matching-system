# Mentor Matching System

"Ask the Center" is a Q&A assistant about the mentors and programs of the Center for Strategic Learning and Leadership for the Digital Era (Teachers College, Columbia).
Visitors ask questions in plain language and get short, accurate answers with mentor cards embedded in the reply.

- [`docs/PRODUCT.md`](docs/PRODUCT.md): what visitors see and how it behaves.
- [`docs/arch.md`](docs/arch.md): system design and architecture map.
- [`docs/decisions/`](docs/decisions/): why each design choice was made.
- [`CONTRIBUTING.md`](CONTRIBUTING.md): how changes are made, tested and measured.

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
| `npm run check` | Lint, typecheck, unit tests and search eval (what CI runs, minus the build) |
| `npm test` | Unit tests |
| `npm run eval:search` | Score search ranking on labeled queries; fails on any drop vs the baseline |
| `npm run lint` / `npm run typecheck` / `npm run build` | Lint / types / production build |
