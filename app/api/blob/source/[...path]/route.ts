import { get } from "@vercel/blob";

import { blobEnv } from "@/lib/env";
import { readPlan } from "@/lib/store/plan";

// "Tap to see where it says that" — the letter behind a quote.
//
// The Blob store is Private, so `<img src={blobUrl}>` and `next/image` both
// 401. The bytes have to come through an authenticated route, and this is it.
// It is scoped to pathnames referenced by THIS patient's stored plan, so it
// cannot be turned into a reader for the whole store.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const patientId = new URL(request.url).searchParams.get("patientId");
  if (patientId === null)
    return new Response("Name a patient.", { status: 400 });

  const pathname = (await params).path.map(decodeURIComponent).join("/");
  const bundle = await readPlan(patientId);
  const known = bundle?.documents.some(
    (document) => document.blobPathname === pathname,
  );
  if (known !== true) return new Response("No such page.", { status: 404 });

  const blob = await get(pathname, {
    access: "private",
    token: blobEnv().BLOB_READ_WRITE_TOKEN,
  });
  if (blob === null || blob.statusCode !== 200) {
    return new Response("No such page.", { status: 404 });
  }

  return new Response(blob.stream, {
    headers: {
      "content-type": blob.blob.contentType,
      "content-disposition": "inline",
      // A private health document must not sit in a shared cache.
      "cache-control": "private, no-store",
    },
  });
}
