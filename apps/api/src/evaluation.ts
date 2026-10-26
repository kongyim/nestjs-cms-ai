import { Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { HubService, searchInput } from "./hub.service";
import { Actor } from "../../../packages/cms-ai/src";
import {
  groundedPrompt,
  retrievalMetrics,
  selectContext,
} from "../../../packages/ai-rag/src";
import { Usage } from "../../../packages/ai-core/src";
import { config } from "./config";
import dataset from "../../../evals/datasets/ecommerce.json";
import { log } from "./log";
@Injectable()
export class EvaluationService {
  constructor(private readonly hub: HubService) {}
  async list(actor: Actor) {
    return this.hub.db.query(
      `SELECT r.* FROM evaluation_runs r JOIN knowledge_bases k ON k.id=r."knowledgeBaseId" WHERE r."userId"=$1 AND (k."ownerId"=$1 OR k.visibility='shared' OR $2) ORDER BY r."createdAt" DESC LIMIT 50`,
      [actor.id, actor.permissions.includes("hub:admin")],
    );
  }
  async get(actor: Actor, id: string) {
    const [run] = await this.hub.db.query<{ knowledgeBaseId: string }>(
      'SELECT * FROM evaluation_runs WHERE id=$1 AND "userId"=$2',
      [id, actor.id],
    );
    if (!run) throw new NotFoundException();
    await this.hub.kb(actor, run.knowledgeBaseId);
    return run;
  }
  async run(actor: Actor, input: unknown) {
    this.hub.requireAdmin(actor);
    const parsed = z
      .object({
        knowledgeBaseId: z.uuid(),
        topK: z.number().int().min(1).max(20).default(6),
        hybrid: z.boolean().default(true),
      })
      .strict()
      .parse(input);
    await this.hub.kb(actor, parsed.knowledgeBaseId);
    const id = randomUUID();
    await this.hub.db.query(
      'INSERT INTO evaluation_runs(id,"userId","knowledgeBaseId",status,config) VALUES($1,$2,$3,\'running\',$4)',
      [
        id,
        actor.id,
        parsed.knowledgeBaseId,
        JSON.stringify({
          ...parsed,
          dataset: "ecommerce-v1",
          provider: this.hub.ai.fingerprint,
        }),
      ],
    );
    const results = [];
    try {
      for (const item of dataset) {
        const retrieval = await this.hub.search(
          actor,
          searchInput.parse({ ...parsed, query: item.question }),
        );
        const metrics = retrievalMetrics(
          item.expectedSourceIds,
          retrieval.hits.map((h) => h.filename.replace(/\.[^.]+$/, "")),
        );
        const context = selectContext(retrieval.hits, config.CONTEXT_TOKENS);
        const start = performance.now();
        let answer = "",
          usage: Usage = {};
        for await (const event of this.hub.ai.stream([
          { role: "system", content: groundedPrompt(context) },
          { role: "user", content: item.question },
        ])) {
          if (event.type === "delta") answer += event.text;
          else usage = event.usage;
        }
        results.push({
          ...item,
          ...metrics,
          retrievedEvidence: retrieval.hits.map((h) => ({
            documentId: h.documentId,
            filename: h.filename,
            chunkId: h.id,
          })),
          retrievalMs: retrieval.latencyMs,
          generationMs: performance.now() - start,
          answer,
          usage,
          estimatedCost:
            ((usage.inputTokens ?? 0) * config.INPUT_COST_PER_MILLION +
              (usage.outputTokens ?? 0) * config.OUTPUT_COST_PER_MILLION) /
            1e6,
        });
        await this.hub.db.query(
          "UPDATE evaluation_runs SET results=$2 WHERE id=$1",
          [id, JSON.stringify(results)],
        );
      }
      const summary = {
        recallAtK: results.reduce((s, r) => s + r.recall, 0) / results.length,
        mrr: results.reduce((s, r) => s + r.reciprocalRank, 0) / results.length,
        meanRetrievalMs:
          results.reduce((s, r) => s + r.retrievalMs, 0) / results.length,
        count: results.length,
      };
      await this.hub.db.query(
        "UPDATE evaluation_runs SET status='completed',summary=$2,\"completedAt\"=now() WHERE id=$1",
        [id, JSON.stringify(summary)],
      );
      log.info({ event: "evaluation_completed", runId: id, ...summary });
      return this.get(actor, id);
    } catch (error) {
      await this.hub.db.query(
        "UPDATE evaluation_runs SET status='failed',\"completedAt\"=now() WHERE id=$1",
        [id],
      );
      throw error;
    }
  }
}
