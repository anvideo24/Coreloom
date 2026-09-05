// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PrivateNavigation } from "@/components/private-navigation";

vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={String(href)} {...props}>{children}</a> }));
vi.mock("@/components/sign-out-button", () => ({ SignOutButton: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>로그아웃</button> }));

describe("responsive private navigation", () => {
  beforeEach(() => {
    localStorage.clear(); localStorage.setItem("coreloom.wide-nav-open", "1");
    Object.defineProperty(document.documentElement, "clientWidth", { configurable: true, value: 1200 });
    document.documentElement.dataset.agentDockNav = "rail";
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  });
  afterEach(() => { cleanup(); delete document.documentElement.dataset.agentDockNav; vi.unstubAllGlobals(); });

  it("keeps a usable menu toggle while the saved wide navigation is temporarily a rail", async () => {
    render(<PrivateNavigation />);
    const toggle = await screen.findByRole("button", { name: "메뉴 펼치기" });
    expect(toggle.hidden).toBe(false);
    expect(document.querySelector('.private-drawer-layer')?.classList.contains('is-open')).toBe(false);
    fireEvent.click(toggle);
    await waitFor(() => expect(screen.getByRole("link", { name: "대시보드" })).toBeTruthy());
    expect(document.querySelector('.private-drawer-layer')?.classList.contains('is-open')).toBe(true);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(document.querySelector('.private-drawer-layer')?.classList.contains('is-open')).toBe(false);
    expect(localStorage.getItem("coreloom.wide-nav-open")).toBe("1");
  });
});
