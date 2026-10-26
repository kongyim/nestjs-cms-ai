import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { Database } from "../apps/api/src/db";
import { provider } from "../apps/api/src/config";
async function main() {
  if (process.env.CONFIRM_MODEL_REINDEX !== "yes")
    throw new Error(
      "Stop API and worker, back up data, then set CONFIRM_MODEL_REINDEX=yes. This clears existing vectors and queues all documents.",
    );
  const db = new Database();
  try {
    await db.transaction(async (c) => {
      await c.query("SELECT pg_advisory_xact_lock(713901)");
      if (
        (
          await c.query(
            "SELECT id FROM ingestion_jobs WHERE status IN ('queued','processing') LIMIT 1",
          )
        ).rowCount
      )
        throw new Error(
          "Finish/recover active ingestion before changing models",
        );
      await c.query(
        "LOCK TABLE documents,document_chunks IN ACCESS EXCLUSIVE MODE",
      );
      await c.query("DROP INDEX IF EXISTS chunks_embedding_hnsw");
      await c.query("DELETE FROM document_chunks");
      await c.query("UPDATE ai_settings SET fingerprint=$1,dimensions=$2", [
        provider.fingerprint,
        provider.dimensions,
      ]);
      await c.query(
        `CREATE INDEX chunks_embedding_hnsw ON document_chunks USING hnsw ((embedding::vector(${provider.dimensions})) vector_cosine_ops)`,
      );
      const docs = await c.query<{ id: string }>(
        'UPDATE documents SET status=\'queued\',version=version+1,"errorMessage"=NULL,"updatedAt"=now() RETURNING id',
      );
      for (const doc of docs.rows)
        await c.query(
          'INSERT INTO ingestion_jobs(id,"documentId") VALUES($1,$2)',
          [randomUUID(), doc.id],
        );
      console.log(
        `Queued ${docs.rowCount} documents for ${provider.fingerprint}`,
      );
    });
  } finally {
    await db.onModuleDestroy();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
