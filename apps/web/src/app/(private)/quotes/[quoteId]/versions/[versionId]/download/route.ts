import { NextResponse } from "next/server";

import { founderSession } from "@/lib/auth/session";
import { normalizeStoredQuoteItemsForPdf } from "@/lib/domain/quotes";
import { getFounderQuoteDetail } from "@/lib/quotes/repository";
import { createQuotePdf } from "@/lib/quotes/pdf";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ quoteId: string; versionId: string }> }) {
  const session = await founderSession();
  if (session.state === "signed-out") return NextResponse.redirect(new URL("/sign-in", request.url));
  if (session.state === "denied") return NextResponse.redirect(new URL("/dashboard", request.url));

  const { quoteId, versionId } = await params;
  const detail = await getFounderQuoteDetail(session.founder.id, quoteId);
  const version = detail?.versions.find((candidate) => candidate.id === versionId);
  if (!detail || !version) return new NextResponse("Not found", { status: 404 });
  const items = normalizeStoredQuoteItemsForPdf(version.items);
  const pdf = await createQuotePdf({
    clientName: detail.quote.clientName,
    title: version.title,
    versionNumber: version.versionNumber,
    items,
    subtotalAmount: version.subtotalAmount,
    vatAmount: version.vatAmount,
    totalAmount: version.totalAmount,
    vatMode: version.vatMode,
    note: version.note,
  });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Disposition": `attachment; filename=coreloom-quote-v${version.versionNumber}.pdf`,
      "Content-Type": "application/pdf",
    },
  });
}
