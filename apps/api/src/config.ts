import "dotenv/config";
import { z } from "zod";
import { createProvider } from "../../..//packages/ai-core/src";
export const config = z
  .object({
    PORT: z.coerce.number().default(3001),
    ADMIN_ORIGIN: z.url().default("http://localhost:3000"),
    DB_HOST: z.string().default("127.0.0.1"),
    DB_PORT: z.coerce.number().default(54329),
    DB_USERNAME: z.string().default("hub"),
    DB_PASSWORD: z.string().min(1),
    DB_DATABASE: z.string().default("hub"),
    REDIS_HOST: z.string().default("127.0.0.1"),
    REDIS_PORT: z.coerce.number().default(63799),
    STORAGE_PATH: z.string().default(".data/uploads"),
    UPLOAD_MAX_BYTES: z.coerce
      .number()
      .int()
      .positive()
      .max(50 * 1024 * 1024)
      .default(10 * 1024 * 1024),
    CHUNK_TOKENS: z.coerce.number().int().min(16).max(2000).default(500),
    CHUNK_OVERLAP: z.coerce.number().int().nonnegative().default(75),
    CONTEXT_TOKENS: z.coerce.number().int().positive().max(16000).default(4000),
    INPUT_COST_PER_MILLION: z.coerce.number().nonnegative().default(0),
    OUTPUT_COST_PER_MILLION: z.coerce.number().nonnegative().default(0),
  })
  .parse(process.env);
if (config.CHUNK_OVERLAP >= config.CHUNK_TOKENS)
  throw new Error("CHUNK_OVERLAP must be below CHUNK_TOKENS");
export const aiConfig = {
  provider: process.env.AI_PROVIDER,
  baseUrl: process.env.AI_BASE_URL,
  apiKey: process.env.AI_API_KEY || undefined,
  chatModel: process.env.CHAT_MODEL,
  embeddingModel: process.env.EMBEDDING_MODEL,
  dimensions: process.env.EMBEDDING_DIMENSIONS,
  timeoutMs: process.env.AI_TIMEOUT_MS,
};
export const provider = createProvider(aiConfig);
export const redis = { host: config.REDIS_HOST, port: config.REDIS_PORT };
