// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TaskList, type TaskListTask } from "@/components/task-list";

const tasks: TaskListTask[] = [
  { id: "one", title: "  Alpha 업무  ", dueDate: "2026-09-10", status: "open", assignedAgentName: null, kind: "client", clientName: "가람", projectName: "웹사이트", ventureName: null },
  { id: "two", title: "두 번째 업무", dueDate: "2026-09-11", status: "done", assignedAgentName: "담당자", kind: "internal", clientName: null, projectName: null, ventureName: "앱 사업" },
  { id: "three", title: "세 번째 업무", dueDate: "2026-09-12", status: "open", assignedAgentName: null, kind: "company", clientName: null, projectName: null, ventureName: null },
];

afterEach(cleanup);

describe("TaskList", () => {
  it("keeps source order, links each task, and shows displayed/total count", () => {
    render(<TaskList tasks={tasks} onCreate={vi.fn()} />);
    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/tasks/one", "/tasks/two", "/tasks/three"]);
    expect(screen.getByText("표시 3개 / 전체 3개")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "업무 이력" })).toBeInTheDocument();
  });

  it("applies trimmed case-insensitive title, status, and kind filters with AND semantics", () => {
    render(<TaskList tasks={tasks} onCreate={vi.fn()} />);
    fireEvent.change(screen.getByRole("searchbox", { name: "업무명 검색" }), { target: { value: "  ALPHA  " } });
    fireEvent.change(screen.getByRole("combobox", { name: "업무 상태" }), { target: { value: "open" } });
    fireEvent.change(screen.getByRole("combobox", { name: "업무 유형" }), { target: { value: "client" } });
    expect(screen.getByText("Alpha 업무")).toBeInTheDocument();
    expect(screen.queryByText("두 번째 업무")).not.toBeInTheDocument();
    expect(screen.getByText("표시 1개 / 전체 3개")).toBeInTheDocument();
  });

  it("filters by status or type independently and can produce zero matches when combined", () => {
    render(<TaskList tasks={tasks} onCreate={vi.fn()} />);
    fireEvent.change(screen.getByRole("combobox", { name: "업무 상태" }), { target: { value: "done" } });
    expect(screen.getByText("두 번째 업무")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "업무 상태" }), { target: { value: "" } });
    fireEvent.change(screen.getByRole("combobox", { name: "업무 유형" }), { target: { value: "internal" } });
    expect(screen.getByText("두 번째 업무")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "업무 상태" }), { target: { value: "open" } });
    expect(screen.getByText("조건에 맞는 업무가 없습니다.")).toBeInTheDocument();
  });

  it("resets all filters", () => {
    render(<TaskList tasks={tasks} onCreate={vi.fn()} />);
    fireEvent.change(screen.getByRole("searchbox", { name: "업무명 검색" }), { target: { value: "없는" } });
    fireEvent.change(screen.getByRole("combobox", { name: "업무 상태" }), { target: { value: "done" } });
    fireEvent.change(screen.getByRole("combobox", { name: "업무 유형" }), { target: { value: "internal" } });
    fireEvent.click(screen.getByRole("button", { name: "필터 초기화" }));
    expect(screen.getByRole("searchbox", { name: "업무명 검색" })).toHaveValue("");
    expect(screen.getByRole("combobox", { name: "업무 상태" })).toHaveValue("");
    expect(screen.getAllByRole("link")).toHaveLength(3);
  });

  it("distinguishes no data from no matches and preserves first-create callback", () => {
    const onCreate = vi.fn();
    const empty = render(<TaskList tasks={[]} onCreate={onCreate} />);
    expect(screen.getByText("아직 등록된 업무가 없습니다.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "첫 업무 만들기" }));
    expect(onCreate).toHaveBeenCalledOnce();
    empty.unmount();

    render(<TaskList tasks={tasks} onCreate={onCreate} />);
    fireEvent.change(screen.getByRole("searchbox", { name: "업무명 검색" }), { target: { value: "없는 업무" } });
    expect(screen.getByText("조건에 맞는 업무가 없습니다.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "첫 업무 만들기" })).not.toBeInTheDocument();
  });
});
