import { Queue } from "bullmq";
import { redis } from "../apps/api/src/config";
async function main() {
  const queue = new Queue("ingestion", { connection: redis });
  try {
    const beat = await (await queue.client).get("hub:worker:heartbeat");
    if (!beat || Date.now() - Number(beat) > 15000)
      throw new Error("Worker heartbeat is stale");
  } finally {
    await queue.close();
  }
}
main().catch(() => {
  process.exitCode = 1;
});
