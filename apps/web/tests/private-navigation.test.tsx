import { describe, expect, test } from "vitest";

import {
  isEditableHotkeyTarget,
  isNavItemActive,
  isNavToggleHotkey,
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
    expect(hrefs).toContain("/company-setup");
    expect(hrefs).toContain("/documents");
    expect(hrefs).toContain("/clients-projects");
    expect(hrefs).toContain("/quotes");
    expect(hrefs).toContain("/contracts");
    expect(hrefs).toContain("/billings");
    expect(hrefs).toContain("/revenue");
    expect(hrefs).toContain("/expenses");
    expect(hrefs).toContain("/tasks");
    expect(hrefs).toContain("/agents");
    expect(hrefs).toContain("/timeline");
    expect(hrefs).toContain("/proposals");
    expect(hrefs).toContain("/admin/manual");
  });

  test("includes required labels", () => {
    const labels = navItems().map((item) => item.label);
    expect(labels).toContain("비용 원장");
    expect(labels).toContain("에이전트");
    expect(labels).toContain("운영 매뉴얼");
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
    expect(isEditableHotkeyTarget({ tagName: "INPUT" })).toBe(true);
    expect(isEditableHotkeyTarget({ tagName: "textarea" })).toBe(true);
    expect(isEditableHotkeyTarget({ tagName: "SELECT" })).toBe(true);
    expect(isEditableHotkeyTarget({ tagName: "DIV", isContentEditable: true })).toBe(true);
    expect(isEditableHotkeyTarget({ tagName: "BUTTON" })).toBe(false);
    expect(isEditableHotkeyTarget(null)).toBe(false);
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
  });
});
