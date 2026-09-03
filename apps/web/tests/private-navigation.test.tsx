import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { PrivateNavigation } from "@/components/private-navigation";

describe("PrivateNavigation", () => {
  test("shows the dashboard and operating destinations", () => {
    const html = renderToStaticMarkup(<PrivateNavigation />);

    expect(html).toContain('href="/dashboard"');
    expect(html).toContain('href="/company-setup"');
    expect(html).toContain('href="/clients-projects"');
    expect(html).toContain('href="/quotes"');
    expect(html).toContain('href="/contracts"');
    expect(html).toContain('href="/billings"');
    expect(html).toContain('href="/revenue"');
    expect(html).toContain('href="/expenses"');
    expect(html).toContain("비용 원장");
    expect(html).toContain('href="/tasks"');
    expect(html).toContain('href="/agents"');
    expect(html).toContain("에이전트");
    expect(html).toContain('href="/admin/manual"');
    expect(html).toContain("운영 매뉴얼");
    // Admin manual progress page is accessible via manual nav, not main navigation
  });
});
