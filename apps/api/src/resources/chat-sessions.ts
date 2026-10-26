import { defineResource, z } from "@nestjs-cms/core";
import { workflowHooks } from "./_managed";
export default defineResource({
  name: "chat_sessions",
  label: "Chat sessions",
  schema: z
    .object({
      knowledgeBaseId: z.uuid(),
      userId: z.uuid(),
      title: z.string().min(1).max(160),
    })
    .strict(),
  columns: {
    knowledgeBaseId: { type: "uuid" },
    userId: { type: String, length: 36 },
    title: { type: "text" },
  },
  foreignKeys: [
    {
      target: "knowledge_bases",
      columnNames: ["knowledgeBaseId"],
      referencedColumnNames: ["id"],
      onDelete: "CASCADE",
    },
    {
      target: "users",
      columnNames: ["userId"],
      referencedColumnNames: ["id"],
      onDelete: "CASCADE",
    },
  ],
  filterable: ["knowledgeBaseId", "userId"],
  sortable: ["createdAt", "updatedAt"],
  hooks: workflowHooks,
});
