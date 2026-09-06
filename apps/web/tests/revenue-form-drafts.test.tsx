// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { RevenuePageClient } from "@/components/revenue-page-client";
import { formDraftStorageKey } from "@/lib/domain/form-draft";

const mocks = vi.hoisted(() => ({
  createRevenueEntryAction: vi.fn(),
  createVentureAction: vi.fn(),
  params: new URLSearchParams(),
  replace: vi.fn((href: string) => { mocks.params = new URLSearchParams(href.split("?")[1] ?? ""); }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
  usePathname: () => "/revenue",
  useSearchParams: () => mocks.params,
}));
vi.mock("@/app/(private)/revenue/actions", () => ({
  createRevenueEntryAction: mocks.createRevenueEntryAction,
  createVentureAction: mocks.createVentureAction,
}));

const props = {
  accounts: [{ id: "account-1", code: "410", name: "구독 매출" }],
  projects: [{ id: "project-1", clientName: "알파", name: "홈페이지" }],
  rows: [],
  summary: { confirmedAmount: 0, refundedAmount: 0, scheduledAmount: 0, unclassifiedCount: 0 },
  ventures: [{ id: "venture-1", kind: "app" as const, name: "기존 앱" }],
};

function renderRevenue(scopeId = "founder-a") {
  return render(<RevenuePageClient {...props} draftScopeId={scopeId} />);
}

function setSearch(search: string) {
  mocks.params = new URLSearchParams(search);
}

async function open(mode: "1" | "venture", scopeId = "founder-a") {
  setSearch(`new=${mode}`);
  renderRevenue(scopeId);
  await screen.findByRole("dialog", { name: mode === "1" ? "매출 등록" : "사업 등록" });
}

class RouteSegmentErrorBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <p role="alert">UX-SYNTHETIC-SAVE-FAILURE-SCREEN</p> : this.props.children; }
}

function revenueClient(scopeId = "founder-a") { return <RevenuePageClient {...props} draftScopeId={scopeId} key={scopeId} />; }

async function openFromMenu(label: "매출 등록" | "사업 등록") {
  fireEvent.click(screen.getByRole("button", { name: "새로 만들기" }));
  fireEvent.click(screen.getByRole("menuitem", { name: label }));
  await screen.findByRole("dialog", { name: label });
}

function fillRevenue() {
  fireEvent.change(screen.getByLabelText("고객사 프로젝트 (선택)"), { target: { value: "project-1" } });
  fireEvent.change(screen.getByLabelText("계정과목 (선택)"), { target: { value: "account-1" } });
  fireEvent.change(screen.getByLabelText("금액 (원)"), { target: { value: "120000" } });
  fireEvent.change(screen.getByLabelText("발생일"), { target: { value: "2026-09-06" } });
  fireEvent.change(screen.getByLabelText("정산일"), { target: { value: "2026-09-08" } });
}
function expectRevenueRestored() {
  expect((screen.getByLabelText("고객사 프로젝트 (선택)") as HTMLSelectElement).value).toBe("project-1");
  expect((screen.getByLabelText("계정과목 (선택)") as HTMLSelectElement).value).toBe("account-1");
  expect((screen.getByLabelText("금액 (원)") as HTMLInputElement).value).toBe("120000");
  expect((screen.getByLabelText("발생일") as HTMLInputElement).value).toBe("2026-09-06");
  expect((screen.getByLabelText("정산일") as HTMLInputElement).value).toBe("2026-09-08");
}
function fillVenture() {
  fireEvent.change(screen.getByLabelText("사업명"), { target: { value: "새 구독" } });
  fireEvent.change(screen.getByLabelText("종류"), { target: { value: "subscription" } });
}
function expectVentureRestored() {
  expect((screen.getByLabelText("사업명") as HTMLInputElement).value).toBe("새 구독");
  expect((screen.getByLabelText("종류") as HTMLSelectElement).value).toBe("subscription");
}

beforeEach(() => {
  setSearch("");
  mocks.replace.mockClear();
  mocks.createRevenueEntryAction.mockReset();
  mocks.createVentureAction.mockReset();
  sessionStorage.clear();
});

afterEach(cleanup);

