import "dotenv/config";
export async function client() {
  const base = process.env.API_URL ?? "http://localhost:3001/api";
  const response = await fetch(`${base}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-cms-request": "1" },
    body: JSON.stringify({
      email: process.env.ADMIN_BOOTSTRAP_EMAIL,
      password: process.env.ADMIN_BOOTSTRAP_PASSWORD,
    }),
  });
  if (!response.ok) throw new Error(`Login failed: ${response.status}`);
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  if (!cookie) throw new Error("Missing session cookie");
  return async function api(
    path: string,
    body?: unknown,
    method = body === undefined ? "GET" : "POST",
  ): Promise<unknown> {
    const form = body instanceof FormData;
    const result = await fetch(`${base}${path}`, {
      method,
      headers: {
        cookie,
        "x-cms-request": "1",
        ...(!form ? { "Content-Type": "application/json" } : {}),
      },
      ...(body !== undefined
        ? { body: form ? body : JSON.stringify(body) }
        : {}),
    });
    if (!result.ok)
      throw new Error(`API ${result.status}: ${await result.text()}`);
    return result.json();
  };
}
