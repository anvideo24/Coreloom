"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import {
  canHoverPeekWideNav,
  compactTabs,
  isEditableHotkeyTarget,
  isNavItemActive,
  isNavToggleHotkey,
  NAV_HOVER_HIDE_MS,
  NAV_HOVER_PEEK_MEDIA,
  NAV_WIDE_MEDIA,
  navGroups,
  navItemsForTab,
  parseWideNavOpen,
  serializeWideNavOpen,
  tabIdForPath,
  WIDE_NAV_OPEN_STORAGE_KEY,
  type CompactTabId,
} from "@/lib/domain/private-navigation";

function isWideNavigationViewport() {
  return window.matchMedia(NAV_WIDE_MEDIA).matches;
}

function isFineHoverPointer() {
  return window.matchMedia(NAV_HOVER_PEEK_MEDIA).matches;
}

function NavToggleButton({
  open,
  onHoverEnter,
  onHoverLeave,
  onToggle,
}: {
  open: boolean;
  onHoverEnter: () => void;
  onHoverLeave: () => void;
  onToggle: () => void;
}) {
  return (
    <button
      aria-controls="private-drawer"
      aria-expanded={open}
      aria-keyshortcuts="Control+B Meta+B"
      aria-label={open ? "메뉴 접기" : "메뉴 펼치기"}
      className="private-menu-button"
      onClick={onToggle}
      onMouseEnter={onHoverEnter}
      onMouseLeave={onHoverLeave}
      title="Ctrl+B 또는 ⌘B"
      type="button"
    >
      <span aria-hidden="true" className="private-menu-icon" />
    </button>
  );
}

export function PrivateNavigation() {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [hoverPeek, setHoverPeek] = useState(false);
  const [sidebarReady, setSidebarReady] = useState(false);
  const hidePeekTimer = useRef(0);
  const navVisible = drawerOpen || hoverPeek;
  const [openTab, setOpenTab] = useState<CompactTabId | null>(null);
  const drawerTitleId = useId();
  const sheetTitleId = useId();
  const activeTab = tabIdForPath(pathname);
  const sheetItems = openTab ? navItemsForTab(openTab) : [];
  const sheetLabel = openTab ? compactTabs.find((tab) => tab.id === openTab)?.label : null;

  useEffect(() => {
    setDrawerOpen(parseWideNavOpen(window.localStorage.getItem(WIDE_NAV_OPEN_STORAGE_KEY)));
    setSidebarReady(true);
  }, []);

  useEffect(() => {
    if (!sidebarReady) return;
    window.localStorage.setItem(WIDE_NAV_OPEN_STORAGE_KEY, serializeWideNavOpen(drawerOpen));
  }, [drawerOpen, sidebarReady]);

  useEffect(() => {
    setOpenTab(null);
    setHoverPeek(false);
  }, [pathname]);

  useEffect(() => {
    if (drawerOpen) setHoverPeek(false);
  }, [drawerOpen]);

  useEffect(() => {
    return () => window.clearTimeout(hidePeekTimer.current);
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDrawerOpen(false);
        setHoverPeek(false);
        setOpenTab(null);
        return;
      }
      if (!isNavToggleHotkey(event) || isEditableHotkeyTarget(event.target)) return;
      if (!isWideNavigationViewport()) return;
      event.preventDefault();
      setDrawerOpen((open) => !open);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!openTab) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [openTab]);

  function toggleTab(tabId: CompactTabId) {
    setOpenTab((current) => (current === tabId ? null : tabId));
  }

  function toggleDrawer() {
    setHoverPeek(false);
    setDrawerOpen((open) => !open);
  }

  function cancelPeekHide() {
    window.clearTimeout(hidePeekTimer.current);
  }

  function showHoverPeek() {
    if (!isWideNavigationViewport()) return;
    if (!canHoverPeekWideNav(drawerOpen, isFineHoverPointer())) return;
    cancelPeekHide();
    setHoverPeek(true);
  }

  function hideHoverPeekSoon() {
    if (drawerOpen) return;
    cancelPeekHide();
    hidePeekTimer.current = window.setTimeout(() => setHoverPeek(false), NAV_HOVER_HIDE_MS);
  }

  const layerClass = ["private-drawer-layer"];
  if (drawerOpen) layerClass.push("is-open");
  if (!drawerOpen && hoverPeek) layerClass.push("is-peek");

  return (
    <>
      <NavToggleButton
        onHoverEnter={showHoverPeek}
        onHoverLeave={hideHoverPeekSoon}
        onToggle={toggleDrawer}
        open={navVisible}
      />

      <div
        className={layerClass.join(" ")}
        inert={!navVisible}
        onMouseEnter={showHoverPeek}
        onMouseLeave={hideHoverPeekSoon}
      >
        <aside aria-labelledby={drawerTitleId} className="private-navigation" id="private-drawer">
          <div className="private-drawer-head">
            <Link className="private-navigation-brand" href="/dashboard" id={drawerTitleId}>
              CORELOOM
            </Link>
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
