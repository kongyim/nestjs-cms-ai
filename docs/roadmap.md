# Roadmap and remaining scope

## Current release

The vertical document → queue → vector/full-text retrieval → streamed answer → citation → evaluation workflow is implemented, with CMS authentication and administration, real PostgreSQL/Redis storage, deterministic tests and Docker local setup. See the implementation report for what was actually executed.

## Next work

1. Clarify licenses in the existing CMS packages before claiming an MIT open-source distribution.
2. Exercise OpenAI-compatible and Ollama adapters against actual configured models; collect answer-quality baselines. Existing local HTTP contract tests are not real-provider certification.
3. Add parser process isolation, archive expansion limits, upload proxy limits and per-user/global cost quotas.
4. Add durable background evaluations, file-deletion outbox/garbage collection, broader concurrency/failure-injection tests.
5. Implement incremental CMS resource synchronization using confirmed core resource hooks or an explicit export adapter; the current ingestion path handles uploaded documents.
6. Add reranking, model-specific tokenization and better layout/table extraction; preserve PDF page and Markdown heading provenance.
7. Add complete document revision history and version replacement; current version increments on reindex and only the current index is retained.
8. Expand reusable package build/publish boundaries and API response schemas.

## Deferred interfaces and features

`ai-core` provides provider/content/tool contracts, but there is no executing agent framework, tool calling workflow, human approval queue, MCP server or tenant boundary. No S3 implementation, OCR, advanced policy sharing groups, external tracing stack or model-based evaluation judge is claimed. These should follow verified reliability and the MVP's usage requirements.
