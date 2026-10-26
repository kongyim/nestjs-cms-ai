import { readdir, readFile } from "node:fs/promises";
import { z } from "zod";
import { client } from "./client";
async function main() {
  const api = await client();
  const schema = z.object({ id: z.string(), name: z.string() });
  const bases = z.array(schema).parse(await api("/knowledge-bases"));
  const kb =
    bases.find((k) => k.name === "Northstar Supply demo") ??
    schema.parse(
      await api("/knowledge-bases", {
        name: "Northstar Supply demo",
        description: "Fictional commerce policies and product knowledge",
        visibility: "shared",
      }),
    );
  const docs = z
    .array(z.object({ filename: z.string() }))
    .parse(await api(`/knowledge-bases/${kb.id}/documents`));
  for (const file of (
    await readdir("examples/ecommerce-knowledge-base")
  ).filter((f) => f.endsWith(".md"))) {
    if (docs.some((d) => d.filename === file)) continue;
    const data = await readFile(`examples/ecommerce-knowledge-base/${file}`);
    const form = new FormData();
    form.append("file", new Blob([data], { type: "text/markdown" }), file);
    await api(`/knowledge-bases/${kb.id}/documents`, form);
    console.log(`Queued ${file}`);
  }
  console.log(`Demo KB: ${kb.id}. Worker must run to index documents.`);
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
