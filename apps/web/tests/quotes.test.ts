import { describe, expect, it } from "vitest";

import { calculateQuoteAmounts, nextQuoteVersionNumber } from "@/lib/domain/quotes";

describe("quote amounts", () => {
  it("calculates a VAT-exclusive Korean won quote", () => {
    expect(calculateQuoteAmounts([
      { description: "기획", amount: "100000" },
      { description: "디자인", amount: "50000" },
    ])).toEqual({
      items: [
        { description: "기획", amount: 100000 },
        { description: "디자인", amount: 50000 },
      ],
      subtotalAmount: 150000,
      vatAmount: 15000,
      totalAmount: 165000,
      vatMode: "exclusive",
    });
  });

  it("calculates a VAT-inclusive Korean won quote by reversing the tax", () => {
    expect(calculateQuoteAmounts([
      { description: "기획", amount: "110000" },
    ], "inclusive")).toEqual({
      items: [{ description: "기획", amount: 110000 }],
      subtotalAmount: 100000,
      vatAmount: 10000,
      totalAmount: 110000,
      vatMode: "inclusive",
    });
  });

  it("requires at least one positive-priced item", () => {
    expect(() => calculateQuoteAmounts([{ description: "", amount: "0" }])).toThrow("At least one quote item is required");
  });
});

describe("quote versioning", () => {
  it("creates the next immutable version number", () => {
    expect(nextQuoteVersionNumber(2)).toBe(3);
  });
});
