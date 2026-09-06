// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ExpensesPageClient } from "@/components/expenses-page-client";
import { TasksPageClient } from "@/components/tasks-page-client";
import { formDraftStorageKey } from "@/lib/domain/form-draft";

const { createTaskAction, createExpenseEntryAction, navigation } = vi.hoisted(() => ({
  createTaskAction: vi.fn<(formData: FormData) => void | Promise<void>>(),
  createExpenseEntryAction: vi.fn<(formData: FormData) => void | Promise<void>>(),
  navigation: {
    searchParams: new URLSearchParams("new=1"),
    replace: vi.fn((href: string) => {
      navigation.searchParams = new URLSearchParams(href.split("?")[1] ?? "");
    }),
  },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/tasks",
  useRouter: () => ({ replace: navigation.replace }),
  useSearchParams: () => navigation.searchParams,
}));

vi.mock("@/app/(private)/tasks/actions", () => ({ createTaskAction }));
vi.mock("@/app/(private)/expenses/actions", () => ({ createExpenseEntryAction }));

beforeEach(() => {
  sessionStorage.clear();
  createTaskAction.mockReset();
  createExpenseEntryAction.mockReset();
  navigation.searchParams = new URLSearchParams("new=1");
  navigation.replace.mockClear();
});

afterEach(() => {
  cleanup();
});

const TASK_SCOPE = "UX-SYNTHETIC-FOUNDER-TASKS";
const EXPENSE_SCOPE = "UX-SYNTHETIC-FOUNDER-EXPENSES";

class RouteSegmentErrorBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <p role="alert">UX-SYNTHETIC-SAVE-FAILURE-SCREEN</p> : this.props.children;
  }
}

function taskClient(scopeId = TASK_SCOPE) {
  return (
    <TasksPageClient
      agents={[]}
      draftScopeId={scopeId}
      key={scopeId}
      projects={[
        { id: "project-a", clientName: "가상 고객사", name: "가상 프로젝트" },
        { id: "project-b", clientName: "가상 고객사", name: "다른 프로젝트" },
      ]}
      schedule={[]}
      tasks={[]}
      ventures={[
        { id: "venture-a", kind: "app", name: "가상 사업" },
        { id: "venture-b", kind: "subscription", name: "다른 사업" },
      ]}
    />
  );
}

function renderTasks(scopeId = TASK_SCOPE) {
  return render(taskClient(scopeId));
}

function expenseClient(scopeId = EXPENSE_SCOPE) {
  return (
    <ExpensesPageClient
      accounts={[{ code: "500", id: "account-a", name: "광고선전비" }]}
      draftScopeId={scopeId}
      key={scopeId}
      projects={[{ id: "project-a", clientName: "가상 고객사", name: "가상 프로젝트" }]}
      rows={[]}
      suppliers={[{ id: "supplier-a", name: "가상 매입처" }]}
      summary={{ confirmedAmount: 0, scheduledAmount: 0, unclassifiedCount: 0 }}
      ventures={[{ id: "venture-a", kind: "app", name: "가상 사업" }]}
    />
  );
}

function renderExpenses(scopeId = EXPENSE_SCOPE) {
  return render(expenseClient(scopeId));
}

async function openPanel(title: string) {
  await screen.findByRole("dialog", { name: title });
}

async function closeAndReopen(title: string, openLabel: string) {
  fireEvent.click(screen.getByRole("button", { name: "작성 닫기" }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: title })).toBeNull());
  fireEvent.click(screen.getByRole("button", { name: openLabel }));
  await openPanel(title);
}

