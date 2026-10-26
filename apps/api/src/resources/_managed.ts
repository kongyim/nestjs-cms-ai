import { ForbiddenException } from "@nestjs/common";
import type { ResourceDefinition } from "@nestjs-cms/core";

// The CMS loader deliberately ignores filenames beginning with an underscore.
// Workflow-owned records cannot be safely created/updated/deleted as arbitrary CRUD.
export function workflowOnly(): never {
  throw new ForbiddenException(
    "Use the knowledge hub workflow endpoints to modify this resource.",
  );
}
export const workflowHooks: ResourceDefinition["hooks"] = {
  onBeforeCreate: [workflowOnly],
  onBeforeUpdate: [workflowOnly],
  onBeforeDelete: [workflowOnly],
};
export const privateHistoryResources = new Set([
  "chat_sessions",
  "chat_messages",
  "evaluation_runs",
]);
