// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { AdminManualFrame, ManualBlocks } from "./admin-manual-frame";
import { parseManualMarkdown } from "@/lib/domain/admin-manual";

const props = {
  deployVersion: "dev",
  deployCommit: "abc",
  manualCommit: "def",
  title: "운영 설명",
  intro: "읽기 전용 매뉴얼",
};

beforeEach(() => {
  expect(document.body.childElementCount).toBe(0);
});

afterEach(() => {
  cleanup();
});

describe("AdminManualFrame manual reading hierarchy", () => {
  it("renders the real progress source through the child-only page path with current summary and accessible history", () => {
    const blocks = parseManualMarkdown(readFileSync(resolve(process.cwd(), "../../manual/system-progress.md"), "utf8"));
    const { container } = render(<AdminManualFrame {...props}><ManualBlocks blocks={blocks} /></AdminManualFrame>);
    const current = screen.getByRole("heading", { name: "지금 확인할 상태" });
    const historical = container.querySelector<HTMLDetailsElement>("details.manual-history")!;
    expect(current).toBeVisible();
    expect(current.closest("details")).toBeNull();
    expect(current.compareDocumentPosition(historical) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(historical.open).toBe(false);
    const heading = historical.querySelector<HTMLElement>("h3")!;
    const scroll = vi.fn();
    heading.scrollIntoView = scroll;
    window.history.replaceState({}, "", `#${heading.id}`);
    fireEvent(window, new HashChangeEvent("hashchange"));
    expect(historical.open).toBe(true);
    expect(scroll).toHaveBeenCalledWith({ block: "start" });
    expect(heading).toBeVisible();
    window.history.replaceState({}, "", "#");
  });

  it("renders tagged history as expandable details while keeping the current note visible", () => {
    render(<AdminManualFrame title="진행 현황" intro="현재 상태" deployVersion="test" deployCommit="abc" manualCommit="def" blocks={[
      { type: "heading", level: 1, text: "현재 상태" },
      { type: "paragraph", inlines: [{ type: "text", text: "현재 제한은 보인다." }] },
      { type: "historical", blocks: [{ type: "paragraph", inlines: [{ type: "text", text: "과거 구현 기록" }] }] },
    ]} />);

    expect(screen.getByText("현재 제한은 보인다.")).toBeVisible();
    const history = screen.getByText("과거 구현 기록");
    expect(history.closest("details")).not.toHaveAttribute("open");
    expect(screen.getByText("과거 구현 기록")).toBeInTheDocument();
  });

  it("opens a collapsed history section when its heading is addressed by hash", () => {
    window.history.replaceState({}, "", "#manual-옛-구현");
    render(<AdminManualFrame {...props} blocks={[
      { type: "historical", blocks: [{ type: "heading", level: 1, text: "옛 구현" }] },
    ]} />);
    fireEvent(window, new HashChangeEvent("hashchange"));
    expect(screen.getByRole("heading", { name: "옛 구현" }).closest("details")).toHaveAttribute("open");
    window.history.replaceState({}, "", "#");
  });

  it("keeps heading IDs unique across visible and historical nested blocks", () => {
    render(<AdminManualFrame {...props} blocks={[
      { type: "heading", level: 1, text: "같은 제목" },
      { type: "historical", blocks: [{ type: "heading", level: 1, text: "같은 제목" }] },
    ]} />);
    expect([...document.querySelectorAll(".manual-document h2, .manual-document h3, .manual-document h4")].map((node) => node.id)).toEqual(["manual-같은-제목", "manual-같은-제목-2"]);
  });

  it("creates deterministic unique IDs for duplicate headings and links to them", () => {
    render(<AdminManualFrame {...props} blocks={[
      { type: "heading", level: 1, text: "같은 제목" },
      { type: "paragraph", inlines: [{ type: "text", text: "첫 내용" }] },
      { type: "heading", level: 2, text: "같은 제목" },
    ]} />);

    expect(screen.getByRole("heading", { name: "같은 제목", level: 2 })).toHaveAttribute("id", "manual-같은-제목");
    expect(screen.getByRole("heading", { name: "같은 제목", level: 3 })).toHaveAttribute("id", "manual-같은-제목-2");
    const desktopToc = document.querySelector(".manual-toc-desktop");
    expect(desktopToc).not.toBeNull();
    expect(within(desktopToc as HTMLElement).getAllByRole("link", { name: "같은 제목" }).map((link) => link.getAttribute("href"))).toEqual(["#manual-같은-제목", "#manual-같은-제목-2"]);
  });

  it("preserves document content and exposes metadata as closed disclosure", () => {
    render(<AdminManualFrame {...props} sourceLabel="RULES.md" blocks={[
      { type: "paragraph", inlines: [{ type: "link", text: "원문 링크", href: "/admin/manual" }] },
      { type: "table", headers: ["항목", "값"], rows: [["전부", "보존"]] },
    ]} />);

    expect(screen.getByText("원문 링크")).toHaveAttribute("href", "/admin/manual");
    expect(screen.getByText("전부")).toBeInTheDocument();
    expect(screen.getByText("보존")).toBeInTheDocument();
    expect(screen.getAllByText("문서 정보").at(-1)?.closest("details")).not.toHaveAttribute("open");
    expect(screen.getByRole("region", { name: "표: 항목, 값" })).toBeInTheDocument();
  });

  it("keeps slug-colliding headings unique and leaves child-only pages full width", () => {
    const { container } = render(<AdminManualFrame {...props} blocks={[
      { type: "heading", level: 1, text: "A B" },
      { type: "heading", level: 2, text: "A-B" },
      { type: "heading", level: 3, text: "A B-2" },
      { type: "heading", level: 3, text: "A-B-2" },
    ]} />);
    const ids = [...container.querySelectorAll(".manual-document h2, .manual-document h3, .manual-document h4")].map((heading) => heading.id);
    expect(new Set(ids).size).toBe(ids.length);

    const childOnly = render(<AdminManualFrame {...props}><p>진행 현황</p></AdminManualFrame>);
    expect(childOnly.container.querySelector(".manual-document-layout")).toHaveClass("manual-document-layout-no-toc");
  });

  it("keeps the narrow native TOC closed initially", () => {
    const { container } = render(<AdminManualFrame {...props} blocks={[{ type: "heading", level: 1, text: "한 절" }]} />);
    expect(container.querySelector(".manual-toc-mobile")).not.toHaveAttribute("open");
  });
});
