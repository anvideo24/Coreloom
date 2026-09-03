import { describe, expect, test } from "vitest";

const navData = [
  { href: "/dashboard", label: "대시보드" },
  { href: "/company-setup", label: "설립 준비" },
  { href: "/documents", label: "문서함" },
  { href: "/clients-projects", label: "고객사 · 프로젝트" },
  { href: "/quotes", label: "견적서" },
  { href: "/contracts", label: "계약" },
  { href: "/billings", label: "청구" },
  { href: "/revenue", label: "매출 원장" },
  { href: "/expenses", label: "비용 원장" },
  { href: "/tasks", label: "업무" },
  { href: "/agents", label: "에이전트" },
  { href: "/timeline", label: "근거 기록" },
  { href: "/proposals", label: "AI 제안" },
  { href: "/admin/manual", label: "운영 매뉴얼" },
];

describe("PrivateNavigation", () => {
  test("includes all required operating destinations", () => {
    const hrefs = navData.map((item) => item.href);
    expect(hrefs).toContain("/dashboard");
    expect(hrefs).toContain("/company-setup");
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
    const labels = navData.map((item) => item.label);
    expect(labels).toContain("비용 원장");
    expect(labels).toContain("에이전트");
    expect(labels).toContain("운영 매뉴얼");
  });
});
