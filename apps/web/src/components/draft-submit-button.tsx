"use client";

import { useFormStatus } from "react-dom";

type DraftSubmitButtonProps = {
  className?: string;
  children: React.ReactNode;
  /** 제출 중 라벨. 기본값은 children 그대로 유지(스피너 없이 disabled만으로도 눌림을 막는다). */
  pendingLabel?: React.ReactNode;
};

/**
 * 저장 버튼(F02-03 화면 방어). `useFormStatus`는 자신을 렌더한 컴포넌트가 아니라, 자신을
 * 감싸는 가장 가까운 `<form>`의 진행 상태를 읽는다 — 그래서 `DraftAwareForm`이 감싼 `<form>`
 * 안에서 쓰면(children으로 전달되는 위치라 해도) 제출 중일 때 자동으로 pending이 true가 된다.
 *
 * 이게 막는 것: 같은 클릭 한 번이 처리되는 동안의 두 번째 클릭(연타).
 * 이게 못 막는 것: 새로고침 뒤 재시도, 네트워크 재전송처럼 이 버튼 인스턴스 자체가 사라진
 * 뒤에 오는 재제출 — 그건 화면에 남은 상태가 없어 여기서 막을 수 없다(서버 쪽 판정은 아직
 * 연결되지 않았다, `src/lib/domain/submission-dedupe.ts` 참고).
 */
export function DraftSubmitButton({ className, children, pendingLabel }: DraftSubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <button className={className} disabled={pending} type="submit">
      {pending ? (pendingLabel ?? children) : children}
    </button>
  );
}
