import { defineCustomSection } from "@nestjs-cms/admin";
import { Chat } from "../components/chat";

export default defineCustomSection({
  key: "chat",
  label: "AI conversations",
  component: Chat,
});
