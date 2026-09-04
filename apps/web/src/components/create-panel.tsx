"use client";

import { useEffect, useId } from "react";

type CreatePanelProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** 필드가 많으면 wide(센터), 적으면 drawer(우측) */
  size?: "wide" | "drawer";
};

export function CreatePanel({ open, title, onClose, children, size = "wide" }: CreatePanelProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="create-panel-layer is-open">
      <button aria-label="작성 닫기" className="create-panel-backdrop" onClick={onClose} type="button" />
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className={size === "drawer" ? "create-panel create-panel-drawer" : "create-panel create-panel-wide"}
        role="dialog"
      >
        <div className="create-panel-head">
          <h2 id={titleId}>{title}</h2>
          <button aria-label="닫기" className="create-panel-close" onClick={onClose} type="button">
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <div className="create-panel-body">{children}</div>
      </div>
    </div>
  );
}
