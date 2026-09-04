import { describe, expect, it } from "vitest";

import {
  calculatePackageCostAmount,
  calculateQuoteAmounts,
  calculateQuoteCosting,
  nextQuoteVersionNumber,
  normalizeStoredQuoteItemsForPdf,
  packagesFromStoredItems,
  suggestCustomerSupplyAmount,
} from "@/lib/domain/quotes";

describe("quote amounts", () => {
  it("calculates a VAT-exclusive Korean won quote from simple items", () => {
    const result = calculateQuoteAmounts([
      { description: "기획", amount: "100000" },
      { description: "디자인", amount: "50000" },
    ]);
    expect(result.subtotalAmount).toBe(150000);
    expect(result.vatAmount).toBe(15000);
    expect(result.totalAmount).toBe(165000);
    expect(result.vatMode).toBe("exclusive");
    expect(result.customerItems).toEqual([
      { title: "기획", customerDescription: "", amount: 100000 },
      { title: "디자인", customerDescription: "", amount: 50000 },
    ]);
  });

  it("calculates a VAT-inclusive Korean won quote by reversing the tax", () => {
    const result = calculateQuoteAmounts([{ description: "기획", amount: "110000" }], "inclusive");
    expect(result.subtotalAmount).toBe(100000);
    expect(result.vatAmount).toBe(10000);
    expect(result.totalAmount).toBe(110000);
    expect(result.vatMode).toBe("inclusive");
  });

  it("requires a package title and positive amount", () => {
    expect(() => calculateQuoteAmounts([{ description: "", amount: "0" }])).toThrow("Package title is required");
  });
});

describe("quote costing", () => {
  it("derives package cost from rate, months, headcount and utilization", () => {
    expect(
      calculatePackageCostAmount({
        monthlyRate: 6_000_000,
        months: 2,
        headcount: 1,
        utilizationPercent: 50,
      }),
    ).toBe(6_000_000);
  });

  it("suggests customer supply from cost, operating load and margin", () => {
    // 10_000_000 * 1.1 / 0.7 ≈ 15_714_286
    expect(suggestCustomerSupplyAmount(10_000_000, 30, 10)).toBe(15_714_286);
  });

  it("recalculates unlocked packages when margin changes", () => {
    const result = calculateQuoteCosting({
      vatMode: "exclusive",
      targetMarginPercent: 30,
      operatingCostPercent: 10,
      packages: [
        {
          title: "개발",
          customerDescription: "웹 구축",
          monthlyRate: 6_000_000,
          months: 1,
          headcount: 1,
          utilizationPercent: 100,
          amountLocked: false,
        },
      ],
    });
    expect(result.costAmount).toBe(6_000_000);
    expect(result.subtotalAmount).toBe(suggestCustomerSupplyAmount(6_000_000, 30, 10));
    expect(result.customerItems[0]).toEqual({
      title: "개발",
      customerDescription: "웹 구축",
      amount: result.subtotalAmount,
    });
    expect(result.items[0].monthlyRate).toBe(6_000_000);
  });

  it("keeps locked customer amounts", () => {
    const result = calculateQuoteCosting({
      packages: [
        {
          title: "개발",
          amount: 20_000_000,
          monthlyRate: 6_000_000,
          months: 1,
          headcount: 1,
          utilizationPercent: 100,
          amountLocked: true,
        },
      ],
    });
    expect(result.subtotalAmount).toBe(20_000_000);
  });
});

describe("stored quote items", () => {
  it("maps legacy description rows for PDF", () => {
    expect(normalizeStoredQuoteItemsForPdf([{ description: "기획", amount: 100000 }])).toEqual([
      { title: "기획", customerDescription: "", amount: 100000 },
    ]);
  });

  it("restores packages from stored version JSON", () => {
    const packages = packagesFromStoredItems([
      { description: "기획", amount: 100000 },
      {
        title: "개발",
        customerDescription: "설명",
        amount: 9_428_571,
        role: "시니어",
        monthlyRate: 6_000_000,
        months: 1,
        headcount: 1,
        utilizationPercent: 100,
        costAmount: 6_000_000,
        amountLocked: false,
      },
    ]);
    expect(packages[0].title).toBe("기획");
    expect(packages[0].amountLocked).toBe(true);
    expect(packages[1].title).toBe("개발");
    expect(packages[1].amountLocked).toBe(false);
  });
});

describe("quote versioning", () => {
  it("creates the next immutable version number", () => {
    expect(nextQuoteVersionNumber(2)).toBe(3);
  });
});