function fillTask(kind: "company" | "internal" | "client" = "internal") {
  fireEvent.change(screen.getByLabelText("업무 유형"), { target: { value: kind } });
  if (kind === "internal") fireEvent.change(screen.getByLabelText("자체 사업"), { target: { value: "venture-b" } });
  if (kind === "client") fireEvent.change(screen.getByLabelText("고객사 · 프로젝트"), { target: { value: "project-b" } });
  fireEvent.change(screen.getByLabelText("기한"), { target: { value: "2026-09-15" } });
  fireEvent.change(screen.getByLabelText("업무명"), { target: { value: "UX-SYNTHETIC-업무" } });
  fireEvent.change(screen.getByLabelText("완료 조건"), { target: { value: "대표가 UX-SYNTHETIC-결과를 확인" } });
}

function expectTaskRestored() {
  expect((screen.getByLabelText("업무 유형") as HTMLSelectElement).value).toBe("internal");
  expect((screen.getByLabelText("자체 사업") as HTMLSelectElement).value).toBe("venture-b");
  expect((screen.getByLabelText("기한") as HTMLInputElement).value).toBe("2026-09-15");
  expect((screen.getByLabelText("업무명") as HTMLInputElement).value).toBe("UX-SYNTHETIC-업무");
  expect((screen.getByLabelText("완료 조건") as HTMLTextAreaElement).value).toBe("대표가 UX-SYNTHETIC-결과를 확인");
}

function fillExpense() {
  fireEvent.change(screen.getByLabelText("고객사 프로젝트 (선택)"), { target: { value: "project-a" } });
  fireEvent.change(screen.getByLabelText("계정과목 (선택)"), { target: { value: "account-a" } });
  fireEvent.change(screen.getByLabelText("매입처 이름 (선택)"), { target: { value: "UX-SYNTHETIC-매입처" } });
  fireEvent.change(screen.getByLabelText("금액 (원)"), { target: { value: "42000" } });
  fireEvent.change(screen.getByLabelText("발생일"), { target: { value: "2026-09-10" } });
  fireEvent.change(screen.getByLabelText("지급 예정일"), { target: { value: "2026-09-12" } });
  fireEvent.change(screen.getByLabelText("메모 (선택)"), { target: { value: "UX-SYNTHETIC-메모" } });
}

function expectExpenseRestored() {
  expect((screen.getByLabelText("고객사 프로젝트 (선택)") as HTMLSelectElement).value).toBe("project-a");
  expect((screen.getByLabelText("계정과목 (선택)") as HTMLSelectElement).value).toBe("account-a");
  expect((screen.getByLabelText("매입처 이름 (선택)") as HTMLInputElement).value).toBe("UX-SYNTHETIC-매입처");
  expect((screen.getByLabelText("금액 (원)") as HTMLInputElement).value).toBe("42000");
  expect((screen.getByLabelText("발생일") as HTMLInputElement).value).toBe("2026-09-10");
  expect((screen.getByLabelText("지급 예정일") as HTMLInputElement).value).toBe("2026-09-12");
  expect((screen.getByLabelText("메모 (선택)") as HTMLInputElement).value).toBe("UX-SYNTHETIC-메모");
}

function expectTaskInitial() {
  expect((screen.getByLabelText("업무 유형") as HTMLSelectElement).value).toBe("client");
  expect((screen.getByLabelText("고객사 · 프로젝트") as HTMLSelectElement).value).toBe("project-a");
  expect((screen.getByLabelText("기한") as HTMLInputElement).value).toBe("");
  expect((screen.getByLabelText("업무명") as HTMLInputElement).value).toBe("");
  expect((screen.getByLabelText("완료 조건") as HTMLTextAreaElement).value).toBe("");
}

function expectExpenseInitial() {
  expect((screen.getByLabelText("고객사 프로젝트 (선택)") as HTMLSelectElement).value).toBe("");
  expect((screen.getByLabelText("앱·구독 사업 (선택)") as HTMLSelectElement).value).toBe("");
  expect((screen.getByLabelText("계정과목 (선택)") as HTMLSelectElement).value).toBe("");
  expect((screen.getByLabelText("매입처 이름 (선택)") as HTMLInputElement).value).toBe("");
  expect((screen.getByLabelText("금액 (원)") as HTMLInputElement).value).toBe("");
  expect((screen.getByLabelText("발생일") as HTMLInputElement).value).toBe("");
  expect((screen.getByLabelText("지급 예정일") as HTMLInputElement).value).toBe("");
  expect((screen.getByLabelText("메모 (선택)") as HTMLInputElement).value).toBe("");
}

