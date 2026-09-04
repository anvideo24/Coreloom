"use client";

type CreateIconButtonProps = {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
};

/** 목록 화면 공통 생성 버튼. 문구 대신 + 아이콘만 쓴다. */
export function CreateIconButton({ label, onClick, disabled, className }: CreateIconButtonProps) {
  return (
    <button
      aria-label={label}
      className={className ? `create-icon-button ${className}` : "create-icon-button"}
      disabled={disabled}
      onClick={onClick}
      title={label}
      type="button"
    >
      <span aria-hidden="true" className="create-icon-glyph" />
    </button>
  );
}
