# Implementation report — 26 October 2026

## Delivered

Implemented a runnable pnpm monorepo with NestJS API, separate BullMQ worker, Next.js frontend, PostgreSQL/pgvector, Redis, reviewed SQL migrations, Dockerfiles/Compose and a CI workflow. Source code is in the workspace; nothing has been published, deployed remotely or committed automatically.

The implemented workflow includes CMS login/user/role management; private/shared knowledge-base CRUD; validated TXT/Markdown/PDF/DOCX upload; local persistent files and duplicate hashing; database ingestion outbox, retries and failure reporting; normalized overlapping chunks; batched embeddings; transactional vector replacement; semantic/full-text/weighted-RRF retrieval; guarded streamed RAG and database-derived citations; authenticated source downloads; private chat history; reindexing/deletion; operational UI; and persisted 20-case evaluation runs.

The UI was exercised in Chromium and its real dashboard screenshot is saved under `docs/screenshots`. Ten fictional commerce documents and twenty expected-evidence cases are included. The default mock is explicit and labelled. It never substitutes for a failed real provider.

## CMS packages actually used

| Package            | Version                        | Usage                                                                                                                    |
| ------------------ | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| @nestjs-cms/core   | 0.1.6                          | Resource persistence and TypeORM foundation, installed directly and used by CMS auth                                     |
| @nestjs-cms/auth   | 0.1.1                          | `CmsAuthModule`, `AuthService`, real sessions, users/roles, bootstrap and password management                            |
| @nestjs-cms/admin  | 0.1.3                          | `AdminPortal`, `defineAdmin`, `defineCustomSection`, `createAuthSections`; login/navigation/editors and custom hub views |
| @nestjs-cms/import | 0.1.1 inspected, not installed | Confirmed Google Sheets resource importer; does not supply PDF/DOCX parsing, so no invented use                          |

The current registry metadata, tarballs, declarations and compiled implementations were investigated before architecture selection. The core source repository HEAD matched its published gitHead. See `cms-integration-analysis.md` for evidence and constraints.

## Decisions

- NestJS 11 and TypeORM match CMS peer dependencies. Prisma was not introduced as a competing schema/auth model. Parameterized `pg` queries handle vector/domain transactions.
- Custom AI controllers have a separate guard using the real CMS `AuthService`; the upstream CMS guard does not automatically protect host controllers.
- API, worker and UI remain a modular application. Core AI/retrieval libraries are framework independent; `AiProviderModule` supplies a reusable Nest DI binding. Workspace packages are private and not yet independently publishable.
- PDF extraction uses the actual `pdf-parse@2.4.5` API and preserves pages. An earlier parser failed a real fixture and was replaced before acceptance tests passed.
- Current model/dimension is pinned in the database. Changing models requires a deliberate reindex maintenance operation.
- Deleting a source purges all chat/evaluation data for that KB to remove potentially derived content. This conservative behavior is explicit in UI confirmations and security documentation.
- Correct MUI/Next integration and CSS layer order resolved a sidebar overlap found by browser testing.

## Executed verification

| Check                               | Result                                                                                                                                  |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| pnpm dependency installation        | Passed; committed-input lockfile generated, frozen install used in Docker                                                               |
| Strict backend/frontend type checks | Passed                                                                                                                                  |
| ESLint                              | Passed                                                                                                                                  |
| Prettier check                      | Passed                                                                                                                                  |
| Unit/provider tests                 | 9 passed; 1 optional real-provider smoke skipped                                                                                        |
| PDF/DOCX extraction                 | Actual generated fixtures parsed; source text asserted                                                                                  |
| API integration journey             | Passed against native services and fresh Docker stack                                                                                   |
| Chromium browser journey            | Passed against fresh Docker stack, including actual PDF upload, indexed status, streamed extract, citation/source download and deletion |
| Backend/Next production build       | Passed                                                                                                                                  |
| Docker images and fresh startup     | Passed on Node 22; migrations applied and all five running services reported healthy, including worker and web                          |
| Docker seed and readiness wait      | Passed; all 10 documents reached ready                                                                                                  |
| Persisted evaluation CLI            | Passed for all 20 cases                                                                                                                 |

