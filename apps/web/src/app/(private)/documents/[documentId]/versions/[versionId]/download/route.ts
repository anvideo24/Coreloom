import { NextResponse } from "next/server";

import { founderSession } from "@/lib/auth/session";
import { documentDownloadDisposition } from "@/lib/domain/documents";
import { getFounderVaultDocumentVersionFile } from "@/lib/documents/repository";
import { readStoredDocument } from "@/lib/documents/storage";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ documentId: string; versionId: string }> },
) {
  const session = await founderSession();
  if (session.state === "signed-out") return NextResponse.redirect(new URL("/sign-in", request.url));
  if (session.state === "denied") return NextResponse.redirect(new URL("/dashboard", request.url));

  const { documentId, versionId } = await params;
  const stored = await getFounderVaultDocumentVersionFile(session.founder.id, documentId, versionId);
  if (!stored) return new NextResponse("Not found", { status: 404 });

  const bytes = await readStoredDocument(stored.storageKey);
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Disposition": documentDownloadDisposition(stored.storedFilename),
      "Content-Type": stored.contentType,
      "Cache-Control": "private, no-store",
    },
  });
}
