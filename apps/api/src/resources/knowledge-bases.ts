import { defineResource, z } from "@nestjs-cms/core";
import { ForbiddenException } from "@nestjs/common";
import { workflowOnly } from "./_managed";

export default defineResource({
  name: "knowledge_bases",
  label: "Knowledge bases",
  schema: z
    .object({
      name: z.string().trim().min(1).max(160),
      description: z.string().max(4000).default(""),
      visibility: z.enum(["private", "shared"]).default("private"),
      ownerId: z.uuid(),
    })
    .strict(),
  columns: {
    name: { type: "text" },
    description: { type: "text", default: "" },
    visibility: { type: "text" },
    ownerId: { type: String, length: 36 },
  },
  foreignKeys: [
    {
      target: "users",
      columnNames: ["ownerId"],
      referencedColumnNames: ["id"],
      onDelete: "CASCADE",
    },
  ],
  filterable: ["name", "visibility", "ownerId"],
  sortable: ["name", "createdAt", "updatedAt"],
  hooks: {
    onBeforeUpdate: [
      ({ record, previous }) => {
        if (record.ownerId !== previous?.ownerId)
          throw new ForbiddenException(
            "Knowledge base ownership cannot be changed.",
          );
      },
    ],
    // Cascading database rows alone would leave files and derived content behind.
    onBeforeDelete: [workflowOnly],
  },
});
