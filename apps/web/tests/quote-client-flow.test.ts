import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  countExternalClientRegistrationTrips,
  countReenteredIdentityFields,
  listQuoteDraftMismatches,
  quotePathAfterInlineClientCreate,
} from "@/lib/domain/quote-client-flow";

describe("quote client flow (F01)", () => {
  it("F01-02: sending the founder to /clients to register counts as an external trip", () => {
    expect(countExternalClientRegistrationTrips({ leftQuotesToOpenClients: true })).toBe(1);
  });

  it("F01-02: registering a client inside the quote panel counts as zero external trips", () => {
    expect(countExternalClientRegistrationTrips({ leftQuotesToOpenClients: false })).toBe(0);
    expect(quotePathAfterInlineClientCreate("client-1")).toBe("/quotes?new=1&clientId=client-1");
  });

  it("F01-01: retyping the same client name on the quote form counts as duplicate input", () => {
    expect(
      countReenteredIdentityFields({
        clientNameTypedInRegistration: "가상고객",
        clientNameTypedAgainInQuote: "가상고객",
        contactNameTypedInRegistration: "김담당",
        contactNameTypedAgainInQuote: "김담당",
        projectNameTypedInRegistration: null,
        projectNameTypedAgainInQuote: null,
      }),
    ).toBe(2);
  });

  it("F01-01: selecting the created client by id does not count as re-entry", () => {
    expect(
      countReenteredIdentityFields({
        clientNameTypedInRegistration: "가상고객",
        clientNameTypedAgainInQuote: null,
        contactNameTypedInRegistration: "김담당",
        contactNameTypedAgainInQuote: null,
        projectNameTypedInRegistration: null,
        projectNameTypedAgainInQuote: null,
      }),
    ).toBe(0);
  });

  it("F01-04: saved and reloaded draft snapshots must match on client, items, and total", () => {
    const saved = {
      clientId: "c1",
      clientName: "가상고객",
      projectId: null as string | null,
      title: "가상고객 · 견적",
      itemTitles: ["기획"],
      totalAmount: 110_000,
    };
    expect(listQuoteDraftMismatches(saved, { ...saved })).toEqual([]);
    expect(
      listQuoteDraftMismatches(saved, {
        ...saved,
        clientName: "다른이름",
        totalAmount: 0,
        itemTitles: ["기획", "디자인"],
      }),
    ).toEqual(["clientName", "totalAmount", "itemTitles"]);
  });

  it("F01-02: quotes page opens create without forcing a /clients trip", () => {
    const source = readFileSync(resolve(__dirname, "../src/components/quotes-page-client.tsx"), "utf8");
    expect(source).toContain("createClientFromQuoteAction");
    expect(source).toContain('panelMode === "new-client"');
    expect(source).not.toMatch(/disabled=\{!canCreate\}/);
    expect(source).not.toMatch(/href="\/clients"/);
  });
});
