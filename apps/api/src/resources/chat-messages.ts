import { defineResource, z } from "@nestjs-cms/core";
import { workflowHooks } from "./_managed";
export default defineResource({
  name: "chat_messages",
  label: "Chat messages",
  schema: z
    .object({
      sessionId: z.uuid(),
      role: z.enum(["user", "assistant"]),
      content: z.string(),
      citations: z.array(z.unknown()),
      metadata: z.record(z.string(), z.unknown()),
    })
    .strict(),
  columns: {
    sessionId: { type: "uuid" },
    role: { type: "text" },
    content: { type: "text" },
    citations: { type: "jsonb", default: () => "'[]'::jsonb" },
    metadata: { type: "jsonb", default: () => "'{}'::jsonb" },
  },
  foreignKeys: [
    {
      target: "chat_sessions",
      columnNames: ["sessionId"],
      referencedColumnNames: ["id"],
      onDelete: "CASCADE",
    },
  ],
  filterable: ["sessionId", "role"],
  sortable: ["createdAt"],
  hooks: workflowHooks,
});