describe("업무·비용 작성 초안", () => {
  it.each([
    ["company", null, null],
    ["internal", null, "venture-b"],
    ["client", "project-b", null],
  ] as const)("업무 유형 %s과 그 조건부 연결값을 비기본 선택까지 복원한다", async (kind, expectedProject, expectedVenture) => {
    const first = renderTasks();
    await openPanel("새 업무");
    fillTask(kind);
    first.unmount();

    renderTasks();
    await openPanel("새 업무");
    await waitFor(() => {
      expect((screen.getByLabelText("업무 유형") as HTMLSelectElement).value).toBe(kind);
      if (expectedProject) expect((screen.getByLabelText("고객사 · 프로젝트") as HTMLSelectElement).value).toBe(expectedProject);
      else expect(screen.queryByLabelText("고객사 · 프로젝트")).toBeNull();
      if (expectedVenture) expect((screen.getByLabelText("자체 사업") as HTMLSelectElement).value).toBe(expectedVenture);
      else expect(screen.queryByLabelText("자체 사업")).toBeNull();
    });
  });

  it("업무 유형을 전환하면 제출값에 이전 프로젝트·사업 연결이 남지 않는다", async () => {
    renderTasks();
    await openPanel("새 업무");
    fireEvent.change(screen.getByLabelText("고객사 · 프로젝트"), { target: { value: "project-b" } });
    fireEvent.change(screen.getByLabelText("업무 유형"), { target: { value: "internal" } });
    fireEvent.change(screen.getByLabelText("자체 사업"), { target: { value: "venture-b" } });
    let formData = new FormData(screen.getByRole("dialog").querySelector("form")!);
    expect(formData.get("projectId")).toBeNull();
    expect(formData.get("ventureId")).toBe("venture-b");

    fireEvent.change(screen.getByLabelText("업무 유형"), { target: { value: "company" } });
    formData = new FormData(screen.getByRole("dialog").querySelector("form")!);
    expect(formData.get("projectId")).toBeNull();
    expect(formData.get("ventureId")).toBeNull();
  });

  it.each([
    ["업무", "새 업무", "첫 업무 만들기", renderTasks, fillTask, expectTaskRestored],
    ["비용", "비용 등록", "첫 비용 등록", renderExpenses, fillExpense, expectExpenseRestored],
  ] as const)("%s은 패널 헤더의 닫기 후 같은 탭에서 다시 열어도 복원한다", async (_name, title, openLabel, renderForm, fill, expectRestored) => {
    renderForm();
    await openPanel(title);
    expect(screen.getByRole("heading", { name: title })).toBeTruthy();
    expect(screen.getByRole("button", { name: "작성 닫기" })).toBeTruthy();
    fill();
    await closeAndReopen(title, openLabel);
    await waitFor(expectRestored);
  });

  it.each([
    ["업무", "새 업무", renderTasks, fillTask, expectTaskRestored],
    ["비용", "비용 등록", renderExpenses, fillExpense, expectExpenseRestored],
  ] as const)("%s은 새로고침 뒤에도 복원한다", async (_name, title, renderForm, fill, expectRestored) => {
    const first = renderForm();
    await openPanel(title);
    fill();
    first.unmount();
    cleanup();

    renderForm();
    await openPanel(title);
    await waitFor(expectRestored);
  });

  it.each([
    ["업무", "새 업무", renderTasks, renderExpenses, fillTask, expectTaskRestored],
    ["비용", "비용 등록", renderExpenses, renderTasks, fillExpense, expectExpenseRestored],
  ] as const)("%s은 다른 화면을 거쳐 돌아와도 복원한다", async (_name, title, renderForm, renderOther, fill, expectRestored) => {
    const first = renderForm();
    await openPanel(title);
    fill();
    first.unmount();
    const other = renderOther();
    other.unmount();

    renderForm();
    await openPanel(title);
    await waitFor(expectRestored);
  });

  it.each([
    ["업무", "새 업무", "task-create", renderTasks, fillTask, expectTaskRestored, expectTaskInitial, TASK_SCOPE],
    ["비용", "비용 등록", "expense-create", renderExpenses, fillExpense, expectExpenseRestored, expectExpenseInitial, EXPENSE_SCOPE],
  ] as const)("%s은 명시적으로 버리면 다음 열기에서 되살아나지 않는다", async (_name, title, formId, renderForm, fill, expectRestored, expectInitial, scopeId) => {
    const first = renderForm();
    await openPanel(title);
    fill();
    fireEvent.click(screen.getByText("이 초안 버리기"));
    expect(screen.getByText("정말 버릴까요")).toBeTruthy();
    fireEvent.click(screen.getByText("취소"));
    expectRestored();
    fireEvent.click(screen.getByText("이 초안 버리기"));
    fireEvent.click(screen.getByText("정말 버릴까요"));
    expect(sessionStorage.getItem(formDraftStorageKey(scopeId, formId))).toBeNull();
    first.unmount();

    renderForm();
    await openPanel(title);
    expect(screen.queryByText("이 초안 버리기")).toBeNull();
    expectInitial();
  });

  it.each([
    ["업무", "새 업무", "task-create", renderTasks, fillTask, createTaskAction, TASK_SCOPE],
    ["비용", "비용 등록", "expense-create", renderExpenses, fillExpense, createExpenseEntryAction, EXPENSE_SCOPE],
  ] as const)("%s은 확인된 저장 성공 뒤에만 초안을 지운다", async (_name, title, formId, renderForm, fill, action, scopeId) => {
    action.mockResolvedValueOnce();
    renderForm();
    await openPanel(title);
    fill();
    fireEvent.click(screen.getByRole("button", { name: /저장$/ }));
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(sessionStorage.getItem(formDraftStorageKey(scopeId, formId))).toBeNull());
  });

  it.each([
    ["업무", "새 업무", "task-create", taskClient, renderTasks, fillTask, expectTaskRestored, createTaskAction, TASK_SCOPE],
    ["비용", "비용 등록", "expense-create", expenseClient, renderExpenses, fillExpense, expectExpenseRestored, createExpenseEntryAction, EXPENSE_SCOPE],
  ] as const)("%s 저장 오류 뒤에는 초안을 남겨 재열기에서 복원한다", async (_name, title, formId, client, renderForm, fill, expectRestored, action, scopeId) => {
    action.mockRejectedValueOnce(new Error("UX-SYNTHETIC-SAVE-FAILURE"));
    const first = render(<RouteSegmentErrorBoundary>{client(scopeId)}</RouteSegmentErrorBoundary>);
    await openPanel(title);
    fill();
    fireEvent.click(screen.getByRole("button", { name: /저장$/ }));
    await screen.findByRole("alert");
    expect(sessionStorage.getItem(formDraftStorageKey(scopeId, formId))).not.toBeNull();
    first.unmount();

    renderForm(scopeId);
    await openPanel(title);
    await waitFor(expectRestored);
  });

  it.each([
    ["업무", "새 업무", renderTasks, fillTask, expectTaskRestored, createTaskAction],
    ["비용", "비용 등록", renderExpenses, fillExpense, expectExpenseRestored, createExpenseEntryAction],
  ] as const)("%s 저장 거부는 입력을 같은 패널에 남기고 목록 확인만 안내한다", async (_name, title, renderForm, fill, expectRestored, action) => {
    action.mockRejectedValueOnce(new Error("UX-SYNTHETIC-PRIVATE-SAVE-ERROR"));
    renderForm();
    await openPanel(title);
    fill();

    fireEvent.click(screen.getByRole("button", { name: /저장$/ }));

    const notice = await screen.findByRole("alert");
    expect(notice.textContent).toContain("저장 결과를 확인해 주세요");
    expect(notice.textContent).not.toContain("UX-SYNTHETIC-PRIVATE-SAVE-ERROR");
    expect(screen.getByRole("link", { name: /목록 확인/ }).getAttribute("href")).toBe(_name === "업무" ? "/tasks" : "/expenses");
    expect(screen.queryByRole("button", { name: "다시 시도" })).toBeNull();
    expect((screen.getByRole("button", { name: /저장$/ }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.submit(notice.closest("form")!);
    expect(action).toHaveBeenCalledTimes(1);
    expectRestored();
  });

  it.each([
    ["업무", "새 업무", renderTasks, fillTask, createTaskAction],
    ["비용", "비용 등록", renderExpenses, fillExpense, createExpenseEntryAction],
  ] as const)("%s 저장 중에는 같은 패널에서 두 번째 요청을 보내지 않는다", async (_name, title, renderForm, fill, action) => {
    let settle: (() => void) | undefined;
    action.mockImplementationOnce(() => new Promise<void>((resolve) => { settle = resolve; }));
    renderForm();
    await openPanel(title);
    fill();

    const save = screen.getByRole("button", { name: /저장$/ });
    fireEvent.click(save);
    fireEvent.submit(save.closest("form")!);
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "저장 중…" }).closest("form")?.getAttribute("aria-busy")).toBe("true");
    expect(screen.getByRole("button", { name: "저장 중…" })).toBeTruthy();
    expect((screen.getByRole("button", { name: "저장 중…" }) as HTMLButtonElement).disabled).toBe(true);
    settle?.();
  });

  it.each([
    ["업무", "새 업무", "task-create", taskClient, fillTask, createTaskAction, TASK_SCOPE],
    ["비용", "비용 등록", "expense-create", expenseClient, fillExpense, createExpenseEntryAction, EXPENSE_SCOPE],
  ] as const)("%s 저장 redirect는 복구 안내로 삼키지 않고 초안을 지운다", async (_name, title, formId, client, fill, action, scopeId) => {
    action.mockRejectedValueOnce(Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;push;/synthetic;303;" }));
    render(<RouteSegmentErrorBoundary>{client(scopeId)}</RouteSegmentErrorBoundary>);
    await openPanel(title);
    fill();

    fireEvent.click(screen.getByRole("button", { name: /저장$/ }));

    await waitFor(() => expect(sessionStorage.getItem(formDraftStorageKey(scopeId, formId))).toBeNull());
    expect(screen.queryByRole("heading", { name: "저장 결과를 확인해 주세요" })).toBeNull();
  });

  it.each([
    ["업무", "새 업무", "task-create", taskClient, renderTasks, fillTask, expectTaskInitial, TASK_SCOPE],
    ["비용", "비용 등록", "expense-create", expenseClient, renderExpenses, fillExpense, expectExpenseInitial, EXPENSE_SCOPE],
  ] as const)("%s은 같은 컴포넌트가 다른 대표 scope로 바뀌어도 이전 입력을 보이지 않는다", async (_name, title, formId, client, renderForm, fill, expectInitial, scopeId) => {
    const first = renderForm(scopeId);
    await openPanel(title);
    fill();
    first.rerender(client(`${scopeId}-OTHER`));
    await openPanel(title);
    expect(sessionStorage.getItem(formDraftStorageKey(`${scopeId}-OTHER`, formId))).toBeNull();
    expect(screen.queryByText("이 초안 버리기")).toBeNull();
    expectInitial();
  });
});
