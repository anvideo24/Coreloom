import Link from "next/link";

const navigationItems = [
  { href: "/dashboard", label: "대시보드" },
  { href: "/company-setup", label: "회사 설립 준비" },
  { href: "/documents", label: "문서함" },
  { href: "/clients-projects", label: "고객사 · 프로젝트" },
  { href: "/quotes", label: "견적서" },
  { href: "/contracts", label: "계약" },
  { href: "/billings", label: "청구" },
  { href: "/revenue", label: "매출 원장" },
  { href: "/expenses", label: "비용 원장" },
  { href: "/tasks", label: "업무" },
  { href: "/timeline", label: "근거 기록" },
  { href: "/proposals", label: "AI 제안" },
  { href: "/admin/manual", label: "운영 매뉴얼" },
];

export function PrivateNavigation() {
  return <aside aria-label="Coreloom 운영 내비게이션" className="private-navigation"><Link className="private-navigation-brand" href="/dashboard">CORELOOM</Link><p>대표 운영 본부</p><nav aria-label="운영 메뉴">{navigationItems.map((item) => <Link href={item.href} key={item.href}>{item.label}</Link>)}</nav></aside>;
}
