import { describe, expect, test } from "vitest";

import { createBillingPdf } from "@/lib/billings/pdf";

describe("createBillingPdf", () => {
  test("creates a downloadable invoice PDF", async () => {
    const pdf = await createBillingPdf({
      clientName: "테스트 고객사",
      contractTitle: "사이트 구축",
      kindLabel: "착수금",
      billingDate: "2026-09-10",
      dueDate: "2026-09-20",
      subtotalAmount: 3000,
      vatAmount: 300,
      totalAmount: 3300,
      note: "부가세 별도 청구입니다.",
    });

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  }, 15000);
});
