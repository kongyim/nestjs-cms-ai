import "reflect-metadata";
import "dotenv/config";
import type { DataSource } from "typeorm";
import { createAuthDataSource } from "@nestjs-cms/auth";
import { cmsAuthOptions } from "./cms.config";

// Inspection/schema-generation entry point uses the exact runtime discovery config.
// Apply reviewed SQL through pnpm db:migrate; keep DB_SYNCHRONIZE=false.
const dataSource: DataSource =
  createAuthDataSource(cmsAuthOptions()).dataSource;
export default dataSource;
