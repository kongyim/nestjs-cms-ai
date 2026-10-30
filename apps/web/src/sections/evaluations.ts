import { defineCustomSection } from "@nestjs-cms/admin";
import { Evaluations } from "../components/evaluations";

export default defineCustomSection({
  key: "evaluations",
  label: "Evaluations",
  component: Evaluations,
  readPermission: "hub:admin",
});
