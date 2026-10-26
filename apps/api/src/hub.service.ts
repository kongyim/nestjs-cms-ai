import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Inject,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID, createHash } from "node:crypto";
import { extname } from "node:path";
import { z } from "zod";
import { Database } from "./db";
import { LocalStorage } from "./storage";
import { config } from "./config";
import {
  Actor,
  AI_PROVIDER,
  mayAccess,
  KnowledgeAccess,
} from "../../../packages/cms-ai/src";
import {
  citations,
  fuse,
  groundedPrompt,
  Hit,
  selectContext,
  validateUpload,
} from "../../../packages/ai-rag/src";
import {
  AIProvider,
  Message,
  Usage,
  validateVectors,
} from "../../../packages/ai-core/src";
import { log } from "./log";
export type KB = KnowledgeAccess & {
  id: string;
  name: string;
  description: string;
};
export type DocumentRecord = {
  id: string;
  knowledgeBaseId: string;
  filename: string;
  mimeType: string;
  size: number;
  storageKey: string;
  contentHash: string;
  status: string;
  version: number;
  errorMessage: string | null;
};
export type Session = {
  id: string;
  knowledgeBaseId: string;
  userId: string;
  title: string;
};
export const kbInput = z
  .object({
    name: z.string().trim().min(1).max(160),
    description: z.string().max(4000).default(""),
    visibility: z.enum(["private", "shared"]).default("private"),
  })
  .strict();
export const searchInput = z
  .object({
    knowledgeBaseId: z.uuid(),
    query: z.string().trim().min(1).max(4000),
    topK: z.number().int().min(1).max(20).default(6),
    candidates: z.number().int().min(1).max(100).default(30),
    threshold: z.number().min(-1).max(1).default(0),
    hybrid: z.boolean().default(true),
    rrfK: z.number().int().min(1).max(200).default(60),
    semanticWeight: z.number().min(0).max(5).default(1),
    keywordWeight: z.number().min(0).max(5).default(1),
  })
  .strict();
