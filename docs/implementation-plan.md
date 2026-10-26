# Implementation and acceptance plan

1. Inspect published CMS artifacts (complete; see integration analysis).
2. Implement shared AI provider contracts, parsing, chunking, fusion and metrics.
3. Implement PostgreSQL migrations, CMS-backed identity, guarded repository, persistent upload and BullMQ worker with atomic index replacement.
4. Implement search, streamed RAG, history, evaluations and operational API.
5. Build Next.js custom sections in the existing CMS admin portal.
6. Seed ten fictional commerce sources and twenty evaluation cases.
7. Run type checks, lint, unit tests, build and real PostgreSQL/Redis integration scenarios. Record actual results and blockers separately.

Acceptance: login → create private KB → upload supported file → queued/processing/ready → retrieve authorized chunks → stream cited answer → inspect history/source → reindex without duplicate chunks → delete and verify search removal. A second identity must fail private KB and chat access. Evaluation persists calculated recall/MRR. Mock selection must be explicit and never a provider-failure fallback.

Phase 2 remains secondary; phase 3 uses contracts only. Progress and final verification are recorded in docs/implementation-report.md.
