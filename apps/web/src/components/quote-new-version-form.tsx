"use client";

import { saveQuoteVersionAction } from "@/app/(private)/quotes/actions";
import { QuoteCostingComposer } from "@/components/quote-costing-composer";
import {
  packagesFromStoredItems,
  type QuotePackage,
  type QuoteVatMode,
} from "@/lib/domain/quotes";

export function QuoteNewVersionForm({
  quoteId,
  clientId,
  projectId,
  clientName,
  title,
  note,
  vatMode,
  items,
  targetMarginPercent,
  operatingCostPercent,
  nextVersionNumber,
}: {
  quoteId: string;
  clientId: string;
  projectId: string;
  clientName: string;
  title: string;
  note: string;
  vatMode: QuoteVatMode;
  items: unknown;
  targetMarginPercent: number;
  operatingCostPercent: number;
  nextVersionNumber: number;
}) {
  const initialPackages: QuotePackage[] = packagesFromStoredItems(items);

  return (
    <form action={saveQuoteVersionAction} className="quote-form quote-form-costing">
      <input name="quoteId" type="hidden" value={quoteId} />
      <input name="clientId" type="hidden" value={clientId} />
      <input name="projectId" type="hidden" value={projectId} />
      <div className="quote-form-full">
        <QuoteCostingComposer
          clientName={clientName}
          initialOperatingCostPercent={operatingCostPercent}
          initialPackages={initialPackages}
          initialTargetMarginPercent={targetMarginPercent}
          initialTitle={title}
          initialVatMode={vatMode}
          versionNumber={nextVersionNumber}
        />
      </div>
      <input name="note" type="hidden" value={note} />
      <button className="auth-submit" type="submit">
        v{nextVersionNumber} 저장
      </button>
    </form>
  );
}
