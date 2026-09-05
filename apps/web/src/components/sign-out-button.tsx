"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { authClient } from "@/lib/auth/client";
import { FORM_DRAFT_KEY_PREFIX } from "@/lib/domain/form-draft";

/**
 * 나가는 길. 이게 없어서 공용 PC나 잃어버린 기기에서 세션을 끊을 방법이 없었다.
 *
 * 나갈 때 이 브라우저에 남은 작성 중 초안도 함께 지운다. 초안은 사용자별 열쇠로 갈려 있어
 * 다음 사람이 읽지는 못하지만, 남겨 둘 이유가 없다. 「나갔다」는 말과 실제로 남은 것이
 * 다르면 그게 오해의 시작이다(F02-04).
 */
function clearBrowserDrafts() {
  try {
    const storage = window.sessionStorage;
    // 지우면서 순회하면 색인이 밀린다. 지울 열쇠를 먼저 다 모은다.
    const keys: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key?.startsWith(FORM_DRAFT_KEY_PREFIX)) keys.push(key);
    }
    for (const key of keys) storage.removeItem(key);
  } catch {
    /* 비공개 모드 등 저장소를 못 쓰는 상황은 지울 것이 없는 것과 같다. */
  }
}

export function SignOutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "confirming" | "leaving">("idle");
  const [error, setError] = useState<string | null>(null);

  async function leave() {
    setState("leaving");
    setError(null);
    try {
      const result = await authClient.signOut();
      // 서버가 끊었다고 답했을 때만 나간 것이다. 화면만 바꾸고 세션이 살아 있으면 더 나쁘다.
      if (result && typeof result === "object" && "error" in result && result.error) {
        throw new Error("로그아웃 요청이 거부되었습니다.");
      }
      clearBrowserDrafts();
      router.replace("/sign-in");
      router.refresh();
    } catch (caught) {
      setState("idle");
      setError(caught instanceof Error ? caught.message : "로그아웃하지 못했습니다. 다시 시도해 주세요.");
    }
  }

  if (state === "confirming") {
    return (
      <span className="sign-out-confirm">
        <button className={className} onClick={() => void leave()} type="button">
          정말 나갈까요
        </button>
        <button className="sign-out-cancel" onClick={() => setState("idle")} type="button">
          취소
        </button>
      </span>
    );
  }

  return (
    <>
      <button
        className={className}
        disabled={state === "leaving"}
        onClick={() => setState("confirming")}
        type="button"
      >
        {state === "leaving" ? "나가는 중" : "로그아웃"}
      </button>
      {error ? <span className="sign-out-error" role="alert">{error}</span> : null}
    </>
  );
}
