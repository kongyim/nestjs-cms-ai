# API contract

The API listens at `http://localhost:3001/api`; the frontend proxies `/api` to it. OpenAPI is at `/api/docs`. CMS authentication endpoints are supplied by the installed package.

Authenticate using `POST /auth/login` with `{email,password}` and `x-cms-request: 1`. Retain the HTTP-only `cms_session` cookie. `GET /auth/me` returns the identity. `POST /auth/logout` revokes the session. Every mutation requires `x-cms-request: 1`; browser Origin must equal `ADMIN_ORIGIN`. Never put sessions or prompts in URL parameters.

| Method           | Path                                            | Contract                                                                                            |
| ---------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| GET/POST         | `/knowledge-bases`                              | Authorized list / `{name,description?,visibility?}`                                                 |
| GET/PATCH/DELETE | `/knowledge-bases/:id`                          | Detail / partial name, description, visibility / cascade delete                                     |
| GET/POST         | `/knowledge-bases/:id/documents`                | List / multipart `file`                                                                             |
| GET/DELETE       | `/documents/:id`                                | Metadata / delete source and derived history                                                        |
| GET              | `/documents/:id/download`                       | Authenticated attachment, never executable inline HTML                                              |
| POST             | `/documents/:id/reindex`                        | New persistent job, 409 if active                                                                   |
| GET              | `/ingestion-jobs` and `/ingestion-jobs/:id`     | Operational status and errors                                                                       |
| POST             | `/search`                                       | `{knowledgeBaseId,query,topK?,candidates?,threshold?,hybrid?,rrfK?,semanticWeight?,keywordWeight?}` |
| GET/POST         | `/chat/sessions`                                | Own accessible history / `{knowledgeBaseId,title?}`                                                 |
| GET              | `/chat/sessions/:id`                            | Own session and messages                                                                            |
| POST             | `/chat/sessions/:id/messages`                   | `{question}`; authenticated SSE stream                                                              |
| POST             | `/evaluations/run`                              | Admin only: `{knowledgeBaseId,topK?,hybrid?}`; completes 20 cases                                   |
| GET              | `/evaluations/runs` and `/evaluations/runs/:id` | Own runs; detail rechecks KB access                                                                 |
| GET              | `/dashboard` and `/settings`                    | Authorized overview / non-secret server settings                                                    |
| GET              | `/health` and `/health/ready`                   | Public liveness / database, Redis and model-setting readiness                                       |

Knowledge responses are direct JSON records/arrays; CMS resources retain their native `{data,meta}` list shape. Errors use `{error:{status,message,requestId}}`. Invalid input is 400, missing identity 401, invalid origin/administrator permission 403, inaccessible objects 404, duplicate/active ingestion 409, AI rate limits 429. Unexpected exceptions return a generic 500 without stack traces.

## Streaming

Each record is `data: <JSON>\n\n`. Event types:

- `sources`: database-derived citation labels, document/chunk IDs, metadata and previews.
- `delta`: a partial text string.
- `done`: canonical final text, source list, latency and usage metadata. Unknown numbered citation references are marked unsupported here.
- `error`: safe failure text and request ID. A transport failure never becomes a mock answer.

Cancel the fetch with `AbortController`; the server aborts generation when the response closes. Partial assistant output is not persisted, but the submitted user message may remain. Retry is explicit with a new POST; no automatic replay/reconnection is promised. The UI replaces provisional streamed text with the canonical `done` text. One active generation per session is enforced with a PostgreSQL advisory lock. History is stored for viewing; earlier turns are not included in current prompts.

The main endpoint schemas appear in Swagger. Advanced retrieval parameters and CMS-native APIs are also described here and in the investigated package README; this release does not generate fully exhaustive response schemas.
