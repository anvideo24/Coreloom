"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";

import {
  compactTabs,
  isNavItemActive,
  navGroups,
  navItemsForTab,
  tabIdForPath,
  type CompactTabId,
} from "@/lib/domain/private-navigation";

export function PrivateNavigation() {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [openTab, setOpenTab] = useState<CompactTabId | null>(null);
  const drawerTitleId = useId();
  const sheetTitleId = useId();
  const activeTab = tabIdForPath(pathname);
  const sheetItems = openTab ? navItemsForTab(openTab) : [];
  const sheetLabel = openTab ? compactTabs.find((tab) => tab.id === openTab)?.label : null;

  useEffect(() => {
    setDrawerOpen(false);
    setOpenTab(null);
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen && !openTab) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDrawerOpen(false);
        setOpenTab(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen, openTab]);

  useEffect(() => {
    if (!drawerOpen && !openTab) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [drawerOpen, openTab]);

  function toggleTab(tabId: CompactTabId) {
    setOpenTab((current) => (current === tabId ? null : tabId));
  }

  return (
    <>
      <header className="private-topbar">
        <button
          aria-controls="private-drawer"
          aria-expanded={drawerOpen}
          className="private-menu-button"
          onClick={() => setDrawerOpen(true)}
          type="button"
        >
          <span aria-hidden="true" className="private-menu-icon" />
          메뉴
        </button>
        <Link className="private-navigation-brand" href="/dashboard">CORELOOM</Link>
      </header>

      <div className={drawerOpen ? "private-drawer-layer is-open" : "private-drawer-layer"} inert={!drawerOpen}>
        <button aria-label="메뉴 닫기" className="private-drawer-backdrop" onClick={() => setDrawerOpen(false)} type="button" />
        <aside aria-labelledby={drawerTitleId} aria-modal="true" className="private-navigation" id="private-drawer" role="dialog">
          <div className="private-drawer-head">
            <div>
              <p className="private-navigation-brand" id={drawerTitleId}>CORELOOM</p>
              <p className="private-navigation-sub">대표 운영 본부</p>
            </div>
            <button className="private-drawer-close" onClick={() => setDrawerOpen(false)} type="button">
              닫기
            </button>
          </div>
          <nav aria-label="운영 메뉴">
            {navGroups.map((group) => (
              <div className="nav-group" key={group.label}>
                <p className="nav-group-label">{group.label}</p>
                {group.items.map((item) => (
                  <Link
                    aria-current={isNavItemActive(pathname, item.href) ? "page" : undefined}
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
      </div>

      <nav aria-label="운영 메뉴" className="private-tabbar">
        {compactTabs.map((tab) => {
          const items = navItemsForTab(tab.id);
          const current = activeTab === tab.id;
          if ("href" in tab && items.length === 1) {
            return (
              <Link
                aria-current={current ? "page" : undefined}
                className="private-tab"
                href={tab.href}
                key={tab.id}
              >
                {tab.label}
              </Link>
            );
          }
          return (
            <button
              aria-current={current ? "true" : undefined}
              aria-expanded={openTab === tab.id}
              className="private-tab"
              key={tab.id}
              onClick={() => toggleTab(tab.id)}
              type="button"
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      <div className={openTab ? "private-sheet-layer is-open" : "private-sheet-layer"} hidden={!openTab}>
        <button aria-label="메뉴 닫기" className="private-sheet-backdrop" onClick={() => setOpenTab(null)} type="button" />
        <div aria-labelledby={sheetTitleId} aria-modal="true" className="private-sheet" role="dialog">
          <div className="private-sheet-head">
            <p id={sheetTitleId}>{sheetLabel}</p>
            <button className="private-drawer-close" onClick={() => setOpenTab(null)} type="button">닫기</button>
          </div>
          <nav aria-label={sheetLabel ?? "하위 메뉴"}>
            {sheetItems.map((item) => (
              <Link
                aria-current={isNavItemActive(pathname, item.href) ? "page" : undefined}
                className="nav-link"
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </>
  );
}
