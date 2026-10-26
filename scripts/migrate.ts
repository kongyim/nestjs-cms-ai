import "reflect-metadata";
import "dotenv/config";
import { readFile, readdir } from "node:fs/promises";
import { Database } from "../apps/api/src/db";
import { provider } from "../apps/api/src/config";
async function main() {
  const db = new Database();
  try {
    await db.transaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(713901)");
      await client.query(
        "CREATE TABLE IF NOT EXISTS hub_migrations(name text PRIMARY KEY, applied_at timestamptz DEFAULT now())",
      );
      for (const name of (await readdir("apps/api/migrations"))
        .filter((n) => n.endsWith(".sql"))
        .sort()) {
        if (
          (
            await client.query("SELECT 1 FROM hub_migrations WHERE name=$1", [
              name,
            ])
          ).rowCount
        )
          continue;
        await client.query(
          await readFile(`apps/api/migrations/${name}`, "utf8"),
        );
        await client.query("INSERT INTO hub_migrations(name) VALUES($1)", [
          name,
        ]);
        console.log(`Applied ${name}`);
      }
      const settings = await client.query<{ fingerprint: string }>(
        "SELECT fingerprint FROM ai_settings",
      );
      if (
        settings.rows.length &&
        settings.rows[0].fingerprint !== provider.fingerprint
      )
        throw new Error(
          "Embedding model changed. Follow the documented model migration procedure before startup.",
        );
      await client.query(
        "INSERT INTO ai_settings(id,fingerprint,dimensions) VALUES(true,$1,$2) ON CONFLICT DO NOTHING",
        [provider.fingerprint, provider.dimensions],
      );
      // Dimensions are validated positive integers, never SQL received from a user or model.
      await client.query(
        `CREATE INDEX IF NOT EXISTS chunks_embedding_hnsw ON document_chunks USING hnsw ((embedding::vector(${provider.dimensions})) vector_cosine_ops)`,
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
