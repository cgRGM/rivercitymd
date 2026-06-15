import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_RELAY_UPLOAD_BYTES = 10 * 1024 * 1024;

function isAllowedR2UploadUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname.endsWith(".r2.cloudflarestorage.com")
    );
  } catch {
    return false;
  }
}

export async function PUT(request: NextRequest) {
  const uploadUrl = request.headers.get("x-r2-upload-url");
  const contentType = request.headers.get("content-type") || "application/octet-stream";
  const contentLength = Number(request.headers.get("content-length") || 0);

  if (!uploadUrl || !isAllowedR2UploadUrl(uploadUrl)) {
    return NextResponse.json({ error: "Invalid upload target." }, { status: 400 });
  }

  if (contentLength > MAX_RELAY_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: "Photo is too large to relay. Please use a photo under 10MB." },
      { status: 413 },
    );
  }

  const body = await request.arrayBuffer();
  if (body.byteLength > MAX_RELAY_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: "Photo is too large to relay. Please use a photo under 10MB." },
      { status: 413 },
    );
  }

  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body,
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    return NextResponse.json(
      {
        error:
          errorText ||
          `Storage upload failed with status ${uploadResponse.status}.`,
      },
      { status: uploadResponse.status || 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
