# Evaluation methodology

`evals/datasets/ecommerce.json` contains 20 questions with expected source filename stems and expected answer text. Ten fictional Markdown sources live in `examples/ecommerce-knowledge-base`. Seed them, wait for ready status, then run `pnpm eval` or use the Evaluations section as a hub administrator.

For each question, the runner performs actual retrieval, records retrieved document/chunk IDs, generates an answer with the configured provider, and persists incremental results in PostgreSQL. Expected answer text is displayed for human review; it is **not** automatically scored as correctness or faithfulness.

- Recall@K: distinct expected sources appearing among the top K chunks, divided by distinct expected sources.
- Reciprocal rank: 1 divided by the first matching chunk's one-based rank, or zero.
- MRR: mean reciprocal rank over all cases.
- Retrieval latency includes query embedding and both database searches/fusion.
- Generation latency covers streaming completion.
- Token usage is recorded only if the provider reports it; mock usage is absent.
- Cost is an estimate from configured per-million token prices, not a billing record. Zero configured prices yield zero cost estimates.

`EVAL_KB_ID`, `EVAL_TOP_K` and `EVAL_HYBRID=false` select CLI alternatives. UI and API allow Top K and hybrid/semantic comparisons. Each run records its configuration and provider fingerprint. Other retrieval parameters are configurable on `/search`; the current evaluation API does not sweep all weights/thresholds automatically.

Runs execute within the HTTP request. A failed call marks the run failed; a hard API crash may leave a running row requiring inspection. Completed cases remain in the database. Durable evaluation queues, answer correctness scoring and LLM judges are future work.

Observed development baseline on 26 October 2026: explicit 64-dimensional hash mock, hybrid Top K 6, 20 cases, Recall@6 **1.000**, MRR **0.870833**. This demonstrates executable metrics on the sample corpus; it does not establish semantic generalization or genuine LLM quality. See the implementation report for test environment details.
