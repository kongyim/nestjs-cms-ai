import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import {
  createProvider,
  MockProvider,
  records,
  validateVectors,
} from "../packages/ai-core/src";
import {
  chunkSections,
  normalize,
  validateUpload,
  extract,
  fuse,
  citations,
  groundedPrompt,
  retrievalMetrics,
  selectContext,
  Hit,
} from "../packages/ai-rag/src";
import { mayAccess } from "../packages/cms-ai/src";
test("normalization and chunking preserve bounded text with overlap", () => {
  assert.equal(normalize(" a\r\n\r\n\r\nb\t c\0 "), "a\n\nb c");
  const text = Array.from(
    { length: 300 },
    (_, i) => `Sentence ${i} describes a product.`,
  ).join(" ");
  const chunks = chunkSections(
    [{ text, heading: "Products", page: 2 }],
    80,
    10,
  );
  assert.ok(chunks.length > 10);
  assert.ok(
    chunks.every(
      (c) => c.tokenCount <= 80 && c.heading === "Products" && c.page === 2,
    ),
  );
  assert.ok(chunks[0].text.slice(-40).includes(chunks[1].text.slice(0, 20)));
  assert.throws(() => chunkSections([{ text }], 20, 20));
});
test("upload validation rejects spoofed signatures, binary text and oversized input", () => {
  assert.throws(() =>
    validateUpload("x.pdf", "application/pdf", Buffer.from("not pdf"), 100),
  );
  assert.throws(() =>
    validateUpload(
      "x.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      Buffer.from("not zip"),
      100,
    ),
  );
  assert.throws(() =>
    validateUpload("x.txt", "text/plain", Buffer.from([0, 1]), 100),
  );
  assert.throws(() =>
    validateUpload("x.txt", "text/plain", Buffer.alloc(101), 100),
  );
  assert.equal(
    validateUpload("../../safe.md", "text/markdown", Buffer.from("safe"), 100)
      .filename,
    "safe.md",
  );
});
test("real PDF and DOCX fixtures extract source text", async () => {
  for (const ext of ["pdf", "docx"]) {
    const sections = await extract(
      await readFile(`tests/fixtures/refunds.${ext}`),
      `.${ext}`,
    );
    assert.match(sections.map((s) => s.text).join(" "), /30 days/);
  }
});
const hit = (id: string): Hit => ({
  id,
  documentId: `doc-${id}`,
  filename: `${id}.md`,
  content: "Evidence text.",
  chunkIndex: 0,
  metadata: {},
});
test("RRF combines ranks, preserves independent scores and context budget", () => {
  const result = fuse(
    [{ ...hit("a"), semanticScore: 0.7 }, hit("b")],
    [{ ...hit("b"), keywordScore: 0.2 }],
  );
  assert.equal(result[0].id, "b");
  assert.equal(result[0].keywordScore, 0.2);
  assert.equal(selectContext(result, 4).length, 1);
  assert.deepEqual(
    citations(result).map((s) => s.documentId),
    ["doc-b", "doc-a"],
  );
  assert.match(groundedPrompt(result), /untrusted data/);
});
test("retrieval metrics use actual ranked evidence, without double-counting recall", () => {
  assert.deepEqual(retrievalMetrics(["a", "b"], ["x", "a", "a"]), {
    recall: 0.5,
    reciprocalRank: 0.5,
  });
  assert.deepEqual(retrievalMetrics(["a"], []), {
    recall: 0,
    reciprocalRank: 0,
  });
});
test("permissions deny missing metadata and private non-owner access", () => {
  const actor = { id: "a", permissions: [] };
  assert.equal(mayAccess(actor, undefined), false);
  assert.equal(
    mayAccess(actor, { ownerId: "b", visibility: "private" }),
    false,
  );
  assert.equal(mayAccess(actor, { ownerId: "b", visibility: "shared" }), true);
  assert.equal(
    mayAccess(actor, { ownerId: "b", visibility: "shared" }, true),
    false,
  );
  assert.equal(
    mayAccess(
      { id: "a", permissions: ["hub:admin"] },
      { ownerId: "b", visibility: "private" },
      true,
    ),
    true,
  );
});
test("providers require explicit selection and validate dimensions", async () => {
  assert.throws(() => createProvider({}));
  assert.throws(() => createProvider({ provider: "openai" }));
  assert.throws(() => validateVectors([[0, 0]], 1, 2));
  assert.throws(() => validateVectors([[1, 2]], 1, 3));
  const mock = new MockProvider(64);
  assert.deepEqual(
    await mock.embed(["refund policy"]),
    await mock.embed(["refund policy"]),
  );
  assert.equal((await mock.embed(["refund policy"]))[0].length, 64);
});
test("SSE decoding survives fragmented UTF-8 and record boundaries", async () => {
  const bytes = new TextEncoder().encode(
    'data: {"text":"café"}\n\ndata: [DONE]\n\n',
  );
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      for (const byte of bytes) c.enqueue(new Uint8Array([byte]));
      c.close();
    },
  });
  const result = [];
  for await (const line of records(stream, true)) result.push(line);
  assert.deepEqual(result, ['{"text":"café"}', "[DONE]"]);
});
test("HTTP adapter retries transient status, validates embeddings and streams usage", async () => {
  let attempts = 0;
  const server = createServer((req, res) => {
    if (req.url === "/embeddings") {
      if (++attempts === 1) {
        res.writeHead(429).end();
        return;
      }
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          data: [{ index: 0, embedding: [1, 0, 0, 0, 0, 0, 0, 0] }],
        }),
      );
    } else {
      res.setHeader("Content-Type", "text/event-stream");
      res.end(
        'data: {"choices":[{"delta":{"content":"Answer [1]"}}]}\n\ndata: {"choices":[],"usage":{"prompt_tokens":4,"completion_tokens":3}}\n\ndata: [DONE]\n\n',
      );
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const provider = createProvider({
      provider: "openai",
      baseUrl: `http://127.0.0.1:${address.port}`,
      apiKey: "test-key",
      dimensions: 8,
    });
    assert.equal((await provider.embed(["x"]))[0][0], 1);
    assert.equal(attempts, 2);
    const events = [];
    for await (const event of provider.stream([
      { role: "user", content: "hi" },
    ]))
      events.push(event);
    assert.equal(events[0].type, "delta");
    assert.deepEqual(events[1], {
      type: "usage",
      usage: { inputTokens: 4, outputTokens: 3 },
    });
  } finally {
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
  }
});
test(
  "optional real provider smoke",
  { skip: process.env.REAL_PROVIDER_SMOKE !== "1" },
  async () => {
    const provider = createProvider({
      provider: process.env.AI_PROVIDER,
      apiKey: process.env.AI_API_KEY,
      baseUrl: process.env.AI_BASE_URL,
      dimensions: process.env.EMBEDDING_DIMENSIONS,
      chatModel: process.env.CHAT_MODEL,
      embeddingModel: process.env.EMBEDDING_MODEL,
    });
    assert.equal(
      (await provider.embed(["Knowledge retrieval"]))[0].length,
      provider.dimensions,
    );
    let text = "";
    for await (const event of provider.stream([
      { role: "user", content: "Reply with a short greeting." },
    ]))
      if (event.type === "delta") text += event.text;
    assert.ok(text.length);
  },
);
