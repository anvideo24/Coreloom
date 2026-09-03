import { describe, expect, test } from "vitest";

import { normalizeQuoteEmailDraft } from "@/lib/domain/quote-email";

describe("normalizeQuoteEmailDraft", () => {
  test("keeps a representative-approved recipient, subject, and message", () => {
    expect(normalizeQuoteEmailDraft({ recipient: " client@example.com ", subject: " 견적서 전달드립니다 ", message: " 안녕하세요. 첨부드립니다. ", approved: true })).toEqual({ recipient: "client@example.com", subject: "견적서 전달드립니다", message: "안녕하세요. 첨부드립니다." });
  });

  test("rejects an unapproved or invalid send request", () => {
    expect(() => normalizeQuoteEmailDraft({ recipient: "not-an-email", subject: "견적", message: "내용", approved: false })).toThrow("Representative approval is required");
  });
});
