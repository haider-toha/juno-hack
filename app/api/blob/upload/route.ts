import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { z } from "zod";

import { blobEnv } from "@/lib/env";

// Phone-camera bundles are several megabytes per page and would exceed a
// serverless request body, so the browser uploads straight to Blob and this
// route only mints the short-lived token that lets it.
//
// The store is Private, so nothing uploaded here is reachable without
// authentication — which is what keeps the "we don't share your health
// information" promise on the home screen true.
const ALLOWED_CONTENT_TYPES = ["image/*", "application/pdf"];
const MAX_BYTES = 25 * 1024 * 1024;

// `handleUpload` owns what each event means; this is the trust boundary in
// front of it, and it exists to turn junk into a 400 instead of a 500. The
// `satisfies` is what replaces the cast the route used to carry: the compiler,
// not a claim, is what says this parses into the body the SDK accepts.
const Body = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("blob.generate-client-token"),
    payload: z.object({
      pathname: z.string().min(1),
      multipart: z.boolean(),
      clientPayload: z.string().nullable(),
    }),
  }),
  z.object({
    type: z.literal("blob.upload-completed"),
    payload: z.object({
      blob: z.object({
        url: z.url(),
        downloadUrl: z.url(),
        pathname: z.string().min(1),
        contentType: z.string(),
        contentDisposition: z.string(),
        etag: z.string(),
      }),
      tokenPayload: z.string().nullish(),
    }),
  }),
]) satisfies z.ZodType<HandleUploadBody>;

export async function POST(request: Request) {
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return Response.json(
      { message: "That is not a Vercel Blob upload request." },
      { status: 400 },
    );
  }

  // No `onUploadCompleted`: Vercel calls it from its own backend, which cannot
  // reach a dev machine. The browser drives the next step itself by posting the
  // uploaded documents to /api/extract.
  const result = await handleUpload({
    body: body.data,
    request,
    token: blobEnv().BLOB_READ_WRITE_TOKEN,
    onBeforeGenerateToken: async () => ({
      allowedContentTypes: ALLOWED_CONTENT_TYPES,
      maximumSizeInBytes: MAX_BYTES,
      addRandomSuffix: true,
    }),
  });

  return Response.json(result);
}
