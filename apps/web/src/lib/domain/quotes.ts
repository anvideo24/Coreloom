export type QuoteItemInput = { description: string; amount: string };
export type QuoteItem = { description: string; amount: number };
export const quoteVatModes = ["exclusive", "inclusive"] as const;
export type QuoteVatMode = (typeof quoteVatModes)[number];

export const quoteVatModeLabels: Record<QuoteVatMode, string> = {
  exclusive: "부가세 별도",
  inclusive: "부가세 포함",
};

export function normalizeQuoteVatMode(value: string | undefined): QuoteVatMode {
  const trimmed = value?.trim() || "exclusive";
  if (!(quoteVatModes as readonly string[]).includes(trimmed)) throw new Error("Unsupported VAT mode");
  return trimmed as QuoteVatMode;
}

export function calculateQuoteAmounts(
  inputs: QuoteItemInput[],
  vatMode: QuoteVatMode = "exclusive",
): {
  items: QuoteItem[];
  subtotalAmount: number;
  vatAmount: number;
  totalAmount: number;
  vatMode: QuoteVatMode;
} {
  const items = inputs
    .map((item) => ({ description: item.description.trim(), amount: Number(item.amount) }))
    .filter((item) => item.description || item.amount);

  if (items.length === 0 || items.some((item) => !item.description || !Number.isInteger(item.amount) || item.amount <= 0)) {
    throw new Error("At least one quote item is required");
  }

  const sum = items.reduce((total, item) => total + item.amount, 0);
  if (vatMode === "inclusive") {
    const subtotalAmount = Math.round(sum / 1.1);
    const vatAmount = sum - subtotalAmount;
    return { items, subtotalAmount, vatAmount, totalAmount: sum, vatMode };
  }

  const subtotalAmount = sum;
  const vatAmount = Math.round(subtotalAmount * 0.1);
  return { items, subtotalAmount, vatAmount, totalAmount: subtotalAmount + vatAmount, vatMode };
}

export function nextQuoteVersionNumber(latestVersionNumber: number): number {
  return latestVersionNumber + 1;
}
