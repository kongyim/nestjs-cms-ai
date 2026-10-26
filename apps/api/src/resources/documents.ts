import { defineResource, z } from "@nestjs-cms/core";
import { workflowHooks } from "./_managed";
export default defineResource({
  name: "documents",
  label: "Documents",
  schema: z
    .object({
      knowledgeBaseId: z.uuid(),
      filename: z.string().min(1).max(180),
      mimeType: z.string().min(1),
      size: z.number().int().positive(),
      storageKey: z.uuid(),
      contentHash: z.string().regex(/^[a-f0-9]{64}$/),
      status: z.enum(["queued", "processing", "ready", "failed"]),
      version: z.number().int().positive(),
      errorMessage: z.string().nullable(),
    })
    .strict(),
  columns: {
    knowledgeBaseId: { type: "uuid" },
    filename: { type: "text" },
    mimeType: { type: "text" },
    size: { type: "integer" },
    storageKey: { type: "text", unique: true },
    contentHash: { type: "text" },
    status: { type: "text" },
    version: { type: "integer", default: 1 },
    errorMessage: { type: "text", nullable: true },
  },
  foreignKeys: [
    {
      target: "knowledge_bases",
      columnNames: ["knowledgeBaseId"],
      referencedColumnNames: ["id"],
      onDelete: "CASCADE",
    },
  ],
  filterable: ["knowledgeBaseId", "filename", "status"],
  sortable: ["filename", "createdAt", "updatedAt"],
  hooks: workflowHooks,
});
