"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth/client";
import { validateNewPassword } from "@/lib/auth/password-reset";

type PasswordResetFormProps = {
  token?: string;
};

export function PasswordResetForm({ token }: PasswordResetFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(token ? null : "이 링크는 만료되었거나 유효하지 않습니다.");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    const confirmation = String(formData.get("confirmation") ?? "");
    const validationError = validateNewPassword(password, confirmation);

    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setIsSubmitting(true);
    const { error: resetError } = await authClient.resetPassword({ newPassword: password, token });

    if (resetError) {
      setError("비밀번호를 설정할 수 없습니다. 새 링크를 요청해 주세요.");
      setIsSubmitting(false);
      return;
    }

    router.replace("/sign-in?passwordReset=1");
  }

  return (
    <form className="auth-form" onSubmit={resetPassword}>
      <label className="auth-label" htmlFor="password">
        새 비밀번호
      </label>
      <input autoComplete="new-password" className="auth-input" disabled={!token} id="password" name="password" required type="password" />

      <label className="auth-label" htmlFor="confirmation">
        새 비밀번호 확인
      </label>
      <input autoComplete="new-password" className="auth-input" disabled={!token} id="confirmation" name="confirmation" required type="password" />

      {error ? <p className="auth-error" role="alert">{error}</p> : null}

      <button className="auth-submit" disabled={!token || isSubmitting} type="submit">
        {isSubmitting ? "설정 중…" : "비밀번호 설정"}
      </button>
    </form>
  );
}
