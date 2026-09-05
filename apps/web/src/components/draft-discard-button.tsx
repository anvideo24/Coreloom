"use client";

import { useState } from "react";

import { useDraftFormContext } from "@/components/draft-aware-form";

type DraftDiscardButtonProps = {
  className?: string;
};

/**
 * 초안 버리기(F02-02). `DraftAwareForm` 안(children)에서만 쓴다 — 밖에서 쓰면 컨텍스트가
 * 없어 조용히 아무것도 렌더하지 않는다.
 *
 * - 초안이 실제로 남아 있을 때만 보인다(늘 떠 있으면 시끄럽다).
 * - 되돌릴 수 없는 동작이라 한 번 묻는다. `window.confirm` 대신, 이 앱의 로그아웃 버튼
 *   (`sign-out-button.tsx`)과 같은 방식 — 누르면 버튼이 "정말 버릴까요/취소" 두 개로 바뀐다.
 */
export function DraftDiscardButton({ className }: DraftDiscardButtonProps) {
  const draftForm = useDraftFormContext();
  const [confirming, setConfirming] = useState(false);

  if (!draftForm || !draftForm.hasDraft) return null;

  if (confirming) {
    return (
      <span className="draft-discard-confirm">
        <button
          className={className}
          onClick={() => {
            draftForm.discardDraft();
            setConfirming(false);
          }}
          type="button"
        >
          정말 버릴까요
        </button>
        <button className="draft-discard-cancel" onClick={() => setConfirming(false)} type="button">
          취소
        </button>
      </span>
    );
  }

  return (
    <button className={className ?? "text-link"} onClick={() => setConfirming(true)} type="button">
      이 초안 버리기
    </button>
  );
}
