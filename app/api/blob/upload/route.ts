import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

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

export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;

  // No `onUploadCompleted`: Vercel calls it from its own backend, which cannot
  // reach a dev machine. The browser drives the next step itself by posting the
  // uploaded documents to /api/extract.
  const result = await handleUpload({
    body,
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
