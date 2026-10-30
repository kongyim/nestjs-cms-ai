"use client";

import { AdminPortal } from "@nestjs-cms/admin";
import config from "../admin.config";

export default function Portal() {
  return <AdminPortal config={config} />;
}
