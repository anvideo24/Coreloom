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
      <label className="quote-form-full">
        견적명
        <input defaultValue={title} name="title" required />
      </label>
      <div className="quote-form-full">
        <QuoteCostingComposer
          initialOperatingCostPercent={operatingCostPercent}
          initialPackages={initialPackages}
          initialTargetMarginPercent={targetMarginPercent}
          initialVatMode={vatMode}
        />
      </div>
      <label className="quote-form-full">
        메모 (선택)
        <textarea defaultValue={note} name="note" />
      </label>
      <button className="auth-submit" type="submit">
        v{nextVersionNumber} 저장
      </button>
    </form>
  );
}
