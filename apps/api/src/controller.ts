import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { Response } from "express";
import { HubService } from "./hub.service";
import { AuthRequest, Public } from "./security";
import { EvaluationService } from "./evaluation";
import { config, provider, redis } from "./config";
import { Queue } from "bullmq";
import { log } from "./log";
@ApiTags("Knowledge Hub")
@ApiCookieAuth("cms_session")
@Controller("api")
export class HubController {
  constructor(
    private readonly hub: HubService,
    private readonly evaluations: EvaluationService,
  ) {}
  @Get("knowledge-bases") list(@Req() r: AuthRequest) {
    return this.hub.list(r.identity);
  }
  @Post("knowledge-bases")
  @ApiBody({
    schema: {
      type: "object",
      required: ["name"],
      properties: {
        name: { type: "string" },
        description: { type: "string" },
        visibility: { enum: ["private", "shared"] },
      },
    },
  })
  create(@Req() r: AuthRequest, @Body() body: unknown) {
    return this.hub.create(r.identity, body);
  }
  @Get("knowledge-bases/:id") kb(
    @Req() r: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.hub.kb(r.identity, id);
  }
  @Patch("knowledge-bases/:id") update(
    @Req() r: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    return this.hub.update(r.identity, id, body);
  }
  @Delete("knowledge-bases/:id") removeKB(
    @Req() r: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.hub.removeKB(r.identity, id);
  }
  @Get("knowledge-bases/:id/documents") documents(
    @Req() r: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.hub.documents(r.identity, id);
  }
  @Post("knowledge-bases/:id/documents")
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: { file: { type: "string", format: "binary" } },
    },
  })
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: config.UPLOAD_MAX_BYTES, files: 1 },
    }),
  )
  upload(
    @Req() r: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.hub.upload(r.identity, id, file);
  }
  @Get("documents/:id") document(
    @Req() r: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.hub.document(r.identity, id);
  }
  @Get("documents/:id/download") async download(
    @Req() r: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const { doc, buffer } = await this.hub.download(r.identity, id);
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${doc.filename.replace(/["\r\n]/g, "_")}"`,
    );
    res.send(buffer);
  }
  @Delete("documents/:id") removeDocument(
    @Req() r: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.hub.removeDocument(r.identity, id);
  }
  @Post("documents/:id/reindex") reindex(
    @Req() r: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.hub.reindex(r.identity, id);
  }
  @Get("ingestion-jobs") jobs(@Req() r: AuthRequest) {
    return this.hub.jobs(r.identity);
  }
  @Get("ingestion-jobs/:id") job(
    @Req() r: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.hub.job(r.identity, id);
  }
  @Post("search")
  @ApiBody({
    schema: {
      type: "object",
      required: ["knowledgeBaseId", "query"],
      properties: {
        knowledgeBaseId: { type: "string", format: "uuid" },
        query: { type: "string" },
        topK: { type: "integer", default: 6 },
        hybrid: { type: "boolean", default: true },
      },
    },
  })
  search(@Req() r: AuthRequest, @Body() body: unknown) {
    return this.hub.search(r.identity, body);
  }
  @Post("chat/sessions") createSession(
    @Req() r: AuthRequest,
    @Body() body: unknown,
  ) {
    return this.hub.createSession(r.identity, body);
  }
  @Get("chat/sessions") sessions(@Req() r: AuthRequest) {
    return this.hub.sessions(r.identity);
  }
  @Get("chat/sessions/:id") session(
    @Req() r: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.hub.session(r.identity, id);
  }
  @Post("chat/sessions/:id/messages")
  @ApiOperation({
    summary:
      "Stream SSE sources, delta, done or error events; retry explicitly with a new POST",
  })
  @ApiBody({
    schema: {
      type: "object",
      required: ["question"],
      properties: { question: { type: "string", maxLength: 4000 } },
    },
  })
  async answer(
    @Req() r: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @Res() res: Response,
  ) {
    // Perform authorization before opening the stream.
    await this.hub.session(r.identity, id);
    const abort = new AbortController();
    res.on("close", () => abort.abort());
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();
    try {
      for await (const event of this.hub.answer(
        r.identity,
        id,
        body,
        abort.signal,
      )) {
        if (!res.destroyed) res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    } catch (error) {
      log.error({
        event: "stream_failed",
        requestId: r.requestId,
        errorType: error instanceof Error ? error.name : "Unknown",
      });
      if (!res.destroyed)
        res.write(
          `data: ${JSON.stringify({ type: "error", message: "Generation failed or was cancelled. Retry explicitly.", requestId: r.requestId })}\n\n`,
        );
    } finally {
      res.end();
    }
  }
  @Post("evaluations/run") run(@Req() r: AuthRequest, @Body() body: unknown) {
    return this.evaluations.run(r.identity, body);
  }
  @Get("evaluations/runs") runs(@Req() r: AuthRequest) {
    return this.evaluations.list(r.identity);
  }
  @Get("evaluations/runs/:id") runDetail(
    @Req() r: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.evaluations.get(r.identity, id);
  }
  @Get("dashboard") dashboard(@Req() r: AuthRequest) {
    return this.hub.dashboard(r.identity);
  }
  @Get("settings") settings() {
    return this.hub.settings();
  }
  @Public() @Get("health") health() {
    return { status: "ok" };
  }
  @Public() @Get("health/ready") async ready() {
    await this.hub.db.query("SELECT 1");
    const [setting] = await this.hub.db.query<{ fingerprint: string }>(
      "SELECT fingerprint FROM ai_settings",
    );
    if (setting?.fingerprint !== provider.fingerprint)
      throw new Error("Embedding model mismatch; migration required");
    const queue = new Queue("ingestion", { connection: redis });
    try {
      await (await queue.client).info();
    } finally {
      await queue.close();
    }
    return { status: "ready" };
  }
}
