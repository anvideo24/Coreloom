"use client";

import { useEffect, useId, useRef, useState } from "react";

export type CreateMenuOption = {
  label: string;
  onClick: () => void;
};

type CreateMenuButtonProps = {
  /** 열기 버튼 접근성 이름 (예: 새로 만들기) */
  label: string;
  options: CreateMenuOption[];
  disabled?: boolean;
};

/**
 * 생성 종류가 둘 이상일 때 쓰는 헤더 버튼.
 * `+`는 하나만 두고, 메뉴에서 문구로 고른다.
 */
export function CreateMenuButton({ label, options, disabled }: CreateMenuButtonProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="create-menu" ref={rootRef}>
      <button
        aria-controls={menuId}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={label}
        className="create-icon-button"
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        title={label}
        type="button"
      >
        <span aria-hidden="true" className="create-icon-glyph" />
      </button>
      {open ? (
        <div className="create-menu-panel" id={menuId} role="menu">
          {options.map((option) => (
            <button
              className="create-menu-item"
              key={option.label}
              onClick={() => {
                setOpen(false);
                option.onClick();
              }}
              role="menuitem"
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
