import { defineCustomSection } from "@nestjs-cms/admin";
import { Dashboard } from "../components/dashboard";

export default defineCustomSection({
  key: "dashboard",
  label: "Overview",
  component: Dashboard,
});
