"use client";

import { saveQuoteVersionAction } from "@/app/(private)/quotes/actions";
import {
  QuoteCostingComposer,
  type QuoteComposerContact,
  type QuoteComposerVersion,
} from "@/components/quote-costing-composer";
import {
  packagesFromStoredItems,
  toDateInputValue,
  type QuotePackage,
  type QuoteVatMode,
} from "@/lib/domain/quotes";

export function QuoteNewVersionForm({
  quoteId,
  clientId,
  projectId,
  clientName,
  contacts,
  title,
  note,
  vatMode,
  items,
  targetMarginPercent,
  operatingCostPercent,
  nextVersionNumber,
  issuedOn,
  validUntil,
  clientContactId,
  versions,
  issuer,
}: {
  quoteId: string;
  clientId: string;
  projectId: string;
  clientName: string;
  contacts: QuoteComposerContact[];
  title: string;
  note: string;
  vatMode: QuoteVatMode;
  items: unknown;
  targetMarginPercent: number;
  operatingCostPercent: number;
  nextVersionNumber: number;
  issuedOn?: Date | string | null;
  validUntil?: Date | string | null;
  clientContactId?: string | null;
  versions?: QuoteComposerVersion[];
  issuer?: import("@/lib/quotes/issuer").QuoteIssuerProfile | null;
}) {
  const initialPackages: QuotePackage[] = packagesFromStoredItems(items);
  const issuedValue =
    issuedOn instanceof Date
      ? toDateInputValue(issuedOn)
      : typeof issuedOn === "string" && issuedOn
        ? toDateInputValue(new Date(issuedOn))
        : undefined;
  const validValue =
    validUntil instanceof Date
      ? toDateInputValue(validUntil)
      : typeof validUntil === "string" && validUntil
        ? toDateInputValue(new Date(validUntil))
        : undefined;

  return (
    <form action={saveQuoteVersionAction} className="quote-form quote-form-costing">
      <input name="quoteId" type="hidden" value={quoteId} />
      <input name="clientId" type="hidden" value={clientId} />
      <input name="projectId" type="hidden" value={projectId} />
      <div className="quote-form-full">
        <QuoteCostingComposer
          clientId={clientId}
          clientName={clientName}
          contacts={contacts}
          initialClientContactId={clientContactId ?? ""}
          initialIssuedOn={issuedValue}
          initialNote={note}
          initialOperatingCostPercent={operatingCostPercent}
          initialPackages={initialPackages}
          initialTargetMarginPercent={targetMarginPercent}
          initialTitle={title}
          initialValidUntil={validValue}
          initialVatMode={vatMode}
          issuer={issuer}
          versionNumber={nextVersionNumber}
          versions={versions}
        />
      </div>
      <button className="auth-submit" type="submit">
        v{nextVersionNumber} 저장
      </button>
    </form>
  );
}
