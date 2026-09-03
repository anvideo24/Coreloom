"use client";

import { FormEvent, useState } from "react";

import { authClient } from "@/lib/auth/client";
import { passwordResetRedirectUrl } from "@/lib/auth/password-reset";

export function PasswordResetRequestForm() {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSent, setIsSent] = useState(false);

  async function requestPasswordReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    const { error: resetError } = await authClient.requestPasswordReset({
      email,
      redirectTo: passwordResetRedirectUrl(window.location.origin),
    });

    if (resetError) {
      setError("메일을 보낼 수 없습니다. 잠시 후 다시 시도해 주세요.");
      setIsSubmitting(false);
      return;
    }

    setIsSent(true);
    setIsSubmitting(false);
  }

  if (isSent) {
    return <p className="auth-notice" role="status">등록된 대표 이메일이면 비밀번호 설정 링크를 보냈습니다. 메일함을 확인해 주세요.</p>;
  }

  return (
    <form className="auth-form" onSubmit={requestPasswordReset}>
      <label className="auth-label" htmlFor="email">
        대표 이메일
      </label>
      <input autoComplete="email" className="auth-input" id="email" name="email" required type="email" />

      {error ? <p className="auth-error" role="alert">{error}</p> : null}

      <button className="auth-submit" disabled={isSubmitting} type="submit">
        {isSubmitting ? "요청 중…" : "비밀번호 설정 링크 보내기"}
      </button>
    </form>
  );
}
