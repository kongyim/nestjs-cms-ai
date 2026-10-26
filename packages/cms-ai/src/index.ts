import { CmsAuthOptions } from "@nestjs-cms/auth";
export function authOptions(): CmsAuthOptions {
  return {
    adminOrigin: process.env.ADMIN_ORIGIN ?? "http://localhost:3000",
    adminBasePath: "",
    permissions: ["hub:admin"],
    ...(process.env.ADMIN_BOOTSTRAP_EMAIL &&
    process.env.ADMIN_BOOTSTRAP_PASSWORD
      ? {
          bootstrapAdmin: {
            email: process.env.ADMIN_BOOTSTRAP_EMAIL,
            password: process.env.ADMIN_BOOTSTRAP_PASSWORD,
          },
        }
      : {}),
  };
}
export type Actor = { id: string; permissions: string[] };
export type KnowledgeAccess = {
  ownerId: string;
  visibility: "private" | "shared";
};
export function mayAccess(
  actor: Actor,
  kb: KnowledgeAccess | undefined,
  write = false,
): boolean {
  return (
    !!kb &&
    (kb.ownerId === actor.id ||
      actor.permissions.includes("hub:admin") ||
      (!write && kb.visibility === "shared"))
  );
}
export { AiProviderModule, AI_PROVIDER } from "./module";
