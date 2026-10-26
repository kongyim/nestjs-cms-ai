# Environment reference

Copy `.env.example` to `.env`. Values below are server-side unless noted. Environment is read at process startup. The core CMS additionally supports S3/attachment settings documented in its own README, but this hub uses local document storage and does not configure S3.

| Variable                                         | Default/example                   | Purpose                                                           |
| ------------------------------------------------ | --------------------------------- | ----------------------------------------------------------------- |
| NODE_ENV                                         | development                       | CMS production validation and secure-cookie behavior              |
| PORT                                             | 3001                              | API listener; Next uses 3000                                      |
| HOST                                             | 0.0.0.0                           | CMS config compatibility; host API intentionally binds 0.0.0.0    |
| ADMIN_ORIGIN                                     | http://localhost:3000             | Exact allowed browser origin, HTTPS in production                 |
| ADMIN_BOOTSTRAP_EMAIL                            | admin@example.test                | Initial administrator, only on empty users table                  |
| ADMIN_BOOTSTRAP_PASSWORD                         | local-demo-password-change-me     | 12–128 characters; change for nonlocal use                        |
| ADMIN_API_KEY                                    | local example                     | Server-only core guard requirement; >=32 characters in production |
| DB_TYPE                                          | postgres                          | CMS adapter; hub specifically requires PostgreSQL                 |
| DB_HOST / DB_PORT                                | 127.0.0.1 / 54329                 | Native PostgreSQL connection                                      |
| DB_USERNAME / DB_PASSWORD / DB_DATABASE          | hub / local example / hub         | Database credentials; password required                           |
| DB_SYNCHRONIZE                                   | false                             | Must stay false; reviewed migrations own schema                   |
| REDIS_HOST / REDIS_PORT                          | 127.0.0.1 / 63799                 | Queue/rate-limit Redis                                            |
| STORAGE_PATH                                     | .data/uploads                     | Shared persistent local storage directory                         |
| UPLOAD_MAX_BYTES                                 | 10485760                          | File limit; maximum configured value 50 MiB                       |
| AI_PROVIDER                                      | mock in example; required         | mock, openai or ollama; no implicit fallback                      |
| AI_BASE_URL                                      | http://localhost:11434 in example | OpenAI-compatible /v1 root or Ollama root                         |
| AI_API_KEY                                       | empty                             | Required for openai branch; never exposed to UI                   |
| CHAT_MODEL                                       | llama3.2                          | Provider model identifier                                         |
| EMBEDDING_MODEL                                  | nomic-embed-text                  | Provider embedding identifier                                     |
| EMBEDDING_DIMENSIONS                             | 64 in mock example                | Actual model dimension, 8–2000; 1536/768 common provider examples |
| AI_TIMEOUT_MS                                    | 60000                             | HTTP request and body deadline                                    |
| CHUNK_TOKENS / CHUNK_OVERLAP                     | 500 / 75                          | Character-estimated token budgets; overlap must be smaller        |
| CONTEXT_TOKENS                                   | 4000                              | Estimated retrieved-evidence budget; max 16000                    |
| INPUT_COST_PER_MILLION / OUTPUT_COST_PER_MILLION | 0 / 0                             | Optional per-million-token cost estimates                         |
| API_INTERNAL_URL                                 | http://127.0.0.1:3001             | Next server proxy target; Docker sets http://api:3001             |
| API_URL                                          | http://localhost:3001/api         | CLI and integration API target                                    |
| WEB_URL                                          | http://localhost:3000             | Browser test target                                               |
| EVAL_KB_ID / EVAL_TOP_K / EVAL_HYBRID            | demo lookup / 6 / true            | CLI evaluation overrides                                          |
| REAL_PROVIDER_SMOKE                              | unset                             | Set 1 to enable actual-provider unit smoke                        |
| CONFIRM_MODEL_REINDEX                            | unset                             | Must be yes for deliberate model-change maintenance               |

Provider code also accepts timeout/retry/model settings through its reusable Zod-validated configuration interface. Retry count defaults to two; it is currently a code-level setting rather than an environment override. Retrieval weights, thresholds, candidates and RRF K are request parameters documented in the API contract.
