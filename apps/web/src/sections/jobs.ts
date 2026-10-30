import { defineCustomSection } from "@nestjs-cms/admin";
import { Jobs } from "../components/jobs";

export default defineCustomSection({
  key: "jobs",
  label: "Ingestion jobs",
  component: Jobs,
});
