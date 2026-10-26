import { join } from "node:path";
import { loadResources } from "@nestjs-cms/core";
import type { CmsAuthOptions } from "@nestjs-cms/auth";
import { authOptions } from "../../../packages/cms-ai/src";

export function cmsAuthOptions(): CmsAuthOptions {
  const resourcesPath = join(__dirname, "resources");
  const extension = __filename.endsWith(".ts") ? ".ts" : ".js";
  // Discovery is used only to apply the common admin policy. CmsAuthModule
  // itself loads the definitions from resourcesPath; no resource index is needed.
  const resources = loadResources(resourcesPath, extension);
  return {
    ...authOptions(),
    resourcesPath,
    extension,
    resourcePermissions: Object.fromEntries(
      resources.map((resource) => [
        resource.name,
        { read: "hub:admin", write: "hub:admin" },
      ]),
    ),
  };
}
