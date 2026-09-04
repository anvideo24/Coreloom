export const NAV_COMPACT_MAX_PX = 640;

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
      { href: "/clients-projects", label: "고객사 · 프로젝트" },
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
    items: [{ href: "/admin/manual", label: "운영 매뉴얼" }],
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
