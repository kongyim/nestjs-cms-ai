import { defineResource, z } from "@nestjs-cms/core";
import { workflowHooks } from "./_managed";
export default defineResource({
  name: "document_chunks",
  label: "Document chunks",
  schema: z
    .object({
      documentId: z.uuid(),
      chunkIndex: z.number().int().nonnegative(),
      content: z.string().min(1),
      tokenCount: z.number().int().positive(),
      metadata: z.record(z.string(), z.unknown()),
      embedding: z.array(z.number()),
      modelFingerprint: z.string().min(1),
    })
    .strict(),
  columns: {
    documentId: { type: "uuid" },
    chunkIndex: { type: "integer" },
    content: { type: "text" },
    tokenCount: { type: "integer" },
    metadata: { type: "jsonb" },
    embedding: { type: "vector", select: false },
    modelFingerprint: { type: "text" },
    search: {
      type: "tsvector",
      asExpression: "to_tsvector('english',content)",
      generatedType: "STORED",
      select: false,
      insert: false,
      update: false,
    },
  },
  foreignKeys: [
    {
      target: "documents",
      columnNames: ["documentId"],
      referencedColumnNames: ["id"],
      onDelete: "CASCADE",
    },
  ],
  filterable: ["documentId", "modelFingerprint"],
  sortable: ["chunkIndex", "createdAt"],
  hooks: workflowHooks,
});
