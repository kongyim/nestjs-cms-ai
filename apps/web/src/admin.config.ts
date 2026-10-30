"use client";

import { defineAdmin, createAuthSections } from "@nestjs-cms/admin";
import dashboard from "./sections/dashboard";
import knowledge from "./sections/knowledge";
import chat from "./sections/chat";
import search from "./sections/search";
import jobs from "./sections/jobs";
import evaluations from "./sections/evaluations";
import settings from "./sections/settings";

const permissions = [
  { value: "users:manage", label: "Manage users and roles" },
  { value: "hub:admin", label: "Administer all knowledge and run evaluations" },
];
export default defineAdmin({
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
    dashboard,
    knowledge,
    chat,
    search,
    jobs,
    evaluations,
    ...createAuthSections(permissions),
    settings,
  ],
});
