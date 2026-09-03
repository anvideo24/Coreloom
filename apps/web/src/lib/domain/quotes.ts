export type QuoteItemInput = { description: string; amount: string };
export type QuoteItem = { description: string; amount: number };

export function calculateQuoteAmounts(inputs: QuoteItemInput[]): {
  items: QuoteItem[];
  subtotalAmount: number;
  vatAmount: number;
  totalAmount: number;
} {
  const items = inputs
    .map((item) => ({ description: item.description.trim(), amount: Number(item.amount) }))
    .filter((item) => item.description || item.amount);

  if (items.length === 0 || items.some((item) => !item.description || !Number.isInteger(item.amount) || item.amount <= 0)) {
    throw new Error("At least one quote item is required");
  }

  const subtotalAmount = items.reduce((total, item) => total + item.amount, 0);
  const vatAmount = Math.round(subtotalAmount * 0.1);
  return { items, subtotalAmount, vatAmount, totalAmount: subtotalAmount + vatAmount };
}

export function nextQuoteVersionNumber(latestVersionNumber: number): number {
  return latestVersionNumber + 1;
}
