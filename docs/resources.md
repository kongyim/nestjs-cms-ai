# API resource definitions

The API uses the CMS's documented directory discovery. Resource definitions live in `apps/api/src/resources`; there is no resource index or manual per-resource module registration.

`cmsAuthOptions()` in `apps/api/src/cms.config.ts` configures the existing `CmsAuthModule`:

```typescript
resourcesPath: join(__dirname, 'resources'),
extension: __filename.endsWith('.ts') ? '.ts' : '.js',
```

The module loads each default-exported `defineResource(...)` automatically. Development loads `.ts`; the compiled API loads `.js` from `dist/apps/api/src/resources`. Declaration files and underscore-prefixed helpers are skipped by the upstream loader. Auth continues to register its own users/roles: do not duplicate them in this directory or import a second ResourceModule.

## Registered resources

| File               | Resource/table  | Generated API behavior                                                                                                           |
| ------------------ | --------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| knowledge-bases.ts | knowledge_bases | Administrative list/get/create/update through `/api/knowledge_bases`; ownership is immutable; deletion uses the cleanup endpoint |
| documents.ts       | documents       | Administrative inspection; upload, reindex and deletion use document workflow endpoints                                          |
| document-chunks.ts | document_chunks | Administrative inspection; embeddings/generated search vectors are not selected in generic results                               |
| ingestion-jobs.ts  | ingestion_jobs  | Administrative inspection; the worker owns state changes                                                                         |
| chat-sessions.ts   | chat_sessions   | Registered entity/schema; generic access blocked in favor of owner-scoped chat endpoints                                         |
| chat-messages.ts   | chat_messages   | Registered entity/schema; generic access blocked in favor of owner-scoped chat endpoints                                         |
| evaluation-runs.ts | evaluation_runs | Registered entity/schema; generic access blocked in favor of owner-scoped evaluation endpoints                                   |

Each definition contains its Zod schema, columns, relationships, allowed filters/sorts and lifecycle hooks. `GET /api/_resources` exposes the catalog to identities with the CMS `users:manage` permission. The common permission mapping is derived from discovered resource names and requires `hub:admin` for generic hub resource routes, so existing admin roles do not need a new permission for every resource. Regular users continue using the ownership-aware hub routes.

The existing `/api/knowledge-bases` adapter supplies the authenticated owner and delegates create/update to the CMS `ResourceService` using the discovered `knowledge_bases` definition. It retains the existing frontend contract. Other application operations require transactions spanning files, chunks, jobs, messages and evaluations. Their resource hooks reject arbitrary generic mutations, preventing a direct POST from marking an unindexed document ready or bypassing file cleanup. Private history is never exposed by a generic list, including to another administrator.

Fixed application routes take precedence over the CMS catch-all. For example, `GET /api/documents/:id` and `DELETE /api/documents/:id` use the existing permission-aware document workflow; `GET /api/documents` is the generated administrative list. CMS-generated lists use `{data,meta}`.

## Adding a resource

Add a default-exported definition file in this directory, then restart the API (or rebuild and restart the compiled API). No controller/index edit is needed for a normal CMS resource. The CMS discovers it, registers the TypeORM entity and provides its generic routes. The shared config automatically applies the hub administrator permission mapping. Add workflow hooks or dedicated policy handling if the resource has stronger access/lifecycle requirements.

Discovery does not replace migrations. Keep `DB_SYNCHRONIZE=false`, add a reviewed SQL migration for a new table, and run `pnpm db:migrate` before startup. CMS reserves `id`, `createdAt` and `updatedAt`; do not put them in resource schemas/columns. Migration 003 adds missing `updatedAt` columns for existing workflow tables, with triggers so worker SQL updates also maintain them. Existing UUID primary keys are retained; core's generated metadata describes IDs as strings, so inspect any generated TypeORM schema diff rather than blindly applying an ID-type conversion. Vector indexes and generated full-text search remain managed by the SQL migrations.

`apps/api/src/cms-data-source.ts` exposes a TypeORM data source with the same discovery configuration for schema inspection. It is not a second runtime connection and is not the project's SQL migration runner.

## Verification

`tests/resources.test.ts` verifies automatic loading, the catalog, reserved fields, permissions and schemas. The API integration suite exercises generated KB CRUD, checks that custom and generic routes read the same records, preserves omitted fields in partial updates, and rejects raw workflow writes and generic private-history reads. Source and compiled discovery are both checked during development verification.
