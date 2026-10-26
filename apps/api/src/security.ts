import {
  ArgumentsHost,
  CanActivate,
  Catch,
  ExceptionFilter,
  ExecutionContext,
  ForbiddenException,
  HttpException,
  Injectable,
  SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthService, Identity } from "@nestjs-cms/auth";
import { Request, Response } from "express";
import { Queue } from "bullmq";
import { ZodError } from "zod";
import { config, redis } from "./config";
import { log } from "./log";
export type AuthRequest = Request & { identity: Identity; requestId: string };
export const Public = () => SetMetadata("hub:public", true);
@Injectable()
export class HubGuard implements CanActivate {
  private readonly queue = new Queue("rate-limits", { connection: redis });
  constructor(
    private readonly auth: AuthService,
    private readonly reflector: Reflector,
  ) {}
  async onModuleDestroy() {
    await this.queue.close();
  }
  async canActivate(context: ExecutionContext) {
    if (
      this.reflector.get("hub:public", context.getHandler()) ||
      this.reflector.get("nestjs-cms:auth-controller", context.getClass()) ||
      this.reflector.get("nestjs-cms:resource-controller", context.getClass())
    )
      return true;
    const req = context.switchToHttp().getRequest<AuthRequest>();
    const res = context.switchToHttp().getResponse<Response>();
    res.setHeader("Cache-Control", "no-store");
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      (req.headers["x-cms-request"] !== "1" ||
        (req.headers.origin && req.headers.origin !== config.ADMIN_ORIGIN))
    )
      throw new ForbiddenException("Invalid request origin");
    const token = req.headers.cookie
      ?.split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("cms_session="))
      ?.slice(12);
    req.identity = await this.auth.authenticate(token);
    if (req.method === "POST" && /search|messages|evaluations/.test(req.path)) {
      const client = await this.queue.client;
      const key = `hub:rate:${req.identity.id}:${Math.floor(Date.now() / 60000)}`;
      client.defineCommand("hubRate", {
        numberOfKeys: 1,
        lua: "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],120) end; return n",
      });
      const count: unknown = await client.runCommand("hubRate", [key]);
      if (typeof count === "number" && count > 30)
        throw new HttpException(
          "AI request limit reached; retry next minute",
          429,
        );
    }
    return true;
  }
}
@Catch()
export class ErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const req = host.switchToHttp().getRequest<AuthRequest>();
    const status =
      error instanceof ZodError
        ? 400
        : error instanceof HttpException
          ? error.getStatus()
          : 500;
    log.error({
      event: "request_error",
      requestId: req.requestId,
      status,
      errorType: error instanceof Error ? error.name : "Unknown",
    });
    if (!res.headersSent)
      res.status(status).json({
        error: {
          status,
          message:
            status === 500
              ? "Internal server error"
              : error instanceof ZodError
                ? "Invalid request input"
                : error instanceof Error
                  ? error.message
                  : "Request failed",
          requestId: req.requestId,
        },
      });
  }
}
