"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";

type CreatePanelProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** wide=센터 폼, drawer=우측, xlarge=원가 작성기처럼 거의 전체 */
  size?: "wide" | "drawer" | "xlarge";
};

export function CreatePanel({ open, title, onClose, children, size = "wide" }: CreatePanelProps) {
  const titleId = useId();
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
      <button aria-label="작성 닫기" className="create-panel-backdrop" onClick={onClose} type="button" />
      <div aria-labelledby={titleId} aria-modal="true" className={panelClass} role="dialog">
        <div className="create-panel-head">
          <h2 id={titleId}>{title}</h2>
          <button aria-label="닫기" className="create-panel-close" onClick={onClose} type="button">
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <div className="create-panel-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
