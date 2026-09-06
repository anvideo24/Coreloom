// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { TasksPageClient } from "@/components/tasks-page-client";

const navigation = vi.hoisted(() => ({ params: new URLSearchParams() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: (href: string) => { navigation.params = new URLSearchParams(href.split("?")[1] ?? ""); } }),
  usePathname: () => "/tasks",
  useSearchParams: () => navigation.params,
}));
vi.mock("@/app/(private)/tasks/actions", () => ({ createTaskAction: vi.fn() }));
afterEach(cleanup);

it("filters the integrated task history without hiding the schedule or disturbing panel close", async () => {
  const task = {
    id: "synthetic-task", title: "가상 일정 업무", dueDate: "2026-09-10",
    status: "open" as const, kind: "company" as const, assignedAgentName: null,
    clientName: null, projectName: null, ventureName: null,
  };
  render(<TasksPageClient draftScopeId="synthetic-founder" projects={[]} ventures={[]} agents={[]}
    tasks={[task]} schedule={[{ dueDate: task.dueDate, tasks: [task] }]} />);
  const list = screen.getByRole("region", { name: "업무 목록" });
  fireEvent.change(within(list).getByRole("searchbox"), { target: { value: "없는 업무" } });
  expect(within(list).queryByRole("link")).not.toBeInTheDocument();
  expect(within(screen.getByRole("region", { name: "다가오는 일정" })).getByRole("link")).toHaveAttribute("href", "/tasks/synthetic-task");
  fireEvent.click(screen.getByRole("button", { name: "새 업무" }));
  expect(await screen.findByRole("dialog", { name: "새 업무" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "작성 닫기" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(within(list).getByRole("searchbox")).toHaveValue("없는 업무");
  fireEvent.click(within(list).getByRole("button", { name: "필터 초기화" }));
  expect(within(list).getByRole("link")).toHaveAttribute("href", "/tasks/synthetic-task");
});