describe("매출 생성 폼 초안", () => {
  it.each([
    ["매출", "1", "매출 등록", fillRevenue, expectRevenueRestored],
    ["사업", "venture", "사업 등록", fillVenture, expectVentureRestored],
  ] as const)("%s은 같은 mounted 페이지에서 헤더 닫기 후 생성 메뉴로 재열어 복원한다", async (_label, mode, label, fill, expectRestored) => {
    await open(mode);
    fill();
    fireEvent.click(screen.getAllByRole("button", { name: "작성 닫기" }).at(-1)!);
    expect(screen.queryByRole("dialog")).toBeNull();
    await openFromMenu(label);
    await waitFor(expectRestored);
  });

  it.each([
    ["매출", "1", "매출 등록", fillRevenue, expectRevenueRestored],
    ["사업", "venture", "사업 등록", fillVenture, expectVentureRestored],
  ] as const)("%s은 새로고침 remount 뒤 선택값까지 복원한다", async (_label, mode, title, fill, expectRestored) => {
    const first = await (async () => { setSearch(`new=${mode}`); return renderRevenue(); })();
    await screen.findByRole("dialog", { name: title }); fill(); first.unmount(); cleanup();
    renderRevenue(); await screen.findByRole("dialog", { name: title }); await waitFor(expectRestored);
  });

  it.each([
    ["매출", "1", "venture", "매출 등록", "사업 등록", fillRevenue, expectRevenueRestored],
    ["사업", "venture", "1", "사업 등록", "매출 등록", fillVenture, expectVentureRestored],
  ] as const)("%s은 다른 폼을 거쳐 돌아온 remount 뒤에도 복원한다", async (_label, mode, otherMode, title, otherTitle, fill, expectRestored) => {
    await open(mode); fill(); cleanup(); await open(otherMode); await screen.findByRole("dialog", { name: otherTitle }); cleanup();
    await open(mode); await screen.findByRole("dialog", { name: title }); await waitFor(expectRestored);
  });

  it.each([
    ["매출", "1", "매출 등록", "revenue-create", fillRevenue, expectRevenueRestored, mocks.createRevenueEntryAction],
    ["사업", "venture", "사업 등록", "venture-create", fillVenture, expectVentureRestored, mocks.createVentureAction],
  ] as const)("%s은 성공한 저장 뒤 초안을 제거한다", async (_label, mode, title, formId, fill, expectRestored, action) => {
    action.mockResolvedValueOnce(undefined); await open(mode); fill(); fireEvent.click(screen.getByRole("button", { name: /저장$/ }));
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1)); expect(screen.queryByText("이 초안 버리기")).toBeNull();
    expect(sessionStorage.getItem(formDraftStorageKey("founder-a", formId))).toBeNull();
    cleanup(); await open(mode);
    const field = screen.getByLabelText(mode === "1" ? "금액 (원)" : "사업명") as HTMLInputElement;
    expect(field.value).toBe("");
  });

  it.each([
    ["매출", "1", "매출 등록", "revenue-create", fillRevenue, expectRevenueRestored, mocks.createRevenueEntryAction],
    ["사업", "venture", "사업 등록", "venture-create", fillVenture, expectVentureRestored, mocks.createVentureAction],
  ] as const)("%s은 저장 실패 경계 뒤 재열면 초안을 복원한다", async (_label, mode, title, _formId, fill, expectRestored, action) => {
    action.mockRejectedValueOnce(new Error("UX-SYNTHETIC-SAVE-FAILURE")); setSearch(`new=${mode}`);
    const first = render(<RouteSegmentErrorBoundary>{revenueClient()}</RouteSegmentErrorBoundary>);
    await screen.findByRole("dialog", { name: title }); fill(); fireEvent.click(screen.getByRole("button", { name: /저장$/ }));
    await screen.findByRole("alert"); first.unmount(); renderRevenue(); await screen.findByRole("dialog", { name: title }); await waitFor(expectRestored);
  });

  it.each([
    ["매출", "1", "매출 등록", fillRevenue, expectRevenueRestored, () => expect((screen.getByLabelText("고객사 프로젝트 (선택)") as HTMLSelectElement).value).toBe("")],
    ["사업", "venture", "사업 등록", fillVenture, expectVentureRestored, () => expect((screen.getByLabelText("사업명") as HTMLInputElement).value).toBe("")],
  ] as const)("%s은 버리기 취소 후 보존하고 확인하면 초기화한다", async (_label, mode, _title, fill, expectRestored, expectInitial) => {
    await open(mode); fill();
    fireEvent.click(screen.getByRole("button", { name: "이 초안 버리기" }));
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expectRestored();
    fireEvent.click(screen.getByRole("button", { name: "이 초안 버리기" }));
    fireEvent.click(screen.getByRole("button", { name: "정말 버릴까요" }));
    expectInitial();
    cleanup(); await open(mode); expectInitial();
  });

  it.each([
    ["1", fillRevenue, expectRevenueRestored, "금액 (원)"],
    ["venture", fillVenture, expectVentureRestored, "사업명"],
  ] as const)("%s 초안은 같은 페이지에서 대표가 바뀌어도 섞이지 않는다", async (mode, fill, expectRestored, fieldLabel) => {
    setSearch(`new=${mode}`);
    const page = render(revenueClient("founder-a"));
    await screen.findByRole("dialog"); fill();
    page.rerender(revenueClient("founder-b"));
    await screen.findByRole("dialog");
    expect((screen.getByLabelText(fieldLabel) as HTMLInputElement).value).toBe("");
    page.rerender(revenueClient("founder-a"));
    await waitFor(expectRestored);
  });
});
