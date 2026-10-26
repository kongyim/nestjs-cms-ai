import "reflect-metadata";
import { Worker, Queue } from "bullmq";
import { randomUUID } from "node:crypto";
import { Database } from "./db";
import { LocalStorage } from "./storage";
import { config, provider, redis } from "./config";
import { chunkSections, extract } from "../../../packages/ai-rag/src";
import { validateVectors } from "../../../packages/ai-core/src";
import { DocumentRecord, extensionOf } from "./hub.service";
import { log } from "./log";
const db = new Database(),
  storage = new LocalStorage(),
  queue = new Queue("ingestion", { connection: redis });
const worker = new Worker<{ jobId: string }>(
  "ingestion",
  async (job) => {
    const jobId = job.data.jobId;
    const start = performance.now();
    const [record] = await db.query<{ documentId: string; status: string }>(
      "SELECT * FROM ingestion_jobs WHERE id=$1",
      [jobId],
    );
    if (!record || record.status === "completed") return;
    const [doc] = await db.query<DocumentRecord>(
      "SELECT * FROM documents WHERE id=$1",
      [record.documentId],
    );
    if (!doc) return;
    try {
      await db.transaction(async (c) => {
        await c.query(
          'UPDATE ingestion_jobs SET status=\'processing\',attempts=attempts+1,"startedAt"=now(),"errorMessage"=NULL WHERE id=$1',
          [jobId],
        );
        await c.query(
          "UPDATE documents SET status='processing',\"updatedAt\"=now() WHERE id=$1",
          [doc.id],
        );
      });
      const sections = await extract(
        await storage.get(doc.storageKey),
        extensionOf(doc),
      );
      const chunks = chunkSections(
        sections,
        config.CHUNK_TOKENS,
        config.CHUNK_OVERLAP,
      );
      if (!chunks.length) throw new Error("Document has no extractable text");
      if (chunks.length > 2000)
        throw new Error("Document exceeds 2000 chunk limit");
      const embeddingStart = performance.now();
      const vectors = validateVectors(
        await provider.embed(chunks.map((c) => c.text)),
        chunks.length,
        provider.dimensions,
      );
      log.info({
        event: "embedding",
        jobId,
        documentId: doc.id,
        provider: provider.fingerprint,
        durationMs: performance.now() - embeddingStart,
        chunks: chunks.length,
      });
      await db.transaction(async (c) => {
        const current = await c.query<DocumentRecord>(
          "SELECT * FROM documents WHERE id=$1 FOR UPDATE",
          [doc.id],
        );
        if (!current.rows.length || current.rows[0].version !== doc.version)
          return;
        await c.query('DELETE FROM document_chunks WHERE "documentId"=$1', [
          doc.id,
        ]);
        for (const [i, chunk] of chunks.entries())
          await c.query(
            'INSERT INTO document_chunks(id,"documentId","chunkIndex",content,"tokenCount",metadata,embedding,"modelFingerprint") VALUES($1,$2,$3,$4,$5,$6,$7::vector,$8)',
            [
              randomUUID(),
              doc.id,
              i,
              chunk.text,
              chunk.tokenCount,
              JSON.stringify({
                filename: doc.filename,
                documentId: doc.id,
                version: doc.version,
                heading: chunk.heading,
                page: chunk.page,
                sourceReference: doc.filename,
              }),
              JSON.stringify(vectors[i]),
              provider.fingerprint,
            ],
          );
        await c.query(
          'UPDATE documents SET status=\'ready\',"errorMessage"=NULL,"updatedAt"=now() WHERE id=$1',
          [doc.id],
        );
        await c.query(
          "UPDATE ingestion_jobs SET status='completed',\"completedAt\"=now() WHERE id=$1",
          [jobId],
        );
      });
      log.info({
        event: "ingestion_completed",
        jobId,
        documentId: doc.id,
        durationMs: performance.now() - start,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Ingestion failed";
      const final = job.attemptsMade + 1 >= Number(job.opts.attempts ?? 1);
      await db.transaction(async (c) => {
        await c.query(
          'UPDATE ingestion_jobs SET status=$2,"errorMessage"=$3,"completedAt"=CASE WHEN $2=\'failed\' THEN now() ELSE NULL END WHERE id=$1',
          [jobId, final ? "failed" : "queued", message],
        );
        await c.query(
          'UPDATE documents SET status=$2,"errorMessage"=$3,"updatedAt"=now() WHERE id=$1',
          [doc.id, final ? "failed" : "queued", message],
        );
      });
      log.error({
        event: "ingestion_failed",
        jobId,
        documentId: doc.id,
        error: message,
        final,
      });
      throw error;
    }
  },
  { connection: redis, concurrency: 2, lockDuration: 120000 },
);
worker.on("error", (error) =>
  log.error({ event: "worker_error", message: error.message }),
);
let dispatching = false;
async function dispatch() {
  if (dispatching) return;
  dispatching = true;
  try {
    await (
      await queue.client
    ).set("hub:worker:heartbeat", String(Date.now()), { EX: 15 });
    const pending = await db.query<{ id: string }>(
      "SELECT id FROM ingestion_jobs WHERE status IN ('queued','processing') ORDER BY \"createdAt\" LIMIT 100",
    );
    for (const record of pending)
      await queue.add(
        "index",
        { jobId: record.id },
        {
          jobId: record.id,
          attempts: 3,
          backoff: { type: "exponential", delay: 1000 },
          removeOnComplete: { age: 86400 },
          removeOnFail: { age: 604800 },
        },
      );
  } catch (error) {
    log.error({
      event: "outbox_dispatch_failed",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  } finally {
    dispatching = false;
  }
}
const timer = setInterval(() => void dispatch(), 2000);
void dispatch();
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    clearInterval(timer);
    void worker
      .close()
      .then(() => queue.close())
      .then(() => db.onModuleDestroy())
      .then(() => process.exit(0));
  });
log.info({ event: "worker_started" });
