// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApprovalsPageClient } from "@/components/approvals-page-client";
import { approvalKindLabels, type ApprovalInboxItem, type ApprovalKind } from "@/lib/domain/approvals";
import { approvalNavigationStorageKey, serializeApprovalNavigation } from "@/lib/domain/approval-navigation";

afterEach(cleanup);
const scrollIntoView = vi.fn();
beforeEach(() => {
  window.sessionStorage.clear();
  scrollIntoView.mockReset();
  Object.defineProperty(HTMLAnchorElement.prototype, "scrollIntoView", { configurable: true, value: scrollIntoView });
});

const kinds: ApprovalKind[] = ["expense", "revenue", "billing", "contract", "proposal", "agent_work"];

const items: ApprovalInboxItem[] = kinds.map((kind, index) => ({
  id: kind,
  kind,
  kindLabel: approvalKindLabels[kind],
  href: `/detail/${kind}`,
  title: `${approvalKindLabels[kind]} 제목`,
  detail: `${kind} 원문 근거`,
  when: "",
  ...(kind === "expense" ? { amount: 0, when: "2026-09-10" } : {}),
  ...(kind === "revenue" ? { amount: 120000, when: "2026-09-11" } : {}),
  ...(kind === "billing" ? { amount: 300000, when: "2026-09-12" } : {}),
  ...(kind === "agent_work" ? { when: "2026-09-13" } : {}),
  ...(index > 2 && kind !== "agent_work" ? { when: "" } : {}),
}));

const summary = {
  total: items.length,
  byKind: Object.fromEntries(kinds.map((kind) => [kind, 1])) as Record<ApprovalKind, number>,
};

