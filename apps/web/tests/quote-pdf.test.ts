import { describe, expect, test } from "vitest";

import { createQuotePdf } from "@/lib/quotes/pdf";

describe("createQuotePdf", () => {
  test("creates a downloadable PDF document", async () => {
    const issuedOn = new Date("2026-09-04T00:00:00");
    const validUntil = new Date("2026-10-04T00:00:00");
    const pdf = await createQuotePdf({
      clientName: "테스트 고객사",
      contactName: "담당자",
      title: "웹사이트 구축 견적",
      versionNumber: 1,
      items: [
        {
          title: "기획",
          customerDescription: "정보구조·화면 흐름",
          quantity: 1,
          unitPrice: 100000,
          amount: 100000,
        },
      ],
      subtotalAmount: 100000,
      vatAmount: 10000,
      totalAmount: 110000,
      vatMode: "exclusive",
      note: "검토 후 회신 부탁드립니다.",
      issuedOn,
      validUntil,
    });

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  }, 15000);
});
