"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navGroups = [
  {
    label: "개요",
    items: [
      { href: "/dashboard", label: "대시보드" },
    ],
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
    items: [
      { href: "/admin/manual", label: "운영 매뉴얼" },
    ],
  },
];

export function PrivateNavigation() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  return (
    <aside aria-label="Coreloom 운영 내비게이션" className="private-navigation">
      <Link className="private-navigation-brand" href="/dashboard">CORELOOM</Link>
      <p className="private-navigation-sub">대표 운영 본부</p>
      <nav aria-label="운영 메뉴">
        {navGroups.map((group) => (
          <div className="nav-group" key={group.label}>
            <p className="nav-group-label">{group.label}</p>
            {group.items.map((item) => (
              <Link
                aria-current={isActive(item.href) ? "page" : undefined}
                className="nav-link"
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}
