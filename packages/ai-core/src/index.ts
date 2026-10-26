import { createHash } from "node:crypto";
import { z } from "zod";

export type Message = {
  role: "system" | "user" | "assistant";
  content: string;
};
export type Usage = { inputTokens?: number; outputTokens?: number };
export type ChatEvent =
  { type: "delta"; text: string } | { type: "usage"; usage: Usage };
export interface ChatModel {
  stream(messages: Message[], signal?: AbortSignal): AsyncIterable<ChatEvent>;
}
export interface EmbeddingModel {
  readonly dimensions: number;
  readonly fingerprint: string;
  embed(texts: string[], signal?: AbortSignal): Promise<number[][]>;
}
export interface AIProvider extends ChatModel, EmbeddingModel {}
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: unknown;
  requiresApproval: boolean;
}
export interface ContentSource {
  id: string;
  version: string;
  text: string;
  metadata: Record<string, unknown>;
}

export const providerConfig = z
  .object({
    provider: z.enum(["mock", "openai", "ollama"]),
    baseUrl: z.url().default("https://api.openai.com/v1"),
    apiKey: z.string().optional(),
    chatModel: z.string().min(1).default("gpt-4o-mini"),
    embeddingModel: z.string().min(1).default("text-embedding-3-small"),
    dimensions: z.coerce.number().int().min(8).max(2000).default(1536),
    timeoutMs: z.coerce.number().int().min(100).default(60000),
    retries: z.coerce.number().int().min(0).max(5).default(2),
  })
  .superRefine((v, c) => {
    if (v.provider === "openai" && !v.apiKey)
      c.addIssue({
        code: "custom",
        message:
          "OpenAI-compatible provider requires AI_API_KEY (use a local dummy key only if your server requires none)",
      });
  });
export type ProviderConfig = z.infer<typeof providerConfig>;
export function validateVectors(
  vectors: number[][],
  count: number,
  dimensions: number,
): number[][] {
  if (
    vectors.length !== count ||
    vectors.some(
      (v) =>
        v.length !== dimensions ||
        v.some((n) => !Number.isFinite(n)) ||
        v.every((n) => n === 0),
    )
  )
    throw new Error(
      "Embedding response count/dimensions/values do not match configuration",
    );
  return vectors;
}
export class MockProvider implements AIProvider {
  readonly fingerprint: string;
  constructor(readonly dimensions = 64) {
    this.fingerprint = `mock:hash-v1:${dimensions}`;
  }
  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((text) => {
      const v = Array<number>(this.dimensions).fill(0);
      for (const word of text.toLowerCase().match(/[a-z0-9]+/g) ?? ["empty"]) {
        const hash = createHash("sha256").update(word).digest();
        v[hash.readUInt32BE(0) % v.length] += 1;
      }
      const norm = Math.hypot(...v) || 1;
      return v.map((n) => n / norm);
    });
  }
  async *stream(
    messages: Message[],
    signal?: AbortSignal,
  ): AsyncIterable<ChatEvent> {
    const context = messages.find((m) => m.role === "system")?.content ?? "";
    const evidence = context.match(
      /<source id="1">\n([\s\S]*?)\n<\/source>/,
    )?.[1];
    const text = evidence
      ? `Mock extract (not model reasoning): ${evidence.slice(0, 600)} [1]`
      : "The available evidence is insufficient to answer.";
    for (const part of text.match(/.{1,24}/gs) ?? []) {
      signal?.throwIfAborted();
      yield { type: "delta", text: part };
    }
  }
}

