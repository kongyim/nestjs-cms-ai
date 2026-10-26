import { NextRequest } from "next/server";
export const dynamic = "force-dynamic";
async function proxy(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const base = process.env.API_INTERNAL_URL ?? "http://127.0.0.1:3001";
  const url = `${base}/api/${path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`;
  const headers = new Headers();
  for (const key of ["cookie", "content-type", "x-cms-request", "origin"]) {
    const value = request.headers.get(key);
    if (value) headers.set(key, value);
  }
  let body: ArrayBuffer | undefined;
  const limit = 51 * 1024 * 1024;
  if (Number(request.headers.get("content-length") ?? 0) > limit)
    return Response.json(
      { error: { message: "Request too large" } },
      { status: 413 },
    );
  if (!["GET", "HEAD"].includes(request.method) && request.body) {
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > limit) {
        await reader.cancel();
        return Response.json(
          { error: { message: "Request too large" } },
          { status: 413 },
        );
      }
      chunks.push(part.value);
    }
    body = Uint8Array.from(Buffer.concat(chunks)).buffer;
  }
  const response = await fetch(url, {
    method: request.method,
    headers,
    body,
    signal: request.signal,
    cache: "no-store",
    redirect: "manual",
  });
  const outgoing = new Headers(response.headers);
  outgoing.delete("content-encoding");
  outgoing.delete("content-length");
  outgoing.delete("transfer-encoding");
  return new Response(response.body, {
    status: response.status,
    headers: outgoing,
  });
}
export {
  proxy as GET,
  proxy as POST,
  proxy as PATCH,
  proxy as DELETE,
  proxy as PUT,
};
