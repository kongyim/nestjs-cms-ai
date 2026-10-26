import { z } from "zod";
import { client } from "./client";
async function main() {
  const api = await client();
  const bases = z
    .array(z.object({ id: z.string(), name: z.string() }))
    .parse(await api("/knowledge-bases"));
  const id =
    process.env.EVAL_KB_ID ??
    bases.find((k) => k.name === "Northstar Supply demo")?.id;
  if (!id) throw new Error("Seed the demo or set EVAL_KB_ID");
  console.log(
    JSON.stringify(
      await api("/evaluations/run", {
        knowledgeBaseId: id,
        topK: Number(process.env.EVAL_TOP_K ?? 6),
        hybrid: process.env.EVAL_HYBRID !== "false",
      }),
      null,
      2,
    ),
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
