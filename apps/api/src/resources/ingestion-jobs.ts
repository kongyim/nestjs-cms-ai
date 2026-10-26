import { defineResource, z } from "@nestjs-cms/core";
import { workflowHooks } from "./_managed";
export default defineResource({
  name: "ingestion_jobs",
  label: "Ingestion jobs",
  schema: z
    .object({
      documentId: z.uuid(),
      status: z.enum(["queued", "processing", "completed", "failed"]),
      attempts: z.number().int().nonnegative(),
      startedAt: z.iso.datetime().nullable(),
      completedAt: z.iso.datetime().nullable(),
      errorMessage: z.string().nullable(),
    })
    .strict(),
  columns: {
    documentId: { type: "uuid" },
    status: { type: "text", default: "queued" },
    attempts: { type: "integer", default: 0 },
    startedAt: { type: "timestamptz", nullable: true },
    completedAt: { type: "timestamptz", nullable: true },
    errorMessage: { type: "text", nullable: true },
  },
  foreignKeys: [
    {
      target: "documents",
      columnNames: ["documentId"],
      referencedColumnNames: ["id"],
      onDelete: "CASCADE",
    },
  ],
  filterable: ["documentId", "status"],
  sortable: ["createdAt", "attempts"],
  hooks: workflowHooks,
});
