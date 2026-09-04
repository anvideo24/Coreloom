import { describe, expect, test } from "vitest";

import {
  canHoverPeekWideNav,
  isEditableHotkeyTarget,
  isNavItemActive,
  isNavToggleHotkey,
  NAV_HOVER_HIDE_MS,
  NAV_HOVER_PEEK_MEDIA,
  NAV_WIDE_MEDIA,
  navItems,
  navItemsForTab,
  navigationShell,
  parseWideNavOpen,
  serializeWideNavOpen,
  tabIdForPath,
} from "@/lib/domain/private-navigation";

describe("PrivateNavigation", () => {
  test("includes all required operating destinations", () => {
    const hrefs = navItems().map((item) => item.href);
    expect(hrefs).toContain("/dashboard");
    expect(hrefs).toContain("/approvals");
    expect(hrefs).toContain("/company-setup");
    expect(hrefs).toContain("/documents");
    expect(hrefs).toContain("/clients");
    expect(hrefs).toContain("/clients-projects");
    expect(hrefs).toContain("/quotes");
    expect(hrefs).toContain("/contracts");
    expect(hrefs).toContain("/billings");
    expect(hrefs).toContain("/revenue");
    expect(hrefs).toContain("/expenses");
    expect(hrefs).toContain("/accounts");
    expect(hrefs).toContain("/tasks");
    expect(hrefs).toContain("/agents");
    expect(hrefs).toContain("/timeline");
    expect(hrefs).toContain("/proposals");
    expect(hrefs).toContain("/admin/manual");
  });

  test("includes required labels", () => {
    const labels = navItems().map((item) => item.label);
    expect(labels).toContain("대시보드");
    expect(labels).toContain("승인함");
    expect(labels).toContain("비용 원장");
    expect(labels).toContain("계정과목");
    expect(labels).toContain("에이전트");
    // /admin/manual은 이제 한 권의 책이 아니라 고르는 입구다.
    expect(labels).toContain("매뉴얼");
  });

  test("uses a bottom bar on folded phones and a push sidebar from unfolded fold upward", () => {
    expect(navigationShell(300)).toBe("compact");
    expect(navigationShell(390)).toBe("compact");
    expect(navigationShell(639)).toBe("compact");
    expect(navigationShell(640)).toBe("drawer");
    expect(navigationShell(720)).toBe("drawer");
    expect(navigationShell(1920)).toBe("drawer");
    expect(navigationShell(3840)).toBe("drawer");
    expect(NAV_WIDE_MEDIA).toBe("(min-width: 40rem)");
  });

  test("toggles the wide sidebar with Control or Command and B", () => {
    expect(isNavToggleHotkey({ key: "b", code: "KeyB", altKey: false, ctrlKey: true, metaKey: false })).toBe(true);
    expect(isNavToggleHotkey({ key: "b", code: "KeyB", altKey: false, ctrlKey: false, metaKey: true })).toBe(true);
    expect(isNavToggleHotkey({ key: "B", code: "KeyB", altKey: false, ctrlKey: true, metaKey: false })).toBe(true);
    expect(isNavToggleHotkey({ key: "b", code: "KeyB", altKey: false, ctrlKey: false, metaKey: false })).toBe(false);
    expect(isNavToggleHotkey({ key: "b", code: "KeyB", altKey: true, ctrlKey: true, metaKey: false })).toBe(false);
    expect(isNavToggleHotkey({ key: "b", code: "KeyB", altKey: false, ctrlKey: true, metaKey: false, shiftKey: true })).toBe(false);
    expect(isNavToggleHotkey({ key: "b", code: "KeyB", altKey: false, ctrlKey: true, metaKey: false, repeat: true })).toBe(false);
    expect(isNavToggleHotkey({ key: "k", code: "KeyK", altKey: false, ctrlKey: true, metaKey: false })).toBe(false);
  });

  test("does not steal Control or Command B from form fields", () => {
    // 진짜 DOM 요소 대신 흉내 낸 객체를 넘긴다. EventTarget으로 형을 맞춰 줘야
    // `next build`의 타입 검사가 통과한다.
    const target = (value: { tagName?: string; isContentEditable?: boolean }) => value as unknown as EventTarget;
    expect(isEditableHotkeyTarget(target({ tagName: "INPUT" }))).toBe(true);
    expect(isEditableHotkeyTarget(target({ tagName: "textarea" }))).toBe(true);
    expect(isEditableHotkeyTarget(target({ tagName: "SELECT" }))).toBe(true);
    expect(isEditableHotkeyTarget(target({ tagName: "DIV", isContentEditable: true }))).toBe(true);
    expect(isEditableHotkeyTarget(target({ tagName: "BUTTON" }))).toBe(false);
    expect(isEditableHotkeyTarget(null)).toBe(false);
  });

  test("allows hover peek only when the wide sidebar is not pinned and the pointer can hover", () => {
    expect(canHoverPeekWideNav(false, true)).toBe(true);
    expect(canHoverPeekWideNav(true, true)).toBe(false);
    expect(canHoverPeekWideNav(false, false)).toBe(false);
    expect(canHoverPeekWideNav(true, false)).toBe(false);
    expect(NAV_HOVER_PEEK_MEDIA).toBe("(hover: hover) and (pointer: fine)");
    expect(NAV_HOVER_HIDE_MS).toBe(180);
  });

  test("remembers whether the wide sidebar was open", () => {
    expect(parseWideNavOpen(null)).toBe(true);
    expect(parseWideNavOpen("1")).toBe(true);
    expect(parseWideNavOpen("0")).toBe(false);
    expect(parseWideNavOpen("false")).toBe(false);
    expect(serializeWideNavOpen(true)).toBe("1");
    expect(serializeWideNavOpen(false)).toBe("0");
  });

  test("maps routes to compact tabs and nested paths stay in the same tab", () => {
    expect(tabIdForPath("/dashboard")).toBe("overview");
    expect(tabIdForPath("/quotes/q1")).toBe("sales");
    expect(tabIdForPath("/revenue/r1")).toBe("finance");
    expect(tabIdForPath("/tasks/t1")).toBe("ops");
    expect(tabIdForPath("/company-setup")).toBe("more");
    expect(tabIdForPath("/admin/manual/progress")).toBe("more");
    expect(navItemsForTab("more").map((item) => item.href)).toEqual(["/company-setup", "/documents", "/admin/manual"]);
  });

  test("does not treat other pages as the dashboard", () => {
    expect(isNavItemActive("/documents", "/dashboard")).toBe(false);
    expect(isNavItemActive("/clients-projects/p1", "/clients-projects")).toBe(true);
    expect(isNavItemActive("/clients/c1", "/clients")).toBe(true);
    expect(isNavItemActive("/clients-projects", "/clients")).toBe(false);
  });

  test("splits client and project destinations in sales nav", () => {
    const labels = navItems().map((item) => item.label);
    expect(labels).toContain("고객사");
    expect(labels).toContain("프로젝트");
    expect(labels).not.toContain("고객사 · 프로젝트");
  });
});
