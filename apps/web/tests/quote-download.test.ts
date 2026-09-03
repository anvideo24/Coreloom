import { describe, expect, test } from "vitest";

import { quotePdfDownloadPath } from "@/lib/quotes/download";

describe("quotePdfDownloadPath", () => {
  test("returns the version-specific PDF download route", () => {
    expect(quotePdfDownloadPath("quote-id", "version-id")).toBe("/quotes/quote-id/versions/version-id/download");
  });
});
