"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import panelStyles from "@/components/create-panel.module.css";

type CreatePanelProps = {
  open: boolean;
  /** 접근성 이름. showHeader를 켜면 화면 제목으로도 표시한다. */
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** wide=센터 폼, drawer=우측, xlarge=원가 작성기처럼 거의 전체 */
  size?: "wide" | "drawer" | "xlarge";
  /** 고객사·견적처럼 패널 안에서 닫기를 늘 보여줘야 하는 화면만 켠다. */
  showHeader?: boolean;
};

export function CreatePanel({ open, title, onClose, children, size = "wide", showHeader = false }: CreatePanelProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.dataset.createPanelOpen = "true";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
      delete document.documentElement.dataset.createPanelOpen;
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  const panelClass =
    size === "drawer"
      ? "create-panel create-panel-drawer"
      : size === "xlarge"
        ? "create-panel create-panel-xlarge"
        : "create-panel create-panel-wide";

  return createPortal(
    <div className="create-panel-layer is-open">
      <button aria-label={showHeader ? "배경 닫기" : "작성 닫기"} className="create-panel-backdrop" onClick={onClose} type="button" />
      <div aria-label={title} aria-modal="true" className={panelClass} role="dialog">
        {showHeader ? (
          <header className={panelStyles.header}>
            <h2>{title}</h2>
            <button aria-label="작성 닫기" className={panelStyles.closeButton} onClick={onClose} type="button">
              닫기
            </button>
          </header>
        ) : null}
        <div className="create-panel-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
