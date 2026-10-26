"use client";
import {
  AdminPortal,
  defineAdmin,
  defineCustomSection,
  createAuthSections,
} from "@nestjs-cms/admin";
import { Dashboard } from "../sections/dashboard";
import { Knowledge } from "../sections/knowledge";
import { Search } from "../sections/search";
import { Chat } from "../sections/chat";
import { Jobs } from "../sections/jobs";
import { Evaluations } from "../sections/evaluations";
import { Settings } from "../sections/settings";
const permissions = [
  { value: "users:manage", label: "Manage users and roles" },
  { value: "hub:admin", label: "Administer all knowledge and run evaluations" },
];
const config = defineAdmin({
  title: "Knowledge Hub",
  subtitle: "NESTJS · AI WORKSPACE",
  loginDescription:
    "Sign in to explore your team’s knowledge. Accounts are managed by your CMS administrator.",
  apiBaseUrl: "/api",
  defaultSection: "dashboard",
  theme: {
    palette: {
      primary: { main: "#1d645e" },
      background: { default: "#f4f6fa" },
    },
    typography: { fontFamily: "Arial, Helvetica, sans-serif" },
    shape: { borderRadius: 10 },
  },
  sections: [
    defineCustomSection({
      key: "dashboard",
      label: "Overview",
      component: Dashboard,
    }),
    defineCustomSection({
      key: "knowledge",
      label: "Knowledge bases",
      component: Knowledge,
    }),
    defineCustomSection({
      key: "chat",
      label: "AI conversations",
      component: Chat,
    }),
    defineCustomSection({
      key: "search",
      label: "Search explorer",
      component: Search,
    }),
    defineCustomSection({
      key: "jobs",
      label: "Ingestion jobs",
      component: Jobs,
    }),
    defineCustomSection({
      key: "evaluations",
      label: "Evaluations",
      component: Evaluations,
      readPermission: "hub:admin",
    }),
    ...createAuthSections(permissions),
    defineCustomSection({
      key: "settings",
      label: "Settings",
      component: Settings,
    }),
  ],
});
export default function Portal() {
  return <AdminPortal config={config} />;
}
