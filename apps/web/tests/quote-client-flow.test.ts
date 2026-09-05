import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  countExternalClientRegistrationTrips,
  countReenteredIdentityFields,
  InputTally,
  listQuoteDraftMismatches,
  quotePathAfterInlineClientCreate,
  reductionRate,
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

describe("InputTally (F01-03 measuring tool) — the counter is tested before it is trusted", () => {
  it("starts at zero", () => {
    const tally = new InputTally();
    expect(tally.directFieldCount).toBe(0);
    expect(tally.repeatedFieldCount).toBe(0);
    expect(tally.transitionCounts()).toEqual({ page: 0, panel: 0, tab: 0, total: 0 });
  });

  it("counts every fillField call once, regardless of kind", () => {
    const tally = new InputTally();
    tally.fillField("상호", "text");
    tally.fillField("과세 유형", "select");
    tally.fillField("taxInvoiceRecipient", "checkbox");
    expect(tally.directFieldCount).toBe(3);
    expect(tally.fieldNames()).toEqual(["상호", "과세 유형", "taxInvoiceRecipient"]);
  });

  it("only fields explicitly marked repeat=true count as repeated, and they are a subset of direct fields", () => {
    const tally = new InputTally();
    tally.fillField("상호", "text");
    tally.fillField("상호 (견적 화면에서 다시)", "text", { repeat: true });
    expect(tally.directFieldCount).toBe(2);
    expect(tally.repeatedFieldCount).toBe(1);
  });

  it("selecting an id from a dropdown can be counted as a direct field without being a repeat", () => {
    // countReenteredIdentityFields already established: 선택은 재입력이 아니다.
    // InputTally도 같은 구분을 지킨다 — repeat 플래그를 안 주면 반복으로 세지 않는다.
    const tally = new InputTally();
    tally.fillField("고객사 선택", "select");
    expect(tally.directFieldCount).toBe(1);
    expect(tally.repeatedFieldCount).toBe(0);
  });

  it("classifies transitions into page/panel/tab and sums them independently", () => {
    const tally = new InputTally();
    tally.recordTransition("panel", "새 고객사 패널 열기");
    tally.recordTransition("page", "/clients → /quotes");
    tally.recordTransition("page", "/clients 등록 후 상세로 리다이렉트");
    tally.recordTransition("tab", "내부 원가 탭");
    expect(tally.transitionCounts()).toEqual({ page: 2, panel: 1, tab: 1, total: 4 });
    expect(tally.transitionLabels()).toEqual([
      "panel:새 고객사 패널 열기",
      "page:/clients → /quotes",
      "page:/clients 등록 후 상세로 리다이렉트",
      "tab:내부 원가 탭",
    ]);
  });

  it("two independently-used tallies never share state", () => {
    const a = new InputTally();
    const b = new InputTally();
    a.fillField("상호", "text");
    a.recordTransition("panel", "열기");
    expect(b.directFieldCount).toBe(0);
    expect(b.transitionCounts().total).toBe(0);
  });
});

describe("reductionRate (F01-03 measuring tool)", () => {
  it("computes (baseline - improved) / baseline", () => {
    expect(reductionRate(3, 2)).toBeCloseTo(1 / 3);
    expect(reductionRate(10, 7)).toBeCloseTo(0.3);
    expect(reductionRate(10, 10)).toBe(0);
  });

  it("does not divide by zero or go negative-infinite when baseline is 0", () => {
    expect(reductionRate(0, 0)).toBe(0);
    expect(reductionRate(0, 5)).toBe(0);
  });

  it("goes negative when the 'improved' path needs more fields than baseline (regression, not a crash)", () => {
    expect(reductionRate(2, 3)).toBeCloseTo(-0.5);
  });
});
