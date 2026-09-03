import { describe, expect, test } from "vitest";

import { createQuotePdf } from "@/lib/quotes/pdf";

describe("createQuotePdf", () => {
  test("creates a downloadable PDF document", async () => {
    const pdf = await createQuotePdf({
      clientName: "테스트 고객사",
      title: "웹사이트 구축 견적",
      versionNumber: 1,
      items: [{ description: "기획", amount: 100000 }],
      subtotalAmount: 100000,
      vatAmount: 10000,
      totalAmount: 110000,
      note: "부가세 별도 견적입니다.",
    });

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  });
});
