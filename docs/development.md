# Development and operations

Run all local commands from the repository root so dotenv, migrations and storage paths resolve consistently. Node 22 LTS is the Docker and CI runtime; the initial host development machine used Node 26.12.0. `pnpm-lock.yaml` records the actual compatible dependency tree. Nest 12 is intentionally not selected because the CMS peers require Nest 11.

`pnpm dev` runs API, worker and Next together. `pnpm build` compiles backend/workspace sources and builds Next. `pnpm start:api`, `pnpm start:worker` and `pnpm --filter @hub/web start` run built outputs. Formatting uses Prettier, lint uses ESLint, and strict TypeScript checks backend and frontend.

`pnpm db:migrate` applies ordered SQL once under a PostgreSQL advisory transaction lock. CMS auth entities and host entities share a database but have distinct ownership boundaries. The CMS module initializes a TypeORM connection; vector/domain queries use a bounded `pg` pool. No Prisma shadow schema or duplicate auth tables are introduced. Do not edit applied migrations; add a new migration instead.

## Ingestion recovery

The worker dispatches persistent pending job IDs every two seconds. BullMQ retries three times with exponential backoff; provider HTTP calls retry transient network/429/5xx failures twice. A final failure appears on the document/job and is recoverable using Reindex. Failed queue jobs are retained seven days and completed jobs one day. There is a visible failed-job state, not a separate dead-letter service.

Uploads are limited to 10 MB by default and documents to 2000 chunks. A parser may consume more memory than the uploaded size, especially for compressed DOCX. Configure process/container resource limits and stronger parser isolation before accepting public uploads. Worker concurrency is two. A job's complete replacement index is committed at once; old chunks are hidden while status is not ready.

Readiness checks database connectivity, Redis and the configured embedding fingerprint. A separate worker container health check verifies a Redis heartbeat; neither check certifies provider availability or real-model quality. The API exposes job failures, evaluation history and structured request IDs. Monitor worker logs and job age for stalls.

## Embedding model changes

A model change, including a model with the same dimensions, requires re-embedding all sources. Normal startup refuses a fingerprint mismatch.

1. Finish active ingestion and stop API and worker. Back up PostgreSQL and uploaded files.
2. Update provider/model/dimension environment settings. Verify the model's actual dimension.
3. Run `CONFIRM_MODEL_REINDEX=yes pnpm exec ts-node scripts/change-model.ts` against that database. It transactionally clears old vectors, rebuilds the dimension-specific HNSW index, changes the pinned fingerprint, increments document versions and creates new ingestion jobs. It refuses active jobs.
4. Restart services; wait until all documents are ready. Re-run evaluations and compare retrieval quality. Existing chat history retains its old answers and source metadata until deletion; it is never fed into new prompts.

The change-model script is a maintenance operation, not part of ordinary startup. It has not been included in the initial acceptance journey; test it against a backup before using it on valuable data.

## Extending providers and CMS content

Implement `AIProvider` with dimensions, a stable fingerprint, batched embeddings and streamed events. Validate returned vector counts and dimensions. Return clear errors; never fall back to the mock. Bind it through `AiProviderModule` or add a provider branch in ai-core. Tool and content-source interfaces are contracts only.

The existing import package is a Google Sheets resource importer; the hub does not register it as a document parser. Incremental CMS synchronization remains deferred. Use confirmed `ResourceDefinition.hooks` or `ResourceService` interfaces when adding it, and establish ownership/access mapping before indexing records.

## Tests

Unit tests cover real PDF/DOCX extraction, chunking, validation, provider transport contracts, RRF, citation mapping, context limits and permissions. API integration creates temporary CMS users through the real CMS API, tests private/shared policies and cleans up its own records. Browser smoke uses the real admin login and uploads a PDF, waits for indexing, asks a question, downloads the cited source and deletes it. The sample evaluation queries a real vector database using deterministic mock embeddings.

For real-provider smoke testing, export the selected provider environment and run `REAL_PROVIDER_SMOKE=1 pnpm test`. It is skipped unless explicitly enabled. No paid API key is needed for the other tests.
