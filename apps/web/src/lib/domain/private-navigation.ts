export const NAV_COMPACT_MAX_PX = 640;
export const NAV_WIDE_MEDIA = "(min-width: 40rem)";
export const NAV_HOVER_PEEK_MEDIA = "(hover: hover) and (pointer: fine)";
export const NAV_HOVER_HIDE_MS = 180;
export const WIDE_NAV_OPEN_STORAGE_KEY = "coreloom.wide-nav-open";

export type NavItem = {
  href: string;
  label: string;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const navGroups: NavGroup[] = [
  {
    label: "개요",
    items: [{ href: "/dashboard", label: "대시보드" }],
  },
  {
    label: "회사",
    items: [
      { href: "/company-setup", label: "설립 준비" },
      { href: "/documents", label: "문서함" },
    ],
  },
  {
    label: "수주",
    items: [
      { href: "/clients", label: "고객사" },
      { href: "/clients-projects", label: "프로젝트" },
      { href: "/quotes", label: "견적서" },
      { href: "/contracts", label: "계약" },
      { href: "/billings", label: "청구" },
    ],
  },
  {
    label: "재무",
    items: [
      { href: "/revenue", label: "매출 원장" },
      { href: "/expenses", label: "비용 원장" },
      { href: "/accounts", label: "계정과목" },
    ],
  },
  {
    label: "운영",
    items: [
      { href: "/tasks", label: "업무" },
      { href: "/agents", label: "에이전트" },
      { href: "/timeline", label: "근거 기록" },
      { href: "/proposals", label: "AI 제안" },
    ],
  },
  {
    label: "설정",
    items: [{ href: "/admin/manual", label: "매뉴얼" }],
  },
];

export const compactTabs = [
  { id: "overview", label: "개요", href: "/dashboard" },
  { id: "sales", label: "수주" },
  { id: "finance", label: "재무" },
  { id: "ops", label: "운영" },
  { id: "more", label: "더보기" },
] as const;

export type CompactTabId = (typeof compactTabs)[number]["id"];

const tabGroupLabels: Record<CompactTabId, string[]> = {
  overview: ["개요"],
  sales: ["수주"],
  finance: ["재무"],
  ops: ["운영"],
  more: ["회사", "설정"],
};

export function isNavItemActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function navItems() {
  return navGroups.flatMap((group) => group.items);
}

export function navItemsForTab(tabId: CompactTabId) {
  const labels = tabGroupLabels[tabId];
  return navGroups.filter((group) => labels.includes(group.label)).flatMap((group) => group.items);
}

export function tabIdForPath(pathname: string): CompactTabId | null {
  for (const tab of compactTabs) {
    if (navItemsForTab(tab.id).some((item) => isNavItemActive(pathname, item.href))) {
      return tab.id;
    }
  }
  return null;
}

export function navigationShell(widthPx: number) {
  return widthPx < NAV_COMPACT_MAX_PX ? "compact" : "drawer";
}

export function parseWideNavOpen(raw: string | null, fallback = true) {
  if (raw === "0" || raw === "false") return false;
  if (raw === "1" || raw === "true") return true;
  return fallback;
}

export function serializeWideNavOpen(open: boolean) {
  return open ? "1" : "0";
}

export function canHoverPeekWideNav(pinned: boolean, hoverCapable: boolean) {
  return hoverCapable && !pinned;
}

export function isNavToggleHotkey(event: {
  key: string;
  code?: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey?: boolean;
  repeat?: boolean;
}) {
  if (event.repeat || event.altKey || event.shiftKey) return false;
  if (!event.ctrlKey && !event.metaKey) return false;
  return event.key.toLowerCase() === "b" || event.code === "KeyB";
}

export function isEditableHotkeyTarget(target: EventTarget | null) {
  if (target == null || typeof target !== "object") return false;
  const el = target as { tagName?: string; isContentEditable?: boolean };
  const tag = typeof el.tagName === "string" ? el.tagName.toUpperCase() : "";
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return Boolean(el.isContentEditable);
}
