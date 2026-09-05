// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ state: "signed-out" }));
const source = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ founderSession: vi.fn(async () => auth) }));
vi.mock("next/navigation", () => ({ redirect: (to: string) => { throw new Error(`redirect:${to}`); } }));
vi.mock("@/lib/admin-manual/repository", () => ({ readAdminManualSystemMap: source.read }));
afterEach(() => { cleanup(); source.read.mockReset(); auth.state = "signed-out"; });
const markdown = () => readFileSync(resolve(process.cwd(), "../../manual/system-map.md"), "utf8");

describe("system map page", () => {
  it.each([["signed-out", "/sign-in"], ["denied", "/dashboard"]])("blocks %s before reading content", async (state, target) => {
    auth.state = state;
    const { default: Page } = await import("@/app/(private)/admin/manual/system-map/page");
    await expect(Page()).rejects.toThrow(`redirect:${target}`);
    expect(source.read).not.toHaveBeenCalled();
  });
  it.each(["missing", "malformed"])("shows an explicit warning for %s source", async failure => {
    auth.state = "authorized";
    if (failure === "missing") source.read.mockImplementation(() => { throw new Error("unavailable"); });
    else source.read.mockReturnValue({ markdown: "# 잘못된 원본" });
    const { default: Page } = await import("@/app/(private)/admin/manual/system-map/page");
    render(await Page());
    expect(screen.getByRole("status").textContent).toContain("원본을 읽을 수 없습니다");
    expect(screen.getByRole("link", { name: "매뉴얼 홈" }).getAttribute("href")).toBe("/admin/manual");
    expect(screen.queryByRole("button", {name:/회사 기록/})).toBeNull();
  });
  it("renders a changed canonical explanation and full-width canvas for the founder", async () => {
    auth.state = "authorized";
    source.read.mockReturnValue({markdown: markdown().replace("고객·프로젝트·견적·청구 등 구조화된 회사 기록을 보관합니다.", "문서에서 수정한 설명입니다."), deployVersion: "test", deployCommit: "abc", manualCommit: "def"});
    const { default: Page } = await import("@/app/(private)/admin/manual/system-map/page");
    const { container } = render(await Page());
    expect(screen.getByRole("heading", {name:"무엇이 어디에 연결되나요?"})).toBeTruthy();
    expect(container.querySelector(".manual-document")).toBeNull();
    fireEvent.click(screen.getByRole("button", {name:/회사 기록/}));
    expect(screen.getByText("문서에서 수정한 설명입니다.")).toBeTruthy();
  });
});
