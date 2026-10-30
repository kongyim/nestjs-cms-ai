import { defineCustomSection } from "@nestjs-cms/admin";
import { Knowledge } from "../components/knowledge";

export default defineCustomSection({
  key: "knowledge",
  label: "Knowledge bases",
  component: Knowledge,
});
