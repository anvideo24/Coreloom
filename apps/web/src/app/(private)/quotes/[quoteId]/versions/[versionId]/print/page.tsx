import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { QuoteDocumentActions } from "@/components/quote-print-button";
import { QuoteInvoiceDocument } from "@/components/quote-invoice-document";
import { founderSession } from "@/lib/auth/session";
import { normalizeStoredQuoteItemsForPdf, type QuoteVatMode } from "@/lib/domain/quotes";
import { quotePdfDownloadPath } from "@/lib/quotes/download";
import { getFounderQuoteDetail } from "@/lib/quotes/repository";

export const dynamic = "force-dynamic";

export default async function QuotePrintPage({
  params,
}: {
  params: Promise<{ quoteId: string; versionId: string }>;
}) {
  const session = await founderSession();
  if (session.state === "signed-out") redirect("/sign-in");
  if (session.state === "denied") redirect("/dashboard");
  const { quoteId, versionId } = await params;
  const detail = await getFounderQuoteDetail(session.founder.id, quoteId);
  const version = detail?.versions.find((candidate) => candidate.id === versionId);
  if (!detail || !version) notFound();
  const items = normalizeStoredQuoteItemsForPdf(version.items);
  const vatMode = (version.vatMode ?? "exclusive") as QuoteVatMode;
  const issuedOn = version.issuedOn instanceof Date ? version.issuedOn : new Date(version.issuedOn);
  const validUntil =
    version.validUntil instanceof Date ? version.validUntil : new Date(version.validUntil);
  const contact = detail.contacts.find((item) => item.id === version.clientContactId);

  return (
    <main className="quote-print-shell">
      <div className="quote-print-actions">
        <Link className="text-link" href={`/quotes/${quoteId}`}>
          견적 이력
        </Link>
        <Link className="text-link" href={`/quotes/${quoteId}/versions/${versionId}/email`}>
          메일 발송
        </Link>
        <Link className="text-link" href="/contracts">
          계약
        </Link>
        <QuoteDocumentActions downloadHref={quotePdfDownloadPath(quoteId, versionId)} />
      </div>
      <QuoteInvoiceDocument
        clientName={detail.quote.clientName}
        contactName={version.contactName || contact?.name}
        contactPhone={contact?.phone}
        issuedOn={issuedOn}
        issuer={detail.issuer}
        items={items}
        note={version.note}
        subtotalAmount={version.subtotalAmount}
        title={version.title}
        totalAmount={version.totalAmount}
        validUntil={validUntil}
        vatAmount={version.vatAmount}
        vatMode={vatMode}
        versionNumber={version.versionNumber}
      />
    </main>
  );
}
