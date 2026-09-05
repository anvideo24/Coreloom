// @vitest-environment jsdom
import React from "react";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { adminManualHomeSections, resolveManualHref } from "@/lib/domain/admin-manual";
import { parseWorkMap } from "@/lib/domain/manual-work-map";
import { AdminManualFrame } from "@/components/admin-manual-frame";

const auth = vi.hoisted(() => ({ state: "signed-out" }));
vi.mock("@/lib/auth/session", () => ({ founderSession: vi.fn(async () => auth) }));
vi.mock("next/navigation", () => ({ redirect: (to: string) => { throw new Error(`redirect:${to}`); } }));
const source = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("@/lib/admin-manual/repository", () => ({ readAdminManualWorkMap: source.read }));
afterEach(() => { cleanup(); source.read.mockReset(); auth.state = "signed-out"; });
const markdown = () => readFileSync(resolve(process.cwd(), "../../manual/work-map.md"), "utf8");

describe("work map source and entry", () => {
  it("exposes one home entry and resolves the canonical manual link", () => {
    expect(adminManualHomeSections.flatMap(s => s.cards).filter(c => c.href === "/admin/manual/work-map")).toHaveLength(1);
    expect(resolveManualHref("work-map.md")).toBe("/admin/manual/work-map");
  });
  it("reads all six steps and four supporting areas from the manual, with real routes", () => {
    const map = parseWorkMap(markdown());
    expect(map.steps.map(s => s.id)).toEqual(["client", "project", "quote", "contract", "billing", "receipt"]);
    expect(map.supports).toHaveLength(4);
    expect(map.steps.at(-1)?.href).toBe("/billings");
    for (const item of [...map.steps, ...map.supports]) {
      expect(existsSync(resolve(process.cwd(), `src/app/(private)${item.href}/page.tsx`))).toBe(true);
    }
    expect(parseWorkMap(markdown().replace("누구와 일하나요?", "등록할 거래 상대" )).steps[0].question).toBe("등록할 거래 상대");
  });
  it("rejects broken source, duplicated ids and non-allowlisted destinations", () => {
    expect(() => parseWorkMap("")).toThrow();
    expect(() => parseWorkMap(markdown().replace("| project |", "| client |"))).toThrow();
    expect(() => parseWorkMap(markdown().replace("/clients |", "https://example.com |"))).toThrow();
    expect(() => parseWorkMap(markdown().replace("| 고객사 |", "|  |"))).toThrow();
  });
  it("does not put the work map inside the narrow article treatment", () => {
    const { container } = render(<AdminManualFrame title="업무 지도" intro="업무 흐름" deployVersion="test" deployCommit="abc" manualCommit="abc" contentLayout="canvas"><p>지도</p></AdminManualFrame>);
    expect(container.querySelector(".manual-document")).toBeNull();
    expect(screen.getByRole("link", { name: "매뉴얼 홈" }).getAttribute("href")).toBe("/admin/manual");
  });
});

describe("work map route protection", () => {
  it.each([["signed-out", "/sign-in"], ["denied", "/dashboard"]])("blocks %s before reading the source", async (state, target) => {
    auth.state = state;
    const { default: Page } = await import("@/app/(private)/admin/manual/work-map/page");
    await expect(Page()).rejects.toThrow(`redirect:${target}`);
    expect(source.read).not.toHaveBeenCalled();
  });
  it("shows the map for the founder without querying business data", async () => {
    auth.state = "authorized";
    source.read.mockReturnValue({markdown:markdown(), deployVersion:"test",deployCommit:"abc",manualCommit:"def"});
    const { default: Page } = await import("@/app/(private)/admin/manual/work-map/page");
    render(await Page());
    expect(screen.getByRole("heading", { name: "일은 이렇게 이어집니다" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /고객사.*누구와/ })).toBeTruthy();
  });
  it("shows an explicit unavailable state when the source cannot be read", async () => {
    auth.state = "authorized"; source.read.mockImplementation(() => {throw new Error("unavailable");});
    const { default: Page } = await import("@/app/(private)/admin/manual/work-map/page");
    render(await Page());
    expect(screen.getByText(/업무 지도 원본을 읽을 수 없습니다/)).toBeTruthy();
    expect(screen.queryByRole("button", { name:/고객사.*누구와/ })).toBeNull();
  });
});