describe("ApprovalsPageClient", () => {
  it("returns with search only without putting the search in its URL", async () => {
    window.sessionStorage.setItem(approvalNavigationStorageKey("founder-a"), serializeApprovalNavigation({ scopeId: "founder-a", query: "매출", selectedKind: null }));
    render(<ApprovalsPageClient items={items} scopeId="founder-a" summary={summary} />);
    expect((await screen.findByRole("searchbox", { name: "승인 항목 검색" }) as HTMLInputElement).value).toBe("매출");
    expect(screen.getByRole("link", { name: "매출 확정 제목 상세 검토" }).getAttribute("href")).not.toContain("?");
  });

  it("returns with kind only", async () => {
    window.sessionStorage.setItem(approvalNavigationStorageKey("founder-a"), serializeApprovalNavigation({ scopeId: "founder-a", query: "", selectedKind: "expense" }));
    render(<ApprovalsPageClient items={items} scopeId="founder-a" summary={summary} />);
    expect((await screen.findByRole("button", { name: "비용 확정 1건" })).getAttribute("aria-pressed")).toBe("true");
  });

  it("returns from a detail link with combined filters and scrolls only to its inspected item", async () => {
    const { unmount } = render(<ApprovalsPageClient items={items} scopeId="founder-a" summary={summary} />);
    const search = screen.getByRole("searchbox", { name: "승인 항목 검색" });
    fireEvent.change(search, { target: { value: "매출" } });
    fireEvent.click(screen.getByRole("button", { name: "매출 확정 1건" }));
    const detailLink = screen.getByRole("link", { name: "매출 확정 제목 상세 검토" });
    detailLink.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(detailLink);
    unmount();

    render(<ApprovalsPageClient items={items} scopeId="founder-a" summary={summary} />);
    const restoredSearch = await screen.findByRole("searchbox", { name: "승인 항목 검색" });
    expect((restoredSearch as HTMLInputElement).value).toBe("매출");
    expect(screen.getByRole("button", { name: "매출 확정 1건" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("link", { name: "매출 확정 제목 상세 검토" }).getAttribute("href")).toBe("/detail/revenue");
    expect(screen.getByRole("link", { name: "매출 확정 제목 상세 검토" }).getAttribute("href")).not.toContain("?");
    await screen.findByRole("link", { name: "매출 확정 제목 상세 검토" });
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "center" });
  });

  it("keeps filters but does not scroll when the inspected item no longer exists", async () => {
    window.sessionStorage.setItem(approvalNavigationStorageKey("founder-a"), serializeApprovalNavigation({
      scopeId: "founder-a", query: "매출", selectedKind: "revenue", inspectedItemId: "removed:item", inspectedPosition: 1,
    }));
    render(<ApprovalsPageClient items={items} scopeId="founder-a" summary={summary} />);
    expect((await screen.findByRole("searchbox", { name: "승인 항목 검색" }) as HTMLInputElement).value).toBe("매출");
    expect(screen.getByRole("button", { name: "매출 확정 1건" }).getAttribute("aria-pressed")).toBe("true");
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("keeps an empty-result search after return", async () => {
    window.sessionStorage.setItem(approvalNavigationStorageKey("founder-a"), serializeApprovalNavigation({ scopeId: "founder-a", query: "없는 항목", selectedKind: null }));
    render(<ApprovalsPageClient items={items} scopeId="founder-a" summary={summary} />);
    expect(await screen.findByText("검색하거나 고른 분류에 맞는 항목이 없습니다.")).toBeTruthy();
  });

  it("does not carry a previous founder's state into a same-place founder switch", async () => {
    window.sessionStorage.setItem(approvalNavigationStorageKey("founder-a"), serializeApprovalNavigation({ scopeId: "founder-a", query: "매출", selectedKind: "revenue" }));
    const { rerender } = render(<ApprovalsPageClient items={items} scopeId="founder-a" summary={summary} />);
    expect((await screen.findByRole("searchbox", { name: "승인 항목 검색" }) as HTMLInputElement).value).toBe("매출");
    rerender(<ApprovalsPageClient items={items} scopeId="founder-b" summary={summary} />);
    expect((await screen.findByRole("searchbox", { name: "승인 항목 검색" }) as HTMLInputElement).value).toBe("");
    expect(window.sessionStorage.getItem(approvalNavigationStorageKey("founder-b"))).not.toContain("매출");
  });

  it("keeps the inbox usable when the saved navigation is corrupt", async () => {
    window.sessionStorage.setItem(approvalNavigationStorageKey("founder-a"), "{");
    render(<ApprovalsPageClient items={items} scopeId="founder-a" summary={summary} />);
    expect(await screen.findByText("표시 6건 / 전체 6건")).toBeTruthy();
  });

  it("keeps the inbox usable when session storage is denied", async () => {
    const denied = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("denied"); });
    try {
      render(<ApprovalsPageClient items={items} scopeId="founder-a" summary={summary} />);
      expect(await screen.findByText("표시 6건 / 전체 6건")).toBeTruthy();
    } finally {
      denied.mockRestore();
    }
  });

  it("kind filter and visible search combine while reset restores the original order and counts", () => {
    render(<ApprovalsPageClient items={items} scopeId="founder-a" summary={summary} />);

    const search = screen.getByRole("searchbox", { name: "승인 항목 검색" });
    expect(search.getAttribute("placeholder")).toBe("제목 또는 표시된 내용 검색");
    expect(screen.getByText("표시 6건 / 전체 6건")).toBeTruthy();
    expect(screen.getByRole("group", { name: "승인 종류 필터" })).toBeTruthy();
    for (const kind of kinds) {
      const button = screen.getByRole("button", { name: `${approvalKindLabels[kind]} 1건` });
      expect(button.getAttribute("aria-pressed")).toBe("false");
      fireEvent.click(button);
      expect(button.getAttribute("aria-pressed")).toBe("true");
      expect(screen.getByText("표시 1건 / 전체 6건")).toBeTruthy();
      expect(screen.getAllByRole("link", { name: /상세 검토$/ }).map((link) => link.getAttribute("href"))).toEqual([`/detail/${kind}`]);
    }
    fireEvent.click(screen.getByRole("button", { name: "비용 확정 1건" }));
    fireEvent.change(search, { target: { value: "제목" } });
    expect(screen.getByText("표시 1건 / 전체 6건")).toBeTruthy();
    expect(screen.getByRole("link", { name: "비용 확정 제목 상세 검토" }).getAttribute("href")).toBe("/detail/expense");

    fireEvent.click(screen.getByRole("button", { name: "필터 초기화" }));
    expect((screen.getByRole("searchbox", { name: "승인 항목 검색" }) as HTMLInputElement).value).toBe("");
    expect(screen.getByText("표시 6건 / 전체 6건")).toBeTruthy();
    expect(screen.getAllByRole("link", { name: /상세 검토$/ }).map((link) => link.getAttribute("href"))).toEqual(items.map((item) => item.href));
  });

  it("distinguishes no matching results from a genuinely empty inbox", () => {
    const { rerender } = render(<ApprovalsPageClient items={items} scopeId="founder-a" summary={summary} />);
    fireEvent.change(screen.getByRole("searchbox", { name: "승인 항목 검색" }), { target: { value: "없는 항목" } });
    expect(screen.getByText("검색하거나 고른 분류에 맞는 항목이 없습니다.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "필터 초기화" })).toBeTruthy();

    rerender(<ApprovalsPageClient items={[]} scopeId="founder-a" summary={{ total: 0, byKind: Object.fromEntries(kinds.map((kind) => [kind, 0])) as Record<ApprovalKind, number> }} />);
    expect(screen.getByText("지금 승인할 항목이 없습니다.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "대시보드로 이동" }).getAttribute("href")).toBe("/dashboard");
  });

  it("keeps each kind's date meaning, amounts, detail, guides, and read-only boundary explicit", () => {
    render(<ApprovalsPageClient items={items} scopeId="founder-a" summary={summary} />);

    expect(screen.getByText("지급 예정 2026-09-10")).toBeTruthy();
    expect(screen.getByText("정산일 2026-09-11")).toBeTruthy();
    expect(screen.getByText("입금 예정 2026-09-12")).toBeTruthy();
    expect(screen.getByText("요청일 2026-09-13")).toBeTruthy();
    expect(within(screen.getByRole("link", { name: "비용 확정 제목 상세 검토" })).getByText("0원")).toBeTruthy();
    expect(within(screen.getByRole("link", { name: "매출 확정 제목 상세 검토" })).getByText("120,000원")).toBeTruthy();
    const contractRow = within(screen.getByRole("link", { name: "계약 체결 제목 상세 검토" }));
    expect(contractRow.queryByText("0원")).toBeNull();
    expect(contractRow.queryByRole("strong")).toBeNull();
    expect(screen.getByText("expense 원문 근거")).toBeTruthy();
    expect(screen.getByText("증빙·금액")).toBeTruthy();
    expect(screen.getByText("정산 근거·금액")).toBeTruthy();
    expect(screen.getByText("실제 입금·청구 금액")).toBeTruthy();
    expect(screen.getByText("날인 원본·계약 조건")).toBeTruthy();
    expect(screen.getByText("원문 근거·제안 내용")).toBeTruthy();
    expect(screen.getByText("요청 내용·허용 업무")).toBeTruthy();
    expect(screen.getByText("대상과 근거를 확인한 뒤, 각 상세 화면에서 결정하세요.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /승인|반려/ })).toBeNull();
    expect(screen.queryByText(/확인됨|검증됨/)).toBeNull();
  });
});
