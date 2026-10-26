import "reflect-metadata";
import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { loadResources, ResourceRegistry } from "@nestjs-cms/core";
import { cmsAuthOptions } from "../apps/api/src/cms.config";
const expected = [
  "chat_messages",
  "chat_sessions",
  "document_chunks",
  "documents",
  "evaluation_runs",
  "ingestion_jobs",
  "knowledge_bases",
];
test("CMS discovers hub definitions from the resource directory without an index", () => {
  const definitions = loadResources(
    join(process.cwd(), "apps/api/src/resources"),
    ".ts",
  );
  assert.deepEqual(definitions.map((r) => r.name).sort(), expected);
  const registry = new ResourceRegistry(definitions);
  assert.equal(registry.describe().length, 7);
  for (const resource of definitions) {
    assert.equal(resource.columns.id, undefined);
    assert.equal(resource.columns.createdAt, undefined);
    assert.equal(resource.columns.updatedAt, undefined);
  }
  const options = cmsAuthOptions();
  assert.equal(options.extension, ".ts");
  assert.equal(options.resources, undefined);
  for (const name of expected)
    assert.deepEqual(options.resourcePermissions?.[name], {
      read: "hub:admin",
      write: "hub:admin",
    });
});
test("resource schemas reject invalid knowledge input and workflow hooks protect managed records", () => {
  const definitions = loadResources(
    join(process.cwd(), "apps/api/src/resources"),
    ".ts",
  );
  const registry = new ResourceRegistry(definitions);
  assert.equal(
    registry.get("knowledge_bases").schema.safeParse({
      name: "Example",
      ownerId: "bad-id",
      visibility: "public",
    }).success,
    false,
  );
  for (const name of expected.filter((n) => n !== "knowledge_bases"))
    assert.ok(registry.get(name).hooks?.onBeforeCreate?.length);
  assert.ok(registry.get("knowledge_bases").hooks?.onBeforeDelete?.length);
});
