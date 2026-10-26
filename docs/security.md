# Security boundaries and retention

CMS auth owns password hashing, session creation/revocation, active-user checks and role permissions. The host guard authenticates all other controllers by default; only explicit health handlers are public. It does not assume the CMS guard protects custom endpoints. `hub:admin` permits KB administration; `users:manage` controls CMS user/role editors. Regular users need neither permission to own private knowledge bases.

Private KBs are readable/writable by their owner and hub administrators. Shared KBs are readable by all authenticated users; mutation remains owner/admin only. Missing KBs or ownership metadata deny access. Chat sessions always require the creator's identity, even for administrators. Retrieval embeds the question only after the KB check, and SQL candidate selection repeats the access predicate before any chunk reaches the model.

Document text is untrusted. The system prompt separates evidence, rejects embedded instructions and requests citations. This does not prove language models are immune to prompt injection. Authorization is deterministic application logic, independent of model behavior; no tools are executed. Provider credentials stay on the server. Configuring an external provider sends authorized questions and selected document text to that provider.

Uploads have extension/MIME checks, PDF/ZIP signatures, UTF-8 checks, byte limits and generated UUID storage keys. Parsing occurs in the worker, not in upload requests. DOCX parsing must find valid document XML; scanned PDFs without text fail explicitly. Files are downloaded as attachments with `nosniff`. No uploaded file is executed or served as inline application content. Parser-level CPU/memory isolation, decompression-ratio limits, malware scanning and per-user storage quotas are future hardening, so avoid exposing uploads to untrusted public users without additional controls.

Only ready documents are searchable. Reindex failure leaves status failed and hides old chunks; it does not expose a partially replaced index. Concurrent source deletion prevents worker publication. Source downloads and job lookups also check KB permissions. Access revocation is evaluated at request boundaries; already delivered bytes cannot be recalled.

## Retention

Deleting a document cascades its chunks and ingestion jobs, removes its local file, and **purges all chat sessions/messages and evaluation runs for its KB**, because they may contain derived source text. Deleting a KB cascades the same database data and removes all its files. The UI explains this conservative policy. Deleting a CMS user cascades owned database knowledge but does not currently schedule local-file cleanup; use KB deletion first. Failed file cleanup after a committed deletion surfaces as an error and may leave an orphan file requiring operator cleanup. Database and filesystem operations cannot share a single transaction.

Redis job payloads contain only job IDs; completed/failed queue records expire by age. Redis persistence improves recovery; wholesale Redis loss together with retained failed IDs and application crashes needs operator inspection. Database outbox rows normally allow redispatch. Database backups and external provider retention are separate operational policies; deleting a live row does not erase backups.

## Deployment

Use HTTPS, a single explicit `ADMIN_ORIGIN`, `NODE_ENV=production`, a randomly generated `ADMIN_API_KEY` of at least 32 characters (required by current core), and strong bootstrap/DB credentials. Keep `DB_SYNCHRONIZE=false`. Cookies are HTTP-only, same-site strict and secure in production; mutation headers plus Origin checks provide CSRF protection. Do not expose PostgreSQL/Redis publicly. Mount file storage consistently in API and worker. Maintain database and storage backups together.

Redis enforces a per-user budget of 30 expensive HTTP calls per minute; CMS additionally rate-limits login. There is not yet a global provider token/cost quota. The Next proxy caps request bodies at 51 MiB before forwarding; the API enforces the configured lower file limit. Add per-user quotas and perimeter limits for public deployments. Pino logs request IDs, timings, job IDs and provider identity, not document text or secrets. Review upstream package advisories and licenses before publication or deployment.
