# Contributing

Use Node 22 LTS and the pinned pnpm version. Follow README setup, run formatting, type checking, lint, unit tests and production build before proposing a change. Run API integration and browser smoke tests for workflow or authorization changes. Tests use explicit mock AI and local PostgreSQL/Redis; never add real credentials or private data.

Keep AI provider logic in `packages/ai-core`, retrieval/parsing/metrics in `packages/ai-rag`, CMS adapters in `packages/cms-ai`, and HTTP/domain integration in `apps/api`. Validate new inputs, parameterize SQL, check authorization before retrieval, and preserve transaction-safe reindexing. Add migrations; never enable schema synchronization to hide drift.

Record behavior changes and known limitations. Do not claim model quality from mock tests. Verify public CMS exports before adding integrations, and do not edit installed/upstream packages. Keep changes reviewable and avoid unrelated refactors. Resolve the documented CMS licensing question before distributing a licensed release.
