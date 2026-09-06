// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ApprovalsPageClient } from "@/components/approvals-page-client";
import { approvalKindLabels, type ApprovalInboxItem, type ApprovalKind } from "@/lib/domain/approvals";

afterEach(cleanup);

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
  it("kind filter and visible search combine while reset restores the original order and counts", () => {
    render(<ApprovalsPageClient items={items} summary={summary} />);

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
    const { rerender } = render(<ApprovalsPageClient items={items} summary={summary} />);
    fireEvent.change(screen.getByRole("searchbox", { name: "승인 항목 검색" }), { target: { value: "없는 항목" } });
    expect(screen.getByText("검색하거나 고른 분류에 맞는 항목이 없습니다.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "필터 초기화" })).toBeTruthy();

    rerender(<ApprovalsPageClient items={[]} summary={{ total: 0, byKind: Object.fromEntries(kinds.map((kind) => [kind, 0])) as Record<ApprovalKind, number> }} />);
    expect(screen.getByText("지금 승인할 항목이 없습니다.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "대시보드로 이동" }).getAttribute("href")).toBe("/dashboard");
  });

  it("keeps each kind's date meaning, amounts, detail, guides, and read-only boundary explicit", () => {
    render(<ApprovalsPageClient items={items} summary={summary} />);

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
