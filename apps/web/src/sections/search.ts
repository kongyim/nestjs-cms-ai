import { defineCustomSection } from "@nestjs-cms/admin";
import { Search } from "../components/search";

export default defineCustomSection({
  key: "search",
  label: "Search explorer",
  component: Search,
});
