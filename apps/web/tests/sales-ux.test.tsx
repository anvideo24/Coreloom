// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ClientCompanyFields } from "@/components/client-company-fields";
import { QuoteCostingComposer } from "@/components/quote-costing-composer";
import { ClientsPageClient } from "@/components/clients-page-client";
import { QuotesPageClient } from "@/components/quotes-page-client";
import { resolveQuoteIssuerProfile } from "@/lib/quotes/issuer";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/clients",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/app/(private)/clients-projects/actions", () => ({ createClientAction: vi.fn() }));
vi.mock("@/app/(private)/quotes/actions", () => ({ saveQuoteVersionAction: vi.fn() }));

describe("sales UX", () => {
  afterEach(cleanup);
  it("생성 폼은 필수 두 칸을 먼저 보이고 접힌 입력을 FormData에 보존한다", () => {
    const { container } = render(<form><ClientCompanyFields includeFirstContact progressiveDetails /></form>);
    expect(screen.getByPlaceholderText("예: 주식회사 예시")).toBeTruthy();
    expect(screen.getByLabelText("거래 유형")).toBeTruthy();
    const formData = new FormData(container.querySelector("form")!);
    expect(formData.has("businessRegistrationNumber")).toBe(true);
    expect(formData.has("phone")).toBe(true);
    expect(formData.has("contactName")).toBe(true);
  });

  it("접힌 invalid 그룹만 자동으로 펼친다", () => {
    const { container } = render(<form><ClientCompanyFields includeFirstContact progressiveDetails /></form>);
    const details = container.querySelectorAll("details");
    const email = container.querySelector('input[name="email"]') as HTMLInputElement;
    email.setCustomValidity("invalid");
    fireEvent.invalid(email);
    expect(details[0].open).toBe(false);
    expect(details[1].open).toBe(true);
  });

  it("새 견적은 initialTab으로 내부 원가 편집에서 시작한다", () => {
    render(<QuoteCostingComposer initialTab="internal" />);
    expect(screen.getByRole("tab", { name: "내부 원가 · 편집" }).getAttribute("aria-selected")).toBe("true");
  });

  it("고객사 검색은 결과 개수와 빈 결과를 표시한다", () => {
    render(<ClientsPageClient draftScopeId="test" clients={[{ id: "1", name: "알파", businessRegistrationNumber: null, representativeName: null, taxType: null, tradeKind: "sales", contactCount: 0, projectCount: 0 }, { id: "2", name: "베타", businessRegistrationNumber: null, representativeName: null, taxType: null, tradeKind: "sales", contactCount: 0, projectCount: 0 }]} />);
    fireEvent.change(screen.getByRole("textbox", { name: "고객사 검색" }), { target: { value: "감마" } });
    expect(screen.getByText("검색 결과가 없습니다.")).toBeTruthy();
    expect(screen.getByText("0개 / 전체 2개")).toBeTruthy();
  });

  it("견적 검색은 고객사와 주제 양쪽을 찾고 빈 결과를 표시한다", () => {
    render(<QuotesPageClient clients={[]} projects={[]} contacts={[]} issuer={resolveQuoteIssuerProfile(null)} draftScopeId="test" versions={[
      { quoteId: "1", versionId: "v1", versionNumber: 1, title: "테스트 디자인", clientName: "알파", totalAmount: 100 },
      { quoteId: "2", versionId: "v2", versionNumber: 1, title: "테스트 개발", clientName: "베타", totalAmount: 200 },
    ]} />);
    const search = screen.getByRole("textbox", { name: "고객사명·견적 주제 검색" });
    for (const query of ["알파", "디자인"]) {
      fireEvent.change(search, { target: { value: query } });
      expect(screen.getByText("1개 / 전체 2개")).toBeTruthy();
      expect(screen.getByRole("heading", { name: "테스트 디자인" })).toBeTruthy();
      expect(screen.queryByRole("heading", { name: "테스트 개발" })).toBeNull();
    }
    fireEvent.change(search, { target: { value: "없는 항목" } });
    expect(screen.getByText("검색 결과가 없습니다.")).toBeTruthy();
  });
});
