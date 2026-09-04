import { describe, expect, it } from "vitest";

import {
  quoteIssuerBrandDefaults,
  resolveQuoteIssuerProfile,
} from "@/lib/quotes/issuer";

describe("resolveQuoteIssuerProfile", () => {
  it("fills brand defaults and leaves bank and registration empty when nothing is stored", () => {
    const profile = resolveQuoteIssuerProfile(null);
    expect(profile.brandName).toBe(quoteIssuerBrandDefaults.brandName);
    expect(profile.accentColor).toBe("#e24a1b");
    expect(profile.email).toBe(quoteIssuerBrandDefaults.email);
    expect(profile.legalName).toBe("");
    expect(profile.businessRegistrationNumber).toBe("");
    expect(profile.bankName).toBe("");
    expect(profile.bankAccount).toBe("");
    expect(profile.swift).toBe("");
  });

  it("keeps stored supplier fields without inventing account numbers", () => {
    const profile = resolveQuoteIssuerProfile({
      legalName: "  상호  ",
      bankName: "은행명",
    });
    expect(profile.legalName).toBe("상호");
    expect(profile.bankName).toBe("은행명");
    expect(profile.bankAccount).toBe("");
  });
});
