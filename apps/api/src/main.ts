import "reflect-metadata";
import "./config";
import { Module } from "@nestjs/common";
import { NestFactory, APP_GUARD } from "@nestjs/core";
import { CmsAuthModule } from "@nestjs-cms/auth";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { json } from "express";
import { randomUUID } from "node:crypto";
import { AiProviderModule } from "../../../packages/cms-ai/src";
import { Database } from "./db";
import { LocalStorage } from "./storage";
import { HubService } from "./hub.service";
import { HubController } from "./controller";
import { HubGuard, ErrorFilter } from "./security";
import { EvaluationService } from "./evaluation";
import { config, provider, aiConfig } from "./config";
import { log } from "./log";
import { cmsAuthOptions } from "./cms.config";
@Module({
  imports: [
    CmsAuthModule.forRoot(cmsAuthOptions()),
    AiProviderModule.forRoot(aiConfig),
  ],
  controllers: [HubController],
  providers: [
    Database,
    LocalStorage,
    HubService,
    EvaluationService,
    { provide: APP_GUARD, useClass: HubGuard },
  ],
})
export class AppModule {}
export async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use(json({ limit: "32kb" }));
  app.use(
    (
      req: import("express").Request & { requestId: string },
      res: import("express").Response,
      next: () => void,
    ) => {
      req.requestId = randomUUID();
      res.setHeader("X-Request-ID", req.requestId);
      res.setHeader("X-Content-Type-Options", "nosniff");
      const start = performance.now();
      res.on("finish", () =>
        log.info({
          event: "request",
          requestId: req.requestId,
          method: req.method,
          status: res.statusCode,
          durationMs: performance.now() - start,
        }),
      );
      next();
    },
  );
  app.useGlobalFilters(new ErrorFilter());
  app.enableCors({ origin: config.ADMIN_ORIGIN, credentials: true });
  app.enableShutdownHooks();
  const db = app.get(Database);
  const [setting] = await db.query<{ fingerprint: string }>(
    "SELECT fingerprint FROM ai_settings",
  );
  if (setting?.fingerprint !== provider.fingerprint)
    throw new Error(
      "Run migrations; embedding configuration does not match database",
    );
  const spec = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle("NestJS AI Knowledge Hub")
      .setVersion("0.1.0")
      .addCookieAuth("cms_session")
      .build(),
  );
  SwaggerModule.setup("api/docs", app, spec);
  await app.listen(config.PORT, "0.0.0.0");
  log.info({ event: "api_started", port: config.PORT });
  return app;
}
if (require.main === module)
  bootstrap().catch((error) => {
    log.error({
      event: "startup_failed",
      message: error instanceof Error ? error.message : "Unknown error",
    });
    process.exit(1);
  });
