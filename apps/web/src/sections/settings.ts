import { defineCustomSection } from "@nestjs-cms/admin";
import { Settings } from "../components/settings";

export default defineCustomSection({
  key: "settings",
  label: "Settings",
  component: Settings,
});
