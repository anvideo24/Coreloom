"use client";

import { useFormStatus } from "react-dom";

import { useDraftFormContext } from "@/components/draft-aware-form";

type DraftSubmitButtonProps = {
  className?: string;
  children: React.ReactNode;
  disabled?: boolean;
  /** 제출 중 라벨. 기본값은 children 그대로 유지(스피너 없이 disabled만으로도 눌림을 막는다). */
  pendingLabel?: React.ReactNode;
};

/**
 * 저장 버튼(F02-03 화면 방어). `useFormStatus`는 자신을 렌더한 컴포넌트가 아니라, 자신을
 * 감싸는 가장 가까운 `<form>`의 진행 상태를 읽는다 — 그래서 `DraftAwareForm`이 감싼 `<form>`
 * 안에서 쓰면(children으로 전달되는 위치라 해도) 제출 중일 때 자동으로 pending이 true가 된다.
 *
 * 이 버튼은 진행 중 클릭을 막고, 복구·멱등성을 opt-in한 `DraftAwareForm`은 같은 마운트
 * 안의 두 번째 submit도 막는다. 새로고침 뒤 재시도·네트워크 재전송은 화면 상태만으로
 * 판정할 수 없으므로 서버 멱등성 없이는 보장하지 않는다(`src/lib/domain/submission-dedupe.ts` 참고).
 */
export function DraftSubmitButton({ className, children, disabled = false, pendingLabel }: DraftSubmitButtonProps) {
  const { pending } = useFormStatus();
  const form = useDraftFormContext();
  const isPending = pending || form?.submissionInFlight;
  return (
    <button className={className} disabled={disabled || isPending || form?.submissionBlocked} type="submit">
      {isPending ? (pendingLabel ?? children) : children}
    </button>
  );
}