// Parse complete SSE/NDJSON records across arbitrary HTTP chunk boundaries.
export async function* records(
  body: ReadableStream<Uint8Array>,
  sse: boolean,
): AsyncIterable<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const item = await reader.read();
      buffer += item.done
        ? decoder.decode()
        : decoder.decode(item.value, { stream: true });
      let end: number;
      while ((end = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, end).trim();
        buffer = buffer.slice(end + 1);
        if (sse ? line.startsWith("data:") : line.length > 0)
          yield sse ? line.slice(5).trim() : line;
      }
      if (item.done) break;
    }
    if (buffer.trim()) {
      const line = buffer.trim();
      if (!sse || line.startsWith("data:"))
        yield sse ? line.slice(5).trim() : line;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
const embeddingResponse = z.object({
  data: z.array(
    z.object({ index: z.number(), embedding: z.array(z.number()) }),
  ),
});
const ollamaEmbedding = z.object({ embeddings: z.array(z.array(z.number())) });
const openaiEvent = z.object({
  choices: z
    .array(
      z.object({
        delta: z.object({ content: z.string().nullable().optional() }),
      }),
    )
    .optional(),
  usage: z
    .object({ prompt_tokens: z.number(), completion_tokens: z.number() })
    .nullable()
    .optional(),
});
const ollamaEvent = z.object({
  message: z.object({ content: z.string() }).optional(),
  prompt_eval_count: z.number().optional(),
  eval_count: z.number().optional(),
  error: z.string().optional(),
});
export class HttpProvider implements AIProvider {
  readonly dimensions: number;
  readonly fingerprint: string;
  constructor(private readonly config: ProviderConfig) {
    this.dimensions = config.dimensions;
    this.fingerprint = `${config.provider}:${config.embeddingModel}:${config.dimensions}`;
  }
  private async request(
    path: string,
    body: unknown,
    signal?: AbortSignal,
  ): Promise<Response> {
    for (let attempt = 0; ; attempt++) {
      signal?.throwIfAborted();
      try {
        const timeout = AbortSignal.timeout(this.config.timeoutMs);
        const response = await fetch(
          `${this.config.baseUrl.replace(/\/$/, "")}${path}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(this.config.apiKey
                ? { Authorization: `Bearer ${this.config.apiKey}` }
                : {}),
            },
            body: JSON.stringify(body),
            signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
          },
        );
        if (response.ok) return response;
        await response.body?.cancel();
        if (
          (response.status === 429 || response.status >= 500) &&
          attempt < this.config.retries
        ) {
          await new Promise((r) => setTimeout(r, 250 * 2 ** attempt));
          continue;
        }
        throw new Error(`AI provider HTTP ${response.status}`);
      } catch (error) {
        if (error instanceof TypeError && attempt < this.config.retries) {
          await new Promise((r) => setTimeout(r, 250 * 2 ** attempt));
          continue;
        }
        throw error;
      }
    }
  }
  async embed(texts: string[], signal?: AbortSignal): Promise<number[][]> {
    const result: number[][] = [];
    for (let i = 0; i < texts.length; i += 16) {
      const batch = texts.slice(i, i + 16);
      const ollama = this.config.provider === "ollama";
      const response = await this.request(
        ollama ? "/api/embed" : "/embeddings",
        { model: this.config.embeddingModel, input: batch },
        signal,
      );
      const data: unknown = await response.json();
      const vectors = ollama
        ? ollamaEmbedding.parse(data).embeddings
        : embeddingResponse
            .parse(data)
            .data.sort((a, b) => a.index - b.index)
            .map((v) => v.embedding);
      result.push(...validateVectors(vectors, batch.length, this.dimensions));
    }
    return result;
  }
  async *stream(
    messages: Message[],
    signal?: AbortSignal,
  ): AsyncIterable<ChatEvent> {
    const ollama = this.config.provider === "ollama";
    const response = await this.request(
      ollama ? "/api/chat" : "/chat/completions",
      {
        model: this.config.chatModel,
        messages,
        stream: true,
        ...(!ollama ? { stream_options: { include_usage: true } } : {}),
      },
      signal,
    );
    if (!response.body) throw new Error("AI provider returned no stream");
    for await (const line of records(response.body, !ollama)) {
      if (line === "[DONE]") break;
      const data: unknown = JSON.parse(line);
      if (ollama) {
        const event = ollamaEvent.parse(data);
        if (event.error) throw new Error("Ollama generation failed");
        if (event.message?.content)
          yield { type: "delta", text: event.message.content };
        if (event.eval_count !== undefined)
          yield {
            type: "usage",
            usage: {
              inputTokens: event.prompt_eval_count,
              outputTokens: event.eval_count,
            },
          };
      } else {
        const event = openaiEvent.parse(data);
        const content = event.choices?.[0]?.delta.content;
        if (content) yield { type: "delta", text: content };
        if (event.usage)
          yield {
            type: "usage",
            usage: {
              inputTokens: event.usage.prompt_tokens,
              outputTokens: event.usage.completion_tokens,
            },
          };
      }
    }
  }
}
export function createProvider(input: unknown): AIProvider {
  const config = providerConfig.parse(input);
  return config.provider === "mock"
    ? new MockProvider(config.dimensions)
    : new HttpProvider(config);
}
