import { defineResource, z } from "@nestjs-cms/core";
import { workflowHooks } from "./_managed";
export default defineResource({
  name: "evaluation_runs",
  label: "Evaluation runs",
  schema: z
    .object({
      userId: z.uuid(),
      knowledgeBaseId: z.uuid(),
      status: z.enum(["running", "completed", "failed"]),
      config: z.record(z.string(), z.unknown()),
      results: z.array(z.unknown()),
      summary: z.record(z.string(), z.unknown()),
      completedAt: z.iso.datetime().nullable(),
    })
    .strict(),
  columns: {
    userId: { type: String, length: 36 },
    knowledgeBaseId: { type: "uuid" },
    status: { type: "text" },
    config: { type: "jsonb" },
    results: { type: "jsonb", default: () => "'[]'::jsonb" },
    summary: { type: "jsonb", default: () => "'{}'::jsonb" },
    completedAt: { type: "timestamptz", nullable: true },
  },
  foreignKeys: [
    {
      target: "users",
      columnNames: ["userId"],
      referencedColumnNames: ["id"],
      onDelete: "CASCADE",
    },
    {
      target: "knowledge_bases",
      columnNames: ["knowledgeBaseId"],
      referencedColumnNames: ["id"],
      onDelete: "CASCADE",
    },
  ],
  filterable: ["knowledgeBaseId", "userId", "status"],
  sortable: ["createdAt"],
  hooks: workflowHooks,
});
