import "dotenv/config";
const base = process.env.API_URL ?? "http://localhost:3001/api";
const login = await fetch(`${base}/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-cms-request": "1" },
  body: JSON.stringify({
    email: process.env.ADMIN_BOOTSTRAP_EMAIL,
    password: process.env.ADMIN_BOOTSTRAP_PASSWORD,
  }),
});
if (!login.ok) throw new Error("Login failed");
const cookie = login.headers.get("set-cookie").split(";")[0];
const bases = await (
  await fetch(`${base}/knowledge-bases`, { headers: { cookie } })
).json();
const kb = bases.find((k) => k.name === "Northstar Supply demo");
if (!kb) throw new Error("Seed demo first");
let ready = false;
for (let i = 0; i < 60; i++) {
  const docs = await (
    await fetch(`${base}/knowledge-bases/${kb.id}/documents`, {
      headers: { cookie },
    })
  ).json();
  if (docs.some((d) => d.status === "failed"))
    throw new Error("Demo ingestion failed");
  if (docs.length === 10 && docs.every((d) => d.status === "ready")) {
    ready = true;
    break;
  }
  await new Promise((r) => setTimeout(r, 1000));
}
if (!ready) throw new Error("Demo ingestion timed out");
console.log("All 10 demo documents indexed");