export type SearchInput = z.infer<typeof searchInput>;
@Injectable()
export class HubService {
  constructor(
    readonly db: Database,
    readonly storage: LocalStorage,
    @Inject(AI_PROVIDER) readonly ai: AIProvider,
  ) {}
  async kb(actor: Actor, id: string, write = false): Promise<KB> {
    const [kb] = await this.db.query<KB>(
      "SELECT * FROM knowledge_bases WHERE id=$1",
      [id],
    );
    if (!mayAccess(actor, kb, write))
      throw new NotFoundException("Knowledge base not found");
    return kb;
  }
  async list(actor: Actor) {
    return this.db.query<KB>(
      'SELECT * FROM knowledge_bases WHERE "ownerId"=$1 OR visibility=\'shared\' OR $2 ORDER BY "createdAt" DESC',
      [actor.id, actor.permissions.includes("hub:admin")],
    );
  }
  async create(actor: Actor, input: unknown) {
    const data = kbInput.parse(input);
    const [kb] = await this.db.query<KB>(
      'INSERT INTO knowledge_bases(id,name,description,visibility,"ownerId") VALUES($1,$2,$3,$4,$5) RETURNING *',
      [randomUUID(), data.name, data.description, data.visibility, actor.id],
    );
    return kb;
  }
  async update(actor: Actor, id: string, input: unknown) {
    await this.kb(actor, id, true);
    const data = kbInput.partial().parse(input);
    return (
      await this.db.query<KB>(
        'UPDATE knowledge_bases SET name=COALESCE($2,name),description=COALESCE($3,description),visibility=COALESCE($4,visibility),"updatedAt"=now() WHERE id=$1 RETURNING *',
        [id, data.name, data.description, data.visibility],
      )
    )[0];
  }
  async removeKB(actor: Actor, id: string) {
    await this.kb(actor, id, true);
    const docs = await this.db.transaction(async (c) => {
      await c.query("SELECT id FROM knowledge_bases WHERE id=$1 FOR UPDATE", [
        id,
      ]);
      const docs = await c.query<DocumentRecord>(
        'SELECT * FROM documents WHERE "knowledgeBaseId"=$1',
        [id],
      );
      await c.query("DELETE FROM knowledge_bases WHERE id=$1", [id]);
      return docs.rows;
    });
    for (const doc of docs) await this.storage.remove(doc.storageKey);
    return { deleted: true };
  }
  async documents(actor: Actor, id: string) {
    await this.kb(actor, id);
    return this.db.query<DocumentRecord>(
      'SELECT * FROM documents WHERE "knowledgeBaseId"=$1 ORDER BY "createdAt" DESC',
      [id],
    );
  }
  async document(
    actor: Actor,
    id: string,
    write = false,
  ): Promise<DocumentRecord> {
    const [doc] = await this.db.query<DocumentRecord>(
      "SELECT * FROM documents WHERE id=$1",
      [id],
    );
    if (!doc) throw new NotFoundException();
    await this.kb(actor, doc.knowledgeBaseId, write);
    return doc;
  }
  async upload(actor: Actor, kbId: string, file: Express.Multer.File) {
    await this.kb(actor, kbId, true);
    if (!file) throw new BadRequestException("File is required");
    let filename: string;
    try {
      ({ filename } = validateUpload(
        file.originalname,
        file.mimetype,
        file.buffer,
        config.UPLOAD_MAX_BYTES,
      ));
    } catch {
      throw new BadRequestException(
        "Invalid file: expected UTF-8 TXT/Markdown, PDF or DOCX within upload limit",
      );
    }
    const hash = createHash("sha256").update(file.buffer).digest("hex");
    const id = randomUUID(),
      jobId = randomUUID();
    await this.storage.put(id, file.buffer);
    try {
      return await this.db.transaction(async (c) => {
        await c.query("SELECT id FROM knowledge_bases WHERE id=$1 FOR UPDATE", [
          kbId,
        ]);
        const inserted = await c.query<DocumentRecord>(
          'INSERT INTO documents(id,"knowledgeBaseId",filename,"mimeType",size,"storageKey","contentHash",status) VALUES($1,$2,$3,$4,$5,$7,$6,\'queued\') ON CONFLICT("knowledgeBaseId","contentHash") DO NOTHING RETURNING *',
          [id, kbId, filename, file.mimetype, file.size, hash, id],
        );
        if (!inserted.rows.length)
          throw new ConflictException(
            "This content already exists in this knowledge base",
          );
        await c.query(
          'INSERT INTO ingestion_jobs(id,"documentId") VALUES($1,$2)',
          [jobId, id],
        );
        return { ...inserted.rows[0], jobId };
      });
    } catch (e) {
      await this.storage.remove(id);
      throw e;
    }
  }
  async reindex(actor: Actor, id: string) {
    await this.document(actor, id, true);
    return this.db.transaction(async (c) => {
      await c.query("SELECT id FROM documents WHERE id=$1 FOR UPDATE", [id]);
      if (
        (
          await c.query(
            "SELECT id FROM ingestion_jobs WHERE \"documentId\"=$1 AND status IN ('queued','processing')",
            [id],
          )
        ).rowCount
      )
        throw new ConflictException("Ingestion is already active");
      const jobId = randomUUID();
      await c.query(
        'UPDATE documents SET status=\'queued\',version=version+1,"errorMessage"=NULL,"updatedAt"=now() WHERE id=$1',
        [id],
      );
      await c.query(
        'INSERT INTO ingestion_jobs(id,"documentId") VALUES($1,$2)',
        [jobId, id],
      );
      return { jobId };
    });
  }
  async removeDocument(actor: Actor, id: string) {
    const doc = await this.document(actor, id, true);
    await this.db.transaction(async (c) => {
      await c.query("SELECT id FROM documents WHERE id=$1 FOR UPDATE", [id]);
      await c.query("DELETE FROM documents WHERE id=$1", [id]); // Purge derived answers/evaluations conservatively for this KB.
      await c.query('DELETE FROM chat_sessions WHERE "knowledgeBaseId"=$1', [
        doc.knowledgeBaseId,
      ]);
      await c.query('DELETE FROM evaluation_runs WHERE "knowledgeBaseId"=$1', [
        doc.knowledgeBaseId,
      ]);
    });
    await this.storage.remove(doc.storageKey);
    return { deleted: true };
  }
  async jobs(actor: Actor) {
    return this.db.query(
      'SELECT j.*,d.filename FROM ingestion_jobs j JOIN documents d ON d.id=j."documentId" JOIN knowledge_bases k ON k.id=d."knowledgeBaseId" WHERE k."ownerId"=$1 OR $2 ORDER BY j."createdAt" DESC LIMIT 200',
      [actor.id, actor.permissions.includes("hub:admin")],
    );
  }
  async job(actor: Actor, id: string) {
    const [job] = await this.db.query<{ documentId: string }>(
      "SELECT * FROM ingestion_jobs WHERE id=$1",
      [id],
    );
    if (!job) throw new NotFoundException();
    await this.document(actor, job.documentId);
    return job;
  }
  async search(actor: Actor, input: unknown) {
    const q = searchInput.parse(input);
    await this.kb(actor, q.knowledgeBaseId);
    const start = performance.now();
    const [embedding] = validateVectors(
      await this.ai.embed([q.query]),
      1,
      this.ai.dimensions,
    );
    const params = [
      q.knowledgeBaseId,
      JSON.stringify(embedding),
      this.ai.fingerprint,
      q.threshold,
      q.candidates,
      actor.id,
      actor.permissions.includes("hub:admin"),
    ];
    // ACL is applied in SQL as well as at the service boundary. All values are bound.
    const semantic = await this.db.query<Hit>(
      `SELECT c.id,c."documentId",d.filename,c.content,c."chunkIndex",c.metadata,1-(c.embedding::vector(${this.ai.dimensions}) <=> $2::vector) AS "semanticScore" FROM document_chunks c JOIN documents d ON d.id=c."documentId" JOIN knowledge_bases k ON k.id=d."knowledgeBaseId" WHERE k.id=$1 AND (k."ownerId"=$6 OR k.visibility='shared' OR $7) AND d.status='ready' AND c."modelFingerprint"=$3 AND 1-(c.embedding::vector(${this.ai.dimensions}) <=> $2::vector)>=$4 ORDER BY c.embedding::vector(${this.ai.dimensions}) <=> $2::vector LIMIT $5`,
      params,
    );
    const keyword = q.hybrid
      ? await this.db.query<Hit>(
          `SELECT c.id,c."documentId",d.filename,c.content,c."chunkIndex",c.metadata,ts_rank_cd(c.search,websearch_to_tsquery('english',$2)) AS "keywordScore" FROM document_chunks c JOIN documents d ON d.id=c."documentId" JOIN knowledge_bases k ON k.id=d."knowledgeBaseId" WHERE k.id=$1 AND (k."ownerId"=$5 OR k.visibility='shared' OR $6) AND d.status='ready' AND c."modelFingerprint"=$3 AND c.search @@ websearch_to_tsquery('english',$2) ORDER BY "keywordScore" DESC,c.id LIMIT $4`,
          [
            q.knowledgeBaseId,
            q.query,
            this.ai.fingerprint,
            q.candidates,
            actor.id,
            actor.permissions.includes("hub:admin"),
          ],
        )
      : [];
    const hits = (
      q.hybrid
        ? fuse(semantic, keyword, q.rrfK, q.semanticWeight, q.keywordWeight)
        : semantic
    ).slice(0, q.topK);
    const latencyMs = performance.now() - start;
    log.info({
      event: "retrieval",
      userId: actor.id,
      latencyMs,
      count: hits.length,
    });
    return { hits, latencyMs, config: q };
  }
  async createSession(actor: Actor, input: unknown) {
    const data = z
      .object({
        knowledgeBaseId: z.uuid(),
        title: z.string().min(1).max(160).default("New conversation"),
      })
      .strict()
      .parse(input);
    await this.kb(actor, data.knowledgeBaseId);
    return (
      await this.db.query<Session>(
        'INSERT INTO chat_sessions(id,"knowledgeBaseId","userId",title) VALUES($1,$2,$3,$4) RETURNING *',
        [randomUUID(), data.knowledgeBaseId, actor.id, data.title],
      )
    )[0];
  }
  async sessions(actor: Actor) {
    return this.db.query<Session>(
      'SELECT s.* FROM chat_sessions s JOIN knowledge_bases k ON k.id=s."knowledgeBaseId" WHERE s."userId"=$1 AND (k."ownerId"=$1 OR k.visibility=\'shared\' OR $2) ORDER BY s."updatedAt" DESC',
      [actor.id, actor.permissions.includes("hub:admin")],
    );
  }
  async session(actor: Actor, id: string) {
    const [session] = await this.db.query<Session>(
      'SELECT * FROM chat_sessions WHERE id=$1 AND "userId"=$2',
      [id, actor.id],
    );
    if (!session) throw new NotFoundException();
    await this.kb(actor, session.knowledgeBaseId);
    return {
      ...session,
      messages: await this.db.query<{
        role: "user" | "assistant";
        content: string;
        citations: unknown[];
      }>(
        'SELECT * FROM chat_messages WHERE "sessionId"=$1 ORDER BY "createdAt",id',
        [id],
      ),
    };
  }
  async *answer(
    actor: Actor,
    id: string,
    input: unknown,
    signal: AbortSignal,
  ): AsyncIterable<Record<string, unknown>> {
    const { question } = z
      .object({ question: z.string().trim().min(1).max(4000) })
      .strict()
      .parse(input);
    const session = await this.session(actor, id);
    const lock = await this.db.pool.connect();
    let locked = false;
    try {
      const result = await lock.query<{ locked: boolean }>(
        "SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS locked",
        [id],
      );
      locked = result.rows[0].locked;
      if (!locked)
        throw new ConflictException(
          "A response is already running for this session",
        );
      const start = performance.now();
      const retrieval = await this.search(actor, {
        knowledgeBaseId: session.knowledgeBaseId,
        query: question,
      });
      const context = selectContext(retrieval.hits, config.CONTEXT_TOKENS);
      const sources = citations(context);
      await this.db.query(
        "INSERT INTO chat_messages(id,\"sessionId\",role,content) VALUES($1,$2,'user',$3)",
        [randomUUID(), id, question],
      );
      yield { type: "sources", sources };
      let content = "",
        usage: Usage = {};
      const generationStart = performance.now();
      // Historical answers can contain deleted/revoked evidence: only current authorized evidence enters the prompt.
      const messages: Message[] = [
        { role: "system", content: groundedPrompt(context) },
        { role: "user", content: question },
      ];
      if (!context.length) {
        content = "The available evidence is insufficient to answer.";
        yield { type: "delta", text: content };
      } else
        for await (const event of this.ai.stream(messages, signal)) {
          signal.throwIfAborted();
          if (event.type === "delta") {
            content += event.text;
            if (content.length > 100000)
              throw new Error("Generation exceeded output limit");
            yield event;
          } else usage = event.usage;
        }
      signal.throwIfAborted();
      await this.kb(actor, session.knowledgeBaseId);
      const metadata = {
        provider: this.ai.fingerprint,
        usage,
        retrievalMs: retrieval.latencyMs,
        generationMs: performance.now() - generationStart,
        totalMs: performance.now() - start,
        estimatedCost:
          ((usage.inputTokens ?? 0) * config.INPUT_COST_PER_MILLION +
            (usage.outputTokens ?? 0) * config.OUTPUT_COST_PER_MILLION) /
          1e6,
      };
      // Strip unrecognized numbered references in the persisted final answer. Sources are always DB-derived.
      content = content.replace(/\[(\d+)\]/g, (marker, n: string) =>
        Number(n) >= 1 && Number(n) <= sources.length
          ? marker
          : "[unsupported citation]",
      );
      await this.db.transaction(async (c) => {
        await c.query(
          "INSERT INTO chat_messages(id,\"sessionId\",role,content,citations,metadata) VALUES($1,$2,'assistant',$3,$4,$5)",
          [
            randomUUID(),
            id,
            content,
            JSON.stringify(sources),
            JSON.stringify(metadata),
          ],
        );
        await c.query(
          'UPDATE chat_sessions SET "updatedAt"=now() WHERE id=$1',
          [id],
        );
      });
      log.info({ event: "generation", userId: actor.id, ...metadata });
      yield { type: "done", content, sources, metadata };
    } finally {
      if (locked)
        await lock.query("SELECT pg_advisory_unlock(hashtextextended($1,0))", [
          id,
        ]);
      lock.release();
    }
  }
  async dashboard(actor: Actor) {
    const bases = await this.list(actor);
    const ids = bases.map((k) => k.id);
    return {
      knowledgeBases: bases.length,
      documents: await this.db.query(
        'SELECT status,count(*)::int AS count FROM documents WHERE "knowledgeBaseId"=ANY($1::uuid[]) GROUP BY status',
        [ids],
      ),
      chats: (await this.sessions(actor)).length,
      jobs: await this.jobs(actor),
      usage: await this.db.query(
        'SELECT m.metadata FROM chat_messages m JOIN chat_sessions s ON s.id=m."sessionId" WHERE s."userId"=$1 AND m.role=\'assistant\' ORDER BY m."createdAt" DESC LIMIT 100',
        [actor.id],
      ),
    };
  }
  settings() {
    return {
      provider: process.env.AI_PROVIDER,
      embeddingFingerprint: this.ai.fingerprint,
      dimensions: this.ai.dimensions,
      chatModel: process.env.CHAT_MODEL,
      uploadMaxBytes: config.UPLOAD_MAX_BYTES,
      chunkTokens: config.CHUNK_TOKENS,
      chunkOverlap: config.CHUNK_OVERLAP,
      contextTokens: config.CONTEXT_TOKENS,
    };
  }
  async download(actor: Actor, id: string) {
    const doc = await this.document(actor, id);
    return { doc, buffer: await this.storage.get(doc.storageKey) };
  }
  requireAdmin(actor: Actor) {
    if (!actor.permissions.includes("hub:admin"))
      throw new ForbiddenException();
  }
}
export const extensionOf = (doc: DocumentRecord) =>
  extname(doc.filename).toLowerCase();
