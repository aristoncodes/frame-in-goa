import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { customAlphabet } from "nanoid";

export const runtime = "nodejs";

const nanoid = customAlphabet("23456789abcdefghijkmnpqrstuvwxyz", 10);
const MAX_BYTES = 8 * 1024 * 1024;

/**
 * Persists a generated PNG so it has a real public URL, and writes a sibling
 * JSON blob with the caption metadata. /s/[id] reads both to build a link
 * preview whose OG image is the actual graphic.
 *
 * Answers { configured: false } when blob storage isn't wired up; the client then
 * falls back to downloading the PNG and opening a pre-filled tweet to attach.
 */
export async function POST(request: Request) {
  // Not an error condition: the client has a working fallback, and a 503 here
  // would just spam the console on deployments without blob storage wired up.
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ configured: false });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing-file" }, { status: 400 });
  }
  if (file.type !== "image/png") {
    return NextResponse.json({ error: "png-only" }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "too-large" }, { status: 413 });
  }

  const id = nanoid();
  const mode = form.get("mode") === "pfp" ? "pfp" : "card";
  const meta = {
    name: String(form.get("name") ?? "").slice(0, 60),
    title: String(form.get("title") ?? "").slice(0, 60),
    mode,
  };

  try {
    const image = await put(`shares/${id}.png`, file, {
      access: "public",
      contentType: "image/png",
      addRandomSuffix: false,
      cacheControlMaxAge: 31536000,
    });
    await put(`shares/${id}.json`, JSON.stringify({ ...meta, image: image.url }), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      cacheControlMaxAge: 31536000,
    });

    const origin = new URL(request.url).origin;
    return NextResponse.json({ id, url: `${origin}/s/${id}`, image: image.url });
  } catch {
    return NextResponse.json({ error: "upload-failed" }, { status: 502 });
  }
}