API integration covers unauthenticated rejection, real CMS account creation/password/login, KB CRUD, private knowledge isolation, malformed PDF rejection, duplicate rejection, job/download access, semantic and hybrid search, cross-user chat rejection, history, reindex without duplicate searchable chunks, deletion cleanup, and shared-read versus owner-write policy. A malicious instruction in source content did not alter application access control. This does not claim model-level prompt-injection immunity.

Observed Docker mock evaluation: **Recall@6 1.000; MRR 0.870833; 20 cases**. Mean retrieval latency was approximately **1.95 ms** on this local sample run, not a performance benchmark. The small baseline JSON is saved in `docs/evaluation-baseline.json`. No live OpenAI or Ollama model was tested; the OpenAI-compatible wire protocol was exercised against a local HTTP test server. No genuine model answer-quality claim is made.

The host used Node 26.12.0; Docker acceptance used Node 22. The CI definition was created but was not run on GitHub Actions. A temporary approval-service credit failure delayed one command; the user's continuation succeeded and the previously blocked tests were subsequently executed.

## Acceptance scenarios

A installation/startup, B authenticated PDF ingestion, C authorized semantic search, D streamed response with actual source references, E cross-user denial, F reindex without duplicate chunks, G deletion/search cleanup, H calculated evaluation metrics, I executable build/test workflow, and J confirmed CMS integration were exercised. Scenario D used the explicitly selected mock; real-provider generation remains an environment-dependent verification item.

## Remaining work and limitations

- Live provider smoke/answer-quality evaluation requires credentials or running Ollama models.
- Incremental/direct CMS content synchronization, reranking, full revision history, agent/MCP execution, tenant isolation and advanced parsing remain deferred.
- Chat history is saved and displayed but prior turns are not model context. Token budgets use character estimates. Citations identify real retrieved evidence but do not automatically prove each generated claim is supported.
- Evaluations run within an HTTP request; durable evaluation jobs and recovery of crash-stuck runs are not implemented.
- Parser process isolation/decompression quotas, stronger resource/cost quotas and filesystem cleanup outbox remain future hardening. CMS user deletion can leave orphan files; delete owned KBs first. See security documentation.
- The maintenance model-change script is implemented and type checked but was not exercised against valuable data or included in the acceptance journey.
- API docs are generated with the principal input contracts; exhaustive typed response schemas remain future work.
- MIT licensing is deferred: the published admin package says `UNLICENSED`, while the other inspected CMS package metadata omit license grants. The assembled project cannot yet be advertised as unconditionally MIT licensed.

## Startup

Native workflow from the repository root:

```bash
cp .env.example .env  # only for a fresh checkout; preserve an existing configured .env
pnpm install --frozen-lockfile
docker compose up -d --wait postgres redis
pnpm db:migrate
pnpm dev
# second terminal, after API startup:
pnpm db:seed
node scripts/wait-demo.mjs
pnpm eval
```

Full Docker alternative, with a separate project to keep database and file volumes consistent:

```bash
docker compose -p hub-docker up --build -d
docker compose -p hub-docker exec api node dist/scripts/seed.js
docker compose -p hub-docker exec api node scripts/wait-demo.mjs
docker compose -p hub-docker exec api node dist/scripts/evaluate.js
```

Use one workflow at a time on ports 3000/3001. The native workflow stores files in `.data/uploads`; the Docker workflow uses its own persistent upload volume. Follow README configuration for genuine AI instead of the default mock.

Next priorities: settle ecosystem licensing, verify real providers, add failure/concurrency and parser-hardening coverage, implement durable evaluation/cleanup jobs, then add permission-mapped CMS synchronization.

## Follow-up: automatic API resource discovery

The seven hub entities now have default-exported `defineResource` files in `apps/api/src/resources`. The CMS loads this folder through `cmsAuthOptions()` in source (`.ts`) and compiled (`.js`) execution. Knowledge-base create/update delegates to the actual CMS `ResourceService`; generated administrative lists are enabled, and resource hooks/host policy preserve workflow mutations and private-history isolation. Migration 003 adds the timestamps expected by CMS entities without changing existing IDs or vector indexes.

Verified after this change: TypeScript compilation/checking and targeted ESLint passed; 11 unit tests passed with 1 optional real-provider test skipped; both database integration tests passed. The API was started successfully from source and compiled output on an isolated port, leaving the user's running API untouched. The additive migration was applied locally. Restart an existing API process to load the new resource configuration. See `docs/resources.md` for extension and route behavior.
