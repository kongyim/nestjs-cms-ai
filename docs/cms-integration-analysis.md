# CMS investigation — 26 October 2026

Evidence: npm registry metadata, downloaded published tarballs, their READMEs, TypeScript declarations and compiled implementations. Source README identifies https://github.com/kongyim/nestjs-cms; its HEAD was verified as `27e57d19c79ca3071a6727d56d051c3fbe4c8808`, matching core's npm gitHead. Package metadata does not declare repository fields.

| Package            | Inspected | Confirmed API / constraints                                                                                                                                                                                                                                                                                          |
| ------------------ | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| @nestjs-cms/core   | 0.1.6     | `ResourceModule.forRoot`, `defineResource`, `ResourceService`, `ResourceRegistry`, `createCmsDataSource`; TypeORM ^0.3.25, PostgreSQL/MySQL, Zod 4, AWS S3 attachments; Node >=22, NestJS ^11.1.0                                                                                                                    |
| @nestjs-cms/auth   | 0.1.1     | `CmsAuthModule.forRoot`, `createAuthDataSource`, `AuthService.login/authenticate/logout/setPassword`, `Identity`, `Credential`, `Session`. Peer core ^0.1.3, NestJS ^11.1.0, TypeORM ^0.3.25.                                                                                                                        |
| @nestjs-cms/admin  | 0.1.3     | React 19 `AdminPortal`, `defineAdmin`, `defineCustomSection`, `defineSection`, `createAuthSections`, `useAdmin`. Custom sections use React component references; resource sections call CMS CRUD endpoints. MUI ^9.5.0, Emotion 11.                                                                                  |
| @nestjs-cms/import | 0.1.1     | `CmsImportModule.forRoot({imports:[authModule], ...options})`, `DatabaseImporter.run`, injectable `SheetReader`, `GoogleSheetReader`, `planImport`, `importRecordId`, `orderRows`. Google Sheets transactional resource importer; no PDF/DOCX extraction API. Peers core ^0.1.3, auth ^0.1.0, TypeORM and NestJS 11. |

## Decisions

Use Node 22 LTS, NestJS 11 and TypeORM for CMS; parameterized PostgreSQL queries for vector/domain repository operations. Do not introduce Prisma as a second migration/connection model. CMS owns users, roles, credentials and sessions. The host owns reviewed SQL migrations, AI knowledge tables, local files and BullMQ jobs. `DB_SYNCHRONIZE=false` throughout.

Register exactly one `CmsAuthModule.forRoot(cmsAuthOptions())`. It includes core automatically. Auth cookies use `/api` with this base path. CMS routes already include `api`; do not globally prefix the Nest application. Reuse `AuthService.authenticate` in a host guard: the CMS global guard explicitly ignores controllers without its internal metadata. Identity permissions supply administrator authority; LLM output never grants permission. Origin and `x-cms-request` checks apply to mutations.

Use the admin portal's existing login, user/role editors and custom sections for knowledge workflows. Hub entities are now defined under `apps/api/src/resources` and automatically discovered through `resourcesPath`. Generated routes require `hub:admin`; workflow-owned mutations and generic private-history access are blocked, while dedicated routes preserve row-level policies. Knowledge-base create/update delegates to the CMS ResourceService. See [resource configuration](resources.md). Shared means readable by authenticated users; only owner/admin may mutate. Chat ownership remains enforced even for admins.

Use separate extraction adapters: import cannot parse documents. Do not install unused Google OAuth dependencies or claim Google Sheets synchronization exists. CMS content synchronization is a future adapter extension, not implemented ingestion functionality.

## Licensing and missing extension points

Admin declares `UNLICENSED`; core/auth/import tarball package metadata omit a license. No license grant has been inferred from public npm availability. An MIT LICENSE is deferred pending the author's clarification of ecosystem licensing; no upstream packages are modified or republished. This prevents describing the assembled distribution as unconditionally MIT licensed.

CMS attachments require S3; the requested local storage uses a host adapter. CMS guard is not a general app guard, and package migrations are not shipped. Auth only bootstraps an empty users table. Changing bootstrap environment variables does not reset existing accounts. Models and dimensions require explicit vector reindexing; no invented CMS APIs are used.
