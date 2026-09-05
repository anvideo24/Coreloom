// @vitest-environment jsdom
import React, { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AgentFolderPicker } from "@/components/agent-folder-picker";
import { browseAgentFoldersAction } from "@/app/(private)/agents/folder-actions";

vi.mock("@/app/(private)/agents/folder-actions", () => ({ browseAgentFoldersAction: vi.fn() }));

const agentId = "00000000-0000-4000-8000-000000000001";
const start = { currentPath: null, label: "서버 PC", parentPath: null, canSelect: false, entries: [{ name: "업무", path: "C:\\example-work" }], truncated: false };
const work = { currentPath: "C:\\example-work", label: "업무", parentPath: null, canSelect: true, entries: [], truncated: false };

function Harness({ initial = [] }: { initial?: string[] }) {
  const [roots, setRoots] = useState(initial);
  return <AgentFolderPicker agentId={agentId} roots={roots} onRootsChange={setRoots} />;
}

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("server PC folder picker", () => {
  it("browses, adds and removes a folder draft without changing permissions", async () => {
    vi.mocked(browseAgentFoldersAction).mockImplementation(async (_agent, folder) => folder ? work : start);
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "폴더 선택" }));
    fireEvent.click(await screen.findByRole("button", { name: "업무" }));
    fireEvent.click(await screen.findByRole("button", { name: "이 폴더 추가" }));
    expect(screen.getByRole("list", { name: "추가할 업무 폴더" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "제거" }));
    expect(screen.getByText("추가할 폴더가 없습니다.")).toBeTruthy();
  });

  it("does not allow a ninth folder", async () => {
    vi.mocked(browseAgentFoldersAction).mockImplementation(async (_agent, folder) => folder ? work : start);
    render(<Harness initial={Array.from({ length: 8 }, (_, index) => `C:\\example-${index}`)} />);
    fireEvent.click(screen.getByRole("button", { name: "폴더 선택" }));
    fireEvent.click(await screen.findByRole("button", { name: "업무" }));
    expect((await screen.findByRole("button", { name: "이 폴더 추가" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("업무 폴더는 최대 8개까지 추가할 수 있습니다.")).toBeTruthy();
  });

  it("ignores a stale response after cancel and retry", async () => {
    let resolveOld!: (value: typeof work) => void;
    const old = new Promise<typeof work>((resolve) => { resolveOld = resolve; });
    vi.mocked(browseAgentFoldersAction)
      .mockResolvedValueOnce(start)
      .mockReturnValueOnce(old)
      .mockResolvedValueOnce(start);
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "폴더 선택" }));
    fireEvent.click(await screen.findByRole("button", { name: "업무" }));
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    fireEvent.click(screen.getByRole("button", { name: "폴더 선택" }));
    await screen.findByText("서버 PC");
    resolveOld(work);
    await waitFor(() => expect(screen.queryByText("열 수 있는 하위 폴더가 없습니다.")).toBeNull());
    expect(screen.getByRole("button", { name: "업무" })).toBeTruthy();
  });

  it("does not add while the surrounding settings are disabled", async () => {
    vi.mocked(browseAgentFoldersAction).mockImplementation(async (_agent, folder) => folder ? work : start);
    const onRootsChange = vi.fn();
    const rendered = render(<AgentFolderPicker agentId={agentId} roots={[]} onRootsChange={onRootsChange} />);
    fireEvent.click(screen.getByRole("button", { name: "폴더 선택" })); fireEvent.click(await screen.findByRole("button", { name: "업무" }));
    rendered.rerender(<AgentFolderPicker agentId={agentId} roots={[]} onRootsChange={onRootsChange} disabled />);
    fireEvent.click(await screen.findByRole("button", { name: "이 폴더 추가" }));
    expect(onRootsChange).not.toHaveBeenCalled();
  });

  it("treats Windows case, separators and trailing slashes as the same folder", async () => {
    vi.mocked(browseAgentFoldersAction).mockImplementation(async (_agent, folder) => folder ? { ...work, currentPath: "c:/example-work" } : start);
    const onRootsChange = vi.fn();
    render(<AgentFolderPicker agentId={agentId} roots={["C:\\EXAMPLE-WORK\\", "c:/example-work"]} onRootsChange={onRootsChange} />);
    expect(screen.getAllByRole("button", { name: "제거" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "폴더 선택" })); fireEvent.click(await screen.findByRole("button", { name: "업무" }));
    expect((await screen.findByRole("button", { name: "이 폴더 추가" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("ignores a response from the previously selected agent", async () => {
    let resolveOld!: (value: typeof start) => void;
    const old = new Promise<typeof start>((resolve) => { resolveOld = resolve; });
    vi.mocked(browseAgentFoldersAction).mockReturnValueOnce(old).mockResolvedValueOnce({ ...start, label: "새 에이전트 시작점" });
    const rendered = render(<AgentFolderPicker agentId={agentId} roots={[]} onRootsChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "폴더 선택" }));
    rendered.rerender(<AgentFolderPicker agentId="00000000-0000-4000-8000-000000000002" roots={[]} onRootsChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "폴더 선택" }));
    expect(await screen.findByText("새 에이전트 시작점")).toBeTruthy();
    resolveOld(start);
    await waitFor(() => expect(screen.getByText("새 에이전트 시작점")).toBeTruthy());
  });
});
