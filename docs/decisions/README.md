# Decision records

Short records of design choices: the context, the decision, and what it costs us.
A record is never edited after it is accepted; a later record supersedes it instead.

| # | Decision | Status |
|---|---|---|
| [0001](0001-in-memory-data-no-database.md) | Mentor data lives in committed JSON and an in-memory index, no database | Accepted |
| [0002](0002-offline-enrichment-fixed-vocabularies.md) | Clean mentor records offline with Claude into fixed vocabularies | Accepted |
| [0003](0003-one-model-with-exact-tools.md) | One Claude conversation per question, with code tools for search and counts | Accepted |
| [0004](0004-site-is-the-source-of-truth.md) | The Center's site is the only source of truth | Accepted |
| [0005](0005-cards-from-data-not-model-text.md) | Mentor cards are rendered from data by slug, never from model text | Accepted |
| [0006](0006-evaluation-discipline.md) | Layered tests and evals with committed baselines | Accepted |
